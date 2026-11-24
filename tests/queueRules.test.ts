import {
  PHONE_REGEX,
  validatePhoneNumber,
  validateCustomerName,
  validateServicesSelection,
  calculateTotalDuration,
  calculateTotalPrice,
  calculateRemainingChairTime,
  calculateGlobalWaitTime,
  calculateIndividualWaitTime,
  findActiveTicketByPhone,
  generateNextTokenId,
  checkQueueOperatingHours,
  isAllStylistsOnBreak
} from '../src/services/queueRules';
import { Service, Barber, QueueTicket } from '../src/types';

// Simple lightweight assertion runner
let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failed++;
    const msg = `  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`;
    console.error(msg);
    errors.push(msg);
  }
}

console.log('🧪 RUNNING TEST SUITE: Queue Rules & Algorithmic Specifications\n');

// 1. Phone validation
console.log('--- Test Group 1: Phone Validation ---');
assert(validatePhoneNumber('9825011111').isValid, 'Valid 10-digit starting with 9');
assert(validatePhoneNumber('8123456789').isValid, 'Valid 10-digit starting with 8');
assert(validatePhoneNumber('7000000000').isValid, 'Valid 10-digit starting with 7');
assert(validatePhoneNumber('6999999999').isValid, 'Valid 10-digit starting with 6');
assert(!validatePhoneNumber('5999999999').isValid, 'Reject 10-digit starting with 5 (Invalid Indian prefix)');
assert(!validatePhoneNumber('98765').isValid, 'Reject short phone (< 10 digits)');
assert(!validatePhoneNumber('987654321012').isValid, 'Reject long phone (> 10 digits)');
assert(!validatePhoneNumber('ABCDE12345').isValid, 'Reject alphanumeric phone');
assert(!validatePhoneNumber('').isValid, 'Reject empty phone');

// 2. Customer Name validation
console.log('\n--- Test Group 2: Customer Name Validation ---');
assert(validateCustomerName('Rahul Patel').isValid, 'Valid name: Rahul Patel');
assert(validateCustomerName('Om').isValid, 'Valid 2-character name');
assert(!validateCustomerName('A').isValid, 'Reject 1-character name');
assert(!validateCustomerName('   ').isValid, 'Reject whitespace-only name');

// 3. Service selection cap (1 to 3 services)
console.log('\n--- Test Group 3: Service Selection Cap ---');
const dummySrv1: Service = { id: 'srv-1', name: 'Haircut', nameGu: 'હેરકટ', durationMinutes: 30, price: 150, isActive: true };
const dummySrv2: Service = { id: 'srv-2', name: 'Beard Trim', nameGu: 'દાઢી ટ્રીમ', durationMinutes: 15, price: 80, isActive: true };
const dummySrv3: Service = { id: 'srv-3', name: 'Hair Spa', nameGu: 'હેર સ્પા', durationMinutes: 45, price: 400, isActive: true };
const dummySrv4: Service = { id: 'srv-4', name: 'Facial', nameGu: 'ફેશિયલ', durationMinutes: 40, price: 350, isActive: true };

assert(validateServicesSelection([dummySrv1]).isValid, '1 service is valid');
assert(validateServicesSelection([dummySrv1, dummySrv2]).isValid, '2 services is valid');
assert(validateServicesSelection([dummySrv1, dummySrv2, dummySrv3]).isValid, '3 services is valid (max allowed)');
assert(!validateServicesSelection([dummySrv1, dummySrv2, dummySrv3, dummySrv4]).isValid, '4 services is rejected (cap exceeded)');
assert(!validateServicesSelection([]).isValid, '0 services is rejected');

// 4. Multi-Service Pricing and Duration Calculation
console.log('\n--- Test Group 4: Total Price & Duration Math ---');
const selected2 = [dummySrv1, dummySrv2];
assert(calculateTotalDuration(selected2) === 45, 'Haircut (30m) + Beard Trim (15m) = 45m');
assert(calculateTotalPrice(selected2) === 230, 'Haircut (₹150) + Beard Trim (₹80) = ₹230');

