# Hallazgos del spike: AWS Emulator (Fase 0)

- **Fecha:** 2026-11-16
- **Emulador probado:** versión `1.0.471` (commit `91eb64ca`), construido con [local/emulator/Dockerfile](../local/emulator/Dockerfile) en Mac Apple silicon (paquete `aarch64`, imagen base `amazonlinux:2023-minimal`)
- **Región:** `us-east-1` · **Cuenta del emulador:** `000000000000`
- **Cómo se obtuvo:** [local/scripts/spike-emulator.sh](../local/scripts/spike-emulator.sh) (AWS CLI 2.31.32) y un script de Node con el SDK v3 de AWS y LangGraph.js. Fuente de la guía: documentación oficial de AWS Emulator (páginas *What is*, *Getting started with Docker*, *Pointing your SDK*, *Fidelity*).

## 1. Resultado: la Fase 0 sale bien

La matriz completa pasó (34 pruebas OK, 0 fallas). **El emulador sirve para todo lo que necesita el MVP, excepto un LLM**, que es justo lo que cubre el puente.

| Servicio | Resultado | Detalle |
|---|---|---|
| STS | ✅ | `get-caller-identity` devuelve la cuenta `000000000000` (confirma que estamos en el emulador) |
| **DynamoDB** | ✅ | Tabla con `PK`/`SK`, TTL (`ttl`), `PutItem`, escritura condicional (`attribute_not_exists`), `BatchWriteItem`, `Query` con `begins_with` y orden descendente (devuelve el último checkpoint), `DeleteItem`, `DeleteTable`. **Todo lo que necesita el `DynamoDBSaver`** |
| S3 | ✅ | Bucket, `PutObject`, `GetObject` (sirve para `kb:sync-s3`) |
| **Bedrock Runtime** | ⚠️ parcial | `Converse` responde con **texto fijo**: *"No language model runs in this emulator…"*. Valida el ID del modelo (rechaza uno inventado; acepta IDs reales como `amazon.nova-lite-v1:0`). `list-foundation-models` devuelve 121 modelos. **No hay LLM → se usa el puente (D3)** |
| **Bedrock Agent** + **Agent Runtime** | ⚠️ parcial | Se puede crear una Knowledge Base y `Retrieve` responde con la forma correcta (`retrievalResults`), pero **vacío** (no hay ingesta ni búsqueda real). **Se usa el puente para `Retrieve` (D5)** |
| Lambda | ✅ | `create-function` (`nodejs22.x`) y `invoke` **ejecutan código real** y devuelven la salida del handler (hay que esperar a `function-active`) |
| API Gateway v2 | ✅ (solo control) | `create-api` HTTP funciona; **no se probó** el enrutamiento de peticiones HTTP hacia Lambda |
| IAM | ✅ | `create-role` funciona (no evalúa políticas) |
| Cognito (user pools) | ✅ | Pool, cliente, usuario, contraseña permanente e `initiate-auth` con tokens. No se verificó JWKS |
| **S3 Vectors** | ✅ | Bucket, índice, `put-vectors` y `query-vectors` con distancia coseno **correcta** (el vector más cercano salió primero). Podríamos ensayar el camino S3 real en local |
| CloudWatch Logs | ✅ | Grupo, stream y `put-log-events` |

## 2. Resultados con el SDK de Node (el que usará el backend)

Se probó con `@aws-sdk/*` 3.1170, `@langchain/aws` 1.5.2, `@langchain/core` 1.4.1, `@langchain/langgraph` 1.7.4 y `@langchain/langgraph-checkpoint` 1.2.2 en Node 22.23:

| Comprobación | Resultado |
|---|---|
| `AWS_ENDPOINT_URL` global + `AWS_ENDPOINT_URL_BEDROCK_RUNTIME` y `…_BEDROCK_AGENT_RUNTIME` por servicio | ✅ Funciona: Bedrock fue al puente (HTTP) y DynamoDB al emulador (HTTPS) en el mismo proceso |
| `Converse` y `Retrieve` del SDK contra un puente falso | ✅ Devuelven lo que responde el puente |
| `ChatBedrockConverse` (`@langchain/aws`) con un `BedrockRuntimeClient` inyectado | ✅ Funciona contra el puente |
| LangGraph.js: grafo de 2 nodos con `MemorySaver` | ✅ Funciona; versiones compatibles entre sí |

## 3. Hallazgos que cambian el plan

