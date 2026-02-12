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
  together: '/icons/providers/together.svg',
  zhipu: '/icons/providers/zhipu.svg',
  grump: '/icons/providers/grump.svg',
  nim: '/icons/providers/nvidia.svg',
  google: '/icons/providers/google.svg',
  gemini: '/icons/providers/google.svg',
  github_copilot: '/icons/providers/github.svg',
  openclaw: '/icons/providers/openclaw.svg',
};

/** Inline SVG path data for providers without file icons (24x24 viewBox) */
const INLINE_SVG_PATHS: Record<string, string> = {
  openai:
    'M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.182a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.998-2.9 6.056 6.056 0 0 0-.748-7.073z',
  cohere:
    'M12 2a10 10 0 100 20 10 10 0 000-20zm3 14H9c-1.5 0-2.7-1.3-2.7-2.8 0-1 .6-2 1.5-2.5L12 8.5l4.2 2.2c.9.5 1.5 1.4 1.5 2.5 0 1.6-1.2 2.8-2.7 2.8z',
  fireworks: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  replicate: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'azure-openai': 'M12 2L3 7v10l9 5 9-5V7l-9-5zM12 22V12M3 7l9 5 9-5',
  'demo-mode':
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  google:
    'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z',
  github_copilot:
    'M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21.5c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z',
  openclaw:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z',
};

/** CSS color for each provider used in inline SVG rendering */
const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
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
  together: '#0ea5e9',
  grump: '#7c3aed',
  google: '#4285f4',
  gemini: '#4285f4',
  github_copilot: '#24292f',
  openclaw: '#ef4444',
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
    'nvidia-nim': 'N',
    openrouter: 'O',
    anthropic: 'A',
    openai: 'O',
    ollama: 'O',
    cohere: 'C',
    fireworks: 'F',
    replicate: 'R',
    anyscale: 'Y',
    gemini: 'G',
    google: 'G',
    github_copilot: 'C',
    openclaw: 'O',
    'azure-openai': 'Z',
    'demo-mode': 'D',
    together: 'T',
  };
  return letters[providerId] ?? providerId.charAt(0).toUpperCase();
}
