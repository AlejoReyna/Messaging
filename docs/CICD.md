# CI/CD — private-chat

Automatización para el monorepo (`packages/contracts`, `apps/api`, `apps/web`,
rama `main`). El VPS es compartido con ArtisanalBrew en producción: el deploy
nunca reinicia el servidor, nunca toca `/opt/artisanalbrew` salvo añadir el
bloque Caddy documentado, y nunca usa comandos destructivos de volúmenes
(`down -v` prohibido).

## 1. Workflows

| Archivo | Disparo | Propósito |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `push` y `pull_request` a `main` | Instalar, generar Prisma Client, typecheck estricto, `check:foundation`, tests unitarios de api/web y `test:integration` contra PostgreSQL 18 efímero del runner |
| `.github/workflows/deploy.yml` | CI en verde sobre `main` (`workflow_run` completado con éxito) + `workflow_dispatch` manual | Despliegue por SSH al VPS |

`deploy.yml` usa `workflow_run` en lugar de un `push` paralelo al CI: el
efecto pedido ("push a main condicionado a que el CI pase") se cumple sin la
carrera de desplegar código no probado. Si el CI falla, el deploy no se
ejecuta (fail-safe). Cada paso del script remoto lleva `set -euo pipefail`:
cualquier fallo detiene el deploy con código de error.

## 2. GitHub Repository Secrets

Configurar en `Settings > Secrets and variables > Actions > New repository secret`:

| Secreto | Valor |
| --- | --- |
| `SSH_HOST` | `209.23.11.117` (IP del VPS) |
| `SSH_USER` | `root` o `artisanalbrew` (el usuario donde esté instalada la clave pública) |
| `SSH_PRIVATE_KEY` | Clave privada Ed25519 completa (líneas `-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END OPENSSH PRIVATE KEY-----`) |
| `SSH_PORT` | `22` |

Cero secretos en el repositorio: ninguna contraseña, token ni clave privada
vive en el código ni en los commits. Los tests de CI usan credenciales
efímeras del contenedor (`postgres/postgres`), nunca datos de producción.

Para crear la clave (en tu máquina, fuera del repo):

```sh
ssh-keygen -t ed25519 -f ~/.ssh/private_chat_atlantic_ed25519 -C "private-chat-deploy" -N ""
# Pública al VPS (una sola vez, con tu acceso administrativo actual):
ssh-copy-id -i ~/.ssh/private_chat_atlantic_ed25519.pub artisanalbrew@209.23.11.117
# Privada a GitHub: pega el contenido de ~/.ssh/private_chat_atlantic_ed25519 en SSH_PRIVATE_KEY.
```

Verifica la huella del host por la consola de Atlantic.net antes de confiar
en la primera conexión (ver `docs/ATLANTIC-ACCESS.md`). El workflow usa
`StrictHostKeyChecking=accept-new`: registra la huella al primer deploy y
falla ante cambios posteriores.

## 3. Servidor: estructura previa al primer deploy automático

Ejecutar una sola vez con acceso administrativo:

```sh
# 1. Directorio propio del chat (aislado de /opt/artisanalbrew).
sudo mkdir -p /opt/private-chat
sudo chown artisanalbrew:artisanalbrew /opt/private-chat
cd /opt/private-chat

# 2. Código.
git clone <URL-del-repo> .
git checkout main

# 3. Variables (sin secretos): dominio real del chat.
cp .env.example .env
# Editar .env → DOMAIN=marthi.alexisrs.dev (más ADMIN_USERNAME/PARTNER_USERNAME si aplica).

# 4. Red externa del proxy existente (nombre por defecto del overlay).
docker network ls | grep -E 'artisanalbrew_default|caddy' || true
# Si el proxy usa otra red: export ATLANTIC_CADDY_NETWORK=<red> (ver compose.atlantic.yaml).

# 5. Secretos del runtime (Node 24 necesario para los helpers).
npm run secrets:init   # crea .secrets/ 0700 con db_owner_password, db_app_password,
                       # cookie_secret, csrf_secret, backup_password, backup_repository

# 6. Archivos manuales (contrato v2, nunca en el repo, permiso 600):
printf '1234\n' > .secrets/admin_pin && chmod 600 .secrets/admin_pin
printf 'tu-respuesta-secreta\n' > .secrets/guest_setup_secret && chmod 600 .secrets/guest_setup_secret
# Editar .secrets/backup_repository con el destino SFTP real y preparar
# .secrets/backup-ssh/ antes de usar respaldos (ver docs/ATLANTIC.md).

# 7. Primera subida manual (misma receta que corre el CD después):
docker compose -f compose.yaml -f compose.atlantic.yaml --profile tools config --quiet
docker compose -f compose.yaml -f compose.atlantic.yaml --profile tools build api web bootstrap
docker compose -f compose.yaml -f compose.atlantic.yaml up -d postgres storage-init
docker compose -f compose.yaml -f compose.atlantic.yaml --profile tools run --rm bootstrap
docker compose -f compose.yaml -f compose.atlantic.yaml up -d api web
```

