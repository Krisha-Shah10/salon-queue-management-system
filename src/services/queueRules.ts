import { Service, Barber, QueueTicket } from '../types';

/**
 * SINGLE SOURCE OF TRUTH for Salon Queue Calculations and Validations.
 * Adheres strictly to docs/03-flows-rules.md
 */

// Phone number validation: Exactly 10 digits starting with 6, 7, 8, or 9
export const PHONE_REGEX = /^[6-9]\d{9}$/;

export function validatePhoneNumber(phone: string): { isValid: boolean; errorKey?: string } {
  const cleanPhone = phone.trim().replace(/\D/g, '');
  if (!cleanPhone) {
    return { isValid: false, errorKey: 'err_phone_required' };
  }
  if (!PHONE_REGEX.test(cleanPhone)) {
    return { isValid: false, errorKey: 'err_phone_invalid' };
  }
  return { isValid: true };
}

export function validateCustomerName(name: string): { isValid: boolean; errorKey?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, errorKey: 'err_name_required' };
  }
  if (trimmed.length < 2) {
    return { isValid: false, errorKey: 'err_name_short' };
  }
  return { isValid: true };
}

export function validateServicesSelection(services: Service[]): { isValid: boolean; errorKey?: string } {
  if (!services || services.length === 0) {
    return { isValid: false, errorKey: 'err_services_required' };
  }
  if (services.length > 3) {
    return { isValid: false, errorKey: 'err_services_max' };
  }
  return { isValid: true };
}

export function calculateTotalDuration(services: Service[]): number {
  return services.reduce((sum, s) => sum + s.durationMinutes, 0);
}

export function calculateTotalPrice(services: Service[]): number {
  return services.reduce((sum, s) => sum + s.price, 0);
}

/**
 * Estimates remaining minutes for a customer currently in the chair.
 * If start time is missing, defaults to 50% of total service duration.
 */
export function calculateRemainingChairTime(barber: Barber, tickets: QueueTicket[]): number {
  if (barber.status !== 'In Service' || !barber.currentTicketId) {
    return 0;
  }
  const currentTicket = tickets.find(t => t.id === barber.currentTicketId && t.status === 'In chair');
  if (!currentTicket) {
    return 0;
  }

  const totalDuration = calculateTotalDuration(currentTicket.services);
  if (currentTicket.startedAt) {
    const elapsedMinutes = Math.floor((Date.now() - new Date(currentTicket.startedAt).getTime()) / 60000);
    return Math.max(1, totalDuration - elapsedMinutes);
  }
  return Math.ceil(totalDuration / 2);
}

/**
 * Checks if all on-duty stylists are currently on break
 */
export function isAllStylistsOnBreak(barbers: Barber[]): boolean {
  const onDuty = barbers.filter(b => b.isOnDuty);
  return onDuty.length > 0 && onDuty.every(b => b.status === 'On Break');
}

/**
 * Checks salon queue operating status and 30-minute pre-closing cutoff
 * (Section 6.1: Online queue joining automatically closes 30 minutes prior to closing time)
 */
export function checkQueueOperatingHours(isQueueOpen: boolean, closingTime: string = '21:00'): {
  isOpen: boolean;
  reason?: 'manual_closed' | 'cutoff_closed';
} {
  if (!isQueueOpen) {
    return { isOpen: false, reason: 'manual_closed' };
  }
  if (closingTime && closingTime !== 'off') {
    const parts = closingTime.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const closingMin = parts[0] * 60 + parts[1];
      const cutoffMin = closingMin - 30; // 30 minutes prior to closing
      if (currentMin >= cutoffMin && currentMin <= closingMin + 180) {
        return { isOpen: false, reason: 'cutoff_closed' };
      }
    }
  }
  return { isOpen: true };
}

/**
 * Global Queue Wait Time (for Home Screen Hero Card)
 * Formula: ceil( sum(Duration of Waiting) / ActiveBarbers ) + AvgRemainingChairTime
 */
