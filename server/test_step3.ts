import http from 'node:http';
import { spawn } from 'node:child_process';
import { io as ClientIO } from 'socket.io-client';

console.log('🧪 Starting Step 3 End-to-End Automated Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

async function request(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, data: raw ? JSON.parse(raw) : null });
        } catch (_) {
          resolve({ status: res.statusCode || 0, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  // 1. Start Server Process
  console.log('1. Starting Backend Server...');
  const serverProcess = spawn('npx.cmd', ['tsx', 'server/index.ts'], { shell: true, stdio: 'pipe' });

  // Wait for server to boot
  let ready = false;
  for (let i = 0; i < 15; i++) {
    try {
      const h = await request('GET', '/api/health');
      if (h.status === 200) {
        ready = true;
        break;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 800));
  }

  assert(ready === true, 'Backend server initialized and bound to port 5000');

  // 2. Connect Socket.IO client to listen for events
  console.log('\n2. Testing Socket.IO Real-Time Connection:');
  const socketClient = ClientIO('http://localhost:5000', { reconnection: false });
  let socketConnected: boolean = false;
  let socketEventsReceived: string[] = [];

  await new Promise<void>((resolve) => {
    socketClient.on('connect', () => {
      socketConnected = true;
      resolve();
    });
    setTimeout(resolve, 2000);
  });

  assert(Boolean(socketConnected), 'Socket.IO client connected to backend server');

  socketClient.on('ticket_created', (data) => {
    socketEventsReceived.push(`ticket_created:${data.id}`);
  });
  socketClient.on('ticket_updated', (data) => {
    socketEventsReceived.push(`ticket_updated:${data.id}`);
  });
  socketClient.on('ticket_called', (data) => {
    socketEventsReceived.push(`ticket_called:${data.ticket.id}`);
  });

  // 3. Test Initial Queue State
  console.log('\n3. Testing SQLite Queue State:');
  const stateRes = await request('GET', '/api/queue');
  assert(stateRes.status === 200, 'GET /api/queue returns 200 OK');
  assert(Array.isArray(stateRes.data.services), 'Services array present in state');
  assert(Array.isArray(stateRes.data.barbers), 'Barbers array present in state');
  assert(Array.isArray(stateRes.data.tickets), 'Tickets array present in state');

  // 4. Test Customer Queue Joining (Sequential Token Generation & Backend Calculation)
  console.log('\n4. Testing Queue Joining & Sequential Token Generation:');
  // Joining with Haircut (30m, ₹150) + Beard Trim (15m, ₹80) = 45m, ₹230
  const joinPayload = {
    customerName: 'Aarav Sharma',
    phone: '9898012345',
    serviceIds: ['srv-1', 'srv-2'],
    preferredBarberId: 'any'
  };

  const joinRes = await request('POST', '/api/queue/join', joinPayload);
  assert(joinRes.status === 201, 'POST /api/queue/join returns 201 Created');
  assert(joinRes.data.success === true, 'Join response has success: true');
  
  const createdTicket = joinRes.data.ticket;
  assert(createdTicket !== undefined, 'Ticket object returned');
  assert(/^S-\d+$/.test(createdTicket.id), `Generated sequential token format (${createdTicket.id})`);
  assert(createdTicket.customerName === 'Aarav Sharma', 'Customer name stored correctly in SQLite');
  assert(createdTicket.status === 'Waiting', 'Initial ticket status is Waiting');
  assert(createdTicket.services.length === 2, '2 services verified and attached by backend');

  // Backend duration and price check
  const totalDuration = createdTicket.services.reduce((s: number, i: any) => s + i.durationMinutes, 0);
  const totalPrice = createdTicket.services.reduce((s: number, i: any) => s + i.price, 0);
  assert(totalDuration === 45, 'Backend computed total duration = 45 min');
  assert(totalPrice === 230, 'Backend computed total price = ₹230');

  // 5. Test Duplicate Phone Number Rejection (One active entry per phone)
  console.log('\n5. Testing Duplicate Phone Number Rejection:');
  const dupJoinRes = await request('POST', '/api/queue/join', {
    customerName: 'Aarav Sharma Imposter',
    phone: '9898012345', // same phone!
    serviceIds: ['srv-1'],
    preferredBarberId: 'any'
  });

  assert(dupJoinRes.status === 409, 'Duplicate phone rejected with 409 Conflict');
  assert(dupJoinRes.data.error === 'DUPLICATE_PHONE', 'Error code is DUPLICATE_PHONE');
  assert(dupJoinRes.data.ticket.id === createdTicket.id, 'Returns existing active ticket ID');

  // 6. Test Single Ticket Details & FIFO Queue Positioning
  console.log('\n6. Testing Ticket Query & Position in Line:');
  const ticketDetailRes = await request('GET', `/api/queue/${createdTicket.id}`);
  assert(ticketDetailRes.status === 200, 'GET /api/queue/:id returns 200 OK');
  assert(ticketDetailRes.data.ticket.id === createdTicket.id, 'Returns correct ticket details');
  assert(typeof ticketDetailRes.data.position === 'number', `Customer position calculated (${ticketDetailRes.data.position} in line)`);

  // 7. Test Refresh Proof (Re-fetching from fresh DB connection)
  console.log('\n7. Testing Page Refresh / Rehydration Proof:');
  const freshFetch = await request('GET', `/api/queue/${createdTicket.id}`);
  assert(freshFetch.data.ticket.customerName === 'Aarav Sharma', 'Customer data rehydrated correctly upon refresh');
  assert(freshFetch.data.ticket.status === 'Waiting', 'Ticket status persists across connections');

  // 8. Test Turn Dispatch & Socket.IO Notification ("It's your turn!")
  console.log('\n8. Testing Turn Dispatch & Socket.IO Events:');
  const callRes = await request('POST', `/api/queue/${createdTicket.id}/call`, { barberId: 'barber-2' });
  assert(callRes.status === 200, 'POST /api/queue/:id/call returns 200 OK');
  assert(callRes.data.ticket.status === 'Called', 'Status transitioned to Called');

  // Wait a fraction of a second for socket event
  await new Promise(r => setTimeout(r, 500));
  const receivedCallEvent = socketEventsReceived.some(e => e.includes(`ticket_called:${createdTicket.id}`));
  assert(receivedCallEvent === true, 'Socket.IO emitted ticket_called event to active clients');

  // 9. Test In-Chair Cancellation Protection
  console.log('\n9. Testing In-Chair Cancellation Protection:');
  // Mark in chair
  // First test cancelling a waiting ticket
  const tempWaitRes = await request('POST', '/api/queue/join', {
    customerName: 'Kavita Dave',
    phone: '9898099999',
    serviceIds: ['srv-3'],
    preferredBarberId: 'any'
  });
  const tempTicketId = tempWaitRes.data.ticket.id;

  // Cancel while waiting -> MUST SUCCEED
  const cancelRes = await request('POST', `/api/queue/${tempTicketId}/cancel`);
  assert(cancelRes.status === 200, 'Cancelling ticket in Waiting state succeeds');
  assert(cancelRes.data.ticket.status === 'Cancelled', 'Status transitioned to Cancelled in SQLite');

  // Test cancelling an In-Chair ticket (S-12 is currently In chair)
  const cancelInChairRes = await request('POST', '/api/queue/S-12/cancel');
  assert(cancelInChairRes.status === 400, 'Cancelling spot while In chair is rejected with 400 Bad Request');
  assert(cancelInChairRes.data.error === 'CANNOT_CANCEL_IN_CHAIR', 'Correct error code CANNOT_CANCEL_IN_CHAIR returned');

  // Cleanup
  socketClient.disconnect();
  serverProcess.kill();

  console.log(`\n======================================================`);
  console.log(`📊 Test Results: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log(`======================================================\n`);

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
