import { storeToken } from './session'
export { getToken, signOut } from './session'

export const localAuth = import.meta.env.VITE_LOCAL_AUTH === 'true' && !import.meta.env.VITE_COGNITO_USER_POOL_ID
export const authConfigured = localAuth || Boolean(import.meta.env.VITE_COGNITO_USER_POOL_ID && import.meta.env.VITE_COGNITO_CLIENT_ID)
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function signIn(username: string, password: string): Promise<string> {
  if (!authConfigured) throw new Error('Cognito no está configurado para este entorno.')
  if (localAuth) {
    const response = await fetch(API_URL + '/api/dev/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }) })
    if (!response.ok) throw new Error('Correo o contraseña incorrectos.')
    const { idToken } = await response.json() as { idToken: string }
    storeToken(idToken)
    return idToken
  }
  const { AuthenticationDetails, CognitoUser, CognitoUserPool } = await import('amazon-cognito-identity-js')
  const pool = new CognitoUserPool({ UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '', ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '', Storage: sessionStorage })
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: username, Pool: pool })
    user.authenticateUser(new AuthenticationDetails({ Username: username, Password: password }), {
      onSuccess: session => {
        try { const token = session.getIdToken().getJwtToken(); storeToken(token); resolve(token) } catch (error) { reject(error) }
      },
      onFailure: reject,
    })
  })
}
