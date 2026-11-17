import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('lab guardrail publishes an immutable policy with content and denied topic checks', () => {
  let config;
  let version;
  const context = vm.createContext({ exports: {}, $app: { stage: 'test' }, aws: { bedrock: {
    Guardrail: class { constructor(_name, args) { config = args; this.guardrailId = 'id'; this.guardrailArn = 'arn'; this.updatedAt = 'updated'; } },
    GuardrailVersion: class { constructor(_name, args, options) { version = { args, options }; this.version = '1'; } },
  } } });
  const source = readFileSync(new URL('../infra/input-guardrail.ts', import.meta.url), 'utf8');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  const result = context.exports.createInputGuardrail();
  assert.equal(result.version, '1');
  assert.equal(result.id, 'id');
  assert.equal(version.args.guardrailArn, 'arn');
  assert.equal(version.args.description, 'updated');
  assert.ok(version.options.replaceOnChanges.includes('description'));
  assert.ok(config.contentPolicyConfig.filtersConfigs.some(filter => filter.type === 'PROMPT_ATTACK' && filter.inputStrength === 'HIGH'));
  assert.ok(config.topicPolicyConfig.topicsConfigs.some(topic => topic.name === 'OtherStudentRecords'));
  for (const topic of config.topicPolicyConfig.topicsConfigs) assert.ok(topic.definition.length <= 200);
});
