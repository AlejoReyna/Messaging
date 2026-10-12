# Informe frontend — chat web privado (@private-chat/web)

## Ajuste posterior

- Se quitó del pie del chat el aviso sobre acceso del administrador al historial,
  a petición del usuario (`apps/web/src/components/ChatPanel.tsx`).
- Verificación: búsqueda literal del aviso en el componente, sin coincidencias.

Modelo frontend. Alcance respetado: sólo `apps/web/**` y este informe. No se tocó raíz,
contracts, infra, scripts ni `apps/api/**`. No se crearon subagentes. No se instaló nada
(las dependencias ya estaban instaladas en el workspace); no se pidió ninguna dependencia nueva.

## Qué se implementó

App React + TypeScript + Vite + Tailwind v4 + socket.io-client, en español, fiel a
`docs/reference.png` (fondo lavanda, panel violeta intenso, superficies blancas muy
redondeadas, avatares circulares, burbujas propias blancas a la derecha y ajenas claras
a la izquierda). Desktop: sidebar (perfil propio + único contacto con presencia/typing/
no-leídos) más panel de conversación. Móvil: panel único a 100dvh adaptado al teclado
(input 16px para no disparar zoom iOS, botones táctiles ≥44px, sin desbordes a 360/390px).

- `src/lib/api.ts` — cliente HTTP del contrato: `credentials: include` siempre,
  `X-CSRF-Token` en mutaciones con el token de `GET /api/auth/session` (guardado sólo en
  memoria, nunca en localStorage), todas las rutas vía `API_ROUTES` de
  `@private-chat/contracts`, errores `ApiErrorSchema` traducidos a español,
  multipart `avatar` con validación local JPEG/PNG/WebP ≤5MiB, `avatarSrc` con URL
  privada de la API (sin servicios externos), `sendMessage` distingue 201/200 (idempotencia).
- `src/lib/store.ts` — lógica pura anti-pérdida/duplicados (testeada): dedupe por
  id/clientMessageId, `reconcileBuffer`, `applyDeleted`/`applyCleared` (el vaciado
  descarta pendientes, no reenvía ni resucita), `isVersionStale`, `canRetry` (un pendiente
  de versión anterior no se reintenta).
- `src/state/session.tsx` — sesión por cookies, estados carga/anónimo/cambio-obligatorio/
  lista, `mustChangePassword` bloquea el chat hasta cambiarla, logout idempotente,
  indicador online/offline.
- `src/hooks/useSocket.ts` — Socket.IO path `/socket.io`, cookies + `auth {csrfToken}`,
  sólo emite `typing:set`, valida cada evento servidor→cliente con
  `SERVER_EVENT_SCHEMAS` e ignora payloads inválidos.
- `src/hooks/useChat.ts` — núcleo: el socket se suscribe y **bufferiza antes** de
  reconciliar la carga HTTP; recuperación tras reconexión por `after` paginado con sesión
  fresca; ante cambio de `version` invalida y recarga; envío con `clientMessageId` estable
  (UUID) y `conversationVersion`, pendientes sólo en memoria con reintento manual;
  estados pendiente/enviado/leído (`read:updated`), sin "entregado" inventado;
  `markRead` monótono con debounce; typing con expiración defensiva (~5-6s).
- Componentes: `LoginScreen`, `PasswordGate` (obligatorio + ajustes, mín. 15 caracteres),
  `Sidebar`, `ChatPanel` (scroll al fondo sólo si estabas abajo, conserva posición al
  cargar anteriores, separadores de día en zona local, skeleton, error con reintento,
  vacío, banner reconectando), `Composer` (sólo texto/emojis, sin botones muertos de
  llamadas/audio/grupos/adjuntos/registro), `MessageBubble`/`PendingBubble` (reintentar/
  descartar), `ProfileDialog` (username/displayName, subir/eliminar avatar, contraseña,
  logout), `ConfirmDialog` accesible para borrado y vaciado.
- Permisos UI: sólo `role === 'admin'` ve borrar por mensaje y vaciar (con confirmación y
  `conversationVersion`); member no ve esos controles. El servidor sigue siendo la autoridad.
