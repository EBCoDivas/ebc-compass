const { readFileSync } = require('node:fs');

const rules = [
  [/git\s+push\b.*\b(main|master)\b/, 'No se permite push directo a main; usa un PR.'],
  [/\.env\b/, 'No leas ni imprimas archivos .env.'],
  [/\bsst\s+(deploy|remove)\b/, 'Los despliegues AWS requieren autorización.'],
];

try {
  const payload = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload');
  }
  const command = JSON.stringify(payload.tool_input ?? payload);
  const match = rules.find(([pattern]) => pattern.test(command));
  if (match) {
    console.error(match[1]);
    process.exitCode = 2;
  }
} catch {
  console.error('No se puede revisar el comando: el hook requiere una entrada JSON válida por stdin.');
  process.exitCode = 2;
}
