export const root: string
export const EMULATOR_PORT: number
export function loadEnvFile(path: string): Record<string, string>
export function emulatorFiles(port?: number): { dir: string; credentials: string; config: string; ca: string }
export function emulatorReady(port?: number): boolean
export function emulatorEnv(port?: number): Record<string, string>
export function cleanBaseEnv(): NodeJS.ProcessEnv
