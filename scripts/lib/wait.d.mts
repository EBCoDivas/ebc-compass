export function httpGet(url: string, options?: { ca?: Buffer; timeout?: number }): Promise<{ status: number; body: string }>
export function emulatorHealthy(port?: number): Promise<boolean>
export function waitFor(check: () => Promise<boolean> | boolean, timeoutMs: number, intervalMs?: number): Promise<boolean>
export function waitForEmulator(timeoutMs?: number): Promise<boolean>
export function waitForUrl(url: string, timeoutMs?: number): Promise<boolean>
