process.env.NODE_ENV = 'test';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { app } from '../server/index';
import { db, resetToSeedData } from '../server/db';

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

// In-process Express route dispatcher (no network socket required, works in sandbox)
function dispatch(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    
    // Create mock stream for request
    const req = Object.assign(new Readable({
      read() {
        if (bodyStr) {
          this.push(bodyStr);
        }
        this.push(null);
      }
    }), {
      method,
      url: path,
      headers: {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(bodyStr)),
        host: 'localhost'
      },
      connection: new EventEmitter()
    });

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

async function runAllTests() {
  console.log('🧪 RUNNING COMPREHENSIVE E2E & FLOW VERIFICATION TEST SUITE (IN-PROCESS)\n');

  try {
    // Reset DB to standard seed state defined in Section 9 of docs/03-flows-rules.md
    resetToSeedData();
    // ----------------------------------------------------
    // TEST INITIAL DB STATE & HEALTH CHECK
    // ----------------------------------------------------
    console.log('--- 1. Initial State & Health Check ---');
    const health = await dispatch('GET', '/api/health');
    assert(health.status === 200, 'GET /api/health returns HTTP 200');
    assert(health.data.database.connected === true, 'SQLite Database connected natively via node:sqlite');
    assert(health.data.database.barbersCount >= 3, 'Default 3 stylists seeded');
    assert(health.data.database.servicesCount >= 4, 'Default services seeded');

    const initialState = await dispatch('GET', '/api/queue');
    assert(initialState.status === 200, 'GET /api/queue returns full salon state');
    assert(Array.isArray(initialState.data.tickets), 'Queue tickets list is an array');

    // Ensure queue is OPEN and closing cutoff is off during validation testing
    await dispatch('POST', '/api/admin/set-closing-time', { closingTime: 'off' });
    const settingsRow = db.prepare("SELECT value FROM salon_settings WHERE key = 'isQueueOpen'").get() as any;
    if (settingsRow?.value === 'false') {
      await dispatch('POST', '/api/admin/toggle-queue');
    }

    // ----------------------------------------------------
    // TC-01 & TC-02: MULTI-SERVICE SELECTION & 3-SERVICE CAP
    // ----------------------------------------------------
    console.log('\n--- 2. TC-01 & TC-02: Service Selection Cap & Pricing ---');
    // Attempt to join with 4 services (Cap is 3)
    const capTest = await dispatch('POST', '/api/queue/join', {
      customerName: 'Test Cap',
      phone: '9825000001',
      serviceIds: ['srv-1', 'srv-2', 'srv-3', 'srv-4'],
      preferredBarberId: 'any'
    });
    assert(capTest.status === 400, 'TC-02: 4th service selection blocked with HTTP 400');
    assert(capTest.data.error === 'INVALID_SERVICES', 'TC-02: Error code is INVALID_SERVICES');

    // Attempt to join with 0 services
    const zeroSrvTest = await dispatch('POST', '/api/queue/join', {
      customerName: 'Test Zero',
      phone: '9825000002',
      serviceIds: [],
      preferredBarberId: 'any'
    });
    assert(zeroSrvTest.status === 400, '0 services selection blocked with HTTP 400');

    // ----------------------------------------------------
    // TC-03: PHONE NUMBER VALIDATION
    // ----------------------------------------------------
    console.log('\n--- 3. TC-03: Phone Number Validation ---');
    const shortPhoneTest = await dispatch('POST', '/api/queue/join', {
      customerName: 'Test Short Phone',
      phone: '98765',
      serviceIds: ['srv-1'],
      preferredBarberId: 'any'
    });
    assert(shortPhoneTest.status === 400, 'TC-03: Short phone rejected with HTTP 400');
    assert(shortPhoneTest.data.error === 'INVALID_PHONE', 'TC-03: Error code is INVALID_PHONE');

    const alphaPhoneTest = await dispatch('POST', '/api/queue/join', {
      customerName: 'Test Alpha Phone',
      phone: 'ABCDE12345',
      serviceIds: ['srv-1'],
      preferredBarberId: 'any'
    });
    assert(alphaPhoneTest.status === 400, 'TC-03: Alphanumeric phone rejected with HTTP 400');

    const invalidPrefixPhone = await dispatch('POST', '/api/queue/join', {
      customerName: 'Test Invalid Prefix',
      phone: '5123456789',
      serviceIds: ['srv-1'],
      preferredBarberId: 'any'
    });
    assert(invalidPrefixPhone.status === 400, 'TC-03: Phone not starting with 6-9 rejected with HTTP 400');

    // ----------------------------------------------------
    // TC-04: DUPLICATE PHONE NUMBER BLOCK
    // ----------------------------------------------------
    console.log('\n--- 4. TC-04: Duplicate Phone Number Block ---');
    // Rahul Patel has phone 9825033333 in Waiting state (S-14)
    const dupTest = await dispatch('POST', '/api/queue/join', {
      customerName: 'Rahul Patel Second Attempt',
      phone: '9825033333',
      serviceIds: ['srv-1'],
      preferredBarberId: 'any'
    });
    assert(dupTest.status === 409, 'TC-04: Duplicate active phone blocked with HTTP 409 Conflict');
    assert(dupTest.data.error === 'DUPLICATE_PHONE', 'TC-04: Error code is DUPLICATE_PHONE');
    assert(dupTest.data.ticket && dupTest.data.ticket.id === 'S-14', 'TC-04: Response points customer to their existing active token S-14');

    // ----------------------------------------------------
    // TC-05: STRICT BARBER PREFERENCE FILTERING
    // ----------------------------------------------------
    console.log('\n--- 5. TC-05: Strict Barber Preference Filtering ---');
    // Amit (barber-2) initially has S-13 in 'Called' status.
    // Finish S-13 so Amit becomes free
    await dispatch('POST', '/api/barbers/barber-2/start-service');
    await dispatch('POST', '/api/barbers/barber-2/done');

    const barberAmitCheck = db.prepare("SELECT * FROM barbers WHERE id = 'barber-2'").get() as any;
    assert(barberAmitCheck.status === 'Free' && barberAmitCheck.currentTicketId === null, 'Amit is now Free with empty chair');

    // S-14: preferredBarberId = 'any'
    // S-15: preferredBarberId = 'barber-1' (Ravi)
    // S-16: preferredBarberId = 'any'

    // Amit calls next -> Amit should get S-14 ('any')
    const amitCall1 = await dispatch('POST', '/api/barbers/barber-2/call-next');
    assert(amitCall1.status === 200, 'Amit calls next successfully');
    assert(amitCall1.data.ticket.id === 'S-14', 'Amit called earliest eligible ticket S-14');

    // Finish S-14 so Amit becomes Free again
    await dispatch('POST', '/api/barbers/barber-2/start-service');
    await dispatch('POST', '/api/barbers/barber-2/done');

    // NOW: Earliest ticket in queue is S-15 (Suresh Kumar), who explicitly requested 'barber-1' (Ravi).
    // Behind S-15 is S-16 (Hardik Pandya), who chose 'any'.
    // CRITICAL RULE: When Amit clicks Call Next, Amit MUST SKIP S-15 and call S-16!
    const amitCall2 = await dispatch('POST', '/api/barbers/barber-2/call-next');
    assert(amitCall2.status === 200, 'Amit calls next while S-15 is for Ravi');
    assert(amitCall2.data.ticket.id === 'S-16', 'TC-05 STRICT LOYALTY: Amit SKIPPED S-15 (Ravi) and called S-16 (Any)!');

    // Verify S-15 is STILL in Waiting status reserved for Ravi
    const s15Row = db.prepare("SELECT * FROM tickets WHERE id = 'S-15'").get() as any;
    assert(s15Row.status === 'Waiting' && s15Row.preferredBarberId === 'barber-1', 'TC-05: Customer S-15 remains waiting strictly for Barber Ravi');

    // ----------------------------------------------------
    // TC-08: BARBER STATION LIFECYCLE (Start -> Done)
    // ----------------------------------------------------
    console.log('\n--- 6. TC-08: Barber Station Lifecycle (Start -> Done) ---');
    // S-16 is currently Called to Amit
    const startServiceRes = await dispatch('POST', '/api/barbers/barber-2/start-service');
    assert(startServiceRes.status === 200, 'POST /api/barbers/barber-2/start-service succeeds');
    assert(startServiceRes.data.ticket.status === 'In chair', 'Ticket status transitioned: Called -> In chair');
    assert(startServiceRes.data.barber.status === 'In Service', 'Barber status transitioned: Free -> In Service');

    const doneServiceRes = await dispatch('POST', '/api/barbers/barber-2/done');
    assert(doneServiceRes.status === 200, 'POST /api/barbers/barber-2/done succeeds');
    assert(doneServiceRes.data.ticket.status === 'Done', 'Ticket status transitioned: In chair -> Done');
    assert(doneServiceRes.data.barber.status === 'Free', 'Barber status transitioned: In Service -> Free');
    assert(doneServiceRes.data.barber.currentTicketId === null, 'Chair freed immediately on completion');

    // ----------------------------------------------------
    // TC-09: NO-SHOW & LATE ARRIVAL RULE
    // ----------------------------------------------------
    console.log('\n--- 7. TC-09: No-Show Policy & Late Arrival Walk-in ---');
    // Amit calls next customer: S-17 chose Imran (barber-3), so Amit skips S-17 and calls S-18 (Any)
    const amitCall3 = await dispatch('POST', '/api/barbers/barber-2/call-next');
    assert(amitCall3.status === 200 && amitCall3.data.ticket.id === 'S-18', 'Amit called S-18');

    // Mark S-18 as No-Show
    const noshowRes = await dispatch('POST', '/api/barbers/barber-2/no-show');
    assert(noshowRes.status === 200, 'POST /api/barbers/barber-2/no-show succeeds');
    assert(noshowRes.data.ticket.status === 'No-show', 'Ticket S-18 marked as No-show');
    assert(noshowRes.data.barber.status === 'Free', 'Barber chair freed immediately after no-show');

    // Customer S-18 phone: 9825077777 arrives late as walk-in.
    // LATE ARRIVAL RULE: Customer CANNOT regain old position; must be appended to the END with a NEW token!
    const lateWalkinRes = await dispatch('POST', '/api/queue/join', {
      customerName: 'Chirag Joshi Late Walkin',
      phone: '9825077777',
      serviceIds: ['srv-1'],
      preferredBarberId: 'any',
      isWalkin: true
    });
    assert(lateWalkinRes.status === 201, 'Late arrival permitted to rejoin with a new ticket');
    assert(lateWalkinRes.data.ticket.id !== 'S-18', `TC-09: Late customer gets a NEW token: ${lateWalkinRes.data.ticket.id}`);

    // Verify it was appended to the end of the waiting queue
    const waitingListAfter = db.prepare("SELECT id FROM tickets WHERE status = 'Waiting' ORDER BY createdAt ASC").all() as any[];
    const lastWaiting = waitingListAfter[waitingListAfter.length - 1];
    assert(lastWaiting.id === lateWalkinRes.data.ticket.id, 'TC-09: Late customer appended strictly to the VERY END of the line (FIFO)');

    // ----------------------------------------------------
    // TC-10: ONLINE QUEUE CLOSING SWITCH & CUTOFF RULE
    // ----------------------------------------------------
    console.log('\n--- 8. TC-10: Master Online Queue Switch & Cutoff Rule ---');
    // Toggle queue to closed
    await dispatch('POST', '/api/admin/toggle-queue');
    const joinClosedAttempt = await dispatch('POST', '/api/queue/join', {
      customerName: 'Denied Customer',
      phone: '9825099999',
      serviceIds: ['srv-1'],
      preferredBarberId: 'any'
    });
    assert(joinClosedAttempt.status === 403, 'TC-10: Joining closed queue rejected with HTTP 403 Forbidden');
    assert(joinClosedAttempt.data.error === 'QUEUE_CLOSED', 'TC-10: Error code is QUEUE_CLOSED');

    // Reopen queue
    await dispatch('POST', '/api/admin/toggle-queue');
    const reopenCheck = db.prepare("SELECT value FROM salon_settings WHERE key = 'isQueueOpen'").get() as any;
    assert(reopenCheck.value === 'true', 'Master queue toggled back to OPEN');

    // Test 30-min pre-closing cutoff explicitly:
    // Set closing time to 10 minutes in the future (within 30m cutoff)
    const now = new Date();
    const futureCloseHour = now.getHours();
    const futureCloseMin = (now.getMinutes() + 10) % 60;
    const futureCloseStr = `${String(futureCloseHour).padStart(2, '0')}:${String(futureCloseMin).padStart(2, '0')}`;
    await dispatch('POST', '/api/admin/set-closing-time', { closingTime: futureCloseStr });

    // Online customer attempt (isWalkin: false) -> blocked with QUEUE_CUTOFF_CLOSED
    const cutoffAttempt = await dispatch('POST', '/api/queue/join', {
      customerName: 'Late Online Customer',
      phone: '9825099988',
      serviceIds: ['srv-1'],
      preferredBarberId: 'any',
      isWalkin: false
    });
    assert(cutoffAttempt.status === 403 && cutoffAttempt.data.error === 'QUEUE_CUTOFF_CLOSED', 'Section 6.1 Cutoff: Online customer blocked 30m prior to closing');

    // Walk-in attempt at reception desk (isWalkin: true) -> permitted!
    const walkinDuringCutoff = await dispatch('POST', '/api/queue/join', {
      customerName: 'Reception Desk Walkin',
      phone: '9825099977',
      serviceIds: ['srv-1'],
      preferredBarberId: 'any',
      isWalkin: true
    });
    assert(walkinDuringCutoff.status === 201, 'Section 6.1 Cutoff: Desk walk-in customer is allowed at reception discretion');

    // Restore closing time
    await dispatch('POST', '/api/admin/set-closing-time', { closingTime: '21:00' });

    // ----------------------------------------------------
    // TC-12: STATE MACHINE IMMUTABILITY (FORBIDDEN TRANSITIONS)
    // ----------------------------------------------------
    console.log('\n--- 9. TC-12: State Machine Immutability & Access Checks ---');
    // Cannot cancel an In-chair ticket
    // S-12 is currently in chair with Ravi
    const cancelInChair = await dispatch('POST', '/api/queue/S-12/cancel');
    assert(cancelInChair.status === 400, 'Cannot cancel ticket while in chair (HTTP 400)');
    assert(cancelInChair.data.error === 'CANNOT_CANCEL_IN_CHAIR', 'Error code CANNOT_CANCEL_IN_CHAIR returned');

    // Cannot cancel an already Done ticket
    const cancelDone = await dispatch('POST', '/api/queue/S-13/cancel');
    assert(cancelDone.status === 400, 'Cannot cancel a Done ticket (HTTP 400)');
    assert(cancelDone.data.error === 'ALREADY_CLOSED', 'Error code ALREADY_CLOSED returned');

    // Customer self-cancellation on Waiting ticket works
    const cancelWaiting = await dispatch('POST', '/api/queue/S-15/cancel');
    assert(cancelWaiting.status === 200, 'Customer successfully self-cancels Waiting ticket S-15');
    assert(cancelWaiting.data.ticket.status === 'Cancelled', 'Status transitioned to Cancelled');

    // ----------------------------------------------------
    // TC-14: BARBER BREAK LOGIC
    // ----------------------------------------------------
    console.log('\n--- 10. TC-14: Stylist Break Management ---');
    // Ravi is currently In Service with S-12 -> cannot take break
    const raviBreakAttempt = await dispatch('POST', '/api/barbers/barber-1/toggle-break');
    assert(raviBreakAttempt.status === 400, 'Cannot take break while actively serving a customer');
    assert(raviBreakAttempt.data.error === 'CANNOT_BREAK_WHILE_SERVING', 'Error code CANNOT_BREAK_WHILE_SERVING returned');

    // Amit is Free -> can toggle break
    const amitBreakOn = await dispatch('POST', '/api/barbers/barber-2/toggle-break');
    assert(amitBreakOn.status === 200, 'Free stylist successfully toggles break');
    assert(amitBreakOn.data.barber.status === 'On Break', 'Barber status is now On Break');

    // Amit toggles break again -> returns to Free
    const amitBreakOff = await dispatch('POST', '/api/barbers/barber-2/toggle-break');
    assert(amitBreakOff.status === 200, 'Stylist ends break');
    assert(amitBreakOff.data.barber.status === 'Free', 'Barber status returns to Free');

    // ----------------------------------------------------
    // SQLITE PERSISTENCE VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- 11. SQLite Database Persistence Verification ---');
    const dbTicketCount = (db.prepare('SELECT COUNT(*) as count FROM tickets').get() as any).count;
    const dbBarberCount = (db.prepare('SELECT COUNT(*) as count FROM barbers').get() as any).count;
    const dbServiceCount = (db.prepare('SELECT COUNT(*) as count FROM services').get() as any).count;

    assert(dbTicketCount > 0, `Tickets persisted in SQLite table: ${dbTicketCount} rows`);
    assert(dbBarberCount >= 3, `Stylists persisted in SQLite table: ${dbBarberCount} rows`);
    assert(dbServiceCount >= 4, `Services persisted in SQLite table: ${dbServiceCount} rows`);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`TOTAL E2E TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    console.error('Test Failures Summary:');
    failures.forEach(f => console.error(f));
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
