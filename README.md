# EBC Compass

EBC Compass es una plataforma colaborativa de orientación académica y profesional para estudiantes de la Escuela Bancaria y Comercial (EBC). El repositorio reúne la aplicación y los componentes de plataforma que se integrarán por actividades.

## Requisitos

- Node.js 22 (la plataforma declara `>=22 <23`).
- npm.
- SST v3 se instala como dependencia del paquete `platform`.
- Para despliegues futuros: credenciales de AWS autorizadas, región `us-east-1` y acceso a los servicios requeridos. No son necesarias para las pruebas locales de la función de salud.

## Comandos básicos

Los comandos actuales de desarrollo se ejecutan desde `platform/`:

```sh
cd platform
npm install
npm run typecheck
npm test
```

Para preparar los proveedores locales de SST:

```sh
npm run install:providers
```

Los comandos `npm run dev`, `npm run deploy` y `npm run remove` están reservados para las actividades y autorizaciones de infraestructura correspondientes.

## Configuración local

Copia `.env.example` como `.env` cuando necesites configurar variables locales. Nunca agregues credenciales reales, tokens, claves privadas ni archivos `.env` al repositorio.

## Estrategia de ramas

- `main` contiene la versión estable.
- Cada actividad se desarrolla en una rama `feature/<nombre-de-tarea>`.
- Mantén las ramas enfocadas en una sola actividad y actualizadas con `main` antes de solicitar revisión.

## Flujo de Pull Requests

1. Implementa y verifica los cambios en `feature/<nombre-de-tarea>`.
2. Ejecuta las pruebas y validaciones relevantes y registra los resultados.
3. Abre un Pull Request hacia `main` usando la plantilla del repositorio.
4. Solicita revisión, atiende los comentarios y conserva evidencia de las pruebas.
5. Integra el Pull Request después de la aprobación y de que las validaciones automáticas estén correctas.

Consulta el [flujo detallado de colaboración](docs/collaboration-workflow.md) para las convenciones de commits, ramas y Pull Requests.
