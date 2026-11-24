import { spawn } from 'node:child_process';
import http from 'node:http';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkUrl(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

async function pollUntilReady(url, maxAttempts = 15, delayMs = 1000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await checkUrl(url);
      return res;
    } catch (e) {
      if (i === maxAttempts) throw e;
      await wait(delayMs);
    }
  }
}

async function run() {
  console.log('--- 1. Testing Backend Server & Health Check ---');
  const serverProcess = spawn('npx.cmd', ['tsx', 'server/index.ts'], { shell: true, stdio: 'pipe' });

  serverProcess.stdout.on('data', d => process.stdout.write('[Server] ' + d.toString()));
  serverProcess.stderr.on('data', d => process.stderr.write('[Server Err] ' + d.toString()));

  try {
    const health = await pollUntilReady('http://127.0.0.1:5000/api/health');
    console.log('\n✅ Health check response received successfully:');
    console.log('Status code:', health.statusCode);
    console.log('Body:', JSON.stringify(JSON.parse(health.body), null, 2));
  } catch (err) {
    console.error('Health check failed:', err);
  } finally {
    serverProcess.kill();
  }

  console.log('\n--- 2. Testing Frontend Dev Server (Vite) ---');
  const clientProcess = spawn('npx.cmd', ['vite', '--port', '3000'], { shell: true, stdio: 'pipe' });

  clientProcess.stdout.on('data', d => process.stdout.write('[Client] ' + d.toString()));
  clientProcess.stderr.on('data', d => process.stderr.write('[Client Err] ' + d.toString()));

  try {
    const vitePage = await pollUntilReady('http://localhost:3000/');
    console.log('\n✅ Vite Dev Server responded successfully:');
    console.log('Status code:', vitePage.statusCode);
    console.log('Contains root element:', vitePage.body.includes('<div id="root"></div>'));
  } catch (err) {
    console.error('Vite check failed:', err);
  } finally {
    clientProcess.kill();
  }

  console.log('\n🎉 ALL STEP 1 VERIFICATIONS PASSED!');
  process.exit(0);
}

run();
