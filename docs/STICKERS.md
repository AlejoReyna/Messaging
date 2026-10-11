# Stickers de Chiikawa

Paquete de 40 imágenes PNG transparentes, servido desde la propia web. Fuente: [Something small and cute 4 — nagano, LINE STORE](https://store.line.me/stickershop/product/17622207/en). Copyright ©nagano; no se presenta como contenido propio ni se concede una licencia de redistribución. Las imágenes son las vistas previas públicas del paquete; no se accedió a una descarga protegida.

El selector permite elegir, revisar, quitar y enviar un sticker. Conserva cualquier borrador de texto al enviarlo. Una foto y un sticker se envían por separado.

El marcador exacto `[sticker:chiikawa:ID]` ocupa el body del mensaje existente. No hay nuevos endpoints, DTO, columnas ni uploads: PostgreSQL, sesiones, CSRF, secuencia, lectura, reconexión, reintentos y borrado conservan el flujo de texto. Sólo los marcadores completos del catálogo se convierten en imagen; desconocidos, texto mixto o mensajes con foto conservan su representación original. Clientes antiguos verán el marcador como texto.

El catálogo usa IDs estables y assets importados por Vite, con hash de contenido. No quitar ni reutilizar IDs al ampliar el paquete; el historial depende de ellos. No se consulta LINE ni otro tercero al abrir el selector o recibir un mensaje. Las imágenes del catálogo son recursos públicos de la web; los mensajes y su historial siguen siendo privados.
