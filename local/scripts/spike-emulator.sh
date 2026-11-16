#!/usr/bin/env bash
# Fase 0 (spike): prueba qué servicios de AWS Emulator sirven para EBC Compass.
# Uso: local/scripts/spike-emulator.sh [puerto]   (el emulador debe estar corriendo)
# Solo habla con 127.0.0.1; no toca AWS real. Escribe un resumen PASS/FAIL en la salida estándar.
set -uo pipefail
PORT="${1:-9297}"
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE
export AWS_ENDPOINT_URL="https://127.0.0.1:${PORT}"
export AWS_SHARED_CREDENTIALS_FILE="$HOME/.aws/emulator/${PORT}/emulator_credentials"
export AWS_CONFIG_FILE="$HOME/.aws/emulator/${PORT}/config"
export AWS_CA_BUNDLE="$HOME/.aws/emulator/${PORT}/ca.pem"
export AWS_EC2_METADATA_DISABLED=true AWS_DISABLE_HOST_PREFIX_INJECTION=true
export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1 AWS_PAGER=""

SUF="$(date +%s)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
results=()

# t "<servicio>" "<prueba>" comando...   -> registra OK o FALLA con la primera línea de error
t() {
  local svc="$1" name="$2"; shift 2
  local out rc
  out="$("$@" 2>&1)"; rc=$?
  if [ $rc -eq 0 ]; then
    results+=("OK|$svc|$name|")
  else
    results+=("FALLA|$svc|$name|$(printf '%s' "$out" | tr '\n' ' ' | cut -c1-160)")
  fi
  printf '%s' "$out" > "$WORK/last.out"
}

echo "== Endpoint: $AWS_ENDPOINT_URL"
t sts identidad aws sts get-caller-identity

# ---------- DynamoDB (lo que necesita el checkpointer de LangGraph) ----------
T="spike-checkpoints-$SUF"
t dynamodb "create-table PK/SK" aws dynamodb create-table --table-name "$T" \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE --billing-mode PAY_PER_REQUEST
t dynamodb "wait table-exists (ACTIVE)" aws dynamodb wait table-exists --table-name "$T"
t dynamodb "update-time-to-live (ttl)" aws dynamodb update-time-to-live --table-name "$T" \
  --time-to-live-specification Enabled=true,AttributeName=ttl
t dynamodb "describe-time-to-live" aws dynamodb describe-time-to-live --table-name "$T"
t dynamodb "put-item" aws dynamodb put-item --table-name "$T" \
  --item '{"PK":{"S":"THREAD#a#b"},"SK":{"S":"CKPT#ns#001"},"data":{"S":"x"},"ttl":{"N":"4102444800"}}'
t dynamodb "put-item condicional (debe fallar al repetir)" bash -c "! aws dynamodb put-item --table-name '$T' --item '{\"PK\":{\"S\":\"THREAD#a#b\"},\"SK\":{\"S\":\"CKPT#ns#001\"}}' --condition-expression 'attribute_not_exists(PK)' >/dev/null 2>&1"
cat > "$WORK/batch.json" <<JSON
{"$T":[{"PutRequest":{"Item":{"PK":{"S":"THREAD#a#b"},"SK":{"S":"CKPT#ns#002"}}}},{"PutRequest":{"Item":{"PK":{"S":"THREAD#a#b"},"SK":{"S":"WRITE#ns#002#t#0"}}}}]}
JSON
t dynamodb "batch-write-item" aws dynamodb batch-write-item --request-items "file://$WORK/batch.json"
t dynamodb "query begins_with + orden descendente" aws dynamodb query --table-name "$T" \
  --key-condition-expression 'PK = :p AND begins_with(SK, :s)' \
  --expression-attribute-values '{":p":{"S":"THREAD#a#b"},":s":{"S":"CKPT#"}}' --no-scan-index-forward --limit 1
q_first="$(python3 -c "import json;d=json.load(open('$WORK/last.out'));print(d['Items'][0]['SK']['S'])" 2>/dev/null || echo '?')"
results+=("INFO|dynamodb|último checkpoint devuelto por la query|$q_first (esperado CKPT#ns#002)")
t dynamodb "delete-item" aws dynamodb delete-item --table-name "$T" --key '{"PK":{"S":"THREAD#a#b"},"SK":{"S":"CKPT#ns#001"}}'
t dynamodb "delete-table" aws dynamodb delete-table --table-name "$T"

# ---------- S3 ----------
B="spike-bucket-$SUF"
t s3 "create-bucket" aws s3api create-bucket --bucket "$B"
echo "hola" > "$WORK/a.md"
t s3 "put-object" aws s3api put-object --bucket "$B" --key a.md --body "$WORK/a.md"
t s3 "get-object" aws s3api get-object --bucket "$B" --key a.md "$WORK/b.md"

# ---------- Bedrock Runtime / Agent Runtime ----------
t bedrock-runtime "converse" aws bedrock-runtime converse --model-id amazon.nova-lite-v1:0 \
  --messages '[{"role":"user","content":[{"text":"Hola"}]}]'
