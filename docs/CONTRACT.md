# Contrato común v7

## Producto

Aplicación web privada en español, exactamente dos cuentas creadas por una operación administrativa de instalación. Cuenta 1: `admin`; cuenta 2: `member`. Una conversación permanente. Identidad interna estable aunque cambie el nombre de usuario. Ambos pueden editar exclusivamente su propio perfil y contraseña. Cada cuenta puede borrar sus propios mensajes individualmente para ambos. El administrador puede además borrar cualquier mensaje o vaciar el historial para ambos. El invitado no puede borrar mensajes ajenos ni vaciar la conversación; no hay límite temporal para el borrado propio.

El MVP incluye texto/emojis, fotos, videos y notas de voz en mensajes, avatares y avisos push genéricos opt-in (v5, sólo “Nuevo mensaje”, sin texto). No incluye registro, nuevos contactos, grupos, llamadas de voz/vídeo, otros adjuntos ni cifrado de extremo a extremo. HTTPS protege el transporte; el servidor puede leer el texto del MVP. El push vacío pasa por los servidores de Apple/Google sin contenido: sólo despierta al service worker, que pinta el aviso genérico local. No afirmar privacidad frente al operador del servidor. No usar servicios externos para los datos del chat salvo el transporte push vacío (sin contenido).

Apariencia actual (2026-10-12): recuperar la distribución blanca que estaba publicada la mañana del 2026-10-11: fondo liso, cabecera sencilla y barra lateral estrecha. Blanco original es el tema inicial de ambas cuentas, con modo nocturno opcional y globos propios morados. Se conservan todas las paletas existentes, incluidas GitHub Light/Dark y Solarized Light/Dark, y se añade Pinkie Pie con rosas, lavanda y menta pastel. En Pinkie Pie, los globos recibidos usan el mismo rosa que los propios según el tema y la cabecera es rosada; un color personalizado sólo cambia los propios. La presencia conectada siempre se indica en verde, independientemente del tema. Las cinco fuentes locales siguen disponibles. Ajustes ocupa toda la pantalla en móvil y escritorio; la barra superior permanece visible y ofrece Cerrar, además de Escape y navegación por teclado. Los globos propios permiten color según el tema, presets o color personalizado por selector o canales RGB (0–255), con texto de contraste automático; la preferencia se guarda por cuenta y navegador. Cambiar tema, color o fuente no modifica mensajes ni preferencias de la otra cuenta. La preferencia de tema usa la clave v2 para volver al blanco una vez y recordar posteriores elecciones; las fuentes conservan su preferencia anterior. Nombre y avatar propios editables; avatar ajeno ampliable sólo de lectura. El icono de vaciado es un fuego y abre una confirmación centrada: «¿Estás seguro?», «Esto borrará toda la conversación.», Aceptar y Cancelar. Entra desde abajo, desenfoca el fondo y sigue los colores elegidos. Sólo Aceptar ejecuta el borrado; Cancelar y Escape no lo ejecutan. Se mantienen audio, videos, fotos, respuestas, permisos y notificaciones existentes.

La tipografía predeterminada de toda la interfaz es Nunito, alojada localmente (Patrick Hand y las otras opciones siguen disponibles): acceso, chat, mensajes, botones, campos, ajustes y diálogos. El texto bajo la carita del estado vacío conserva su tamaño pequeño y el espaciado ligero de 0.04em.

Las cuentas nuevas se instalan con nombre Alexis (admin) y Marthiel (member) y las fotos iniciales suministradas por el usuario en `infra/profile/alexis.jpg` e `infra/profile/marthiel.png`. Los assets se incluyen únicamente en la herramienta privada de instalación. Las fotos actuales se sirven mediante el endpoint autenticado existente y se pueden cambiar o quitar; repetir la instalación conserva las decisiones posteriores. PostgreSQL guarda una sola referencia por cuenta, sin historial de imágenes. Cada reemplazo elimina el archivo anterior del almacenamiento activo, con exclusión entre procesos para las escrituras y limpieza de archivos huérfanos al arrancar. Las copias de seguridad mantienen su política de retención propia.