A partir de aquí, cada `push` a `main` con CI verde despliega solo.

Si el VPS tiene `.secrets/kimi_api_key` y el código incluye `compose.assistant.yaml`, el workflow añade ese overlay a todos los comandos Compose. El contexto privado permanece fuera del checkout, referenciado por `ASSISTANT_CONTEXT_HOST_FILE` en `.env`. Las claves y el contexto no se suben a GitHub. `ASSISTANT_ENABLED=false` permite deshabilitar la integración conservando los archivos privados. Ver [Alexis AI](ASSISTANT.md).

## 4. Qué hace el CD en el servidor

1. `cd /opt/private-chat`, `git fetch origin main` y comprobar que el historial
   local es antecesor de `origin/main`. Si diverge, detenerse sin cambiar el
   árbol de trabajo. Si hay código modificado o archivos no rastreados,
   conservarlos con `git stash push --include-untracked`, registrar el ID y
   ejecutar `git merge --ff-only origin/main`. Los archivos ignorados (`.env`,
   `.secrets`, datos) permanecen intactos. El stash se conserva sin reaplicarlo:
   producción usa el código publicado. Revisar copias con `git stash list`
   y `git stash show --include-untracked <ID>`; recuperarlas en una copia
   separada para no ensuciar de nuevo el checkout de producción.
2. `docker compose -f compose.yaml -f compose.atlantic.yaml --profile tools build api web bootstrap`.
3. `up -d postgres storage-init` (datos en volúmenes propios: `postgres_data`,
   `uploads`, `deletion_journal`).
4. `--profile tools run --rm bootstrap` (migraciones + provisión idempotente).
5. `up -d api web` (recrea contenedores, redes propias + red externa del proxy).
6. Salud: `exec` en el contenedor `api` contra `http://127.0.0.1:3000/api/ready`
   con reintentos 120 s. Nota: el enunciado original pedía
   `http://127.0.0.1:3000/health/ready`, endpoint que no existe; el endpoint
   real es `/api/ready` (liveness: `/api/health`, ver `apps/api/src/http/app.ts`
   y el `healthcheck` de `compose.yaml`). Además el `curl` directo desde el
   host no funciona en el overlay Atlantic porque el API no publica puertos;
   por eso el chequeo corre dentro del contenedor.
7. Caddy: si `marthi.alexisrs.dev` no está en `/opt/artisanalbrew/Caddyfile`,
   añade el bloque de `infra/Caddyfile.atlantic`; luego sólo
   `caddy validate` + `caddy reload` en el contenedor del proxy
   (`artisanalbrew-caddy-1`, ajustable con `CADDY_CONTAINER`). Nunca reinicia
   el proxy, nunca toca las rutas de `cafe.alexisreyna.dev`.

## 5. Bloque Caddy para `marthi.alexisrs.dev`

Vive en `infra/Caddyfile.atlantic` (fuente de verdad). El CD lo añade al
Caddy del host; el operador puede hacerlo a mano igual:

```sh
cat infra/Caddyfile.atlantic >> /opt/artisanalbrew/Caddyfile
docker exec artisanalbrew-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec artisanalbrew-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

El bloque publica `/api/*` y `/socket.io/*` hacia `private-chat-api:3000` y el
resto hacia `private-chat-web:8080`, con TLS automático y CSP propia.

## 6. Operación y límites

- Concurrencia: un solo deploy de producción a la vez (`concurrency:
  production-deploy`).
- Rollback de datos: no existe rollback automático; una migración no es
  reversible restaurando backups antiguos sin análisis (ver docs/ATLANTIC.md).
- Probar primero en entorno aislado, respaldar antes de desplegar cambios de
  schema, y verificar login de ambas cuentas tras cada deploy.
- Reintento manual: pestaña Actions → Deploy → Run workflow.
