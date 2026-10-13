# Private Chat

Integración opcional de respuestas automáticas con Kimi K2.6: [Alexis AI](docs/ASSISTANT.md). Desactivada por defecto; contexto personal y clave únicamente en archivos privados del servidor.

Chat web privado para exactamente dos cuentas: administrador y miembro, sin registro público, una conversación, PostgreSQL, perfiles editables y borrado de mensajes propios para ambos; el administrador también puede borrar mensajes ajenos individualmente. Ambas cuentas pueden vaciar el historial tras confirmar con el fueguito. Interfaz móvil/desktop inspirada en `docs/reference.png`.

**Estado:** frontend y backend integrados y funcionando contra PostgreSQL local, incluido el rol restringido y WebSocket real. La conversación ocupa toda la pantalla; escritorio tiene una barra lateral de iconos de 72 px. El despliegue y la ejecución Docker/PostgreSQL 18 siguen pendientes. El registro de pruebas está en [docs/STATUS.md](docs/STATUS.md).

## Reparto del trabajo

| Modelo | Prompt | Archivos |
| --- | --- | --- |
| Principal | [01-principal](docs/prompts/01-principal.md) | raíz, contratos, infra, scripts, integración |
| Frontend | [02-frontend](docs/prompts/02-frontend.md) | apps/web, su informe |
| Backend | [03-backend](docs/prompts/03-backend.md) | apps/api, su informe |

Abrir las tres sesiones en este mismo proyecto y pegar el prompt correspondiente. Cada modelo lee [AGENTS.md](AGENTS.md) y [contrato v1](docs/CONTRACT.md). El principal instala dependencias y es dueño del lockfile. Los otros dos terminan sus componentes y entregan informes en `docs/handoffs/`. No se requieren sesiones adicionales.

## Base local

Se necesitan Node 24 LTS, npm 11+ y Docker con Compose v2 para PostgreSQL. Este entorno tiene Node 26 y npm 11; Docker no está instalado. No se modificó la caché global npm que tiene archivos de otro propietario: se usa `.npm-cache/`, ignorada por Git y Docker.

```sh
npm ci --cache .npm-cache
npm run check:foundation
npm run secrets:init
docker compose -f compose.dev.yaml up -d
```

Inicializar y abrir ambos componentes:

```sh
npm run db:local
npm run dev:api
```

En otra terminal, `npm run dev:web`. Entrar en `http://127.0.0.1:5173`; Vite proxyará API y Socket.IO. La provisión pide por terminal las dos contraseñas iniciales con entrada oculta; no imprime contraseñas ni las genera en el frontend. Exigirá cambio al primer acceso. Los helpers locales separan rol propietario de rol runtime.

`npm run verify` ejecutará contratos, tipos, pruebas de ambos componentes, build y pruebas PostgreSQL reales. Exige `INTEGRATION_DATABASE_URL` para una base exclusiva de pruebas y falla si falta código o configuración: no marca como exitosas pruebas que no pudo ejecutar. El backend describe en su informe cómo preparar esa base sin tocar datos de uso.

También existe `npm run verify:local` para PostgreSQL nativo: prepara un cluster exclusivo bajo `.data/postgres-integration`, loopback 55432, y pasa el DSN a las pruebas sólo en memoria. No modifica la instancia existente. Se probó la preparación con PostgreSQL 16.15; la ejecución en contenedores PostgreSQL 18 es una verificación posterior. Para detener sólo ese cluster: `npm run test:db:stop`.

Para una vista previa con datos sintéticos, después de `test:db:start` y `build`, ejecutar `npm run preview:local` y, en otra terminal, `npm run dev:web`. Este helper usa exclusivamente `private_chat_preview` en el cluster de QA 55432, sin datos de producción. No ejecutar verificaciones destructivas sobre bases de uso. La vista previa exige que el puerto 3000 esté libre y no reemplaza contraseñas de cuentas existentes.

## Producción y recuperación

Seguir [Atlantic.net](docs/ATLANTIC.md). Incluye Docker Compose, Caddy/HTTPS, redes internas, secretos, bootstrap y respaldo/restauración aislada. El código no contiene dominio real ni acceso a un VPS y no se ha desplegado.

El MVP cifra el transporte con HTTPS y usa backups cifrados. **No tiene cifrado de extremo a extremo:** el servidor puede leer los mensajes. Se pueden enviar fotos JPEG/PNG/WebP de hasta 5 MiB desde el icono de imagen, con vista previa y texto opcional. También admite videos (50 MiB / 180 s) y notas de voz grabadas (10 MiB / 180 s), con revisión antes de enviar. La interfaz vuelve al blanco original, con modo nocturno opcional, globos morados y colores configurables. Ajustes ocupa toda la pantalla, conserva temas y fuentes, y permite cambiar el fondo por cuenta y navegador. E2EE y llamadas siguen fuera del alcance. El borrado elimina contenido activo y usa un journal sin texto para reconciliar copias antiguas; no borra capturas ni copias hechas por los usuarios.

Referencias: [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/), [imagen PostgreSQL 18 y volúmenes](https://hub.docker.com/_/postgres), [Caddy HTTPS](https://caddyserver.com/docs/quick-starts/https), [restic](https://restic.readthedocs.io/en/stable/).
