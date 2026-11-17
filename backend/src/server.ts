import { readFileSync } from 'node:fs'
import { app } from './app.js'

const port = Number(process.env.PORT ?? 3000)

const { createAuthenticatedLocalApp } = await import('./auth/localAuth.js')
const path = process.env.LOCAL_COGNITO_STATE ?? new URL('../../local/.state/cognito.json', import.meta.url)
const serverApp = await createAuthenticatedLocalApp(app, JSON.parse(readFileSync(path, 'utf8')))
serverApp.listen(port, '127.0.0.1', () => {
  console.log(`EBC Compass backend listening on http://localhost:${port}`)
})
