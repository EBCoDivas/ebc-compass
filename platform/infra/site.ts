// Frontend (Vite + React) en S3 + CloudFront. SST compila el frontend con la URL del API y la configuración de Cognito.
import { demoAccessConfig, publicDemoEnvironment } from "../../shared/demoAccounts.mjs";

export function createSite(input: { apiUrl: any; userPoolId: any; webClientId: any }) {
  return new sst.aws.StaticSite("CompassSite", {
    path: "../frontend",
    build: { command: "npm install && npm run build", output: "dist" },
    environment: {
      // Sin "/" final: el frontend concatena `${VITE_API_URL}/api/...`.
      VITE_API_URL: $output(input.apiUrl).apply((url: string) => url.replace(/\/+$/, "")),
      VITE_COGNITO_USER_POOL_ID: input.userPoolId,
      VITE_COGNITO_CLIENT_ID: input.webClientId,
      ...publicDemoEnvironment(demoAccessConfig(process.env)),
    },
  });
}
