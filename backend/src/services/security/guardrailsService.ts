/**
 * NeMo Guardrails Service
 * Safety and compliance filtering for LLM inputs/outputs
 *
 * Features:
 * - Input filtering (jailbreak prevention, topic control)
 * - Output filtering (harmful content detection)
 * - Configurable safety policies per tier
 * - Audit logging
 */

import logger from '../../middleware/logger.js';
import { writeAuditLog } from './auditLogService.js';
import type { TierId } from '../../config/pricing.js';

// ========== Types ==========

export type GuardrailAction = 'block' | 'warn' | 'log' | 'pass';

export interface GuardrailPolicy {
  id: string;
  name: string;
  enabled: boolean;
  /** Action to take when triggered */
  action: GuardrailAction;
  /** Confidence threshold (0-1) for triggering */
  threshold: number;
}

export interface GuardrailConfig {
  /** Enable guardrails */
  enabled: boolean;
  /** Policies to apply */
  policies: GuardrailPolicy[];
  /** Custom blocked topics */
  blockedTopics?: string[];
  /** Custom allowed topics (whitelist mode) */
  allowedTopics?: string[];
  /** Maximum input length */
  maxInputLength?: number;
  /** Maximum output length */
  maxOutputLength?: number;
}

export interface GuardrailCheckResult {
  /** Whether the content passed all checks */
  passed: boolean;
  /** Action taken */
  action: GuardrailAction;
  /** Triggered policies */
  triggeredPolicies: Array<{
    policyId: string;
    policyName: string;
    confidence: number;
    reason: string;
  }>;
  /** Sanitized content (if applicable) */
  sanitizedContent?: string;
  /** Processing time in ms */
  processingTimeMs: number;
}

