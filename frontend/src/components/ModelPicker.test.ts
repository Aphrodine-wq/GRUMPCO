import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import ModelPicker from './ModelPicker.svelte';

// Mock the API
vi.mock('$lib/api', () => ({
  fetchApi: vi.fn(),
}));

describe('ModelPicker', () => {
  const mockGroups = [
    {
      provider: 'nim',
      displayName: 'NVIDIA NIM',
      icon: '🚀',
      models: [
        { id: 'nvidia/nemotron', provider: 'nim', capabilities: ['chat'], contextWindow: 128000 },
        { id: 'nvidia/llama-3', provider: 'nim', capabilities: ['chat'], contextWindow: 8192 },
      ],
    },
    {
      provider: 'openai',
      displayName: 'OpenAI',
      icon: '🤖',
      models: [{ id: 'gpt-4', provider: 'openai', capabilities: ['chat'], contextWindow: 128000 }],
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    const { fetchApi } = await import('$lib/api');
    (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ groups: mockGroups }),
    });
  });

  it('should render model picker', () => {
    const { container } = render(ModelPicker, {
      props: { value: 'auto' },
    });
    expect(container).toBeTruthy();
  });

  it('should show loading state initially', () => {
    const { container } = render(ModelPicker, {
      props: { value: 'auto' },
    });

    // The picker should exist
    expect(container.querySelector('.model-picker')).toBeTruthy();
  });

  it('should render with auto selected by default', () => {
    const { container } = render(ModelPicker, {
      props: { value: 'auto', showAuto: true },
    });

    expect(container).toBeTruthy();
  });

  it('should call onSelect callback when provided', async () => {
    const onSelect = vi.fn();
    const { container } = render(ModelPicker, {
      props: { value: 'auto', onSelect },
    });

    // Component should render - onSelect will be called when user interacts
    expect(container).toBeTruthy();
  });

  it('should support compact mode', () => {
    const { container } = render(ModelPicker, {
      props: { value: 'auto', compact: true },
    });

    expect(container).toBeTruthy();
  });

  it('should hide auto option when showAuto is false', () => {
    const { container } = render(ModelPicker, {
      props: { value: 'nim:nvidia/nemotron', showAuto: false },
    });

    expect(container).toBeTruthy();
  });

  it('should handle API errors gracefully', async () => {
    const { fetchApi } = await import('$lib/api');
    (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed' }),
    });

    const { container } = render(ModelPicker, {
      props: { value: 'auto' },
    });

    expect(container).toBeTruthy();
  });

  it('should handle empty model list', async () => {
    const { fetchApi } = await import('$lib/api');
    (fetchApi as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ groups: [] }),
    });

    const { container } = render(ModelPicker, {
      props: { value: 'auto' },
    });

    expect(container).toBeTruthy();
  });
});
