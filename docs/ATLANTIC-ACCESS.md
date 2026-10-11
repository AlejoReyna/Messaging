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
- Instalación de la clave en un VPS y autenticación SSH real pendientes.
- La clave preexistente `artisanal_codex` se conserva.
- No se creó, reinició, reprovisionó ni modificó ningún VPS; no se desplegó la aplicación.

El puerto 22 respondió con un banner OpenSSH. Esto demuestra conectividad, no autenticación ni identidad verificada del servidor. La contraseña proporcionada por el usuario permitió iniciar sesión como `root` en la consola de Atlantic.net. No se guardó esa contraseña en archivos del proyecto.

La interacción de teclado de la consola se interrumpe al cambiar las pestañas; la comprobación de la huella y la instalación de la clave aún no se han completado. Se preparó un perfil SSH local con verificación estricta del host y autenticación exclusivamente por clave. El usuario `artisanalbrew` del perfil procede de la documentación histórica y se debe confirmar en el VPS antes de instalar la clave.

Se obtuvo por la red una clave pública candidata del host, con huella `SHA256:lul/szOpT036g2WQy1sFKGbHiT+bsfGadKvJkbhF/Rc`. No se ha confiado en ella: falta compararla con la huella leída desde la consola autenticada antes de crear `/Users/alexis_reyna/.ssh/private_chat_atlantic_known_hosts`.

La documentación local del despliegue ArtisanalBrew identifica al usuario operativo `artisanalbrew` y una clave anterior en `~/.ssh/artisanalbrew-atlantic-codex`; ese archivo no existe en este Mac. Se solicitó iniciar sesión en la consola con el acceso administrativo existente o indicar la ruta de una clave existente. No se intentó resetear contraseñas ni habilitar SSH por contraseña.

## Compatibilidad con los despliegues existentes

La documentación local de ArtisanalBrew indica que su Caddy ocupa 80/443 y utiliza `/opt/artisanalbrew/Caddyfile`. Falta contrastar esta información con el estado real del VPS y enumerar los demás servicios.

Se intentó consultar la URL histórica `https://cafe.alexisreyna.dev/` desde este entorno, pero no resolvió DNS. Esta comprobación no verifica la disponibilidad actual de los despliegues; la documentación histórica no sustituye la inspección del servidor.

No ejecutar directamente el `compose.yaml` del chat en este VPS: actualmente publica 80/443 y entraría en conflicto con el proxy existente. Al desplegar se debe conservar el proxy activo e integrar un hostname nuevo mediante una configuración revisada y validada; el chat debe tener proyecto Compose, PostgreSQL, redes, volúmenes, directorio y secretos independientes. No cambiar datos, credenciales, reglas de firewall ni servicios de los otros proyectos como parte de la preparación del acceso.

Registrar una clave en el portal permite seleccionarla al crear un servidor. Para un servidor existente también hay que instalar la clave pública en el `authorized_keys` del usuario autorizado mediante un acceso administrativo existente. El registro en el portal por sí solo no demuestra acceso SSH.

Antes de la primera conexión, verificar la huella SSH del servidor mediante la consola de Atlantic.net u otro canal confiable y guardarla en un `known_hosts` dedicado. No desactivar `StrictHostKeyChecking` ni aceptar automáticamente una huella obtenida sólo de la red.

Para publicar el chat, continuar con [la receta de producción](ATLANTIC.md) después de confirmar el acceso real, dominio y respaldo externo.

Referencia: [API oficial de Atlantic.net: SSH Keys](https://www.atlantic.net/docs/api/).
