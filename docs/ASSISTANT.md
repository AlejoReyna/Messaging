# Alexis AI

El backend puede responder automáticamente los mensajes nuevos de texto del miembro en la conversación principal. Las respuestas se guardan con la cuenta del administrador y el prefijo visible `🤖 Alexis AI`; no se presenta a la IA como Alexis en persona. Ambos usuarios conservan sus permisos de borrado y el administrador puede editar las respuestas de su cuenta.

Esta integración usa Kimi K2.6 directamente desde el servidor privado, independientemente del endpoint público del portafolio. No se reutiliza el dossier del portafolio. El cambio autoriza el envío del contexto privado configurado y de hasta 24 mensajes recientes de texto al proveedor elegido. No se envían cookies, datos de autenticación, bytes de fotos, videos ni audios. Los adjuntos y stickers se representan con una descripción genérica. Los mensajes con adjuntos no disparan respuestas automáticas.

## Configuración privada

Por defecto está desactivado. Para habilitarlo, el servidor necesita:

- `ASSISTANT_ENABLED=true`.
- `ASSISTANT_AUTO_REPLY_ENABLED=true` para respuestas ordinarias automáticas; `false` permite únicamente pruebas explícitas con `--test`.
- `ASSISTANT_PROVIDER=moonshot` o `openrouter`.
- `ASSISTANT_API_KEY_FILE`: archivo privado con la clave del proveedor.
- `ASSISTANT_CONTEXT_FILE`: archivo privado de texto con el contexto y las preferencias del operador.

El contexto debe permanecer fuera del repositorio y fuera del directorio servido por la web. La clave puede residir en `.secrets/kimi_api_key`, ignorada por Git y por Docker. Usar permisos 600 para ambos archivos; garantizar que el usuario runtime pueda leerlos en el servidor. No introducir datos personales en este documento, `.env.example`, código, imágenes de contenedor o pruebas.

El overlay `compose.assistant.yaml` monta ambos como secretos únicamente en `api`. Usa `.secrets/kimi_api_key` y exige `ASSISTANT_CONTEXT_HOST_FILE` con la ruta absoluta del contexto en el VPS. Se aplica además de `compose.yaml` y de los overlays que use el despliegue existente, incluido `compose.atlantic.yaml` en Atlantic. El despliegue automatizado debe incluir explícitamente este overlay si se activa la función. No ejecutar el Compose base sin el overlay de Atlantic en el VPS compartido.

Para deshabilitar las respuestas, establecer `ASSISTANT_ENABLED=false` y recrear únicamente el servicio API con su configuración actual. Quitar el overlay tiene el mismo efecto después de recrear el servicio.

## Pruebas desde el chat

Enviar un mensaje de texto con un único prompt entre comillas simples o dobles:

```text
--test 'Hola quién soy yo'
--test "Hola quién soy yo"
```

Ambas cuentas autenticadas pueden usarlo. El servidor extrae el texto entre comillas y lo trata como una consulta del interlocutor, incluso cuando lo envía el administrador. No ejecuta un comando de terminal ni cambia las instrucciones privadas. La respuesta lleva `🧪 Alexis AI · prueba` y usa el mismo contexto, modelo y controles de concurrencia que las respuestas ordinarias.

El comando y la respuesta se guardan en la conversación principal y son visibles para ambas cuentas. No activa permanentemente las respuestas automáticas. Para probar antes de activarlas, configurar `ASSISTANT_ENABLED=true` y `ASSISTANT_AUTO_REPLY_ENABLED=false`, con los archivos privados de clave y contexto disponibles.

Sin comillas, con comillas sin cerrar, prompt vacío o texto adicional después del cierre, el servidor rechaza el envío con instrucciones de uso. Los adjuntos no se admiten con `--test`. Si Alexis AI no está configurado, la prueba se rechaza antes de guardar el mensaje. Las comillas que delimitan el prompt pueden escaparse con una barra inversa dentro de éste.

## Comportamiento

Agrupa mensajes escritos con menos de 1.5 segundos de separación y permite una sola generación a la vez por proceso. Límite de diez generaciones por minuto por proceso y timeout de 30 segundos, sin reintentos automáticos. Una respuesta manual nueva cancela la generación pendiente. Antes de guardar, vuelve a comprobar bajo el bloqueo de PostgreSQL que no hubo mensajes nuevos, edición, borrado o vaciado. Los identificadores deterministas y tombstones evitan respuestas duplicadas y resurrección de respuestas borradas, incluso si dos procesos intentan guardar para el mismo mensaje.

La generación sucede fuera de la transacción de PostgreSQL. El modelo recibe instrucciones para hablar en español mexicano con naturalidad, ser comprensivo, usar humor ligero, respetar relaciones y reconocer lo que desconoce de Alexis. Nunca asume disponibilidad ni hace compromisos en su nombre. Sólo se publica una respuesta de texto completa; no se muestran razonamiento interno ni errores del proveedor. Los logs de esta integración no contienen clave, contexto, historial o respuesta.

No marca los mensajes como leídos por Alexis ni inventa presencia o escritura. Las respuestas usan los eventos Socket.IO y el push genérico ya existentes. Si Kimi falla, el mensaje original permanece guardado y no se publica texto fingido. Las tareas pendientes viven en memoria: un reinicio puede dejarlas sin contestar y no se responde retrospectivamente el historial al activar la función.

Referencia de protocolo: [Kimi K2.6, documentación oficial](https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart). Se desactiva thinking para este flujo y se conservan los parámetros de muestreo predeterminados del proveedor.
