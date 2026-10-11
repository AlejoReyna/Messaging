# Instalación en Atlantic.net

Aplicar después de integrar ambos componentes y aprobar pruebas PostgreSQL. El despliegue completo aún requiere verificar el flujo real de ambos usuarios en el VPS. No se insertan credenciales en este documento.

## Preparación

Un VPS Ubuntu LTS con Docker Engine y Compose v2, DNS A/AAAA del dominio apuntando al servidor, SSH por claves y firewall. Permitir 80/443; SSH restringido a la administración. Los puertos 3000/5432 no se publican en producción. Verificar también reglas de Docker: no confiar sólo en UFW si posteriormente se añaden ports.

El usuario eligió el VPS compartido `ArtisanalBrew` y pidió conservar sus otros despliegues. El Compose base del chat publica 80/443; en ese VPS se debe usar el overlay `compose.atlantic.yaml`, que quita esos puertos y conecta sólo API/web a la red ya usada por Caddy. El nombre predeterminado es `artisanalbrew_default`; si el proxy usa otra red, establecer `ATLANTIC_CADDY_NETWORK`. Consultar [el estado del acceso y la compatibilidad](ATLANTIC-ACCESS.md). No detener ni reemplazar el proxy activo para liberar esos puertos.

Subir/obtener este repositorio, instalar Node 24/npm 11 si se usarán los helpers en el host y copiar `.env.example` a `.env`. Cambiar DOMAIN al dominio real y elegir usernames iniciales distintos. `.env` no contiene secretos.

Para `ArtisanalBrew`, usar estos comandos desde `/opt/private-chat`:

```sh
docker compose -f compose.yaml -f compose.atlantic.yaml --profile tools config --quiet
docker compose -f compose.yaml -f compose.atlantic.yaml --profile tools build api web bootstrap
docker compose -f compose.yaml -f compose.atlantic.yaml up -d postgres storage-init
docker compose -f compose.yaml -f compose.atlantic.yaml --profile tools run --rm bootstrap
docker compose -f compose.yaml -f compose.atlantic.yaml up -d api web
docker compose -f compose.yaml -f compose.atlantic.yaml ps
```

Después de confirmar que API/web están saludables, agregar el bloque de `infra/Caddyfile.atlantic` al archivo existente `/opt/artisanalbrew/Caddyfile`; no reemplazarlo. Validar y recargar sólo la configuración del proxy, sin reiniciar el contenedor:

