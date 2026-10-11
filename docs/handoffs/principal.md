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
