import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';
import { createServer } from 'node:net';
import { projectRoot, localEnvironment } from './local-env.mjs';
import { databaseEnvironment } from './database-env.mjs';

// Únicamente cluster de QA creado por test-db.mjs, puerto 55432. No usa una
// DATABASE_URL externa ni provisión de producción; los datos son sintéticos.
const name = 'private_chat_preview';
const ownerPassword = readFileSync(resolve(projectRoot, '.secrets/db_owner_password'), 'utf8').trim();
const pool = new pg.Pool({ host: '127.0.0.1', port: 55432, user: 'private_chat_owner', password: ownerPassword, database: 'postgres', max: 1 });
let child;
try {
  const probe = createServer();
  await new Promise((accept, reject) => { probe.once('error', reject); probe.listen(3000, '127.0.0.1', accept); });
  await new Promise((accept) => probe.close(accept));
  const found = await pool.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
  if (!found.rowCount) await pool.query('CREATE DATABASE private_chat_preview');
  await pool.end();
  const qaDirectory = resolve(projectRoot, '.data/preview');
  mkdirSync(qaDirectory, { recursive: true, mode: 0o700 });
  const adminFile = resolve(qaDirectory, 'admin-password');
  const memberFile = resolve(qaDirectory, 'member-password');
  const qaPasswords = { adminqa: 'QA-admin-privado-001', contactoqa: 'QA-contacto-privado-002' };
  writeFileSync(adminFile, qaPasswords.adminqa, { mode: 0o600 });
  writeFileSync(memberFile, qaPasswords.contactoqa, { mode: 0o600 });
  const source = localEnvironment(true);
  delete source.DATABASE_URL; delete source.OWNER_DATABASE_URL;
  const env = databaseEnvironment({ ...source, DATABASE_PORT: '55432', DATABASE_NAME: name, ADMIN_USERNAME: 'adminqa', PARTNER_USERNAME: 'contactoqa', ADMIN_PASSWORD_FILE: adminFile, MEMBER_PASSWORD_FILE: memberFile, RUNTIME_PASSWORD_FILE: resolve(projectRoot, '.secrets/db_app_password'), UPLOAD_DIR: resolve(qaDirectory, 'uploads'), DELETION_JOURNAL_PATH: resolve(qaDirectory, 'deletions.jsonl') });
  const boot = spawnSync('node', ['scripts/bootstrap.mjs'], { cwd: projectRoot, env, stdio: 'inherit' });
  if (boot.status !== 0) throw new Error('Bootstrap de QA falló');
  const runtimeEnv = { ...env, DATABASE_USER: 'private_chat_app', DATABASE_PASSWORD_FILE: resolve(projectRoot, '.secrets/db_app_password') };
  delete runtimeEnv.DATABASE_URL; delete runtimeEnv.OWNER_DATABASE_URL;
  child = spawn('node', ['apps/api/dist/index.js'], { cwd: projectRoot, env: runtimeEnv, stdio: 'inherit' });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error('API QA terminó antes de readiness');
    try { ready = (await fetch('http://127.0.0.1:3000/api/ready')).ok; } catch { /* arranque */ }
    if (ready) break;
    await new Promise((accept) => setTimeout(accept, 100));
  }
  if (!ready) throw new Error('API QA no disponible');
  // La provisión y cambio inicial se prueban por API; el navegador recibe dos
  // cuentas QA ya preparadas sin pedir credenciales reales al usuario.
  const { TestClient } = await import('../apps/api/test/integration/helpers.ts');
  const clients = [];
  for (const [username, password] of Object.entries(qaPasswords)) {
    const client = new TestClient('http://127.0.0.1:3000');
    let login = await client.login(username, `${password}-lista`);
    if (login.status !== 200) login = await client.login(username, password);
    if (login.status !== 200) throw new Error('La cuenta QA existente tiene otra contraseña; no se reemplazará');
    if (login.json.user.mustChangePassword) {
      const change = await client.request('POST', '/api/auth/change-password', { body: { currentPassword: password, newPassword: `${password}-lista` } });
      if (change.status !== 200) throw new Error('Cambio de contraseña QA falló');
      client.csrf = change.json.csrfToken;
    }
    clients.push(client);
  }
  const [admin, member] = clients;
  const conversation = await admin.request('GET', '/api/conversation');
  const version = conversation.json.conversation.version;
  // Nombres iniciales de la vista previa. No reemplazar posteriores ediciones.
  const adminProfile = await admin.request('GET', '/api/auth/session');
  if (['adminqa', 'Admin QA', 'Admin'].includes(adminProfile.json.user.displayName)) {
    const saved = await admin.request('PATCH', '/api/users/me', { body: { displayName: 'Alexis' } });
    if (saved.status !== 200) throw new Error('No se pudo guardar el nombre inicial de la cuenta admin QA');
  }
  const memberProfile = await member.request('GET', '/api/auth/session');
  if (['contactoqa', 'Contacto QA', 'Contacto'].includes(memberProfile.json.user.displayName)) {
    const saved = await member.request('PATCH', '/api/users/me', { body: { displayName: 'Marthiel' } });
    if (saved.status !== 200) throw new Error('No se pudo guardar el nombre inicial de la cuenta member QA');
  }
  // Sólo el perfil aún virgen recibe la foto inicial. Una foto cambiada o
  // eliminada por Alexis nunca se repone al reiniciar la vista previa.
  if (adminProfile.json.user.avatarVersion === 0 && adminProfile.json.user.avatarUrl === null) {
    const form = new FormData();
    form.append('avatar', new Blob([readFileSync(resolve(projectRoot, 'infra/profile/alexis.jpg'))], { type: 'image/jpeg' }), 'avatar.jpg');
    const saved = await admin.request('POST', '/api/users/me/avatar', { rawBody: form });
    if (saved.status !== 200) throw new Error('No se pudo guardar la foto inicial de Alexis');
  }
  if (memberProfile.json.user.avatarVersion === 0 && memberProfile.json.user.avatarUrl === null) {
    const form = new FormData();
    form.append('avatar', new Blob([readFileSync(resolve(projectRoot, 'infra/profile/marthiel.png'))], { type: 'image/png' }), 'avatar.png');
    const saved = await member.request('POST', '/api/users/me/avatar', { rawBody: form });
    if (saved.status !== 200) throw new Error('No se pudo guardar la foto inicial de Marthiel');
  }
  const page = await admin.request('GET', '/api/messages?limit=1');
  if (!page.json.messages.length) {
    for (const [client, body] of [[member, 'Hola 👋'], [member, 'Esta es nuestra conversación privada.'], [admin, 'Hola, la vista de escritorio y móvil ya están conectadas.'], [member, 'Podemos cambiar nuestros nombres y fotos desde el perfil.'], [admin, 'Los mensajes quedan guardados en PostgreSQL.']]) {
      const sent = await client.request('POST', '/api/messages', { body: { clientMessageId: crypto.randomUUID(), body, conversationVersion: version } });
      if (sent.status !== 201) throw new Error('Envío QA falló');
    }
  }
  console.log('API de vista previa QA lista en loopback:3000, base private_chat_preview; cuentas y mensajes sintéticos.');
  await new Promise((accept) => child.once('exit', accept));
} catch {
  child?.kill('SIGTERM');
  await pool.end().catch(() => undefined);
  console.error('No se pudo preparar la vista previa QA. Usa test:db:start y build; comprueba puerto 3000 y la base exclusiva.');
  process.exitCode = 1;
}
