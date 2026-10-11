# Entrega — paleta neutra y personalización

Solicitud atendida: UI neutra por defecto, diez temas existentes, nombre visible Marthiel, lápiz blanco al hover/foco para editar el nombre y foto propia con vista previa circular sobre fondo oscuro y Guardar/Cancelar debajo.

## Cambios

- `apps/web/src/index.css`, `themes.css`: colores semánticos, diez paletas, superficies claras/oscuras, sombras discretas, foco y lightbox. Colores estáticos compatibles con la CSP.
- `apps/web/src/lib/themes.ts`: catálogo y preferencia por cuenta en este navegador; fallback seguro si no hay almacenamiento o el tema guardado no existe. Se almacena únicamente el identificador visual.
- `apps/web/src/components/ThemePicker.tsx`: diez radios con miniaturas, selección inmediata y navegación nativa por teclado.
- `AvatarEditor.tsx`: al pulsar foto propia, vista ampliada; seleccionar archivo sólo crea preview local. Decodificación y límites del contrato antes de habilitar Guardar. Cancelar no sube archivos; fallos permiten reintento; URLs blob revocadas al cambiar/cerrar.
- `ProfileDialog.tsx`: nombre con lápiz blanco al hover/foco (siempre visible en dispositivos táctiles), foco en el campo al pulsarlo, foto pulsable y selector de temas. Formularios y permisos existentes conservados. Foco contenido y perfil inerte cuando la vista ampliada está abierta.
- `AvatarView.tsx`: recupera imágenes al cambiar la versión después de un fallo previo; círculos por CSS.
- `Sidebar.tsx` y `App.tsx`: acceso a foto propia, estado de personalización y vista ampliada. Se conserva el rail/fullscreen del ajuste anterior.
- `ChatPanel.tsx`, `MessageBubble.tsx`, `Composer.tsx`, `LoginScreen.tsx`, `PasswordGate.tsx`, `ConfirmDialog.tsx`: superficies y texto semánticos, burbujas y acciones adaptadas a claros/oscuros. Se preservaron cambios concurrentes de estructura/escritura.
- `scripts/preview-local.mjs`: nombre inicial Marthiel para admin QA, sin sobrescribir las posteriores ediciones de nombres al reiniciar preview.
- `docs/CONTRACT.md`, `docs/THEMES.md`: preferencias y flujos visuales acordados; fuentes oficiales de las paletas. Sin cambios de DTO ni endpoints.
- `personalization.test.tsx`: pruebas de edición propia, selección de temas, separación de cuentas, persistencia, preview/cancelación, envío con cookies/CSRF/multipart, rechazos y reintentos.

No se instalaron dependencias ni se modificaron manifiestos/lockfile en este ajuste. No se crearon subagentes ni commits. No se modificó código backend.

## Comandos ejecutados y resultados

- `npm run test --workspace @private-chat/web`: **35/35 pruebas, cinco archivos, cero fallos**. Las siete pruebas nuevas son de componentes/hook con HTTP simulado; no se presentan como integración PostgreSQL.
- `npm run build --workspace @private-chat/web`: **OK**, TypeScript y Vite; CSS 36.01 kB, JS 416.13 kB.
- Comprobación numérica de las variables de `themes.css`: **120 pares de texto/fondo ≥4.5:1**, mínimos por paleta 4.53–7.08. Incluye texto principal/secundario en tres superficies, acciones/hover, peligro y lectura. No equivale a una auditoría completa de accesibilidad.
- `npm run preview:local` y `npm run dev --workspace @private-chat/web`: API real en localhost:3000, frontend localhost:5173 y PostgreSQL exclusivo de QA en localhost:55432.
- Script temporal `/tmp/private-chat-personalization-qa.mjs`: login real de ambas cuentas QA, PATCH propio a Marthiel, GET de sesión confirma persistencia, GET conversación de la segunda cuenta confirma que ve Marthiel. Logout sólo de las sesiones auxiliares. **OK contra PostgreSQL**. Sin contraseñas/cookies/tokens en la salida ni cambios a datos de producción.
- Safari: árbol accesible muestra los diez temas y la selección Tokyo Night; captura visual de conversación estrecha con Tokyo Night, cabecera/compositor dentro del viewport. La revisión interactiva completa de la galería y de todos los tamaños no se completó: las acciones de Safari fueron interrumpidas por cambios del usuario en la app. No se afirma verificación visual integral ni subida de un avatar real desde navegador.

Se corrigieron errores del entorno de pruebas: Node 26 ofrece un localStorage sin archivo en Vitest; las pruebas usan un Storage de memoria y no modifican almacenamiento del navegador. Las primeras ejecuciones con ese entorno fallaron; el resultado final de 35/35 corresponde a la ejecución posterior corregida.

## Límites

Los temas se recuerdan por cuenta y navegador, sin sincronización entre dispositivos. Marthiel se guardó en la cuenta QA conectada; no hay cuentas de producción ni despliegue remoto en este trabajo. La imagen suministrada es referencia del lightbox; no se ha subido como avatar del usuario. Los informes anteriores se conservan como histórico.
