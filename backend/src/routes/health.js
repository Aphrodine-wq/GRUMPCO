import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getRequestLogger } from '../middleware/logger.js';
const router = express.Router();
// Shallow health check for load balancers
router.get('/', (req, res) => {
    res.json({ status: 'ok' });
});
// Quick health check for frontend status badge - no API calls, token-free
router.get('/quick', (req, res) => {
    const apiKeyConfigured = !!(process.env.ANTHROPIC_API_KEY &&
        process.env.ANTHROPIC_API_KEY !== 'your_api_key_here' &&
        process.env.ANTHROPIC_API_KEY.startsWith('sk-'));
    // Determine overall status
    let status = 'healthy';
    if (!apiKeyConfigured) {
        status = 'unhealthy';
    }
    res.json({
        status,
        checks: {
            api_key_configured: apiKeyConfigured,
            server_responsive: true
        },
        timestamp: new Date().toISOString()
    });
});
// Liveness probe - is the process alive?
router.get('/live', (req, res) => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const heapPercentage = (heapUsedMB / heapTotalMB) * 100;
    // Fail if heap usage exceeds 90%
    if (heapPercentage > 90) {
        return res.status(503).json({
            status: 'unhealthy',
            reason: 'high_memory_usage',
            memory: {
                heapUsedMB: Math.round(heapUsedMB),
                heapTotalMB: Math.round(heapTotalMB),
                heapPercentage: Math.round(heapPercentage),
            },
        });
    }
    res.json({
        status: 'healthy',
        uptime: Math.round(process.uptime()),
        memory: {
            heapUsedMB: Math.round(heapUsedMB),
            heapTotalMB: Math.round(heapTotalMB),
            heapPercentage: Math.round(heapPercentage),
        },
    });
});
// Readiness probe - can we handle requests?
router.get('/ready', async (req, res) => {
    const log = getRequestLogger();
    const checks = {
        api_key: false,
        anthropic_api: false,
    };
    // Check API key is configured
    if (process.env.ANTHROPIC_API_KEY) {
        checks.api_key = true;
    }
    // Check Anthropic API connectivity (lightweight check)
    try {
        const client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        // Use a minimal request to verify connectivity
        // Note: This costs tokens, so we only do it on /ready, not /health
        await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
        });
        checks.anthropic_api = true;
    }
    catch (error) {
        log.warn({ error: error.message }, 'Anthropic API health check failed');
        checks.anthropic_api = false;
    }
    const allHealthy = Object.values(checks).every(v => v);
    res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'ready' : 'not_ready',
        checks,
    });
});
export default router;
//# sourceMappingURL=health.js.map