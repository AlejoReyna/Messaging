# Telegram UI, notas de voz y fondo — 2026-10-12

Implementación coordinada por tres modelos según AGENTS.md. Contrato v7, DTO y endpoints compartidos establecidos antes de las apps. Se conservan las dos cuentas, conversación única y permisos existentes. Sin dependencias npm nuevas ni cambios de lockfile. Los archivos preexistentes `hero/` y las propuestas de tipografías no se tocaron.

- UI Telegram Dark y fuente Inter predeterminadas; preferencias anteriores conservadas. Barra lateral con único chat en escritorio, navegación Chat/Ajustes en móvil, cabecera/compositor redondeados, mensajes y perfil agrupado. Las opciones existentes de temas/fuentes siguen disponibles.
- Micrófono por acción explícita, contador, parar, vista previa local, Enviar/Cancelar y limpieza de pistas/blobs al salir. Tope 10 MiB/180 s (grabación se detiene con margen para codificación). Notas privadas normalizadas a M4A AAC, reproducción sin autoplay, citas, estados y reintentos manuales.
- Fondo por cuenta y navegador: cinco presets o JPEG/PNG/WebP de hasta 5 MiB/16 millones de píxeles, preview y guardado local IndexedDB. No se envía al servidor ni se comparte con la otra cuenta.
- Migración aditiva 0007; hashes/bytes/duración privados y exclusión de adjuntos. Idempotencia, CSRF, sesiones vigentes, bloqueo de conversación, tombstones y journal conservados. Proxy audio 11 MiB y microphone=(self).

## Verificación ejecutada

- `npm run check:foundation`: contratos 9/9 y scripts 6/6.
- `npm run typecheck`: tres workspaces y generación Prisma OK.
- `npm run build`: contratos, API y web OK.
- API unit: 39/39; frontend: 99/99, 16 archivos (ejecutados por los modelos propietarios).
- `npm run test:integration --workspace @private-chat/api`: suite completa OK contra PostgreSQL exclusivo `private_chat_integration`, loopback 55432. Cuatro escenarios de voz con HTTP, Socket.IO y FFmpeg reales: descarga privada/rangos/lectura, idempotencia/citas, entrada y permisos inválidos, borrado/vaciado/restauración reconciliada.
- `npm run test:runtime`: 3/3 OK. Dos cuentas con rol SQL runtime restringido; envío de voz, evento socket, retry sin duplicar, descarga autenticada/range, cita, reconexión, lectura, rechazo borrado ajeno, borrado propio y sesión revocada.
- `npm run infra:check` y `git diff --check`: OK.
- QA manual en Brave, viewport estrecho (~500 px CSS) y escritorio ampliado (~1440 px CSS), localhost con API y PostgreSQL de preview reales: UI chat/ajustes/sidebar/compositor sin desbordamiento visual. Preset Azul profundo y PNG propio de prueba seleccionados y guardados, ambos conservados tras recarga en IndexedDB. Se revisó la vista previa local y el botón Guardar antes de aplicar la imagen. Ventana restaurada y pestaña temporal cerrada al terminar.

No se grabó sonido del micrófono físico ni se declara una prueba en iPhone/Safari físico. Las pruebas MediaRecorder del frontend usan dobles; FFmpeg validó formatos reales WAV, MP3, Ogg/Opus, M4A y WebM/Opus sin cabecera de duración. Los detalles están en los informes frontend/backend.

## Despliegue

Actualizado exclusivamente `/opt/private-chat` en el VPS compartido de Atlantic.net. Se conservaron las cuentas y datos: la base sigue teniendo exactamente dos usuarios, con las tres columnas de audio nuevas. Se hicieron checkpoints de imágenes y respaldo privado local de PostgreSQL/journal/avatares con API detenida; no equivale a verificar backup cifrado externo. La primera ejecución SSH del respaldo consumió stdin y dejó temporalmente la API pausada; se completó el despliegue desde un archivo con stdin cerrado y se reanudó el servicio.

Docker build de API/web/bootstrap y bootstrap/migraciones ejecutados en el VPS; API y PostgreSQL healthy. Se validó Caddy y recargó sólo la configuración del bloque del chat, habilitando micrófono propio y subida audio 11 MiB. Los otros proyectos conservaron sus contenedores y uptime.

Smoke HTTPS público: web 200, `/api/ready` 200, descarga de audio anónima 401, Permissions-Policy microphone=(self), CSP media propia/blob y bundle v7 comprobados. Se corrigió el SVG del fondo que Vite inlineaba y CSP bloqueaba: `?no-inline` emite archivo del propio dominio; segundo build sólo web y descarga real del doodle 200 confirmados. Bundle final `index-C-nHS7hw.js` / `index-DuKMce5h.css`.

No se enviaron mensajes de prueba en producción ni se cambiaron credenciales. El flujo completo de dos usuarios y voz se comprobó en PostgreSQL aislado; en producción se verificó servicio, migración, archivos y protección anónima. No se hizo commit/push: el código está en el workspace y desplegado como cambios de trabajo en el VPS; CI futuro requiere integrar estos cambios al repositorio antes de publicar otra revisión.
