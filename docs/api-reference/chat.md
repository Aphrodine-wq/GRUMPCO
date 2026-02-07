# Chat API

The Chat API provides a streaming endpoint for chat with tool-calling support.

---

## POST `/api/chat/stream`

Streaming chat endpoint with tool calling support.

**Request:**
```bash
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "messages": [
      {"role": "user", "content": "Create a React component for a user profile"}
    ],
    "workspaceRoot": "/path/to/workspace",
    "mode": "normal",
    "agentProfile": "frontend",
    "modelPreset": "quality"
  }'
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | Message[] | Yes | Chat history |
| `messages[].role` | string | Yes | `user` or `assistant` |
| `messages[].content` | string/array | Yes | Text or multimodal content |
| `workspaceRoot` | string | No | Workspace path for tool execution |
| `mode` | string | No | `normal`, `plan`, `spec`, `execute`, `design` |
| `agentProfile` | string | No | `general`, `router`, `frontend`, `backend`, `devops`, `test` |
| `modelPreset` | string | No | `fast`, `quality`, `balanced` |
| `sessionType` | string | No | `chat`, `gAgent` |
| `toolAllowlist` | string[] | No | Allowed tool names |
| `toolDenylist` | string[] | No | Blocked tool names |
| `autonomous` | boolean | No | Enable autonomous mode |
| `includeRagContext` | boolean | No | Include RAG context |

**SSE Events:**

```
event: message
data: {"type": "chunk", "content": "I'll create a React component..."}

event: tool_call
data: {"type": "tool_call", "tool": "file_write", "args": {...}}

event: tool_result
data: {"type": "tool_result", "tool": "file_write", "result": {...}}

event: done
data: {"type": "done", "usage": {"promptTokens": 100, "completionTokens": 250}}
```
