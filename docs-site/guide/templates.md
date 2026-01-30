# Project Templates

G-Rump provides pre-built project templates to accelerate your development workflow. These templates include best practices, recommended structure, and common configurations for various project types.

## Available Templates

### Web Applications

#### React + TypeScript + Vite

Modern React application with TypeScript and Vite for fast development.

```bash
grump init --template react-vite
```

**Includes:**
- React 18+ with hooks
- TypeScript strict mode
- Vite for fast HMR
- React Router v6
- Tailwind CSS
- ESLint + Prettier
- Vitest for testing
- GitHub Actions CI/CD

**Structure:**
```
my-app/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/           # Route pages
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript types
│   ├── services/        # API services
│   └── styles/          # Global styles
├── public/
├── tests/
└── .github/workflows/
```

#### Next.js 14 (App Router)

Full-stack React with server components and API routes.

```bash
grump init --template nextjs-app
```

**Includes:**
- Next.js 14 with App Router
- React Server Components
- API Routes
- Server Actions
- Tailwind CSS
- Prisma ORM
- NextAuth.js
- TypeScript

**Structure:**
```
my-app/
├── app/
│   ├── (routes)/        # Route groups
│   ├── api/             # API routes
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── components/
├── lib/
│   ├── prisma.ts        # Database client
│   └── auth.ts          # Auth configuration
├── prisma/
│   └── schema.prisma    # Database schema
└── public/
```

#### Vue 3 + TypeScript

Progressive JavaScript framework with composition API.

```bash
grump init --template vue-ts
```

**Includes:**
- Vue 3 Composition API
- TypeScript
- Vite
- Vue Router 4
- Pinia state management
- VueUse utilities
- Vitest + Vue Test Utils

### Backend Services

#### Node.js + Express + TypeScript

RESTful API server with modern tooling.

```bash
grump init --template express-api
```

**Includes:**
- Express.js with TypeScript
- Zod validation
- JWT authentication
- Prisma ORM
- Rate limiting
- Helmet security
- Winston logging
- Jest testing
- Docker setup

**Structure:**
```
api/
├── src/
│   ├── config/          # Configuration
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utilities
│   └── app.ts           # Express app
├── tests/
├── prisma/
└── docker-compose.yml
```

#### Fastify + TypeScript

High-performance Node.js web framework.

```bash
grump init --template fastify-api
```

**Includes:**
- Fastify framework
- TypeScript
- @fastify/swagger (API docs)
- @fastify/jwt (auth)
- @fastify/cors
- @fastify/rate-limit
- Pino logging
- Tap testing

#### Python + FastAPI

Modern Python web framework with automatic API docs.

```bash
grump init --template fastapi
```

**Includes:**
- FastAPI framework
- Pydantic validation
- SQLAlchemy ORM
- Alembic migrations
- JWT authentication
- pytest testing
- Uvicorn server
- Docker setup
- Poetry dependency management

**Structure:**
```
api/
├── app/
│   ├── api/             # API routes
│   ├── core/            # Core config
│   ├── db/              # Database
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic schemas
│   └── services/        # Business logic
├── alembic/             # Migrations
├── tests/
├── Dockerfile
└── pyproject.toml
```

### Full-Stack Applications

#### MERN Stack

MongoDB, Express, React, Node.js full-stack application.

```bash
grump init --template mern
```

**Includes:**
- MongoDB with Mongoose
- Express REST API
- React frontend
- TypeScript throughout
- JWT authentication
- Redux Toolkit
- React Query
- Docker Compose setup

**Structure:**
```
project/
├── backend/
│   ├── src/
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── docker-compose.yml
└── README.md
```

#### T3 Stack

TypeScript, tRPC, Tailwind, Prisma, Next.js.

```bash
grump init --template t3
```

**Includes:**
- Next.js 14
- tRPC for type-safe APIs
- Prisma ORM
- Tailwind CSS
- NextAuth.js
- Zod validation
- TypeScript strict

#### PERN Stack

PostgreSQL, Express, React, Node.js.

