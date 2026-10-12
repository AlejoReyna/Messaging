# Stickers de Chiikawa

Catálogo de cinco packs (250 stickers), servido desde la propia web. El usuario eligió cuatro packs de SigStick el 2026-10-12 y pidió que `Chiikawa ちいかわ` aparezca primero. Orden:

| Pack | Stickers | Fuente |
| --- | ---: | --- |
| Chiikawa ちいかわ | 24 | [SigStick](https://www.sigstick.com/pack/tN55DFfHoIcgjLKDH8f0) |
| chiikawa ⭐️ | 116 | [SigStick](https://www.sigstick.com/pack/VPyggyEYYzZwhGfRA97W) |
| Chiikawa Gif 2 (日常） | 50 | [SigStick](https://www.sigstick.com/pack/doIQC8s9O3wb3TJIwQMt) |
| Chiikawa Gif 1 (日常） | 20 | [SigStick](https://www.sigstick.com/pack/xqxHKQAnn0TxkX7zDhME) |
| Chiikawa 4 (original) | 40 | [LINE STORE](https://store.line.me/stickershop/product/17622207/en) |

Copyright de los personajes ©nagano. Los packs de SigStick son publicaciones comunitarias; el nombre del uploader no demuestra autoría ni concede licencia de redistribución. Se descargaron los archivos públicos de los packs elegidos, sin acceder a descargas protegidas. El paquete original conserva sus 40 PNG transparentes y sus IDs anteriores.

El selector permite cambiar de pack, elegir, revisar, quitar y enviar un sticker. Abre siempre en `Chiikawa ちいかわ`; cada pack conserva el orden de su fuente. Conserva cualquier borrador de texto al enviarlo. Una foto y un sticker se envían por separado.

El marcador exacto `[sticker:chiikawa:ID]` ocupa el body del mensaje existente. No hay nuevos endpoints, DTO, columnas ni uploads: PostgreSQL, sesiones, CSRF, secuencia, lectura, reconexión, reintentos y borrado conservan el flujo de texto. Sólo los marcadores completos del catálogo se convierten en imagen; desconocidos, texto mixto o mensajes con foto conservan su representación original. Clientes antiguos verán el marcador como texto.

El catálogo usa IDs estables y assets importados por Vite, con hash de contenido. Los nuevos IDs son `sigstick-PACKID-ARCHIVO` (incluida la versión del archivo fuente); los 40 IDs anteriores no cambian. No quitar ni reutilizar IDs al ampliar el paquete; el historial depende de ellos. Los imports nuevos llevan `?no-inline`, para evitar URLs `data:` bloqueadas por CSP. No se consulta LINE, SigStick ni otro tercero al abrir el selector o recibir un mensaje. Las imágenes del catálogo son recursos públicos de la web; los mensajes y su historial siguen siendo privados.

`node scripts/import-sigstick.mjs` importa únicamente estos cuatro packs y genera `apps/web/src/lib/sigstick-packs.ts`, sus assets locales y `docs/sticker-packs.json` con fuente, hashes, dimensiones y cuadros. Primero descarga y verifica todo en `.data/stickers-import`; antes de escribir rechaza cualquier cambio de bytes sobre un ID ya existente. Algunos archivos fuente `.png` contienen realmente GIF: se decodifican todos sus cuadros y se convierten a WebP sin pérdida cuando se conservan cuadros, tiempos y repeticiones; de lo contrario se guarda el GIF original con su extensión real. Los WebP animados se conservan. El importador usa la dependencia Sharp ya instalada y no modifica el lockfile.

Las miniaturas del selector son WebP estáticos de hasta 128 px; la vista previa del compositor y los mensajes usan el asset completo con animación. `node scripts/import-sigstick.mjs --local` regenera catálogo y miniaturas desde los archivos locales verificados, sin descargar de nuevo.
