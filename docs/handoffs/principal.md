# Entrega del principal — integración local completada

Contratos/prompts, monorepo/lock, secretos, infraestructura Atlantic.net y operación preparados. Ambas entregas recibidas; después del cierre de las sesiones, el principal corrigió discrepancias en apps/api y apps/web y ejecutó el conjunto contra PostgreSQL real.

Correcciones de integración: generación Prisma explícita sin DB/secrets; bootstrap *_FILE con DSN sólo en memoria y password APP separado del OWNER; journal estricto con captura bajo lock y sin intenciones de 404/409/410; reconciliación antes de HTTP, modo recuperación read-only y revocación de sesiones; cookies CSRF Secure en producción y API no-store; validación de configuración, provisión con contraseñas sin eco y validadores compartidos; WebSocket con Origin exacto, revalidación por acción y expiración. Se mantuvieron DTO/rutas del contrato.

Ajuste del usuario: chat fullscreen sin espacio exterior en móvil/desktop; rail desktop de 72px con iconos de perfil/chat/ajustes/logout; scroll sólo en historial; compositor dentro del viewport; avatares por CSS compatible con CSP. No se cambió el modelo de permisos.

Verificación: `npm run verify:local` **99/99** (12 base,25 APIunit,26 frontend,35 PostgreSQLAPI,1 flujo PostgreSQLruntime+WebSocket), tipos y builds OK, cero skips. `infra:check` OK, npm audit producción cero vulnerabilidades. Cluster PostgreSQL16.15 exclusivo loopback55432 y Node26.10.0; no se afirma validación Node24/PG18.

Preview QA real con datos sintéticos en private_chat_preview; API3000 y frontend5173. Safari abrió login, y el usuario aportó evidencia de acceso/envío. Inspección visual de todos los tamaños tras ajuste final todavía pendiente: no sustituirla por las pruebas de componentes. Se preservaron los informes originales frontend/backend como histórico de sus entregas.

Producción requiere Docker/Compose (ausente localmente), ejecutar build/arranque/backup/restore real en versiones fijadas y dominio/SSH Atlantic.net más repositorio de backup. No hay despliegue remoto ni credenciales reales del usuario en la app. MVP sin E2EE; límite del journal ante pérdida simultánea del VPS/copia actual documentado.

Actualización de personalización del 10 de octubre: UI neutra por defecto, diez paletas existentes con selección por cuenta/navegador, nombre QA Marthiel, lápiz al hover/foco y galería circular con preview local antes de Guardar. Frontend 35/35 y build OK; nombre persistido y visible desde ambas cuentas por API contra PostgreSQL. Detalles, archivos, fuentes y límites de verificación en [personalizacion.md](personalizacion.md) y [THEMES.md](../THEMES.md). Sin nuevos DTO, endpoints ni dependencias; sin despliegue remoto.

## Ajuste del estado vacío — 2026-10-10

Petición del usuario: carita UwU en lineart al centro del historial vacío, tono cercano al fondo pero distinguible y texto pequeño «También podíamos usar Wasap...».

- Archivos: `apps/web/src/components/ChatPanel.tsx` y `apps/web/src/index.css`. SVG vectorial con trazos redondeados; color mezclado con el fondo del tema, tamaño responsive y centrado en el área del historial. Se conserva la condición existente: sin mensajes persistidos ni pendientes, después de cargar y sin error.
- `npm run build --workspace @private-chat/web`: correcto, incluida la comprobación TypeScript.
- `npm run test --workspace @private-chat/web`: 5 archivos, 35 pruebas aprobadas.
- Revisión visual del componente real con props sintéticas en fixture temporal, eliminado al finalizar: Tokyo Night a 1280×720 y 390×844. Sin desbordamiento horizontal ni scroll sobrante del historial; carita y texto centrados. Capturas locales en `.data/qa/empty-state-desktop.png` y `.data/qa/empty-state-mobile.png`.
- Dependencias nuevas: ninguna. Cambios de contrato/API: ninguno. Esta revisión valida presentación; no constituye una nueva prueba de integración PostgreSQL ni un despliegue al VPS.

### Tipografía del texto vacío — 2026-10-10

