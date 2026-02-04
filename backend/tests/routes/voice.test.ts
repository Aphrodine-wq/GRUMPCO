/**
 * Voice Route Tests
 * Voice routes have been removed - these tests verify they are no longer accessible.
 */

import { describe, it, expect } from 'vitest';

// Note: Voice routes were removed from the system as they are not in use.
// The AI Enhancement Router (src/routes/index.ts) no longer includes voice routes.

vi.mock('../../src/services/voiceService.js', () => ({
  transcribe: (...args: unknown[]) => mockTranscribe(...args),
  synthesize: (...args: unknown[]) => mockSynthesize(...args),
}));

vi.mock('../../src/services/ttsProviderService.js', () => ({
  synthesizeWithProvider: (...args: unknown[]) => mockSynthesizeWithProvider(...args),
  getAvailableProviders: () => mockGetAvailableProviders(),
}));

vi.mock('../../src/services/ragService.js', () => ({
  ragQuery: (...args: unknown[]) => mockRagQuery(...args),
}));

vi.mock('../../src/services/claudeServiceWithTools.js', () => ({
  claudeServiceWithTools: {
    generateChatStream: (...args: unknown[]) => mockGenerateChatStream(...args),
  },
}));

vi.mock('../../src/services/modelRouter.js', () => ({
  route: (...args: unknown[]) => mockRoute(...args),
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../src/config/limits.js', () => ({
  TTS_MAX_CHARS: 5000,
  MAX_AUDIO_SIZE: 10 * 1024 * 1024, // 10MB
}));

vi.mock('../../src/utils/errorResponse.js', () => ({
  getErrorMessage: (err: unknown) => (err as Error)?.message ?? String(err),
  sendErrorResponse: (res: { status: (code: number) => { json: (body: unknown) => void } }, code: string, message: string, options?: { field?: string }) => {
    const statusMap: Record<string, number> = {
      validation_error: 400,
      payload_too_large: 413,
      not_found: 404,
      unauthorized: 401,
    };
    res.status(statusMap[code] || 500).json({ error: message, code, field: options?.field });
  },
  sendServerError: (res: { status: (code: number) => { json: (body: unknown) => void } }, err: unknown) => {
    res.status(500).json({ error: (err as Error)?.message ?? String(err), type: 'internal_error' });
  },
  ErrorCode: {
    VALIDATION_ERROR: 'validation_error',
    PAYLOAD_TOO_LARGE: 'payload_too_large',
    NOT_FOUND: 'not_found',
    UNAUTHORIZED: 'unauthorized',
    INTERNAL_ERROR: 'internal_error',
  },
}));

// Import router AFTER mocks are set up (skip suite if route removed)
let voiceRouter: typeof import('../../src/routes/voice.js') | undefined;
let voiceRouteAvailable = true;
try {
  const mod = await import('../../src/routes/voice.js');
  voiceRouter = mod.default;
} catch {
  voiceRouteAvailable = false;
}

// Constants for tests
const TTS_MAX_CHARS = 5000;
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

// Mock stream generator helper
function createMockStream(events: Array<{ type: string; text?: string; message?: string }>) {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/voice', voiceRouter);
  return app;
}

const describeVoice = voiceRouteAvailable ? describe : describe.skip;

