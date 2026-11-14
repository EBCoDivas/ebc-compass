# EBC Compass Development Guidelines

## Project Overview

EBC Compass is an academic and professional guidance platform for students at Escuela Bancaria y Comercial (EBC). It helps students identify next steps, relevant opportunities, important dates, and personalized recommendations.

## Current Project Scope

- The project is a demo application.
- Use mock or hardcoded data.
- Recommendations use fixed rules for the first version.
- The assistant is simulated.
- There are no current integrations with Banner, Salesforce, or other institutional systems.
- Never store real sensitive student information.

## Development Principles

- Keep changes small and focused.
- Prefer simple, readable, and maintainable code.
- Reuse existing components and utilities.
- Do not introduce unnecessary dependencies.
- Do not expose secrets or credentials.

## Repository and Collaboration Rules

- Do not work directly on `main`.
- Use branches named `feature/<task-name>`.
- Use Pull Requests to merge changes into `main`.
- Include tests, evidence, and a clear description in Pull Requests.
- Never commit `.env` files, passwords, tokens, or API keys.

## Code Conventions

- Use TypeScript when applicable.
- Use clear names for files, functions, variables, and components.
- Keep UI text in Spanish unless the existing implementation requires otherwise.
- Keep business rules separate from UI components when possible.
- Add comments only when they clarify non-obvious decisions.

## Validation

- Run the available tests before finishing.
- Run type checking and linting when configured.
- Run `git diff --check`.
- Report any validation command that cannot be executed and explain why.

## Scope Boundaries

- Do not implement new frontend features, backend routes, AWS infrastructure, MCPs, Skills, or Agent Hooks as part of repository-guidance changes.
- Do not modify the existing `README.md`, `.gitignore`, `.env.example`, or Pull Request template unless strictly necessary.
- Keep steering-file work limited to creating or updating `AGENTS.md`.