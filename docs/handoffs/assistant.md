# Integración opcional de Alexis AI

Se preparó el flujo de respuestas automáticas en la conversación principal. Usa Kimi K2.6 desde el API privado, archivos secretos del operador y el prefijo visible `🤖 Alexis AI`. No modifica el portafolio público, los DTO ni el esquema de PostgreSQL.

Archivos: `apps/api/src/assistant.ts`, `apps/api/src/auto-reply.ts`, configuración y persistencia en `apps/api/src/config.ts` / `apps/api/src/http/app.ts`, ejemplo de entorno, overlay `compose.assistant.yaml`, documentación y pruebas. El contexto personal local está fuera del repositorio con permiso 600. No se incorporaron datos biográficos o historial privado a los archivos versionados. No se instalaron dependencias.

Verificaciones ejecutadas secuencialmente, con heap de Node limitado a 512 MiB:

- `node --import tsx --test --test-concurrency=1 apps/api/test/unit/assistant.test.ts apps/api/test/unit/auto-reply.test.ts apps/api/test/unit/config.test.ts`: 16 pruebas aprobadas.
- `tsc --noEmit -p apps/api/tsconfig.json`: aprobado.
- `tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 --skipLibCheck --esModuleInterop apps/api/test/unit/assistant.test.ts apps/api/test/unit/auto-reply.test.ts apps/api/test/integration/assistant.test.ts`: aprobado.
- `git diff --check`: aprobado.
- Overlay analizado con el parser YAML instalado; sólo configura el servicio API. No se ejecutó Compose.

Pendiente: clave y confirmación del proveedor; confirmar conversación principal o separación si el operador elige esa alternativa; ejecución autorizada de las pruebas con PostgreSQL dedicado y despliegue. Las pruebas de integración escritas cubren sesiones reales, autoría, idempotencia, permisos de borrado, respuesta manual, edición y vaciado durante generación; no se ejecutaron en esta sesión. No se arrancaron servidores ni se ejecutaron builds. La función permanece desactivada por defecto y no se modificó producción.

Limitaciones operativas: cola en memoria sin recuperación de respuestas pendientes después de reiniciar; sólo texto; límites de generación por proceso. La similitud del estilo debe revisarse con respuestas reales una vez configurado el proveedor; no se afirma que haya sido validada con Kimi.

## Comando de pruebas

Se añadió `--test 'prompt'` y su variante con comillas dobles. El API valida la sintaxis antes de guardar, admite ambas cuentas autenticadas y convierte sólo el contenido citado en un turno de usuario para Kimi. Las respuestas llevan `🧪 Alexis AI · prueba`. El comando y la respuesta permanecen visibles en la conversación principal. La variable opcional `ASSISTANT_AUTO_REPLY_ENABLED=false` permite probar sin activar respuestas ordinarias; requiere `ASSISTANT_ENABLED=true` y archivos privados configurados.

Verificación de esta ampliación: 22 pruebas unitarias aprobadas (parser, normalización de roles, etiquetado y controles existentes), tipos del backend y de las pruebas aprobados, `git diff --check` aprobado. Se añadieron casos de integración PostgreSQL para comando desde ambas cuentas, modo sólo pruebas y rechazo sin persistencia de comandos inválidos o no disponibles; no se ejecutaron. No se ejecutaron builds, servidores ni despliegues.
