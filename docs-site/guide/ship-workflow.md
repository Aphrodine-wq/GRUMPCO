# SHIP Workflow

The SHIP workflow is G-Rump's core methodology for AI-assisted development. It provides structure and ensures you build the right thing, the right way.

## Overview

**SHIP** stands for:

- **S**cope - Define the problem and requirements
- **H**ypothesis - Design the solution architecture
- **I**mplementation - Build with AI assistance
- **P**roduction - Test, verify, and deploy

```
┌─────────────────────────────────────────────────────────────┐
│                      SHIP Workflow                          │
├─────────┬─────────────┬────────────────┬───────────────────┤
│  SCOPE  │  HYPOTHESIS │ IMPLEMENTATION │    PRODUCTION     │
│         │             │                │                   │
│ Define  │  Design     │  Build         │  Deploy           │
│ what &  │  how it     │  the           │  and              │
│ why     │  works      │  solution      │  verify           │
└─────────┴─────────────┴────────────────┴───────────────────┘
```

## Scope Phase

### Purpose

Define **what** you're building and **why**. This phase prevents the common mistake of jumping straight into code without understanding requirements.

### Activities

1. **Problem Statement** - What problem are you solving?
2. **User Stories** - Who uses this and how?
3. **Requirements** - Functional and non-functional needs
4. **Constraints** - Budget, time, technology limits
5. **Success Criteria** - How do you know it's done?

### G-Rump Commands

```bash
# Start scoping a new project
grump scope start "E-commerce checkout system"

# Add requirements interactively
grump scope add-requirement

# Generate a PRD from scope
grump scope generate-prd
```

### Example Scope

```markdown
## Problem Statement
Users abandon carts because checkout is too slow and confusing.

## User Stories
- As a customer, I want to checkout in under 2 minutes
- As a customer, I want to save payment methods
- As an admin, I want to see checkout analytics

## Requirements
- Guest checkout option
- Multiple payment providers (Stripe, PayPal)
- Address validation
- Order confirmation emails
- Mobile-responsive design

## Constraints
- Must integrate with existing user system
- PCI compliance required
- Launch in 6 weeks

## Success Criteria
- Checkout completion rate > 80%
- Average checkout time < 90 seconds
- Zero payment processing errors
```

## Hypothesis Phase

### Purpose

Design **how** the system will work before writing code. Generate architecture, data models, and technical specifications.

### Activities

1. **Architecture Design** - System components and interactions
2. **Data Modeling** - Database schemas and relationships
3. **API Design** - Endpoints, contracts, authentication
4. **Technology Selection** - Stack decisions with rationale
5. **Risk Assessment** - What could go wrong?

### G-Rump Commands

```bash
# Generate architecture from scope
grump architect

# Specific architecture views
grump architect --view data-model
grump architect --view api
grump architect --view infrastructure

# Interactive architecture refinement
grump architect refine
```

### Example Output

```
📐 Architecture: E-commerce Checkout

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  API Gateway │────▶│   Services   │
│   (React)    │     │   (Express)  │     │              │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                     ┌───────────────────────────┼───────┐
                     │              │            │       │
               ┌─────▼─────┐ ┌─────▼─────┐ ┌────▼────┐  │
               │  Checkout │ │  Payment  │ │  Order  │  │
               │  Service  │ │  Service  │ │ Service │  │
               └───────────┘ └───────────┘ └─────────┘  │
                                                        │
                     ┌──────────────────────────────────┘
                     ▼
              ┌──────────────┐     ┌──────────────┐
              │  PostgreSQL  │     │    Redis     │
              │  (Orders)    │     │   (Cache)    │
              └──────────────┘     └──────────────┘

Technology Decisions:
- React for frontend: Existing team expertise
- Express API: Lightweight, good middleware ecosystem
- PostgreSQL: ACID compliance for transactions
- Redis: Session cache, rate limiting
- Stripe + PayPal: Cover 95% of payment preferences
```

## Implementation Phase

### Purpose

Build the solution with AI assistance, following the architecture and maintaining consistency.

### Activities

1. **Code Generation** - AI writes initial implementation
2. **Review & Refine** - Human oversight and adjustments
3. **Testing** - Automated test generation
4. **Documentation** - Inline docs and README files

### G-Rump Commands

```bash
# Generate implementation from architecture
grump implement

# Generate specific components
grump implement --component checkout-service
grump implement --component payment-integration

# Generate tests
grump test generate

# Interactive coding session
grump code
```

### Code Mode Features

- **Context-aware generation** - Understands your full codebase
- **Pattern matching** - Follows your existing code style
- **Incremental changes** - Modify existing code safely
- **Explanation mode** - Understand what was generated

## Production Phase

### Purpose

Ensure the implementation is correct, secure, and ready for deployment.

### Activities

1. **Testing** - Run all tests, add edge cases
2. **Security Review** - Check for vulnerabilities
3. **Performance** - Load testing and optimization
4. **Documentation** - API docs, deployment guides
5. **Deployment** - CI/CD setup, monitoring

### G-Rump Commands

```bash
# Run verification suite
grump verify

# Security scan
grump security scan

# Generate deployment config
grump deploy generate --target kubernetes
grump deploy generate --target docker-compose

# Create release
grump release prepare
```

### Production Checklist

G-Rump generates a production checklist:

```markdown
## Production Readiness Checklist

### Code Quality
- [x] All tests passing
- [x] Code coverage > 80%
- [x] No linting errors
- [x] TypeScript strict mode

### Security
- [x] Dependencies scanned (0 critical)
- [x] Secrets in environment variables
- [x] Input validation on all endpoints
- [x] Rate limiting configured

### Performance
- [x] Database queries optimized
- [x] Caching implemented
- [x] Load tested to 1000 RPS

### Operations
- [x] Health check endpoint
- [x] Structured logging
- [x] Error tracking (Sentry)
- [x] Monitoring dashboards
```

## Iterating Through SHIP

SHIP isn't strictly linear. You can:

- **Loop back** - Discovery during Implementation may require revisiting Hypothesis
- **Partial cycles** - Small features might skip formal Scope
- **Parallel tracks** - Multiple features in different phases

```
Scope ──▶ Hypothesis ──▶ Implementation ──▶ Production
  ▲            │               │                │
  │            │               │                │
  └────────────┴───────────────┴────────────────┘
           (iterate as needed)
```

## Best Practices

1. **Don't skip Scope** - 5 minutes of scoping saves hours of rework
2. **Review Hypothesis** - AI architecture needs human validation
3. **Iterate small** - Small SHIP cycles are better than big waterfalls
4. **Document decisions** - Future you will thank present you

## Next Steps

- [Intent Compiler](/guide/intent-compiler) - How G-Rump understands you
- [Architecture Mode](/guide/architecture-mode) - Deep dive into Hypothesis phase
- [Code Mode](/guide/code-mode) - Deep dive into Implementation phase
