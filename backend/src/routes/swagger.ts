/**
 * OpenAPI/Swagger Configuration for G-Rump API
 * Provides auto-generated API documentation.
 *
 * @module swagger
 */

// Note: Install these packages: npm install swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";
import { env } from "../config/env.js";

const isProduction = env.NODE_ENV === "production";

// ============================================================================
// OpenAPI Specification
// ============================================================================

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "G-Rump API",
    version: "2.1.0",
    description: `
G-Rump Enterprise AI Development Platform API.

## Overview
G-Rump provides AI-powered code generation, architecture design, and development workflow automation.

## Supported AI Providers
- **NVIDIA NIM** (Recommended) - Kimi K2.5, DeepSeek, Mistral
- **OpenRouter** - Claude, GPT-4, Llama, and more
- **Groq** - Ultra-fast Llama 3, Mixtral inference
- **Ollama** - Local model deployment

## Authentication
Most endpoints require authentication via Bearer token:
\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## Rate Limits
- Free tier: 100 requests/hour
- Pro tier: 1000 requests/hour
- Team tier: 5000 requests/hour
- Enterprise: Custom limits

## Error Handling
All errors follow a consistent format:
\`\`\`json
{
  "error": "Error message",
  "code": "error_code",
  "details": "Additional context (dev only)"
}
\`\`\`
    `,
    contact: {
      name: "G-Rump Support",
      url: "https://g-rump.com/support",
      email: "support@g-rump.com",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: isProduction
        ? env.PUBLIC_BASE_URL || "https://api.g-rump.com"
        : "http://localhost:3000",
      description: isProduction ? "Production" : "Development",
    },
  ],
  tags: [
    { name: "Health", description: "Health check endpoints" },
    { name: "Auth", description: "Authentication and authorization" },
    { name: "Chat", description: "AI chat and conversation" },
    {
      name: "Ship",
      description: "SHIP workflow (Spec, Hypothesis, Implement, Prove)",
    },
    { name: "Architecture", description: "System architecture generation" },
    { name: "PRD", description: "Product Requirements Document generation" },
    { name: "Codegen", description: "Code generation" },
    { name: "RAG", description: "Retrieval Augmented Generation" },
    { name: "Agents", description: "AI agent management" },
    { name: "Memory", description: "Long-term memory management" },
    { name: "Settings", description: "User settings" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", description: "Error message" },
          code: { type: "string", description: "Error code" },
          details: {
            type: "string",
            description: "Additional details (dev only)",
          },
        },
        required: ["error", "code"],
      },
      Message: {
        type: "object",
        properties: {
          role: {
            type: "string",
            enum: ["user", "assistant", "system"],
          },
          content: {
            oneOf: [
              { type: "string" },
              {
                type: "array",
                items: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["text"] },
                        text: { type: "string" },
                      },
                    },
                    {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["image_url"] },
                        image_url: {
                          type: "object",
                          properties: {
                            url: { type: "string", format: "uri" },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        required: ["role", "content"],
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Architecture: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          projectName: { type: "string" },
          projectDescription: { type: "string" },
          c4Diagrams: {
            type: "object",
            properties: {
              context: { type: "string" },
              container: { type: "string" },
              component: { type: "string" },
            },
          },
          metadata: { type: "object" },
        },
      },
      PRD: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          overview: { type: "string" },
          userStories: {
            type: "array",
            items: { type: "object" },
          },
          technicalRequirements: {
            type: "array",
            items: { type: "object" },
          },
        },
      },
      VectorChunk: {
        type: "object",
        properties: {
          id: { type: "string" },
          content: { type: "string" },
          source: { type: "string" },
          type: {
            type: "string",
            enum: ["doc", "code", "spec", "grump"],
          },
          score: { type: "number" },
        },
      },
      MemoryRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: [
              "interaction",
              "correction",
              "preference",
              "fact",
              "context",
              "feedback",
            ],
          },
          content: { type: "string" },
          summary: { type: "string" },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Authentication required", code: "unauthorized" },
          },
        },
      },
      Forbidden: {
        description: "Access denied",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Access denied", code: "forbidden" },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Resource not found", code: "not_found" },
          },
        },
      },
      RateLimited: {
        description: "Rate limit exceeded",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "Too many requests", code: "rate_limit" },
          },
        },
      },
      ValidationError: {
        description: "Validation failed",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string" },
                code: { type: "string" },
                errors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    // Health endpoints
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Basic health check",
        responses: {
          200: {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/health/detailed": {
      get: {
        tags: ["Health"],
        summary: "Detailed health check with component status",
        responses: {
          200: {
            description: "Health status of all components",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "degraded", "unhealthy"],
                    },
                    timestamp: { type: "string", format: "date-time" },
                    checks: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    },
    // Chat endpoints
    "/api/chat/stream": {
      post: {
        tags: ["Chat"],
        summary: "Stream chat completion",
        description:
          "Send messages and receive streaming AI responses with tool calling support.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["messages"],
                properties: {
                  messages: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Message" },
                    minItems: 1,
                    maxItems: 50,
                  },
                  workspaceRoot: { type: "string" },
                  mode: {
                    type: "string",
                    enum: ["normal", "plan", "spec", "execute", "argument"],
                  },
                  provider: {
                    type: "string",
                    enum: ["nim", "mock"],
                    description: "AI provider - NVIDIA NIM (powered by NVIDIA)",
                  },
                  modelId: { type: "string" },
                  autonomous: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "SSE stream of chat events",
            content: {
              "text/event-stream": {
                schema: { type: "string" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    // Ship endpoints
    "/api/ship/start": {
      post: {
        tags: ["Ship"],
        summary: "Start SHIP workflow",
        description:
          "Begin the Spec-Hypothesis-Implement-Prove workflow for a project.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["projectDescription"],
                properties: {
                  projectDescription: { type: "string", maxLength: 16000 },
                  projectName: { type: "string" },
                  complexity: {
                    type: "string",
                    enum: ["simple", "medium", "complex", "enterprise"],
                  },
                  techStack: {
                    type: "array",
                    items: { type: "string" },
                  },
                  stream: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "SHIP workflow started",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sessionId: { type: "string", format: "uuid" },
                    phase: { type: "string" },
                    status: { type: "string" },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    // Architecture endpoints
    "/api/architecture/generate": {
      post: {
        tags: ["Architecture"],
        summary: "Generate system architecture",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["projectDescription"],
                properties: {
                  projectDescription: { type: "string" },
                  projectType: { type: "string" },
                  techStack: { type: "array", items: { type: "string" } },
                  complexity: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Architecture generated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    status: { type: "string" },
                    architecture: { $ref: "#/components/schemas/Architecture" },
                  },
                },
              },
            },
          },
        },
      },
    },
    // RAG endpoints
    "/api/rag/query": {
      post: {
        tags: ["RAG"],
        summary: "Query the RAG vector store",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: { type: "string" },
                  topK: { type: "integer", default: 10 },
                  types: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: ["doc", "code", "spec", "grump"],
                    },
                  },
                  threshold: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Query results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: { $ref: "#/components/schemas/VectorChunk" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    // Memory endpoints
    "/api/memory/store": {
      post: {
        tags: ["Memory"],
        summary: "Store a memory",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "content"],
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "interaction",
                      "correction",
                      "preference",
                      "fact",
                      "context",
                      "feedback",
                    ],
                  },
                  content: { type: "string" },
                  priority: {
                    type: "string",
                    enum: ["low", "medium", "high", "critical"],
                  },
                  ttl: {
                    type: "integer",
                    description: "Time-to-live in seconds",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Memory stored",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MemoryRecord" },
              },
            },
          },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  // Path to the API docs - we're using inline definitions above
  apis: [],
};

// ============================================================================
// Swagger Setup
// ============================================================================

const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI on an Express app.
 */
export function setupSwagger(app: Express, basePath = "/docs"): void {
  // Serve swagger spec as JSON
  app.get(`${basePath}/swagger.json`, (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // Serve Swagger UI
  app.use(
    basePath,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "G-Rump API Documentation",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
      },
    }),
  );

  // Also serve at /api-docs for compatibility
  app.get("/api-docs", (_req, res) => {
    res.redirect(basePath);
  });
}

export { swaggerSpec };
