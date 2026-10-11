# Contrato común v1

## Producto

Aplicación web privada en español, exactamente dos cuentas creadas por una operación administrativa de instalación. Cuenta 1: `admin`; cuenta 2: `member`. Una conversación permanente. Identidad interna estable aunque cambie el nombre de usuario. Ambos pueden editar exclusivamente su propio perfil y contraseña. Sólo el administrador puede borrar cualquier mensaje o vaciar el historial para ambos.

El MVP incluye texto/emojis y avatares. No incluye registro, nuevos contactos, grupos, voz/vídeo, adjuntos, notificaciones push ni cifrado de extremo a extremo. HTTPS protege el transporte; el servidor puede leer el texto del MVP. No afirmar privacidad frente al operador del servidor. No usar servicios externos para los datos del chat.

Referencia de estructura: `docs/reference.png`. Paleta neutra minimalista por defecto (GitHub Light), superficies claras y acciones en grafito; bordes y sombras discretos. Personalización con diez paletas existentes: GitHub Light/Dark, Catppuccin Latte/Mocha, Dracula, Nord, Solarized Light/Dark, Gruvbox Dark y Tokyo Night. La preferencia se guarda por cuenta en el navegador, sin alterar DTO ni crear endpoints. Nombre propio editable desde el lápiz blanco visible al hover/foco; en móvil siempre visible. Al pulsar la foto propia, vista ampliada circular sobre fondo oscuro, opción Cambiar imagen y previsualización local con Guardar/Cancelar debajo; no subir antes de confirmar. La vista previa QA usa Alexis para la cuenta administradora y Marthiel para la segunda cuenta: Alexis ve a Marthiel como contacto y Marthiel ve a Alexis. Esquinas redondeadas y avatares circulares. Móvil: conversación y ajustes adaptados al teclado. Desktop: barra lateral y panel del chat. Presentar un único contacto. No mostrar controles inoperantes.

La tipografía predeterminada de toda la interfaz es Patrick Hand, alojada localmente: acceso, chat, mensajes, botones, campos, ajustes y diálogos. El texto bajo la carita del estado vacío conserva su tamaño pequeño y el espaciado ligero de 0.04em.

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
| POST `/auth/login` | LoginInput | SessionResponse | público + CSRF; 200 |
| POST `/auth/logout` | `{}` | 204 | CSRF; idempotente |
| POST `/auth/change-password` | ChangePasswordInput | SessionResponse | autenticado + CSRF |
| PATCH `/users/me` | UpdateProfileInput | `{user: PublicUser}` | autenticado + CSRF |
| POST `/users/me/avatar` | multipart, campo `avatar` | `{user: PublicUser}` | autenticado + CSRF |
| DELETE `/users/me/avatar` | `{}` | `{user: PublicUser}` | autenticado + CSRF |
| GET `/users/:userId/avatar` | query `v` opcional | imagen o 404 | autenticado |
| GET `/conversation` | — | `{conversation, partner}` | autenticado |
| GET `/messages` | MessagesQuery | MessagesPage | autenticado |
| POST `/messages` | SendMessageInput | `{message: Message}` | autenticado + CSRF; 201 nuevo / 200 repetición idéntica |
| POST `/conversation/read` | MarkReadInput | ReadUpdatedEvent | autenticado + CSRF |
| DELETE `/messages/:messageId` | `{conversationVersion: number}` | MessageDeletedEvent | admin + CSRF |
| DELETE `/conversation/messages` | `{conversationVersion: number}` | ConversationClearedEvent | admin + CSRF |

`mustChangePassword` permite únicamente sesión, logout y cambio de contraseña hasta completarlo. El resto responde 403 `PASSWORD_CHANGE_REQUIRED`. Username único, editable, ASCII 3–32 caracteres (`a-z`, `0-9`, `_`, `.`, `-`); normalizar a minúsculas. DisplayName 1–60; body 1–4000 tras trim; contraseña nueva 15–128 sin trim. Avatares JPEG/PNG/WebP de hasta 5 MiB, decodificados y reexportados con Sharp a formato seguro, sin EXIF. Nunca aceptar SVG ni construir rutas del disco desde nombres aportados por el cliente.

`MessagesQuery`: `limit` 1–100 (default 50), `before` o `after` por sequence, nunca ambos. Historial inicial devuelve los últimos N, ordenados ascendentemente. `before` devuelve los N anteriores; `after` devuelve los siguientes N. `hasMore` y `nextCursor` corresponden a la dirección solicitada. `conversationVersion` se devuelve siempre.

## Consistencia

- Enviar por HTTP; Socket.IO difunde cambios y maneja presencia/escritura. Un mensaje sólo se confirma cuando la transacción se ha guardado en PostgreSQL.
- `(senderId, clientMessageId)` es único. Una repetición idéntica devuelve el mismo mensaje; otra carga con el mismo identificador devuelve 409 `IDEMPOTENCY_CONFLICT`.
- `sequence` es un entero creciente de la conversación, nunca reutilizado. Los mensajes tienen fecha del servidor. No confiar en senderId, role o fecha del cliente.
- `conversation.version` aumenta con cada borrado individual o vaciado. `lastSequence` no se reinicia. Enviar o borrar con una versión obsoleta devuelve 409 `CONVERSATION_CHANGED`.
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

Ambos usuarios reales contra PostgreSQL; tercero rechazado por DB; acceso anónimo denegado; miembro no puede borrar ni cambiar roles; cambio de contraseña invalida sockets; CSRF y Origin ajenos rechazados; reconexión sin pérdidas/duplicados; carreras entre enviar/borrar; no resurrección por reintento ni restauración; avatares privados; UI móvil/desktop; secretos y texto fuera de logs.

Cada modelo entrega `docs/handoffs/<frontend|backend>.md` con trabajo realizado, comandos y salidas resumidas, bloqueos reales y dependencias. El principal integra y emite el informe final. La ejecución Docker no debe declararse verificada si Docker no está disponible.