## Organización y comandos

Monorepo npm workspaces: `@private-chat/contracts`, `@private-chat/web`, `@private-chat/api`. Node 24 LTS en producción; ESM; TypeScript estricto. Raíz y lockfile del principal. Apps con scripts `dev`, `build`, `typecheck`, `test`; el backend añade `test:integration`, `db:migrate`, `db:seed`, `db:grant` y `db:reconcile-deletions`.

Todos importan tipos y validadores desde `@private-chat/contracts`. Schemas públicos y DTO en `packages/contracts/src/index.ts`. No exponer hash de contraseña, token de sesión, claves, ruta del disco ni credenciales. Todas las fechas son ISO-8601 UTC; el navegador las muestra en su zona horaria.

El build del backend genera Prisma Client y compila sin necesitar DB viva, contraseñas ni archivos secretos; la validación obligatoria de configuración ocurre en runtime/CLI que accede a DB. Vite debe proxyar `/api` y `/socket.io` a `http://127.0.0.1:3000` en desarrollo. Integración usa `INTEGRATION_DATABASE_URL` apuntando a una base exclusiva de pruebas. CSP de producción permite assets del propio dominio, sin scripts/styles inline, fuentes externas ni analítica.

## HTTP

Prefijo `/api`; JSON salvo upload/download. Las mutaciones llevan `X-CSRF-Token` y cookies (`credentials: include`). El token se obtiene al consultar la sesión, incluso antes del login. Login rota sesión y CSRF. Error uniforme: `{ "error": { "code": "...", "message": "Mensaje en español" } }`. Sin stack ni detalles internos.

| Método y ruta | Request | Response | Acceso |
| --- | --- | --- | --- |
| GET `/health` | — | `{status:"ok"}` | público; liveness |
| GET `/ready` | — | `{status:"ok"}` o 503 | público; comprobar PostgreSQL sin revelar detalles |
| GET `/auth/session` | — | `{user: PublicUser \| null, csrfToken: string}` | público |
| POST `/auth/login` | LoginInput | SessionResponse | público + CSRF; 200; sólo admin y member sin PIN (recuperación, sin UI) |
| GET `/auth/pin-status` | — | `{memberPinSet: boolean}` | público; indica si el invitado ya creó su código |
| POST `/auth/pin-setup` | PinSetupInput `{answer, pin}` | SessionResponse (member) | público + CSRF; 201 una sola vez; 409 si ya existe |
| POST `/auth/pin-login` | PinLoginInput `{pin}` | SessionResponse | público + CSRF; 200; el servidor decide la cuenta |
| POST `/auth/change-pin` | ChangePinInput | `{user: PublicUser}` | autenticado + CSRF |
| POST `/auth/logout` | `{}` | 204 | CSRF; idempotente |
| POST `/auth/change-password` | ChangePasswordInput | SessionResponse | autenticado + CSRF |
| PATCH `/users/me` | UpdateProfileInput | `{user: PublicUser}` | autenticado + CSRF |
| POST `/users/me/avatar` | multipart, campo `avatar` | `{user: PublicUser}` | autenticado + CSRF |
| DELETE `/users/me/avatar` | `{}` | `{user: PublicUser}` | autenticado + CSRF |
| GET `/users/:userId/avatar` | query `v` opcional | imagen o 404 | autenticado |
| GET `/conversation` | — | `{conversation, partner}` | autenticado |
| GET `/messages` | MessagesQuery | MessagesPage | autenticado |
| POST `/messages` | SendMessageInput | `{message: Message}` | autenticado + CSRF; 201 nuevo / 200 repetición idéntica |
| POST `/messages/photo` | multipart `photo`, `clientMessageId`, `conversationVersion`, `body` opcional | `{message: Message}` | autenticado + CSRF; 201 nuevo / 200 repetición idéntica |
| GET `/messages/:messageId/photo` | — | imagen WebP o 404 | autenticado |
| POST `/messages/video` | multipart `video`, `clientMessageId`, `conversationVersion`, `body` y `replyToMessageId` opcionales | `{message: Message}` | autenticado + CSRF; 201 nuevo / 200 repetición idéntica |
| GET `/messages/:messageId/video` | header `Range` opcional | MP4 200/206, 416 rango inválido o 404 | autenticado |
| POST `/messages/audio` | multipart `audio`, `clientMessageId`, `conversationVersion`, `body` y `replyToMessageId` opcionales | `{message: Message}` | autenticado + CSRF; 201 nuevo / 200 repetición idéntica |
| GET `/messages/:messageId/audio` | header `Range` opcional | M4A AAC (`audio/mp4`) 200/206, 416 rango inválido o 404 | autenticado |
| POST `/conversation/read` | MarkReadInput | ReadUpdatedEvent | autenticado + CSRF |
| DELETE `/messages/:messageId` | `{conversationVersion: number}` | MessageDeletedEvent | autor del mensaje o admin + CSRF |
| DELETE `/conversation/messages` | `{conversationVersion: number}` | ConversationClearedEvent | admin + CSRF |
| GET `/push/vapid-key` | — | `{publicKey: string \| null, enabled: boolean}` | público; clave VAPID y estado del push |
| POST `/push/subscriptions` | `{subscription: PushSubscription}` | `{saved: true}` | autenticado + CSRF; 201; reasigna el endpoint a la cuenta actual, tope 10 por cuenta |
| DELETE `/push/subscriptions` | `{endpoint: string}` | 204 | autenticado + CSRF; idempotente, sólo suscripción propia |

