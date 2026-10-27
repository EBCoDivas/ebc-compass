export function createAuth() {
  const userPool = new sst.aws.CognitoUserPool("CompassUserPool", {
    usernames: ["email"],
  });

  const webClient = userPool.addClient("WebClient");

  return { userPool, webClient };
}
