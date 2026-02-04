/**
 * AI provider icons for Connect AI Provider screen.
 * SVG paths from Simple Icons (simpleicons.org) where available; otherwise fallback letter.
 */

const ICON_PATHS: Record<string, string> = {
  openai:
    'M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.182a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.998-2.9 6.056 6.056 0 0 0-.748-7.073zM9.284 21.41a4.476 4.476 0 0 1-2.876-1.04l.142-.08 4.778-2.758a.795.795 0 0 0 .393-.68v-6.737l2.02 1.168a.07.07 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.495 4.494zm-9.66-4.125a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.758a.77.77 0 0 0 .78 0l5.843-3.368v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.499 4.499 0 0 1-6.141-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.814 3.354-2.02 1.168a.076.076 0 0 1-.071 0L2.34 12.447a4.504 4.504 0 0 1 0-4.55zm16.596 3.856l-6.033-3.387 2.02-1.164a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.677 8.104v-5.677a.79.79 0 0 0-.407-.667zm2.01-3.023l-.142-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.41 9.23V6.897a.066.066 0 0 1 .028-.062l4.83-2.787a4.499 4.499 0 0 1 6.68 4.66zM8.306 12.863l-2.02-1.164a.08.08 0 0 1-.038-.057V6.074a4.499 4.499 0 0 1 7.376-3.454l-.142.081-4.778 2.758a.795.795 0 0 0-.393.68v6.733z',
  nvidia:
    'M8.5 2.5v19l7-4.5v-10L8.5 2.5zM4 6v12l4.5-3V9L4 6zm17-1.5L15.5 9v6L21 19.5V4.5zM15.5 9L12 6.5v9l3.5 2.5V9z',
  mistral:
    'M15.243 5.4h-6.486c-.995 0-1.8.805-1.8 1.8v9.6c0 .995.805 1.8 1.8 1.8h6.486c.995 0 1.8-.805 1.8-1.8V7.2c0-.995-.805-1.8-1.8-1.8zM12 15.6c-.995 0-1.8-.805-1.8-1.8s.805-1.8 1.8-1.8 1.8.805 1.8 1.8-.805 1.8-1.8 1.8zm1.8-6h-3.6V8.4h3.6v1.2z',
};

export function getProviderIconPath(providerId: string): string | null {
  const key = providerId === 'nvidia-nim' ? 'nvidia' : providerId;
  return ICON_PATHS[key] ?? null;
}

export function getProviderFallbackLetter(providerId: string): string {
  const letters: Record<string, string> = {
    kimi: 'K',
    'nvidia-nim': 'N',
    openrouter: 'O',
    anthropic: 'A',
    openai: 'O',
    mistral: 'M',
    groq: 'G',
    ollama: 'O',
    cohere: 'C',
    fireworks: 'F',
    replicate: 'R',
    anyscale: 'Y',
    gemini: 'G',
    'azure-openai': 'Z',
  };
  return letters[providerId] ?? providerId.charAt(0).toUpperCase();
}
