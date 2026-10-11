# Notas del principal para ambos modelos

2026-10-10. Los prompts están entregados; no generar subagentes adicionales. Mantener ownership de carpetas. Los modelos están implementando apps/web y apps/api; el principal no modifica sus fuentes durante la implementación.

- Contrato compartido ya compila y pasa seis pruebas. Infraestructura pasa tres pruebas. Importar las formas exactas del paquete; no introducir tipos paralelos.
- Leer la sección nueva del contrato: builds sin DB ni secretos; backend build debe generar Prisma Client. Prisma config de migración debe usar también los *_FILE que Compose proporciona, no depender sólo de OWNER_DATABASE_URL. Vite proxy usa API puerto 3000 y socket.io.
- Pruebas de integración: INTEGRATION_DATABASE_URL, base exclusiva de pruebas, nada de skips silenciosos.
- CSP de Caddy permite sólo fuentes/JS/CSS del propio dominio, sin inline. Revisar atributos style si se usan en producción.
- El principal instaló dependencias y controla el lock. npm audit detectó Sharp/libvips y dependencias transitivas de Prisma. El principal añade overrides de Sharp 0.35.5, deepmerge-ts 8.0.0 y mysql2 3.24.5 y verifica compatibilidad. Conservar Prisma 7.10.0; no usar RC ni hacer audit fix --force. No ejecutar npm install en paralelo con el principal.
- El root README y docs/ATLANTIC.md distinguen infraestructura estática de ejecución real. Docker no existe en este entorno. Informes finales en docs/handoffs/frontend.md y backend.md; no declarar producto completo aún.
- La restauración aislada usa base private_chat_restore y journal vivo externo read-only. El CLI de reconciliación debe funcionar sin arrancar HTTP y con journal read-only; invalidar sesiones restauradas antes de promover la recuperación.
- No hay replicación continua del journal fuera del VPS en la infraestructura actual. La garantía de evitar resurrecciones al restaurar depende de conservar un journal actual íntegro; no prometerla ante pérdida simultánea del servidor y ese journal.
- El principal encontró PostgreSQL nativo 16.15 y creó un cluster EXCLUSIVO en `.data/postgres-integration`, loopback puerto 55432, base `private_chat_integration`. `npm run verify:local` pasa el DSN sólo en memoria, nunca lo imprime, y puede ejecutar la integración sin Docker. Se preserva la instancia existente. Docker/PG18 siguen sin verificar.
- 58 pruebas individuales pasaban inicialmente (9 de base, 26 frontend, 23 backend unitarias). Esto NO equivale a integración. El backend todavía no publicó informe; no se modifican sus fuentes mientras trabaja.
- Build API inicial: faltaba generar Prisma Client (el principal ya lo generó en node_modules), export del adaptador es PrismaPg, no PgAdapter; imports relativos en src/http/app.ts apuntaban a directorios equivocados; Sharp actual usa `failOn`, no `failOnError`; Socket.IO types no permiten `cors: false`.
- Alinear fixture con INTEGRATION_DATABASE_URL y usar el `env` pasado a loadConfig también para resolver DATABASE_URL. La reconciliación debe rechazar journal corrupto/ausente de recuperación, aunque el arranque nuevo pueda crear journal vacío. No aceptar silenciosamente una restauración que omitió registros.

## Integración observada por el principal — actualización

- `npm run verify:local` ya PASÓ: build/tipos, 10 pruebas base, 23 backend unitarias, 26 frontend y 30 PostgreSQL reales, cero omisiones. Esto se ejecutó con propietario en PG16; falta corroborar runtime restringido y producción PG18.
- El principal añade generación Prisma explícita a build/typecheck raíz y Docker, y adapta bootstrap/local-db a *_FILE con DSN sólo en memoria. `RUNTIME_PASSWORD_FILE` apunta al secreto APP, nunca al OWNER. No modificar esos wrappers en paralelo.
- Backend: antes de cierre revisar journal dentro del lock de conversación. Actualmente se escribe intención ANTES de validar versión/ID y el vaciado prelee IDs ANTES del lock: un 404/409 deja intención pendiente de operación rechazada, y un envío concurrente puede quedar borrado sin estar en el journal. Añadir pruebas de reconciliación tras 404/409 y de restore tras envío/vaciado concurrentes.
- Backend: CLI de recuperación actual exige DATABASE_URL, intenta escribir en journal read-only e ignora corrupción/falta. Corregir modo recuperación read-only, fallo cerrado y revocación de sesiones restauradas; no publicar como seguro hasta resolverlo. La API actual arranca sin reconciliar pendientes; resolver antes de servir.

## Cierre de integración local — prevalece sobre notas anteriores

Ambos informes fueron entregados. El principal integró y corrigió los puntos anteriores después del cierre de las otras sesiones. Bootstrap/build resueltos; journal bajo lock y estricto, recuperación read-only/revocación y arranque con reconciliación resueltos; cookies Secure/no-store, provisión oculta y WebSocket/expiración revisados. El usuario pidió fullscreen y rail desktop de iconos: implementados. El registro actual es docs/STATUS.md y docs/handoffs/principal.md. Verify local: 99 pruebas aprobadas, cero skips, tipos/builds OK. Docker/PG18/Node24, revisión visual completa del ajuste y despliegue VPS siguen como verificaciones separadas. No iniciar nuevas sesiones ni sustituir trabajo integrado.
