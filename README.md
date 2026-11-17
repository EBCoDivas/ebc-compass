# EBC Compass

EBC Compass es una plataforma colaborativa de orientación académica y profesional para estudiantes de la Escuela Bancaria y Comercial (EBC). El repositorio reúne la aplicación y los componentes de plataforma que se integrarán por actividades.

## Requisitos

- Node.js 22 (la plataforma declara `>=22 <23`). El setup solo alerta si tu versión es otra; no la cambia.
- npm.
- Docker Desktop, para la demo local. `npm run setup` detecta si falta y ofrece instalarlo con confirmación.
- SST v4 se instala como dependencia del paquete `platform`.
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

## Comandos centralizados (demo local)

Desde la raíz del repo hay un punto de entrada único para la demo local del asistente (emulador de AWS + puente a OpenAI):

```sh
npm run env:create   # crea los .env desde los .env.example; completa OPENAI_API_KEY en local/.env
npm run setup        # revisa prerrequisitos, instala dependencias, levanta el emulador y aprovisiona
npm run dev          # levanta todo (npm run dev:rules: sin OpenAI)
npm run doctor       # diagnóstico del entorno
npm run test:scripts # pruebas de los scripts del repo (setup y doctor)
```

Detalle y lista completa de comandos en [local/README.md](local/README.md). Para desplegar al lab de AWS (cuando esté disponible): `npm run lab:check` y `npm run lab:deploy -- --confirm`; guía en [docs/deploy-lab.md](docs/deploy-lab.md). Cada paquete (`frontend/`, `backend/`, `platform/`, `local/`) mantiene además sus propios scripts.

Para acceder con las nueve personas demo en el lab, despliega la configuración actual y ejecuta `npm run lab:personas -- --confirm`. Consulta las credenciales privadas en `scripts/lab/.state/personas.json` y entra al sitio por `/acceso`. El flujo y la separación respecto a Cognito local están documentados en [Login y cuentas demo del lab](docs/deploy-lab.md#login-y-cuentas-demo-en-el-lab-f3b).

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
