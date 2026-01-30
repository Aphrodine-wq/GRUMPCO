# NVIDIA Models & AI Providers

G-Rump leverages cutting-edge AI models through NVIDIA NIM (NVIDIA Inference Microservices), providing access to 100+ state-of-the-art models optimized for GPU acceleration.

## Overview

G-Rump uses an intelligent model routing system that automatically selects the best model for your request based on:
- Request complexity
- Available providers
- Cost optimization
- Performance requirements
- Your preferences

### Primary: NVIDIA NIM + Kimi K2.5

Our default and recommended configuration uses **Kimi K2.5** through **NVIDIA NIM**:

```
Model: moonshotai/kimi-k2.5
Provider: NVIDIA NIM
Context: 256K tokens
Speed: Ultra-fast (GPU-accelerated)
Cost: $0.60 per 1M tokens
```

**Why Kimi K2.5?**
- 256,000 token context window
- 1T parameter MoE architecture
- Exceptional code generation capabilities
- Strong multilingual support (English, Chinese, Japanese, Korean, and more)
- Optimized for long-context understanding
- Cost-effective pricing
- GPU acceleration via NVIDIA NIM

## Available Models

### Llama Family

| Model | ID | Context | Cost (per 1M) | Parameters | Best For |
|-------|-----|---------|---------------|------------|----------|
| **Llama 4 Maverick 17B** | `meta/llama-4-maverick-17b-128e-instruct` | 256K | $0.60 | 17B (128 experts) | Chat, vision, multimodal, agentic workflows |
| **Llama 4 Scout 17B** | `meta/llama-4-scout-17b-16e-instruct` | 128K | $0.10 | 17B (16 experts) | Lightweight deployment, vision tasks |
| **Llama 3.1 8B** | `meta/llama-3.1-8b-instruct` | 128K | $0.02 | 8B | Edge deployment, mobile apps, low-latency |
| **Llama 3.1 70B** | `meta/llama-3.1-70b-instruct` | 128K | $0.35 | 70B | Complex reasoning, code generation |
| **Llama 3.1 405B** | `meta/llama-3.1-405b-instruct` | 128K | $3.00 | 405B | Maximum performance, research, enterprise |
| **Llama Guard 4 12B** | `meta/llama-guard-4-12b` | 128K | $0.05 | 12B | Content moderation, safety filtering |
| **Nemotron Nano 4B** | `meta/llama-3.1-nemotron-nano-4b-v1.1` | 128K | $0.01 | 4B | Edge agents, mobile, embedded systems |
| **Nemotron Nano 8B** | `meta/llama-3.1-nemotron-nano-8b-v1` | 128K | $0.015 | 8B | Desktop agents, on-device AI |

### CodeLlama Family

Specialized models for code generation and understanding:

| Model | ID | Context | Cost (per 1M) | Parameters | Best For |
|-------|-----|---------|---------------|------------|----------|
| **CodeLlama 7B** | `meta/codellama-7b-instruct` | 16K | $0.02 | 7B | Code completion, lightweight coding, edge |
| **CodeLlama 13B** | `meta/codellama-13b-instruct` | 16K | $0.06 | 13B | Code generation, review, bug fixing |
| **CodeLlama 34B** | `meta/codellama-34b-instruct` | 16K | $0.15 | 34B | Complex code gen, algorithm design |
| **CodeLlama 70B** | `meta/codellama-70b-instruct` | 100K | $0.35 | 70B | Enterprise code, large codebase analysis |

**CodeLlama Use Cases:**

- **7B**: Fast autocompletion, simple bug fixes, inline suggestions
- **13B**: Method generation, code review, test writing
- **34B**: Complex refactoring, architecture suggestions, debugging
- **70B**: Full system design, cross-file understanding, enterprise codebases

### Mistral Family

