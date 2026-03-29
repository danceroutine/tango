import { spawn } from 'node:child_process';

export interface AppProcessHarnessOptions {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string | undefined>;
    baseUrl: string;
    readyPath?: string;
    readyTimeoutMs?: number;
    readyIntervalMs?: number;
    stopTimeoutMs?: number;
}

type FetchLike = typeof fetch;
type ProcessHarnessOutputStream = {
    on(eventName: 'data', listener: (chunk: unknown) => void): unknown;
};
type ProcessHarnessChild = {
    exitCode: number | null;
    killed: boolean;
    kill(signal?: NodeJS.Signals): boolean;
    off(eventName: 'exit', listener: () => void): unknown;
    once(eventName: 'exit', listener: () => void): unknown;
    stdout?: ProcessHarnessOutputStream | null;
    stderr?: ProcessHarnessOutputStream | null;
};

interface AppProcessHarnessDeps {
    spawnProcess: (
        command: string,
        args?: readonly string[],
        options?: Parameters<typeof spawn>[2]
    ) => ProcessHarnessChild;
    fetchImpl: FetchLike;
    sleep: (ms: number) => Promise<void>;
}

const DEFAULT_READY_TIMEOUT_MS = 30_000;
const DEFAULT_READY_INTERVAL_MS = 250;
const DEFAULT_STOP_TIMEOUT_MS = 10_000;
const MAX_LOG_BUFFER_CHARS = 20_000;

const defaultDeps: AppProcessHarnessDeps = {
    spawnProcess: (command, args, options) => spawn(command, args as string[], options as Parameters<typeof spawn>[2]),
    fetchImpl: fetch,
    sleep: (ms: number) =>
        new Promise((resolve) => {
            setTimeout(resolve, ms);
        }),
};

/**
 * Lightweight process harness for end-to-end smoke tests that need a real app process.
 */
export class AppProcessHarness {
    static readonly BRAND = 'tango.testing.app_process_harness' as const;
    readonly __tangoBrand: typeof AppProcessHarness.BRAND = AppProcessHarness.BRAND;
    private readonly child: ProcessHarnessChild;
    private readonly baseUrl: string;
    private readonly readyUrl: string;
    private readonly readyTimeoutMs: number;
    private readonly readyIntervalMs: number;
    private readonly stopTimeoutMs: number;
    private readonly deps: AppProcessHarnessDeps;
    private stopped = false;
    private stdoutBuffer = '';
    private stderrBuffer = '';

    private constructor(options: AppProcessHarnessOptions, deps: AppProcessHarnessDeps) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.readyUrl = `${this.baseUrl}${normalizePath(options.readyPath ?? '/health')}`;
        this.readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
        this.readyIntervalMs = options.readyIntervalMs ?? DEFAULT_READY_INTERVAL_MS;
        this.stopTimeoutMs = options.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS;
        this.deps = deps;