```sh
docker exec artisanalbrew-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec artisanalbrew-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

El overlay no publica puertos del chat en el host; el tráfico público entra por el Caddy existente y usa TLS automático para el dominio configurado.

Bootstrap ejecuta migraciones, provisión de dos cuentas y permisos del runtime, en ese orden. Las contraseñas iniciales se introducen mediante entrada oculta. Repetir no modifica cuentas existentes. Nunca poner contraseñas en argumentos, archivos versionados ni chats. Verificar login de ambas cuentas, cambio inicial obligatorio, mensajes, perfiles y borrado de mensajes propios por el invitado y denegación de borrado de mensajes ajenos/vaciado para el miembro.

`.secrets` es 0700. Los archivos montados son 0444 para que el usuario no-root del contenedor pueda leerlos; la carpeta privada del host impide acceso a otros usuarios. Sólo los servicios autorizados reciben cada archivo. El API no recibe la contraseña propietaria. Compose secrets son archivos montados, no una bóveda que cifre archivos del host: proteger el disco/VPS y conservar una copia segura externa de claves de recuperación.

PostgreSQL 18 monta `/var/lib/postgresql`. Avatares y journal usan volúmenes separados. El API es no-root y tiene filesystem de sólo lectura salvo volúmenes y tmpfs. Caddy obtiene/renueva certificados y persiste su estado. El frontend usa recursos del mismo dominio y CSP sin scripts/styles inline ni terceros.

## Respaldos cifrados fuera del VPS

Configurar `.secrets/backup_repository` con `sftp:backup@HOST_REAL:/ruta/privada`. Preparar una clave SSH exclusiva en `.secrets/backup-ssh/id_ed25519`, permisos 0600, y `known_hosts` con la clave del servidor verificada por otro canal. No incluir passwords en la URL. Conservar `backup_password` fuera del VPS de forma privada: perderla impide descifrar backups. No rotarla con secrets:init.

```sh
docker compose --profile ops build backup
docker compose --profile ops run --rm --no-deps backup init
npm run backup
docker compose --profile ops run --rm --no-deps backup snapshots
docker compose --profile ops run --rm --no-deps backup check
```

`npm run backup` construye primero la herramienta, comprueba que el API estaba activo, lo detiene brevemente, hace pg_dump y un snapshot restic de DB/avatares/journal coherentes, y vuelve a iniciarlo incluso si falla el respaldo. No cambia el estado de una instalación que ya estaba parada. Habrá una interrupción breve del chat; los clientes deben reconectar. Staging en tmpfs 256 MiB, ampliable según crezca el historial. Si se llena, el comando falla y no presenta el respaldo como completo.

Programar este helper diariamente con un timer del sistema, ruta absoluta del proyecto y alerta por exit code distinto de cero. Objetivo inicial de recuperación: hasta 24 h de mensajes ante pérdida del servidor. Comprobar periódicamente `check` y una restauración real. La retención propuesta es siete días; primero revisar y después aplicar:

```sh
docker compose --profile ops run --rm --no-deps backup retention-preview
docker compose --profile ops run --rm --no-deps backup retention-apply
```

Restic cifra los snapshots. La retención limita qué copias se pueden consultar pero no equivale a borrado físico forense de todos los bloques del proveedor. El borrado en la aplicación y la reconciliación del journal evitan que un snapshot antiguo vuelva a publicar texto borrado.

## Restaurar sin sobrescribir producción

Mantener la API detenida durante una recuperación final y conservar el journal actual antes de tocar volúmenes. Seleccionar un ID explícito, no `latest` automático. `.data/restore` debe estar vacío; el helper rechaza sobrescribir archivos existentes.

```sh
docker compose --profile ops run --rm --no-deps backup restore-files ID_DEL_SNAPSHOT
docker compose -f compose.restore.yaml up -d restore-postgres
docker compose -f compose.restore.yaml run --rm restore-loader
docker compose -f compose.restore.yaml run --rm restore-reconcile
```

El loader exige `restore-postgres/private_chat_restore`, sin puertos ni API, y una base vacía. No usa --clean ni DROP de producción. La reconciliación usa `RECOVERY_MODE=true` y el journal vivo externo `private-chat_deletion_journal`, montado read-only, en vez de sustituirlo por el journal antiguo del snapshot. Falla si falta ese journal o está corrupto; elimina sesiones restauradas y preserva el archivo original. La carga del dump es transaccional. Estas propiedades del CLI se probaron con PostgreSQL nativo; el flujo completo de contenedores todavía debe ejecutarse en el VPS.

Después, comprobar historial/ausencia de mensajes borrados, perfiles, migraciones y roles en la base aislada. Sólo entonces preparar el cambio a producción y recuperar avatares coherentes. La promoción final se hace explícitamente durante mantenimiento; no hay script que sobrescriba automáticamente la base activa. Confirmar que no quedan sesiones restauradas antes de reabrir. En cada arranque normal, la API reconcilia pendientes antes de abrir HTTP; inicializa un journal vacío únicamente si la base no tiene borrados previos.

Ante pérdida completa del VPS, el journal del último backup diario puede estar incompleto respecto de borrados posteriores. Se necesita una copia actual íntegra, por ejemplo replicación del journal a almacenamiento externo durante cada borrado. Esta primera infraestructura no implementa esa replicación continua. No prometer restauración sin resurrecciones después de perder simultáneamente servidor y journal; mantener la recuperación cerrada si no puede verificarse ese estado.

## Actualizaciones

Probar primero en entorno aislado. Respaldar, detener API, obtener código revisado, construir imágenes, ejecutar bootstrap/migraciones con el propietario y arrancar API/web. Verificar readiness, login y flujo de ambos usuarios. Un rollback de imágenes requiere compatibilidad con migraciones; no restaurar datos antiguos automáticamente como rollback. Actualizar imágenes parcheadas y revisar dependencias sin saltar a versiones RC.

No usar `docker compose down -v`: eliminaría volúmenes. La receta no necesita ese comando. Los informes de pruebas, infraestructura y contrato deben reflejar las versiones realmente verificadas.

Fuentes técnicas: [secretos Compose](https://docs.docker.com/compose/how-tos/use-secrets/), [PostgreSQL Docker](https://hub.docker.com/_/postgres), [backup restic](https://restic.readthedocs.io/en/stable/040_backup.html), [restore restic](https://restic.readthedocs.io/en/stable/050_restore.html), [retención restic](https://restic.readthedocs.io/en/stable/060_forget.html).
