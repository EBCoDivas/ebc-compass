export async function handler() {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "ok",
      stage: process.env.APP_STAGE ?? "unknown",
    }),
  };
}
