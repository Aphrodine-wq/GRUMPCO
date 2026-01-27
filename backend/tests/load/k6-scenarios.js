/**
 * k6 Load Testing Scenarios
 * 
 * Install k6: https://k6.io/docs/getting-started/installation/
 * Run: k6 run k6-scenarios.js
 * 
 * Environment variables:
 * - K6_BASE_URL: Base URL for API (default: http://localhost:3000)
 * - K6_VUS: Virtual users (default: 10)
 * - K6_DURATION: Test duration (default: 30s)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const intentParseDuration = new Trend('intent_parse_duration');
const architectureGenDuration = new Trend('architecture_gen_duration');
const sessionCreationDuration = new Trend('session_creation_duration');
const apiCallsTotal = new Counter('api_calls_total');

// Configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 },  // Stay at 10 users
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 },  // Stay at 20 users
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests should be below 5s
    http_req_failed: ['rate<0.05'],     // Error rate should be less than 5%
    errors: ['rate<0.05'],               // Custom error rate
  },
};

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.ANTHROPIC_API_KEY || 'test-key';

// Test data
const testIntents = [
  'Build a todo app with user authentication',
  'Create a blog platform with comments and likes',
  'Build an e-commerce site with shopping cart',
  'Create a chat application with real-time messaging',
  'Build a project management tool with kanban boards',
];

function getRandomIntent() {
  return testIntents[Math.floor(Math.random() * testIntents.length)];
}

/**
 * Scenario 1: Health Check
 */
export function healthCheck() {
  const url = `${BASE_URL}/health/quick`;
  const res = http.get(url);
  
  const success = check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
    'health check has status field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  apiCallsTotal.add(1);
  sleep(1);
}

/**
 * Scenario 2: Intent Parsing
 */
export function intentParsing() {
  const url = `${BASE_URL}/api/intent/parse`;
  const payload = JSON.stringify({
    raw: getRandomIntent(),
    constraints: {
      complexity: 'standard',
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const startTime = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  const success = check(res, {
    'intent parse status is 200': (r) => r.status === 200,
    'intent parse has structured data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.actors && body.features;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  intentParseDuration.add(duration);
  apiCallsTotal.add(1);
  sleep(2);
}

/**
 * Scenario 3: Architecture Generation
 */
export function architectureGeneration() {
  const url = `${BASE_URL}/api/architecture/generate`;
  const payload = JSON.stringify({
    projectDescription: getRandomIntent(),
    projectType: 'web',
    complexity: 'standard',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '60s', // Architecture generation can take longer
  };

  const startTime = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  const success = check(res, {
    'architecture gen status is 200': (r) => r.status === 200,
    'architecture gen has diagram': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.diagram && body.diagram.length > 0;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  architectureGenDuration.add(duration);
  apiCallsTotal.add(1);
  sleep(3);
}

/**
 * Scenario 4: Concurrent Session Creation
 */
export function sessionCreation() {
  // Simulate session creation by starting code generation
  const url = `${BASE_URL}/api/codegen/start`;
  const payload = JSON.stringify({
    prd: {
      id: `prd_${Date.now()}_${Math.random()}`,
      title: 'Test PRD',
      description: getRandomIntent(),
      features: [],
      userStories: [],
    },
    architecture: {
      id: `arch_${Date.now()}_${Math.random()}`,
      metadata: {
        title: 'Test Architecture',
      },
      diagram: 'graph TB\nA[Test]',
    },
    preferences: {
      frontendFramework: 'vue',
      backendRuntime: 'node',
      database: 'postgres',
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '30s',
  };

  const startTime = Date.now();
  const res = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  const success = check(res, {
    'session creation status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'session creation has sessionId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.sessionId && body.sessionId.length > 0;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  sessionCreationDuration.add(duration);
  apiCallsTotal.add(1);
  sleep(2);
}

/**
 * Scenario 5: API Rate Limiting Validation
 */
export function rateLimitTest() {
  // Send rapid requests to test rate limiting
  const url = `${BASE_URL}/health/quick`;
  const requests = [];
  
  for (let i = 0; i < 20; i++) {
    requests.push(http.get(url));
  }

  const results = http.batch(requests);
  
  let successCount = 0;
  let rateLimitedCount = 0;

  results.forEach((res) => {
    if (res.status === 200) {
      successCount++;
    } else if (res.status === 429) {
      rateLimitedCount++;
    }
  });

  check(null, {
    'some requests succeeded': () => successCount > 0,
    'rate limiting is working': () => rateLimitedCount > 0 || successCount < 20,
  });

  sleep(1);
}

/**
 * Main test function
 */
export default function () {
  // Run different scenarios based on random selection
  const scenario = Math.random();

  if (scenario < 0.2) {
    healthCheck();
  } else if (scenario < 0.5) {
    intentParsing();
  } else if (scenario < 0.7) {
    architectureGeneration();
  } else if (scenario < 0.9) {
    sessionCreation();
  } else {
    rateLimitTest();
  }
}

/**
 * Setup function (runs once before all VUs)
 */
export function setup() {
  // Verify API is accessible
  const res = http.get(`${BASE_URL}/health/quick`);
  if (res.status !== 200) {
    throw new Error(`API is not accessible at ${BASE_URL}`);
  }
  return { baseUrl: BASE_URL };
}

/**
 * Teardown function (runs once after all VUs)
 */
export function teardown(data) {
  console.log(`Test completed. Base URL: ${data.baseUrl}`);
}
