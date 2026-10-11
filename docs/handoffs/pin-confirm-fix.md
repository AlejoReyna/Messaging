# Corrección de confirmación del PIN — 2026-10-11

## Causa comprobada

El usuario precisó que el fallo sucedía al confirmar el código y aportó una captura con «Usuario o contraseña incorrectos» seguida del texto de creación del PIN. `pin-setup` valida la respuesta secreta después de que la UI confirme los cuatro dígitos. Si devuelve `401 INVALID_CREDENTIALS`, el PIN ya coincidió y lo rechazado es la respuesta. La UI capturaba el error y volvía a `setup`, conservando la respuesta equivocada sin ningún control para editarla. El traductor HTTP utilizaba el mensaje de login con contraseña también para la pregunta y el PIN.

Dos pruebas nuevas reprodujeron los fallos antes de corregirlos: no se podía volver a editar la respuesta rechazada y no se mostraba/conservaba correctamente un error de conexión en confirmación.

## Cambios

- `apps/web/src/components/GateScreen.tsx`: una respuesta rechazada vuelve a la pregunta, conserva el texto editable, limpia los dos PIN y muestra el error correspondiente. Errores de conexión mantienen la confirmación para reintentar. Un alta completada desde otro dispositivo cambia al acceso con PIN. Botón «Corregir respuesta» en creación/confirmación; cancela el temporizador pendiente. Se muestran errores locales de la operación actual, evitando arrastrar el error anterior del contexto.
- `apps/web/src/lib/api.ts`: mensajes específicos para respuesta incorrecta, PIN incorrecto y alta ya completada. Login por contraseña conserva su texto. Sin cambios de endpoints, DTO, secretos ni autenticación del servidor.
- `apps/web/src/components/gate.test.tsx` y `apps/web/src/lib/api.test.ts`: regresiones de corrección, reintento, cancelación y alta desde otro dispositivo; traducción contextual de errores.
- `scripts/integration/pin-gate.test.mjs`: React y contexto de sesión reales, HTTP real con cookie jar y PostgreSQL exclusivo de integración. Verifica respuesta errónea sin PIN/sesión creados, corrección sin recarga, confirmación, acceso a conversación, logout con revocación y nuevo login con cookie distinta. También comprueba la cuenta administradora y separación de roles. Datos exclusivamente sintéticos.

## Verificación ejecutada

- `npm run test --workspace @private-chat/web`: 50 pruebas pasaron al completar la corrección.
- `npm run build:contracts` y `npm run build --workspace @private-chat/web`: compilación y tipos correctos.
- `npm run test:db:start`: PostgreSQL nativo exclusivo en loopback:55432, base `private_chat_integration`.
- `node --import tsx --test --test-concurrency=1 scripts/integration/pin-gate.test.mjs`, con URL de integración suministrada en entorno sin imprimirla: 1 prueba completa pasó.
- `node --import tsx --test --test-concurrency=1 apps/api/test/integration/auth.test.ts apps/api/test/integration/pin-auth.test.ts`, mismo entorno: ejecución final 20/20. Una ejecución anterior encontró 404 frente a 403 en una prueba de borrado mientras otro trabajo modificaba ese comportamiento y su prueba; no se modificaron esos archivos como parte de esta corrección. La ejecución final pasó tras quedar actualizada esa prueba por su propietario.
- Advertencias no bloqueantes del entorno de pruebas: Fastify deprecación de `disableRequestLogging`; jsdom multimedia y Node localStorage durante la suite web.

## Despliegue verificado

SSH con el perfil exclusivo y comprobación estricta del host existente. Se capturaron los archivos desplegados y sus hashes antes de cambiarlos. Se aplicó únicamente la diferencia de manejo de errores/PIN sobre esos archivos, conservando la versión y demás cambios del servidor. No se subió toda la copia local ni el lockfile. Se guardaron originales y metadatos de contenedores en `/opt/private-chat/.data/pin-confirm-rollback-20261011`.

Se construyó el stage `build` de `infra/web.Dockerfile` en Node 24 y se ejecutaron allí las regresiones de Gate y API: 19/19 pasaron. Luego:

