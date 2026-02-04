/**
 * Shared validation and platform limits.
 * Centralizes magic numbers that were duplicated across route handlers.
 */

/** Maximum length for user-provided text requests (plan, spec, etc.) */
export const MAX_USER_REQUEST_LENGTH = 16_000;

/** Maximum audio upload size in bytes (10 MB) */
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

/** Maximum text length for TTS synthesis */
export const TTS_MAX_CHARS = 2_000;

/** Platform-specific message length limits */
export const PLATFORM_MESSAGE_LIMITS = {
  telegram: 4096,
  discord: 2000,
  twilio: 1600,
} as const;
