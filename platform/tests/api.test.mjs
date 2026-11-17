import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise our SST declarations offline; AWS deployment is covered by lab:smoke.
function declareApi() {
  const routes = [];
  const transforms = [];
  let deployedRoutes;
  class Api {
    route(path, handler, options = {}) { routes.push({ path, handler, options }); }
    addAuthorizer() { return { id: "cognito-authorizer" }; }
    deploy() { deployedRoutes = routes.slice(); }
  }
  const context = vm.createContext({
    exports: {},
    sst: { aws: { ApiGatewayV1: Api, Function: class { constructor(name) { this.arn = name; } } } },
    aws: { apigateway: { IntegrationResponse: class {} } },
    $transform: (_resource, callback) => transforms.push(callback),
    $output: (value) => ({ apply: (callback) => callback(value) }),
    $interpolate: (strings, ...values) => strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  });
  const source = readFileSync(new URL("../infra/api.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  vm.runInContext(outputText, context);
  context.exports.createApi("test", { userPool: { arn: "pool" }, webClient: { id: "client" } },
    { arn: "buffered" }, { arn: "streaming" });
  return { routes, transforms, deployedRoutes };
}

test("SST deploy includes the authenticated native streaming route and buffered routes", () => {
  const { routes, deployedRoutes } = declareApi();
  const stream = routes.find(({ path }) => path === "POST /api/assistant/messages/stream");
  assert.equal(stream.handler, "streaming");
  assert.equal(stream.options.streaming, true);
  assert.equal(stream.options.auth.cognito.authorizer, "cognito-authorizer");
  assert.ok(deployedRoutes.includes(stream));
  assert.equal(routes.find(({ path }) => path === "ANY /api/assistant/messages").handler, "buffered");
  assert.equal(routes.find(({ path }) => path === "GET /health").options.auth, undefined);
});

test("CORS allows authenticated JSON requests without changing another API's preflight", () => {
  const { transforms } = declareApi();
  const parameters = {
    "method.response.header.Access-Control-Allow-Headers": "'*'",
    "method.response.header.Access-Control-Allow-Origin": "'https://demo.example'",
  };
  const own = { responseParameters: { ...parameters } };
  const other = { responseParameters: { ...parameters } };
  for (const transform of transforms) {
    transform(own, {}, "CompassApiCorsIntegrationResponse123");
    transform(other, {}, "AnotherApiCorsIntegrationResponse123");
  }
  assert.equal(own.responseParameters["method.response.header.Access-Control-Allow-Headers"], "'authorization,content-type'");
  assert.equal(own.responseParameters["method.response.header.Access-Control-Allow-Origin"], "'https://demo.example'");
  assert.deepEqual(other.responseParameters, parameters);
});
