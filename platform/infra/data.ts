// Conversaciones del asistente: una sola tabla al estilo del DynamoDBSaver de AWS (checkpointer de LangGraph).
//   PK = CHECKPOINT_<thread> | WRITES_<thread>#<ns>#<checkpoint_id>      SK = <ns>#<checkpoint_id> | <task_id>#<idx>
// El atributo `ttl` expira las conversaciones solo (7 días). El esquema es el mismo que crea `npm run provision` en local.
export function createConversationsTable() {
  return new sst.aws.Dynamo("ConversationCheckpoints", {
    fields: { PK: "string", SK: "string" },
    primaryIndex: { hashKey: "PK", rangeKey: "SK" },
    ttl: "ttl",
  });
}
