# Catálogo y pendientes por etapa

`GET /api/student-planning` devuelve el contexto de la cuenta autenticada. El contrato TypeScript está en `shared/contracts/studentPlanning.d.ts`.

| Campo | Contenido |
|---|---|
| `stage` | `entry` (periodos 1 y 2), `middle` (3 al 6), `closing` (7 en adelante) o `null` sin periodo. Es una regla de la demo. |
| `catalog` | Oportunidades que coinciden con etapa, periodo, carrera, campus y nivel. `stage: 'all'` no restringe por etapa. Un rango de periodos, si existe, sigue aplicando. Los requisitos, tarifas y horarios son simulados. |
| `pending` | Referencias a `catalog` por `opportunityId`, con estado y fecha `dueDate` en formato AAAA-MM-DD. |
| `firstEntry`, `socialService` | Datos opcionales del expediente ficticio. El avance de servicio social incluye las horas registradas, el ritmo semanal y la fecha límite de titulación. |
| `route` | Pendientes prioritarios con `required`, `overdue` y `nextStep`. Se muestran primero los obligatorios, por fecha, y después los opcionales. Los topes por etapa son 4, 3 y 3. Sin periodo, se muestra un paso general. |
| `achievements` | Logros aplicables o ya alcanzados. La beca y la ficha se desbloquean al leer acciones confirmadas. Servicio social se desbloquea al registrar al menos el 50 % de las horas requeridas. Los logros de etapas anteriores (`achievementHistory` en la planeación) aparecen primero, desbloqueados y con `earnedAt`; en la demo, Ana en 7.º conserva la beca y la ficha de su primer semestre. |
| `calculations` | Reglas aplicables al alumno para elegibilidad de la beca, ficha de inscripción y proyección de servicio social. |

El backend obtiene carrera, campus y periodo de los claims verificados de Cognito y completa los datos faltantes con el perfil guardado de ese `sub`. Los parámetros de URL no pueden cambiar los datos devueltos de una sesión. La respuesta es `200` y usa `Cache-Control: no-store`. Una solicitud sin identidad recibe `401 UNAUTHORIZED` y un fallo al cargar el perfil devuelve `503 PLANNING_UNAVAILABLE`.

`GET /api/opportunities`, `GET /api/alerts` y `GET /api/recommendations` conservan sus arreglos de respuesta y usan el mismo alcance cuando hay sesión. El calendario usa las fechas del catálogo y Rumbo en Inicio usa las alertas próximas. Los pendientes se derivan del catálogo compartido por etapa y se amplían con los trámites de las tres carreras. Sin periodo, la cuenta recibe orientación general de Servicios Escolares.

El entorno local y Lambda sirven el mismo código. En el lab, la ruta entra por el proxy existente `ANY /api/{proxy+}` con el autorizador de Cognito. Las confirmaciones se leen de la tabla de historial existente, con el `sub` verificado como `PK`. La tarea 5 escribirá los registros de beca (`ACTION#scholarship-first-entry`, estado `in-review`) y ficha (`ACTION#enrollment-payment-slip`, estado `generated`), ambos con `confirmedAt`. Generar una ficha cambia el pendiente de inscripción a `in-progress`. El pago sigue pendiente.

Los agentes pueden reutilizar las funciones de `backend/src/planning/rules.ts`. La beca distingue el promedio requerido, los documentos faltantes y la vigencia. La ficha toma el monto del catálogo y usa una referencia estable por cuenta, trámite y fecha límite. Una beca en revisión se informa en la cotización y el monto permanece igual. La proyección suma las horas registradas y las que permite el ritmo semanal a partir de la fecha más reciente entre hoy y el último registro. Se comparan fechas de calendario de Ciudad de México, con el día límite incluido.

Para probar las escenas, `npm run dev:rules` arranca la demo y registra las cuentas desde `shared/personas.json`. Si ya está en marcha, `npm --prefix local run provision` registra la cuenta nueva en el emulador. Consulta las credenciales ficticias en el archivo privado `local/.state/cognito.json` y confirma el perfil si es el primer acceso. Las fechas corresponden al calendario fijo de la demo de noviembre de 2026 a enero de 2027.

| Cuenta | Escena para comprobar |
|---|---|
| `ana-ingreso` | Inducción, charla, beca de primer ingreso e inscripción. En el catálogo se muestran los requisitos y la tarifa de demostración. |
| `ana` | Titulación de Contaduría, horas de servicio social y opciones con horarios. «Lo que Compass recuerda» muestra que trabaja por las tardes. |
| `diego` | Prácticas, curso y evento de Mercadotecnia. |
| `sofia` | Servicio social y titulación de Derecho con fechas cercanas. |
