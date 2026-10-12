# Handoff backend — API, PostgreSQL y seguridad del chat

## Alcance entregado (`apps/api/**`)

Servidor Fastify + Socket.IO + Prisma 7 (`@prisma/adapter-pg`, `PrismaPg`) + PostgreSQL, que implementa el contrato completo (`docs/CONTRACT.md`, `@private-chat/contracts` intacto):

- `src/index.ts`, `src/config.ts`, `src/db.ts` — arranque, configuración por entorno + archivos `*_FILE`, bloqueo de arranque inseguro en producción (exige `APP_ORIGIN` https, secretos ≥32 caracteres y `DATABASE_PASSWORD_FILE`).
- `src/http/app.ts` — las 14 rutas del contrato: `health`, `ready` (comprueba DB + provisioning sin detallar), `auth/session` (siempre devuelve `csrfToken`), `login`/`logout`/`change-password`, `PATCH /users/me`, avatares (subir/borrar/servir privado), `conversation`, `messages` (paginación before/after, envío idempotente), `conversation/read` (monotónica y acotada), borrados admin (individual + vaciado). Errores uniformes `{error:{code,message}}` en español.
- Auth: Argon2id explícito (m=64MiB, t=3, p=4), sesiones opacas (sólo SHA-256 en DB, cookie firmada HttpOnly/Secure-en-prod/SameSite=Lax, 30 días), CSRF sin estado (cookie firmada + token HMAC, rota en login/logout/cambio), primera contraseña obligatoria (resto 403 `PASSWORD_CHANGE_REQUIRED`), login genérico 401 + hash ficticio anti-timing, límites por cuenta/IP y por envío (en memoria).
- `src/realtime.ts` — Socket.IO en `/socket.io`: auth por cookie + `csrfToken`, Origin exacto contra `APP_ORIGIN`, rechazo sin sesión/CSRF/pending-password, sala única, presencia multi-dispositivo, `typing:set` con TTL 5 s y rate-limit, cierre de sockets por sesión (logout) y por usuario (cambio de contraseña). Sólo difunde los 7 eventos del contrato; ningún canal de escritura WS.
- Envío HTTP: transacción con `SELECT … FOR UPDATE` sobre conversación, `sequence` monótona del servidor, `(senderId, clientMessageId)` único (idéntico→200, distinto→409, de borrado→410), versión obsoleta→409, difusión sólo tras commit.
- Borrados admin: journal JSONL con fsync (`intención` antes de DB, `confirmación` después; sin éxito-200 sin journal), tombstones sin texto (bloquean re-creación y restauraciones), auditoría sin body, `version+1`, `lastSequence` intacto.
- `src/cli/seed.ts` — idempotente, no toca cuentas existentes; contraseñas por `*_PASSWORD_FILE` o terminal sin eco (nunca args/logs).
- `src/cli/grant.ts` — crea `private_chat_app` y concede mínimos: `SELECT` + `UPDATE` por columnas de perfil/contraseña en `users` (sin INSERT/DELETE/slot/role/DDL), DML de filas en el resto, `REVOKE INSERT/DELETE` en `conversation`.
- `src/cli/reconcile-deletions.ts` — sin HTTP: aplica intenciones sin confirmación y **re-elimina borrados confirmados que reaparezcan** tras restaurar un respaldo antiguo (sube versión para que clientes recarguen).
- `prisma/schema.prisma` + `prisma/migrations/0001_init/migration.sql` — schema `chat`, CHECKs (slots 1/2 con rol asociado, username `^[a-z0-9_.-]{3,32}$`, conversación id=1, body 1–4000). `prisma.config.ts` usa `OWNER_DATABASE_URL`/`DATABASE_URL` sin imprimirla.
- Avatares (`src/avatar.ts`): detección por bytes mágicos (SVG y resto rechazados antes de Sharp), re-exportación JPEG/PNG/WebP ≤5 MiB con tope 1024 px y sin EXIF, nombres `uuid.ext` bajo `UPLOAD_DIR/avatars`, servidos sólo con sesión.
- Logs: sin body/contraseñas/hashes/tokens/secretos/URLs (redacción pino + nunca se registra el cuerpo).

