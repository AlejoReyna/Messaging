# Estado verificable del proyecto

Actualizado 2026-10-11 por el principal. Frontend y backend integrados y publicados en Atlantic.net, en `https://marthi.alexisrs.dev/`. El flujo autenticado de pruebas usa dos cuentas de QA y PostgreSQL exclusivo; no se crean datos de prueba en producción.

## Implementado

- Tres prompts autocontenidos, ownership, contrato HTTP/Socket.IO/Zod y referencia visual.
- Frontend responsive, contraseña inicial obligatoria, perfiles/fotos, conversación persistente, reconexión, presencia/escritura/lectura y borrado individual de mensajes propios para ambos; borrado de mensajes ajenos y vaciado exclusivo del admin.
- Ajuste solicitado: conversación a 100dvh, sin márgenes exteriores ni esquinas redondeadas del contenedor; escritorio con rail de 72 px e iconos; móvil sin rail. Historial con scroll propio y compositor visible. Avatares sin estilos inline, compatibles con CSP.
- API Fastify/Prisma/PostgreSQL, dos slots con roles fijos y sin registro. Contraseñas Argon2id, cookies HttpOnly/Secure en producción, CSRF, autorización server-side y WebSocket con Origin exacto. Revalidación de sesiones por acción y expiración de sockets.
- Journal estricto, intenciones validadas/capturadas bajo lock, recuperación antes de abrir HTTP, recuperación read-only con revocación de sesiones, tombstones y auditoría sin texto. Borrados rechazados no se ejecutan al reiniciar; el vaciado no elimina mensajes posteriores a sus IDs capturados.
- Infraestructura Compose Node24/PostgreSQL18/Caddy, roles separados, secretos, generación Prisma explícita, bootstrap con *_FILE y contraseña APP separada del OWNER, backups cifrados externos y recuperación aislada.
- Helper PostgreSQL nativo de integración en cluster exclusivo loopback55432; preview QA separada en private_chat_preview, API loopback3000, frontend loopback5173. No se modificó otra instancia existente por los helpers del principal.

## Verificación del borrado propio — 2026-10-11

- `npm run verify:local`: 136/136, cero omisiones; tipos y builds correctos. Contratos 6, base 6, backend unitarias 25, frontend 51, API PostgreSQL 45 y runtime PostgreSQL/WebSocket 3.
- Invitado borra su mensaje para ambos; mensajes ajenos y vaciado devuelven 403. Se verifican autoría, CSRF, sesiones, journal sin texto, auditoría, concurrencia, tombstones y evento recibido por ambas cuentas mediante WebSocket real.
- Build Docker API/web y actualización de ambos servicios en el VPS correctos (Node24.21.0); PostgreSQL y proyectos vecinos siguen activos. Web/ready públicos 200; historial y borrado anónimos 401. Recursos publicados y autorización del contenedor confirmados.
- El flujo de dos usuarios se probó en QA; falta una nueva revisión visual y prueba manual autenticada en producción. Detalles en `docs/handoffs/principal.md`.

## Resultados históricos — 2026-10-10

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

- Docker no está instalado localmente. En el VPS se ejecutaron config/build/arranque API/web con Node24 y PostgreSQL18 existente saludable. Backups/restores completos en contenedores siguen como verificación separada.
- Verificar diseños a 360/390 y 1280/1440 px con el ajuste final, teclado móvil y flujo de ambos usuarios en navegador.
- Dominio y acceso Atlantic.net configurados; verificar por separado la configuración/recuperación de respaldos externos antes de considerar cerrada la operación de producción.

MVP de texto/emojis y fotos de perfil, **sin E2EE**, llamadas ni adjuntos. No hay replicación continua del journal fuera del VPS; recuperación sin resurrecciones exige conservar una copia actual íntegra. No se promete esa garantía tras perder simultáneamente servidor y journal.


## Foto del contacto — 2026-10-11

Vista circular ampliada al pulsar la foto del contacto, con el mismo contenedor visual que la propia y sin controles de modificación. Frontend 54/54 y build/TypeScript correctos. Cambio publicado reconstruyendo sólo web; web/ready 200 y nuevos recursos confirmados. No hay cambios API/DB; revisión visual autenticada pendiente. Informe en `docs/handoffs/principal.md`.

## Stickers y fotos — 2026-10-11

Stickers Chiikawa (40, selector con preview/Enviar, borrador conservado) y fotos por mensaje (icono, preview, texto opcional, ampliación) verificados: `npm run verify:local` **154/154**, cero omisiones. Se corrigió el test de typing por polling (racy, sin cambios de producto). Despliegue al VPS pendiente; revisión visual en navegador pendiente.

## Publicación CI/CD — 2026-10-11

Commit `89d4de1` publicado por el flujo CI/CD (CI + Deploy verdes): stickers, fotos, borrado propio y migración 0003 en producción, web/ready 200 y base de datos intacta.

## Respuestas citadas — 2026-10-11

Responder con cita (botón por burbuja, preview cancelable, salto al original) para texto, stickers y fotos, contrato v4 y migración 0004. `npm run verify:local` 163/163. Publicación por CI/CD pendiente.
