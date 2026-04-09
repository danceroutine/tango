import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aDBClient, aTangoRuntime } from '@danceroutine/tango-testing';
import type { DBClient } from '../../connection/clients/DBClient';
import { TangoRuntime } from '../../runtime/TangoRuntime';
import type { AtomicTransaction } from '../AtomicTransaction';
import { UnitOfWork } from '../UnitOfWork';
import { TransactionEngine } from '../internal/context';

vi.mock('@danceroutine/tango-core', async () => {
    const actual = await vi.importActual<typeof import('@danceroutine/tango-core')>('@danceroutine/tango-core');
    return {
        ...actual,
        getLogger: vi.fn(() => ({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
        })),
    };
});

type MockLease = {
    client: DBClient;
    release: ReturnType<typeof vi.fn>;
};

function createRuntime(): { runtime: TangoRuntime; lease: MockLease } {
    const client: DBClient = aDBClient();
    const release = vi.fn(async () => {});
    const runtime = aTangoRuntime();
    vi.spyOn(runtime, 'leaseTransactionClient').mockResolvedValue({ client, release });

    return { runtime, lease: { client, release } };
}

describe('transaction.atomic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('begins, commits, and releases the outer transaction lease', async () => {
        const { runtime, lease } = createRuntime();
        const callbacks: string[] = [];

        const result = await TransactionEngine.forRuntime(runtime).atomic(async (tx) => {
            tx.onCommit(() => {
                callbacks.push('commit');
            });
            return 42;
        });

        expect(result).toBe(42);
        expect(lease.client.begin).toHaveBeenCalledOnce();
        expect(lease.client.commit).toHaveBeenCalledOnce();
        expect(lease.client.rollback).not.toHaveBeenCalled();
        expect(lease.release).toHaveBeenCalledOnce();
        expect(callbacks).toEqual(['commit']);
    });

    it('rolls back and discards callbacks when outer work throws', async () => {
        const { runtime, lease } = createRuntime();
        const callbacks: string[] = [];

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async (tx) => {
                tx.onCommit(() => {
                    callbacks.push('commit');
                });
                throw new Error('boom');
            })
        ).rejects.toThrow('boom');

        expect(lease.client.begin).toHaveBeenCalledOnce();
        expect(lease.client.rollback).toHaveBeenCalledOnce();
        expect(lease.client.commit).not.toHaveBeenCalled();
        expect(callbacks).toEqual([]);
    });

    it('uses savepoints for nested atomic blocks and discards rolled-back nested callbacks only', async () => {
        const { runtime, lease } = createRuntime();
        const callbacks: string[] = [];

        await TransactionEngine.forRuntime(runtime).atomic(async (outer) => {
            outer.onCommit(() => {
                callbacks.push('outer-before');
            });

            await expect(
                TransactionEngine.forRuntime(runtime).atomic(async (inner) => {
                    inner.onCommit(() => {
                        callbacks.push('inner');
                    });
                    throw new Error('nested');
                })
            ).rejects.toThrow('nested');

            outer.onCommit(() => {
                callbacks.push('outer-after');
            });
        });

        expect(lease.client.createSavepoint).toHaveBeenCalledWith('tango_sp_0');
        expect(lease.client.rollbackToSavepoint).toHaveBeenCalledWith('tango_sp_0');
        expect(lease.client.releaseSavepoint).not.toHaveBeenCalled();
        expect(callbacks).toEqual(['outer-before', 'outer-after']);
    });

    it('returns a failed result from tx.savepoint without aborting the outer transaction by default', async () => {
        const { runtime, lease } = createRuntime();
        const callbacks: string[] = [];

        await TransactionEngine.forRuntime(runtime).atomic(async (tx) => {
            const result = await tx.savepoint(async () => {
                throw new Error('nested');
            });

            expect(result).toEqual({
                ok: false,
                error: expect.any(Error),
            });

            tx.onCommit(() => {
                callbacks.push('outer');
            });
        });

        expect(lease.client.createSavepoint).toHaveBeenCalledWith('tango_sp_0');
        expect(lease.client.rollbackToSavepoint).toHaveBeenCalledWith('tango_sp_0');
        expect(lease.client.commit).toHaveBeenCalledOnce();
        expect(callbacks).toEqual(['outer']);
    });

    it('rethrows tx.savepoint failures when throwOnError is enabled', async () => {
        const { runtime, lease } = createRuntime();

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async (tx) => {
                await tx.savepoint(
                    async () => {
                        throw new Error('nested');
                    },
                    { throwOnError: true }
                );
            })
        ).rejects.toThrow('nested');

        expect(lease.client.createSavepoint).toHaveBeenCalledWith('tango_sp_0');
        expect(lease.client.rollbackToSavepoint).toHaveBeenCalledWith('tango_sp_0');
        expect(lease.client.commit).not.toHaveBeenCalled();
    });

    it('returns a successful result from tx.savepoint and keeps callback order', async () => {
        const { runtime } = createRuntime();
        const callbacks: string[] = [];

        await TransactionEngine.forRuntime(runtime).atomic(async (tx) => {
            tx.onCommit(() => {
                callbacks.push('outer-before');
            });

            const result = await tx.savepoint(async (nested) => {
                nested.onCommit(() => {
                    callbacks.push('inner');
                });
                return 'inner';
            });

            expect(result).toEqual({ ok: true, value: 'inner' });

            tx.onCommit(() => {
                callbacks.push('outer-after');
            });
        });

        expect(callbacks).toEqual(['outer-before', 'inner', 'outer-after']);
    });

    it('returns the raw nested value when tx.savepoint succeeds with throwOnError enabled', async () => {
        const { runtime } = createRuntime();

        await TransactionEngine.forRuntime(runtime).atomic(async (tx) => {
            const value = await tx.savepoint(
                async () => {
                    return 'inner';
                },
                { throwOnError: true }
            );

            expect(value).toBe('inner');
        });
    });

    it('merges successful nested callbacks in global registration order', async () => {
        const { runtime } = createRuntime();
        const callbacks: string[] = [];

        await TransactionEngine.forRuntime(runtime).atomic(async (outer) => {
            outer.onCommit(() => {
                callbacks.push('outer-before');
            });

            await TransactionEngine.forRuntime(runtime).atomic(async (inner) => {
                inner.onCommit(() => {
                    callbacks.push('inner');
                });
            });

            outer.onCommit(() => {
                callbacks.push('outer-after');
            });
        });

        expect(callbacks).toEqual(['outer-before', 'inner', 'outer-after']);
    });

    it('rejects after commit when a non-robust callback throws', async () => {
        const { runtime, lease } = createRuntime();
        const later = vi.fn();

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async (tx) => {
                tx.onCommit(() => {
                    throw new Error('callback failed');
                });
                tx.onCommit(later);
            })
        ).rejects.toThrow('callback failed');

        expect(lease.client.commit).toHaveBeenCalledOnce();
        expect(later).not.toHaveBeenCalled();
    });

    it('swallows robust callback failures and continues later callbacks', async () => {
        const { runtime, lease } = createRuntime();
        const later = vi.fn();

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async (tx) => {
                tx.onCommit(
                    () => {
                        throw new Error('callback failed');
                    },
                    { robust: true }
                );
                tx.onCommit(later);
            })
        ).resolves.toBeUndefined();

        expect(lease.client.commit).toHaveBeenCalledOnce();
        expect(later).toHaveBeenCalledOnce();
    });

    it('rejects retained transaction facades after the frame completes', async () => {
        const { runtime } = createRuntime();
        let retained: AtomicTransaction | undefined;

        await TransactionEngine.forRuntime(runtime).atomic(async (tx) => {
            retained = tx;
        });

        expect(() => retained?.onCommit(() => {})).toThrow(/inactive transaction frame/i);
        await expect(retained?.savepoint(async () => undefined)).rejects.toThrow(/inactive transaction frame/i);
    });

    it('rejects UnitOfWork inside an active atomic block', async () => {
        const { runtime } = createRuntime();

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async () => {
                await UnitOfWork.start(aDBClient());
            })
        ).rejects.toThrow(/UnitOfWork is unsupported/);
    });

    it('exposes the current transaction facade for the matching runtime only while a frame is active', async () => {
        const { runtime } = createRuntime();
        const otherRuntime = createRuntime().runtime;

        await TransactionEngine.forRuntime(runtime)
            .atomic(async (tx) => {
                expect(TransactionEngine.forRuntime(runtime).getActiveTransaction()).toBe(tx);
                expect(TransactionEngine.forRuntime(otherRuntime).getActiveTransaction()).toBeUndefined();

                (tx as unknown as { state: { frames: unknown[] } }).state.frames.length = 0;
                expect(TransactionEngine.forRuntime(runtime).getActiveTransaction()).toBeUndefined();
            })
            .catch(() => undefined);
    });

    it('rejects nested atomic blocks that target a different runtime', async () => {
        const { runtime } = createRuntime();
        const other = createRuntime().runtime;

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async () => {
                await TransactionEngine.forRuntime(other).atomic(async () => undefined);
            })
        ).rejects.toThrow(/another runtime transaction is active/i);
    });

    it('surfaces rollback failures with the application error as cause when outer rollback fails', async () => {
        const { runtime, lease } = createRuntime();
        vi.mocked(lease.client.rollback).mockRejectedValueOnce(new Error('rollback failed'));

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async () => {
                throw new Error('boom');
            })
        ).rejects.toThrow('rollback failed');
    });

    it('surfaces savepoint rollback failures with the nested error as cause', async () => {
        const { runtime, lease } = createRuntime();
        vi.mocked(lease.client.rollbackToSavepoint).mockRejectedValueOnce(new Error('savepoint rollback failed'));

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async () => {
                await TransactionEngine.forRuntime(runtime).atomic(async () => {
                    throw new Error('nested');
                });
            })
        ).rejects.toThrow('savepoint rollback failed');
    });

    it('passes through non-Error rollback failures unchanged', async () => {
        const { runtime, lease } = createRuntime();
        vi.mocked(lease.client.rollbackToSavepoint).mockRejectedValueOnce('savepoint rollback failed');

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async () => {
                await TransactionEngine.forRuntime(runtime).atomic(async () => {
                    throw new Error('nested');
                });
            })
        ).rejects.toBe('savepoint rollback failed');
    });

    it('preserves rollback errors that already carry a cause', async () => {
        const { runtime, lease } = createRuntime();
        const rollbackError = new Error('rollback failed', { cause: new Error('original') });
        vi.mocked(lease.client.rollback).mockRejectedValueOnce(rollbackError);

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async () => {
                throw new Error('boom');
            })
        ).rejects.toBe(rollbackError);
    });

    it('fails defensively if a nested frame loses its parent before merge', async () => {
        const { runtime } = createRuntime();

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async () => {
                await TransactionEngine.forRuntime(runtime).atomic(async (inner) => {
                    (inner as unknown as { state: { frames: unknown[] } }).state.frames.splice(0, 1);
                });
            })
        ).rejects.toThrow(/stack underflow/);
    });

    it('fails defensively if the outer frame stack is cleared before commit merge', async () => {
        const { runtime } = createRuntime();

        await expect(
            TransactionEngine.forRuntime(runtime).atomic(async (tx) => {
                (tx as unknown as { state: { frames: unknown[] } }).state.frames.length = 0;
            })
        ).rejects.toThrow(/stack underflow/);
    });

    it('returns the original rollback error if attaching a cause throws', async () => {
        const { runtime, lease } = createRuntime();
        const OriginalError = globalThis.Error;

        class ThrowingError extends OriginalError {
            constructor(message?: string, options?: ErrorOptions) {
                if (options && 'cause' in options) {
                    throw new OriginalError('cause unsupported');
                }
                super(message);
            }
        }

        const rollbackError = new ThrowingError('rollback failed');
        vi.mocked(lease.client.rollback).mockRejectedValueOnce(rollbackError);
        globalThis.Error = ThrowingError as ErrorConstructor;

        try {
            await expect(
                TransactionEngine.forRuntime(runtime).atomic(async () => {
                    throw new ThrowingError('boom');
                })
            ).rejects.toBe(rollbackError);
        } finally {
            globalThis.Error = OriginalError;
        }
    });
});
