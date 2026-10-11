# Acceso de despliegue a Atlantic.net

Preparado el 2026-10-10. Este archivo contiene únicamente metadatos; no contiene claves privadas ni contraseñas.

## Clave exclusiva del proyecto

- Nombre registrado en el portal: `private_chat_deploy` (ID `67081`).
- Tipo: Ed25519.
- Clave privada local: `/Users/alexis_reyna/.ssh/private_chat_atlantic_ed25519`, fuera del repositorio, permisos `0600`.
- Clave pública local: `/Users/alexis_reyna/.ssh/private_chat_atlantic_ed25519.pub`.
- Huella pública: `SHA256:NgUiHj1HkOKt80vuHj9JqmeNX6n5bMB0QnUS9y+gUOg`.
- Se verificó que la clave pública corresponde a la privada, sin imprimir la privada.
- Perfil SSH local independiente: `/Users/alexis_reyna/.ssh/private_chat_atlantic.conf`, permisos `0600`; no se modifica el perfil SSH global.

No copiar la clave privada al VPS, a la aplicación, al chat ni al repositorio. La clave permite automatización local sin passphrase; proteger el acceso al Mac y conservar una copia privada si se necesita recuperación.

## Estado

- Sesión autenticada del portal de Atlantic.net revisada.
- Clave pública registrada en Atlantic.net; su presencia se verificó en la lista del portal.
- Servidor elegido por el usuario: `ArtisanalBrew`, ID `2463976`, IPv4 `209.23.11.117`.
- Restricción explícita del usuario: conservar los otros despliegues del VPS.
- Clave pública `private-chat-atlantic-deploy` instalada en `/root/.ssh/authorized_keys` y `/home/artisanalbrew/.ssh/authorized_keys`.
- La clave preexistente `artisanal_codex` se conserva.
- Permisos comprobados: `/root/.ssh` y `/home/artisanalbrew/.ssh` en `0700`; `authorized_keys` en `0600`; propiedad del home SSH de `artisanalbrew` correcta.
- El proyecto privado está desplegado en `/opt/private-chat`; el ajuste reciente reconstruyó exclusivamente su servicio web.
- No se reinició el VPS ni se modificó o recargó el Caddy existente; los contenedores de ArtisanalBrew y otros proyectos permanecieron activos.

La contraseña proporcionada por el usuario permitió iniciar sesión como `root` en la consola de Atlantic.net. No se guardó esa contraseña en archivos del proyecto.

Se verificó desde la consola autenticada la huella del host `SHA256:lul/szOpT036g2WQy1sFKGbHiT+bsfGadKvJkbhF/Rc`; coincide con `ssh-keyscan`. También se verificó el inicio de sesión SSH con la clave exclusiva del proyecto como `artisanalbrew`, usando el perfil local con `StrictHostKeyChecking yes`, autenticación sólo por clave y `known_hosts` dedicado.

La huella pública de la clave instalada es `SHA256:NgUiHj1HkOKt80vuHj9JqmeNX6n5bMB0QnUS9y+gUOg` (`private-chat-atlantic-deploy`). La conexión SSH autenticada confirmó que la clave está activa para el usuario operativo.

No se intentó resetear contraseñas ni habilitar SSH por contraseña.

## Compatibilidad con los despliegues existentes

La inspección de sólo lectura del VPS confirmó `artisanalbrew-caddy-1` activo, junto con los servicios web, gateway, worker y PostgreSQL de ArtisanalBrew. También siguieron activos los dos proyectos Monetta y `alice-storage`. El proyecto `private-chat` usa Compose, PostgreSQL y web separados, conectados a la red externa de Caddy.

La web de Private Chat respondió en `https://marthi.alexisrs.dev/` tras reconstruir sólo su contenedor web.

No ejecutar directamente el `compose.yaml` del chat en este VPS: actualmente publica 80/443 y entraría en conflicto con el proxy existente. Al desplegar se debe conservar el proxy activo e integrar un hostname nuevo mediante una configuración revisada y validada; el chat debe tener proyecto Compose, PostgreSQL, redes, volúmenes, directorio y secretos independientes. No cambiar datos, credenciales, reglas de firewall ni servicios de los otros proyectos como parte de la preparación del acceso.

Registrar una clave en el portal permite seleccionarla al crear un servidor. Para un servidor existente también hay que instalar la clave pública en el `authorized_keys` del usuario autorizado mediante un acceso administrativo existente. El registro en el portal por sí solo no demuestra acceso SSH.

Antes de la primera conexión, verificar la huella SSH del servidor mediante la consola de Atlantic.net u otro canal confiable y guardarla en un `known_hosts` dedicado. No desactivar `StrictHostKeyChecking` ni aceptar automáticamente una huella obtenida sólo de la red.

Para publicar el chat, continuar con [la receta de producción](ATLANTIC.md) después de confirmar el acceso real, dominio y respaldo externo.

Referencia: [API oficial de Atlantic.net: SSH Keys](https://www.atlantic.net/docs/api/).
