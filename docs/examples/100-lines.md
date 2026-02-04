# G-Rump in 100 Lines

Quick, copy-pasteable examples showing core G-Rump capabilities.

## 1. Custom Agent (100 lines)

Create your own specialized agent that can use tools:

```typescript
// agents/my-agent.ts
import { Agent, Tool } from '@grump/core';

// Define a custom tool
const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information',
  parameters: {
    query: { type: 'string', description: 'Search query' }
  },
  async execute({ query }) {
    // Your search implementation
    return { results: [`Result for: ${query}`] };
  }
};

// Create the agent
export const myAgent = new Agent({
  name: 'ResearchAssistant',
  description: 'Helps with research tasks',
  systemPrompt: `You are a research assistant. 
Use the web_search tool when you need current information.
Be concise and cite sources.`,
  tools: [webSearchTool],
  model: 'moonshotai/kimi-k2.5', // or 'mock-ai' for testing
  maxSteps: 5
});

// Use it
async function main() {
  const result = await myAgent.run(
    "What's the latest in AI development?"
  );
  console.log(result.response);
}

main();
```

**Run it:**
```bash
# With mock mode (no API key needed)
MOCK_AI_MODE=true npx tsx agents/my-agent.ts

# With real AI
NVIDIA_NIM_API_KEY=xxx npx tsx agents/my-agent.ts
```

## 2. Simple RAG Setup (80 lines)

Add document search to your app:

```typescript
// rag/simple-rag.ts
import { RAG, Document } from '@grump/rag';

// Initialize RAG
const rag = new RAG({
  vectorStore: 'memory', // or 'pinecone' for production
  embedModel: 'nvidia/nv-embed-v2',
  llmModel: 'moonshotai/kimi-k2.5'
});

// Add documents
const docs: Document[] = [
  {
    id: '1',
    content: 'G-Rump supports multiple AI providers including NVIDIA NIM.',
    metadata: { source: 'docs' }
  },
  {
    id: '2', 
    content: 'Mock mode allows testing without API keys.',
    metadata: { source: 'docs' }
  }
];

await rag.index(docs);

// Query
async function ask(question: string) {
  const result = await rag.query({
    question,
    topK: 3,
    includeSources: true
  });
  
  console.log('Answer:', result.answer);
  console.log('Sources:', result.sources);
}

// Try it
await ask("What AI providers does G-Rump support?");
```

**Run it:**
```bash
MOCK_AI_MODE=true npx tsx rag/simple-rag.ts
```

## 3. Intent Compiler (60 lines)

Convert natural language to structured commands:

```typescript
// intent/parse-request.ts
import { IntentCompiler } from '@grump/compiler';

const compiler = new IntentCompiler({
  mode: 'hybrid' // Use Rust when available, fallback to LLM
});

// Parse natural language
async function parseIntent(input: string) {
  const intent = await compiler.compile(input);
  
  console.log('Action:', intent.action);
  console.log('Parameters:', intent.parameters);
  console.log('Confidence:', intent.confidence);
  
  return intent;
}

// Examples
await parseIntent("Create a React component for a user profile");
// → { action: 'codegen', parameters: { type: 'component', framework: 'react', name: 'user-profile' } }

await parseIntent("Generate architecture for an e-commerce app");
// → { action: 'architecture', parameters: { domain: 'e-commerce' } }

await parseIntent("Deploy to Docker");
// → { action: 'ship', parameters: { target: 'docker' } }
```

## 4. API Integration (90 lines)

Call G-Rump from your app:

```typescript
// api/client.ts
import { GRumpClient } from '@grump/client';

const client = new GRumpClient({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.GRUMP_API_KEY // optional if auth disabled
});

// Chat with AI
async function chat(message: string) {
  const stream = await client.chat.stream({
    message,
    mode: 'chat',
    sessionId: 'my-session'
  });
  
  for await (const chunk of stream) {
    process.stdout.write(chunk.content);
  }
}

// Generate code
async function generateCode(prompt: string) {
  const result = await client.codegen({
    prompt,
    language: 'typescript',
    includeTests: true
  });
  
  console.log('Code:', result.code);
  console.log('Tests:', result.tests);
  return result;
}

// Generate architecture diagram
async function createDiagram(description: string) {
  const result = await client.architecture.diagram({
    description,
    format: 'mermaid'
  });
  
  console.log('Mermaid diagram:', result.diagram);
  return result;
}

// Use them
await chat("Hello! What can you do?");
await generateCode("A function to validate email addresses");
await createDiagram("A microservices architecture for a SaaS app");
```

## 5. CLI Script (50 lines)

Create command-line tools:

```typescript
#!/usr/bin/env node
// cli/my-cli.ts
import { CLI } from '@grump/cli';

const cli = new CLI();

// Add commands
cli.command('ship <message>')
  .description('Ship code with a message')
  .action(async (message) => {
    const result = await cli.ship(message);
    console.log('✓ Shipped:', result.commitHash);
  });

cli.command('ask <question>')
  .description('Ask AI a question')
  .option('-m, --mode <mode>', 'Response mode', 'chat')
  .action(async (question, options) => {
    const response = await cli.chat(question, { mode: options.mode });
    console.log(response);
  });

cli.command('arch <description>')
  .description('Generate architecture')
  .option('-o, --output <file>', 'Output file')
  .action(async (description, options) => {
    const arch = await cli.architecture(description);
    if (options.output) {
      await Bun.write(options.output, arch.diagram);
      console.log('✓ Written to', options.output);
    } else {
      console.log(arch.diagram);
    }
  });

// Run
cli.parse(process.argv);
```

**Use it:**
```bash
chmod +x cli/my-cli.ts
./cli/my-cli.ts ship "Fix login bug"
./cli/my-cli.ts ask "How do I use TypeScript generics?"
./cli/my-cli.ts arch "A payment processing system" -o payment.md
```

## 6. Svelte Component (100 lines)

Embed G-Rump in your Svelte app:

```svelte
<!-- components/AIChat.svelte -->
<script>
  import { createChat } from '@grump/svelte';
  import { Send, Loader2 } from 'lucide-svelte';
  
  const { messages, send, isLoading } = createChat({
    mode: 'chat',
    streaming: true
  });
  
  let input = '';
  
  async function handleSubmit() {
    if (!input.trim()) return;
    await send(input);
    input = '';
  }
</script>

<div class="chat-container">
  <div class="messages">
    {#each $messages as msg}
      <div class="message {msg.role}">
        <div class="content">{msg.content}</div>
      </div>
    {/each}
    
    {#if $isLoading}
      <div class="loading">
        <Loader2 class="spin" />
        Thinking...
      </div>
    {/if}
  </div>
  
  <form on:submit|preventDefault={handleSubmit} class="input-area">
    <input
      bind:value={input}
      placeholder="Ask anything..."
      disabled={$isLoading}
    />
    <button type="submit" disabled={$isLoading || !input.trim()}>
      <Send size={20} />
    </button>
  </form>
</div>

<style>
  .chat-container {
    display: flex;
    flex-direction: column;
    height: 400px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .message {
    margin-bottom: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
  }
  
  .message.user {
    background: #3b82f6;
    color: white;
    margin-left: 2rem;
  }
  
  .message.assistant {
    background: #f3f4f6;
    margin-right: 2rem;
  }
  
  .input-area {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
  }
  
  input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
  }
  
  button {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .spin {
    animation: spin 1s linear infinite;
  }
</style>
```

## Quick Start Checklist

- [ ] Run `npm run setup:interactive`
- [ ] Choose "Quick Start" mode (no API keys)
- [ ] Start with `npm run dev`
- [ ] Try the examples above
- [ ] Add real API key when ready

**Need Help?**
- See `docs/GETTING_STARTED.md` for full guide
- Check `docs/examples/` for more samples
- Run `npm run check-all` to verify setup