- Accesibilidad: labels, `role=log/dialog/alertdialog`, `aria-live` en typing/avisos,
  foco visible, Escape cierra diálogos, `prefers-reduced-motion`, contraste blanco sobre
  violeta-600/700.

## Archivos (todos nuevos en `apps/web/`)

`index.html`, `vite.config.ts` (proxy `/api` y `/socket.io` → `127.0.0.1:3000`,
`VITE_API_PROXY` opcional), `tsconfig.json`, `src/vite-env.d.ts`, `src/test-setup.ts`,
`src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/lib/api.ts`, `src/lib/store.ts`,
`src/lib/format.ts`, `src/state/session.tsx`, `src/hooks/useSocket.ts`,
`src/hooks/useChat.ts`, `src/components/{AvatarView,ConfirmDialog,LoginScreen,
PasswordGate,MessageBubble,Composer,ChatPanel,Sidebar,ProfileDialog}.tsx`,
`src/lib/{store,api}.test.ts`, `src/components/permissions.test.tsx`.

## Comandos y resultados (ejecutados de verdad)

- `npm run build:contracts` → OK.
- `npm run typecheck --workspace @private-chat/web` → OK (se corrigieron 2 errores:
  `onLoadMore` tipado `Promise<void>` y `defineConfig` desde `vitest/config`).
- `npm run test --workspace @private-chat/web` → **3 ficheros, 26/26 pruebas OK**
  (reconciliación HTTP/socket, idempotencia 200/201, cambio de versión, sesión expirada
  401, validación de avatar, admin ve borrado / member no, sin botones muertos, sin
  "entregado" inventado). Se corrigió 1 fallo inicial (limpieza entre tests con `cleanup`).
- `npm run build --workspace @private-chat/web` → OK
  (`dist/index.html` + css 23.6kB + js 407kB / gzip 121kB).
- `npm run dev` (puerto 5199 de prueba) → HTTP 200 en `/`; se detuvo tras la comprobación.
- Comprobaciones: ningún `fetch` fuera de `API_ROUTES`; cero usos de
  `localStorage/sessionStorage`; cero credenciales incrustadas en el cliente.

## Dependencias adicionales

Ninguna. Se usó lo ya declarado (`react`, `socket.io-client`, `lucide-react`,
`tailwindcss`, `@tailwindcss/vite`, `vitest`, testing-library). `VITE_API_PROXY` opcional
sólo para apuntar el proxy a otro backend local.

## Evidencia visual y pendientes reales (no verificados, sin declarar lo contrario)

- **No verificado**: flujo real de dos usuarios contra PostgreSQL. El backend existe en
  `apps/api` pero no está en marcha (puerto 3000 sin respuesta), no hay `.secrets/` y la
  BD sólo escucha en socket Unix (`/tmp:5432`), sin TCP en 5432. Montar secretos/migraciones/
  seed es del principal/backend; no lo toqué. El frontend queda preparado para integrarse
  (proxy y rutas según contrato).
- **No verificado**: revisión visual móvil/desktop en navegador (no hay navegador disponible
  en este entorno) ni prueba con backend real (sesión, socket, avatares). El `dev` sirve 200.
- **Para el principal**: tras integrar, verificar login admin/member, envío entre ambos,
  leído, typing/presencia, borrado admin + vaciado (409 `CONVERSATION_CHANGED`), avatar
  privado, expiración de sesión y reconexión sin duplicados; y revisión visual 360/390px y
  1280/1440px contra `docs/reference.png`.

## Ajuste del icono de inicio — 2026-10-11