describeVoice('Voice Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
    mockRoute.mockReturnValue({ provider: 'nvidia', modelId: 'kimi-k2' });
    mockGetAvailableProviders.mockReturnValue(['nvidia', 'elevenlabs', 'edge']);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/voice/providers', () => {
    it('should return available TTS providers', async () => {
      mockGetAvailableProviders.mockReturnValueOnce(['nvidia', 'elevenlabs']);

      const response = await request(app).get('/api/voice/providers');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ providers: ['nvidia', 'elevenlabs'] });
    });
  });

  describe('POST /api/voice/transcribe', () => {
    describe('Validation', () => {
      it('should return 400 when audio is missing', async () => {
        const response = await request(app).post('/api/voice/transcribe').send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when audio is not a string', async () => {
        const response = await request(app).post('/api/voice/transcribe').send({ audio: 12345 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when audio is null', async () => {
        const response = await request(app).post('/api/voice/transcribe').send({ audio: null });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when body is null', async () => {
        const response = await request(app)
          .post('/api/voice/transcribe')
          .set('Content-Type', 'application/json')
          .send('null');

        // Express JSON parser may reject null body, or route handles it
        expect(response.status).toBe(400);
      });

      it('should return 400 when audio decodes to empty buffer', async () => {
        // '====' is a non-empty base64 string that decodes to empty buffer
        const emptyAudio = '====';
        const response = await request(app).post('/api/voice/transcribe').send({ audio: emptyAudio });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('No audio data provided');
      });

      it('should return 413 when audio exceeds max size', async () => {
        // Create a base64 string that decodes to > 10MB
        const largeAudio = Buffer.alloc(11 * 1024 * 1024).toString('base64');

        const response = await request(app).post('/api/voice/transcribe').send({ audio: largeAudio });

        expect(response.status).toBe(413);
        expect(response.body.error).toBe('Audio data exceeds maximum size of 10MB');
      });
    });

    describe('Successful transcription', () => {
      it('should transcribe audio successfully', async () => {
        const audioData = Buffer.from('fake-audio-data').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello world' });

        const response = await request(app).post('/api/voice/transcribe').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ text: 'Hello world' });
        expect(mockTranscribe).toHaveBeenCalledWith(expect.any(Buffer), undefined);
      });

      it('should pass language option when provided', async () => {
        const audioData = Buffer.from('fake-audio-data').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Bonjour le monde' });

        const response = await request(app)
          .post('/api/voice/transcribe')
          .send({ audio: audioData, language: 'fr' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ text: 'Bonjour le monde' });
        expect(mockTranscribe).toHaveBeenCalledWith(expect.any(Buffer), { language: 'fr' });
      });

      it('should not pass language option when not provided', async () => {
        const audioData = Buffer.from('fake-audio-data').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Test' });

        await request(app).post('/api/voice/transcribe').send({ audio: audioData });

        expect(mockTranscribe).toHaveBeenCalledWith(expect.any(Buffer), undefined);
      });

      it('should decode base64 audio correctly', async () => {
        const originalData = 'This is audio content for testing';
        const audioData = Buffer.from(originalData).toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Transcribed text' });

        await request(app).post('/api/voice/transcribe').send({ audio: audioData });

        const calledWith = mockTranscribe.mock.calls[0][0] as Buffer;
        expect(calledWith.toString()).toBe(originalData);
      });
    });

    describe('Error handling', () => {
      it('should return 500 on transcription service error', async () => {
        const audioData = Buffer.from('fake-audio-data').toString('base64');
        mockTranscribe.mockRejectedValueOnce(new Error('ASR service unavailable'));

        const response = await request(app).post('/api/voice/transcribe').send({ audio: audioData });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('ASR service unavailable');
      });

      it('should return 500 with non-Error rejection', async () => {
        const audioData = Buffer.from('fake-audio-data').toString('base64');
        mockTranscribe.mockRejectedValueOnce('String error');

        const response = await request(app).post('/api/voice/transcribe').send({ audio: audioData });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('String error');
      });
    });
  });

  describe('POST /api/voice/synthesize', () => {
    describe('Validation', () => {
      it('should return 400 when text is missing', async () => {
        const response = await request(app).post('/api/voice/synthesize').send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when text is empty string', async () => {
        const response = await request(app).post('/api/voice/synthesize').send({ text: '' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when text is whitespace only', async () => {
        const response = await request(app).post('/api/voice/synthesize').send({ text: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when text is not a string', async () => {
        const response = await request(app).post('/api/voice/synthesize').send({ text: 12345 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when text is null', async () => {
        const response = await request(app).post('/api/voice/synthesize').send({ text: null });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when text is an array', async () => {
        const response = await request(app).post('/api/voice/synthesize').send({ text: ['hello'] });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 413 when text exceeds max length', async () => {
        const longText = 'a'.repeat(TTS_MAX_CHARS + 1);

        const response = await request(app).post('/api/voice/synthesize').send({ text: longText });

        expect(response.status).toBe(413);
        expect(response.body.error).toContain('exceeds maximum length');
        expect(response.body.error).toContain(`${TTS_MAX_CHARS}`);
      });

      it('should accept text at exactly max length', async () => {
        const exactLengthText = 'a'.repeat(TTS_MAX_CHARS);
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        const response = await request(app)
          .post('/api/voice/synthesize')
          .send({ text: exactLengthText, base64: true });

        expect(response.status).toBe(200);
      });
    });

    describe('Successful synthesis - binary response', () => {
      it('should synthesize and return binary audio by default', async () => {
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        const response = await request(app).post('/api/voice/synthesize').send({ text: 'Hello world' });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('audio/wav');
        expect(Buffer.compare(response.body, audioBuffer)).toBe(0);
        expect(mockSynthesizeWithProvider).toHaveBeenCalledWith('Hello world', {
          voice: undefined,
          persona: 'neutral',
          provider: undefined,
        });
      });

      it('should return binary audio when base64 is false', async () => {
        const audioBuffer = Buffer.from('binary-audio-content');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        const response = await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello', base64: false });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('audio/wav');
      });
    });

    describe('Successful synthesis - base64 response', () => {
      it('should return base64 audio when base64=true', async () => {
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        const response = await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello world', base64: true });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ audio: audioBuffer.toString('base64') });
        expect(response.body.provider).toBe('nvidia');
      });
    });

    describe('Voice and persona options', () => {
      it('should pass voice option when provided', async () => {
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'elevenlabs' });

        await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello', voice: 'alloy', base64: true });

        expect(mockSynthesizeWithProvider).toHaveBeenCalledWith('Hello', {
          voice: 'alloy',
          persona: 'neutral',
          provider: undefined,
        });
      });

      it('should pass grump persona when specified', async () => {
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello', persona: 'grump', base64: true });

        expect(mockSynthesizeWithProvider).toHaveBeenCalledWith('Hello', {
          voice: undefined,
          persona: 'grump',
          provider: undefined,
        });
      });

      it('should pass neutral persona when explicitly specified', async () => {
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello', persona: 'neutral', base64: true });

        expect(mockSynthesizeWithProvider).toHaveBeenCalledWith('Hello', {
          voice: undefined,
          persona: 'neutral',
          provider: undefined,
        });
      });

      it('should reject invalid persona values', async () => {
        const response = await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello', persona: 'unknown', base64: true });

        // Zod rejects invalid enum values
        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should default to neutral persona when not specified', async () => {
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello', base64: true });

        expect(mockSynthesizeWithProvider).toHaveBeenCalledWith('Hello', {
          voice: undefined,
          persona: 'neutral',
          provider: undefined,
        });
      });

      it('should pass both voice and persona options', async () => {
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello', voice: 'echo', persona: 'grump', base64: true });

        expect(mockSynthesizeWithProvider).toHaveBeenCalledWith('Hello', {
          voice: 'echo',
          persona: 'grump',
          provider: undefined,
        });
      });
    });

    describe('Text trimming', () => {
      it('should trim text before synthesis', async () => {
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        await request(app)
          .post('/api/voice/synthesize')
          .send({ text: '  Hello world  ', base64: true });

        expect(mockSynthesizeWithProvider).toHaveBeenCalledWith('Hello world', expect.any(Object));
      });

      it('should trim leading whitespace', async () => {
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        await request(app)
          .post('/api/voice/synthesize')
          .send({ text: '\n\t  Hello', base64: true });

        expect(mockSynthesizeWithProvider).toHaveBeenCalledWith('Hello', expect.any(Object));
      });

      it('should trim trailing whitespace', async () => {
        const audioBuffer = Buffer.from('fake-wav-data');
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: audioBuffer, provider: 'nvidia' });

        await request(app)
          .post('/api/voice/synthesize')
          .send({ text: 'Hello  \n\t', base64: true });

        expect(mockSynthesizeWithProvider).toHaveBeenCalledWith('Hello', expect.any(Object));
      });
    });

    describe('Error handling', () => {
      it('should return 500 on synthesis service error', async () => {
        mockSynthesizeWithProvider.mockRejectedValueOnce(new Error('TTS service unavailable'));

        const response = await request(app).post('/api/voice/synthesize').send({ text: 'Hello' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('TTS service unavailable');
      });

      it('should return 500 with API key error', async () => {
        mockSynthesizeWithProvider.mockRejectedValueOnce(new Error('NVIDIA_NIM_API_KEY is not set'));

        const response = await request(app).post('/api/voice/synthesize').send({ text: 'Hello' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('NVIDIA_NIM_API_KEY is not set');
      });
    });
  });

  describe('POST /api/voice/code', () => {
    describe('Validation', () => {
      it('should return 400 when audio is missing', async () => {
        const response = await request(app).post('/api/voice/code').send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when audio is not a string', async () => {
        const response = await request(app).post('/api/voice/code').send({ audio: 12345 });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when audio is null', async () => {
        const response = await request(app).post('/api/voice/code').send({ audio: null });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 when body is null', async () => {
        const response = await request(app)
          .post('/api/voice/code')
          .set('Content-Type', 'application/json')
          .send('null');

        // Express JSON parser may reject null body, or route handles it
        expect(response.status).toBe(400);
      });

      it('should return 400 when audio decodes to empty buffer', async () => {
        // '====' is a non-empty base64 string that decodes to empty buffer
        const emptyAudio = '====';
        const response = await request(app).post('/api/voice/code').send({ audio: emptyAudio });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('No audio data provided');
      });

      it('should return 413 when audio exceeds max size', async () => {
        const largeAudio = Buffer.alloc(11 * 1024 * 1024).toString('base64');

        const response = await request(app).post('/api/voice/code').send({ audio: largeAudio });

        expect(response.status).toBe(413);
        expect(response.body.error).toBe('Audio data exceeds maximum size of 10MB');
      });

      it('should return 400 when no speech detected', async () => {
        const audioData = Buffer.from('silence').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: '   ' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('No speech detected in audio');
      });

      it('should return 400 when transcript is empty string', async () => {
        const audioData = Buffer.from('silence').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: '' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('No speech detected in audio');
      });
    });

    describe('Full pipeline - successful flow', () => {
      it('should complete voice code pipeline successfully', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Write a hello world function' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([
            { type: 'text', text: 'Here is a function:\n```javascript\nfunction hello() { return "Hello"; }\n```' },
            { type: 'done' },
          ])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts-audio'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.transcript).toBe('Write a hello world function');
        expect(response.body.answer).toContain('Here is a function');
        expect(response.body.code).toBe('function hello() { return "Hello"; }');
        expect(response.body.audioBase64).toBeDefined();
        expect(response.body.sources).toEqual([]);
      });

      it('should extract code from code block with language specifier', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Write code' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([
            { type: 'text', text: '```typescript\nconst x: number = 5;\n```' },
            { type: 'done' },
          ])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.code).toBe('const x: number = 5;');
      });

      it('should extract code from code block without language specifier', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Write code' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([
            { type: 'text', text: '```\nplain code block\n```' },
            { type: 'done' },
          ])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.code).toBe('plain code block');
      });

      it('should not include code field when no code block present', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'What is 2+2?' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'The answer is 4' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body).not.toHaveProperty('code');
        expect(response.body.answer).toBe('The answer is 4');
      });

      it('should extract only the first code block when multiple present', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Write code' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([
            { type: 'text', text: '```js\nfirst\n```\nSome text\n```js\nsecond\n```' },
            { type: 'done' },
          ])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.code).toBe('first');
      });
    });

    describe('RAG integration', () => {
      it('should include RAG context when available', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'How do I use the API?' });
        mockRagQuery.mockResolvedValueOnce({
          answer: 'The API uses REST endpoints...',
          sources: [{ source: 'api.md', type: 'markdown' }],
          confidence: 0.85,
        });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Based on the docs, you use REST' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.sources).toEqual([{ source: 'api.md', type: 'markdown' }]);
        expect(response.body.confidence).toBe(0.85);
      });

      it('should skip RAG context when index not built', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({
          answer: 'The workspace has not been indexed',
          sources: [],
        });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Hi there!' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe('Hi there!');
        expect(response.body.sources).toEqual([]);
        expect(response.body).not.toHaveProperty('confidence');
      });

      it('should skip RAG context when answer is null', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({
          answer: null,
          sources: [],
        });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Response' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.sources).toEqual([]);
      });

      it('should handle RAG query failure gracefully', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockRejectedValueOnce(new Error('RAG unavailable'));
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Response' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe('Response');
        expect(response.body.sources).toEqual([]);
      });

      it('should not include confidence when not provided by RAG', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Question' });
        mockRagQuery.mockResolvedValueOnce({
          answer: 'Some context',
          sources: [{ source: 'doc.md', type: 'markdown' }],
          // confidence not included
        });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Answer' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body).not.toHaveProperty('confidence');
      });

      it('should default to empty sources array when RAG sources is undefined', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Question' });
        mockRagQuery.mockResolvedValueOnce({
          answer: 'Some context without sources',
          // sources is undefined - tests the ?? [] fallback
        });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Answer' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.sources).toEqual([]);
      });
    });

    describe('Workspace root handling', () => {
      it('should pass workspaceRoot when provided', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Done' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app)
          .post('/api/voice/code')
          .send({ audio: audioData, workspaceRoot: '/path/to/workspace' });

        expect(mockGenerateChatStream).toHaveBeenCalledWith(
          expect.any(Array),
          undefined,
          '/path/to/workspace',
          'normal',
          undefined,
          undefined,
          undefined,
          'nvidia',
          'kimi-k2'
        );
      });

      it('should handle undefined workspaceRoot', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Done' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(mockGenerateChatStream).toHaveBeenCalledWith(
          expect.any(Array),
          undefined,
          undefined,
          'normal',
          undefined,
          undefined,
          undefined,
          'nvidia',
          'kimi-k2'
        );
      });

      it('should treat empty string workspaceRoot as undefined', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Done' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app)
          .post('/api/voice/code')
          .send({ audio: audioData, workspaceRoot: '' });

        expect(mockGenerateChatStream).toHaveBeenCalledWith(
          expect.any(Array),
          undefined,
          undefined,
          expect.any(String),
          undefined,
          undefined,
          undefined,
          expect.any(String),
          expect.any(String)
        );
      });

      it('should treat whitespace-only workspaceRoot as undefined', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Done' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app)
          .post('/api/voice/code')
          .send({ audio: audioData, workspaceRoot: '   ' });

        expect(mockGenerateChatStream).toHaveBeenCalledWith(
          expect.any(Array),
          undefined,
          undefined,
          expect.any(String),
          undefined,
          undefined,
          undefined,
          expect.any(String),
          expect.any(String)
        );
      });

      it('should trim workspaceRoot', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Done' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app)
          .post('/api/voice/code')
          .send({ audio: audioData, workspaceRoot: '  /path/to/workspace  ' });

        expect(mockGenerateChatStream).toHaveBeenCalledWith(
          expect.any(Array),
          undefined,
          '/path/to/workspace',
          'normal',
          undefined,
          undefined,
          undefined,
          'nvidia',
          'kimi-k2'
        );
      });
    });

    describe('Model routing', () => {
      it('should use model router for provider selection', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Test' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockRoute.mockReturnValueOnce({ provider: 'openrouter', modelId: 'gpt-4' });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Response' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(mockRoute).toHaveBeenCalledWith(
          expect.objectContaining({
            mode: 'normal',
            toolsRequested: true,
            messageCount: 1,
          })
        );
        expect(mockGenerateChatStream).toHaveBeenCalledWith(
          expect.any(Array),
          undefined,
          undefined,
          'normal',
          undefined,
          undefined,
          undefined,
          'openrouter',
          'gpt-4'
        );
      });

      it('should pass message character count to router', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        const transcript = 'This is a longer message for testing';
        mockTranscribe.mockResolvedValueOnce({ text: transcript });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Response' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(mockRoute).toHaveBeenCalledWith(
          expect.objectContaining({
            messageChars: transcript.length,
          })
        );
      });

      it('should include RAG context in message character count', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        const transcript = 'Question';
        const ragAnswer = 'Context from documentation';
        mockTranscribe.mockResolvedValueOnce({ text: transcript });
        mockRagQuery.mockResolvedValueOnce({
          answer: ragAnswer,
          sources: [],
        });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Response' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app).post('/api/voice/code').send({ audio: audioData });

        // Message includes transcript + RAG context formatting
        const expectedMinLength = transcript.length + ragAnswer.length;
        expect(mockRoute).toHaveBeenCalledWith(
          expect.objectContaining({
            messageChars: expect.any(Number),
          })
        );
        const actualChars = (mockRoute.mock.calls[0][0] as { messageChars: number }).messageChars;
        expect(actualChars).toBeGreaterThanOrEqual(expectedMinLength);
      });
    });

    describe('TTS handling', () => {
      it('should handle TTS failure gracefully', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Response' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockRejectedValueOnce(new Error('TTS failed'));

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body).not.toHaveProperty('audioBase64');
        expect(response.body.answer).toBe('Response');
      });

      it('should truncate long responses for TTS', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        const longResponse = 'a'.repeat(6000);
        mockTranscribe.mockResolvedValueOnce({ text: 'Generate long text' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: longResponse }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(mockSynthesizeWithProvider).toHaveBeenCalled();
        const ttsArg = mockSynthesizeWithProvider.mock.calls[0][0] as string;
        expect(ttsArg.length).toBeLessThanOrEqual(TTS_MAX_CHARS + 1); // 5000 + ellipsis character
        expect(ttsArg.endsWith('…')).toBe(true);
      });

      it('should not truncate response at or below TTS limit', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        const exactLengthResponse = 'a'.repeat(TTS_MAX_CHARS);
        mockTranscribe.mockResolvedValueOnce({ text: 'Test' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: exactLengthResponse }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app).post('/api/voice/code').send({ audio: audioData });

        const ttsArg = mockSynthesizeWithProvider.mock.calls[0][0] as string;
        expect(ttsArg).toBe(exactLengthResponse);
        expect(ttsArg.endsWith('…')).toBe(false);
      });
    });

    describe('Chat stream handling', () => {
      it('should handle chat stream error event', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'error', message: 'Stream failed' }])
        );

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Stream failed');
      });

      it('should handle chat stream error event without message', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'error' }])
        );

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Chat stream error');
      });

      it('should accumulate text from multiple stream events', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([
            { type: 'text', text: 'Part 1 ' },
            { type: 'text', text: 'Part 2 ' },
            { type: 'text', text: 'Part 3' },
            { type: 'done' },
          ])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe('Part 1 Part 2 Part 3');
      });

      it('should stop processing on done event', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([
            { type: 'text', text: 'First' },
            { type: 'done' },
            { type: 'text', text: 'Should not appear' },
          ])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe('First');
      });
    });

    describe('Error handling', () => {
      it('should handle transcription error', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockRejectedValueOnce(new Error('ASR failed'));

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('ASR failed');
      });

      it('should handle chat stream generator error', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        mockTranscribe.mockResolvedValueOnce({ text: 'Hello' });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });

        // Mock a generator that throws
        mockGenerateChatStream.mockReturnValueOnce(
          (async function* () {
            throw new Error('Generator error');
          })()
        );

        const response = await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Generator error');
      });
    });

    describe('Message construction', () => {
      it('should pass user message to chat stream', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        const transcript = 'Write some code';
        mockTranscribe.mockResolvedValueOnce({ text: transcript });
        mockRagQuery.mockResolvedValueOnce({ answer: null, sources: [] });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Code here' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(mockGenerateChatStream).toHaveBeenCalledWith(
          [{ role: 'user', content: transcript }],
          undefined,
          undefined,
          'normal',
          undefined,
          undefined,
          undefined,
          'nvidia',
          'kimi-k2'
        );
      });

      it('should append RAG context to user message', async () => {
        const audioData = Buffer.from('audio').toString('base64');
        const transcript = 'How does this work?';
        const ragAnswer = 'Documentation says...';
        mockTranscribe.mockResolvedValueOnce({ text: transcript });
        mockRagQuery.mockResolvedValueOnce({
          answer: ragAnswer,
          sources: [{ source: 'doc.md', type: 'markdown' }],
        });
        mockGenerateChatStream.mockReturnValueOnce(
          createMockStream([{ type: 'text', text: 'Response' }, { type: 'done' }])
        );
        mockSynthesizeWithProvider.mockResolvedValueOnce({ audio: Buffer.from('tts'), provider: 'nvidia' });

        await request(app).post('/api/voice/code').send({ audio: audioData });

        expect(mockGenerateChatStream).toHaveBeenCalledWith(
          [{ role: 'user', content: expect.stringContaining(transcript) }],
          undefined,
          undefined,
          'normal',
          undefined,
          undefined,
          undefined,
          'nvidia',
          'kimi-k2'
        );
        const userContent = (mockGenerateChatStream.mock.calls[0][0] as Array<{ content: string }>)[0].content;
        expect(userContent).toContain('Context from docs:');
        expect(userContent).toContain(ragAnswer);
      });
    });
  });
});