| Model | ID | Context | Cost (per 1M) | Parameters | Best For |
|-------|-----|---------|---------------|------------|----------|
| **Mistral Large 3** | `mistralai/mistral-large-3-675b-instruct-2512` | 256K | $0.60 | 675B | General chat, multimodal, agentic |
| **Mistral Medium 3** | `mistralai/mistral-medium-3-instruct` | 128K | $0.35 | 150B | Enterprise apps, data analysis |
| **Mistral Small 24B** | `mistralai/mistral-small-24b-instruct` | 128K | $0.10 | 24B | Fast responses, coding, multilingual |
| **Ministral 14B** | `mistralai/ministral-14b-instruct-2512` | 128K | $0.08 | 14B | Chatbots, visual QA |
| **Magistral Small** | `mistralai/magistral-small-2506` | 32K | $0.05 | 7B | Edge reasoning, math, mobile |
| **Devstral 2 123B** | `mistralai/devstral-2-123b-instruct-2512` | 256K | $0.80 | 123B | Advanced coding, complex reasoning |
| **Mixtral 8x7B** | `mistralai/mixtral-8x7b-instruct-v0.1` | 32K | $0.15 | 8x7B MoE | General chat, cost-effective |
| **Mixtral 8x22B** | `mistralai/mixtral-8x22b-instruct-v0.1` | 65K | $0.40 | 8x22B MoE | Complex reasoning, long documents |

### Nemotron Family (NVIDIA)

| Model | ID | Context | Cost (per 1M) | Parameters | Best For |
|-------|-----|---------|---------------|------------|----------|
| **Nemotron Ultra 253B** | `nvidia/llama-3.1-nemotron-ultra-253b-v1` | 128K | $0.60 | 253B | Scientific computing, complex reasoning |
| **Nemotron Super 49B** | `nvidia/llama-3.3-nemotron-super-49b-v1.5` | 128K | $0.20 | 49B | Balanced performance, tool calling |
| **Nemotron 49B** | `nvidia/llama-3.3-nemotron-49b-instruct` | 128K | $0.18 | 49B | General tasks, instruction following |
| **Nemotron Nano 9B v2** | `nvidia/nvidia-nemotron-nano-9b-v2` | 128K | $0.015 | 9B | Edge reasoning, mobile |
| **Nemotron 3 Nano 30B** | `nvidia/nemotron-3-nano-30b-a3b` | **1M** | $0.25 | 30B (A3B) | Very long documents, RAG |

### Kimi Family (Moonshot AI)

| Model | ID | Context | Cost (per 1M) | Parameters | Best For |
|-------|-----|---------|---------------|------------|----------|
| **Kimi K2.5** (Default) | `moonshotai/kimi-k2.5` | 256K | $0.60 | 1T (MoE) | Multimodal, video, complex reasoning |
| **Kimi K2 Thinking** | `moonshotai/kimi-k2-thinking` | 256K | $0.60 | 1T (MoE) | Step-by-step reasoning, agents |
| **Kimi K2 Instruct** | `moonshotai/kimi-k2-instruct` | 256K | $0.60 | 1T (MoE) | Coding, complex reasoning |
| **Kimi K2 Instruct (0905)** | `moonshotai/kimi-k2-instruct-0905` | **512K** | $0.70 | 1T (MoE) | Very long documents, advanced reasoning |

### DeepSeek Models

| Model | ID | Context | Cost (per 1M) | Parameters | Best For |
|-------|-----|---------|---------------|------------|----------|
| **DeepSeek V3.2** | `deepseek-ai/deepseek-v3.2` | 128K | $0.45 | 685B | Advanced reasoning, agentic tools |
| **DeepSeek V3.1** | `deepseek-ai/deepseek-v3.1` | 128K | $0.40 | 685B | General chat, tool use |
| **DeepSeek V3.1 Terminus** | `deepseek-ai/deepseek-v3.1-terminus` | 128K | $0.45 | 685B | Complex agents, structured reasoning |
| **DeepSeek R1 Distill 8B** | `deepseek-ai/deepseek-r1-distill-llama-8b` | 128K | $0.02 | 8B | Edge reasoning, lightweight tasks |

### Qwen Models

