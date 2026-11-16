export function createAuth() {
  const userPool = new sst.aws.CognitoUserPool("CompassUserPool", {
    usernames: ["email"],
  });

  const webClient = userPool.addClient("WebClient", {
    transform: {
      client: (args) => {
        // SRP: inicio de sesión del frontend (amazon-cognito-identity-js). ADMIN_USER_PASSWORD: lo usa `npm run lab:smoke`
        // para obtener un token de prueba; solo funciona con credenciales de administrador de AWS, nunca desde el navegador.
        args.explicitAuthFlows = [
          "ALLOW_USER_SRP_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
          "ALLOW_ADMIN_USER_PASSWORD_AUTH",
        ];
      },
    },
  });

  return { userPool, webClient };
}
