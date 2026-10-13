# Sustitución del chat por una redirección

El operador canceló el trabajo del chat y pidió redirigir `marthi.alexisrs.dev` a `https://alexisrs.dev/merci-mon-cheri-to`. La página se implementó en monSite con fondo negro y el GIF original del escritorio, centrado y adaptado a la pantalla.

`infra/Caddyfile.atlantic` mantiene sólo esa redirección 302, sin caché. `infra/redirect-only` hace que el deploy valide y recargue únicamente el bloque de este hostname y mantenga detenidos los servicios API y web del chat. La base, los volúmenes y los archivos privados se conservan. Los cambios locales incompletos de enable/disable no se publicaron.

El helper `scripts/apply-chat-proxy.sh` conserva las demás rutas del proxy y revierte la configuración si falla la recarga. No se ejecutaron builds ni servidores locales en el Mac.
