# Contrato de avance académico

El contrato TypeScript compartido vive en [`shared/contracts/academicProgress.d.ts`](../shared/contracts/academicProgress.d.ts). Lo consume el backend y la interfaz, y debe conservarse si Banner pasa a ser la fuente de datos mediante una herramienta MCP.

## Lectura HTTP actual

- `GET /api/academic-progress`
- Requiere una identidad verificada por Cognito (o por la sesión local de desarrollo).
- Respuesta: `{ "progress": AcademicProgress | null }`.
- `401 UNAUTHORIZED` si no hay identidad; `503 ACADEMIC_PROGRESS_UNAVAILABLE` si falla la fuente.
- Usa `Cache-Control: no-store` porque la respuesta corresponde a una persona.
- El backend obtiene el sujeto y la persona de los claims verificados; no acepta un identificador de estudiante enviado por el navegador.

## Campos

| Campo | Significado |
| --- | --- |
| `studentId` | Identificador del estudiante asociado a esta respuesta. |
| `source` | `demo` para los snapshots simulados o `banner` para la futura integración. |
| `asOf` | Fecha de corte en formato `YYYY-MM-DD`. |
| `program`, `campus` | Identificadores estables y nombres para presentación. |
| `currentPeriod` | Número y tipo de periodo académico; no se deduce de otra cifra. |
| `courses` | Materias cursadas y total, si la fuente conoce ambos. |
| `credits` | Créditos obtenidos y total, si la fuente conoce ambos. |
| `gpa` | Promedio y escala, solo si la fuente lo proporciona. |

Las cifras de los snapshots son datos explícitos de demostración, no el plan oficial de estudios de EBC. Los campos opcionales se omiten cuando no hay un dato fiable; la interfaz no calcula ni inventa cifras faltantes. La cuenta demo sin perfil devuelve `progress: null`.

## Fuente de demo

`backend/src/data/studentAcademicProgress.ts` relaciona la identidad verificada con snapshots ficticios. El adaptador futuro de Banner debe implementar `AcademicProgressReader` y devolver el mismo contrato; la pantalla no debe depender de detalles de Banner.