| Model | ID | Context | Cost (per 1M) | Parameters | Best For |
|-------|-----|---------|---------------|------------|----------|
| **Qwen3 Coder 480B** | `qwen/qwen3-coder-480b-a35b-instruct` | 256K | $0.80 | 480B (35B active) | Agentic coding, browser automation |
| **Qwen3 235B** | `qwen/qwen3-235b-a22b` | 128K | $0.50 | 235B (22B active) | Multilingual reasoning |
| **Qwen3 Next 80B** | `qwen/qwen3-next-80b-a3b-instruct` | 128K | $0.25 | 80B (3B active) | Ultra-long context AI |
| **Qwen3 Next 80B Thinking** | `qwen/qwen3-next-80b-a3b-thinking` | 128K | $0.30 | 80B (3B active) | Multilingual reasoning (119 languages) |
| **QWQ 32B** | `qwen/qwq-32b` | 32K | $0.10 | 32B | Mathematical reasoning |
| **Qwen2.5 Coder 32B** | `qwen/qwen2.5-coder-32b-instruct` | 128K | $0.15 | 32B | Code generation and fixing |

### Vision & Multimodal Models

| Model | ID | Context | Cost (per 1M) | Best For |
|-------|-----|---------|---------------|----------|
| **Nemotron Nano 12B VL** | `nvidia/nemotron-nano-12b-v2-vl` | 128K | $0.10 | Video understanding, multi-image |
| **Nemotron Nano VL 8B** | `nvidia/llama-3.1-nemotron-nano-vl-8b-v1` | 128K | $0.08 | Document intelligence, OCR |
| **Gemma 3N E2B** | `google/gemma-3n-e2b-it` | 128K | $0.08 | Edge multimodal |
| **Gemma 3N E4B** | `google/gemma-3n-e4b-it` | 128K | $0.12 | Rich multimodal apps |
| **Cosmos Reason1 7B** | `nvidia/cosmos-reason1-7b` | 8K | $0.10 | Robotics, physical AI |
| **Cosmos Reason2 8B** | `nvidia/cosmos-reason2-8b` | 8K | $0.12 | Video reasoning, autonomous vehicles |

### Embedding Models

| Model | ID | Dimensions | Cost (per 1M) | Best For |
|-------|-----|------------|---------------|----------|
| **NV-Embed v1** | `nvidia/nv-embed-v1` | 512 | $0.01 | General embeddings, semantic search |
| **NV-EmbedQA E5 v5** | `nvidia/nv-embedqa-e5-v5` | 512 | $0.01 | QA retrieval |
| **NeMo Retriever 300M** | `nvidia/llama-3_2-nemoretriever-300m-embed-v1` | 512 | $0.005 | Multilingual RAG (26 languages) |
| **NeMo Retriever 300M v2** | `nvidia/llama-3_2-nemoretriever-300m-embed-v2` | 512 | $0.005 | Improved multilingual |
| **NeMo Retriever VLM 1B** | `nvidia/llama-3_2-nemoretriever-1b-vlm-embed-v1` | 512 | $0.015 | Visual document retrieval |
| **NV-EmbedQA 1B v2** | `nvidia/llama-3.2-nv-embedqa-1b-v2` | 512 | $0.02 | Long context QA |

### Reranking Models

| Model | ID | Cost (per 1M) | Best For |
|-------|-----|---------------|----------|
| **NV-RerankQA 1B v2** | `nvidia/llama-3.2-nv-rerankqa-1b-v2` | $0.02 | Result reranking, QA optimization |
| **NeMo Rerank 500M v2** | `nvidia/llama-3.2-nemoretriever-500m-rerank-v2` | $0.01 | Passage ranking, RAG improvement |

### Safety & Security Models

| Model | ID | Context | Cost (per 1M) | Best For |
|-------|-----|---------|---------------|----------|
| **Llama Guard 4 12B** | `meta/llama-guard-4-12b` | 128K | $0.05 | Content moderation, multimodal safety |
| **Nemotron Safety Guard 8B** | `nvidia/llama-3.1-nemotron-safety-guard-8b-v3` | 128K | $0.05 | Multilingual content safety |
| **Content Safety Reasoning 4B** | `nvidia/nemotron-content-safety-reasoning-4b` | 32K | $0.03 | Policy enforcement, context-aware |
| **NeMo Guard Jailbreak** | `nvidia/nemoguard-jailbreak-detect` | 8K | $0.02 | Jailbreak detection, prompt injection |

### Document Intelligence Models