`mustChangePassword` permite únicamente sesión, logout y cambio de contraseña hasta completarlo. El resto responde 403 `PASSWORD_CHANGE_REQUIRED`. El acceso habitual de la UI es con PIN de 4 dígitos (contrato v2): hash Argon2id en `users.pin_hash`, 10 fallos globales → bloqueo 30 min (`PIN_LOCKED`), límite por IP y verificación de ambos slots sin oráculo. La pantalla inicial ofrece además una ruta de credenciales sólo para el administrador, dirigida al usuario configurado en `ADMIN_USERNAME`; así puede entrar antes de que el miembro cree su PIN. El alta del invitado (slot 2) ocurre una sola vez tras la pregunta secreta del servidor (`GUEST_SETUP_SECRET_FILE`, nunca en repo ni cliente); el PIN del admin se aprovisiona con `ADMIN_PIN_FILE`. La cuenta de invitado con PIN rechaza el login con contraseña (`PIN_REQUIRED`); aunque `/auth/login` admita la cuenta miembro antes de configurar su PIN, la UI no expone esa ruta. Username único, editable, ASCII 3–32 caracteres (`a-z`, `0-9`, `_`, `.`, `-`); normalizar a minúsculas. DisplayName 1–60; body 1–4000 tras trim; contraseña nueva 15–128 sin trim. Avatares JPEG/PNG/WebP de hasta 5 MiB, decodificados y reexportados con Sharp a formato seguro, sin EXIF. Nunca aceptar SVG ni construir rutas del disco desde nombres aportados por el cliente.

`MessagesQuery`: `limit` 1–100 (default 50), `before` o `after` por sequence, nunca ambos. Historial inicial devuelve los últimos N, ordenados ascendentemente. `before` devuelve los N anteriores; `after` devuelve los siguientes N. `hasMore` y `nextCursor` corresponden a la dirección solicitada. `conversationVersion` se devuelve siempre.

## Consistencia