export function calculateGlobalWaitTime(tickets: QueueTicket[], barbers: Barber[]): number {
  const waitingTickets = tickets.filter(t => t.status === 'Waiting');
  if (waitingTickets.length === 0) {
    // If no one is waiting, check if any barber is serving
    const busyBarbers = barbers.filter(b => b.isOnDuty && b.status === 'In Service');
    if (busyBarbers.length === 0) return 0;
    // If all chairs busy but 0 waiting, wait is min remaining chair time
    const remainingTimes = busyBarbers.map(b => calculateRemainingChairTime(b, tickets));
    return remainingTimes.length > 0 ? Math.min(...remainingTimes) : 0;
  }

  const activeBarbers = barbers.filter(b => b.isOnDuty && b.status !== 'Off Duty' && b.status !== 'On Break');
  const activeCount = Math.max(1, activeBarbers.length);

  const totalWaitingMinutes = waitingTickets.reduce((sum, t) => sum + calculateTotalDuration(t.services), 0);
  
  // Calculate average remaining chair time of currently busy barbers
  const busyBarbers = barbers.filter(b => b.isOnDuty && b.status === 'In Service');
  let avgChairTime = 0;
  if (busyBarbers.length > 0) {
    const totalChairRemaining = busyBarbers.reduce((sum, b) => sum + calculateRemainingChairTime(b, tickets), 0);
    avgChairTime = Math.ceil(totalChairRemaining / busyBarbers.length);
  }

  return Math.ceil(totalWaitingMinutes / activeCount) + avgChairTime;
}

/**
 * Calculates personalized wait time for a specific customer or prospective ticket.
 */
export function calculateIndividualWaitTime(
  tickets: QueueTicket[],
  barbers: Barber[],
  preferredBarberId: string,
  targetTicketId?: string
): number {
  const waitingTickets = tickets.filter(t => t.status === 'Waiting');

  // Determine subset of tickets ahead
  let ticketsAhead = waitingTickets;
  if (targetTicketId) {
    const index = waitingTickets.findIndex(t => t.id === targetTicketId);
    ticketsAhead = index >= 0 ? waitingTickets.slice(0, index) : waitingTickets;
  }

  const activeBarbers = barbers.filter(b => b.isOnDuty && b.status !== 'Off Duty' && b.status !== 'On Break');
  const activeCount = Math.max(1, activeBarbers.length);

  // Case A: Customer chose 'Any Barber (Fastest)'
  if (!preferredBarberId || preferredBarberId === 'any') {
    if (ticketsAhead.length === 0) {
      // Check if any barber is currently free
      const freeBarber = barbers.find(b => b.isOnDuty && b.status === 'Free');
      if (freeBarber) return 0; // Immediate walk-in

      // All busy, wait is minimum remaining chair time
      const busyBarbers = barbers.filter(b => b.isOnDuty && b.status === 'In Service');
      if (busyBarbers.length === 0) return 0;
      const minRemaining = Math.min(...busyBarbers.map(b => calculateRemainingChairTime(b, tickets)));
      return Math.max(1, minRemaining);
    }

    const minutesAhead = ticketsAhead.reduce((sum, t) => sum + calculateTotalDuration(t.services), 0);
    const busyBarbers = barbers.filter(b => b.isOnDuty && b.status === 'In Service');
    const avgChairTime = busyBarbers.length > 0
      ? Math.ceil(busyBarbers.reduce((sum, b) => sum + calculateRemainingChairTime(b, tickets), 0) / busyBarbers.length)
      : 0;

    return Math.ceil(minutesAhead / activeCount) + avgChairTime;
  }

  // Case B: Specific Barber chosen
  const targetBarber = barbers.find(b => b.id === preferredBarberId);
  if (!targetBarber || !targetBarber.isOnDuty) {
    return 30; // fallback default
  }

  // Count tickets ahead assigned or eligible for this barber
  const relevantAhead = ticketsAhead.filter(
    t => t.preferredBarberId === preferredBarberId || t.preferredBarberId === 'any'
  );

  const minutesAheadForBarber = relevantAhead.reduce((sum, t) => sum + calculateTotalDuration(t.services), 0);
  const chairTime = calculateRemainingChairTime(targetBarber, tickets);
  const breakPenalty = targetBarber.status === 'On Break' ? 15 : 0;

  const total = minutesAheadForBarber + chairTime + breakPenalty;
  return total > 0 ? total : 0;
}

/**
 * Checks if a phone number already holds an active spot ('Waiting' or 'Called')
 * Matches against the last 10 digits to handle optional country code (+91)
 */
export function findActiveTicketByPhone(phone: string, tickets: QueueTicket[]): QueueTicket | undefined {
  const digits = phone.trim().replace(/\D/g, '');
  if (digits.length < 10) return undefined;
  const last10 = digits.slice(-10);
  return tickets.find(
    t => t.phone.replace(/\D/g, '').slice(-10) === last10 && (t.status === 'Waiting' || t.status === 'Called')
  );
}

/**
 * Generates next sequential daily token ID (e.g. S-1, S-2, S-14)
 */
export function generateNextTokenId(tickets: QueueTicket[]): string {
  if (tickets.length === 0) return 'S-1';
  let maxNum = 0;
  for (const t of tickets) {
    const match = t.id.match(/^S-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `S-${maxNum + 1}`;
}
