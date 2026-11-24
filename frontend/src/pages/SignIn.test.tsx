import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it('keeps the manual login and only lists jury accounts in the story order when enabled', async () => {
  vi.stubEnv('VITE_LOCAL_AUTH', 'true')
  vi.stubEnv('VITE_COGNITO_USER_POOL_ID', '')
  vi.stubEnv('VITE_JURY_DEMO_PASSWORD', ['Example', 'Aa', '1', '!'].join(''))
  vi.stubEnv('VITE_SHOW_JURY_ACCOUNTS', 'false')
  const { SignIn: RegularSignIn } = await import('./SignIn')
  const regularHtml = renderToStaticMarkup(<RegularSignIn />)
  expect(regularHtml).toContain('Iniciar sesión')
  expect(regularHtml).not.toContain('Cuentas de demostración')

  vi.resetModules()
  vi.stubEnv('VITE_SHOW_JURY_ACCOUNTS', 'true')
  const { SignIn } = await import('./SignIn')
  const { hasJuryAccess } = await import('../services/juryAccounts')
  const html = renderToStaticMarkup(<SignIn />)
  const accountLabels = [...html.matchAll(/aria-label="Usar cuenta de ([^"]+)"/g)].map(match => match[1])
  expect(accountLabels).toEqual([
    'Ana Lucía Torres, Contaduría · 1.º semestre · Querétaro',
    'Ana Lucía Torres, Contaduría · 7.º semestre · Querétaro',
    'Diego Ramírez, Mercadotecnia · 5.º semestre · Guadalajara',
    'Sofía Herrera, Derecho · 9.º semestre · Toluca',
    'Administración demo, Traza y observabilidad de Compass',
  ])
  expect(html).toContain('Cuentas de demostración')
  expect(hasJuryAccess('ana-ingreso')).toBe(true)
  expect(hasJuryAccess('admin')).toBe(true)
  expect(hasJuryAccess('sin-perfil')).toBe(false)
})