```sh
docker compose -f compose.yaml -f compose.atlantic.yaml build web
docker compose -f compose.yaml -f compose.atlantic.yaml up -d --no-deps web
```

Sólo se recreó `private-chat-web-1`. API y PostgreSQL conservaron sus imágenes y fechas de arranque; permanecieron saludables. No se recargó el proxy externo ni se operó sobre los otros proyectos del VPS.

El dominio HTTPS respondió 200, HTML con `Cache-Control: no-store`; el bundle `/assets/index-oEGYSUky.js` contiene la nueva corrección. Health, ready, sesión anónima con CSRF y pin-status devolvieron 200; mensajes sin sesión devolvieron 401. `memberPinSet` seguía en `false`. Se comprobó que el archivo de respuesta secreta existe, no está vacío y no es el placeholder del ejemplo, sin revelar su contenido.

En una pestaña independiente se comprobó en la web pública la presencia de «Corregir respuesta» y que devuelve a la pregunta con el texto editable enfocado. No se introdujo ni guardó un PIN en producción. Captura: `.data/screenshots/pin-confirm-fix-production.png`.

## Límites y dependencias

Sin nuevas dependencias. El alta y segundo acceso completos se verificaron contra PostgreSQL de pruebas, con cuentas sintéticas. El PIN de producción debe elegirlo su usuario y la respuesta debe coincidir con el secreto configurado; no se reemplazaron credenciales. El despliegue de esta tarea incluye únicamente la corrección del PIN, no otros cambios concurrentes de interfaz/permisos presentes en el workspace. Se conservaron sus archivos sin revertirlos ni incluirlos en un commit.

## Seguimiento: respuesta confirmada por el usuario

El usuario aportó otra captura y confirmó explícitamente que la respuesta allí escrita debe ser la correcta. Se comparó sin imprimir secretos con el archivo montado y con `loadConfig()` del contenedor: ambos indicaron que la respuesta configurada era distinta. La primera corrección había reparado la recuperación de la pantalla, pero no esta discrepancia de configuración.

Con esa confirmación se corrigió únicamente `/opt/private-chat/.secrets/guest_setup_secret` en el VPS, sin incluir el valor en código, documentos del repositorio o logs. Se preservaron inode, propietario/grupo 10001:10001 y permisos 0600 para que el bind mount existente vea el contenido actualizado. La conexión SSH root no estaba disponible; se utilizó el usuario operativo y un contenedor temporal sin red, con filesystem de imagen read-only, sin capacidades y bajo UID/GID 10001:10001, con acceso de escritura exclusivamente a ese archivo secreto.

Se reinició únicamente `api` para volver a cargar la configuración. Una comprobación inmediatamente posterior encontró que aún estaba arrancando; el reintento confirmó configuración coincidente con la respuesta indicada y readiness 200. Health, ready, pin-status y sesión anónima con CSRF también respondieron 200 por HTTPS. API y PostgreSQL quedaron saludables. El alta de invitado permaneció pendiente (`memberPinSet: false`): el usuario debe elegir su PIN; no se creó una credencial en su nombre.

## Reinicio del PIN solicitado posteriormente

El usuario pidió explícitamente reiniciar el PIN para que el invitado elija su propio código. En PostgreSQL de producción se bloqueó la fila del slot 2 y se restablecieron, dentro de una transacción, `pin_hash = NULL`, `pin_failed_attempts = 0` y `pin_locked_until = NULL`; también se revocaron sus sesiones aún no revocadas. El PIN existía antes del reinicio y no había sesiones adicionales pendientes de revocar (0). Se comprobó dentro de la transacción que el PIN del administrador conservaba el mismo hash, sin imprimirlo. No se operó sobre mensajes, perfiles ni contraseñas.

La comprobación posterior por HTTPS devolvió `memberPinSet: false` y readiness 200. No se eligió un PIN de reemplazo: al recargar la web, el invitado vuelve al flujo de pregunta, creación y confirmación de su código.
