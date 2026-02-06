import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const chatLatency = new Trend('chat_latency');
const shipLatency = new Trend('ship_latency');

// Test configuration
export const options = {
    stages: [
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 200 },  // Ramp up to 200 users
        { duration: '5m', target: 200 },  // Stay at 200 users
        { duration: '2m', target: 500 },  // Ramp up to 500 users
        { duration: '5m', target: 500 },  // Stay at 500 users
        { duration: '5m', target: 0 },    // Ramp down to 0 users
    ],
    thresholds: {
        'http_req_duration': ['p(95)<2000', 'p(99)<5000'], // 95% under 2s, 99% under 5s
        'http_req_failed': ['rate<0.01'], // Error rate < 1%
        'errors': ['rate<0.05'], // Custom error rate < 5%
        'chat_latency': ['p(95)<500'], // Chat first token < 500ms
        'ship_latency': ['p(95)<10000'], // Ship start < 10s
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || '';

export default function () {
    // Test 1: Health check
    {
        const res = http.get(`${BASE_URL}/health/live`);
        check(res, {
            'health check is 200': (r) => r.status === 200,
            'health check has correct body': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.status === 'ok';
                } catch {
                    return false;
                }
            },
        }) || errorRate.add(1);
    }

    sleep(1);

    // Test 2: List models
    {
        const res = http.get(`${BASE_URL}/api/models`, {
            headers: {
                'Content-Type': 'application/json',
                ...(API_KEY && { 'Authorization': `Bearer ${API_KEY}` }),
            },
        });
        check(res, {
            'models endpoint is 200': (r) => r.status === 200,
            'models has providers': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.providers && body.providers.length > 0;
                } catch {
                    return false;
                }
            },
        }) || errorRate.add(1);
    }

    sleep(1);

    // Test 3: Chat stream (20% of requests)
    if (Math.random() < 0.2) {
        const chatPayload = JSON.stringify({
            model: '',
            messages: [
                {
                    role: 'user',
                    content: 'Write a hello world function in TypeScript',
                },
            ],
            stream: true,
        });

        const chatStart = Date.now();
        const res = http.post(`${BASE_URL}/api/chat/stream`, chatPayload, {
            headers: {
                'Content-Type': 'application/json',
                ...(API_KEY && { 'Authorization': `Bearer ${API_KEY}` }),
            },
        });

        const latency = Date.now() - chatStart;
        chatLatency.add(latency);

        check(res, {
            'chat stream is 200': (r) => r.status === 200,
            'chat returns data': (r) => r.body && r.body.length > 0,
        }) || errorRate.add(1);
    }

    sleep(2);

    // Test 4: Ship workflow start (10% of requests)
    if (Math.random() < 0.1) {
        const shipPayload = JSON.stringify({
            projectDescription: 'Build a simple todo app with React and Node.js',
            preferences: {
                techStack: ['React', 'Node.js', 'PostgreSQL'],
                deploymentTarget: 'docker',
            },
        });

        const shipStart = Date.now();
        const res = http.post(`${BASE_URL}/api/ship/start`, shipPayload, {
            headers: {
                'Content-Type': 'application/json',
                ...(API_KEY && { 'Authorization': `Bearer ${API_KEY}` }),
            },
        });

        const latency = Date.now() - shipStart;
        shipLatency.add(latency);

        check(res, {
            'ship start is 200 or 201': (r) => r.status === 200 || r.status === 201,
            'ship returns sessionId': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.sessionId && body.sessionId.length > 0;
                } catch {
                    return false;
                }
            },
        }) || errorRate.add(1);
    }

    sleep(3);

    // Test 5: Architecture generation (15% of requests)
    if (Math.random() < 0.15) {
        const archPayload = JSON.stringify({
            description: 'A microservices e-commerce platform with payment processing',
            diagramType: 'c4',
            level: 'container',
        });

        const res = http.post(`${BASE_URL}/api/architecture/generate`, archPayload, {
            headers: {
                'Content-Type': 'application/json',
                ...(API_KEY && { 'Authorization': `Bearer ${API_KEY}` }),
            },
        });

        check(res, {
            'architecture is 200': (r) => r.status === 200,
            'architecture returns diagram': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.diagram && body.diagram.length > 0;
                } catch {
                    return false;
                }
            },
        }) || errorRate.add(1);
    }

    sleep(2);

    // Test 6: Metrics endpoint
    {
        const res = http.get(`${BASE_URL}/metrics`);
        check(res, {
            'metrics endpoint is 200': (r) => r.status === 200,
            'metrics has prometheus format': (r) => r.body.includes('# TYPE'),
        }) || errorRate.add(1);
    }

    sleep(1);
}

export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'performance-results.json': JSON.stringify(data),
        'performance-report.html': htmlReport(data),
    };
}

function textSummary(data, options) {
    // Simple text summary
    const { indent = '', enableColors = false } = options;
    let summary = '\n';

    summary += `${indent}Test Summary:\n`;
    summary += `${indent}  Checks............: ${data.metrics.checks.passes} passed, ${data.metrics.checks.fails} failed\n`;
    summary += `${indent}  HTTP Requests.....: ${data.metrics.http_reqs.count}\n`;
    summary += `${indent}  Failed Requests...: ${data.metrics.http_req_failed.values.rate * 100}%\n`;
    summary += `${indent}  Request Duration..: avg=${data.metrics.http_req_duration.values.avg}ms, p95=${data.metrics.http_req_duration.values['p(95)']}ms\n`;

    return summary;
}

function htmlReport(data) {
    return `<!DOCTYPE html>
<html>
<head>
  <title>G-Rump Performance Test Results</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #6366F1; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #6366F1; color: white; }
    .pass { color: #22c55e; font-weight: bold; }
    .fail { color: #ef4444; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 G-Rump Performance Test Results</h1>
    <h2>Summary</h2>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Total Checks</td><td>${data.metrics.checks.passes + data.metrics.checks.fails}</td></tr>
      <tr><td>Passed</td><td class="pass">${data.metrics.checks.passes}</td></tr>
      <tr><td>Failed</td><td class="fail">${data.metrics.checks.fails}</td></tr>
      <tr><td>HTTP Requests</td><td>${data.metrics.http_reqs.count}</td></tr>
      <tr><td>Failed Requests</td><td>${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</td></tr>
    </table>
    
    <h2>Response Time Percentiles</h2>
    <table>
      <tr><th>Percentile</th><th>Duration (ms)</th></tr>
      <tr><td>p50 (Median)</td><td>${data.metrics.http_req_duration.values.med.toFixed(2)}</td></tr>
      <tr><td>p90</td><td>${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}</td></tr>
      <tr><td>p95</td><td>${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}</td></tr>
      <tr><td>p99</td><td>${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}</td></tr>
    </table>
  </div>
</body>
</html>`;
}
