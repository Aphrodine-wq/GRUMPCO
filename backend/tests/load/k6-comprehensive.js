/**
 * Comprehensive k6 Load Testing Suite
 *
 * Provides multiple named scenarios that run concurrently to simulate
 * realistic production traffic patterns.
 *
 * Run:   k6 run backend/tests/load/k6-comprehensive.js
 * Spike: k6 run -e PROFILE=spike backend/tests/load/k6-comprehensive.js
 * Soak:  k6 run -e PROFILE=soak  backend/tests/load/k6-comprehensive.js
 *
 * Environment variables:
 *   K6_BASE_URL  - API base URL (default http://localhost:3000)
 *   PROFILE      - Test profile: default | spike | soak | breakpoint
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate       = new Rate('error_rate');
const p95Latency      = new Trend('p95_latency', true);
const healthLatency   = new Trend('health_latency', true);
const chatLatency     = new Trend('chat_latency', true);
const intentLatency   = new Trend('intent_latency', true);
const archLatency     = new Trend('arch_gen_latency', true);
const sessionLatency  = new Trend('session_create_latency', true);
const templatesLatency = new Trend('templates_latency', true);
const totalRequests   = new Counter('total_requests');
const activeVUs       = new Gauge('active_vus');

// ---------------------------------------------------------------------------
// Configuration profiles
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const PROFILE  = (__ENV.PROFILE || 'default').toLowerCase();

const profiles = {
  default: {
    scenarios: {
      health_monitoring: {
        executor: 'constant-arrival-rate',
        rate: 10,
        timeUnit: '1s',
        duration: '3m',
        preAllocatedVUs: 5,
        maxVUs: 20,
        exec: 'healthMonitoring',
      },
      api_browsing: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '30s', target: 15 },
          { duration: '1m',  target: 15 },
          { duration: '30s', target: 30 },
          { duration: '1m',  target: 30 },
          { duration: '30s', target: 0 },
        ],
        exec: 'apiBrowsing',
      },
      intent_parsing: {
        executor: 'ramping-arrival-rate',
        startRate: 1,
        timeUnit: '1s',
        stages: [
          { duration: '30s', target: 5 },
          { duration: '2m',  target: 5 },
          { duration: '30s', target: 0 },
        ],
        preAllocatedVUs: 10,
        maxVUs: 30,
        exec: 'intentParsing',
      },
      codegen_sessions: {
        executor: 'per-vu-iterations',
        vus: 5,
        iterations: 3,
        maxDuration: '5m',
        exec: 'codegenSession',
      },
    },
    thresholds: {
      http_req_duration: ['p(95)<3000', 'p(99)<5000'],
      http_req_failed:   ['rate<0.05'],
      error_rate:        ['rate<0.05'],
      health_latency:    ['p(95)<200'],
      templates_latency: ['p(95)<500'],
    },
  },

  spike: {
    scenarios: {
      spike: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '10s', target: 5 },
          { duration: '10s', target: 100 }, // sudden spike
          { duration: '30s', target: 100 },
          { duration: '10s', target: 5 },   // drop back
          { duration: '1m',  target: 5 },   // recovery observation
        ],
        exec: 'apiBrowsing',
      },
    },
    thresholds: {
      http_req_duration: ['p(95)<5000'],
      http_req_failed:   ['rate<0.15'], // allow higher error rate during spike
      error_rate:        ['rate<0.15'],
    },
  },

  soak: {
    scenarios: {
      soak: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '2m',  target: 25 },
          { duration: '20m', target: 25 },
          { duration: '2m',  target: 0 },
        ],
        exec: 'apiBrowsing',
      },
      background_health: {
        executor: 'constant-arrival-rate',
        rate: 2,
        timeUnit: '1s',
        duration: '24m',
        preAllocatedVUs: 2,
        maxVUs: 5,
        exec: 'healthMonitoring',
      },
    },
    thresholds: {
      http_req_duration: ['p(95)<2000'],
      http_req_failed:   ['rate<0.02'],
      error_rate:        ['rate<0.02'],
    },
  },

  breakpoint: {
    scenarios: {
      breakpoint: {
        executor: 'ramping-arrival-rate',
        startRate: 1,
        timeUnit: '1s',
        stages: [
          { duration: '1m', target: 20 },
          { duration: '1m', target: 50 },
          { duration: '1m', target: 100 },
          { duration: '1m', target: 200 },
          { duration: '1m', target: 300 },
        ],
        preAllocatedVUs: 50,
        maxVUs: 500,
        exec: 'apiBrowsing',
      },
    },
    thresholds: {
      http_req_duration: ['p(95)<10000'],
    },
  },
};

const selectedProfile = profiles[PROFILE] || profiles.default;
export const options = {
  ...selectedProfile,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const intents = [
  'Build a todo app with user authentication and real-time sync',
  'Create an e-commerce marketplace with payment processing',
  'Build a project management tool with kanban boards and team chat',
  'Create a SaaS analytics dashboard with multi-tenant support',
  'Build a social media platform with feeds and notifications',
  'Create a CRM system with pipeline management and email integration',
  'Build a learning management system with video hosting',
  'Create a healthcare appointment booking system with HIPAA compliance',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ---------------------------------------------------------------------------
// Scenario executors
// ---------------------------------------------------------------------------

/** Continuous health monitoring at fixed rate */
export function healthMonitoring() {
  activeVUs.add(1);

  group('health', () => {
    const quick = http.get(`${BASE_URL}/health/quick`);
    healthLatency.add(quick.timings.duration);
    totalRequests.add(1);
    const ok = check(quick, {
      'health 200':       (r) => r.status === 200,
      'health < 200ms':   (r) => r.timings.duration < 200,
      'healthy status':   (r) => {
        try { return JSON.parse(r.body).status === 'healthy'; } catch { return false; }
      },
    });
    errorRate.add(!ok);

    const ready = http.get(`${BASE_URL}/health/ready`);
    totalRequests.add(1);
    check(ready, { 'ready 200': (r) => r.status === 200 });
  });
}

