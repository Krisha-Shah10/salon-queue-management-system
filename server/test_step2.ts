import {
  validatePhoneNumber,
  validateCustomerName,
  validateServicesSelection,
  calculateTotalDuration,
  calculateTotalPrice,
  calculateIndividualWaitTime,
  calculateGlobalWaitTime,
  findActiveTicketByPhone,
  generateNextTokenId
} from '../src/services/queueRules';
import { DEFAULT_SERVICES, DEFAULT_BARBERS, DEFAULT_TICKETS } from '../src/services/queueStore';

console.log('🧪 Starting Step 2 Automated Test Suite...\n');

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

// 1. Test Customer Name Validation
console.log('1. Customer Name Validation:');
assert(validateCustomerName('').isValid === false, 'Rejects empty name');
assert(validateCustomerName(' ').isValid === false, 'Rejects whitespace name');
assert(validateCustomerName('A').isValid === false, 'Rejects single character name');
assert(validateCustomerName('Rahul Patel').isValid === true, 'Accepts valid full name');
assert(validateCustomerName('JD').isValid === true, 'Accepts 2-character name');

// 2. Test Phone Number Validation
console.log('\n2. Phone Number Validation (10 digits starting with 6-9):');
assert(validatePhoneNumber('').isValid === false, 'Rejects empty phone');
assert(validatePhoneNumber('12345').isValid === false, 'Rejects 5 digits');
assert(validatePhoneNumber('5876543210').isValid === false, 'Rejects 10 digits starting with 5');
assert(validatePhoneNumber('9876543210').isValid === true, 'Accepts 10 digits starting with 9');
assert(validatePhoneNumber('8123456789').isValid === true, 'Accepts 10 digits starting with 8');
assert(validatePhoneNumber('7001122334').isValid === true, 'Accepts 10 digits starting with 7');
assert(validatePhoneNumber('6398765432').isValid === true, 'Accepts 10 digits starting with 6');
assert(validatePhoneNumber('98765432101').isValid === false, 'Rejects 11 digits');
assert(validatePhoneNumber('98765ABCD0').isValid === false, 'Rejects letters in phone number');

// 3. Test Service Selection & 3-Service Limit
console.log('\n3. Service Selection & Max 3 Limit:');
assert(validateServicesSelection([]).isValid === false, 'Rejects 0 selected services');
assert(validateServicesSelection([DEFAULT_SERVICES[0]]).isValid === true, 'Accepts 1 service');
assert(validateServicesSelection([DEFAULT_SERVICES[0], DEFAULT_SERVICES[1]]).isValid === true, 'Accepts 2 services');
assert(validateServicesSelection([DEFAULT_SERVICES[0], DEFAULT_SERVICES[1], DEFAULT_SERVICES[2]]).isValid === true, 'Accepts 3 services');
assert(validateServicesSelection([DEFAULT_SERVICES[0], DEFAULT_SERVICES[1], DEFAULT_SERVICES[2], DEFAULT_SERVICES[3]]).isValid === false, 'Rejects 4 services (Cap Enforced)');

// 4. Test Price & Duration Calculations
console.log('\n4. Price & Duration Calculations:');
// Haircut (30m, ₹150) + Beard Trim (15m, ₹80)
const pair = [DEFAULT_SERVICES[0], DEFAULT_SERVICES[1]];
assert(calculateTotalDuration(pair) === 45, 'Haircut (30m) + Beard (15m) = 45 minutes');
assert(calculateTotalPrice(pair) === 230, 'Haircut (₹150) + Beard (₹80) = ₹230');

// Haircut (30m, ₹150) + Beard (15m, ₹80) + Hair Spa (45m, ₹400)
const trio = [DEFAULT_SERVICES[0], DEFAULT_SERVICES[1], DEFAULT_SERVICES[2]];
assert(calculateTotalDuration(trio) === 90, 'Trio duration sum = 90 minutes');
assert(calculateTotalPrice(trio) === 630, 'Trio price sum = ₹630');

// 5. Test Barber Wait Time Calculations
console.log('\n5. Barber Selection & Wait-Time Math:');
const globalWait = calculateGlobalWaitTime(DEFAULT_TICKETS, DEFAULT_BARBERS);
assert(globalWait > 0, `Global wait calculates positive duration (${globalWait} min)`);

const anyWait = calculateIndividualWaitTime(DEFAULT_TICKETS, DEFAULT_BARBERS, 'any');
assert(anyWait > 0, `Any Barber wait calculates correctly (~${anyWait} min)`);

const raviWait = calculateIndividualWaitTime(DEFAULT_TICKETS, DEFAULT_BARBERS, 'barber-1');
assert(raviWait > 0, `Barber Ravi wait calculates correctly (~${raviWait} min)`);

const imranWait = calculateIndividualWaitTime(DEFAULT_TICKETS, DEFAULT_BARBERS, 'barber-3');
assert(imranWait > 0, `Barber Imran (On Break) wait calculates with penalty (~${imranWait} min)`);

// 6. Test Duplicate Phone Detection
console.log('\n6. Duplicate Phone Detection:');
// S-14 has phone 9825033333 and status Waiting
const dup = findActiveTicketByPhone('9825033333', DEFAULT_TICKETS);
assert(dup !== undefined && dup.id === 'S-14', 'Identifies active phone 9825033333 as Token S-14');

const cleanFormatDup = findActiveTicketByPhone('+91 98250-33333', DEFAULT_TICKETS);
assert(cleanFormatDup !== undefined && cleanFormatDup.id === 'S-14', 'Detects duplicate even with spaces/dashes');

const nonDup = findActiveTicketByPhone('9999999999', DEFAULT_TICKETS);
assert(nonDup === undefined, 'Allows non-existent phone number');

// 7. Test Token Generation
console.log('\n7. Next Token Generation:');
const nextToken = generateNextTokenId(DEFAULT_TICKETS);
assert(nextToken === 'S-19', `Generates next token S-19 correctly (got: ${nextToken})`);

console.log(`\n========================================`);
console.log(`📊 Test Results: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log(`========================================\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
