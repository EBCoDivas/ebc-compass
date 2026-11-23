export function demoUsername(personaId) {
  return personaId + '@demo.ebc.invalid'
}

export function demoAccessConfig(env) {
  const enabled = env.JURY_DEMO_ENABLED === 'true'
  const password = env.JURY_DEMO_PASSWORD || undefined
  if (enabled && !password) throw new Error('Define JURY_DEMO_PASSWORD para habilitar el acceso del jurado.')
  if (password && (password.length < 8 || password.length > 128 || /\s/.test(password) ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password))) {
    throw new Error('JURY_DEMO_PASSWORD debe tener entre 8 y 128 caracteres, mayúsculas, minúsculas, un número y un símbolo, sin espacios.')
  }
  return { enabled, password }
}

export function publicDemoEnvironment({ enabled, password }) {
  return {
    VITE_SHOW_JURY_ACCOUNTS: enabled && password ? 'true' : 'false',
    VITE_JURY_DEMO_PASSWORD: enabled ? password ?? '' : '',
  }
}

export function managedDemoPersona(attributes = []) {
  const id = attributes.find(item => item.Name === 'custom:personaId')?.Value
  const email = attributes.find(item => item.Name === 'email')?.Value
  return id && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && email === demoUsername(id) ? id : undefined
}

export function obsoleteDemoUsers(users, personaIds) {
  const desired = new Set(personaIds)
  return users.flatMap(user => {
    const id = managedDemoPersona(user.Attributes)
    return id && user.Username && !desired.has(id) ? [user.Username] : []
  })
}
