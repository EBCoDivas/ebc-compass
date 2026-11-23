interface Attribute { Name?: string; Value?: string }

export function demoUsername(personaId: string): string
export function demoAccessConfig(env: Record<string, string | undefined>): { enabled: boolean; password?: string }
export function publicDemoEnvironment(config: ReturnType<typeof demoAccessConfig>): {
  VITE_SHOW_JURY_ACCOUNTS: 'true' | 'false'; VITE_JURY_DEMO_PASSWORD: string
}
export function managedDemoPersona(attributes?: readonly Attribute[]): string | undefined
export function obsoleteDemoUsers(users: readonly { Username?: string; Attributes?: readonly Attribute[] }[], personaIds: Iterable<string>): string[]