- Solicitud: usar el encuadre de Marte de la última captura (cabeza, brazo y abrigo) al añadir el chat a la pantalla de inicio.
- Fuente conservada en `apps/web/assets/icons/marte.webp`; `apps/web/scripts/generate-icons.mjs` recorta el cuadrado superior de la imagen original y genera PNG opacos con fondo blanco. No redibuja la ilustración.
- Nuevos archivos en `apps/web/public/`: `apple-touch-icon-marte-v2.png` (180), `icon-marte-v2-192.png`, `icon-marte-v2-512.png`, `maskable-marte-v2-512.png` (con margen para máscaras).
- `index.html`, `manifest.webmanifest` y `sw.js` referencian los nuevos nombres para evitar reutilizar la URL de los iconos anteriores. Los PNG anteriores y los cambios ajenos encontrados al iniciar se conservan.
- Comandos ejecutados: `node apps/web/scripts/generate-icons.mjs` y `npm run build --workspace @private-chat/web` → OK. Inspección visual del PNG de 512 px y comprobación con Sharp de las dimensiones, formato PNG y ausencia de transparencia de los cuatro archivos en `dist` → OK; HTML y manifiesto construidos apuntan a los assets nuevos.
- Dependencias nuevas: ninguna; usa Sharp ya instalado en la raíz.
- Se usó el modo integrado de imagegen con el prompt: “Produce a square image matching image 2 exactly: only crop/resize the existing original artwork; preserve linework, character, proportions, colors, pose and background without repainting.” La variante generada se descartó por cambiar detalles; los assets entregados se derivan directamente del original mediante Sharp.
- Limitaciones: este cambio se preparó localmente; no se desplegó ni se comprobó en un iPhone real. Tras desplegar, volver a añadir la página a inicio para crear el acceso con el nuevo icono. Apple documenta `apple-touch-icon` en https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html.

## Corrección de notificaciones iOS — 2026-10-11

- Archivos: `apps/web/src/lib/push.ts`, su test, `apps/web/src/components/PushSettings.tsx` y `PushSettings.test.tsx`. Registro previo del worker, preparación de VAPID antes del toque, permiso directo desde el botón, confirmación del guardado en servidor, recuperación de suscripciones existentes, guía iOS, reintento y botón local Probar aviso.
- Diagnóstico real: servidor público con push activo; consulta de sólo lectura en PostgreSQL del VPS con cero suscripciones por cuenta. No se inspeccionó texto de mensajes ni se enviaron mensajes en producción.
- Validación: suite frontend final aislada 81/81; pruebas finales específicas 12/12 y build del frontend OK. Integración del API push contra PostgreSQL aislado: 4/4; transporte inyectado, sin afirmar recepción real en Apple.
- Publicación web final desde un snapshot aislado de `04edf47` con esta corrección y el icono aprobado, para conservar trabajo concurrente de otros modelos. Imagen `private-chat-web:ios-push-20261011-1132`; HTTPS sirve `/assets/index-KQ1v3B4q.js`, HTML, manifiesto, worker e icono con bytes idénticos al build aislado. `/api/ready` 200. Sólo web se recreó; los demás IDs de contenedores permanecieron iguales. Icono de la tarea anterior también publicado.
- Dependencias nuevas: ninguna. DTO/backend/secretos sin cambios. Fuente local sin commit ni push; incorporar al próximo commit para conservarlo en futuros deploys de CI. Recepción en iPhone pendiente de activar el permiso y comprobar un aviso real en el dispositivo.
- Instrucciones de usuario, fuentes oficiales, comandos, alcance de las pruebas y rollback: `docs/IOS_PUSH.md`.

## Color del área superior de iPhone — 2026-10-11

