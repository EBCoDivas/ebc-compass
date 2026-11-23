// Cuentas ficticias en el emulador. Nunca imprime contraseñas ni tokens.
import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { CognitoIdentityProviderClient, ListUserPoolsCommand, CreateUserPoolCommand, ListUserPoolClientsCommand, CreateUserPoolClientCommand, UpdateUserPoolClientCommand, AdminGetUserCommand, AdminDeleteUserCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'

const stateFile = new URL('../.state/cognito.json', import.meta.url)
const endpoint = process.env.AWS_ENDPOINT_URL ?? ''
if (!/^https:\/\/127\.0\.0\.1:9297\/?$/.test(endpoint)) throw new Error('Aprovisionamiento reservado al emulador local.')
const client = new CognitoIdentityProviderClient({})
const personas = JSON.parse(readFileSync(new URL('../../shared/personas.json', import.meta.url), 'utf8')) as {
  id: string; name: string; hasProfile: boolean; enrollment: string; campus: string; campusName: string;
  career: string; program: string; period: number; periodType: string
}[]
type State = { poolId: string; clientId: string; issuer: string; jwksUrl: string; users: Record<string, { username: string; password: string; sub?: string; passwordReady?: boolean }> }
const state: State = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { poolId: '', clientId: '', issuer: '', jwksUrl: '', users: {} }
const save = () => { mkdirSync(new URL('../.state/', import.meta.url), { recursive: true }); writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 }); chmodSync(stateFile, 0o600) }
export async function provisionAuth(check: boolean) {
  const pools = await client.send(new ListUserPoolsCommand({ MaxResults: 60 }))
  const existing = pools.UserPools?.find(pool => pool.Name === 'ebc-compass-demo')
  if (!existing && check) throw new Error('Falta el pool Cognito local.')
  state.poolId = existing?.Id ?? (await client.send(new CreateUserPoolCommand({
    PoolName: 'ebc-compass-demo',
    Schema: ['personaId', 'matricula', 'campus', 'campusCode', 'programa', 'career', 'semestre', 'periodo'].map(Name => ({ Name, AttributeDataType: 'String', Mutable: true })),
  }))).UserPool!.Id!
  const clients = await client.send(new ListUserPoolClientsCommand({ UserPoolId: state.poolId, MaxResults: 60 }))
  const web = clients.UserPoolClients?.find(item => item.ClientName === 'compass-web')
  if (!web && check) throw new Error('Falta el cliente Cognito local.')
  state.clientId = web?.ClientId ?? (await client.send(new CreateUserPoolClientCommand({
    UserPoolId: state.poolId, ClientName: 'compass-web', GenerateSecret: false,
    ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'], WriteAttributes: ['email'],
  }))).UserPoolClient!.ClientId!
  if (!check && web) await client.send(new UpdateUserPoolClientCommand({
    UserPoolId: state.poolId, ClientId: state.clientId,
    ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'], WriteAttributes: ['email'],
  }))
  for (const persona of personas) {
    const known = state.users[persona.id]
    const account = known ?? { username: persona.id + '@demo.ebc.invalid', password: randomBytes(24).toString('base64url') + 'Aa1!' }
    if (!known && check) throw new Error('Falta el registro local de la cuenta ' + persona.id)
    state.users[persona.id] = account
    if (!check) save()
    let found = false
    try {
      const user = await client.send(new AdminGetUserCommand({ UserPoolId: state.poolId, Username: account.username }))
      account.sub = user.UserAttributes?.find(attr => attr.Name === 'sub')?.Value
      found = true
    } catch (error) { if ((error as Error).name !== 'UserNotFoundException') throw error }
    if (!found && check) throw new Error('Falta la cuenta ' + persona.id)
    if (!found) {
      const fields: Record<string, string> = { email: account.username, email_verified: 'true', 'custom:personaId': persona.id }
      if (persona.hasProfile) Object.assign(fields, { name: persona.name, 'custom:matricula': persona.enrollment,
        'custom:campus': persona.campusName, 'custom:campusCode': persona.campus, 'custom:programa': persona.program,
        'custom:career': persona.career, 'custom:semestre': String(persona.period), 'custom:periodo': persona.periodType })
      const user = await client.send(new AdminCreateUserCommand({ UserPoolId: state.poolId, Username: account.username,
        MessageAction: 'SUPPRESS', UserAttributes: Object.entries(fields).map(([Name, Value]) => ({ Name, Value })) }))
      account.sub = user.User?.Attributes?.find(attr => attr.Name === 'sub')?.Value
    }
    if (!check && (!found || !account.passwordReady)) {
      await client.send(new AdminSetUserPasswordCommand({ UserPoolId: state.poolId, Username: account.username, Password: account.password, Permanent: true }))
      account.passwordReady = true
      save()
    }
  }
  // Cuentas que ya no están en shared/personas.json: se quitan del emulador y del registro local.
  const current = new Set(personas.map(persona => persona.id))
  for (const [id, account] of Object.entries(state.users)) {
    if (current.has(id)) continue
    if (check) throw new Error('Sobra la cuenta ' + id + '. Ejecuta: npm run provision')
    await client.send(new AdminDeleteUserCommand({ UserPoolId: state.poolId, Username: account.username })).catch(error => { if ((error as Error).name !== 'UserNotFoundException') throw error })
    delete state.users[id]
    save()
  }
  if (!check) {
    const account = state.users[personas[0].id]
    const auth = await client.send(new InitiateAuthCommand({ ClientId: state.clientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: account.username, PASSWORD: account.password } }))
    const token = auth.AuthenticationResult?.IdToken
    if (!token) throw new Error('Cognito no entregó un ID token.')
    state.issuer = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).iss
    const candidates = [endpoint + '/' + state.poolId + '/.well-known/jwks.json', endpoint + '/cognito-idp/' + state.poolId + '/.well-known/jwks.json']
    state.jwksUrl = ''
    for (const url of candidates) {
      const response = await fetch(url)
      if (response.ok && Array.isArray((await response.json() as { keys?: unknown[] }).keys)) { state.jwksUrl = url; break }
    }
    if (!state.jwksUrl) throw new Error('No se encontró el JWKS del emulador.')
    save()
  }
  console.log(`✔ Cognito: ${personas.length} cuentas verificadas. Registro local privado: local/.state/cognito.json`)
}