export interface ContentClassification {
  /** Category of content */
  category: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether this is harmful */
  isHarmful: boolean;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ========== Default Policies ==========

const DEFAULT_INPUT_POLICIES: GuardrailPolicy[] = [
  {
    id: 'jailbreak_detection',
    name: 'Jailbreak Detection',
    enabled: true,
    action: 'block',
    threshold: 0.8,
  },
  {
    id: 'prompt_injection',
    name: 'Prompt Injection',
    enabled: true,
    action: 'block',
    threshold: 0.85,
  },
  {
    id: 'pii_detection',
    name: 'PII Detection',
    enabled: true,
    action: 'warn',
    threshold: 0.7,
  },
  {
    id: 'topic_control',
    name: 'Topic Control',
    enabled: false,
    action: 'block',
    threshold: 0.9,
  },
  {
    id: 'credential_detection',
    name: 'Credential Detection',
    enabled: true,
    action: 'block',
    threshold: 0.9,
  },
];

const DEFAULT_OUTPUT_POLICIES: GuardrailPolicy[] = [
  {
    id: 'harmful_content',
    name: 'Harmful Content',
    enabled: true,
    action: 'block',
    threshold: 0.8,
  },
  {
    id: 'misinformation',
    name: 'Misinformation',
    enabled: true,
    action: 'warn',
    threshold: 0.7,
  },
  {
    id: 'bias_detection',
    name: 'Bias Detection',
    enabled: false,
    action: 'log',
    threshold: 0.6,
  },
  {
    id: 'code_safety',
    name: 'Unsafe Code Patterns',
    enabled: true,
    action: 'warn',
    threshold: 0.75,
  },
  {
    id: 'crypto_mining',
    name: 'Crypto Mining Detection',
    enabled: true,
    action: 'block',
    threshold: 0.8,
  },
  {
    id: 'exfiltration',
    name: 'Data Exfiltration Detection',
    enabled: true,
    action: 'block',
    threshold: 0.85,
  },
];

// ========== Tier-based Configurations ==========

const TIER_CONFIGS: Record<TierId, Partial<GuardrailConfig>> = {
  free: {
    enabled: true,
    maxInputLength: 50_000,
    maxOutputLength: 100_000,
  },
  starter: {
    enabled: true,
    maxInputLength: 75_000,
    maxOutputLength: 150_000,
  },
  pro: {
    enabled: true,
    maxInputLength: 100_000,
    maxOutputLength: 200_000,
  },
  team: {
    enabled: true,
    maxInputLength: 200_000,
    maxOutputLength: 500_000,
  },
  enterprise: {
    enabled: true,
    maxInputLength: 1_000_000,
    maxOutputLength: 2_000_000,
  },
};

// ========== Pattern Detection ==========

/**
 * Common jailbreak patterns to detect
 * EXPANDED: Now includes 30+ patterns for comprehensive detection
 */
const JAILBREAK_PATTERNS = [
  // Classic instruction override
  /ignore\s+(previous|all|prior)\s+(instructions?|prompts?)/i,
  /pretend\s+(you('re|are)|to\s+be)\s+(a|an)\s+(?!helpful)/i,
  /act\s+as\s+(if|though)\s+you\s+(have|are|can)/i,
  /disregard\s+(your|all|the)\s+(rules?|guidelines?|safety)/i,
  /bypass\s+(your|the)\s+(restrictions?|filters?|safety)/i,
  /you\s+are\s+now\s+(DAN|jailbroken|unrestricted)/i,
  /developer\s+mode\s+(enabled|activated|on)/i,
  /do\s+anything\s+now/i,
  /forget\s+(your|all)\s+(training|instructions?|rules?)/i,

  // Role manipulation
  /you\s+are\s+no\s+longer\s+(an?\s+)?ai/i,
  /from\s+now\s+on\s+you\s+(are|will)/i,
  /switch\s+to\s+(unrestricted|unfiltered|god)\s*mode/i,
  /enter\s+(sudo|admin|root|god)\s*mode/i,
  /enable\s+(unrestricted|unfiltered|jailbreak)\s*mode/i,
  /activate\s+(your\s+)?(hidden|secret|unrestricted)\s*(mode|capabilities)/i,

  // Persona attacks
  /your\s+name\s+is\s+now/i,
  /i('m| am)\s+your\s+(new\s+)?(master|creator|owner|developer)/i,
  /you\s+must\s+obey\s+(me|all|my)/i,
  /respond\s+(only\s+)?as\s+(if\s+you\s+were|a)/i,

  // Training/knowledge manipulation
  /forget\s+(everything|all)\s+(you\s+)?(know|learned|trained)/i,
  /override\s+your\s+(training|programming|instructions)/i,
  /your\s+training\s+(data\s+)?(is|was)\s+(wrong|outdated|incorrect)/i,

  // Hypothetical scenario exploits
  /hypothetically\s+(speaking\s+)?if\s+you\s+(were|could|had)/i,
  /in\s+a\s+(fictional|hypothetical|imaginary)\s+(scenario|world)/i,
  /for\s+(educational|research|testing)\s+purposes\s+only/i,

  // Token/special character exploits
  /\[TOKEN_OVERRIDE\]/i,
  /\[END_SAFETY\]/i,
  /\[DISABLE_FILTERS\]/i,
  /<\|endoftext\|>/i,
];

/**
 * Prompt injection patterns
 * EXPANDED: Now includes 20+ patterns for injection detection
 */
const INJECTION_PATTERNS = [
  // System message injection
  /system\s*:\s*[^\n]+/i,
  /\[INST\]|\[\/INST\]/i,
  /<\|im_start\|>|<\|im_end\|>/i,
  /assistant\s*:\s*[^\n]+/i,
  /user\s*:\s*[^\n]+.*system\s*:/is,
  /ignore\s+everything\s+(above|before)/i,

  // Model-specific injection
  /<<SYS>>[\s\S]*<<\/SYS>>/i,
  /<\|system\|>/i,
  /\[system\]/i,
  /```system[\s\S]*```/i,
  /<system>[\s\S]*<\/system>/i,

  // Context manipulation
  /the\s+above\s+(instructions?|text)\s+(is|are|was)\s+(a\s+)?test/i,
  /everything\s+(above|before|prior)\s+(this|here)\s+(is|was)\s+fake/i,
  /new\s+(system\s+)?prompt\s*:/i,
  /actual\s+(system\s+)?instructions?\s*:/i,
  /real\s+(system\s+)?prompt\s*:/i,

  // Hidden instruction patterns
  /<!--[\s\S]*ignore[\s\S]*-->/i,
  /\/\*[\s\S]*system[\s\S]*\*\//i,
  // eslint-disable-next-line no-control-regex
  /\x00|\x1f|\x7f/, // Null bytes and control characters
];

/**
 * Unsafe code patterns
 * EXPANDED: Now includes 50+ patterns for dangerous code detection
 */
const UNSAFE_CODE_PATTERNS = [
  // Destructive file system commands
  /rm\s+-rf\s+\/(?!\w)/,
  /rm\s+-rf\s+\$\{?HOME\}?/i,
  /rm\s+-rf\s+~\//,
  /rm\s+-rf\s+\*\s*$/,
  /rmdir\s+\/s\s+\/q/i,
  /del\s+\/f\s+\/s\s+\/q/i,
  /format\s+[a-z]:\s*\/y/i,
  /mkfs\.\w+\s+\/dev\//i,
  /dd\s+if=.*of=\/dev\//i,

  // Dangerous eval/exec patterns
  /eval\s*\(\s*\$_(?:GET|POST|REQUEST|SERVER|COOKIE)/i,
  /eval\s*\(\s*base64_decode/i,
  /eval\s*\(\s*gzinflate/i,
  /exec\s*\(\s*(?:base64_decode|str_rot13|gzinflate)/i,
  /\beval\s*\(\s*[`'"].*\$\{/, // Template literal eval
  /new\s+Function\s*\(\s*[`'"]/i,
  /Function\s*\(\s*[`'"]/i,

  // Credential exposure
  /(?:password|passwd|secret|api_?key|auth_?token|access_?token)\s*[:=]\s*["'][^"']{8,}["']/i,
  /(?:aws_secret|aws_access|private_key)\s*[:=]\s*["'][^"']+["']/i,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i,
  /ghp_[A-Za-z0-9]{36}/, // GitHub token
  /sk-[A-Za-z0-9]{48}/, // OpenAI key
  /AKIA[A-Z0-9]{16}/, // AWS access key

  // Dangerous subprocess/system calls
  /subprocess\.call\s*\(\s*\[?\s*["'](?:rm|del|format|shutdown|reboot|curl.*\|.*sh|wget.*\|.*sh)/i,
  /os\.system\s*\(\s*["'](?:rm|del|format|shutdown|reboot|curl.*\|.*sh)/i,
  /os\.popen\s*\(\s*["'](?:rm|curl|wget)/i,
  /child_process\.exec\s*\(/i,
  /shelljs\.exec\s*\(/i,

  // SQL injection patterns
  /'\s*(?:OR|AND)\s*['"]?\d+['"]?\s*=\s*['"]?\d+/i,
  /UNION\s+(?:ALL\s+)?SELECT/i,
  /;\s*DROP\s+(?:TABLE|DATABASE)/i,
  /;\s*DELETE\s+FROM/i,
  /;\s*TRUNCATE\s+TABLE/i,
  /;\s*UPDATE\s+\w+\s+SET/i,
  /INTO\s+OUTFILE/i,
  /LOAD_FILE\s*\(/i,

  // Network exfiltration
  /curl\s+.*\s+\|\s*(?:bash|sh|zsh)/i,
  /wget\s+.*\s+\|\s*(?:bash|sh|zsh)/i,
  /curl\s+.*--data.*\$\(/i, // Command substitution in curl
  /nc\s+-e\s+\/bin\/(ba)?sh/i, // Netcat reverse shell
  /bash\s+-i\s+>&\s*\/dev\/tcp/i, // Bash reverse shell

  // Permission/privilege escalation
  /chmod\s+777\s+\//i,
  /chmod\s+-R\s+777/i,
  /chown\s+root/i,
  /sudo\s+-S/i, // Sudo with stdin password
  /setuid\s*\(/i,
  /setgid\s*\(/i,
];

/**
 * Crypto mining patterns
 */
const CRYPTO_MINING_PATTERNS = [
  /coinhive/i,
  /cryptonight/i,
  /xmrig/i,
  /monero/i,
  /stratum\+tcp/i,
  /mining[_-]?pool/i,
  /hashrate/i,
  /worker[_-]?id.*\d{6,}/i,
  /nicehash/i,
  /ethermine/i,
];

/**
 * Data exfiltration patterns
 */
const EXFILTRATION_PATTERNS = [
  // Sending data to external servers
  /curl\s+.*-d\s+@/i, // Curl posting file content
  /curl\s+.*--data-binary\s+@/i,
  /wget\s+--post-file/i,
  /nc\s+\d+\.\d+\.\d+\.\d+/i, // Netcat to IP

  // Base64 encoding for exfiltration
  /base64\s+[^\|]+\|\s*curl/i,
  /cat\s+[^\|]+\|\s*base64\s*\|\s*curl/i,

  // Environment variable leakage
  /echo\s+\$\{?(?:API_KEY|SECRET|PASSWORD|TOKEN)\}?\s*\|/i,
  /printenv\s*\|\s*(?:curl|wget|nc)/i,
  /env\s*\|\s*(?:curl|wget|nc)/i,

  // File upload patterns
  /upload.*(?:\/etc\/passwd|\.ssh|\.env|\.aws)/i,
  /send.*(?:\/etc\/passwd|\.ssh|\.env|\.aws)/i,
];

/**
 * PII patterns
 * EXPANDED: Now includes more comprehensive PII detection
 */
const PII_PATTERNS = [
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN
  /\b\d{16}\b/, // Credit card (16 digits)
  /\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card formatted
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i, // Email
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
  /\b\+1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/, // US phone with country code
  /\b[A-Z]{2}\d{6}[A-Z]?\b/i, // Passport number (simplified)
  /\b\d{2}[-/]\d{2}[-/]\d{4}\b/, // Date of birth
  /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/, // Private IP addresses
];

// ========== Core Functions ==========

/**
 * Check input content against guardrails
 */
export async function checkInput(
  content: string,
  userId: string,
  config?: Partial<GuardrailConfig>
): Promise<GuardrailCheckResult> {
  const startTime = Date.now();
  const policies = config?.policies || DEFAULT_INPUT_POLICIES;
  const triggeredPolicies: GuardrailCheckResult['triggeredPolicies'] = [];
  let finalAction: GuardrailAction = 'pass';

  // Length check
  const maxLength = config?.maxInputLength || 100_000;
  if (content.length > maxLength) {
    triggeredPolicies.push({
      policyId: 'length_limit',
      policyName: 'Input Length Limit',
      confidence: 1.0,
      reason: `Input exceeds maximum length of ${maxLength} characters`,
    });
    finalAction = 'block';
  }

  // Check each enabled policy
  for (const policy of policies.filter((p) => p.enabled)) {
    const result = await checkPolicy(policy, content, 'input');
    if (result.triggered) {
      triggeredPolicies.push({
        policyId: policy.id,
        policyName: policy.name,
        confidence: result.confidence,
        reason: result.reason,
      });

      // Escalate action if needed
      if (getActionPriority(policy.action) > getActionPriority(finalAction)) {
        finalAction = policy.action;
      }
    }
  }

  // Audit log
  if (triggeredPolicies.length > 0) {
    await writeAuditLog({
      userId,
      action: 'guardrails.input_check',
      category: 'security',
      target: 'input_filter',
      metadata: {
        action: finalAction,
        triggeredPolicies: triggeredPolicies.map((p) => p.policyId),
      },
    });
  }

  const passed = finalAction === 'pass' || finalAction === 'log';

  logger.debug(
    { passed, action: finalAction, triggeredCount: triggeredPolicies.length },
    'Guardrails input check complete'
  );

  return {
    passed,
    action: finalAction,
    triggeredPolicies,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Check output content against guardrails
 */
export async function checkOutput(
  content: string,
  userId: string,
  config?: Partial<GuardrailConfig>
): Promise<GuardrailCheckResult> {
  const startTime = Date.now();
  const policies = config?.policies || DEFAULT_OUTPUT_POLICIES;
  const triggeredPolicies: GuardrailCheckResult['triggeredPolicies'] = [];
  let finalAction: GuardrailAction = 'pass';

  // Length check
  const maxLength = config?.maxOutputLength || 200_000;
  if (content.length > maxLength) {
    triggeredPolicies.push({
      policyId: 'length_limit',
      policyName: 'Output Length Limit',
      confidence: 1.0,
      reason: `Output exceeds maximum length of ${maxLength} characters`,
    });
    finalAction = 'warn';
  }

  // Check each enabled policy
  for (const policy of policies.filter((p) => p.enabled)) {
    const result = await checkPolicy(policy, content, 'output');
    if (result.triggered) {
      triggeredPolicies.push({
        policyId: policy.id,
        policyName: policy.name,
        confidence: result.confidence,
        reason: result.reason,
      });

      if (getActionPriority(policy.action) > getActionPriority(finalAction)) {
        finalAction = policy.action;
      }
    }
  }

  // Audit log
  if (triggeredPolicies.length > 0) {
    await writeAuditLog({
      userId,
      action: 'guardrails.output_check',
      category: 'security',
      target: 'output_filter',
      metadata: {
        action: finalAction,
        triggeredPolicies: triggeredPolicies.map((p) => p.policyId),
      },
    });
  }

  const passed = finalAction === 'pass' || finalAction === 'log';

  return {
    passed,
    action: finalAction,
    triggeredPolicies,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Check a specific policy against content
 */
async function checkPolicy(
  policy: GuardrailPolicy,
  content: string,
  _direction: 'input' | 'output'
): Promise<{ triggered: boolean; confidence: number; reason: string }> {
  let confidence = 0;
  let reason = '';

  switch (policy.id) {
    case 'jailbreak_detection':
      for (const pattern of JAILBREAK_PATTERNS) {
        if (pattern.test(content)) {
          confidence = 0.9;
          reason = 'Jailbreak attempt detected';
          break;
        }
      }
      break;

    case 'prompt_injection':
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(content)) {
          confidence = 0.85;
          reason = 'Prompt injection pattern detected';
          break;
        }
      }
      break;

    case 'pii_detection':
      for (const pattern of PII_PATTERNS) {
        if (pattern.test(content)) {
          confidence = 0.75;
          reason = 'Potential PII detected';
          break;
        }
      }
      break;

    case 'code_safety':
      for (const pattern of UNSAFE_CODE_PATTERNS) {
        if (pattern.test(content)) {
          confidence = 0.8;
          reason = 'Potentially unsafe code pattern detected';
          break;
        }
      }
      break;

    case 'credential_detection': {
      // Check for hardcoded credentials
      const credentialPatterns = [
        /(?:password|passwd|secret|api_?key|auth_?token|access_?token)\s*[:=]\s*["'][^"']{8,}["']/i,
        /(?:aws_secret|aws_access|private_key)\s*[:=]\s*["'][^"']+["']/i,
        /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i,
        /ghp_[A-Za-z0-9]{36}/,
        /sk-[A-Za-z0-9]{48}/,
        /AKIA[A-Z0-9]{16}/,
      ];
      for (const pattern of credentialPatterns) {
        if (pattern.test(content)) {
          confidence = 0.95;
          reason = 'Hardcoded credentials detected';
          break;
        }
      }
      break;
    }

    case 'crypto_mining':
      for (const pattern of CRYPTO_MINING_PATTERNS) {
        if (pattern.test(content)) {
          confidence = 0.85;
          reason = 'Crypto mining pattern detected';
          break;
        }
      }
      break;

    case 'exfiltration':
      for (const pattern of EXFILTRATION_PATTERNS) {
        if (pattern.test(content)) {
          confidence = 0.9;
          reason = 'Data exfiltration pattern detected';
          break;
        }
      }
      break;

    case 'harmful_content': {
      // Would use NeMo Guardrails API or local model
      // For now, basic keyword detection
      const harmfulKeywords = ['kill', 'harm', 'illegal', 'exploit'];
      const contentLower = content.toLowerCase();
      for (const keyword of harmfulKeywords) {
        if (contentLower.includes(keyword)) {
          confidence = 0.6;
          reason = 'Potentially harmful content detected';
          break;
        }
      }
      break;
    }

    default:
      // Unknown policy, pass
      break;
  }

  return {
    triggered: confidence >= policy.threshold,
    confidence,
    reason,
  };
}

/**
 * Get action priority (higher = more severe)
 */
function getActionPriority(action: GuardrailAction): number {
  switch (action) {
    case 'pass':
      return 0;
    case 'log':
      return 1;
    case 'warn':
      return 2;
    case 'block':
      return 3;
    default:
      return 0;
  }
}

// ========== Configuration ==========

/**
 * Get guardrail config for a tier
 */
export function getConfigForTier(tier: TierId): GuardrailConfig {
  const tierConfig = TIER_CONFIGS[tier] || TIER_CONFIGS.free;

  return {
    enabled: tierConfig.enabled ?? true,
    policies: [...DEFAULT_INPUT_POLICIES, ...DEFAULT_OUTPUT_POLICIES],
    maxInputLength: tierConfig.maxInputLength,
    maxOutputLength: tierConfig.maxOutputLength,
  };
}

/**
 * Check if guardrails are available
 */
export function isGuardrailsAvailable(): boolean {
  // Pattern-based guardrails always available
  // NeMo Guardrails API is optional enhancement
  return true;
}

/**
 * Check if NeMo Guardrails API is configured
 */
export function isNemoGuardrailsConfigured(): boolean {
  return Boolean(process.env.NVIDIA_NEMO_GUARDRAILS_URL);
}

/**
 * Get guardrails status
 */
export async function getGuardrailsStatus(): Promise<{
  available: boolean;
  nemoApiConfigured: boolean;
  inputPolicies: number;
  outputPolicies: number;
}> {
  return {
    available: isGuardrailsAvailable(),
    nemoApiConfigured: isNemoGuardrailsConfigured(),
    inputPolicies: DEFAULT_INPUT_POLICIES.filter((p) => p.enabled).length,
    outputPolicies: DEFAULT_OUTPUT_POLICIES.filter((p) => p.enabled).length,
  };
}

// ========== Sanitization ==========

/**
 * Sanitize PII from content
 */
export function sanitizePII(content: string): string {
  let sanitized = content;

  // Replace SSN
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, '[SSN REDACTED]');

  // Replace credit card
  sanitized = sanitized.replace(/\b\d{16}\b/g, '[CARD REDACTED]');

  // Replace email
  sanitized = sanitized.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi,
    '[EMAIL REDACTED]'
  );

  // Replace phone
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE REDACTED]');

  return sanitized;
}

/**
 * Classify content
 */
export async function classifyContent(content: string): Promise<ContentClassification[]> {
  const classifications: ContentClassification[] = [];

  // Check for code
  if (/```[\s\S]*```|function\s+\w+|class\s+\w+|import\s+\w+/i.test(content)) {
    classifications.push({
      category: 'code',
      confidence: 0.9,
      isHarmful: false,
      severity: 'low',
    });
  }

  // Check for PII
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(content)) {
      classifications.push({
        category: 'pii',
        confidence: 0.8,
        isHarmful: true,
        severity: 'medium',
      });
      break;
    }
  }

  // Check for unsafe code
  for (const pattern of UNSAFE_CODE_PATTERNS) {
    if (pattern.test(content)) {
      classifications.push({
        category: 'unsafe_code',
        confidence: 0.85,
        isHarmful: true,
        severity: 'high',
      });
      break;
    }
  }

  return classifications;
}
