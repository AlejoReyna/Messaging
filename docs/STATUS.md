# Estado verificable del proyecto

Actualizado 2026-10-10 por el principal. Frontend y backend entregados e integrados. El MVP funciona con PostgreSQL local y dos cuentas de QA; no está desplegado en Atlantic.net.

## Implementado

- Tres prompts autocontenidos, ownership, contrato HTTP/Socket.IO/Zod y referencia visual.
- Frontend responsive, contraseña inicial obligatoria, perfiles/fotos, conversación persistente, reconexión, presencia/escritura/lectura y borrado exclusivo del admin.
- Ajuste solicitado: conversación a 100dvh, sin márgenes exteriores ni esquinas redondeadas del contenedor; escritorio con rail de 72 px e iconos; móvil sin rail. Historial con scroll propio y compositor visible. Avatares sin estilos inline, compatibles con CSP.
- API Fastify/Prisma/PostgreSQL, dos slots con roles fijos y sin registro. Contraseñas Argon2id, cookies HttpOnly/Secure en producción, CSRF, autorización server-side y WebSocket con Origin exacto. Revalidación de sesiones por acción y expiración de sockets.
- Journal estricto, intenciones validadas/capturadas bajo lock, recuperación antes de abrir HTTP, recuperación read-only con revocación de sesiones, tombstones y auditoría sin texto. Borrados rechazados no se ejecutan al reiniciar; el vaciado no elimina mensajes posteriores a sus IDs capturados.
- Infraestructura Compose Node24/PostgreSQL18/Caddy, roles separados, secretos, generación Prisma explícita, bootstrap con *_FILE y contraseña APP separada del OWNER, backups cifrados externos y recuperación aislada.
- Helper PostgreSQL nativo de integración en cluster exclusivo loopback55432; preview QA separada en private_chat_preview, API loopback3000, frontend loopback5173. No se modificó otra instancia existente por los helpers del principal.

## Resultados ejecutados

`npm run verify:local` PASÓ con Node26.10.0 y PostgreSQL16.15:

- Contratos: 6/6.
- Infraestructura, secretos y bootstrap: 6/6.
- Backend unitarias: 25/25.
- Frontend: 26/26.
- API con PostgreSQL real: 35/35.
- Integración adicional con rol restringido y WebSocket real: 1/1; ambos usuarios, cambio de contraseña, permisos SQL, envío/reintento sin duplicados, perfil, borrado admin, miembro bloqueado y sesión revocada.
- Total: **99/99**, cero omisiones. Tipos y builds de ambos componentes OK.
- `infra:check` y pruebas de scripts posteriores OK. `npm audit --omit=dev`: cero vulnerabilidades reportadas.
- Vista previa QA arrancada realmente con migraciones/seed/grants y API usando private_chat_app. Safari abrió login y el usuario confirmó acceso/envío con captura. La revisión visual completa del ajuste fullscreen móvil/desktop sigue pendiente; no se presenta como aprobada por pruebas unitarias.

## Pendiente para producción

- Docker no está instalado en este entorno: Compose config/build/arranque y PostgreSQL18/Node24 no ejecutados. Tampoco backups/restores completos en contenedores.
- Verificar diseños a 360/390 y 1280/1440 px con el ajuste final, teclado móvil y flujo de ambos usuarios en navegador.
- Dominio/acceso al VPS Atlantic.net y repositorio externo de backups no proporcionados. Configurar esos datos y ejecutar docs/ATLANTIC.md antes de considerar producción lista.

MVP de texto/emojis y fotos de perfil, **sin E2EE**, llamadas ni adjuntos. No hay replicación continua del journal fuera del VPS; recuperación sin resurrecciones exige conservar una copia actual íntegra. No se promete esa garantía tras perder simultáneamente servidor y journal.