| Model | ID | Cost (per 1M) | Best For |
|-------|-----|---------------|----------|
| **NeMo Retriever OCR** | `nvidia/nemoretriever-ocr-v1` | $0.05 | Document OCR, text extraction |
| **Page Elements v3** | `nvidia/nemoretriever-page-elements-v3` | $0.05 | Chart/table detection |
| **Nemotron Parse** | `nvidia/nemotron-parse` | $0.10 | Document parsing, metadata extraction |
| **NV-YOLOX Page Elements** | `nvidia/nv-yolox-page-elements-v1` | $0.04 | Layout parsing |
| **PaddleOCR** | `baidu/paddleocr` | $0.03 | Table extraction, Chinese OCR |

### Speech Models

| Model | ID | Languages | Best For |
|-------|-----|-----------|----------|
| **Parakeet TDT 0.6B** | `nvidia/parakeet-tdt-0.6b-v2` | English | Accurate transcription with timestamps |
| **Parakeet CTC 0.6B** | `nvidia/parakeet-ctc-0.6b-asr` | English | Streaming ASR |
| **Parakeet CTC 1.1B** | `nvidia/parakeet-ctc-1.1b-asr` | English | High-accuracy batch transcription |
| **Parakeet Mandarin** | `nvidia/parakeet-ctc-0.6b-zh-cn` | Mandarin/English | Bilingual transcription |
| **Parakeet Taiwanese** | `nvidia/parakeet-ctc-0.6b-zh-tw` | Taiwanese/Mandarin/English | Regional Chinese |
| **Parakeet Spanish** | `nvidia/parakeet-ctc-0.6b-es` | Spanish/English | Hispanic markets |
| **Parakeet Vietnamese** | `nvidia/parakeet-ctc-0.6b-vi` | Vietnamese/English | Southeast Asia |
| **Magpie TTS Flow** | `nvidia/magpie-tts-flow` | English | Voice cloning, expressive TTS |
| **Magpie TTS Multilingual** | `nvidia/magpie-tts-multilingual` | 8 languages | Global TTS applications |
| **Riva Translate 1.6B** | `nvidia/riva-translate-1.6b` | 36 languages | Multilingual translation |

### Specialized & Regional Models

| Model | ID | Context | Best For |
|-------|-----|---------|----------|
| **IBM Granite 3.3 8B** | `ibm/granite-3.3-8b-instruct` | 128K | Enterprise coding, IBM ecosystem |
| **GLM-4.7** | `z-ai/glm4.7` | 128K | Multilingual coding, UI development |
| **ChatGLM3 6B** | `thudm/chatglm3-6b` | 32K | Chinese language tasks |
| **Sarvam M** | `sarvamai/sarvam-m` | 128K | Indian languages (10+ languages) |
| **Stockmark 2 100B** | `stockmark/stockmark-2-100b-instruct` | 128K | Japanese enterprise |
| **Bielik 11B** | `speakleash/bielik-11b-v2.6-instruct` | 32K | Polish language |
| **Teuken 7B** | `opengpt-x/teuken-7b-instruct-commercial-v0.4` | 32K | All 24 EU languages |
| **EuroLLM 9B** | `utter-project/eurollm-9b-instruct` | 32K | EU sovereign AI |
| **SahabatAI 9B** | `gotocompany/gemma-2-9b-cpt-sahabatai-instruct` | 32K | Indonesian + dialects |

### Creative & 3D Models

| Model | ID | Best For |
|-------|-----|----------|
| **Stable Diffusion 3.5 Large** | `stabilityai/stable-diffusion-3.5-large` | Text-to-image generation |
| **FLUX.1 Kontext Dev** | `black-forest-labs/flux_1-kontext-dev` | In-context image editing |
| **TRELLIS** | `microsoft/trellis` | 3D asset generation |
| **Cosmos Transfer1 7B** | `nvidia/cosmos-transfer1-7b` | Physics-aware video generation |

### Autonomous Vehicle Models

| Model | ID | Best For |
|-------|-----|----------|
| **StreamPETR** | `nvidia/streampetr` | 3D object detection with temporal |
| **SparseDrive** | `nvidia/sparsedrive` | End-to-end autonomous driving |
| **BEVFormer** | `nvidia/bevformer` | Bird's-eye-view 3D perception |

### Life Sciences Models

