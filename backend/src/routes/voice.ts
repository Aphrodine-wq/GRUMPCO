/**
 * Voice API: POST /api/voice/transcribe, POST /api/voice/synthesize, POST /api/voice/code.
 * ASR and TTS via NVIDIA Build; voice code orchestrates ASR → intent + RAG → chat → TTS.
 */

import { Router, type Request, type Response } from 'express';
import { transcribe, synthesize } from '../services/platform/voiceService.js';
import { ragQuery } from '../services/rag/ragService.js';
import { claudeServiceWithTools } from '../services/ai-providers/claudeServiceWithTools.js';
import type { ChatStreamEvent } from '../services/ai-providers/claudeServiceWithTools.js';
import { route } from '../services/ai-providers/modelRouter.js';
import { type LLMProvider } from '../services/ai-providers/llmGateway.js';
import logger from '../middleware/logger.js';

const router = Router();
const TTS_MAX_CHARS = 2000;

/**
 * POST /api/voice/transcribe
 * Body: { audio: base64 string, language?: string }
 * Returns: { text: string }
 */
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    const body = req.body as { audio?: string; language?: string };
    if (!body?.audio || typeof body.audio !== 'string') {
      return res.status(400).json({ error: 'Body must be { audio: base64 string }' });
    }
    const audio = Buffer.from(body.audio, 'base64');
    if (audio.length === 0) {
      return res.status(400).json({ error: 'No audio data provided' });
    }
    const result = await transcribe(audio, body.language ? { language: body.language } : undefined);
    return res.json(result);
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'Voice transcribe error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/voice/synthesize
 * Body: { text: string, voice?: string, persona?: 'grump' | 'neutral' }
 * Returns: audio binary (Content-Type: audio/wav) or { audio: base64 }
 */
router.post('/synthesize', async (req: Request, res: Response) => {
  try {
    const { text, voice, base64, persona } = req.body as {
      text?: string;
      voice?: string;
      base64?: boolean;
      persona?: 'grump' | 'neutral';
    };
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Body must include non-empty "text" string' });
    }
    const result = await synthesize(text.trim(), {
      voice,
      persona: persona === 'grump' ? 'grump' : 'neutral',
    });
    if (base64) {
      return res.json({ audio: result.audio.toString('base64') });
    }
    res.setHeader('Content-Type', 'audio/wav');
    return res.send(result.audio);
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'Voice synthesize error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/voice/code
 * Body: { audio: base64 string, workspaceRoot?: string }
 * Orchestrates: ASR → RAG context → chat/code stream → TTS.
 * Returns: { transcript, answer, code?, audioBase64?, sources?, confidence? }
 */
router.post('/code', async (req: Request, res: Response) => {
  try {
    const body = req.body as { audio?: string; workspaceRoot?: string };
    if (!body?.audio || typeof body.audio !== 'string') {
      return res.status(400).json({ error: 'Body must be { audio: base64 string }' });
    }
    const audio = Buffer.from(body.audio, 'base64');
    if (audio.length === 0) {
      return res.status(400).json({ error: 'No audio data provided' });
    }
    const workspaceRoot =
      typeof body.workspaceRoot === 'string' && body.workspaceRoot.trim()
        ? body.workspaceRoot.trim()
        : undefined;

    // 1. Transcribe
    const { text: transcript } = await transcribe(audio);
    if (!transcript.trim()) {
      return res.status(400).json({ error: 'No speech detected in audio' });
    }

    // 2. RAG context (optional; may fail if index not built)
    let ragContext = '';
    let sources: Array<{ source: string; type: string }> = [];
    let confidence: number | undefined;
    try {
      const ragResult = await ragQuery(transcript);
      if (ragResult.answer && !ragResult.answer.includes('has not been indexed')) {
        ragContext = `\n\nContext from docs:\n${ragResult.answer}`;
        sources = ragResult.sources ?? [];
        confidence = ragResult.confidence;
      }
    } catch (ragErr) {
      logger.debug({ error: (ragErr as Error).message }, 'RAG skipped for voice code');
    }

    // 3. Chat/code: single user message, collect full text (use router so voice-code uses Kimi by default)
    const userMessage = transcript + ragContext;
    const routed = route({
      messageChars: userMessage.length,
      messageCount: 1,
      mode: 'normal',
      toolsRequested: true,
    });
    const stream = claudeServiceWithTools.generateChatStream(
      [{ role: 'user', content: userMessage }],
      undefined,
      workspaceRoot,
      'normal',
      undefined,
      undefined,
      undefined,
      routed.provider as LLMProvider,
      routed.modelId
    );
    let fullText = '';
    for await (const event of stream as AsyncGenerator<ChatStreamEvent>) {
      if (event.type === 'text') {
        fullText += event.text;
      }
      if (event.type === 'error') {
        throw new Error((event as { message?: string }).message ?? 'Chat stream error');
      }
      if (event.type === 'done') break;
    }

    // 4. Extract first code block for optional code field
    const codeMatch = fullText.match(/```(?:[\w]*)\n?([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : undefined;

    // 5. TTS (truncate for playback)
    const ttsText =
      fullText.length > TTS_MAX_CHARS ? fullText.slice(0, TTS_MAX_CHARS) + '…' : fullText;
    let audioBase64: string | undefined;
    try {
      const { audio: audioBuf } = await synthesize(ttsText);
      audioBase64 = audioBuf.toString('base64');
    } catch (ttsErr) {
      logger.warn({ error: (ttsErr as Error).message }, 'TTS skipped for voice code response');
    }

    return res.json({
      transcript,
      answer: fullText,
      ...(code !== undefined && { code }),
      ...(audioBase64 !== undefined && { audioBase64 }),
      sources,
      ...(confidence !== undefined && { confidence }),
    });
  } catch (e) {
    logger.warn({ error: (e as Error).message }, 'Voice code error');
    return res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
