# Multi-Agent System

G-Rump uses specialized AI agents that work together to handle different aspects of software development.

## Overview

Instead of a single AI trying to do everything, G-Rump orchestrates multiple specialized agents:

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                        │
│              (Routes tasks to specialists)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   Architect   │ │     Coder     │ │   Reviewer    │
│     Agent     │ │     Agent     │ │     Agent     │
└───────────────┘ └───────────────┘ └───────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    DevOps     │ │   Security    │ │     Docs      │
│     Agent     │ │     Agent     │ │     Agent     │
└───────────────┘ └───────────────┘ └───────────────┘
```

## Agent Types

### Orchestrator Agent

The conductor of the agent orchestra.

**Responsibilities:**
- Analyzes incoming requests
- Routes tasks to appropriate specialists
- Manages agent collaboration
- Synthesizes results

**Example:**
```
User: "Add user authentication to my app"

Orchestrator thinks:
1. This needs architecture decisions → Architect Agent
2. Code changes required → Coder Agent
3. Security implications → Security Agent
4. Tests needed → Reviewer Agent
5. Docs update → Docs Agent

Routes to agents in optimal order...
```

### Architect Agent

Designs system structure and makes technology decisions.

**Capabilities:**
- System architecture design
- Data modeling
- API design
- Technology selection
- Scalability planning

**Output examples:**
- Architecture diagrams
- Database schemas
- API specifications
- Technology decision records (TDRs)

```
Architect Agent Output:

Authentication Architecture:
├── Strategy: JWT with refresh tokens
├── Storage: PostgreSQL (users), Redis (sessions)
├── Endpoints:
│   ├── POST /auth/register
│   ├── POST /auth/login
│   ├── POST /auth/refresh
│   └── POST /auth/logout
└── Security:
    ├── Password: bcrypt (cost 12)
    ├── JWT: RS256 (asymmetric)
    └── Rate limiting: 5 attempts/minute
```

### Coder Agent

Writes and modifies code following best practices.

**Capabilities:**
- Code generation
- Code modification
- Refactoring
- Pattern implementation
- Test writing

**Languages:**
- TypeScript/JavaScript
- Python
- Go
- Rust
- And more...

**Example interaction:**
```
Coder Agent: Generating auth middleware...

// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwt';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const payload = await verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Reviewer Agent

Validates code quality and catches issues.

**Capabilities:**
- Code review
- Test coverage analysis
- Best practice validation
- Performance review
- Consistency checking

**Review output:**
```
Code Review Results:

✅ Passed
- Type safety: All functions properly typed
- Error handling: Comprehensive try/catch
- Naming conventions: Consistent

⚠️ Suggestions
- Line 23: Consider extracting magic number to constant
- Line 45: This could be simplified using optional chaining

❌ Issues
- Line 67: Potential SQL injection vulnerability
  Fix: Use parameterized query instead of string interpolation
```

### Security Agent

Identifies and prevents security vulnerabilities.

**Capabilities:**
- Vulnerability scanning
- Security best practices
- Dependency auditing
- Compliance checking
- Threat modeling

**Security report:**
```
Security Analysis:

🔴 Critical (1)
- Hardcoded API key in config.ts:15
  Action: Move to environment variable

🟡 Warning (2)
- Missing rate limiting on /auth endpoints
  Action: Add rate limiter middleware
- No CORS configuration
  Action: Configure allowed origins

🟢 Good practices detected
- Password hashing with bcrypt
- HTTPS enforced
- SQL injection prevention
```

### DevOps Agent

Handles deployment and infrastructure concerns.

**Capabilities:**
- CI/CD pipeline generation
- Docker configuration
- Kubernetes manifests
- Infrastructure as Code
- Monitoring setup

**Example output:**
```yaml
# Generated Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

### Docs Agent

Creates and maintains documentation.

**Capabilities:**
- API documentation
- Code comments
- README generation
- Architecture docs
- User guides

**Output example:**
```markdown
## Authentication API

### Register User

Creates a new user account.

**Endpoint:** `POST /auth/register`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Valid email address |
| password | string | Yes | Min 8 characters |
| name | string | No | Display name |

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbG..."
}
```
```

## Agent Collaboration

Agents work together on complex tasks:

```
User: "Add a payment system"

1. Orchestrator: Analyzes request, creates plan

2. Architect Agent:
   - Designs payment flow
   - Selects Stripe integration
   - Defines data models

3. Security Agent:
   - Reviews architecture for PCI compliance
   - Recommends security measures

4. Coder Agent:
   - Implements payment service
   - Creates webhook handlers
   - Writes integration code

5. Reviewer Agent:
   - Reviews generated code
   - Checks test coverage

6. DevOps Agent:
   - Updates environment config
   - Adds Stripe webhook URL

7. Docs Agent:
   - Documents payment API
   - Creates integration guide

8. Orchestrator: Synthesizes all outputs
```

## Configuration

### Enabling/Disabling Agents

```json
// .grumprc.json
{
  "agents": {
    "architect": true,
    "coder": true,
    "reviewer": true,
    "security": true,
    "devops": false,  // Disabled
    "docs": true
  }
}
```

### Agent Preferences

```json
{
  "agents": {
    "coder": {
      "style": "functional",
      "verbosity": "concise",
      "testCoverage": "high"
    },
    "reviewer": {
      "strictness": "high",
      "focusAreas": ["security", "performance"]
    }
  }
}
```

## Custom Agents

Create custom agents for your specific needs:

```javascript
// custom-agents/compliance.agent.js
export default {
  name: 'compliance',
  description: 'Ensures HIPAA compliance',
  triggers: ['healthcare', 'patient', 'phi'],
  
  async analyze(context) {
    // Custom compliance logic
    return {
      compliant: true,
      recommendations: []
    };
  }
};
```

## Next Steps

- [Architecture Mode](/guide/architecture-mode) - Architect Agent in depth
- [Code Mode](/guide/code-mode) - Coder Agent in depth
- [Security](/guide/security) - Security Agent configuration