```bash
grump init --template pern
```

**Includes:**
- PostgreSQL database
- Express API
- React frontend
- TypeScript
- Prisma ORM
- Redux Toolkit
- JWT auth
- Docker setup

### Mobile Applications

#### React Native + Expo

Cross-platform mobile development.

```bash
grump init --template react-native-expo
```

**Includes:**
- React Native with Expo
- TypeScript
- React Navigation
- Expo Router
- React Native Paper
- AsyncStorage
- Jest testing
- EAS Build config

**Structure:**
```
mobile/
├── app/                 # Expo Router routes
├── components/          # React components
├── hooks/               # Custom hooks
├── services/            # API services
├── stores/              # State management
├── utils/               # Utilities
├── assets/
└── app.json
```

#### Flutter

Google's UI toolkit for natively compiled applications.

```bash
grump init --template flutter
```

**Includes:**
- Flutter SDK
- Dart
- Riverpod state management
- Dio for HTTP
- Hive local storage
- Flutter Testing
- CI/CD with Codemagic

### Specialized Templates

#### Microservices

Multi-service architecture with Docker Compose.

```bash
grump init --template microservices
```

**Includes:**
- API Gateway (Nginx/Kong)
- User Service (Node.js)
- Order Service (Node.js)
- Notification Service (Python)
- PostgreSQL per service
- RabbitMQ message broker
- Docker Compose orchestration
- Kubernetes manifests

#### Serverless (AWS)

AWS Lambda + API Gateway + DynamoDB.

```bash
grump init --template aws-serverless
```

**Includes:**
- Serverless Framework
- AWS Lambda functions
- API Gateway
- DynamoDB tables
- S3 buckets
- CloudWatch logs
- IAM roles
- LocalStack for testing

#### Chrome Extension

Browser extension with modern tooling.

```bash
grump init --template chrome-extension
```

**Includes:**
- Manifest V3
- React popup
- Content scripts
- Background service worker
- TypeScript
- Webpack build
- Chrome Storage API
- Content Script injection

#### VS Code Extension

Extension for Visual Studio Code.

```bash
grump init --template vscode-extension
```

**Includes:**
- VS Code Extension API
- TypeScript
- Webview panels
- Commands
- Language server protocol (optional)
- Testing with @vscode/test-electron
- CI/CD with GitHub Actions

## Using Templates

### Via CLI

```bash
# List available templates
grump init --list-templates

# Initialize with specific template
grump init --template react-vite

# Interactive template selection
grump init --interactive
```

### Via SHIP Workflow

Templates are automatically suggested based on your project description:

```bash
grump ship "Build a React e-commerce site with Node.js backend"
# G-Rump detects: needs React + Express templates
```

### Template Options

```bash
# With custom name
grump init --template react-vite --name my-awesome-app

# With specific directory
grump init --template react-vite --output ./projects/web

# Skip dependencies install
grump init --template react-vite --skip-install

# Skip git init
grump init --template react-vite --skip-git
```

## Customizing Templates

### Template Configuration

Create `.grumprc.json` to customize template behavior:

```json
{
  "template": {
    "default": "react-vite",
    "customizations": {
      "react-vite": {
        "styling": "tailwind",  // or "styled-components", "emotion"
        "state": "zustand",     // or "redux", "context", "none"
        "testing": "vitest",    // or "jest", "none"
        "ci": "github"          // or "gitlab", "circleci", "none"
      }
    }
  }
}
```

### Post-Init Hooks

Run commands after template initialization:

```json
{
  "template": {
    "hooks": {
      "postInit": [
        "npm run setup",
        "git init",
        "git add .",
        "git commit -m 'Initial commit from template'"
      ]
    }
  }
}
```

## Creating Custom Templates

### Template Structure

Create a new template directory:

```
my-template/
├── template.json          # Template metadata
├── template/              # Template files
│   ├── src/
│   ├── package.json
│   └── ...
├── index.js              # Template logic (optional)
└── README.md             # Documentation
```

### template.json

