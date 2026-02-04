# Frequently Asked Questions (FAQ)

> **Version:** 2.1.0 | **Last Updated:** February 2026

## General Questions

### What is G-Rump?

G-Rump is an AI-powered development platform that transforms natural language into production-ready code. It bridges the gap between business requirements and working software through an **Architecture-as-Code** approach.

### How is G-Rump different from other AI coding tools?

| Feature | G-Rump | Others |
|---------|--------|--------|
| Architecture-first | ✅ Diagrams before code | ❌ Code only |
| Multi-agent system | ✅ 8 specialized agents | ❌ Single model |
| 18x faster builds | ✅ SWC + Rust compiler | ❌ Standard builds |
| 60-70% cost savings | ✅ Smart routing + caching | ❌ Direct API calls |
| Enterprise security | ✅ Built-in guardrails | ❌ Basic safety |
| NVIDIA ecosystem | ✅ Full NIM/NeMo stack | ❌ Generic providers |

### What can I build with G-Rump?

- Web applications (React, Vue, Angular, Svelte)
- APIs and backends (Node.js, Python, Go, Rust)
- Mobile apps (React Native, Flutter)
- DevOps configurations (Docker, Kubernetes, CI/CD)
- Full-stack applications with databases

### Is G-Rump free to use?

Yes! G-Rump is open source (MIT license) with:
- **Free tier:** Mock mode, local development
- **Pay-as-you-go:** Bring your own API keys
- **Enterprise:** Self-hosted with advanced features

---

## Getting Started

### Do I need an API key?

**No!** G-Rump works in **Mock Mode** without any API keys. It provides realistic placeholder responses perfect for:
- Trying out the platform
- Development and testing
- Demo environments