- Texto bajo UwU actualizado a Patrick Hand, manuscrita y redondeada, a 15px. Archivos: `apps/web/src/components/ChatPanel.tsx`, `apps/web/src/index.css` y `apps/web/src/assets/fonts/PatrickHand-{Regular.ttf,OFL.txt}`.
- Fuente distribuida localmente con licencia SIL OFL conservada, obtenida de `https://github.com/google/fonts/tree/main/ofl/patrickhand`; no se añaden servicios externos ni dependencias npm.
- `npm run build --workspace @private-chat/web`: correcto, TypeScript y asset de fuente incluidos.
- Revisión del componente real con fixture temporal eliminado: móvil 390×844, fuente cargada y confirmada por `document.fonts.check`, tamaño computado 15px. Captura: `.data/qa/empty-state-handwriting.png`.

### Espaciado del texto vacío — 2026-10-10

- `apps/web/src/index.css`: añadido `letter-spacing: 0.04em` al texto manuscrito bajo UwU (0.6px con la fuente a 15px), a petición del usuario.
- Primer build frontend falló por exports de PIN desactualizados en el artefacto compilado de contracts. `npm run build:contracts` pasó sin modificar la fuente de contratos. El segundo build frontend quedó bloqueado por trabajo de PIN en curso: el provider de `apps/web/src/state/session.tsx` no incluye aún `pinLogin` y `pinSetup` exigidos por `SessionState`. No se modificó ese trabajo ni se declara compilación completa verificada para este ajuste de CSS.
- Sin dependencias adicionales ni cambios de contrato.

### Fuente global y nombres recíprocos — 2026-10-10

- Patrick Hand queda como fuente predeterminada de la interfaz mediante `--font-sans` en `apps/web/src/index.css`; el texto del estado vacío hereda la misma familia y mantiene su espaciado. `docs/CONTRACT.md` refleja la elección.
- `npm run test --workspace @private-chat/web`: 35/35 pruebas, cinco archivos. `npm exec --workspace @private-chat/web -- vite build`: correcto, incluida fuente local. El build completo con TypeScript sigue bloqueado por `SessionState` de la implementación concurrente de PIN (provider sin `pinLogin`/`pinSetup`); no se modificó ese trabajo.
- Revisión visual de acceso real en escritorio 1280×720 y móvil 390×844: Patrick Hand cargada, familia computada confirmada para títulos, párrafos, botones, inputs y labels; sin desbordamiento horizontal. Capturas `.data/qa/default-font-{desktop,mobile}.png`.
- Solicitud posterior de nombres: admin QA = Alexis, member QA = Marthiel. Ambos guardados mediante login propio y PATCH `/api/users/me` con sesión y CSRF, sobre la API local de preview conectada a PostgreSQL. GET sesión y conversación desde ambas cuentas confirmó: «Alexis ve como contacto a Marthiel» y «Marthiel ve como contacto a Alexis». Se cerraron exclusivamente las sesiones auxiliares. Sin modificación de credenciales, mensajes ni cuentas de producción.
- El primer intento de reutilizar el helper de integración falló al importar exports de contracts de PIN en curso, antes de ejecutar peticiones. Se completó con un cliente HTTP temporal sin importar código backend.
- `scripts/preview-local.mjs` inicializa ahora esos nombres cuando encuentra los nombres genéricos anteriores; conserva posteriores ediciones personales. `node --check scripts/preview-local.mjs`: correcto. `docs/CONTRACT.md` y `docs/THEMES.md` actualizados con la orientación de los nombres.
- Sin nuevas dependencias, endpoints ni DTO. No se ha desplegado al VPS.

## Puerta visual, Cocoa y acceso admin — 2026-10-10

- Se quitó el corazón de `GateScreen`; el fondo previo al acceso ahora es una estructura visual del chat con burbujas de muestra sin texto ni datos reales, desenfocada y cubierta por la puerta. Cuando termina el alta o el login PIN, `App` desmonta `GateScreen` y deja visible el chat autenticado.
- El icono de ajustes en móvil y escritorio usa `Settings` de Lucide (engrane lineal). Se añadió Cocoa como tema número once y tema inicial sólo para la cuenta miembro Marthiel; la preferencia previa que ella hubiera guardado conserva prioridad.
- `npm run typecheck --workspace @private-chat/web` y `npm run build --workspace @private-chat/web`: correctos. Construcción Docker de `web` en el VPS correcta; `up -d --no-deps web` recreó sólo `private-chat-web-1`. API y PostgreSQL siguieron saludables.
- `curl -I https://marthi.alexisrs.dev/`: HTTP/2 200. Se confirmaron los nuevos recursos con `Cocoa` y los colores del tema; Brave mostró la pantalla sin corazón y el fondo de chat borroso. No se reinició el VPS ni se recargó/modificó Caddy en esta publicación. No se ejecutaron pruebas automatizadas.
- No hay cambios en DTO, endpoints ni dependencias.