// 5. Chair Remaining Time Math
console.log('\n--- Test Group 5: Chair Remaining Time Formula ---');
const freeBarber: Barber = { id: 'b-1', name: 'Ravi', station: 1, specialty: 'Stylist', status: 'Free', isOnDuty: true };
assert(calculateRemainingChairTime(freeBarber, []) === 0, 'Free barber remaining chair time is 0');

const inServiceBarber: Barber = { id: 'b-2', name: 'Amit', station: 2, specialty: 'Master', status: 'In Service', currentTicketId: 'T-1', isOnDuty: true };
const started18mAgo = new Date(Date.now() - 18 * 60000).toISOString();
const ticketT1: QueueTicket = {
  id: 'T-1',
  customerName: 'Kunal',
  phone: '9825011111',
  services: [dummySrv1], // 30 min duration
  preferredBarberId: 'b-2',
  assignedBarberId: 'b-2',
  status: 'In chair',
  createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
  startedAt: started18mAgo
};
const remainingTime = calculateRemainingChairTime(inServiceBarber, [ticketT1]);
assert(remainingTime === 12, `Remaining chair time: 30m - 18m elapsed = 12m (got ${remainingTime}m)`);

// 6. Global Queue Wait Time Formula
console.log('\n--- Test Group 6: Global Queue Wait Time Formula ---');
// Empty queue, no busy chairs -> 0 min
assert(calculateGlobalWaitTime([], [freeBarber]) === 0, 'Empty queue & free chairs = 0 min');

// 2 waiting tickets of 30m and 15m (total 45m) with 2 active barbers
const waitTicket1: QueueTicket = {
  id: 'T-2', customerName: 'Rahul', phone: '9825022222', services: [dummySrv1], preferredBarberId: 'any', status: 'Waiting', createdAt: new Date().toISOString()
};
const waitTicket2: QueueTicket = {
  id: 'T-3', customerName: 'Jayesh', phone: '9825033333', services: [dummySrv2], preferredBarberId: 'any', status: 'Waiting', createdAt: new Date().toISOString()
};
const barber1: Barber = { id: 'b-1', name: 'Ravi', station: 1, specialty: 'Senior', status: 'Free', isOnDuty: true };
const barber2: Barber = { id: 'b-2', name: 'Amit', station: 2, specialty: 'Senior', status: 'Free', isOnDuty: true };
const globalWait = calculateGlobalWaitTime([waitTicket1, waitTicket2], [barber1, barber2]);
// ceil(45 / 2) + 0 = 23 min
assert(globalWait === 23, `Global wait ceil(45/2) = 23 min (got ${globalWait} min)`);

// 7. Individual Wait Time: Any Barber vs Specific Barber
console.log('\n--- Test Group 7: Individual Wait Time Math ---');
// Case A: Customer chose 'any'
const anyWait = calculateIndividualWaitTime([waitTicket1, waitTicket2], [barber1, barber2], 'any', 'T-3');
// Ahead of T-3 is waitTicket1 (30m). Active barbers = 2. ceil(30 / 2) = 15m
assert(anyWait === 15, `Customer T-3 (Any) wait = 15m (got ${anyWait}m)`);

// Case B: Customer chose specific barber b-1
const specificWait = calculateIndividualWaitTime([waitTicket1, waitTicket2], [barber1, barber2], 'b-1', 'T-3');
// waitTicket1 chose 'any' (eligible for b-1) -> 30m ahead + 0 chair time = 30m
assert(specificWait === 30, `Customer T-3 (b-1) wait = 30m (got ${specificWait}m)`);

// Break penalty test: If barber is On Break, +15 min break penalty
const barberOnBreak: Barber = { id: 'b-1', name: 'Ravi', station: 1, specialty: 'Senior', status: 'On Break', isOnDuty: true };
const waitWithBreak = calculateIndividualWaitTime([waitTicket1, waitTicket2], [barberOnBreak, barber2], 'b-1', 'T-3');
assert(waitWithBreak === 45, `Barber on break adds +15m penalty: 30 + 15 = 45m (got ${waitWithBreak}m)`);

