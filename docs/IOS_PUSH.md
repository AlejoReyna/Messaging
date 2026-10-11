# Notificaciones de Chat en iPhone

## Activación en el dispositivo

Abre Chat desde su icono en inicio. En el perfil, entra en Notificaciones,
toca **Activar notificaciones** y acepta el permiso de iOS. Después usa
**Probar aviso**. La prueba muestra un aviso local; no envía un mensaje a
la otra cuenta ni comprueba el transporte remoto de Apple.

En Ajustes del iPhone › Notificaciones › Chat, permite las notificaciones
y activa la pantalla bloqueada y las tiras. Revisa Concentración y Resumen
programado si quieres verlas al momento. La presentación depende de los
ajustes de iOS, según [Apple Support](https://support.apple.com/guide/iphone/change-notification-settings-iph7c3d96bab/ios).

La app requiere HTTPS, iOS 16.4+ e instalación en inicio; el permiso debe
pedirse como consecuencia directa de un toque. Véase
[WebKit: Web Push en iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Los avisos conservan el contrato v5: “Nuevo mensaje”, sin cuerpo del
mensaje, remitente ni fotos. Esta corrección atiende los avisos del sistema;
no incorpora un contador de mensajes en el icono.

## Diagnóstico y corrección del 2026-10-11

- El endpoint público real `https://marthi.alexisrs.dev/api/push/vapid-key`
  devolvió `enabled: true`.
- La consulta de sólo lectura en PostgreSQL de producción encontró cero
  suscripciones en cada slot. No había un dispositivo al que enviar push.
- La UI esperaba `serviceWorker.ready` sin haber registrado el worker.
  Ahora registra `/sw.js` antes de consultar la suscripción y devuelve el
  registro activo.
- Activar solicitaba primero la clave por HTTP y después el permiso. Ahora
  prepara la clave y el registro antes de habilitar el botón; el permiso se
  solicita directamente durante el toque, sin esperar otra petición HTTP.
- Una suscripción local con permiso se guarda de nuevo para la cuenta
  autenticada al abrir ajustes. Sólo se muestra “activadas” después de que
  el API confirme el guardado. Los fallos de red permiten reintentar.

No se añadieron endpoints ni DTO, dependencias, claves ni cambios de base.

## Comprobaciones y publicación

Se ejecutaron las 81 pruebas de frontend de la versión aislada (81/81),
la compilación y los cuatro casos
existentes del API push contra `private_chat_integration`, PostgreSQL real
aislado en el puerto local 55432. Los casos comprueban sesiones, guardado,
reasignación y borrado de suscripciones entre dos cuentas. El transporte
push se inyecta en esas pruebas: no son evidencia de recepción en iOS.
La suite existente terminó con un log de teardown sobre un pool cerrado
para un aviso asíncrono; sus cuatro casos pasaron.

La versión final se compiló en `.data/ios-push-isolated` a partir de
`04edf47` más esta corrección y el cambio de iconos autorizado. Así se
conservan los cambios concurrentes de otros modelos en el workspace.
Sólo se recreó `private-chat-web-1`; se compararon los IDs del resto de
contenedores antes y después y permanecieron iguales. El API siguió sano.

Imagen: `private-chat-web:ios-push-20261011-1132`, también etiquetada
`private-chat-web:local`. Bundle publicado: `/assets/index-KQ1v3B4q.js`.
Se compararon los bytes servidos por HTTPS de HTML, JavaScript, manifiesto,
worker e icono Apple con la compilación aislada: coincidieron. HTML,
manifiesto y worker respondieron `Cache-Control: no-store`; `/api/ready`
respondió 200.

Artefactos de publicación en el VPS:
`/opt/private-chat/.data/releases/ios-push-20261011-1130`.
Rollback web: etiquetar `private-chat-web:before-ios-push-20261011-1130`
como `private-chat-web:local` y recrear sólo web con el overlay Atlantic.
También se conservó la imagen que estaba etiquetada como local antes de
publicar: `private-chat-web:before-tag-ios-push-20261011-1130`.

El árbol Git remoto se conservó limpio durante la publicación manual.
Los cambios de fuente se incluyen en la entrega Git posterior del 2026-10-11,
junto con todos los cambios pendientes solicitados por el usuario.
La recepción de un mensaje real en un iPhone sigue pendiente de activación
y comprobación en el dispositivo; no se enviaron mensajes de prueba en
la conversación de producción.
