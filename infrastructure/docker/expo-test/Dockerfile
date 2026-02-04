# Expo test runner image for G-Rump "expo" test job type.
# Mount project at /app and run npm install && npm test (or npm run test).
FROM node:20-bookworm-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Optional: install Expo CLI globally for expo start / expo run
RUN npm install -g expo-cli 2>/dev/null || true

WORKDIR /app

# Default command when used via "docker run ... image" is overridden by job queue.
# When G-Rump runs: docker run -v projectPath:/app grump-expo-test sh -c "cd /app && npm install && npm test"
CMD ["sh", "-c", "cd /app && (test -f package.json && npm install && (npm test || npm run test || true) || echo 'No package.json')"]
