# G-Rump Monitoring Setup

This directory contains monitoring configurations for G-Rump's performance and cost tracking.

## Grafana Dashboard

The `grafana-dashboard.json` file contains a comprehensive dashboard with:

### Performance Metrics
- **API Request Rate**: Requests per second by endpoint
- **API Latency**: P50, P95, P99 latencies
- **System Resources**: CPU, memory, event loop lag
- **Worker Pool**: Queue depth and active workers

### Cache Metrics
- **Cache Hit Rate**: By layer (L1/L2/L3)
- **Cache Operations**: Hits and misses per second
- **Cost Savings**: Money saved through caching

### GPU Metrics
- **GPU Utilization**: Percentage utilization per GPU
- **GPU Memory**: Memory usage per GPU
- **Multi-GPU Load Balancing**: Distribution across GPUs

### Cost Metrics
- **LLM Cost per Hour**: Cost breakdown by provider and model
- **Token Usage**: Input/output tokens per second
- **Model Router Decisions**: Distribution of model selections

## Setup Instructions

### 1. Install Prometheus

```bash
# Download Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
cd prometheus-2.45.0.linux-amd64

# Configure Prometheus to scrape G-Rump metrics
cat > prometheus.yml <<EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'grump'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
EOF

# Start Prometheus
./prometheus --config.file=prometheus.yml
```

### 2. Install Grafana

```bash
# Ubuntu/Debian
sudo apt-get install -y adduser libfontconfig1
wget https://dl.grafana.com/oss/release/grafana_10.0.0_amd64.deb
sudo dpkg -i grafana_10.0.0_amd64.deb

# Start Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

### 3. Import Dashboard

1. Open Grafana at `http://localhost:3000` (default credentials: admin/admin)
2. Add Prometheus as a data source:
   - Go to Configuration → Data Sources
   - Add Prometheus
   - URL: `http://localhost:9090`
   - Save & Test
3. Import the dashboard:
   - Go to Dashboards → Import
   - Upload `grafana-dashboard.json`
   - Select Prometheus data source
   - Import

### 4. Configure Alerts (Optional)

Add alerting rules in Prometheus:

```yaml
# prometheus-alerts.yml
groups:
  - name: grump_alerts
    interval: 30s
    rules:
      - alert: HighAPILatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency detected"
          description: "P95 latency is {{ $value }}s"

      - alert: LowCacheHitRate
        expr: rate(tiered_cache_hits_total[5m]) / (rate(tiered_cache_hits_total[5m]) + rate(tiered_cache_misses_total[5m])) < 0.4
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value | humanizePercentage }}"

      - alert: HighGPUUtilization
        expr: gpu_utilization_percent > 90
        for: 5m
        labels:
          severity: info
        annotations:
          summary: "High GPU utilization"
          description: "GPU {{ $labels.gpu_id }} at {{ $value }}%"

      - alert: HighCostBurn
        expr: rate(llm_cost_total[1h]) > 10
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: "High cost burn rate"
          description: "Spending ${{ $value }}/hour"
```

## Metrics Reference

### HTTP Metrics
- `http_requests_total`: Total HTTP requests
- `http_request_duration_seconds`: Request duration histogram
- `http_request_size_bytes`: Request size histogram
- `http_response_size_bytes`: Response size histogram

### Cache Metrics
- `tiered_cache_hits_total`: Cache hits by layer
- `tiered_cache_misses_total`: Cache misses by layer
- `cache_cost_savings_total`: Estimated cost savings

### GPU Metrics
- `gpu_utilization_percent`: GPU utilization percentage
- `gpu_memory_used_bytes`: GPU memory usage
- `gpu_temperature_celsius`: GPU temperature

### LLM Metrics
- `llm_requests_total`: Total LLM requests
- `llm_tokens_total`: Token usage (input/output)
- `llm_cost_total`: Total cost in USD
- `llm_request_duration_seconds`: LLM request duration

### Worker Pool Metrics
- `worker_pool_queue_depth`: Number of queued tasks
- `worker_pool_active_workers`: Number of active workers
- `worker_pool_task_duration_seconds`: Task duration

### System Metrics
- `process_cpu_usage_percent`: CPU usage
- `process_memory_usage_bytes`: Memory usage
- `nodejs_eventloop_lag_seconds`: Event loop lag

## Best Practices

1. **Set up alerting**: Configure alerts for critical metrics
2. **Regular review**: Check dashboards daily for anomalies
3. **Capacity planning**: Use trends to predict resource needs
4. **Cost optimization**: Monitor cost metrics to identify savings opportunities
5. **Performance tuning**: Use latency metrics to optimize slow endpoints

## Troubleshooting

### Metrics not appearing
- Check that G-Rump is running and `/metrics` endpoint is accessible
- Verify Prometheus is scraping the correct target
- Check Prometheus logs: `journalctl -u prometheus -f`

### Dashboard not loading
- Verify Grafana data source is configured correctly
- Check Prometheus is running: `curl http://localhost:9090/api/v1/status/config`
- Review Grafana logs: `journalctl -u grafana-server -f`

### High memory usage
- Prometheus retention period may be too long
- Reduce `--storage.tsdb.retention.time` flag
- Consider using remote storage for long-term metrics

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [G-Rump Performance Guide](../docs/PERFORMANCE_GUIDE.md)
