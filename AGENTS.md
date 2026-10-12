# Private Chat — coordinación de tres modelos

Objetivo autorizado: chat web privado para exactamente dos cuentas precreadas, una conversación, contraseñas individuales, PostgreSQL, nombres y fotos editables, borrado individual de mensajes propios para ambos, borrado individual de mensajes ajenos exclusivo del administrador y vaciado con confirmación disponible para ambas cuentas (autorizado por el usuario el 2026-10-12), UI responsive inspirada en `docs/reference.png` y despliegue en un VPS de Atlantic.net.

Lee `docs/CONTRACT.md` y `packages/contracts/src/index.ts` antes de implementar. Son la fuente de verdad; no inventes endpoints ni cambies DTO sin coordinación.

## Propiedad de archivos

- Principal: raíz, `packages/contracts/**`, `infra/**`, `scripts/**`, `docs/**`, excepto los dos informes que siguen.
- Modelo frontend: `apps/web/**` y `docs/handoffs/frontend.md`.
- Modelo backend: `apps/api/**` y `docs/handoffs/backend.md`.
- Los manifiestos iniciales dentro de cada app pertenecen al modelo de esa app desde la entrega del prompt.
- Sólo el principal instala dependencias o modifica `package-lock.json`. Solicita cambios en tu informe; continúa el trabajo que no dependa de ellos.
- No borres, sobrescribas ni reviertas trabajo de otro modelo. No uses `git reset --hard`, `git clean`, force push ni commits de toda la carpeta. Si haces commits, incluye exclusivamente tus archivos.
- No generes otra aplicación completa dentro de tu carpeta. Implementa tu componente del monorepo.
- No delegues a más agentes: el equipo acordado tiene tres modelos.

## Alcance y seguridad

MVP: texto y emojis, fotos en mensajes (elegidas explícitamente por el usuario), respuestas citadas, perfiles, historial persistente, estados de envío/lectura, reconexión, escritura/presencia, borrado individual de mensajes propios y administración del borrado. Las llamadas, los audios, otros adjuntos y el cifrado de extremo a extremo están fuera de este MVP hasta que el usuario los elija. No presentes HTTPS como cifrado de extremo a extremo.

Contraseñas Argon2id, sesiones opacas revocables en cookies HttpOnly/Secure/SameSite, CSRF, Origin estricto para sockets y autorización del lado servidor. Sin registro público, secretos en frontend, JWT en localStorage, contraseñas en logs, contenido de mensajes en logs ni datos de producción inventados.

Las pruebas deben comprobar permisos reales, sesiones y consistencia de mensajes. No simules resultados de pruebas ni declares integración/despliegue verificados si no se ejecutaron.

## Finalización

Cada modelo trabaja hasta terminar su componente, corrige errores y deja un informe con archivos, comandos ejecutados, resultados, dependencias y limitaciones. La aplicación completa sólo queda terminada cuando el principal integra ambos componentes y verifica el flujo real de dos usuarios contra PostgreSQL. Una infraestructura o una maqueta aislada no equivalen al producto terminado.