- Solicitud: que el área de cámara/Dynamic Island use el mismo color que la cabecera en cada tema.
- Archivos: `src/lib/themes.ts` sincroniza `meta[name="theme-color"]` con `--color-surface` al aplicar el tema mediante un layout effect. `src/index.css` aplica la misma superficie a HTML/body y conserva el canvas en `#root`. `index.html` y `public/manifest.webmanifest` arrancan en blanco, superficie de GitHub Light. Documentación en `docs/THEMES.md`.
- Comando final: `npm run build --workspace @private-chat/web` desde `.data/ios-push-isolated` → TypeScript y Vite OK. Se preparó un test de paletas que falló por el tratamiento de imports CSS/file URL de Vitest; se retiró ese archivo provisional. No se declara una suite de temas aprobada.
- Se publicó sólo este ajuste sobre el snapshot aislado de la entrega anterior; los cambios concurrentes en componentes y el resto del CSS local se conservaron. Imagen `private-chat-web:ios-top-20261011-1145`. HTTPS devolvió 200 y bytes iguales al build para HTML, JS `/assets/index-CpoGa5hI.js`, CSS `/assets/index-jjkv4r4W.css` y manifest. `/api/ready` 200. Los IDs de los demás contenedores no cambiaron.
- Dependencias nuevas: ninguna. Sin cambios de contrato, API ni secretos. Fuentes locales pendientes de commit/push; incorporarlas a CI para preservar esta entrega. Apariencia final en iPhone real pendiente; cerrar y volver a abrir desde el icono carga el HTML actualizado.
- Rollback conservado en `private-chat-web:before-ios-top-20261011-1145`; artefactos operativos en `/opt/private-chat/.data/releases/ios-top-20261011-1145`. Para volver, etiquetar esa imagen como `private-chat-web:local` y ejecutar `docker compose -f compose.yaml -f compose.atlantic.yaml up -d --no-deps --no-build web` en `/opt/private-chat`.

## Entrega Git de todos los cambios pendientes — 2026-10-11

- El usuario solicitó explícitamente commit y push de todos los cambios, incluidos los de otros componentes. Se incluyen los iconos antiguos modificados y nuevos, ilustración fuente, generador, ajustes de notificaciones/tema, rediseño de burbujas/menús/composer, tests existentes modificados y documentación. Los dos archivos de borrador SMTP del backend se conservan en un commit separado.
- `git diff --check` → OK. Revisión de patrones de credenciales en archivos pendientes → sin coincidencias; `.secrets/` y `.data/` permanecen ignorados.
- `npm run typecheck` → contratos y frontend OK; backend falla con TS2339 en `apps/api/src/notify.ts` porque `AppConfig` no tiene la propiedad `notify`. El borrador y su test no están integrados en la configuración actual. Se preservan tal como estaban por la solicitud de incluir todo; no se ejecutaron tests en esta entrega.
- CI requiere TypeScript correcto antes de desplegar, por lo que este borrador bloquea una reconstrucción automática hasta integrar o retirar la funcionalidad. La publicación manual de los cambios iOS descrita arriba permanece disponible en producción.

## Retirada del borrador de correo — 2026-10-11

- El usuario solicitó eliminar el envío de correo que no utiliza. Se retiraron `apps/api/src/notify.ts` y `apps/api/test/unit/notify.test.ts`; el código no estaba conectado a la configuración ni al flujo de mensajes.
- Búsqueda de referencias SMTP y funciones del módulo en apps, contratos, infraestructura, scripts y workflows → ninguna referencia restante. `git diff --check` → OK. `npm run typecheck` → contratos, API y frontend OK. No se ejecutaron tests locales en esta limpieza; GitHub CI los ejecutará tras el push.
- Esta limpieza resuelve el fallo TS2339 documentado en la entrega anterior. No requiere dependencias, cambios de contrato ni migraciones.

## Telegram oscuro, notas de voz y fondo personal — 2026-10-12

Esta sección describe la entrega actual; las descripciones iniciales de paleta, fuentes, permisos y alcance de los informes históricos anteriores no describen el producto actual. Se leyeron `docs/CONTRACT.md` y `packages/contracts/src/index.ts`; el principal coordinó contrato v7 antes de integrar audio. Se modificaron exclusivamente `apps/web/**` y este informe. No se instalaron dependencias, no se cambió el lockfile y no se delegó a otros agentes.

### Interfaz