results+=("INFO|bedrock-runtime|respuesta de converse|$(head -c 200 "$WORK/last.out" | tr '\n' ' ')")
t bedrock-agent "create-knowledge-base" aws bedrock-agent create-knowledge-base --name "spike-kb-$SUF" \
  --role-arn arn:aws:iam::000000000000:role/kbrole \
  --knowledge-base-configuration '{"type":"VECTOR","vectorKnowledgeBaseConfiguration":{"embeddingModelArn":"arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"}}' \
  --storage-configuration '{"type":"OPENSEARCH_SERVERLESS","opensearchServerlessConfiguration":{"collectionArn":"arn:aws:aoss:us-east-1:000000000000:collection/abc","vectorIndexName":"i","fieldMapping":{"vectorField":"v","textField":"t","metadataField":"m"}}}'
KBID="$(python3 -c "import json;print(json.load(open('$WORK/last.out'))['knowledgeBase']['knowledgeBaseId'])" 2>/dev/null || echo none)"
t bedrock-agent-runtime "retrieve (KB sin documentos)" aws bedrock-agent-runtime retrieve --knowledge-base-id "$KBID" \
  --retrieval-query '{"text":"becas"}'
results+=("INFO|bedrock-agent-runtime|respuesta de retrieve|$(head -c 200 "$WORK/last.out" | tr '\n' ' ')")

# ---------- Lambda ----------
cat > "$WORK/index.mjs" <<'JS'
export const handler = async (e) => ({ statusCode: 200, body: JSON.stringify({ ok: true, echo: e }) });
JS
(cd "$WORK" && python3 -c "import zipfile;z=zipfile.ZipFile('fn.zip','w');z.write('index.mjs');z.close()")
t iam "create-role (para Lambda)" aws iam create-role --role-name "spike-role-$SUF" \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
t lambda "create-function nodejs22.x" aws lambda create-function --function-name "spike-fn-$SUF" --runtime nodejs22.x \
  --handler index.handler --zip-file "fileb://$WORK/fn.zip" --role "arn:aws:iam::000000000000:role/spike-role-$SUF"
t lambda "wait function-active" aws lambda wait function-active-v2 --function-name "spike-fn-$SUF"
t lambda "invoke (¿ejecuta código real?)" aws lambda invoke --function-name "spike-fn-$SUF" --payload '{"hola":"mundo"}' --cli-binary-format raw-in-base64-out "$WORK/inv.json"
results+=("INFO|lambda|salida de invoke|$(head -c 200 "$WORK/inv.json" 2>/dev/null | tr '\n' ' ')")

# ---------- API Gateway v2 ----------
t apigatewayv2 "create-api HTTP" aws apigatewayv2 create-api --name "spike-api-$SUF" --protocol-type HTTP

# ---------- Cognito ----------
t cognito-idp "create-user-pool" aws cognito-idp create-user-pool --pool-name "spike-pool-$SUF"
POOL="$(python3 -c "import json;print(json.load(open('$WORK/last.out'))['UserPool']['Id'])" 2>/dev/null || true)"
if [ -n "$POOL" ]; then
  t cognito-idp "create-user-pool-client" aws cognito-idp create-user-pool-client --user-pool-id "$POOL" --client-name web --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
  CLIENT="$(python3 -c "import json;print(json.load(open('$WORK/last.out'))['UserPoolClient']['ClientId'])" 2>/dev/null || true)"
  t cognito-idp "admin-create-user" aws cognito-idp admin-create-user --user-pool-id "$POOL" --username demo@example.com --message-action SUPPRESS
  t cognito-idp "admin-set-user-password" aws cognito-idp admin-set-user-password --user-pool-id "$POOL" --username demo@example.com --password 'Demo-Pass-123!' --permanent
  [ -n "$CLIENT" ] && t cognito-idp "initiate-auth (token JWT)" aws cognito-idp initiate-auth --client-id "$CLIENT" --auth-flow USER_PASSWORD_AUTH --auth-parameters USERNAME=demo@example.com,PASSWORD='Demo-Pass-123!'
fi

# ---------- S3 Vectors ----------
t s3vectors "create-vector-bucket" aws s3vectors create-vector-bucket --vector-bucket-name "spike-vec-$SUF"
t s3vectors "create-index" aws s3vectors create-index --vector-bucket-name "spike-vec-$SUF" --index-name idx --data-type float32 --dimension 3 --distance-metric cosine
t s3vectors "put-vectors" aws s3vectors put-vectors --vector-bucket-name "spike-vec-$SUF" --index-name idx --vectors '[{"key":"a","data":{"float32":[1,0,0]},"metadata":{"topic":"x"}},{"key":"b","data":{"float32":[0,1,0]}}]'
t s3vectors "query-vectors (similitud)" aws s3vectors query-vectors --vector-bucket-name "spike-vec-$SUF" --index-name idx --top-k 1 --query-vector '{"float32":[0.9,0.1,0]}' --return-distance
results+=("INFO|s3vectors|resultado de query|$(head -c 200 "$WORK/last.out" | tr '\n' ' ')")

# ---------- CloudWatch Logs ----------
t logs "create-log-group" aws logs create-log-group --log-group-name "/spike/$SUF"
t logs "create-log-stream" aws logs create-log-stream --log-group-name "/spike/$SUF" --log-stream-name s
t logs "put-log-events" aws logs put-log-events --log-group-name "/spike/$SUF" --log-stream-name s --log-events "timestamp=$(( $(date +%s) * 1000 )),message=hola"

echo
printf '%-7s %-22s %-48s %s\n' RESULTADO SERVICIO PRUEBA DETALLE
for r in "${results[@]}"; do IFS='|' read -r s a b c <<<"$r"; printf '%-7s %-22s %-48s %s\n' "$s" "$a" "$b" "$c"; done
