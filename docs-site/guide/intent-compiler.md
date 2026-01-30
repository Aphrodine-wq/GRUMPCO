# Intent Compiler

The Intent Compiler is G-Rump's core technology for understanding what you want to build and translating it into technical specifications.

## What is the Intent Compiler?

The Intent Compiler transforms natural language descriptions into structured, actionable technical artifacts:

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Natural Lang.  │────▶│  Intent Compiler  │────▶│   Structured    │
│  "I want to..." │     │                   │     │   Output        │
└─────────────────┘     └───────────────────┘     └─────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │   PRD    │ │  Schema  │ │   API    │
              │          │ │          │ │   Spec   │
              └──────────┘ └──────────┘ └──────────┘
```

## How It Works

### 1. Input Analysis

The Intent Compiler analyzes your input to extract:

- **Entities** - Things in your system (User, Product, Order)
- **Actions** - What users do (create, purchase, cancel)
- **Relationships** - How entities connect
- **Constraints** - Rules and limitations
- **Non-functional requirements** - Performance, security needs

### 2. Clarification

If your input is ambiguous, G-Rump asks clarifying questions:

```
You: "Build a chat app"

G-Rump: I need a few clarifications:
1. Real-time or polling-based messages?
2. One-on-one, group chats, or both?
3. Message persistence required?
4. File/image attachments?
5. Read receipts and typing indicators?
```

### 3. Specification Generation

The compiler produces structured output:

```yaml
# Generated specification
entities:
  User:
    properties:
      - id: uuid
      - email: string (unique)
      - name: string
      - avatar: string (optional)
      - createdAt: timestamp
    relationships:
      - hasMany: Message
      - belongsToMany: Conversation

  Conversation:
    properties:
      - id: uuid
      - type: enum (direct, group)
      - name: string (optional)
      - createdAt: timestamp
    relationships:
      - belongsToMany: User
      - hasMany: Message

  Message:
    properties:
      - id: uuid
      - content: string
      - type: enum (text, image, file)
      - readAt: timestamp (optional)
      - createdAt: timestamp
    relationships:
      - belongsTo: User
      - belongsTo: Conversation

features:
  - Real-time messaging via WebSocket
  - Group conversations (up to 50 members)
  - Message persistence (PostgreSQL)
  - File attachments (S3)
  - Read receipts
  - Typing indicators
```

## Output Types

### Product Requirements Document (PRD)

A complete product specification:

```markdown
# Chat Application PRD

## Overview
A real-time messaging platform supporting direct and group conversations.

## User Stories
- As a user, I can send messages that appear instantly
- As a user, I can create group conversations
- As a user, I can share images and files
- As a user, I can see when messages are read

## Features
### P0 (Must Have)
- User authentication
- Direct messaging
- Message persistence

### P1 (Should Have)
- Group conversations
- File attachments
- Read receipts

### P2 (Nice to Have)
- Typing indicators
- Message reactions
- Message search
```

### Data Schema

Database schema in multiple formats:

```sql
-- PostgreSQL Schema
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group')),
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text',
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Specification

OpenAPI/Swagger specification:

```yaml
openapi: 3.0.0
info:
  title: Chat API
  version: 1.0.0

paths:
  /conversations:
    get:
      summary: List user's conversations
      responses:
        200:
          description: List of conversations
    post:
      summary: Create a conversation
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateConversation'

  /conversations/{id}/messages:
    get:
      summary: Get conversation messages
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
    post:
      summary: Send a message
```

### Architecture Diagram

Visual system representation:

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Web App   │  │  iOS App    │  │ Android App │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────▼──────┐
                    │   API GW    │
                    │  (Express)  │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │     REST     │ │  WebSocket   │ │    Auth      │
   │   Service    │ │   Server     │ │   Service    │
   └──────┬───────┘ └──────┬───────┘ └──────────────┘
          │                │
          └────────┬───────┘
                   ▼
            ┌──────────────┐     ┌──────────────┐
            │  PostgreSQL  │     │    Redis     │
            │  (Messages)  │     │  (Presence)  │
            └──────────────┘     └──────────────┘
```

## Using the Intent Compiler

### CLI

```bash
# Interactive mode
grump intent

# From a file
grump intent --input requirements.txt

# Specific output
grump intent --output prd
grump intent --output schema
grump intent --output api
```

### Desktop App

1. Open the **Intent** tab
2. Type or paste your description
3. Click **Compile**
4. Review and refine outputs
5. Export to Architecture mode

### API

```bash
curl -X POST http://localhost:3000/api/intent/compile \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Build a task management app with projects and team collaboration",
    "outputs": ["prd", "schema", "api"]
  }'
```

## Best Practices

### Be Specific

Instead of:
> "Build a blog"

Try:
> "Build a blog platform where authors can write posts with rich text, readers can comment, and admins can moderate content. Posts should have categories and tags. Support draft and published states."

### Include Context

Mention existing constraints:
> "Add a notification system to our existing Express/PostgreSQL backend. Users should receive email and in-app notifications for mentions and replies."

### Specify Non-Functional Requirements

> "The system should handle 10,000 concurrent users, have 99.9% uptime, and comply with GDPR for EU users."

## Iteration

The Intent Compiler supports iterative refinement:

```
You: "Add multi-language support to the blog"

G-Rump: Updated specification to include:
- Post.locale field (en, es, fr, de, ja)
- Translation relationship between posts
- Locale-aware URL routing (/en/post, /es/post)
- Updated API with Accept-Language header support

View diff? [Y/n]
```

## Next Steps

- [SHIP Workflow](/guide/ship-workflow) - See how Intent Compiler fits in
- [Architecture Mode](/guide/architecture-mode) - Use compiled intent
- [API Reference](/api/overview) - Intent Compiler API
