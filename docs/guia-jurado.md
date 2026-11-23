# Guía para el jurado

**Sitio:** `<URL de Compass en el lab>/acceso`

En **Cuentas de demostración**, elige **Usar esta cuenta**. Compass abrirá Inicio con el perfil de la cuenta seleccionada. Para cambiar de escena, cierra sesión y vuelve al panel.

| Cuenta | Qué mirar en Inicio |
|---|---|
| Ana Lucía Torres · 1.er semestre | Inducción, beca de primer ingreso y pago de inscripción. |
| Ana Lucía Torres · 7.º semestre | Horas de servicio social, opciones con horarios y titulación de Contaduría. |
| Diego Ramírez · 5.º semestre | Prácticas y oportunidades de Mercadotecnia. |
| Sofía Herrera · 9.º semestre | Fechas cercanas de servicio social y titulación de Derecho. |

## Preparación del equipo

- En local, define `JURY_DEMO_ENABLED=true` y `JURY_DEMO_PASSWORD` en `local/.env`. Usa `npm run dev:rules` para ensayar el acceso sin consumir créditos del chat. El aprovisionamiento crea las cuentas de `shared/personas.json` y aplica la contraseña compartida también a las existentes.
- Para el lab, configura esas mismas variables en `scripts/lab/.env`. La contraseña solo debe usarse en estas cuentas ficticias: el panel la necesita en el navegador y cualquier persona con acceso al sitio puede recuperarla. Mantén el panel desactivado fuera del entorno del concurso.
- El día del hackatón, comparte la URL solo con el jurado. Ejecuta el [despliegue del lab](deploy-lab.md), registra las cuentas con `npm run lab:personas -- --confirm` y sustituye el marcador de URL por el enlace de `npm run lab:status`.
- El registro elimina las cuentas obsoletas identificadas como personas ficticias de Compass. Las cuentas de otros usuarios del pool quedan fuera de esa limpieza. La cuenta de administración se añadirá al flujo cuando esté disponible la tarea 6.
