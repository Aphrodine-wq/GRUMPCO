# SDK Examples

This page provides examples of how to use the G-Rump SDKs.

## JavaScript/TypeScript

```typescript
import { G-RumpClient } from '@g-rump/sdk';

const client = new G-RumpClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Start SHIP workflow
const session = await client.ship.start({
  projectDescription: 'Build a blog platform',
  preferences: {
    techStack: ['Next.js', 'Prisma', 'PostgreSQL']
  }
});

// Stream execution
for await (const event of client.ship.streamExecute(session.sessionId)) {
  console.log(event.phase, event.progress);
}
```

## Python

```python
from grump import G-RumpClient

client = G-RumpClient(base_url='http://localhost:3000')

# Generate architecture
diagram = client.architecture.generate(
    intent="E-commerce platform",
    diagram_type="c4-container"
)
print(diagram['summary'])
```

## cURL

```bash
# Chat with streaming
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