```json
{
  "name": "my-custom-template",
  "version": "1.0.0",
  "description": "Custom project template",
  "tags": ["react", "typescript", "custom"],
  "files": [
    "src/**/*",
    "public/**/*",
    "package.json",
    "tsconfig.json",
    "README.md"
  ],
  "variables": {
    "projectName": {
      "type": "string",
      "description": "Project name",
      "default": "my-app"
    },
    "useTypeScript": {
      "type": "boolean",
      "description": "Use TypeScript",
      "default": true
    }
  }
}
```

### Template Variables

Use EJS syntax for dynamic content:

```json
// package.json
{
  "name": "<%= projectName %>",
  "version": "1.0.0",
  "scripts": {
    "dev": "<%= useTypeScript ? 'tsx' : 'node' %> src/index.<%= useTypeScript ? 'ts' : 'js' %>"
  }
}
```

### Publishing Templates

Share templates with the community:

```bash
# Package template
npm pack

# Publish to npm
npm publish --access public

# Or share via GitHub
git push origin main
```

Templates published to npm with `grump-template-*` prefix will be discoverable by:

```bash
grump init --template your-template-name
```

## Template Best Practices

### Structure Guidelines

1. **Consistent Naming**
   - Use kebab-case for files: `user-service.ts`
   - Use PascalCase for components: `UserProfile.tsx`
   - Clear, descriptive names

2. **Separation of Concerns**
   - Components: UI only
   - Services: Business logic
   - Utils: Pure functions
   - Types: Shared interfaces

3. **Configuration Management**
   - Environment variables for secrets
   - Config files for settings
   - Validation with Zod/Joi

4. **Documentation**
   - README with setup instructions
   - Code comments for complex logic
   - API documentation (OpenAPI/Swagger)

### Security Checklist

All templates include:
- [ ] Helmet.js for security headers
- [ ] Rate limiting
- [ ] Input validation
- [ ] CORS configuration
- [ ] Environment variable handling
- [ ] No hardcoded secrets
- [ ] Updated dependencies

### Testing Setup

Templates include:
- Unit test configuration
- Integration test examples
- CI/CD pipeline
- Code coverage reporting
- Pre-commit hooks

## Template Comparison

| Template | Best For | Learning Curve | Production Ready |
|----------|----------|----------------|------------------|
| react-vite | SPAs, PWAs | Easy | Yes |
| nextjs-app | Full-stack web | Medium | Yes |
| express-api | REST APIs | Easy | Yes |
| fastapi | Python APIs | Easy | Yes |
| mern | MongoDB apps | Medium | Yes |
| t3 | Type-safe full-stack | Medium | Yes |
| react-native-expo | Mobile apps | Medium | Yes |
| microservices | Large systems | Hard | Yes |
| aws-serverless | Event-driven | Medium | Yes |

## Troubleshooting

### Template Not Found

```bash
# Update template cache
grump init --update-templates

# Install template manually
npm install -g grump-template-custom
```

### Template Init Fails

```bash
# Run with verbose output
grump init --template react-vite --verbose

# Check Node.js version
node --version  # Requires 18+

# Clear npm cache
npm cache clean --force
```

### Customization Issues

If template files are not generated correctly:
1. Check template.json syntax
2. Verify file paths in `files` array
3. Ensure EJS syntax is valid
4. Test locally: `grump init --template ./local-template`

## Contributing Templates

We welcome community templates! To contribute:

1. Fork the [templates repository](https://github.com/Aphrodine-wq/grump-templates)
2. Create your template following the structure above
3. Include comprehensive README
4. Add tests for template generation
5. Submit a pull request

Template review criteria:
- Code quality and best practices
- Documentation completeness
- Security considerations
- Working examples
- Test coverage

## Next Steps

- [Getting Started](/guide/getting-started) - Start with templates
- [SHIP Workflow](/guide/ship-workflow) - Use templates in workflows
- [CLI Reference](/guide/cli-reference) - More template commands
- Create your first project: `grump init --template react-vite`