- Nueva paleta Telegram Dark y fuente Inter como predeterminadas. Se conservan paletas/fuentes anteriores y preferencias ya guardadas de cada cuenta.
- Pantalla negra, superficies oscuras y acento azul inspirados en las tres capturas del usuario. Doodle original local en SVG, cabecera y compositor de píldora, burbujas redondeadas, separadores de fecha y barra lateral con una sola conversación. No se inventan contactos, grupos ni llamadas.
- Compositor con menú de fotos/videos y botón de voz que cambia a enviar al escribir; conserva stickers, citas, previsualización de medios y confirmación de envíos. Menú de adjuntos cierra con Escape y clic externo.
- Navegación móvil funcional Chat/Ajustes. Ajustes en pantalla completa móvil con perfil circular y controles agrupados; barra de cierre sticky para continuar accesible durante scroll. Desktop conserva panel lateral/chat y diálogo de ajustes.

### Voz (contrato v7)

- `VoiceRecorder.tsx`: permiso real `getUserMedia({audio:true})` exclusivamente tras tocar el micrófono; MediaRecorder elige MP4/WebM/OGG compatible. Contador, parar, reproducción previa sin autoplay, envío explícito y cancelación. Se detiene automáticamente a 179 segundos para dejar margen frente al máximo real de 180 s del servidor; límite cliente de 10 MiB y rechazo de grabación vacía.
- Cancelar, desmontar y `pagehide` liberan tracks y timers; cancelar durante un permiso pendiente también libera el stream si llega tarde. URLs blob se revocan al cambiar/salir. Errores legibles para permiso denegado, ausencia de micrófono, navegador no compatible y envío.
- `MessageAudio.tsx`: audio con controles sin autoplay y duración del servidor; estado de error. Pendientes con audio sólo en memoria, reintento manual usando la misma clave y versión, y descarte tras versión obsoleta como medios existentes. Citas reconocen notas de voz; mensajes confirmados conservan enviado/leído y permisos de borrado actuales.
- `api.ts` envía multipart `audio`, `clientMessageId`, `conversationVersion`, `body`, `replyToMessageId` cuando corresponda, cookies y CSRF; valida respuesta por el schema común. No nuevos endpoints inventados ni datos de grabación en localStorage/logs.

### Fondo personal

- `background.ts` guarda por ID de cuenta en IndexedDB sólo el preset y, si el usuario la eligió, la imagen local. Presets Trazos nocturnos/Negro/Azul profundo/Ciruela/Arena, imagen JPEG/PNG/WebP de hasta 5 MiB y 16 millones de píxeles, restablecer, vista previa y Guardar/Cancelar.
- La UI explica que el fondo sólo se aplica a la cuenta en este navegador; no se sube la imagen ni se envía al contacto. Se reemplaza el registro anterior y se revocan URLs blob. Error de escritura no declara éxito; cancelar conserva el fondo actual. Cambiar de cuenta muestra el fondo predeterminado mientras carga la preferencia de esa cuenta, sin mostrar el fondo de la anterior.

### Archivos de esta entrega

Modificados: `index.html`, `src/App.tsx`, `src/index.css`, `src/themes.css`, `src/lib/{api,api.test,fonts,themes,reply,store}.ts`, `src/hooks/useChat.ts`, `src/components/{AvatarView,ChatPanel,Composer,MessageBubble,ProfileDialog,Sidebar,ThemePicker}.tsx`.

Nuevos: `src/assets/backgrounds/doodle.svg`, `src/lib/background.ts`, `src/components/{BackgroundPicker,VoiceRecorder,MessageAudio}.tsx`, `src/components/{background,voice}.test.tsx`, `src/hooks/audio.test.tsx`.

### Verificación ejecutada

- `npm run typecheck -w @private-chat/web`: OK.
- `npm test -w @private-chat/web`: **16 archivos, 99/99 pruebas OK**. Pruebas nuevas: solicitud explícita de micrófono, cancelación/permiso tardío/desmontaje, rechazo de permiso, cutoff/datos máximos, preview/envío separado, cita/reproductor, multipart CSRF/cookies, reintentos/versiones de audio, fondo confirmar/cancelar/reset/errores/persistencia por cuenta.
- `npm run build -w @private-chat/web`: TypeScript + Vite OK.
- `git diff --check -- apps/web docs/handoffs/frontend.md`: OK.
- Aviso de jsdom: `Not implemented: HTMLMediaElement's play() method` procede de una prueba existente de sonido; la suite completa termina sin fallos.

