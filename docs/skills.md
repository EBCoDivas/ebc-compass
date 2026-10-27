# Skills de agentes de EBC Compass

Las Skills locales del repositorio se encuentran en [`.agents/skills/`](../.agents/skills/). Proveen una guía compartida y reutilizable para el equipo; no otorgan permiso para desplegar, hacer commit, push ni crear recursos remotos.

| Skill | Úsala para | Límite predeterminado |
| --- | --- | --- |
| [`app-platform-impact`](../.agents/skills/app-platform-impact/SKILL.md) | Evaluar cómo el trabajo de frontend o backend afecta SST, Cognito, API Gateway, Bedrock o S3 Vectors. | Solo revisa impacto; no cambia infraestructura ni ejecuta comandos de AWS. |
| [`api-contract`](../.agents/skills/api-contract/SKILL.md) | Definir o revisar rutas de API, esquemas de solicitudes y respuestas, errores, CORS y autenticación con Cognito. | No inventa rutas ni implementa handlers. |
| [`environment-readiness`](../.agents/skills/environment-readiness/SKILL.md) | Revisar prerrequisitos locales, scripts de paquetes, nombres de variables de entorno y archivos ignorados. | No instala dependencias ni lee valores secretos. |
| [`commit-message`](../.agents/skills/commit-message/SKILL.md) | Proponer mensajes Conventional Commit breves en inglés a partir del diff real. | Nunca crea, modifica ni publica commits. |
| [`pull-request`](../.agents/skills/pull-request/SKILL.md) | Verificar la preparación de un PR o redactar su título y cuerpo contra `main`. | No hace push, crea, solicita revisión ni fusiona un PR sin aprobación explícita. |

## Flujo recomendado

1. Usa `environment-readiness` antes de comenzar en una rama o paquete desconocido.
2. Usa `api-contract` y `app-platform-impact` antes de integrar una nueva capacidad de frontend o backend.
3. Usa `commit-message` después de inspeccionar el diff terminado.
4. Usa `pull-request` para preparar la evidencia, el título y el cuerpo para revisión contra `main`.

## Nota sobre la plataforma actual

La base de SST se desarrolla en `feature/infrastructure-sst` hasta que se integre en `main`. Si `platform/` no está presente en la rama actual, la Skill de impacto en infraestructura debe comparar esa rama en lugar de asumir que los recursos ya existen.
