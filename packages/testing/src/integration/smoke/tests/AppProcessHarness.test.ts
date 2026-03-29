// oxlint-disable unicorn/prefer-event-target,eslint-js/no-restricted-syntax
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppProcessHarness } from '../AppProcessHarness';

const activeHarnesses: AppProcessHarness[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
    while (activeHarnesses.length > 0) {
        const harness = activeHarnesses.pop();
        if (harness) {
            await harness.stop();
        }
    }

    while (tempDirs.length > 0) {
        const directory = tempDirs.pop();
        if (directory) {
            await rm(directory, { recursive: true, force: true });
        }
    }
});

async function getFreePort(): Promise<number> {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
    return port;
}

describe(AppProcessHarness, () => {
    it('exposes a stable public identifier', () => {
        expect(AppProcessHarness.BRAND).toBe('tango.testing.app_process_harness');
    });

    it('starts a process, waits for readiness, and performs requests', async () => {
        const port = await getFreePort();
        const harness = await AppProcessHarness.start({
            command: 'node',
            args: [
                '-e',
                "const http=require('http');const port=Number(process.env.PORT);http.createServer((req,res)=>{if(req.url==='/health'){res.statusCode=200;res.end('ok');return;}if(req.url==='/ping'){res.statusCode=200;res.end('pong');return;}res.statusCode=404;res.end('nope');}).listen(port,'127.0.0.1');setInterval(()=>{},1000);",
            ],
            env: { PORT: String(port) },
            baseUrl: `http://127.0.0.1:${String(port)}`,
            readyPath: '/health',
            readyTimeoutMs: 10_000,
            readyIntervalMs: 100,
        });
        activeHarnesses.push(harness);

        expect(AppProcessHarness.isAppProcessHarness(harness)).toBe(true);
        expect(AppProcessHarness.isAppProcessHarness({})).toBe(false);

        const response = await harness.request('/ping');
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('pong');
        await harness.assertResponseStatus(new Response(null, { status: 200 }), 200, 'status match');
        await expect(
            harness.assertResponseStatus(
                new Response(JSON.stringify({ error: 'bad request' }), { status: 400 }),
                201,
                'status mismatch'
            )
        ).rejects.toThrow('status mismatch. expected 201 got 400');
        const unreadableBodyResponse = {
            status: 500,
            text: async () => {
                throw new Error('stream ended');
            },
        } as unknown as Response;
        await expect(harness.assertResponseStatus(unreadableBodyResponse, 200, 'body read failure')).rejects.toThrow(
            'failed to read response body: Error: stream ended'
        );
        expect(harness.getStdoutLog()).toBe('');
        expect(harness.getStderrLog()).toBe('');
        expect(harness.getCombinedLog()).toBe('');
    });

    it('starts executable commands without explicit args', async () => {
        const port = await getFreePort();
        const tempDir = await mkdtemp(join(tmpdir(), 'tango-app-process-harness-'));
        tempDirs.push(tempDir);
        const scriptPath = join(tempDir, 'server.cjs');
        await writeFile(
            scriptPath,
            [
                '#!/usr/bin/env node',
                "const http=require('http');",
                'const port=Number(process.env.PORT);',
                "http.createServer((req,res)=>{if(req.url==='/health'){res.statusCode=200;res.end('ok');return;}res.statusCode=200;res.end('alive');}).listen(port,'127.0.0.1');",
                'setInterval(()=>{},1000);',
            ].join('\n'),
            'utf8'
        );
        await chmod(scriptPath, 0o755);

        const harness = await AppProcessHarness.start({
            command: scriptPath,
            env: { PORT: String(port) },
            baseUrl: `http://127.0.0.1:${String(port)}`,
        });
        activeHarnesses.push(harness);

        const response = await harness.request('/health');
        expect(response.status).toBe(200);
    });

    it('throws when readiness check times out', async () => {
        const port = await getFreePort();
        await expect(
            AppProcessHarness.start({
                command: 'node',
                args: ['-e', 'setInterval(()=>{},1000);'],
                baseUrl: `http://127.0.0.1:${String(port)}`,
                readyPath: '/health',
                readyTimeoutMs: 300,
                readyIntervalMs: 50,
            })
        ).rejects.toThrow('Timed out waiting for readiness');
    });

    it('captures process output and includes it in startup errors', async () => {
        class FakeStream extends EventEmitter {
            constructor(private readonly initial: string) {
                super();
            }

            override on(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
                super.on(eventName, listener);
                if (eventName === 'data' && this.initial) {
                    listener(this.initial);
                }
                return this;
            }
        }

        class FakeChild extends EventEmitter {
            exitCode: number | null = null;
            killed = false;
            stdout = new FakeStream('booting\n');
            stderr = new FakeStream('port already in use\n');
            kill(): boolean {
                this.killed = true;
                this.exitCode = 0;
                this.emit('exit');
                return true;
            }
        }

        const fakeChild = new FakeChild();

        await expect(
            AppProcessHarness.start(
                {
                    command: 'fake',
                    baseUrl: 'http://127.0.0.1:5444',
                    readyTimeoutMs: 5,
                    readyIntervalMs: 1,
                    stopTimeoutMs: 10,
                },
                {
                    spawnProcess: () => fakeChild,
                    fetchImpl: async () => {
                        throw new Error('not ready');
                    },
                    sleep: async () => {},
                }
            )
        ).rejects.toThrow('[stderr]');
    });

    it('can be stopped more than once and still send absolute-url requests', async () => {
        const port = await getFreePort();
        const harness = await AppProcessHarness.start({
            command: 'node',
            args: [
                '-e',
                "const http=require('http');const port=Number(process.env.PORT);http.createServer((req,res)=>{if(req.url==='/health'){res.statusCode=200;res.end('ok');return;}res.statusCode=200;res.end('alive');}).listen(port,'127.0.0.1');setInterval(()=>{},1000);",
            ],
            env: { PORT: String(port) },
            baseUrl: `http://127.0.0.1:${String(port)}`,
            readyPath: 'health',
            readyTimeoutMs: 10_000,
            readyIntervalMs: 100,
        });

        const absolute = await harness.request(`http://127.0.0.1:${String(port)}/health`);
        expect(absolute.status).toBe(200);

        await harness.stop();
        await harness.stop();
    });

    it('finishes stopping when the child exits after SIGTERM', async () => {
        class FakeChild extends EventEmitter {
            exitCode: number | null = null;
            killed = false;
            stdout = undefined;
            stderr = undefined;
            kill(signal?: NodeJS.Signals): boolean {
                if (signal === 'SIGTERM') {
                    this.exitCode = 0;
                    this.emit('exit');
                }
                this.killed = true;
                return true;
            }
        }

        const fakeChild = new FakeChild();
        const urls: string[] = [];
        const harness = await AppProcessHarness.start(
            {
                command: 'fake',
                baseUrl: 'http://127.0.0.1:3999',
                readyPath: '/health',
                stopTimeoutMs: 50,
            },
            {
                spawnProcess: () => fakeChild,
                fetchImpl: async (input: string | URL | Request): Promise<Response> => {
                    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
                    urls.push(raw);
                    return new Response('ok', { status: 200 });
                },
                sleep: async () => {},
            }
        );

        await harness.request('');
        expect(urls[1]).toBe('http://127.0.0.1:3999/');

        await harness.stop();
    });

    it('sends SIGKILL when process does not exit after SIGTERM', async () => {
        class FakeChild extends EventEmitter {
            exitCode: number | null = null;
            killed = false;
            stdout = undefined;
            stderr = undefined;
            readonly signals: string[] = [];
            kill(signal?: NodeJS.Signals): boolean {
                this.signals.push(String(signal));
                if (signal === 'SIGKILL') {
                    this.killed = true;
                }
                return true;
            }
        }

        const fakeChild = new FakeChild();
        const harness = await AppProcessHarness.start(
            {
                command: 'fake',
                baseUrl: 'http://127.0.0.1:4999',
                readyPath: '/health',
                stopTimeoutMs: 5,
            },
            {
                spawnProcess: () => fakeChild,
                fetchImpl: async () => new Response('ok', { status: 200 }),
                sleep: async () => {},
            }
        );

        await harness.stop();
        expect(fakeChild.signals).toContain('SIGTERM');
        expect(fakeChild.signals).toContain('SIGKILL');
    });

    it('returns early from stop when child is already killed', async () => {
        class FakeChild extends EventEmitter {
            exitCode: number | null = null;
            killed = true;
            stdout = undefined;
            stderr = undefined;
            readonly signals: string[] = [];
            kill(signal?: NodeJS.Signals): boolean {
                this.signals.push(String(signal));
                return true;
            }
        }

        const fakeChild = new FakeChild();
        const harness = await AppProcessHarness.start(
            {
                command: 'fake',
                baseUrl: 'http://127.0.0.1:5111',
            },
            {
                spawnProcess: () => fakeChild,
                fetchImpl: async () => new Response('ok', { status: 200 }),
                sleep: async () => {},
            }
        );

        await harness.stop();
        expect(fakeChild.signals).toHaveLength(0);
    });

    it('fails readiness immediately when child exits before ready', async () => {
        class FakeChild extends EventEmitter {
            exitCode: number | null = 1;
            killed = false;
            stdout = undefined;
            stderr = undefined;
            kill(): boolean {
                this.killed = true;
                this.exitCode = 0;
                this.emit('exit');
                return true;
            }
        }
        const fakeChild = new FakeChild();

        await expect(
            AppProcessHarness.start(
                {
                    command: 'fake',
                    baseUrl: 'http://127.0.0.1:5222',
                    readyTimeoutMs: 1_000,
                },
                {
                    spawnProcess: () => fakeChild,
                    fetchImpl: async () => new Response('ok', { status: 200 }),
                    sleep: async () => {},
                }
            )
        ).rejects.toThrow('Process exited before ready check succeeded');
    });

    it('retries readiness when endpoint responds non-2xx before becoming ready', async () => {
        class FakeChild extends EventEmitter {
            exitCode: number | null = null;
            killed = false;
            stdout = undefined;
            stderr = undefined;
            kill(): boolean {
                this.killed = true;
                return true;
            }
        }
        const fakeChild = new FakeChild();
        let attempts = 0;

        const harness = await AppProcessHarness.start(
            {
                command: 'fake',
                baseUrl: 'http://127.0.0.1:5333',
                readyTimeoutMs: 1_000,
                readyIntervalMs: 1,
                stopTimeoutMs: 10,
            },
            {
                spawnProcess: () => fakeChild,
                fetchImpl: async () => {
                    attempts += 1;
                    return attempts === 1 ? new Response('nope', { status: 503 }) : new Response('ok', { status: 200 });
                },
                sleep: async () => {},
            }
        );

        expect(attempts).toBe(2);
        await harness.stop();
    });

    it('truncates buffered process logs to cap memory usage', async () => {
        class FakeStream extends EventEmitter {
            constructor(private readonly initial: string) {
                super();
            }

            override on(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
                super.on(eventName, listener);
                if (eventName === 'data') {
                    listener(this.initial);
                }
                return this;
            }
        }

        class FakeChild extends EventEmitter {
            exitCode: number | null = null;
            killed = false;
            stdout = new FakeStream('x'.repeat(50_000));
            stderr = new FakeStream('y'.repeat(50_000));
            kill(): boolean {
                this.killed = true;
                this.exitCode = 0;
                this.emit('exit');
                return true;
            }
        }

        const fakeChild = new FakeChild();
        const harness = await AppProcessHarness.start(
            {
                command: 'fake',
                baseUrl: 'http://127.0.0.1:5555',
            },
            {
                spawnProcess: () => fakeChild,
                fetchImpl: async () => new Response('ok', { status: 200 }),
                sleep: async () => {},
            }
        );

        expect(harness.getStdoutLog().length).toBeLessThanOrEqual(20_000);
        expect(harness.getStderrLog().length).toBeLessThanOrEqual(20_000);
        await harness.stop();
    });
});