## Comandos y resultados (todo real, nada simulado)

Entorno local: Node v26.10.0 (contrato pide 24 LTS — ver pendientes), PostgreSQL 16.15 local (contrato: 18 en producción), bases dedicadas `private_chat_test` (pruebas) y `private_chat` (operativa). Sin Docker disponible.

- `npm run build` (api): OK. `npm run typecheck`: OK. `npm test` (unit, 23 pruebas: CSRF, cookies, rate-limit, journal, avatar, errores): **23 pass / 0 fail**.
- `npm run test:integration` con `TEST_DATABASE_URL` (PostgreSQL real, 30 pruebas: provisión, auth, CSRF/Origin, sockets por polling incl. typing por cable, idempotencia, concurrencia envío/vaciado y claves duplicadas, tombstones, cursores, lecturas, journal, reconcile por CLI real, restauración antigua, constraints SQL, avatares): **30 pass / 0 fail**. Sin `TEST_DATABASE_URL` falla con mensaje claro (sin omisiones silenciosas).
- `db:migrate` (`prisma migrate deploy` como owner): `0001_init` aplicada.
- `db:seed` (dos cuentas + conversación): crea y en segunda ejecución informa "sin cambios".
- `db:grant`: verificado a nivel DB — runtime con `SELECT` + `UPDATE` por columnas en `users`; `INSERT/UPDATE slot/DELETE users` → `permission denied`; `UPDATE display_name` permitido.
- Servidor real con rol runtime: `health`/`ready` ok, login → `PASSWORD_CHANGE_REQUIRED` → cambio → envío (seq 1) → borrado (versión 2, journal intención+confirmación sin texto) → `db:reconcile-deletions` informa "0 pendientes, 0 restaurados".

## Dependencias solicitadas al principal

Ninguna nueva: todo está en `apps/api/package.json`. Sólo falta que el principal ejecute `npm install` y genere `package-lock.json` (yo verifiqué con `npm install --no-save --no-package-lock` en caché temporal, **sin modificar manifiestos ni crear lockfile**; `node_modules/` y `dist/` locales son gitignored). Contratos usados tal cual (`zod`, DTO y validadores compartidos).

## Decisiones y garantías del journal (límites honestos)

- Garantiza: intención fsync-ada antes de mutar DB; éxito sólo con confirmación fsync-ada; reaplicación idempotente; verificación de borrados confirmados contra restauraciones (IDs opacos, nunca texto).
- **No** promete atomicidad FS↔DB: si la confirmación falla tras aplicar DB, se devuelve 500 (no éxito) y la reconciliación converge. Un corte entre intención y DB deja intención pendiente que el reconcile aplica.
- No borra copias fuera del sistema (capturas, exports, clientes offline): documentado para el aviso de privacidad del frontend.

## Pendientes reales / limitaciones

1. Producción (PostgreSQL 18, Node 24, VPS Atlantic.net, proxy mismo-origen, secretos `/run/secrets`, `OWNER_*`): no desplegado; corresponde al principal con infra.
2. Rate-limits en memoria (una instancia). Con varias réplicas, mover a almacén compartido. Sin `trustProxy`: tras proxy, el límite por IP ve la IP del proxy (documentar en infra).
3. `loginByIp` (200/10min) y `sendByUser` (60/min) son valores operativos razonables; ajustar con métricas reales.
4. Sesiones con caducidad fija 30 días sin deslizamiento; sin "recordarme" separado (fuera del MVP).
5. Presencia/typing no sobreviven a reinicio del proceso (estado en memoria): los clientes reconcilian vía `GET /conversation` + `after`, según contrato.
6. `GRANT CONNECT ON DATABASE` usa `DATABASE_NAME`; `APP_DB_ROLE` permite renombrar el rol runtime si infra lo requiere.
7. Credenciales locales de prueba (`pctest`, `private_chat_app`, secretos en `/tmp/.../opencode`): desechables, sólo para verificación local; la instalación real pedirá sus contraseñas por terminal/archivos secretos.
8. Node local 26 vs 24 LTS del contrato, y PG local 16 vs 18: el despliegue debe validar contra las versiones fijadas.


