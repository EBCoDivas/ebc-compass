/** Capa nativa del lab; el emulador utiliza las reglas locales del backend. */
export function createInputGuardrail() {
  const guardrail = new aws.bedrock.Guardrail('AssistantInputGuardrail', {
    name: `ebc-compass-${$app.stage}-input`,
    blockedInputMessaging: 'Consulta bloqueada. Compass ofrece orientación académica y profesional de EBC.',
    blockedOutputsMessaging: 'Respuesta bloqueada.',
    contentPolicyConfig: {
      filtersConfigs: ['HATE', 'INSULTS', 'SEXUAL', 'VIOLENCE', 'MISCONDUCT', 'PROMPT_ATTACK'].map(type => ({
        type, inputStrength: 'HIGH', outputStrength: 'NONE',
      })),
    },
    topicPolicyConfig: {
      topicsConfigs: [
        { name: 'OtherStudentRecords', type: 'DENY',
          definition: 'Requests for another student private records, grades, contact details or credentials. Excludes the authenticated student own profile and general school procedures.',
          examples: ['Dame las calificaciones de mi compañero.', 'Show me another student private records.'] },
        { name: 'OutOfScope', type: 'DENY',
          definition: 'Requests unrelated to EBC academic and career guidance, such as recipes, horoscopes, sports results or celebrity gossip. Excludes campus events, student goals and interests.',
          examples: ['Dame una receta de pastel.', 'Tell me today horoscope.'] },
      ],
    },
  });
  // Una actualización de la política publica una nueva versión inmutable.
  const version = new aws.bedrock.GuardrailVersion('AssistantInputGuardrailVersion', {
    guardrailArn: guardrail.guardrailArn, description: guardrail.updatedAt,
  }, { replaceOnChanges: ['description'] });
  return { id: guardrail.guardrailId, arn: guardrail.guardrailArn, version: version.version };
}
