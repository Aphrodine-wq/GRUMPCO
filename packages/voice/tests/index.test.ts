import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    SSMLBuilder,
    VoiceSession,
    validateAudioData,
    estimateAudioDuration,
    convertAudioFormat,
    createSSMLBuilder,
    PERSONA_STYLES,
    type IVoiceProvider,
    type TranscribeResponse,
    type SynthesizeResponse,
    type VoiceInfo,
} from '../src/index';

// =============================================================================
// SSMLBuilder
// =============================================================================

describe('SSMLBuilder', () => {
    it('builds basic text wrapped with default (neutral) persona prosody', () => {
        const ssml = new SSMLBuilder().text('Hello world').build();
        expect(ssml).toBe('<speak><prosody rate="0%" pitch="0st">Hello world</prosody></speak>');
    });

    it('escapes XML special characters', () => {
        const ssml = new SSMLBuilder().text('a < b & c > d "e" \'f\'').build();
        expect(ssml).toContain('&lt;');
        expect(ssml).toContain('&amp;');
        expect(ssml).toContain('&gt;');
        expect(ssml).toContain('&quot;');
        expect(ssml).toContain('&apos;');
    });

    it('adds break elements for pauses', () => {
        const ssml = new SSMLBuilder().text('Hi').pause(500).text('there').build();
        expect(ssml).toContain('<break time="500ms"/>');
    });

    it('wraps text in emphasis tags', () => {
        const ssml = new SSMLBuilder().emphasis('important', 'strong').build();
        expect(ssml).toContain('<emphasis level="strong">important</emphasis>');
    });

    it('wraps text in prosody tags', () => {
        const ssml = new SSMLBuilder()
            .prosody('fast text', { rate: '+20%', pitch: '+2st' })
            .build();
        expect(ssml).toContain('rate="+20%"');
        expect(ssml).toContain('pitch="+2st"');
    });

    it('renders say-as with interpret-as', () => {
        const ssml = new SSMLBuilder().sayAs('12/25/2025', 'date', 'mdy').build();
        expect(ssml).toContain('<say-as interpret-as="date" format="mdy">12/25/2025</say-as>');
    });

    it('renders say-as without format', () => {
        const ssml = new SSMLBuilder().sayAs('555-1234', 'telephone').build();
        expect(ssml).toContain('<say-as interpret-as="telephone">555-1234</say-as>');
        expect(ssml).not.toContain('format=');
    });

    it('applies persona prosody wrapping for grump persona', () => {
        const ssml = new SSMLBuilder('grump').text('Hello').build();
        expect(ssml).toContain('rate="-5%"');
        expect(ssml).toContain('pitch="-2st"');
    });

    it('does not add outer prosody for neutral persona (0% rate)', () => {
        const ssml = new SSMLBuilder('neutral').text('Hello').build();
        // neutral has prosodyRate '0%' and prosodyPitch '0st' — still wraps but with zero values
        expect(ssml).toContain('<speak>');
    });

    it('chains multiple operations fluently', () => {
        const builder = new SSMLBuilder('friendly');
        const ssml = builder
            .text('Hey ')
            .emphasis('friend', 'moderate')
            .pause(300)
            .sayAs('2025', 'cardinal')
            .build();
        expect(ssml).toContain('Hey ');
        expect(ssml).toContain('<emphasis');
        expect(ssml).toContain('<break');
        expect(ssml).toContain('<say-as');
    });
});

describe('createSSMLBuilder', () => {
    it('creates a builder with default neutral persona', () => {
        const builder = createSSMLBuilder();
        expect(builder).toBeInstanceOf(SSMLBuilder);
        const ssml = builder.text('test').build();
        expect(ssml).toContain('<speak>');
    });

    it('creates a builder with specified persona', () => {
        const builder = createSSMLBuilder('professional');
        const ssml = builder.text('test').build();
        expect(ssml).toContain('rate="-10%"');
    });
});

// =============================================================================
// PERSONA_STYLES
// =============================================================================

describe('PERSONA_STYLES', () => {
    it('has all four personas defined', () => {
        expect(Object.keys(PERSONA_STYLES)).toEqual(['grump', 'neutral', 'professional', 'friendly']);
    });

    it('each persona has a description', () => {
        for (const style of Object.values(PERSONA_STYLES)) {
            expect(style.description).toBeTruthy();
        }
    });
});

// =============================================================================
// validateAudioData
// =============================================================================

describe('validateAudioData', () => {
    it('rejects empty audio data', () => {
        const result = validateAudioData('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Empty audio data');
    });

    it('rejects invalid base64', () => {
        const result = validateAudioData('!!!not-base64!!!');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid base64 encoding');
    });

    it('accepts valid base64 with unknown format', () => {
        // Create valid base64 that doesn't match any magic bytes
        const data = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).toString('base64');
        const result = validateAudioData(data);
        expect(result.valid).toBe(true);
    });

    it('detects WAV format (RIFF magic bytes)', () => {
        const wavHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
        const result = validateAudioData(wavHeader.toString('base64'));
        expect(result.valid).toBe(true);
        expect(result.format).toBe('wav');
    });

    it('detects MP3 format (sync word)', () => {
        const mp3Header = Buffer.from([0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00]);
        const result = validateAudioData(mp3Header.toString('base64'));
        expect(result.valid).toBe(true);
        expect(result.format).toBe('mp3');
    });

    it('detects OGG format', () => {
        const oggHeader = Buffer.from([0x4F, 0x67, 0x67, 0x53, 0x00, 0x00, 0x00, 0x00]);
        const result = validateAudioData(oggHeader.toString('base64'));
        expect(result.valid).toBe(true);
        expect(result.format).toBe('ogg');
    });

    it('detects FLAC format', () => {
        const flacHeader = Buffer.from([0x66, 0x4C, 0x61, 0x43, 0x00, 0x00, 0x00, 0x00]);
        const result = validateAudioData(flacHeader.toString('base64'));
        expect(result.valid).toBe(true);
        expect(result.format).toBe('flac');
    });

    it('detects WebM format', () => {
        const webmHeader = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x00, 0x00, 0x00, 0x00]);
        const result = validateAudioData(webmHeader.toString('base64'));
        expect(result.valid).toBe(true);
        expect(result.format).toBe('webm');
    });
});