1. **Los clientes de Bedrock Runtime y Agent Runtime usan HTTP/2 por defecto.** Contra el puente en HTTP plano fallan con `ERR_HTTP2_ERROR`. **Solución comprobada:** crear ambos clientes con `requestHandler: new NodeHttpHandler()` (de `@smithy/node-http-handler`, HTTP/1.1) y pasarlo también a `ChatBedrockConverse` mediante `client`. En Bedrock real HTTP/1.1 también funciona.
2. **El emulador usa HTTPS con certificado propio** y genera **credenciales nuevas en cada arranque**. El SDK necesita:
   `AWS_ENDPOINT_URL=https://127.0.0.1:9297`, `AWS_SHARED_CREDENTIALS_FILE=~/.aws/emulator/9297/emulator_credentials`, `AWS_CONFIG_FILE=~/.aws/emulator/9297/config`, y para Node `NODE_EXTRA_CA_CERTS=~/.aws/emulator/9297/ca.pem`. Por lo tanto **las credenciales `test`/`test` de los `.env.example` no sirven** con la autenticación activa (por defecto). `npm run dev` debe inyectar esas variables con rutas absolutas (el `~` no se expande en archivos `.env`). Alternativa: arrancar con `--auth off`, pero se pierde la verificación de firmas; se mantiene la autenticación activa.
3. **Todo vive en memoria y se borra al detener el emulador.** `provision` y `kb:sync-s3` deben ejecutarse en cada arranque (el plan ya los incluye en `setup`/`dev`); **las conversaciones no sobreviven a reiniciar el emulador**, solo a reiniciar el backend. Se debe indicar en la demo.
4. **El puerto es `9297`** (HTTPS, solo `127.0.0.1`). Un contenedor por región; usamos solo `us-east-1`.
5. **La creación de tablas y funciones es asíncrona**, como en AWS: hay que esperar `table-exists` / `function-active` antes de usarlas (`provision` debe esperar).
6. **Telemetría:** el emulador envía por defecto datos anónimos de uso a AWS. En el compose se desactiva con `EMULATOR_TELEMETRY=off`.
7. **Memoria:** el contenedor se limita a 2 GB; si lo supera, se detiene y se pierden los recursos.
8. **Fidelidad:** AWS verifica contra `us-west-2`; no hubo diferencias en lo que probamos en `us-east-1`. No se ejecutó el `fidelity_tests_runner` (nuestras pruebas directas cubren lo necesario).
9. **No implementado = HTTP 501 `NotImplemented`**, lo que facilita detectar huecos.
10. **Lambda real:** como Lambda ejecuta código de verdad, el backend podría empaquetarse como función en el propio emulador. No es necesario para el MVP (Express local), pero queda como camino de ensayo del lab.

## 4. Decisiones confirmadas

| Decisión del plan | Estado |
|---|---|
| D2: emulador en `us-east-1` | ✅ Confirmado (puerto 9297, HTTPS, credenciales por archivo) |
| D3: puente para `Converse` | ✅ **Necesario** (el LLM del emulador no genera texto); el puente habla HTTP/1.1 y se prueba con el SDK |
| D5: puente para `Retrieve` | ✅ **Necesario** (el `Retrieve` del emulador devuelve vacío) |
| D6: `DynamoDBSaver` portado, tabla `PK`/`SK` + TTL | ✅ El emulador soporta todas las operaciones necesarias; **no hace falta DynamoDB Local** |
| D8: demo sin login | ✅ (Cognito existe en el emulador si se quisiera ensayar) |
| Express como API local | ✅ Se mantiene (Lambda real sería opcional, API Gateway sin enrutamiento verificado) |

## 5. Cómo reproducirlo

```sh
docker build -t aws-emulator local/emulator
mkdir -p ~/.aws/emulator
docker run -d --name ebc-aws-emulator --memory=2g --memory-swap=2g \
  -p 127.0.0.1:9297:9297 -e HOME="$HOME" -e EMULATOR_TELEMETRY=off \
  -v "$HOME/.aws/emulator:$HOME/.aws/emulator" aws-emulator -p 9297
local/scripts/spike-emulator.sh          # matriz de servicios
docker rm -f ebc-aws-emulator            # detener y borrar el contenedor
```

## 6. Pendiente (se resuelve en las fases siguientes)

- Contrato exacto de `Converse` y `Retrieve` **del puente real** con OpenAI (Fase 1.4).
- Nombre del modelo `gpt-6-luna` y parámetro de razonamiento contra la API de OpenAI (Fase 1.4).
- Esquema definitivo de ítems del `DynamoDBSaver` según el código de AWS (Fase 4.1).
- Enrutamiento de API Gateway hacia Lambda y JWKS de Cognito (solo si se quiere ensayar el lab).