- Enviar por HTTP; Socket.IO difunde cambios y maneja presencia/escritura. Un mensaje sólo se confirma cuando la transacción se ha guardado en PostgreSQL.
- `(senderId, clientMessageId)` es único. Una repetición idéntica devuelve el mismo mensaje; otra carga con el mismo identificador devuelve 409 `IDEMPOTENCY_CONFLICT`.
- `sequence` es un entero creciente de la conversación, nunca reutilizado. Los mensajes tienen fecha del servidor. No confiar en senderId, role o fecha del cliente.
- `conversation.version` aumenta con cada borrado individual o vaciado. `lastSequence` no se reinicia. Enviar o borrar con una versión obsoleta devuelve 409 `CONVERSATION_CHANGED`.
- El servidor valida autoría con el `senderId` persistido y rol de la sesión dentro de la transacción, antes de escribir la intención en el journal. Los intentos de borrar mensajes ajenos devuelven 403 `FORBIDDEN` sin cambios en mensajes, versión, auditoría ni journal. La UI ofrece “Borrar para ambos” con confirmación; el botón es visible en pantallas táctiles.
- Envío y borrado bloquean la misma fila de conversación dentro de la transacción para evitar carreras. Vaciados invalidan mensajes pendientes de una versión anterior. Un idempotency key de un mensaje borrado no debe recrearlo: conserva tombstones de IDs sin texto.
- Leer actualiza monotonamente `lastReadSequence`, máximo `lastSequence`, con version actual. El emisor aparece como lector de sus propios mensajes según la interacción real, no como lectura de la otra persona.
- Reconexión: cargar conversación; reconciliar versión; recuperar faltantes paginando `after`; si cambió versión, invalidar y recargar todo. Nunca reenviar automáticamente un mensaje pendiente después de un vaciado. En la carga inicial, conectar primero y reconciliar/bufferizar eventos para evitar huecos.
- Sólo mostrar `entregado` al recibir confirmación explícita del dispositivo destinatario. MVP mínimo: pendiente, enviado (persistido), leído; no inventar confirmaciones de entrega. Si se implementa entrega, coordinar su DTO con el principal.

## Socket.IO

Path estándar `/socket.io`; cookies de la misma sesión; auth `{csrfToken}`. Rechazar conexiones sin sesión, con cambio de contraseña pendiente, Origin ajeno o CSRF inválido. Eventos sólo a las dos cuentas de la conversación. La sesión se valida al conectar y al actuar; cerrar sockets al expirar/revocar sesión. Reconexión vuelve a consultar sesión/CSRF.

Servidor → clientes (tipos en contracts):

- `message:created`: `{message}`.
- `message:deleted`: `{messageId, conversationVersion}`.
- `conversation:cleared`: `{conversationVersion}`.
- `profile:updated`: `{user}`.
- `read:updated`: `{userId, lastReadSequence, readAt}`.
- `presence:updated`: `{userId, online}`.
- `typing:updated`: `{userId, isTyping}`.

Cliente → servidor: `typing:set` `{isTyping}`. Presencia por conexiones autenticadas; varios dispositivos mantienen online hasta cerrar el último. Typing expira tras ~5 s. Validación y rate limits por evento. No transmitir mensajes mediante un segundo canal de escritura que eluda las reglas HTTP.

## PostgreSQL y operación

Prisma estable 7 (pin exacto, sin cambiar a RC), adaptador PostgreSQL `pg`. Schema SQL `chat`. Base `private_chat`. Rol propietario `private_chat_owner` sólo en bootstrap/migraciones; runtime `private_chat_app` sin superusuario/DDL ni permiso para INSERT/DELETE usuarios. Inicialización y grants del schema coordinados con infraestructura.

Tablas: users, sessions, conversation, messages, read_receipts, deletion_audit y message_tombstones. `users.slot` único y CHECK IN (1,2); CHECK rol asociado al slot; una única conversación con CHECK id=1. El runtime no puede cambiar slot/role ni crear usuarios. La instalación es idempotente y no cambia contraseñas de cuentas existentes. Nuevas contraseñas iniciales se introducen por terminal con entrada oculta, o archivos secretos explícitos para CI; no se incluyen en argumentos, logs, ejemplos, frontend ni repositorio.

