const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const script = path.join(__dirname, 'block_risky.cjs');
const windows = process.platform === 'win32';
const shell = windows
  ? path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
  : '/bin/sh';

function run(input) {
  const result = spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

for (const [command, reason] of [
  ['git push origin main', /push directo/],
  ['git push origin master', /push directo/],
  ['Get-Content .env', /archivos .env/],
  ['cat .env.local', /archivos .env/],
  ['sst deploy --stage dev', /autorización/],
  ['sst remove --stage dev', /autorización/],
]) {
  test(`blocks synthetic command: ${command}`, () => {
    const result = run(JSON.stringify({ tool_input: { cmd: command } }));
    assert.equal(result.status, 2);
    assert.match(result.stderr, reason);
    assert.equal(result.stdout, '');
  });
}

test('allows safe commands and accepts the fallback input shape', () => {
  for (const payload of [{ tool_input: { cmd: 'git status' } }, { cmd: 'git push origin feature/demo' }]) {
    const result = run(JSON.stringify(payload));
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, '');
  }
});

test('blocks malformed input without echoing its contents', () => {
  for (const input of ['', 'invalid-sensitive-value', 'null', '[]']) {
    const result = run(input);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /JSON válida/);
    assert.doesNotMatch(result.stderr, /invalid-sensitive-value/);
  }
});

function launch(check, options = {}) {
  const args = windows
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'run_hook.ps1'), ...(check ? ['-Check'] : [])]
    : [path.join(__dirname, 'run_hook.sh'), ...(check ? ['check'] : [])];
  const result = spawnSync(shell, args, { encoding: 'utf8', cwd: root, ...options });
  assert.ifError(result.error);
  return result;
}

test('launcher checks prerequisites and forwards stdin and exit codes', () => {
  assert.equal(launch(true).status, 0);
  for (const [cmd, status] of [['git status', 0], ['Get-Content .env', 2]]) {
    const result = launch(false, { input: JSON.stringify({ tool_input: { cmd } }) });
    assert.equal(result.status, status, result.stderr);
  }
});

test('missing Node warns at startup and blocks commands', () => {
  const env = { ...process.env, PATH: '' };
  const warning = launch(true, { env });
  assert.equal(warning.status, 0);
  assert.match(JSON.parse(warning.stdout).systemMessage, /instala Node.js/);
  const blocked = launch(false, { env });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /instala Node.js/);
});

test('configured commands run from subdirectories and report missing Git', () => {
  const config = readFileSync(path.join(root, '.codex/config.toml'), 'utf8');
  const key = windows ? 'command_windows' : 'command';
  const commands = [...config.matchAll(new RegExp(`^${key} = '''\\r?\\n([\\s\\S]*?)'''`, 'gm'))];
  assert.equal(commands.length, 2);
  for (const [index, match] of commands.entries()) {
    const args = windows ? ['-NoProfile', '-Command', match[1]] : ['-c', match[1]];
    const options = { encoding: 'utf8', cwd: path.join(root, 'platform'), input: '{"tool_input":{"cmd":"git status"}}' };
    const result = spawnSync(shell, args, options);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    if (index === 1) {
      const blocked = spawnSync(shell, args, { ...options, input: '{"tool_input":{"cmd":"Get-Content .env"}}' });
      assert.equal(blocked.status, 2, blocked.stderr);
      assert.match(blocked.stderr, /archivos .env/);
    }
    const missingGit = spawnSync(shell, args, { ...options, env: { ...process.env, PATH: '' } });
    assert.equal(missingGit.status, index === 0 ? 0 : 2);
    if (index === 0) assert.match(JSON.parse(missingGit.stdout).systemMessage, /instala Git/);
    else assert.match(missingGit.stderr, /instala Git/);
  }
});
