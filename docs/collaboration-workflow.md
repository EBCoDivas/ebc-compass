    # Flujo de colaboración

    ## Ramas

    - `main` representa la versión estable.
    - Cada actividad usa una rama `feature/<nombre-de-tarea>` creada desde `main`.
    - Mantén una actividad por rama y evita mezclar cambios de frontend, backend, plataforma o documentación de otras actividades.

    ## Commits

    - Haz commits pequeños y enfocados en un solo cambio lógico.
    - Usa mensajes claros en imperativo y describe el resultado, por ejemplo: `docs: add collaboration workflow`.
    - No incluyas credenciales, tokens, claves privadas, archivos `.env` ni artefactos generados.

    ## Pull Requests

    1. Actualiza la rama con `main` y resuelve conflictos localmente.
    2. Ejecuta las validaciones relevantes para la actividad.
    3. Abre el Pull Request hacia `main` y completa todas las secciones de la plantilla.
    4. Incluye evidencia de pruebas y describe cualquier pendiente o limitación.
    5. Atiende la revisión y espera las aprobaciones y verificaciones automáticas antes de integrar.

    Después de integrar, elimina la rama si ya no se necesita y crea una nueva rama para la siguiente actividad.
