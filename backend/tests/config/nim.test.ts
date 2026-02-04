import { describe, it, expect, afterEach } from 'vitest';
import { getNimApiBase, getNimChatUrl, getNimEmbedUrl } from '../../src/config/nim.js';

describe('nim config', () => {
  const orig = process.env.NVIDIA_NIM_URL;

  afterEach(() => {
    if (orig !== undefined) process.env.NVIDIA_NIM_URL = orig;
    else delete process.env.NVIDIA_NIM_URL;
  });

  it('getNimApiBase returns cloud base when NVIDIA_NIM_URL unset', () => {
    delete process.env.NVIDIA_NIM_URL;
    expect(getNimApiBase()).toBe('https://integrate.api.nvidia.com/v1');
  });

  it('getNimApiBase returns custom base when NVIDIA_NIM_URL set', () => {
    process.env.NVIDIA_NIM_URL = 'http://nim:8000';
    expect(getNimApiBase()).toBe('http://nim:8000/v1');
  });

  it('getNimApiBase appends /v1 when custom URL has no trailing slash', () => {
    process.env.NVIDIA_NIM_URL = 'http://localhost:8000';
    expect(getNimApiBase()).toBe('http://localhost:8000/v1');
  });

  it('getNimApiBase keeps /v1 when already present', () => {
    process.env.NVIDIA_NIM_URL = 'http://nim:8000/v1';
    expect(getNimApiBase()).toBe('http://nim:8000/v1');
  });

  it('getNimEmbedUrl returns embeddings path', () => {
    process.env.NVIDIA_NIM_URL = 'http://nim/v1';
    expect(getNimEmbedUrl()).toBe('http://nim/v1/embeddings');
  });

  it('getNimChatUrl returns chat completions path', () => {
    process.env.NVIDIA_NIM_URL = 'http://nim/v1';
    expect(getNimChatUrl()).toBe('http://nim/v1/chat/completions');
  });
});
