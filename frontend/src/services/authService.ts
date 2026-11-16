const TOKEN_KEY = 'ebc_compass_id_token'
export const authConfigured = Boolean(import.meta.env.VITE_COGNITO_USER_POOL_ID && import.meta.env.VITE_COGNITO_CLIENT_ID)

export async function signIn(username: string, password: string): Promise<string> {
  if (!authConfigured) return Promise.reject(new Error('Cognito no está configurado para este entorno.'))
  const { AuthenticationDetails, CognitoUser, CognitoUserPool } = await import('amazon-cognito-identity-js')
  const pool = new CognitoUserPool({ UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '', ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '' })
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: username, Pool: pool })
    user.authenticateUser(new AuthenticationDetails({ Username: username, Password: password }), {
      onSuccess: (session) => { const token = session.getIdToken().getJwtToken(); sessionStorage.setItem(TOKEN_KEY, token); resolve(token) },
      onFailure: reject,
    })
  })
}

export function getToken(): string | null { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY) }
export function signOut(): void { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(TOKEN_KEY) }