### Credenciales admin durante el alta del miembro — 2026-10-10

- Petición del usuario: permitir que el administrador entre antes de que Marthiel configure Sammy y su PIN.
- `GateScreen` ofrece “Ingresar con credenciales de admin” tanto en la pantalla inicial de pregunta como en la pantalla PIN posterior. El formulario muestra el usuario admin actual (`alexisdev`) y solicita su contraseña mediante input de tipo password; la API existente confirma el acceso. “Volver” regresa a la pregunta o al PIN según corresponda.
- No se usa el login por contraseña del miembro desde esta UI; la cuenta de miembro conserva su flujo de pregunta secreta y creación de PIN.

### Usuario editable en el acceso admin — 2026-10-10

- `apps/web/src/components/GateScreen.tsx`: el campo de usuario dejó de ser de sólo lectura y ahora se puede editar; inicia con `AlexisDev` y se envía por el flujo de login existente, que normaliza el nombre a minúsculas.
- El `ADMIN_USERNAME` activo en la API es `alexisdev`, así que el uso de mayúsculas en el nombre no explica un error de acceso. La contraseña sí distingue mayúsculas/minúsculas.
- `npm run build --workspace @private-chat/web`: correcto. Build Docker de `web` en `/opt/private-chat`: correcto. Se recreó únicamente `private-chat-web-1` con `--no-deps`; la API y PostgreSQL siguieron saludables, Caddy y los demás proyectos siguieron activos.
- Brave recargó `marthi.alexisrs.dev`; el formulario de admin mostró el usuario como campo editable. No probé ni cambié la contraseña.
- Sin dependencias, cambios de contrato ni endpoints; no se ejecutaron pruebas automatizadas.


## Borrado individual del invitado — 2026-10-11

- Petición: permitir que la cuenta invitada borre sus propios mensajes uno por uno, para ambos, sin límite temporal. El administrador conserva borrado de cualquier mensaje y vaciado del historial.
- Backend: `apps/api/src/http/app.ts` autoriza con el autor persistido y el rol de la sesión dentro de la transacción y antes del journal; también comprueba la autoría de tombstones. Mantiene lock, versión, CSRF, auditoría, journal y eventos existentes. No cambia endpoints, DTO, esquema PostgreSQL ni dependencias.
- Frontend: `apps/web/src/components/MessageBubble.tsx`, `apps/web/src/App.tsx`, `apps/web/src/index.css`, `apps/web/src/components/LoginScreen.tsx`, `apps/web/src/components/ProfileDialog.tsx`. Papelera para mensajes propios o administrador; callback comprueba autoría; confirmación “Borrar para ambos”. En pantallas táctiles el botón es visible y tiene área mínima de 44×44 px.
- Pruebas: `apps/web/src/components/permissions.test.tsx`, `apps/api/test/integration/auth.test.ts`, `apps/api/test/integration/chat.test.ts`, `scripts/integration/runtime.test.mjs`. Cubren selección del mensaje propio, rechazo de mensajes ajenos/vaciado, CSRF y acceso anónimo, auditoría/journal sin texto, idempotencia sin resurrección, borrados simultáneos y difusión WebSocket a ambas cuentas usando el rol PostgreSQL restringido.
- Coordinación: actualizados `AGENTS.md`, `docs/CONTRACT.md`, comentario de permisos en `packages/contracts/src/index.ts`, `README.md`, `docs/STATUS.md` y guía Atlantic. Los informes frontend/backend originales permanecen como histórico.
- `npm run verify:local`: final correcto, 136/136, cero omisiones (contratos 6, base 6, backend unitarias 25, frontend 51, API PostgreSQL 45, runtime PostgreSQL/WebSocket 3); tipos y builds correctos. Las primeras ejecuciones corrigieron dos errores TypeScript del nuevo test y una expectativa incorrecta sobre Origin HTTP con CSRF válido; el contrato exige Origin estricto para sockets, cuyos rechazos continúan verificados.
- Publicación: se transfirieron únicamente los seis archivos de aplicación citados, después de comparar sus bases con el VPS y guardar sus versiones anteriores. `docker compose -f compose.yaml -f compose.atlantic.yaml build api web` y `up -d --no-deps --wait --wait-timeout 60 api web`: correctos en `/opt/private-chat`. Node remoto v24.21.0. API y web actualizadas; PostgreSQL del chat y los otros proyectos conservaron sus contenedores activos.
- Verificación pública posterior: web 200, recursos JS/CSS con los nuevos controles, `/api/ready` 200, historial anónimo 401 y DELETE con sesión anónima/CSRF válido 401. Se confirmó la comprobación de autoría en el código compilado del contenedor API. Durante la recreación hubo una respuesta 502 transitoria; las verificaciones finales pasaron.
- Limitaciones: el flujo autenticado de dos cuentas se ejecutó sobre PostgreSQL exclusivo de QA, no sobre cuentas/mensajes de producción. No se crearon mensajes de prueba en producción ni se realizó una nueva revisión visual móvil/desktop en navegador. Las pruebas de componentes y el CSS táctil no se presentan como esa revisión visual.


