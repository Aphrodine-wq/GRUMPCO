# Quick Start

Build a complete full-stack application in 10 minutes using G-Rump.

## What We're Building

A **Task Management API** with:

- RESTful endpoints
- Database persistence
- Authentication
- Full test coverage

## Step 1: Initialize Project

```bash
grump init task-manager --template api
cd task-manager
```

This creates a project structure with G-Rump configuration.

## Step 2: Define Your Intent

Open G-Rump (CLI or Desktop) and describe what you want:

```
I need a task management API with the following features:
- Users can create, read, update, delete tasks
- Tasks have: title, description, status (todo, in-progress, done), due date
- Users must authenticate to access their tasks
- Each user only sees their own tasks
- Use PostgreSQL for the database
- Include comprehensive tests
```

## Step 3: Review the Architecture

G-Rump generates an architecture proposal:

```
📋 Architecture Proposal: Task Management API

📦 Stack:
- Runtime: Node.js 20
- Framework: Express.js
- Database: PostgreSQL with Prisma ORM
- Auth: JWT tokens
- Testing: Vitest + Supertest

📂 Structure:
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── repositories/    # Data access
├── middleware/      # Auth, validation
├── routes/          # API routes
└── types/           # TypeScript types

🔌 Endpoints:
POST   /auth/register
POST   /auth/login
GET    /tasks
POST   /tasks
GET    /tasks/:id
PUT    /tasks/:id
DELETE /tasks/:id

Accept this architecture? [Y/n]
```

Type `Y` to accept or provide feedback to modify.

## Step 4: Generate Implementation

G-Rump creates all the code:

```
✅ Generated 24 files

📁 Created:
- src/controllers/auth.controller.ts
- src/controllers/task.controller.ts
- src/services/auth.service.ts
- src/services/task.service.ts
- src/repositories/user.repository.ts
- src/repositories/task.repository.ts
- src/middleware/auth.middleware.ts
- src/middleware/validation.middleware.ts
- src/routes/auth.routes.ts
- src/routes/task.routes.ts
- prisma/schema.prisma
- tests/auth.test.ts
- tests/tasks.test.ts
... and more

Run `npm run dev` to start the server
```

## Step 5: Start Development

```bash
# Set up database
npx prisma migrate dev --name init

# Start the server
npm run dev
```

Your API is running at `http://localhost:3000`.

## Step 6: Test the API

```bash
# Register a user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret123"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret123"}'

# Create a task (use token from login response)
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "Learn G-Rump", "description": "Complete the quick start", "status": "in-progress"}'
```

## Step 7: Run Tests

```bash
npm test
```

All tests should pass:

```
✓ tests/auth.test.ts (8 tests)
✓ tests/tasks.test.ts (12 tests)

Test Files  2 passed (2)
     Tests  20 passed (20)
```

## What Just Happened?

In about 10 minutes, G-Rump:

1. **Understood** your requirements from natural language
2. **Designed** a complete system architecture
3. **Generated** production-ready code with:
   - Proper separation of concerns
   - Type safety throughout
   - Error handling
   - Input validation
   - Authentication middleware
   - Database migrations
   - Comprehensive tests

## Iterating

Need changes? Just ask:

```
Add a priority field to tasks (low, medium, high) with medium as default
```

G-Rump will:
- Update the Prisma schema
- Create a migration
- Update all affected code
- Update tests

## Next Steps

- [SHIP Workflow](/guide/ship-workflow) - Understand the full methodology
- [Architecture Mode](/guide/architecture-mode) - Design larger systems
- [Code Mode](/guide/code-mode) - Fine-grained code generation
- [API Reference](/api/overview) - Full API documentation
