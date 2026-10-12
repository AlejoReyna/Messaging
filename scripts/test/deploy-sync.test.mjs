import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';

const workflow = parse(readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8'));
const command = workflow.jobs.deploy.steps.find((step) => step.name === 'Deploy over SSH').run;
const sync = command.split('# BEGIN DEPLOY GIT SYNC\n')[1].split('# END DEPLOY GIT SYNC')[0];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'chat-deploy-sync-'));
  const source = join(directory, 'source');
  const server = join(directory, 'server');
  const git = (cwd, ...args) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'Deploy test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
      GIT_COMMITTER_NAME: 'Deploy test', GIT_COMMITTER_EMAIL: 'test@example.invalid' },
  }).trim();
  git(directory, 'init', '-b', 'main', source);
  writeFileSync(join(source, '.gitignore'), '.env\n');
  writeFileSync(join(source, 'app.txt'), 'old\n');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'initial');
  git(directory, 'clone', source, server);
  writeFileSync(join(source, 'app.txt'), 'published\n');
  writeFileSync(join(source, 'new.txt'), 'published new file\n');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'release');
  const run = () => spawnSync('bash', ['-c', `set -euo pipefail\n${sync}`], { cwd: server, encoding: 'utf8' });
  return { directory, source, server, git, run, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

test('deploy conserva código local y archivos nuevos en stash, sin tocar configuración ignorada', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.server, 'app.txt'), 'manual edit\n');
    writeFileSync(join(f.server, 'new.txt'), 'manual new file\n');
    writeFileSync(join(f.server, '.env'), 'private runtime configuration\n');
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(f.server, 'app.txt'), 'utf8'), 'published\n');
    assert.equal(readFileSync(join(f.server, 'new.txt'), 'utf8'), 'published new file\n');
    assert.equal(readFileSync(join(f.server, '.env'), 'utf8'), 'private runtime configuration\n');
    assert.equal(f.git(f.server, 'show', 'refs/stash:app.txt'), 'manual edit');
    assert.equal(f.git(f.server, 'show', 'refs/stash^3:new.txt'), 'manual new file');
    assert.equal(f.git(f.server, 'status', '--porcelain'), '');
    const stash = f.git(f.server, 'rev-parse', 'refs/stash');
    assert.equal(f.run().status, 0);
    assert.equal(f.git(f.server, 'rev-parse', 'refs/stash'), stash);
  } finally { f.cleanup(); }
});

test('deploy de checkout limpio avanza sin crear stash', () => {
  const f = fixture();
  try {
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(f.git(f.server, 'rev-parse', 'HEAD'), f.git(f.source, 'rev-parse', 'HEAD'));
    assert.equal(f.git(f.server, 'stash', 'list'), '');
  } finally { f.cleanup(); }
});

test('deploy divergente falla antes de cambiar archivos o guardar stash', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.server, 'local.txt'), 'local commit\n');
    f.git(f.server, 'add', 'local.txt');
    f.git(f.server, 'commit', '-m', 'server-only commit');
    writeFileSync(join(f.server, 'app.txt'), 'uncommitted server change\n');
    const head = f.git(f.server, 'rev-parse', 'HEAD');
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /historial del servidor divergente/);
    assert.equal(f.git(f.server, 'rev-parse', 'HEAD'), head);
    assert.equal(readFileSync(join(f.server, 'app.txt'), 'utf8'), 'uncommitted server change\n');
    assert.equal(f.git(f.server, 'stash', 'list'), '');
  } finally { f.cleanup(); }
});
