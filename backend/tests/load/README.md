# Load Testing

This directory contains k6 load tests for the G-Rump API.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Windows (choco)
choco install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Running Tests

### Basic Load Test
```bash
# Start the backend server first
npm run dev:backend

# Run load test in another terminal
k6 run backend/tests/load/api-load-test.js
```

### Custom Configuration
```bash
# Custom base URL
k6 run -e BASE_URL=https://api.grump.example.com backend/tests/load/api-load-test.js

# Custom virtual users and duration
k6 run --vus 20 --duration 2m backend/tests/load/api-load-test.js
```

### Stress Test
```bash
k6 run --vus 100 --duration 5m backend/tests/load/api-load-test.js
```

### Soak Test (Extended Duration)
```bash
k6 run --vus 20 --duration 30m backend/tests/load/api-load-test.js
```

## Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| http_req_duration p(95) | < 500ms | 95th percentile response time |
| http_req_duration p(99) | < 1000ms | 99th percentile response time |
| errors | < 10% | Error rate |
| health_check_duration p(95) | < 100ms | Health check response time |

## CI Integration

Load tests run in CI on main branch pushes. See `.github/workflows/ci.yml` for configuration.

## Output

```
          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ 

     execution: local
        output: -

     scenarios: (100.00%) 1 scenario, 50 max VUs, 3m30s max duration
              : default: Up to 50 VUs over 3m0s

     ✓ quick health status is 200
     ✓ quick health response time < 100ms
     ✓ ready health status is 200
     ...

     checks.........................: 100.00% ✓ 1234 ✗ 0
     data_received..................: 1.2 MB  6.8 kB/s
     data_sent......................: 234 kB  1.3 kB/s
     http_req_duration..............: avg=45ms min=12ms p(95)=89ms p(99)=145ms
     ...
```
