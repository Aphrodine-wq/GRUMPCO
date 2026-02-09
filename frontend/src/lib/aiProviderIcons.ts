/**
 * AI provider icons for model selector and settings.
 * Returns paths to SVG icon files in /icons/providers/ directory.
 * Falls back to inline SVG path data when no file exists.
 */

/** Map provider IDs to /icons/providers/<name>.svg file paths */
const PROVIDER_FILE_ICONS: Record<string, string> = {
  ollama: '/icons/providers/ollama.svg',
  'nvidia-nim': '/icons/providers/nvidia.svg',
  nvidia: '/icons/providers/nvidia.svg',
  openrouter: '/icons/providers/openrouter.svg',
  anthropic: '/icons/providers/anthropic.svg',
  google: '/icons/providers/google.svg',
  gemini: '/icons/providers/google.svg',
  copilot: '/icons/providers/copilot.svg',
  together: '/icons/providers/together.svg',
  zhipu: '/icons/providers/zhipu.svg',
  grump: '/icons/providers/grump.svg',
  jan: '/icons/providers/jan.svg',
  nim: '/icons/providers/nvidia.svg',
  kimi: '/icons/providers/kimi.svg',
  mistral: '/icons/providers/mistral.svg',
};

/** Inline SVG path data for providers without file icons (24x24 viewBox) */
const INLINE_SVG_PATHS: Record<string, string> = {
  openai:
    'M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.182a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.998-2.9 6.056 6.056 0 0 0-.748-7.073z',
  mistral:
    'M3 3h3v3H3V3zm15 0h3v3h-3V3zM3 9h3v3H3V9zm6 0h3v3H9V9zm3 0h3v3h-3V9zm3 0h3v3h-3V9zm3 0h3v3h-3V9zM3 15h3v3H3v-3zm15 0h3v3h-3v-3zM3 21h3v-3H3v3zm6-3h3v3H9v-3zm6 0h3v3h-3v-3zm3 0h3v3h-3v-3z',
  kimi: 'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a7 7 0 110 14 7 7 0 010-14zm0 2a5 5 0 100 10 5 5 0 000-10z',
  cohere:
    'M12 2a10 10 0 100 20 10 10 0 000-20zm3 14H9c-1.5 0-2.7-1.3-2.7-2.8 0-1 .6-2 1.5-2.5L12 8.5l4.2 2.2c.9.5 1.5 1.4 1.5 2.5 0 1.6-1.2 2.8-2.7 2.8z',
  fireworks:
    'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  replicate:
    'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'azure-openai':
    'M12 2L3 7v10l9 5 9-5V7l-9-5zM12 22V12M3 7l9 5 9-5',
  'demo-mode':
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
};

/** CSS color for each provider used in inline SVG rendering */
const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  mistral: '#ff7000',
  kimi: '#6366f1',
  cohere: '#39594d',
  fireworks: '#ff6b35',
  replicate: '#4b5563',
  'azure-openai': '#0078d4',
  'demo-mode': '#7c3aed',
  ollama: '#ffffff',
  'nvidia-nim': '#76b900',
  nvidia: '#76b900',
  nim: '#76b900',
  openrouter: '#6366f1',
  anthropic: '#d97706',
  google: '#4285f4',
  gemini: '#4285f4',
  copilot: '#000000',
  together: '#0ea5e9',
  grump: '#7c3aed',
  jan: '#3b82f6',
};

/**
 * Returns the path to a provider's SVG icon file, or null if only inline data exists.
 * For ModelPicker: use this for <img src=...> when it returns a string starting with '/'.
 * When null, use `getProviderSvgPath()` for inline SVG rendering.
 */
export function getProviderIconPath(providerId: string): string | null {
  const key = providerId === 'nvidia-nim' ? 'nvidia' : providerId;
  return PROVIDER_FILE_ICONS[key] ?? PROVIDER_FILE_ICONS[providerId] ?? null;
}

/**
 * Returns inline SVG path data for a provider (24x24 viewBox).
 * Use when getProviderIconPath returns null.
 */
export function getProviderSvgPath(providerId: string): string | null {
  const key = providerId === 'nvidia-nim' ? 'nvidia' : providerId;
  return INLINE_SVG_PATHS[key] ?? INLINE_SVG_PATHS[providerId] ?? null;
}

/**
 * Returns the accent color for a provider icon.
 */
export function getProviderColor(providerId: string): string {
  return PROVIDER_COLORS[providerId] ?? '#7c3aed';
}

/**
 * Returns a single capital letter fallback for a provider.
 */
export function getProviderFallbackLetter(providerId: string): string {
  const letters: Record<string, string> = {
    kimi: 'K',
    'nvidia-nim': 'N',
    openrouter: 'O',
    anthropic: 'A',
    openai: 'O',
    mistral: 'M',
    ollama: 'O',
    cohere: 'C',
    fireworks: 'F',
    replicate: 'R',
    anyscale: 'Y',
    gemini: 'G',
    'azure-openai': 'Z',
    'demo-mode': 'D',
    together: 'T',
    google: 'G',
  };
  return letters[providerId] ?? providerId.charAt(0).toUpperCase();
}
