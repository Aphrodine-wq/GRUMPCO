import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.js';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'G-Rump API',
            version: '2.1.0',
            description: 'The AI Product Operating System - Transform natural language into production-ready code',
            contact: {
                name: 'G-Rump Team',
                email: 'support@g-rump.com',
                url: 'https://g-rump.com'
            },
            license: {
                name: 'MIT',
                url: 'https://github.com/Aphrodine-wq/GRUMPCO/blob/main/LICENSE'
            }
        },
        servers: [
            {
                url: env.NODE_ENV === 'production' ? 'https://api.g-rump.com' : `http://localhost:${env.PORT}`,
                description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                },
                apiKey: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'object',
                            properties: {
                                message: { type: 'string' },
                                code: { type: 'string' },
                                details: { type: 'object' }
                            }
                        }
                    }
                },
                ShipRequest: {
                    type: 'object',
                    required: ['projectDescription'],
                    properties: {
                        projectDescription: {
                            type: 'string',
                            description: 'Natural language description of the project to build',
                            example: 'Build a todo app with user authentication and real-time sync'
                        },
                        preferences: {
                            type: 'object',
                            properties: {
                                techStack: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    example: ['React', 'Node.js', 'PostgreSQL']
                                },
                                stylePreferences: { type: 'string' },
                                deploymentTarget: { type: 'string', enum: ['docker', 'vercel', 'netlify', 'aws', 'gcp'] }
                            }
                        }
                    }
                },
                ShipResponse: {
                    type: 'object',
                    properties: {
                        sessionId: { type: 'string', format: 'uuid' },
                        phase: { type: 'string', enum: ['design', 'spec', 'plan', 'code', 'complete'] },
                        status: { type: 'string', enum: ['pending', 'in_progress', 'complete', 'error'] },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                ChatMessage: {
                    type: 'object',
                    required: ['role', 'content'],
                    properties: {
                        role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                        content: { type: 'string' },
                        toolCalls: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    arguments: { type: 'object' }
                                }
                            }
                        }
                    }
                },
                ArchitectureRequest: {
                    type: 'object',
                    required: ['description'],
                    properties: {
                        description: { type: 'string' },
                        diagramType: { type: 'string', enum: ['c4', 'erd', 'sequence', 'flowchart'] },
                        level: { type: 'string', enum: ['context', 'container', 'component', 'code'] }
                    }
                },
                ModelInfo: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        provider: { type: 'string' },
                        capabilities: { type: 'array', items: { type: 'string' } },
                        costPer1kTokens: { type: 'number' },
                        speedRank: { type: 'integer' },
                        qualityRank: { type: 'integer' }
                    }
                }
            }
        },
        tags: [
            { name: 'Ship', description: 'Full project generation workflow' },
            { name: 'Chat', description: 'Interactive AI chat with tools' },
            { name: 'Codegen', description: 'Code generation operations' },
            { name: 'Architecture', description: 'Architecture diagram generation' },
            { name: 'RAG', description: 'Retrieval-Augmented Generation' },
            { name: 'Models', description: 'AI model management' },
            { name: 'Health', description: 'Service health and metrics' },
            { name: 'Auth', description: 'Authentication and authorization' }
        ]
    },
    apis: [
        './src/routes/**/*.ts',
        './src/routes/**/*.js'
    ]
};

export const swaggerSpec = swaggerJsdoc(options);