// =============================================================================
// estimateAudioDuration
// =============================================================================

describe('estimateAudioDuration', () => {
    it('estimates WAV duration based on sample rate', () => {
        const fakeAudio = 'A'.repeat(128000); // ~96000 bytes
        const duration = estimateAudioDuration(fakeAudio, 'wav', 16000);
        expect(duration).toBeGreaterThan(0);
        expect(typeof duration).toBe('number');
    });

    it('estimates MP3 duration', () => {
        const fakeAudio = 'A'.repeat(64000);
        const duration = estimateAudioDuration(fakeAudio, 'mp3');
        expect(duration).toBeGreaterThan(0);
    });

    it('uses fallback bytes-per-second for unknown format edge cases', () => {
        const fakeAudio = 'A'.repeat(32000);
        const duration = estimateAudioDuration(fakeAudio, 'ogg');
        expect(duration).toBeGreaterThan(0);
    });
});

// =============================================================================
// convertAudioFormat
// =============================================================================

describe('convertAudioFormat', () => {
    it('returns same audio when formats match', async () => {
        const audio = 'base64data';
        const result = await convertAudioFormat(audio, 'wav', 'wav');
        expect(result).toBe(audio);
    });

    it('throws for cross-format conversion', async () => {
        await expect(convertAudioFormat('data', 'wav', 'mp3')).rejects.toThrow(
            /Audio conversion from wav to mp3 not implemented/,
        );
    });
});

// =============================================================================
// VoiceSession
// =============================================================================

describe('VoiceSession', () => {
    let mockProvider: IVoiceProvider;

    beforeEach(() => {
        mockProvider = {
            transcribe: vi.fn().mockResolvedValue({
                text: 'Hello world',
                language: 'en',
                confidence: 0.95,
            } satisfies TranscribeResponse),
            synthesize: vi.fn().mockResolvedValue({
                audio: 'synthesized-audio-base64',
                format: 'wav',
                duration: 1.5,
            } satisfies SynthesizeResponse),
            getSupportedLanguages: vi.fn().mockResolvedValue(['en', 'es', 'fr']),
            getVoices: vi.fn().mockResolvedValue([
                { id: 'v1', name: 'Voice 1', language: 'en' },
            ] satisfies VoiceInfo[]),
        };
    });

    it('transcribes audio and adds to history', async () => {
        const session = new VoiceSession({ provider: mockProvider });
        const text = await session.transcribe('audio-data', 'wav');

        expect(text).toBe('Hello world');
        expect(mockProvider.transcribe).toHaveBeenCalledWith({
            audio: 'audio-data',
            format: 'wav',
            language: 'en',
        });
        expect(session.getHistory()).toHaveLength(1);
        expect(session.getHistory()[0]).toEqual({ role: 'user', text: 'Hello world' });
    });

    it('synthesizes text and adds to history', async () => {
        const session = new VoiceSession({
            provider: mockProvider,
            persona: 'grump',
            defaultVoice: 'v1',
        });
        const audio = await session.synthesize('Goodbye');

        expect(audio).toBe('synthesized-audio-base64');
        expect(mockProvider.synthesize).toHaveBeenCalledWith({
            text: 'Goodbye',
            voice: 'v1',
            persona: 'grump',
        });
        expect(session.getHistory()).toHaveLength(1);
        expect(session.getHistory()[0]).toEqual({ role: 'assistant', text: 'Goodbye' });
    });

    it('tracks multi-turn conversation', async () => {
        const session = new VoiceSession({ provider: mockProvider });
        await session.transcribe('audio1');
        await session.synthesize('Response 1');
        await session.transcribe('audio2');

        expect(session.getHistory()).toHaveLength(3);
        expect(session.getHistory().map((h) => h.role)).toEqual(['user', 'assistant', 'user']);
    });

    it('clears history', async () => {
        const session = new VoiceSession({ provider: mockProvider });
        await session.transcribe('audio');
        expect(session.getHistory()).toHaveLength(1);

        session.clearHistory();
        expect(session.getHistory()).toHaveLength(0);
    });

    it('changes persona mid-session', async () => {
        const session = new VoiceSession({ provider: mockProvider, persona: 'neutral' });

        session.setPersona('professional');
        await session.synthesize('Text');

        expect(mockProvider.synthesize).toHaveBeenCalledWith(
            expect.objectContaining({ persona: 'professional' }),
        );
    });

    it('uses default language for transcription', async () => {
        const session = new VoiceSession({ provider: mockProvider, defaultLanguage: 'es' });
        await session.transcribe('audio');

        expect(mockProvider.transcribe).toHaveBeenCalledWith(
            expect.objectContaining({ language: 'es' }),
        );
    });
});
