# Primera subida a GitHub

Destino autorizado por el usuario el 2026-10-10: `https://github.com/AlejoReyna/Messaging.git`, repositorio inicialmente vacío. Se subió la primera versión del monorepo a `main`, en commits separados para infraestructura/contratos (`d59f191`), backend (`c1ba805`) y frontend (`fd0aa59`), conservando las entregas y los cambios de las otras sesiones. `git push -u origin main` terminó con código `0`. No se despliega esta versión al VPS.

La revisión previa excluye `.secrets`, `.data`, archivos `.env` reales, dependencias, compilados y claves privadas. La clave SSH del chat y su perfil local están fuera del repositorio.

## Verificación ejecutada antes de la subida

`npm run verify:local` se ejecutó sobre el cluster PostgreSQL exclusivo de integración en loopback `55432`. Las dos primeras ejecuciones se detuvieron en errores de TypeScript mientras otra sesión editaba el acceso con PIN. Tras nuevas modificaciones, la tercera ejecución produjo:

- Contratos e infraestructura: 12 pruebas aprobadas.
- Backend unitario: 25 pruebas aprobadas.
- Frontend: 35 pruebas aprobadas.
- TypeScript y compilación de los tres paquetes: correctos.
- Integración PostgreSQL del API: 41 pruebas aprobadas y 1 fallida, sin omisiones.
- Fallo observado en `apps/api/test/integration/pin-auth.test.ts:112`: la prueba «cambio de PIN exige el actual y deja entrar con el nuevo» esperaba HTTP `401` y recibió `403`.
- El verificador salió con código `1` y no ejecutó la comprobación posterior de runtime restringido/WebSocket.

Esta subida conserva trabajo en curso. El fallo del acceso con PIN debe revisarse en la sesión responsable antes de considerar esta versión lista para producción. La verificación histórica del MVP anterior no sustituye la validación del contrato v2 y del código actual. No se modificaron archivos del frontend ni backend durante esta preparación de acceso y publicación.

## Atlantic.net

`private_chat_deploy` está registrada en el portal. Se autenticó una sesión administrativa en la consola del VPS elegido; la instalación de la clave y la autenticación SSH todavía están pendientes. Consultar [el estado del acceso](ATLANTIC-ACCESS.md). Los despliegues existentes se conservan.