For real AI generation, add one API key from [NVIDIA NIM](https://build.nvidia.com/), [OpenRouter](https://openrouter.ai/), or [Groq](https://groq.com/).

### What are the system requirements?

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 20.x | 20.x LTS |
| RAM | 4 GB | 8 GB |
| Disk | 2 GB | 5 GB |
| OS | Any | Linux/macOS |

### How do I install G-Rump?

**Quick start:**
```bash
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com
npm install
npm run build:packages
echo "MOCK_AI_MODE=true" > backend/.env
cd frontend && npm run electron:dev
```

See [Getting Started](./GETTING_STARTED.md) for detailed instructions.

---

## Usage

### What's the difference between Architecture Mode and Code Mode?

**Architecture Mode (Design-First):**
```
Describe → Architecture Diagram → PRD → (optional) Code
```
Best for: Planning, documentation, team collaboration

**Code Mode (Tool-Enabled):**
```
Chat with AI that can execute bash commands, edit files, and use tools
```
Best for: Direct coding, file manipulation, iterative development

### Can I use G-Rump offline?

**Partially:**
- ✅ Desktop app UI works offline
- ✅ Code editing and file operations work offline
- ❌ AI generation requires internet (unless using Ollama locally)

For fully offline AI, use [Ollama](https://ollama.com) with local models:
```bash
ollama pull llama3.1
echo "OLLAMA_URL=http://localhost:11434" >> backend/.env
```

### How do I use my own codebase?

1. Open G-Rump desktop app
2. Set workspace root (file picker or path input)
3. G-Rump will:
   - Read existing files for context
   - Suggest improvements
   - Generate new code that integrates with your codebase

---

## API & Integration

### What AI providers are supported?

| Provider | Environment Variable | Models |
|----------|---------------------|--------|
| **NVIDIA NIM** | `NVIDIA_NIM_API_KEY` | Nemotron, Llama, Mistral |
| **OpenRouter** | `OPENROUTER_API_KEY` | 100+ models |
| **Groq** | `GROQ_API_KEY` | Fast inference |
| **Together AI** | `TOGETHER_API_KEY` | Open models |
| **Ollama** | `OLLAMA_URL` | Local models |

### Can I use G-Rump via API?

Yes! All features are available via REST API:

```bash
# Start SHIP workflow
curl -X POST http://localhost:3000/api/ship/start \
  -d '{"projectDescription": "Build a blog"}'

# Streaming chat
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Accept: text/event-stream" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

See [API.md](./API.md) for complete reference.

### Is there a CLI?

Yes! Install the CLI:

```bash
npm install -g @g-rump/cli

# Usage
grump ship "Build a React dashboard"
grump chat "Explain this code"
grump analyze --workspace .
```

---

## Performance & Cost

### How does G-Rump save 60-70% on AI costs?

1. **Intelligent Caching (40% savings)**
   - 3-tier cache (L1/L2/L3)
   - 50%+ cache hit rate
   - Content-addressed keys

2. **Smart Model Routing (30% savings)**
   - Automatically selects cheapest viable model
   - Routes simple tasks to faster models

3. **Infrastructure Optimizations (25% savings)**
   - Batch processing
   - Parallel execution
   - SIMD acceleration

### Why is G-Rump 18x faster?

| Optimization | Traditional | G-Rump |
|--------------|-------------|--------|
| TypeScript compilation | ts-node (45s) | SWC (2.5s) |
| Intent parsing | LLM-only (120ms) | Rust + LLM (8ms) |
| Build pipeline | Sequential | Parallel workers |

### How much does it cost to use?

**Mock Mode:** Free (no API calls)

**Real AI:** Depends on provider and usage

Example costs (NVIDIA NIM):
- Architecture generation: ~$0.02-0.05
- Full SHIP workflow: ~$0.10-0.30
- Code mode (per message): ~$0.01-0.05

---

## Security

### Is my code secure?

Yes. G-Rump includes multiple security layers:

1. **Path validation** - All file operations sandboxed
2. **No code execution** - AI generates code, doesn't run it
3. **Audit logging** - All actions logged
4. **Secret scanning** - Detects and warns about exposed keys

### Can I use G-Rump for proprietary code?

**Yes!** Options:

1. **Self-hosted** - Run on your own infrastructure
2. **Local mode** - Everything stays on your machine
3. **VPN/Tunnel** - Secure connection to your instance

### How do I enable authentication?

```bash
# backend/.env
REQUIRE_AUTH_FOR_API=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

See [SECURITY.md](./SECURITY.md) for details.

---

## Troubleshooting

### "AI provider required" error

Add an API key or use Mock Mode:
```bash
echo "MOCK_AI_MODE=true" > backend/.env
```

### "Disconnected" in frontend

Backend isn't running:
```bash
cd backend && npm run dev
```

### Slow responses

Enable caching:
```bash
echo "TIERED_CACHE_ENABLED=true" >> backend/.env
echo "REDIS_HOST=localhost" >> backend/.env
```

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more.

---

## Contributing

### How can I contribute?

1. **Code** - See [CONTRIBUTING.md](./CONTRIBUTING.md)
2. **Documentation** - Improve docs
3. **Issues** - Report bugs or request features
4. **Community** - Help others in discussions

### What's the tech stack?

- **Frontend:** Svelte 5, Electron, TypeScript
- **Backend:** Node.js 20+, Express 5, TypeScript
- **Compiler:** Rust 1.77+
- **Testing:** Vitest, Playwright

### Where do I start?

Good first issues:
- Documentation improvements
- Bug fixes
- Test coverage

Look for `good-first-issue` label on GitHub.

---

## Roadmap

### What's coming next?

See [ROADMAP.md](./ROADMAP.md) for full details.

**Near term:**
- Enhanced VS Code extension
- Mobile app support
- More integrations (GitLab, Bitbucket)

**Long term:**
- AI agents that can learn your codebase
- Natural language database queries
- Automated refactoring suggestions

---

## Support

### Where can I get help?

- 📖 [Documentation](./README.md)
- 🐛 [Issue Tracker](https://github.com/Aphrodine-wq/G-rump.com/issues)
- 💬 [Discussions](https://github.com/Aphrodine-wq/G-rump.com/discussions)

### How do I report a bug?

Include:
1. G-Rump version
2. Node.js version
3. Operating system
4. Steps to reproduce
5. Expected vs actual behavior
6. Error messages and logs

---

## License

### What license is G-Rump under?

[MIT License](./LICENSE) - free for personal and commercial use.

### Can I use it commercially?

Yes! You can:
- Use it for your company
- Build products with it
- Offer it as a service (with attribution)

### Do I need to contribute back?

No, but contributions are welcome! 🎉