Borrado del contenido en la base activa; audit sólo actor/IDs/fecha/version, jamás body. Registrar también un journal duradero fuera del respaldo de PostgreSQL en `DELETION_JOURNAL_PATH` (`/data/journal/deletions.jsonl` en producción). El journal incluye operaciones pendientes/intención y confirmadas, identificadores opacos y versión, sin texto. Validar la operación y capturar sus IDs dentro del lock de conversación antes de escribir intención: un 404/409/410 no deja borrados pendientes. Los errores de escritura no deben producir un 200 sin registro. Reconciliar antes de abrir HTTP; rechazar journal corrupto o perdido tras borrados. `RECOVERY_MODE=true` preserva el journal vivo read-only e invalida todas las sesiones restauradas. No prometer un borrado remoto de capturas, copias exportadas ni páginas ya abiertas sin conexión.

El backend lee configuración desde `APP_ENV`, `APP_ORIGIN`, `HOST`, `PORT`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD_FILE`, `COOKIE_SECRET_FILE`, `CSRF_SECRET_FILE`, `UPLOAD_DIR`, `DELETION_JOURNAL_PATH`, `ADMIN_USERNAME`, `PARTNER_USERNAME`. También admite un `DATABASE_URL` local sólo si no se imprime. Producción requiere origen HTTPS válido y los archivos de secretos; nunca activar defaults inseguros. No servir el API listo para uso hasta estar provisionado.

## Verificación requerida

Ambos usuarios reales contra PostgreSQL; tercero rechazado por DB; acceso anónimo denegado; miembro puede borrar sus mensajes para ambos, pero no mensajes ajenos, vaciar el historial ni cambiar roles; cambio de contraseña invalida sockets; CSRF y Origin ajenos rechazados; reconexión sin pérdidas/duplicados; carreras entre enviar/borrar; no resurrección por reintento ni restauración; avatares privados; UI móvil/desktop; secretos y texto fuera de logs.

Cada modelo entrega `docs/handoffs/<frontend|backend>.md` con trabajo realizado, comandos y salidas resumidas, bloqueos reales y dependencias. El principal integra y emite el informe final. La ejecución Docker no debe declararse verificada si Docker no está disponible.

## Fotos en mensajes (v3)

Los stickers de Chiikawa usan el envío de texto existente: el body contiene el marcador exacto `[sticker:chiikawa:ID]` del catálogo local documentado en `docs/STICKERS.md`. Sólo los IDs conocidos y mensajes sin foto se representan como sticker; desconocidos o texto mixto se muestran como texto. El selector tiene vista previa y confirmación con Enviar, y conserva borradores de texto. Los 40 PNG transparentes se sirven desde el mismo dominio, sin peticiones externas durante el uso. Se mantienen todos los permisos, persistencia, versión, idempotencia, estados y borrados del mensaje existente. No cambia el DTO ni se añade un endpoint.

Ambas cuentas pueden enviar una foto por mensaje desde el icono de imagen del compositor, con vista previa local y texto opcional. JPEG/PNG/WebP hasta 5 MiB; nunca subir antes de pulsar Enviar. Sharp verifica bytes, limita a 16 millones de píxeles, orienta, reduce a 2048 px por lado y reexporta WebP sin EXIF. `Message.photoUrl` es opcional y sólo acepta `/api/messages/:id/photo`; sin texto se usa `📷 Foto`. Las fotos se amplían al pulsarlas.

Los bytes y su SHA-256 se guardan en columnas privadas de la misma fila PostgreSQL, nunca en DTO, logs ni el journal. Historial y eventos sólo contienen la URL autenticada. Misma transacción, versión, secuencia e idempotencia que texto: repetición compara texto y hash de imagen; cambiar foto o tipo con la misma clave da 409. Borrar mensaje/vaciar elimina también sus bytes, incluido al reconciliar un respaldo con el journal. Descarga privada sin caché; sesiones revocadas no acceden. Pendientes con foto sólo viven en memoria y se reintentan manualmente con la misma clave.

## Respuestas citadas (v4)

Cualquier cuenta puede responder a un mensaje con el botón Responder de la burbuja: el compositor muestra la cita (autor y fragmento) con opción de cancelarla, y el envío la adjunta como texto, sticker o foto. Sin nuevos endpoints ni eventos: `SendMessageInput.replyToMessageId` (UUID opcional, también como campo multipart en fotos) y `Message.replyTo` con la cita congelada `{messageId, senderId, body, photoUrl?}`. El servidor valida el original dentro de la misma transacción: inexistente da 404 `MESSAGE_NOT_FOUND`, borrado da 410 `MESSAGE_DELETED`; otra cita con la misma clave de idempotencia da 409. La cita viaja autocontenida en historial y `message:created` para mostrarse sin rondas extra; si el original se borra después, la cita se omite y la respuesta conserva su texto. Borrar una respuesta o su original sigue el flujo de borrado existente; las respuestas no reviven originales borrados. Tocar la cita desplaza al original si está cargado.

## Notificaciones push (v5)

Aviso del sistema como el del banco, pero genérico: siempre dice “Nuevo mensaje” / “Tienes un mensaje nuevo en el chat”, sin texto, fotos, stickers ni remitente. Opt-in por dispositivo desde Ajustes › Notificaciones. Sin Apple Developer ni App Store: PWA instalada desde Compartir › Añadir a pantalla de inicio, HTTPS, iOS 16.4+ y permiso concedido.

DTO en `packages/contracts/src/index.ts` (contrato v5): `PushSubscription {endpoint https, keys {p256dh, auth}}`, `SavePushSubscriptionInput`, `DeletePushSubscriptionInput`, `VapidKeyResponse {publicKey, enabled}`. Endpoints: `GET /api/push/vapid-key` (público), `POST /api/push/subscriptions` (autenticado + CSRF, 201, reasigna el endpoint a la cuenta actual, tope 10 por cuenta conservando las recientes), `DELETE /api/push/subscriptions` (autenticado + CSRF, 204 idempotente, sólo propia).

El push viaja vacío (POST sin payload al push service con VAPID, TTL 7 días, urgencia alta): no hay cifrado de contenido porque no hay contenido. El service worker (`/sw.js`) pinta el aviso genérico local; al pulsarlo abre/enfoca el chat. El servidor envía al crear el mensaje (sólo 201, nunca en reintentos idempotentes), únicamente a las suscripciones de la otra cuenta, sin bloquear la respuesta y sin registrar contenido ni endpoints completos. 404/410 podan la suscripción; errores de red la conservan. Sin claves VAPID (`VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY_FILE` + `VAPID_SUBJECT`) el servidor responde `enabled: false` y la UI lo explica. Manifiesto (`/manifest.webmanifest`), iconos y `sw.js` se sirven del mismo dominio sin caché; CSP existente los permite (`script-src 'self'`, `default-src 'self'`).


## Videos en mensajes (v6)

El usuario autorizó videos el 2026-10-11 y eligió 50 MiB / 180 segundos por envío. Una foto o un video por mensaje, con selección explícita, vista previa local y Enviar; nunca subir al elegir. MP4, MOV y WebM de entrada, validados por bytes y FFprobe. FFmpeg normaliza a MP4 H.264/yuv420p y audio AAC opcional, máximo 720 px por lado y 30 fps, faststart, sin metadatos de ubicación ni capítulos. Se admite sólo una conversión simultánea, con límites de tiempo y temporales eliminados al terminar. En v6 el audio se admitía sólo como parte del video; v7 añade notas de voz independientes. Las llamadas siguen fuera del alcance.

Migración aditiva `0006_message_videos`: `chat.messages.video_data` BYTEA y `video_hash` TEXT, ambos NULL para mensajes existentes; restricciones de tamaño/hash y exclusión foto/video. El hash identifica los bytes originales de subida para mantener idempotencia estable al actualizar FFmpeg. No se conservan los bytes originales tras convertir. Bytes privados en la misma fila: borrado, vaciado, tombstones y reconciliación del journal eliminan el video junto con el mensaje. Backups de PostgreSQL incluyen estos bytes y aumentarán de tamaño.

`Message.videoUrl` y `Message.replyTo.videoUrl` son opcionales y aceptan sólo `/api/messages/:id/video`; nunca bytes, hash, nombres originales ni rutas de disco en DTO/socket/logs. Sin texto se usa `🎬 Video`. Las citas, historial, push genérico y estados conservan el flujo actual. Repetir clave compara body, fotoHash, videoHash y cita; cambiar tipo o archivo da 409. Pendientes sólo en memoria, reintento manual con la misma clave y versión; un vaciado los descarta.

Descarga con sesión/permiso vigentes, `video/mp4`, `Cache-Control: no-store`, `Accept-Ranges: bytes` y rangos únicos válidos 206 con `Content-Range`/`Content-Length`; sin rango 200, inválido 416. Reproducción con controles, playsInline y sin autoplay. Proxy admite 51 MiB sólo en el endpoint de subida de video; fotos/otros endpoints conservan 6 MB. CSP `media-src 'self' blob:` para reproducción privada y vistas previas locales. FFmpeg/FFprobe son dependencias de sistema incluidas en la imagen del API y CI.


## Notas de voz y apariencia Telegram (v7)

El usuario autorizó grabar y enviar notas de voz el 2026-10-12. Límite inicial: 10 MiB y 180 segundos por nota. El micrófono sólo se solicita tras tocar Grabar; detener muestra reproducción local, duración, Enviar y Cancelar. Nunca subir al grabar ni detener. Parar las pistas al detener/cancelar/salir; no grabar sin indicador visible. Si no hay permiso, contexto seguro o API compatible, mostrar un error útil. Al alcanzar el límite, detener y permitir revisar antes de enviar.

Una foto, video o nota de voz por mensaje. Multipart `audio`, `clientMessageId`, `conversationVersion`, `body` opcional y `replyToMessageId` opcional. MIME de entrada: audio/webm, audio/mp4, audio/ogg, audio/mpeg y audio/wav (parámetros codecs se normalizan para comprobar MIME). FFprobe valida bytes, stream de audio y ausencia de streams de video u otros tipos; FFmpeg normaliza a M4A AAC sin metadatos ni capítulos. Para WebM de MediaRecorder sin duración declarada, la conversión limitada permite medir y validar la duración real de salida. Recursos, tiempos y temporales limitados; conversión comparte exclusión con video.

Migración aditiva `0007_message_audio`: columnas privadas `audio_data`, `audio_hash`, `audio_duration_seconds`, nulas para mensajes existentes, restricciones de tamaño/hash/duración y exclusión entre los tres adjuntos. SHA-256 identifica bytes originales para idempotencia; sólo se conserva el M4A final. Mensajes, citas y eventos incluyen únicamente `audioUrl` autenticada `/api/messages/:id/audio` junto con `audioDurationSeconds` positiva y hasta 180. Nunca incluir bytes, hash o rutas locales en DTO/logs/journal. Sin texto se usa `🎤 Nota de voz`. Reproducción con controles, sin autoplay. Descarga privada con sesión vigente, no-store y rangos únicos, igual que video.

Mismos locks/transacciones, secuencias, versiones, cita, push genérico, permisos y tombstones. Idempotencia compara body, hashes de cada tipo y cita. Borrar/vaciar/reconciliar elimina bytes de voz junto al mensaje; cancelar una grabación no crea mensaje ni subida. Pendientes sólo en memoria, reintento manual con misma clave, sin reenvío tras vaciar. Backups PostgreSQL incluyen audio. Proxy permite 11 MiB sólo para audio; `Permissions-Policy` permite `microphone=(self)` y CSP mantiene `media-src 'self' blob:`.

El fondo se configura desde Ajustes: presets locales (incluido patrón de dibujos) o imagen elegida explícitamente, previsualización y Guardar/Cancelar, y restablecer. Preferencia por cuenta y navegador, con imagen persistida localmente en IndexedDB; no se sube al servidor ni cambia el fondo de la otra cuenta. Una cuenta no hereda la imagen de otra al alternar sesión. Fallos de almacenamiento se muestran y no se presenta un guardado inexistente. Tema/fuente guardados previamente se conservan.
