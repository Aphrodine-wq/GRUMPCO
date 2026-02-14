/**
 * Kimi vision service – design-to-code: screenshot/image + description → generated code (Svelte/React/Vue/Flutter).
 * Uses NIM with Kimi K2.5 (multimodal).
 */

import logger from '../../middleware/logger.js';
import { getNimChatUrl } from '../../config/nim.js';
const NIM_MODEL = 'moonshotai/kimi-k2.5';

export type DesignToCodeFramework =
  | 'svelte'
  | 'react'
  | 'vue'
  | 'flutter'
  | 'angular'
  | 'nextjs'
  | 'nuxt'
  | 'solid'
  | 'qwik';

export interface DesignToCodeInput {
  /** Image as base64 string (no data URL prefix) or Buffer. */
  image?: string | Buffer;
  /** Optional Figma or image URL (if no image buffer). */
  figmaUrl?: string;
  /** Description of what to build or requirements. */
  description: string;
  targetFramework: DesignToCodeFramework;
  /** Styling: tailwind, css-modules, vanilla-css, sass, styled-components, emotion, unocss, panda-css, shadcn-ui. */
  styling?: string;
  /** Theme: light, dark, system. */
  theme?: string;
  /** Output language: ts, js, python, go, rust. */
  outputLang?: string;
  /** Vue only: composition, options. */
  componentStyle?: string;
  /** Layout structure preset, e.g. header-hero-2col-footer. */
  layoutPreset?: string;
}

export interface DesignToCodeResult {
  code: string;
  explanation?: string;
}

function getApiKey(): string | null {
  return process.env.NVIDIA_NIM_API_KEY ?? null;
}

/**
 * Call NIM chat completions with image + text (non-streaming).
 */
export async function designToCode(input: DesignToCodeInput): Promise<DesignToCodeResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NVIDIA_NIM_API_KEY is not set');

  const imageUrl =
    input.figmaUrl ??
    (input.image == null
      ? null
      : typeof input.image === 'string'
        ? input.image.startsWith('data:')
          ? input.image
          : `data:image/png;base64,${input.image}`
        : `data:image/png;base64,${(input.image as Buffer).toString('base64')}`);
  if (!imageUrl) throw new Error('Either image or figmaUrl is required');

  const stylingHint = input.styling ? ` Use ${input.styling} for styling.` : '';
  const themeHint = input.theme && input.theme !== 'system' ? ` Prefer ${input.theme} theme.` : '';
  const langHint =
    input.outputLang === 'js'
      ? ' Output JavaScript (no TypeScript).'
      : input.outputLang === 'python'
        ? ' Output Python.'
        : input.outputLang === 'go'
          ? ' Output Go.'
          : input.outputLang === 'rust'
            ? ' Output Rust.'
            : ' Output TypeScript where applicable.';
  const vueHint =
    input.targetFramework === 'vue' && input.componentStyle
      ? ` Use Vue ${input.componentStyle} API.`
      : '';
  const layoutHint = input.layoutPreset ? ` Use layout structure: ${input.layoutPreset}.` : '';

  const systemPrompt = `You are an expert front-end developer. Convert the provided design (screenshot or image) into production-ready, accessible, responsive code.
Output ONLY the code in a single markdown code block (e.g. \`\`\`svelte or \`\`\`tsx). No extra explanation before or after unless the user asked for it.
Framework: ${input.targetFramework}. Follow best practices for that framework.${stylingHint}${themeHint}${langHint}${vueHint}${layoutHint}`;

  const userContent = [
    { type: 'image_url' as const, image_url: { url: imageUrl } },
    {
      type: 'text' as const,
      text: `Requirements: ${input.description}\n\nGenerate ${input.targetFramework} code for this design.`,
    },
  ];

  const res = await fetch(getNimChatUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: NIM_MODEL,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const t = await res.text();
    logger.warn({ status: res.status, body: t.slice(0, 500) }, 'Vision design-to-code error');
    throw new Error(`Vision API: ${res.status} ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
  const codeMatch = raw.match(/```(?:[\w]*)\n?([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : raw;
  const explanation =
    codeMatch && raw.slice(0, raw.indexOf('```')).trim()
      ? raw.slice(0, raw.indexOf('```')).trim()
      : undefined;
  return { code, explanation };
}