| Model | ID | Best For |
|-------|-----|----------|
| **GenMol** | `nvidia/genmol-generate` | Molecular generation by diffusion |
| **MolMIM** | `nvidia/molmim-generate` | Controlled molecule generation |
| **DiffDock** | `mit/diffdock` | Protein-molecule docking |
| **Boltz-2** | `mit/boltz2` | Biomolecular structure prediction |
| **OpenFold3** | `openfold/openfold3` | Protein folding, drug discovery |
| **ProteinMPNN** | `ipd/proteinmpnn` | Protein sequence design |
| **MSA Search** | `colabfold/msa-search` | Sequence alignment |

### Audio/Visual & Digital Twins

| Model | ID | Best For |
|-------|-----|----------|
| **Audio2Face 3D** | `nvidia/audio2face-3d` | Realtime lipsyncing, digital humans |
| **Background Noise Removal** | `nvidia/background-noise-removal` | Speech enhancement |
| **USD Code** | `nvidia/usdcode` | OpenUSD development, digital twins |

## Model Capabilities

### Capability Matrix

| Capability | Kimi K2.5 | Llama 3.1 405B | Mistral Large | Nemotron Ultra | Qwen3 Coder |
|------------|-----------|----------------|---------------|----------------|-------------|
| Code Generation | ***** | ***** | ***** | ***** | ***** |
| Architecture Design | ***** | **** | **** | ***** | **** |
| Long Context | ***** (256K) | *** (128K) | ***** (256K) | *** (128K) | ***** (256K) |
| Vision | ***** | ** | ***** | *** | *** |
| Multimodal | ***** | ** | ***** | *** | *** |
| Reasoning | ***** | ***** | **** | ***** | ***** |
| Tool Calling | ***** | ***** | ***** | ***** | ***** |
| Speed | ***** | *** | **** | **** | **** |
| Cost Efficiency | ***** | ** | **** | **** | *** |

### Context Windows

| Model | Context | Approximate Pages |
|-------|---------|-------------------|
| Kimi K2 Instruct 0905 | 512,000 | ~760 pages |
| Kimi K2.5 / Mistral Large | 256,000 | ~380 pages |
| Most Llama/Mistral | 128,000 | ~190 pages |
| **Nemotron 3 Nano 30B** | **1,000,000** | ~1,500 pages |
| CodeLlama 70B | 100,000 | ~150 pages |
| Mixtral 8x22B | 65,000 | ~97 pages |
| Mixtral 8x7B | 32,000 | ~48 pages |
| CodeLlama 7B-34B | 16,000 | ~24 pages |

## Using Different Models

### Via CLI

```bash
# Use specific model for a command
grump ship "Build an app" --model-id moonshotai/kimi-k2.5

# Use CodeLlama for code generation
grump code "Implement a binary search tree" --model-id meta/codellama-70b-instruct

# Use Llama 3.1 405B for complex reasoning
grump chat "Explain quantum computing" --model-id meta/llama-3.1-405b-instruct

# Use Mixtral for cost-effective tasks
grump chat "Quick question" --model-id mistralai/mixtral-8x7b-instruct-v0.1

# Use model presets
grump ship "Complex architecture" --model-preset quality
grump chat "Quick question" --model-preset fast
```

**Model Presets:**
- `fast`: Llama 3.1 8B or Mistral Small (speed priority)
- `quality`: Kimi K2.5 or Nemotron Ultra (quality priority)
- `balanced`: Automatic routing (default)
- `code`: CodeLlama 70B (code-focused)
- `reasoning`: DeepSeek V3.2 (reasoning-focused)

### Via API

```bash
curl https://api.grump.dev/api/chat/stream \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "provider": "nim",
    "modelId": "moonshotai/kimi-k2.5"
  }'
```

### Via Configuration

```bash
# Set default model
grump config set defaultModel moonshotai/kimi-k2.5

# Set default provider
grump config set defaultProvider nim

# Prefer NIM routing
grump config set preferNim true
```

## NVIDIA NIM Setup

### Cloud NIM (Default)

No setup required! G-Rump automatically uses NVIDIA's cloud NIM service:

```
Endpoint: https://integrate.api.nvidia.com/v1
```

### Self-Hosted NIM

For enterprise customers with specific security or latency requirements:

**Requirements:**
- NVIDIA GPU (A100, H100, or L40S recommended)
- Docker 20.10+
- 50GB+ storage per model
- 32GB+ RAM

**Deployment:**

```bash
# Pull NIM container
docker pull nvcr.io/nim/moonshotai/kimi-k2.5:latest

# Run NIM
docker run -d \
  --name nim-kimi \
  --gpus all \
  -p 8000:8000 \
  -e NIM_API_KEY=$NVIDIA_API_KEY \
  nvcr.io/nim/moonshotai/kimi-k2.5:latest

# Configure G-Rump to use local NIM
export NVIDIA_NIM_URL=http://localhost:8000
grump config set apiUrl http://localhost:8000
```

**Docker Compose:**

```yaml
version: '3.8'
services:
  nim:
    image: nvcr.io/nim/moonshotai/kimi-k2.5:latest
    ports:
      - "8000:8000"
    environment:
      - NIM_API_KEY=${NVIDIA_API_KEY}
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

## Model Routing

### Automatic Routing

G-Rump's intelligent router automatically selects the best model:

```javascript
// Router logic example
function routeRequest(request) {
  if (request.requiresVision) {
    return 'moonshotai/kimi-k2.5'; // Multimodal
  }
  
  if (request.contextSize > 500000) {
    return 'nvidia/nemotron-3-nano-30b-a3b'; // 1M context
  }
  
  if (request.contextSize > 200000) {
    return 'moonshotai/kimi-k2-instruct-0905'; // 512K context
  }
  
  if (request.taskType === 'code') {
    return 'meta/codellama-70b-instruct'; // Specialized code
  }
  
  if (request.maxLatencyMs < 500) {
    return 'meta/llama-3.1-8b-instruct'; // Fastest
  }
  
  // Default: Cost-optimized Kimi via NIM
  return 'moonshotai/kimi-k2.5';
}
```

### Custom Routing Rules

Configure routing preferences:

```json
// .grumprc.json
{
  "routing": {
    "preferNim": true,
    "fallbackEnabled": true,
    "maxLatencyMs": 2000,
    "costOptimization": true,
    "rules": [
      {
        "condition": "context > 256000",
        "model": "nvidia/nemotron-3-nano-30b-a3b"
      },
      {
        "condition": "task == 'code'",
        "model": "meta/codellama-70b-instruct"
      },
      {
        "condition": "language == 'zh'",
        "model": "thudm/chatglm3-6b"
      }
    ]
  }
}
```

## Cost Comparison

### Per 1M Tokens

| Model | Input Cost | Output Cost | Total |
|-------|------------|-------------|-------|
| Llama 3.1 8B | $0.02 | $0.02 | $0.04 |
| CodeLlama 7B | $0.02 | $0.02 | $0.04 |
| Nemotron Nano 8B | $0.015 | $0.015 | $0.03 |
| Mistral Small 24B | $0.10 | $0.10 | $0.20 |
| Mixtral 8x7B | $0.15 | $0.15 | $0.30 |
| Qwen2.5 Coder 32B | $0.15 | $0.15 | $0.30 |
| CodeLlama 34B | $0.15 | $0.15 | $0.30 |
| Llama 3.1 70B | $0.35 | $0.35 | $0.70 |
| CodeLlama 70B | $0.35 | $0.35 | $0.70 |
| Mixtral 8x22B | $0.40 | $0.40 | $0.80 |
| DeepSeek V3.1 | $0.40 | $0.40 | $0.80 |
| DeepSeek V3.2 | $0.45 | $0.45 | $0.90 |
| Kimi K2.5 | $0.60 | $0.60 | $1.20 |
| Nemotron Ultra | $0.60 | $0.60 | $1.20 |
| Mistral Large | $0.60 | $0.60 | $1.20 |
| Qwen3 Coder 480B | $0.80 | $0.80 | $1.60 |
| Llama 3.1 405B | $3.00 | $3.00 | $6.00 |

**G-Rump Credit Equivalents:**

| Operation | Credits | Kimi K2.5 | Llama 8B | CodeLlama 70B |
|-----------|---------|----------|----------|---------------|
| Simple chat (1K tokens) | 1 | $0.0012 | $0.00004 | $0.0007 |
| Code review (5K tokens) | 2 | $0.006 | $0.0002 | $0.0035 |
| SHIP design (50K tokens) | 5 | $0.06 | $0.002 | $0.035 |
| Full project (500K tokens) | 30 | $0.60 | $0.02 | $0.35 |

## Performance Benchmarks

### Latency (Time to First Token)

| Model | Avg Latency | P95 Latency |
|-------|-------------|-------------|
| Llama 3.1 8B (NIM) | 50ms | 100ms |
| Nemotron Nano 8B | 60ms | 120ms |
| CodeLlama 7B | 55ms | 110ms |
| Mistral Small 24B | 100ms | 200ms |
| Kimi K2.5 (NIM) | 150ms | 300ms |
| CodeLlama 70B | 200ms | 400ms |
| Llama 3.1 405B | 500ms | 1s |

### Throughput (Tokens/Second)

| Model | Avg Speed | Max Speed |
|-------|-----------|-----------|
| Llama 3.1 8B (NIM) | 200 t/s | 250 t/s |
| CodeLlama 7B | 180 t/s | 220 t/s |
| Kimi K2.5 (NIM) | 120 t/s | 150 t/s |
| CodeLlama 70B | 80 t/s | 100 t/s |
| Llama 3.1 405B | 40 t/s | 60 t/s |

## Best Practices

### Model Selection Guidelines

**Use Kimi K2.5 (Default) for:**
- General development tasks
- Multimodal tasks (vision + text)
- Architecture design
- Most use cases (80%+)

**Use CodeLlama models for:**
- Pure code generation
- Code review and refactoring
- Test generation
- Documentation from code

**Use Llama 3.1 405B for:**
- Complex reasoning tasks
- Research and analysis
- Enterprise-grade accuracy

**Use Llama 3.1 8B for:**
- Quick responses
- Edge deployment
- High-volume, low-complexity tasks

**Use Nemotron 3 Nano 30B for:**
- Analyzing massive documents (1M tokens)
- RAG with very large context
- Multi-document processing

**Use DeepSeek V3.2 for:**
- Complex reasoning chains
- Agentic workflows
- Tool-intensive tasks

### Optimization Tips

1. **Enable NIM Routing**
   ```bash
   grump config set preferNim true
   ```

2. **Use Context Efficiently**
   - Don't include unnecessary files
   - Use specific file paths instead of entire directories
   - Leverage workspace context

3. **Match Model to Task**
   ```bash
   # For code tasks
   grump code "implement feature" --model-id meta/codellama-70b-instruct
   
   # For quick questions
   grump chat "quick question" --model-id meta/llama-3.1-8b-instruct
   
   # For complex reasoning
   grump chat "complex analysis" --model-id deepseek-ai/deepseek-v3.2
   ```

4. **Enable Response Caching**
   ```bash
   grump config set cacheEnabled true
   grump config set cacheTtl 3600
   ```

## Troubleshooting

### Model Not Available

**Problem:** "Model not available" or "Provider error"

**Solutions:**

```bash
# Check model availability
grump chat "test" --provider nim --verbose

# Switch to fallback
grump config set fallbackEnabled true

# Use alternative model
grump chat "test" --model-id meta/llama-3.1-70b-instruct
```

### High Latency

**Problem:** Slow response times

**Solutions:**

```bash
# Force NIM routing
grump chat "question" --prefer-nim

# Use faster model
grump chat "question" --model-id meta/llama-3.1-8b-instruct

# Check network
ping integrate.api.nvidia.com
```

### Context Window Errors

**Problem:** "Context too long" errors

**Solutions:**

```bash
# Use 1M context model
grump ship "description" --model-id nvidia/nemotron-3-nano-30b-a3b

# Or use 512K context model
grump ship "description" --model-id moonshotai/kimi-k2-instruct-0905

# Or reduce context
grump ship "description" --workspace ./src/specific-folder
```

## Support

For model-specific questions:
- General: support@grump.dev
- NVIDIA NIM: nim-support@nvidia.com
- Enterprise: enterprise@grump.dev

## Next Steps

- [API Reference](/guide/api-reference) - Use models via API
- [CLI Reference](/guide/cli-reference) - Model selection commands
- [Credits & Pricing](/guide/credits-pricing) - Cost optimization