// 8. Phone duplicate check
console.log('\n--- Test Group 8: Single Active Spot per Phone ---');
const activeTickets: QueueTicket[] = [
  { id: 'T-1', customerName: 'Amit', phone: '9825012345', services: [dummySrv1], preferredBarberId: 'any', status: 'Waiting', createdAt: new Date().toISOString() },
  { id: 'T-2', customerName: 'Suresh', phone: '9825099999', services: [dummySrv1], preferredBarberId: 'any', status: 'Done', createdAt: new Date().toISOString() },
  { id: 'T-3', customerName: 'Ramesh', phone: '9825088888', services: [dummySrv1], preferredBarberId: 'any', status: 'Cancelled', createdAt: new Date().toISOString() },
  { id: 'T-4', customerName: 'Dinesh', phone: '9825077777', services: [dummySrv1], preferredBarberId: 'any', status: 'No-show', createdAt: new Date().toISOString() },
];
assert(findActiveTicketByPhone('9825012345', activeTickets) !== undefined, 'Phone holding "Waiting" ticket is recognized as active');
assert(findActiveTicketByPhone('+919825012345', activeTickets) !== undefined, 'Phone with +91 prefix matches 10-digit active spot');
assert(findActiveTicketByPhone('9825099999', activeTickets) === undefined, 'Phone with "Done" status is NOT active (can rejoin)');
assert(findActiveTicketByPhone('9825088888', activeTickets) === undefined, 'Phone with "Cancelled" status is NOT active (can rejoin)');
assert(findActiveTicketByPhone('9825077777', activeTickets) === undefined, 'Phone with "No-show" status is NOT active (can rejoin)');

// 9. Sequential Token Generation
console.log('\n--- Test Group 9: Sequential Token Generator ---');
assert(generateNextTokenId([]) === 'S-1', 'First ticket of day is S-1');
assert(generateNextTokenId([{ id: 'S-1' } as any, { id: 'S-2' } as any]) === 'S-3', 'Next token after S-2 is S-3');
assert(generateNextTokenId([{ id: 'S-14' } as any, { id: 'S-9' } as any]) === 'S-15', 'Next token after S-14 is S-15');

// 10. Queue Operating Hours & 30-min Cutoff
console.log('\n--- Test Group 10: Operating Hours & Pre-Closing Cutoff ---');
assert(checkQueueOperatingHours(false, '21:00').isOpen === false, 'Queue closed when isQueueOpen = false');
assert(checkQueueOperatingHours(true, 'off').isOpen === true, 'Queue open when cutoff is off');

// Dynamic test: 60 minutes ahead is open, 10 minutes ahead triggers cutoff
const nowTime = new Date();
const openHour = (nowTime.getHours() + 2) % 24;
const openTimeStr = `${String(openHour).padStart(2, '0')}:00`;
assert(checkQueueOperatingHours(true, openTimeStr).isOpen === true, 'Queue open when 2 hours before closing');

const cutoffMin = (nowTime.getMinutes() + 10) % 60;
const cutoffHour = nowTime.getHours();
const cutoffTimeStr = `${String(cutoffHour).padStart(2, '0')}:${String(cutoffMin).padStart(2, '0')}`;
assert(checkQueueOperatingHours(true, cutoffTimeStr).reason === 'cutoff_closed', 'Pre-closing cutoff detected within 30 min of closing');

// 11. All Stylists on Break check
console.log('\n--- Test Group 11: All Stylists on Break Detection ---');
const bBreak1: Barber = { id: 'b-1', name: 'Ravi', station: 1, specialty: 'Senior', status: 'On Break', isOnDuty: true };
const bBreak2: Barber = { id: 'b-2', name: 'Amit', station: 2, specialty: 'Master', status: 'On Break', isOnDuty: true };
assert(isAllStylistsOnBreak([bBreak1, bBreak2]) === true, 'True when all on-duty stylists are on break');
assert(isAllStylistsOnBreak([bBreak1, barber1]) === false, 'False when at least one stylist is free');

// Summary
console.log(`\n========================================`);
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