/** Simulates user browsing the API (settings, models, templates) */
export function apiBrowsing() {
  activeVUs.add(1);

  group('settings', () => {
    const res = http.get(`${BASE_URL}/api/settings`);
    p95Latency.add(res.timings.duration);
    totalRequests.add(1);
    const ok = check(res, {
      'settings 200':  (r) => r.status === 200,
      'settings body': (r) => r.body && r.body.length > 2,
    });
    errorRate.add(!ok);
  });

  group('models', () => {
    const res = http.get(`${BASE_URL}/api/models`);
    p95Latency.add(res.timings.duration);
    totalRequests.add(1);
    check(res, { 'models 200|503': (r) => r.status === 200 || r.status === 503 });
  });

  group('templates', () => {
    const res = http.get(`${BASE_URL}/api/templates`);
    templatesLatency.add(res.timings.duration);
    totalRequests.add(1);
    const ok = check(res, {
      'templates 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  sleep(Math.random() * 2 + 0.5); // 0.5–2.5s think time
}

/** Parses natural language intents */
export function intentParsing() {
  activeVUs.add(1);

  const payload = JSON.stringify({
    raw: pick(intents),
    constraints: { complexity: 'standard' },
  });

  const res = http.post(`${BASE_URL}/api/intent/parse`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
  });

  intentLatency.add(res.timings.duration);
  totalRequests.add(1);

  const ok = check(res, {
    'intent 200':       (r) => r.status === 200,
    'intent has data':  (r) => {
      try { const b = JSON.parse(r.body); return b.actors || b.features; } catch { return false; }
    },
  });
  errorRate.add(!ok);
  sleep(1);
}

/** Starts a code generation session */
export function codegenSession() {
  activeVUs.add(1);

  // Step 1: Create session
  const startPayload = JSON.stringify({
    prd: {
      id: `prd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: 'Load Test PRD',
      description: pick(intents),
      features: [],
      userStories: [],
    },
    architecture: {
      id: `arch_${Date.now()}`,
      metadata: { title: 'Test Architecture' },
      diagram: 'graph TB\nA[Client] --> B[API]',
    },
    preferences: {
      frontendFramework: 'vue',
      backendRuntime: 'node',
      database: 'postgres',
    },
  });

  const start = http.post(`${BASE_URL}/api/codegen/start`, startPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
  });

  sessionLatency.add(start.timings.duration);
  totalRequests.add(1);

  const startOk = check(start, {
    'session 200|201':    (r) => r.status === 200 || r.status === 201,
    'session has id':     (r) => {
      try { return JSON.parse(r.body).sessionId?.length > 0; } catch { return false; }
    },
  });
  errorRate.add(!startOk);

  // Step 2: Poll session status (if session was created)
  if (start.status === 200 || start.status === 201) {
    try {
      const sessionId = JSON.parse(start.body).sessionId;
      for (let i = 0; i < 5; i++) {
        sleep(2);
        const poll = http.get(`${BASE_URL}/api/codegen/session/${sessionId}`);
        totalRequests.add(1);
        check(poll, { 'poll 200': (r) => r.status === 200 });
        try {
          const body = JSON.parse(poll.body);
          if (body.status === 'completed' || body.status === 'failed') break;
        } catch { /* continue polling */ }
      }
    } catch { /* ignore parse errors */ }
  }

  sleep(2);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
export function setup() {
  const res = http.get(`${BASE_URL}/health/quick`);
  if (res.status !== 200) {
    throw new Error(`API not accessible at ${BASE_URL} (status ${res.status})`);
  }
  return { baseUrl: BASE_URL, profile: PROFILE };
}

export function teardown(data) {
  console.log(`Test completed. Profile: ${data.profile}, Base URL: ${data.baseUrl}`);
}

export function handleSummary(data) {
  return {
    'k6-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

// k6 built-in text summary helper
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
