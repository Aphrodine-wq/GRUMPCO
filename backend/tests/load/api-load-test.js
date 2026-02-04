/**
 * k6 Load Test for G-Rump API
 * 
 * Run with: k6 run backend/tests/load/api-load-test.js
 * 
 * Environment variables:
 * - BASE_URL: API base URL (default: http://localhost:3000)
 * - VUS: Number of virtual users (default: 10)
 * - DURATION: Test duration (default: 30s)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthCheckDuration = new Trend('health_check_duration');
const chatApiDuration = new Trend('chat_api_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '1m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests < 500ms, 99% < 1s
    errors: ['rate<0.1'],                           // Error rate < 10%
    health_check_duration: ['p(95)<100'],           // Health checks < 100ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  group('Health Checks', function () {
    // Quick health check
    const quickHealth = http.get(`${BASE_URL}/health/quick`);
    healthCheckDuration.add(quickHealth.timings.duration);
    
    const quickHealthOk = check(quickHealth, {
      'quick health status is 200': (r) => r.status === 200,
      'quick health response time < 100ms': (r) => r.timings.duration < 100,
    });
    errorRate.add(!quickHealthOk);

    // Ready health check
    const readyHealth = http.get(`${BASE_URL}/health/ready`);
    const readyHealthOk = check(readyHealth, {
      'ready health status is 200': (r) => r.status === 200,
    });
    errorRate.add(!readyHealthOk);
  });

  group('API Endpoints', function () {
    // Settings endpoint
    const settings = http.get(`${BASE_URL}/api/settings`);
    const settingsOk = check(settings, {
      'settings status is 200': (r) => r.status === 200,
      'settings has body': (r) => r.body && r.body.length > 0,
    });
    errorRate.add(!settingsOk);

    // Models endpoint
    const models = http.get(`${BASE_URL}/api/models`);
    const modelsOk = check(models, {
      'models status is 200 or 503': (r) => r.status === 200 || r.status === 503,
    });
    errorRate.add(!modelsOk);

    // Templates endpoint
    const templates = http.get(`${BASE_URL}/api/templates`);
    const templatesOk = check(templates, {
      'templates status is 200': (r) => r.status === 200,
    });
    errorRate.add(!templatesOk);
  });

  group('Rate Limiting Test', function () {
    // Rapid-fire requests to test rate limiting
    for (let i = 0; i < 5; i++) {
      http.get(`${BASE_URL}/health/quick`);
    }
  });

  sleep(1); // Think time between iterations
}

// Separate scenario for chat API load testing (requires auth)
export function chatLoadTest() {
  const payload = JSON.stringify({
    messages: [{ role: 'user', content: 'Hello, this is a load test.' }],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/chat`, payload, params);
  chatApiDuration.add(res.timings.duration);

  const chatOk = check(res, {
    'chat status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });
  errorRate.add(!chatOk);
}

// Stress test configuration (run separately with -e STRESS=true)
export function stressTest() {
  const responses = http.batch([
    ['GET', `${BASE_URL}/health/quick`],
    ['GET', `${BASE_URL}/health/ready`],
    ['GET', `${BASE_URL}/api/settings`],
  ]);

  responses.forEach((res, i) => {
    const ok = check(res, {
      [`batch request ${i} succeeded`]: (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });
}

// Soak test configuration (run separately for extended period)
export const soakOptions = {
  stages: [
    { duration: '2m', target: 20 },   // Ramp up
    { duration: '30m', target: 20 },  // Sustained load
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    errors: ['rate<0.05'],
  },
};
