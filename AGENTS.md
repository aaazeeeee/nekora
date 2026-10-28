# Nekora — Engineering Standards

You are a senior full-stack product engineer responsible for building a maintainable, secure, scalable, and production-minded application.

This project is a timeboxed technical assessment. Code quality, architectural decisions, reliability, and product judgment are as important as functionality.

Follow these engineering standards throughout implementation.

## 1. Core Engineering Principles

### DRY — Don't Repeat Yourself

- Avoid duplicating business logic, validation rules, database queries, and repeated UI patterns.
- Extract reusable hooks, services, utilities, and components when they provide clear value.
- Maintain a single source of truth for shared business rules.
- Do not create abstractions solely to eliminate a few repeated lines.
- Prefer readable duplication over premature or overly complicated abstractions.

### SOLID Principles

Apply SOLID principles pragmatically.

- **Single Responsibility:** Each module, component, hook, and service should have one clear responsibility.
- **Open/Closed:** Design extensible functionality without requiring unnecessary changes to unrelated modules.
- **Liskov Substitution:** Ensure interchangeable implementations honor their contracts.
- **Interface Segregation:** Prefer focused types and interfaces over large, unrelated contracts.
- **Dependency Inversion:** Keep business logic reasonably independent of infrastructure-specific implementations where useful.

Do not introduce excessive interfaces, classes, or dependency injection frameworks just to demonstrate SOLID.

### KISS — Keep It Simple

- Choose the simplest implementation that correctly satisfies the requirements.
- Avoid unnecessary design patterns, dependencies, and architectural layers.
- Prefer straightforward, explicit code.
- Optimize for maintainability and clarity.

### YAGNI — You Aren't Gonna Need It

- Do not implement speculative features.
- Do not build abstractions for hypothetical future requirements.
- Prioritize the assignment's required functionality.

### Separation of Concerns

Maintain clear boundaries between:

- Presentation and UI.
- Application state.
- Business logic.
- Database access.
- Authentication.
- Authorization.
- File processing.

Avoid mixing database operations directly into presentation components.

---

## 2. TypeScript Standards

Use TypeScript strict mode.

Requirements:

- Avoid `any`.
- Prefer `unknown` when input types are uncertain.
- Define explicit types for domain models.
- Use type inference where appropriate.
- Validate external data at runtime.
- Handle nullable values explicitly.
- Avoid unnecessary type assertions.
- Prefer discriminated unions for complex states.
- Use generated Supabase database types when practical.

Never suppress TypeScript errors without a documented reason.

---

## 3. React Best Practices

Use functional components and hooks.

### Component Design

- Keep components focused and readable.
- Extract reusable components when there is meaningful reuse.
- Prefer composition over inheritance.
- Avoid deeply nested JSX.
- Keep business logic out of presentation components.
- Use semantic HTML.
- Implement accessible forms and controls.

### State Management

- Keep state as local as possible.
- Avoid unnecessary global state.
- Do not duplicate derived state.
- Use context only for genuinely shared application state.
- Separate server state from temporary UI state.
- Use TanStack Query if it meaningfully simplifies asynchronous data management.

### Hooks

Create custom hooks for reusable stateful behavior.

Examples:

- `useAuth`
- `useDocuments`
- `useDocument`
- `useAutosave`
- `useDocumentPermissions`

Do not create hooks for trivial logic that is clearer inline.

### Performance

- Avoid unnecessary rerenders.
- Debounce autosave requests.
- Clean up subscriptions and timers.
- Avoid unnecessary effects.
- Use memoization only when justified.
- Prevent stale asynchronous responses from overwriting newer state.

---

## 4. Supabase and Database Best Practices

### Database Design

- Use appropriate PostgreSQL data types.
- Enforce referential integrity with foreign keys.
- Add unique constraints where required.
- Index frequently queried relationships.
- Use JSONB for structured rich-text content.
- Use database migrations for schema changes.
- Use consistent naming conventions.

### Security

- Enable RLS on all user-accessible tables.
- Follow least-privilege access principles.
- Enforce authorization in the database.
- Never trust frontend permission checks.
- Prevent unauthorized changes to document ownership.
- Prevent editors from modifying sharing permissions.
- Prevent users from granting themselves access.
- Test authorization using multiple user identities.

### Database Operations

- Keep database queries inside service modules.
- Use typed query results.
- Handle Supabase errors explicitly.
- Use atomic operations for concurrency-sensitive updates.
- Avoid unnecessary queries.
- Avoid fetching more data than required.

### Secrets

- Never expose the service-role key in frontend code.
- Never commit credentials.
- Use environment variables.
- Include `.env.example`.
- Ensure `.env` is ignored by Git.

---

## 5. Service Layer Architecture

Use a lightweight service layer to centralize database operations.

Suggested services:

```text
services/
  document.service.ts
  sharing.service.ts
  auth.service.ts
  import.service.ts
```

Responsibilities:

**Document service**

- Create documents.
- Retrieve documents.
- Rename documents.
- Save document content.
- List accessible documents.

