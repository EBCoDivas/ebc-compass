# Guía para el jurado

**Sitio:** `<URL de Compass en el lab>/acceso`

En **Cuentas de demostración**, elige **Usar esta cuenta**. Compass abrirá Inicio con el perfil de la cuenta seleccionada. Para cambiar de escena, cierra sesión y vuelve al panel.

| Cuenta | Qué mirar en Inicio |
|---|---|
| Ana Lucía Torres · 1.er semestre | Inducción, beca de primer ingreso y pago de inscripción. |
| Ana Lucía Torres · 7.º semestre | Horas de servicio social, opciones con horarios y titulación de Contaduría. |
| Diego Ramírez · 5.º semestre | Prácticas y oportunidades de Mercadotecnia. |
| Sofía Herrera · 9.º semestre | Fechas cercanas de servicio social y titulación de Derecho. |

## Probar las acciones de Ana (1.er semestre)

Con la cuenta de Ana de 1.er semestre, abre **Conversar** y prueba las dos acciones, que son independientes y se pueden hacer en cualquier orden:

- **Pagar la inscripción:** escribe «Quiero pagar mi inscripción». La tarjeta muestra el importe y la tarjeta registrada (Visa terminación 4242, número de prueba). Selecciona **Pagar** y recibirás el comprobante.
- **Solicitar la beca:** escribe «Quiero solicitar la beca de primer ingreso». La tarjeta pide la carta de motivos: sube [carta-de-motivos-ana-torres.pdf](demo/carta-de-motivos-ana-torres.pdf) (o la versión [.docx](demo/carta-de-motivos-ana-torres.docx)) y selecciona **Enviar solicitud**.

La carta se valida (PDF o Word, hasta 1.5 MB), pero Banner conserva solo su nombre, tamaño y huella, no el contenido. Cada acción desbloquea su logro en Inicio.

## Preparación del equipo

- En local, `npm run env:create` (también incluido en `npm run setup`) agrega `JURY_DEMO_ENABLED=true` y genera `JURY_DEMO_PASSWORD` en `local/.env` si faltan. Conserva los valores explícitos. Usa `npm run dev:rules` para ensayar el acceso sin consumir créditos del chat. El aprovisionamiento crea las cuentas de `shared/personas.json` y aplica la contraseña compartida también a las existentes.
- Para el lab, en la máquina que despliega define `JURY_DEMO_ENABLED=true` y `JURY_DEMO_PASSWORD` en `scripts/lab/.env` antes de ejecutar `lab:deploy` y `lab:personas`. El despliegue configura el panel al compilar el frontend y el registro usa la misma contraseña en Cognito. Dedica esa contraseña a estas cuentas ficticias: cualquier persona con acceso al sitio puede recuperarla. Mantén el panel desactivado fuera del concurso.
- El día del hackatón, comparte la URL solo con el jurado. Ejecuta el [despliegue del lab](deploy-lab.md), registra las cuentas con `npm run lab:personas -- --confirm` y sustituye el marcador de URL por el enlace de `npm run lab:status`.
- El registro elimina las cuentas obsoletas identificadas como personas ficticias de Compass. Las cuentas de otros usuarios del pool quedan fuera de esa limpieza. La cuenta de administración se añadirá al flujo cuando esté disponible la tarea 6.
