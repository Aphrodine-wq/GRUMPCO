import express from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { performance } from 'perf_hooks';
import workspaceRouter from '../src/routes/workspace.js';

const PORT = 3456;
const TEMP_DIR = path.join(os.tmpdir(), 'workspace-bench-' + Date.now());

// Setup temp directory
function setup() {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DIR);

  // Create some structure
  for (let i = 0; i < 20; i++) {
    const dir = path.join(TEMP_DIR, `dir_${i}`);
    fs.mkdirSync(dir);
    for (let j = 0; j < 20; j++) {
      fs.writeFileSync(path.join(dir, `file_${j}.txt`), 'content');
    }
  }
  // Create some root files
  for (let i = 0; i < 50; i++) {
     fs.writeFileSync(path.join(TEMP_DIR, `root_file_${i}.txt`), 'content');
  }
}

function teardown() {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

async function run() {
  setup();
  process.env.WORKSPACE_BASE = TEMP_DIR;

  const app = express();
  app.use('/', workspaceRouter);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));

  // Warmup
  console.log('Warming up...');
  for(let i=0; i<10; i++) {
     await fetch(`http://localhost:${PORT}/tree?path=.`);
  }

  const iterations = 1000;
  const concurrency = 100;

  console.log(`Starting benchmark: ${iterations} requests, ${concurrency} concurrent...`);
  const start = performance.now();

  let completed = 0;
  let running = 0;
  let started = 0;

  await new Promise<void>((resolve, reject) => {
    const next = () => {
        if (completed >= iterations) {
            if (running === 0) resolve();
            return;
        }

        while (running < concurrency && started < iterations) {
            started++;
            running++;
            fetch(`http://localhost:${PORT}/tree?path=.`)
                .then(async (res) => {
                    if (!res.ok) console.error('Error', res.status);
                    await res.json(); // Consume body
                })
                .catch(err => console.error(err))
                .finally(() => {
                    running--;
                    completed++;
                    if (completed >= iterations && running === 0) {
                        resolve();
                    } else {
                        next();
                    }
                });
        }
    };
    next();
  });

  const end = performance.now();
  const duration = (end - start) / 1000;
  const rps = iterations / duration;

  console.log('--------------------------------------------------');
  console.log(`Total Requests: ${iterations}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Duration: ${duration.toFixed(3)}s`);
  console.log(`RPS: ${rps.toFixed(2)}`);
  console.log('--------------------------------------------------');

  server.close();
  teardown();
}

run().catch(console.error);