## Vista de la foto del contacto — 2026-10-11

- La foto del contacto en la cabecera es un botón accesible que abre la vista circular ampliada, en móvil y escritorio. El visor ajeno contiene únicamente foto/nombre/cierre; no tiene input de archivos ni acciones de cambio, guardado o eliminación.
- Archivos: nuevos `apps/web/src/components/AvatarLightbox.tsx` y `AvatarPreview.tsx`; ajustados `AvatarEditor.tsx` y `ChatPanel.tsx`. El contenedor compartido conserva el fondo oscuro, tamaños, cierre con fondo/Escape, foco inicial, ciclo de Tab y restitución del foco. El editor propio conserva su selección/preview/guardado. El visor se actualiza con la versión del avatar y muestra ausencia/error sin acciones de edición.
- Pruebas en `permissions.test.tsx` y `personalization.test.tsx`: apertura desde la cabecera, URL privada versionada, ausencia de controles de modificación, cierre/foco, contacto aún no cargado, avatar ausente/fallido y actualización posterior. Continúan aprobadas las pruebas del guardado propio con multipart/CSRF y cancelación sin subida.
- `npm run build --workspace @private-chat/web`: correcto, TypeScript y Vite. `npm run test --workspace @private-chat/web`: 54/54, siete archivos. Primera compilación corrigió nulabilidad de un dato del fixture del nuevo test. `git diff --check`: correcto. No hay nuevas dependencias, endpoints, DTO ni cambios backend/DB.
- `docs/CONTRACT.md` actualizado. Se compararon las fuentes anteriores de AvatarEditor/ChatPanel con el VPS y se guardó copia antes de transferir únicamente los cuatro archivos de aplicación de este cambio.
- Publicación en `/opt/private-chat`: `docker compose -f compose.yaml -f compose.atlantic.yaml build web` y `up -d --no-deps --wait --wait-timeout 60 web`, correctos. Sólo se recreó web. API/PostgreSQL y proyectos vecinos siguen activos. Web y `/api/ready` públicos: 200. El bundle publicado contiene la apertura del visor del contacto, el caso sin foto y el editor propio.
- Alcance de verificación: componentes y compilación, publicación y comprobaciones HTTP/recursos; no se realizó una nueva revisión visual en navegador ni prueba autenticada de las fotos de producción. No se repitieron las suites PostgreSQL porque no cambió el backend.

## Stickers Chiikawa + fotos en mensajes — 2026-10-11 (cierre)