Pruebas frontend usan doubles de MediaRecorder/getUserMedia/IndexedDB para verificar lifecycle y flujo; no se presentan como captura física de micrófono ni almacenamiento del navegador real. El principal informó QA real en Brave contra PostgreSQL: chat y ajustes móviles correctos, preset Azul profundo guardado y persistente tras recargar. La comprobación integral del API/DB, revisión desktop y despliegue pertenecen al principal; este agente no los ejecutó. Grabación/reproducción física en iPhone/Safari y comprobación del teclado iOS real quedan pendientes de prueba en dispositivo. No se declara E2EE.

Dependencias nuevas: ninguna. La producción requiere el contrato/API v7 y permiso HTTP de micrófono del propio dominio; el principal coordina migración, CSP `media-src 'self' blob:`, proxy y despliegue. No se generaron commits ni push desde este componente.

### Corrección del fondo doodle bajo CSP de producción — 2026-10-12

La QA del principal detectó que Vite inlineaba el SVG pequeño como `data:image/svg+xml`, bloqueado por la CSP existente `img-src 'self' blob:`. Se cambió exclusivamente la referencia de `src/index.css` a `doodle.svg?no-inline`; la CSP conserva su política.

`npm run build -w @private-chat/web` (TypeScript + Vite) y `git diff --check -- apps/web/src/index.css` → OK. Inspección programática del CSS compilado confirma `url(/assets/doodle-DZqywCZc.svg)`, el archivo SVG de 1466 bytes existe en `dist/assets`, y hay **cero `data:image/svg`** en el CSS generado. Artefactos finales: `index-DuKMce5h.css`, `index-C-nHS7hw.js`. No se repitió la suite funcional porque el cambio sólo modifica la emisión del asset; despliegue web y revisión bajo CSP corresponden al principal.


## Recuperación del estilo blanco y personalización — 2026-10-12

- Distribución de la mañana del 11 de octubre: rail de 72 px, cabecera sencilla, entrada clara y fondo liso. Conserva medios, respuestas y controles actuales.
- Blanco original como inicio; variante Nocturno con globos morados y selector de temas completo. Interruptor nocturno alterna variantes compatibles de la paleta.
- Color de los globos propios por cuenta: según tema, seis presets y color personalizado con contraste automático. Cinco fuentes y preferencias existentes conservadas.
- Ajustes a pantalla completa en móvil y escritorio, Cerrar fijo arriba, Escape y foco contenido.
- Copias de los dos componentes con cambios locales anteriores en `.data/appearance-before-original/`, fuera de Git.
- Validación: build frontend y 102 pruebas frontend; QA en Chromium a 1440×900 y 390×844 con datos sintéticos: modo nocturno, colores, cambio de tema/fuente, persistencia tras recargar, dimensiones fullscreen, cierre por botón/Escape y ausencia de overflow horizontal. Capturas en `.data/qa/original-appearance/`. Publicación mediante CI/CD.


## RGB, Nunito, Pinkie Pie y confirmación de vaciado — 2026-10-12

- RGB 0–255 sincronizado con selector, preview y almacenamiento por cuenta; rechazo de valores inválidos.
- Nunito como predeterminada; conserva elecciones explícitas y las otras cuatro fuentes.
- Pinkie Pie: rosas/lavanda/menta pastel. Se conservan TODOS los temas previos, incluidos GitHub Light/Dark, Solarized Light/Dark y Gruvbox Dark.
- Fuego para vaciar; popup centrado «¿Estás seguro?» y «Esto borrará toda la conversación.», Aceptar/Cancelar, entrada desde abajo, backdrop blur y colores activos. Foco contenido/restaurado, Escape y cancelar sin borrar, controles bloqueados durante la operación.
- Validación: build frontend, 107 pruebas; Chromium 1440×900 y 390×844 con datos sintéticos comprobó RGB, fuente inicial, temas, icono, texto, centrado, blur, animación y cancelación sin DELETE. Capturas en `.data/qa/rgb-pinkie-confirmation/`. Publicación por CI/CD.
