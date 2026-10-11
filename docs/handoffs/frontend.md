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
