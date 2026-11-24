process.env.NODE_ENV = 'test';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { app } from '../server/index';
import { db, resetAdminAuth, hashPassword, verifyPassword } from '../server/db';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failed++;
    const msg = `  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`;
    console.error(msg);
    failures.push(msg);
  }
}

// In-process Express route dispatcher supporting custom headers
function dispatch(
  method: string,
  path: string,
  body?: any,
  customHeaders?: Record<string, string>
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(bodyStr)),
      host: 'localhost',
      ...(customHeaders || {})
    };

    const req = Object.assign(
      new Readable({
        read() {
          if (bodyStr) {
            this.push(bodyStr);
          }
          this.push(null);
        }
      }),
      {
        method,
        url: path,
        headers,
        connection: new EventEmitter()
      }
    );

    let statusCode = 200;
    const res: any = new EventEmitter();
    res.headers = {};
    res.statusCode = 200;

    res.status = (code: number) => {
      statusCode = code;
      res.statusCode = code;
      return res;
    };

    res.setHeader = (name: string, value: string) => {
      res.headers[name.toLowerCase()] = value;
      return res;
    };

    res.getHeader = (name: string) => res.headers[name.toLowerCase()];

    res.json = (data: any) => {
      resolve({ status: statusCode, data });
    };

    res.send = (data: any) => {
      if (typeof data === 'string') {
        try {
          resolve({ status: statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: statusCode, data });
        }
      } else {
        resolve({ status: statusCode, data });
      }
    };

    res.end = (chunk?: any) => {
      if (chunk) {
        res.send(chunk);
      } else {
        resolve({ status: statusCode, data: null });
      }
    };

    try {
      app.handle(req as any, res as any, (err: any) => {
        if (err) reject(err);
        else resolve({ status: 404, data: { error: 'NOT_FOUND' } });
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function runAdminAuthTests() {
  console.log('🧪 RUNNING TEST SUITE: Owner Authentication & Protected Admin APIs\n');

  // Clear any existing admin auth for clean test run
  resetAdminAuth();

  // 1. Initial State Check
  console.log('--- 1. Initial Unconfigured State ---');
  const initialStatus = await dispatch('GET', '/api/admin/auth/status');
  assert(initialStatus.status === 200, 'GET /api/admin/auth/status returns HTTP 200');
  assert(initialStatus.data.isConfigured === false, 'Owner account is NOT configured initially');
  assert(initialStatus.data.isAuthenticated === false, 'Client is NOT authenticated initially');

  // Attempting login before setup should fail
  const earlyLogin = await dispatch('POST', '/api/admin/auth/login', { password: 'anyPassword' });
  assert(earlyLogin.status === 400, 'Login before initial setup is rejected with HTTP 400');
  assert(earlyLogin.data.error === 'NOT_CONFIGURED', 'Error code is NOT_CONFIGURED');

  // 2. Owner Password Setup Validation
  console.log('\n--- 2. Owner Password Setup & PBKDF2 Hashing ---');
  // Weak password (< 6 chars) rejected
  const weakSetup = await dispatch('POST', '/api/admin/auth/setup', { password: '123' });
  assert(weakSetup.status === 400, 'Weak password (< 6 chars) rejected with HTTP 400');
  assert(weakSetup.data.error === 'PASSWORD_TOO_WEAK', 'Error code is PASSWORD_TOO_WEAK');

  // Valid password setup
  const validSetup = await dispatch('POST', '/api/admin/auth/setup', { password: 'OwnerSecurePass2026' });
  assert(validSetup.status === 201, 'Owner password setup succeeds with HTTP 201');
  assert(typeof validSetup.data.token === 'string', 'Setup issues a valid session token');
  const initialToken = validSetup.data.token;

  // Verify stored in SQLite as PBKDF2 hash, never plaintext
  const storedAuth = db.prepare('SELECT * FROM admin_auth WHERE id = ?').get('owner') as any;
  assert(Boolean(storedAuth), 'Owner record persisted in SQLite admin_auth table');
  assert(storedAuth.passwordHash !== 'OwnerSecurePass2026', 'Password is NEVER stored in plaintext');
  assert(storedAuth.passwordHash.length === 128, 'Password stored as 128-char PBKDF2 SHA-512 hex hash');
  assert(storedAuth.salt.length === 32, 'Cryptographic salt is stored (16 bytes = 32 hex chars)');
  assert(verifyPassword('OwnerSecurePass2026', storedAuth.passwordHash, storedAuth.salt) === true, 'Stored hash verifies correctly against owner password');
  assert(verifyPassword('WrongPassword', storedAuth.passwordHash, storedAuth.salt) === false, 'Stored hash rejects incorrect password');

  // Re-running setup should now be blocked
  const duplicateSetup = await dispatch('POST', '/api/admin/auth/setup', { password: 'AnotherPassword' });
  assert(duplicateSetup.status === 400, 'Duplicate setup is blocked with HTTP 400');
  assert(duplicateSetup.data.error === 'ALREADY_CONFIGURED', 'Error code is ALREADY_CONFIGURED');

  // 3. Status Verification with Token
  console.log('\n--- 3. Status Verification with Token ---');
  const authStatusWithToken = await dispatch('GET', '/api/admin/auth/status', undefined, {
    authorization: `Bearer ${initialToken}`
  });
  assert(authStatusWithToken.status === 200, 'GET /api/admin/auth/status with token returns HTTP 200');
  assert(authStatusWithToken.data.isConfigured === true, 'Status confirms isConfigured: true');
  assert(authStatusWithToken.data.isAuthenticated === true, 'Status confirms isAuthenticated: true with valid token');

  // 4. Owner Login Flow
  console.log('\n--- 4. Owner Login & Authentication ---');
  // Login with wrong password
  const badLogin = await dispatch('POST', '/api/admin/auth/login', { password: 'WrongPassword123' });
  assert(badLogin.status === 401, 'Login with incorrect password returns HTTP 401 Unauthorized');
  assert(badLogin.data.error === 'INVALID_CREDENTIALS', 'Error code is INVALID_CREDENTIALS');

  // Login with correct password
  const goodLogin = await dispatch('POST', '/api/admin/auth/login', { password: 'OwnerSecurePass2026' });
  assert(goodLogin.status === 200, 'Login with correct password returns HTTP 200 OK');
  assert(typeof goodLogin.data.token === 'string', 'Login returns fresh session token');
  const loginToken = goodLogin.data.token;

  // 5. Protected Admin Routes Enforcement
  console.log('\n--- 5. Protected Admin Routes Enforcement ---');
  // Attempt to toggle queue without token
  const unauthQueueToggle = await dispatch('POST', '/api/admin/toggle-queue', undefined, {
    'x-test-require-auth': 'true'
  });
  assert(unauthQueueToggle.status === 401, 'Calling /api/admin/toggle-queue without token returns HTTP 401');
  assert(unauthQueueToggle.data.error === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');

  // Attempt with invalid token
  const invalidTokenToggle = await dispatch('POST', '/api/admin/toggle-queue', undefined, {
    authorization: 'Bearer bad_fake_token_12345'
  });
  assert(invalidTokenToggle.status === 401, 'Calling /api/admin/toggle-queue with invalid token returns HTTP 401');
  assert(invalidTokenToggle.data.error === 'INVALID_SESSION', 'Error code is INVALID_SESSION');

  // Attempt with valid token
  const authQueueToggle = await dispatch('POST', '/api/admin/toggle-queue', undefined, {
    authorization: `Bearer ${loginToken}`
  });
  assert(authQueueToggle.status === 200, 'Calling /api/admin/toggle-queue with valid token succeeds (HTTP 200)');
  assert(typeof authQueueToggle.data.isQueueOpen === 'boolean', 'Queue status toggled successfully');

  // Attempt to add service without token
  const unauthServiceAdd = await dispatch('POST', '/api/services', { name: 'VIP Shave' }, {
    'x-test-require-auth': 'true'
  });
  assert(unauthServiceAdd.status === 401, 'POST /api/services without token returns HTTP 401');

  // Attempt to add service with valid token
  const authServiceAdd = await dispatch('POST', '/api/services', {
    name: 'VIP Shave Test',
    category: 'men',
    durationMinutes: 25,
    price: 200
  }, {
    authorization: `Bearer ${loginToken}`
  });
  assert(authServiceAdd.status === 201, 'POST /api/services with valid token succeeds (HTTP 201)');

  // 6. Password Change Flow
  console.log('\n--- 6. Owner Password Change Flow ---');
  // Wrong current password
  const badChange = await dispatch('POST', '/api/admin/auth/change-password', {
    currentPassword: 'WrongOldPassword',
    newPassword: 'BrandNewPassword2026'
  }, {
    authorization: `Bearer ${loginToken}`
  });
  assert(badChange.status === 400, 'Change password with incorrect current password returns HTTP 400');
  assert(badChange.data.error === 'INCORRECT_CURRENT_PASSWORD', 'Error code is INCORRECT_CURRENT_PASSWORD');

  // Correct password change
  const goodChange = await dispatch('POST', '/api/admin/auth/change-password', {
    currentPassword: 'OwnerSecurePass2026',
    newPassword: 'BrandNewPassword2026'
  }, {
    authorization: `Bearer ${loginToken}`
  });
  assert(goodChange.status === 200, 'Change password with correct current password succeeds (HTTP 200)');

  // Verify old password no longer works for login
  const oldPassLogin = await dispatch('POST', '/api/admin/auth/login', { password: 'OwnerSecurePass2026' });
  assert(oldPassLogin.status === 401, 'Old password no longer works after change (HTTP 401)');

  // Verify new password works for login
  const newPassLogin = await dispatch('POST', '/api/admin/auth/login', { password: 'BrandNewPassword2026' });
  assert(newPassLogin.status === 200, 'New password successfully authenticates (HTTP 200)');
  const newLoginToken = newPassLogin.data.token;

  // 7. Logout & Token Invalidation
  console.log('\n--- 7. Logout & Token Invalidation ---');
  const logoutRes = await dispatch('POST', '/api/admin/auth/logout', undefined, {
    authorization: `Bearer ${newLoginToken}`
  });
  assert(logoutRes.status === 200, 'POST /api/admin/auth/logout returns HTTP 200');

  // Subsequent request using revoked token fails
  const afterLogoutRequest = await dispatch('POST', '/api/admin/toggle-queue', undefined, {
    authorization: `Bearer ${newLoginToken}`
  });
  assert(afterLogoutRequest.status === 401, 'Revoked token is rejected on protected routes with HTTP 401');

  // 8. Front Desk Queue Toggle (Staff Access without Owner Password)
  console.log('\n--- 8. Front-Desk Staff Queue Toggle ---');
  const staffToggle = await dispatch('POST', '/api/queue/toggle');
  assert(staffToggle.status === 200, 'POST /api/queue/toggle succeeds for front-desk reception');

  console.log(`\n========================================`);
  console.log(`TOTAL ADMIN AUTH TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAdminAuthTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