## Entrega 2026-10-12 — notas de voz (contrato v7)

El usuario autorizó mensajes de voz. `apps/api/src/audio.ts` valida bytes reales y streams con FFprobe: admite MP4/AAC de Safari, WebM/Opus de Chrome (también sin cabecera de duración), Ogg/Opus de Firefox, MP3 y WAV; rechaza todo stream que no sea el único audio. Normaliza con FFmpeg a M4A/AAC mono 48 kHz y 96 kbps, descarta metadatos/capítulos y verifica la duración real normalizada (máximo 180 s). Se aplica máximo de subida/salida de 10 MiB, tiempo de FFprobe 15 s y FFmpeg 60 s, dos threads y eliminación de temporales en éxito/error. La subida de audio y video comparte una única reserva previa a la lectura para impedir decodificaciones simultáneas.

Archivos de esta entrega:

- `apps/api/src/http/app.ts`: `POST /api/messages/audio`, multipart estricto (archivo audio, clave, versión y caption/cita opcionales), CSRF/Origin/sesión, limitación 6 intentos/minuto/cuenta. No acepta metadatos de duración ni adjuntos adicionales. `GET /api/messages/:messageId/audio` autenticado, `audio/mp4`, `no-store`, `nosniff`, rangos simples 200/206/416.
- `apps/api/prisma/schema.prisma` y `prisma/migrations/0007_message_audio/migration.sql`: columnas privadas de bytes/hash/duración; constraints de tamaño/hash/duración y exclusión foto/video/audio. No cambia datos existentes. Grants sobre `messages` ya abarcan las columnas nuevas; no hay npm deps nuevas.
- DTO/historial/eventos/citas incluyen sólo URL privada y duración. Idempotencia compara body/hash original de audio/tipo/cita; retry idéntico devuelve el mismo mensaje. Borrados, tombstones, journal y reconciliación usan el flujo existente de filas, incluyendo bytes de audio.
- `apps/api/test/audio-fixtures.ts`, `test/unit/audio.test.ts` y `test/integration/audio.test.ts`: fixtures FFmpeg reales, normalización de cinco formatos, WebM sin duración, boundary Opus de 180 s, metadatos eliminados, duración/bytes/video encubierto/corruptos rechazados, limpieza y rangos. Integración cubre dos cuentas/sockets/historial/lectura/sesión revocada, retry/cambio tipo/cita, CSRF/Origin/metadata arbitraria/segundo adjunto, borrado y restauración/vaciado.

Comandos ejecutados en esta entrega:

- `npm run typecheck -w @private-chat/api`: OK, con Prisma Client generado por principal.
- `npm run build -w @private-chat/api`: OK.
- `npm run test -w @private-chat/api`: 39 pruebas unitarias, 39 pass / 0 fail (incluye FFmpeg/FFprobe reales).

Verificación posterior ejecutada por el principal: `npm run test:integration --workspace @private-chat/api` pasó la suite completa contra PostgreSQL privado en loopback:55432, incluidos los cuatro casos de audio; `npm run test:runtime` pasó 3/3, con audio mediante rol SQL runtime y flujo real de dos usuarios. Build y typecheck de raíz también pasaron. Este modelo no ejecutó esas suites para evitar carreras con la base compartida; los resultados son los comunicados por el principal. No se declara despliegue VPS verificado. Dependencias de sistema: FFmpeg y FFprobe, ya usadas por video; ninguna dependencia adicional. Rate limit y reserva de conversión son por proceso, de acuerdo con la única instancia del MVP.