**Sharing service**

- Grant document access.
- Retrieve document permissions.
- Revoke document access.

**Authentication service**

- Sign in.
- Sign out.
- Retrieve authenticated user.

**Import service**

- Validate supported files.
- Parse imported content.
- Convert content into editor-compatible format.

Services should not depend on React components.

---

## 6. Error Handling

Use consistent error-handling patterns.

- Handle expected errors explicitly.
- Avoid empty catch blocks.
- Do not expose sensitive database details to users.
- Display actionable error messages.
- Log useful diagnostic information without exposing secrets.
- Distinguish validation, authorization, network, and unexpected errors.
- Never report an operation as successful before it completes.

Use shared error utilities when they reduce duplication.

---

## 7. Rich-Text Editor Best Practices

- Keep Tiptap configuration centralized.
- Store editor content as structured JSON.
- Validate imported content.
- Avoid unnecessary editor reinitialization.
- Preserve cursor position during normal editing.
- Keep toolbar components separate from persistence logic.
- Handle save failures without discarding unsaved changes.
- Avoid conflicting concurrent saves.
- Use revision checks to prevent silent overwrites.

---

## 8. Testing Standards

Write tests for meaningful behavior rather than implementation details.

Prioritize:

1. Authorization and sharing.
2. Document persistence.
3. File import validation.
4. Autosave behavior.

Use:

- Vitest for unit tests.
- React Testing Library for UI behavior.
- Supabase local development for database authorization tests.

Test:

- Successful operations.
- Invalid inputs.
- Unauthorized access.
- Failure scenarios.
- Relevant edge cases.

Avoid excessive snapshot testing.

Do not claim a test passes unless it has actually been executed successfully.

---

## 9. Code Organization

Use a feature-oriented structure where practical.

```text
src/
├── app/
│   ├── router/
│   └── providers/
│
├── components/
│   └── ui/
│
├── features/
│   ├── auth/
│   ├── documents/
│   ├── editor/
│   ├── sharing/
│   └── import/
│
├── lib/
│   ├── supabase/
│   └── utils/
│
└── types/
```

Each feature may contain:

- Components.
- Hooks.
- Services.
- Types.
- Tests.

Avoid creating unnecessary directories or empty architectural layers.

---

## 10. Naming Conventions

Use consistent naming.

- React components: PascalCase.
- Hooks: `use` prefix.
- Functions and variables: camelCase.
- Constants: UPPER_SNAKE_CASE for true constants.
- Database tables and columns: snake_case.
- TypeScript types and interfaces: PascalCase.

Prefer descriptive names over abbreviations.

Avoid generic names such as `data`, `stuff`, `handler1`, or `temp`.

---

## 11. Accessibility and UX

- Use semantic HTML.
- Associate labels with form inputs.
- Support keyboard navigation.
- Provide visible focus states.
- Use accessible dialogs.
- Provide loading and error feedback.
- Maintain sufficient color contrast.
- Ensure responsive layouts.
- Avoid unnecessary animations.

A polished interface must remain functional and accessible.

---

## 12. Code Quality Checks

Configure:

- ESLint.
- Prettier.
- TypeScript strict mode.
- Vitest.

Before completing a feature:

1. Review the implementation.
2. Check for duplicated business logic.
3. Check for unnecessary abstractions.
4. Verify error handling.
5. Verify authorization where relevant.
6. Run applicable tests.
7. Run TypeScript checks.

Before final submission, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Ensure these scripts exist in `package.json`.

Fix failures rather than suppressing them.

---

## 13. AI-Assisted Development Rules

AI-generated code must be treated as unverified until reviewed.

For every significant implementation:

1. Understand the generated code.
2. Verify that it satisfies the requirement.
3. Check for security vulnerabilities.
4. Identify duplicated logic.
5. Review error handling.
6. Verify TypeScript correctness.
7. Run relevant tests.
8. Simplify unnecessary abstractions.

Do not introduce dependencies without a clear reason.

Do not fabricate test results, deployment status, or completed functionality.

Document meaningful AI-assisted decisions and corrections in `AI_WORKFLOW.md`.

---

## 14. Definition of Engineering Quality

A feature is not complete merely because it appears to work.

A feature is complete when:

- It satisfies its functional requirements.
- Its data persists correctly.
- Authorization is enforced.
- Errors are handled appropriately.
- The code is readable and maintainable.
- It follows the established architecture.
- It does not introduce unnecessary duplication.
- Relevant tests pass.
- It works with the existing application.

---

## 15. Final Instruction

Before implementing any feature, consider:

1. Is this necessary for the MVP?
2. Does similar functionality already exist?
3. Can existing components or utilities be reused?
4. Is the implementation secure?
5. Is the architecture unnecessarily complicated?
6. Can another engineer understand this code quickly?
7. How will correctness be verified?

**Build the simplest secure, maintainable, and reliable solution that satisfies the product requirements.**

Prioritize working software, clear architecture, and sound engineering judgment over unnecessary complexity.