- Petición del usuario: paquete de 40 stickers de Chiikawa con selector junto al compositor (elegir, previsualizar, quitar, Enviar; conserva el borrador de texto) e icono de foto para enviar una imagen por mensaje con vista previa local y texto opcional, ampliable al pulsarla. Todo ya estaba implementado en el árbol de trabajo; el principal verificó y cerró la integración.
- Contrato v3 (`docs/CONTRACT.md`, `packages/contracts`): stickers como body `[sticker:chiikawa:ID]` sobre el flujo de texto existente, sin nuevos endpoints/DTO; fotos vía `POST /api/messages/photo` (multipart, Sharp → WebP ≤2048px sin EXIF, bytes+SHA privados en la fila, `photoUrl` autenticada, idempotencia por texto+hash, borrado con el mensaje). Sin peticiones a terceros en uso.
- Corrección del principal: `apps/api/test/integration/chat.test.ts` (test de typing por polling) era racy — el primer GET devolvía la presencia encolada antes de que el POST de `typing:set` terminara su revalidación de sesión en DB. Ahora repite la lectura hasta ver `typing:updated` o 8 s. Sin cambios de producto; verificado con script de reproducción (sin espera falla, con espera recibe).
- `npm run verify:local`: **154/154**, cero omisiones (contratos 6, base 6, backend unitarias 25, frontend 65 en 10 archivos, API PostgreSQL 49, runtime PostgreSQL/WebSocket 3); tipos y builds OK. Fotos privadas: envío invitado→admin por socket/historial/descarga sin EXIF, idempotencia 409, rechazos CSRF/Origin/anónimo/SVG/corruptos/tamaño, borrado elimina bytes sin resurrección. Stickers: selector, confirmación, borrador conservado, historial/lectura/borrado, desconocidos como texto.
- Limitaciones: verificado contra PostgreSQL exclusivo de QA, no mensajes de producción. Despliegue al VPS (build/compose `api web`) pendiente desde este entorno sin acceso SSH; no se declara publicado. Revisión visual en navegador pendiente.

## Publicación por CI/CD — 2026-10-11

- El usuario señaló que ya existe CI/CD: cierto y operativo (deploy verde hoy 05:59 UTC). No se usaba porque todo el trabajo vivía sin commitear; el CD despliega desde `origin/main`.
- Commit `89d4de1` (stickers, fotos, borrado propio, pin-gate, sharp 0.35.5, lockfile regenerado, fix test typing) pusheado a `main`. Se limpiaron las modificaciones rsync del VPS para que `git pull --ff-only` no fallara.
- CI `38120037620` en verde (node24 + postgres18); Deploy `38120125887` en verde: pull, build api/web/bootstrap, bootstrap (migración 0003 fotos), up, `/api/ready` OK, Caddy intacto.
- Verificación pública: web 200 con bundle nuevo (40 marcadores chiikawa, PNG servido 200), `/api/ready` 200, historial y foto anónimos 401, `api` healthy recién recreado, `postgres` intacto (2 h activo, sin pérdida de datos). VPS en `89d4de1` limpio.
- Nota: el deploy manual por rsync quedó descartado a favor del flujo CI/CD; las imágenes locales del build manual fueron reemplazadas por las del CD.

## Respuestas citadas — 2026-10-11

- Petición del usuario: responder mensajes con cita, con push al terminar.
- Contrato v4 (`docs/CONTRACT.md`, `packages/contracts`): `SendMessageInput.replyToMessageId` opcional (también multipart en fotos) y `Message.replyTo` con cita congelada `{messageId, senderId, body, photoUrl?}`. Sin endpoints ni eventos nuevos.
- Backend: `apps/api/prisma/schema.prisma` + migración `0004_message_replies` (`reply_to_message_id` + índice, sin FK para no perder la respuesta si el original se borra). `persistMessage` valida el original en la misma transacción (inexistente 404, borrado 410) e incluye la cita en idempotencia (otra cita con la misma clave da 409). Historial resuelve citas en lote; si el original se borró después, la cita se omite. Pruebas `apps/api/test/integration/replies.test.ts`: 4/4 (snapshot por socket e historial, 404/410/malformada, supervivencia al borrado sin resurrección, 409 y foto citando texto).
- Frontend: botón Responder en cada burbuja (táctil visible), cita en el compositor con autor/fragmento y cancelación, cita en burbujas y pendientes, tocar la cita desplaza al original con resaltado. `useChat.send/sendPhoto` aceptan `{message, author}`; reintentos conservan la cita. Pruebas `apps/web/src/components/replies.test.tsx` + `lib/reply.ts`: 4/4; se actualizaron 4 aserciones existentes por el parámetro nuevo.
- `npm run verify:local`: 163/163 (contratos 7, base 6, api unit 25, web 69 en 11 archivos, API PostgreSQL 53, runtime 3); tipos, builds y `npm audit --omit=dev` sin vulnerabilidades.

## Publicación de respuestas — 2026-10-11

- Push `7964eff` → CI verde → Deploy verde (pull --ff-only limpio, build api/web/bootstrap, bootstrap con migración 0004, up, `/api/ready` OK).
- Verificación pública: VPS en `7964eff` limpio; web 200 con bundle nuevo ("Responder mensaje", "Cancelar respuesta"); `/api/ready` 200; columna `chat.messages.reply_to_message_id` presente; `api`/`web` recreados healthy, `postgres` intacto.
