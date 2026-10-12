# Temas y personalización

Quince opciones de apariencia para el chat. Se conservan sus colores de fondo y acento, asignándolos a superficies, texto, burbujas y acciones. Blanco original vuelve a ser la opción inicial desde el 2026-10-12; Nocturno añade globos morados. Las doce paletas anteriores se conservan y se añade Madoka, una combinación propia de rosas, lavanda y menta pastel.

| Temas | Fuente original |
| --- | --- |
| GitHub Light y GitHub Dark | [GitHub Primer Primitives](https://github.com/primer/primitives) |
| Catppuccin Latte y Catppuccin Mocha | [Catppuccin: paletas oficiales](https://github.com/catppuccin/catppuccin#-palette) |
| Dracula | [Dracula: especificación](https://draculatheme.com/spec) |
| Nord | [Nord: colores y paletas](https://www.nordtheme.com/docs/colors-and-palettes/) |
| Solarized Light y Solarized Dark | [Solarized, Ethan Schoonover](https://ethanschoonover.com/solarized/) |
| Gruvbox Dark | [Gruvbox](https://github.com/morhetz/gruvbox) |
| Tokyo Night | [Tokyo Night](https://github.com/folke/tokyonight.nvim) |

Los colores funcionales de lectura, peligro y texto secundario siguen la paleta. Madoka usa texto blanco en los globos por elección explícita del usuario. No son paquetes oficiales de estas marcas ni cambios en la identidad de la app.

`apps/web/src/themes.css` contiene Blanco original, Nocturno, Madoka y las doce paletas previas mediante variables CSS y selectores `data-theme`. Blanco original es la opción inicial del administrador; Madoka es la del miembro, con texto blanco dentro de los globos. El administrador conserva `private-chat:theme:v2:<userId>`; el miembro usa `private-chat:theme:v3:<userId>` para recibir Madoka una vez y recordar elecciones posteriores. Se migra el identificador pinkie-pie a madoka. El interruptor nocturno alterna pares de paletas claros/oscuros cuando existen. No requiere fuentes externas ni dependencias nuevas. Los componentes usan colores semánticos, incluidos texto de botones y diálogos de peligro en temas oscuros.

La preferencia usa la clave `private-chat:theme:v2:<userId>` en localStorage y sólo almacena el identificador del tema. No contiene credenciales, tokens, nombres, fotos ni mensajes. Es local a la cuenta y al navegador: no se sincroniza entre dispositivos. Si el almacenamiento está bloqueado, la selección funciona durante la sesión; si el valor guardado no existe, se usa el tema predeterminado de su rol.

El nombre y el avatar siguen guardándose por las rutas existentes del contrato, con cookies y CSRF. Los nombres Alexis (admin) y Marthiel (member) corresponden a las cuentas de vista previa QA; no se inventan ni modifican cuentas de producción. El bootstrap de preview conserva las posteriores ediciones del nombre.

## Tipografías (Ajustes › Tipografía)

5 opciones; Nunito es ahora la predeterminada de toda la interfaz; Patrick Hand sigue disponible. Inter, Nunito y Noto Serif viajan autohospedadas en `apps/web/src/assets/fonts/` (woff2 latin + avisos OFL), sin peticiones externas ni cambios de DTO: la preferencia usa la clave `private-chat:font:<userId>` en localStorage, por cuenta y navegador, igual que el tema. SF Mono Light no se distribuye (propietaria de Apple): si está instalada en el dispositivo se usa en peso ligero, y en el resto cae a la monoespaciada del sistema (`ui-monospace`).

La foto seleccionada usa una URL blob local, revocada al reemplazar la selección o cerrar la vista. Guardar queda deshabilitado hasta que el navegador decodifique la imagen. Cancelar no sube ni guarda archivos. Un error del servidor conserva la selección para permitir reintentar. La CSP existente admite imágenes blob y sigue prohibiendo scripts y estilos inline.

## Área superior de iPhone

La cabecera usa `--color-header` cuando existe (Madoka) y `--color-surface` en los otros temas. `useTheme` aplica `data-theme` y lee el mismo token CSS para actualizar `meta[name="theme-color"]` antes de pintar. Esto cubre Telegram Dark y las once paletas previas, la selección manual y la preferencia guardada sin duplicar los colores en TypeScript. HTML y body también usan el color de cabecera en los bordes del viewport; `#root` conserva el fondo de contenido `--color-canvas`.

HTML y manifest arrancan con `#ffffff`, superficie del tema Blanco original. Se conservan `viewport-fit=cover`, la separación de la cabecera mediante `env(safe-area-inset-top)` y el estilo de status bar `default`. La documentación de [WebKit sobre Safari 15](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/) describe `theme-color` para la barra de estado y overscroll; [Apple documenta los estilos de status bar](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html). El acabado que aplica iOS debe comprobarse en un iPhone real, tanto desde el icono de inicio como en Safari.


## Color de los globos y ajustes a pantalla completa

`useBubbleColor` guarda por cuenta `theme` o un color hexadecimal en `private-chat:bubble:<userId>`. Sólo afecta los mensajes propios y sus pendientes; las fuentes y los temas siguen siendo independientes. El texto se elige entre blanco/negro mediante luminancia relativa para maximizar contraste. Volver a Según el tema elimina las variables CSS personalizadas; Nocturno usa morado por defecto. Ajustes tiene dimensiones del viewport y barra superior fija con Cerrar; Escape también lo cierra.


RGB admite canales enteros de 0 a 255 y sincroniza el selector de color, la vista previa y la preferencia guardada. Valores vacíos o fuera de rango no se publican. El botón de fuego abre una confirmación centrada con desenfoque del fondo y entrada desde abajo; la animación respeta movimiento reducido. La superficie usa la paleta activa y Confirmar usa el color personalizado de globos si existe. El foco queda dentro del popup y vuelve al botón al cerrar.


En Madoka los globos recibidos, sus colas y sus textos usan `--theme-bubble`/`--theme-bubble-ink`, igual al rosa de Según el tema para los propios. La cabecera y la barra de Safari usan `--color-header: #fbd1e6`. La presencia conectada usa verde fijo `#22c55e`, separado de los acentos de la paleta.