        this.child = this.deps.spawnProcess(options.command, options.args ?? [], {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            stdio: 'pipe',
        });
        this.child.stdout?.on('data', (chunk: unknown) => {
            this.stdoutBuffer = appendBuffer(this.stdoutBuffer, String(chunk));
        });
        this.child.stderr?.on('data', (chunk: unknown) => {
            this.stderrBuffer = appendBuffer(this.stderrBuffer, String(chunk));
        });
    }

    /**
     * Narrow an unknown value to the smoke-test harness that owns a child process.
     */
    static isAppProcessHarness(value: unknown): value is AppProcessHarness {
        return (
            typeof value === 'object' &&
            value !== null &&
            (value as { __tangoBrand?: unknown }).__tangoBrand === AppProcessHarness.BRAND
        );
    }

    /**
     * Spawn the target process and wait until its readiness endpoint responds successfully.
     */
    static async start(
        options: AppProcessHarnessOptions,
        deps: Partial<AppProcessHarnessDeps> = {}
    ): Promise<AppProcessHarness> {
        const mergedDeps: AppProcessHarnessDeps = {
            ...defaultDeps,
            ...deps,
        };
        const harness = new AppProcessHarness(options, mergedDeps);
        await harness.waitForReady();
        return harness;
    }

    /**
     * Return the buffered stdout log for recent process output.
     */
    getStdoutLog(): string {
        return this.stdoutBuffer;
    }

    /**
     * Return the buffered stderr log for recent process output.
     */
    getStderrLog(): string {
        return this.stderrBuffer;
    }

    /**
     * Return stdout and stderr in a single formatted string for debugging failures.
     */
    getCombinedLog(): string {
        const stdout = this.stdoutBuffer.trim();
        const stderr = this.stderrBuffer.trim();
        if (!stdout && !stderr) {
            return '';
        }
        return [`[stdout]\n${stdout}`, `[stderr]\n${stderr}`].join('\n\n').trim();
    }

    /**
     * Issue an HTTP request against the managed application process.
     */
    async request(path: string, init?: RequestInit): Promise<Response> {
        const target = path.startsWith('http') ? path : `${this.baseUrl}${normalizePath(path)}`;
        return this.deps.fetchImpl(target, init);
    }

    /**
     * Assert an HTTP response status and include process logs when it mismatches.
     */
    async assertResponseStatus(response: Response, expectedStatus: number, label: string): Promise<void> {
        if (response.status === expectedStatus) {
            return;
        }

        let bodyText: string;
        try {
            bodyText = await response.text();
        } catch (error) {
            bodyText = `failed to read response body: ${String(error)}`;
        }

        throw new Error(
            [
                `${label}. expected ${String(expectedStatus)} got ${String(response.status)}`,
                `response body: ${bodyText}`,
                `process logs:\n${this.getCombinedLog()}`,
            ].join('\n')
        );
    }

    /**
     * Stop the managed process, escalating from SIGTERM to SIGKILL when necessary.
     */
    async stop(): Promise<void> {
        if (this.stopped) {
            return;
        }
        this.stopped = true;

        if (this.child.exitCode !== null || this.child.killed) {
            return;
        }

        this.child.kill('SIGTERM');
        const exited = await this.waitForExit(this.stopTimeoutMs);
        if (!exited && !this.child.killed) {
            this.child.kill('SIGKILL');
            await this.waitForExit(this.stopTimeoutMs);
        }
    }

    private async waitForReady(): Promise<void> {
        const deadline = Date.now() + this.readyTimeoutMs;

        while (Date.now() < deadline) {
            if (this.child.exitCode !== null) {
                throw new Error(
                    `Process exited before ready check succeeded (exitCode=${String(this.child.exitCode)}).\n${this.getCombinedLog()}`
                );
            }
            try {
                const response = await this.deps.fetchImpl(this.readyUrl);
                if (response.ok) {
                    return;
                }
            } catch {
                // Retry until timeout.
            }
            await this.deps.sleep(this.readyIntervalMs);
        }

        await this.stop();
        throw new Error(`Timed out waiting for readiness at ${this.readyUrl}.\n${this.getCombinedLog()}`);
    }

    private async waitForExit(timeoutMs: number): Promise<boolean> {
        if (this.child.exitCode !== null) {
            return true;
        }

        return await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => {
                this.child.off('exit', onExit);
                resolve(false);
            }, timeoutMs);

            const onExit = () => {
                clearTimeout(timer);
                resolve(true);
            };

            this.child.once('exit', onExit);
        });
    }
}

function appendBuffer(current: string, chunk: string): string {
    const next = current + chunk;
    if (next.length <= MAX_LOG_BUFFER_CHARS) {
        return next;
    }
    return next.slice(next.length - MAX_LOG_BUFFER_CHARS);
}

function normalizePath(path: string): string {
    if (!path) {
        return '/';
    }
    return path.startsWith('/') ? path : `/${path}`;
}
