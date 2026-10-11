# Fotos iniciales y conservación

Alexis (slot 1/admin) empieza con `infra/profile/alexis.jpg`; Marthiel (slot 2/member), con `infra/profile/marthiel.png`. Son las imágenes entregadas por el usuario. El bootstrap prepara las imágenes con Sharp, sin EXIF, y las copia al volumen privado de avatares al crear cada cuenta. El Dockerfile incluye los originales en la etapa de herramientas de instalación; no se publican como assets del frontend.

Los usuarios siguen cambiando o quitando su propia foto desde el perfil. El servidor guarda únicamente `avatar_path` y el contador de invalidación de caché `avatar_version` en la fila existente de cada cuenta. No hay tabla ni lista de fotos anteriores. Las imágenes están en el volumen de archivos, no como datos binarios en PostgreSQL.

Las actualizaciones y la limpieza se coordinan mediante un bloqueo de PostgreSQL común a los procesos. Tras confirmar una sustitución se elimina el archivo anterior; una transacción fallida conserva la foto válida y retira el archivo nuevo. El arranque limpia archivos huérfanos de operaciones interrumpidas. Un fallo de borrado del sistema de archivos se comunica como error y se vuelve a resolver en esa limpieza; no se oculta como éxito.

Repetir el bootstrap no repone fotos cambiadas o eliminadas. La vista previa recibe una foto inicial sólo mientras `avatarVersion` es cero y no tiene imagen. No se cambian contraseñas, PIN ni mensajes al cargar las fotos en la vista previa.

El límite de una foto por cuenta corresponde al almacenamiento activo. Los assets iniciales son parte fija del instalador, y los respaldos existentes conservan la retención descrita en el procedimiento de backup/restore. No hay un historial de imágenes accesible desde la aplicación.

Después de una instalación nueva, verificar desde las dos cuentas que cada una ve la foto de su contacto; una petición sin sesión al mismo endpoint debe responder 401. Cambiar la imagen debe retirar el archivo anterior del volumen. El test `scripts/integration/avatar.test.mjs` comprueba además subidas simultáneas, borrado concurrente, recuperación de huérfanos y bootstrap idempotente contra PostgreSQL real.
