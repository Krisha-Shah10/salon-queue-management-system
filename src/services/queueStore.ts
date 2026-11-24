import { useState, useEffect } from 'react';
import { Service, Barber, QueueTicket, SalonState } from '../types';
import { socket } from './socket';

const STORAGE_KEY = 'salon_queue_state_v1';
const BROADCAST_CHANNEL_NAME = 'salon_queue_broadcast_v1';

// Standard Default Services (Unisex Salon with Men's, Women's, and Unisex categories)
export const DEFAULT_SERVICES: Service[] = [
  // --- Men's Category ---
  { id: 'srv-1', name: 'Men’s Classic Haircut & Styling', nameGu: 'મેન્સ ક્લાસિક હેરકટ અને સ્ટાઇલિંગ', category: 'men', durationMinutes: 30, price: 180, isActive: true },
  { id: 'srv-2', name: 'Beard Sculpting, Trim & Oil Finish', nameGu: 'દાઢી ટ્રીમ, શેપ અને ઓઇલ ફિનિશ', category: 'men', durationMinutes: 20, price: 100, isActive: true },
  { id: 'srv-6', name: 'Classic Hot Towel Shave & Balm', nameGu: 'ક્લાસિક હોટ ટોવેલ શેવ અને બામ', category: 'men', durationMinutes: 25, price: 120, isActive: true },
  { id: 'srv-7', name: 'Men’s Charcoal Clean-up & Detan Pack', nameGu: 'મેન્સ ચારકોલ ક્લીન-અપ અને ડી-ટેન', category: 'men', durationMinutes: 30, price: 250, isActive: true },
  { id: 'srv-8', name: 'Men’s Hair Colour & Grey Blending', nameGu: 'મેન્સ હેર કલર અને ગ્રે બ્લેન્ડિંગ', category: 'men', durationMinutes: 35, price: 350, isActive: true },

  // --- Women's Category ---
  { id: 'srv-9', name: 'Women’s Precision Haircut & Blow-dry', nameGu: 'વિમેન્સ પ્રિસિઝન હેરકટ અને બ્લો-ડ્રાય', category: 'women', durationMinutes: 45, price: 350, isActive: true },
  { id: 'srv-10', name: 'Eyebrow Threading & Upper Lip Grooming', nameGu: 'આઈબ્રો થ્રેડિંગ અને અપર લિપ', category: 'women', durationMinutes: 15, price: 60, isActive: true },
  { id: 'srv-11', name: 'Full Arms & Full Legs Rica Waxing', nameGu: 'ફુલ આર્મ્સ અને લેગ્સ રિકા વેક્સિંગ', category: 'women', durationMinutes: 45, price: 450, isActive: true },
  { id: 'srv-12', name: 'Underarms Aloe Vera Waxing', nameGu: 'અંડરઆર્મ્સ એલોવેરા વેક્સિંગ', category: 'women', durationMinutes: 15, price: 100, isActive: true },
  { id: 'srv-13', name: 'Radiance Diamond Facial with Steam', nameGu: 'રેડિયન્સ ડાયમંડ ફેશિયલ અને સ્ટીમ', category: 'women', durationMinutes: 50, price: 650, isActive: true },
  { id: 'srv-14', name: 'Keratin Hair Smoothening & Gloss', nameGu: 'કેરાટિન હેર સ્મૂધનિંગ અને ગ્લોસ', category: 'women', durationMinutes: 60, price: 800, isActive: true },

  // --- Unisex Category ---
  { id: 'srv-3', name: 'Royal Hair Spa & Deep Scalp Therapy', nameGu: 'રોયલ હેર સ્પા અને સ્કેલ્પ થેરાપી', category: 'unisex', durationMinutes: 45, price: 450, isActive: true },
  { id: 'srv-4', name: 'Deep Cleansing Herbal Gold Facial', nameGu: 'ડીપ ક્લીન્સિંગ હર્બલ ગોલ્ડ ફેશિયલ', category: 'unisex', durationMinutes: 40, price: 400, isActive: true },
  { id: 'srv-5', name: 'Express Manicure & Hand Care', nameGu: 'એક્સપ્રેસ મેનિક્યોર અને હેન્ડ કેર', category: 'unisex', durationMinutes: 30, price: 300, isActive: true },
  { id: 'srv-15', name: 'Deluxe Pedicure & Foot Reflexology', nameGu: 'ડીલક્સ પેડિક્યોર અને ફૂટ મસાજ', category: 'unisex', durationMinutes: 45, price: 400, isActive: true },
  { id: 'srv-16', name: 'Stress Relief Head & Shoulder Massage', nameGu: 'હેડ, નેક અને શોલ્ડર રિલેક્સિંગ મસાજ', category: 'unisex', durationMinutes: 25, price: 250, isActive: true },
  { id: 'srv-17', name: 'O3+ Instant Detan & Radiance Pack', nameGu: 'O3+ ઇન્સ્ટન્ટ ડી-ટેન ફેસ પેક', category: 'unisex', durationMinutes: 25, price: 300, isActive: true }
];

// Standard 3 Stylists
export const DEFAULT_BARBERS: Barber[] = [
  { id: 'barber-1', name: 'Ravi', station: 1, specialty: 'Senior Stylist & Colour Specialist', status: 'In Service', currentTicketId: 'S-12', isOnDuty: true },
  { id: 'barber-2', name: 'Priya', station: 2, specialty: 'Hair Spa & Skin Care Expert', status: 'Free', currentTicketId: 'S-13', isOnDuty: true },
  { id: 'barber-3', name: 'Zara', station: 3, specialty: 'Precision Cuts & Blow-dry Artist', status: 'On Break', currentTicketId: null, isOnDuty: true }
];

// Default initial seed tickets
export const DEFAULT_TICKETS: QueueTicket[] = [
  {
    id: 'S-12',
    customerName: 'Kunal Mehta',
    phone: '9825011111',
    services: [DEFAULT_SERVICES[0]],
    preferredBarberId: 'barber-1',
    assignedBarberId: 'barber-1',
    status: 'In chair',
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
    calledAt: new Date(Date.now() - 20 * 60000).toISOString(),
    startedAt: new Date(Date.now() - 18 * 60000).toISOString(),
  },
  {
    id: 'S-13',
    customerName: 'Ananya Shah',
    phone: '9825022222',
    services: [DEFAULT_SERVICES[5]],
    preferredBarberId: 'barber-2',
    assignedBarberId: 'barber-2',
    status: 'Called',
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    calledAt: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: 'S-14',
    customerName: 'Rahul Patel',
    phone: '9825033333',
    services: [DEFAULT_SERVICES[0], DEFAULT_SERVICES[1]],
    preferredBarberId: 'any',
    status: 'Waiting',
    createdAt: new Date(Date.now() - 24 * 60000).toISOString(),
  },
  {
    id: 'S-15',
    customerName: 'Meera Desai',
    phone: '9825044444',
    services: [DEFAULT_SERVICES[0]],
    preferredBarberId: 'barber-1',
    status: 'Waiting',
    createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
  },
  {
    id: 'S-16',
    customerName: 'Pooja Sharma',
    phone: '9825055555',
    services: [DEFAULT_SERVICES[2]],
    preferredBarberId: 'any',
    status: 'Waiting',
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 'S-17',
    customerName: 'Arjun Nair',
    phone: '9825066666',
    services: [DEFAULT_SERVICES[1]],
    preferredBarberId: 'barber-3',
    status: 'Waiting',
    createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 'S-18',
    customerName: 'Sneha Joshi',
    phone: '9825077777',
    services: [DEFAULT_SERVICES[0]],
    preferredBarberId: 'any',
    status: 'Waiting',
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
  }
];

function getInitialState(): SalonState {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.services) && Array.isArray(parsed.barbers)) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load state from localStorage:', e);
  }

  return {
    isQueueOpen: true,
    closingTime: '21:00',
    services: DEFAULT_SERVICES,
    barbers: DEFAULT_BARBERS,
    tickets: DEFAULT_TICKETS
  };
}

let globalState: SalonState = getInitialState();
const listeners = new Set<(state: SalonState) => void>();

// Multi-tab sync via BroadcastChannel
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  broadcastChannel.onmessage = (event) => {
    if (event.data && typeof event.data === 'object') {
      globalState = event.data;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
      }
      listeners.forEach(fn => fn(globalState));
    }
  };
}

export function saveState(nextState: SalonState) {
  globalState = nextState;
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalState));
    }
    if (broadcastChannel) {
      broadcastChannel.postMessage(globalState);
    }
  } catch (e) {
    console.warn('Failed to persist salon state:', e);
  }
  listeners.forEach(fn => fn(globalState));
}

// Socket.IO event listeners for real-time backend synchronization
if (typeof window !== 'undefined') {
  socket.on('queue_updated', (updatedState: SalonState) => {
    if (updatedState && Array.isArray(updatedState.tickets)) {
      saveState(updatedState);
    }
  });

  socket.on('ticket_updated', (updatedTicket: QueueTicket) => {
    const nextTickets = globalState.tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t);
    saveState({
      ...globalState,
      tickets: nextTickets
    });
  });

  socket.on('ticket_created', (newTicket: QueueTicket) => {
    if (!globalState.tickets.some(t => t.id === newTicket.id)) {
      saveState({
        ...globalState,
        tickets: [...globalState.tickets, newTicket]
      });
    }
  });

  // Fetch initial state from backend API on page load
  fetch('/api/queue')
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && Array.isArray(data.tickets)) {
        saveState(data);
      }
    })
    .catch(() => {
      // Backend not reached, keep localStorage state
    });
}

export function useQueueStore(): [SalonState, (updater: (prev: SalonState) => SalonState) => void] {
  const [state, setState] = useState<SalonState>(globalState);

  useEffect(() => {
    const handleChange = (newState: SalonState) => {
      setState({ ...newState });
    };
    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  const updateState = (updater: (prev: SalonState) => SalonState) => {
    const next = updater(globalState);
    saveState(next);
  };

  return [state, updateState];
}

/**
 * Join Queue API Call with offline fallback
 */
export async function joinQueueApi(payload: {
  customerName: string;
  phone: string;
  services: Service[];
  preferredBarberId: string;
  isWalkin?: boolean;
}): Promise<{ success: boolean; ticket?: QueueTicket; error?: string; existingTicket?: QueueTicket }> {
  try {
    const res = await fetch('/api/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: payload.customerName,
        phone: payload.phone,
        serviceIds: payload.services.map(s => s.id),
        preferredBarberId: payload.preferredBarberId,
        isWalkin: payload.isWalkin
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'JOIN_FAILED',
        existingTicket: data.ticket
      };
    }

    if (data.ticket) {
      // Update local store immediately
      const nextTickets = [...globalState.tickets.filter(t => t.id !== data.ticket.id), data.ticket];
      saveState({
        ...globalState,
        tickets: nextTickets
      });
      return { success: true, ticket: data.ticket };
    }
  } catch (err) {
    console.warn('Backend API unavailable, using local store queue generator:', err);
  }

  // Fallback for standalone multi-window prototype
  const nextTokenId = `S-${globalState.tickets.length + 12}`;
  const newTicket: QueueTicket = {
    id: nextTokenId,
    customerName: payload.customerName,
    phone: payload.phone,
    services: payload.services,
    preferredBarberId: payload.preferredBarberId,
    status: 'Waiting',
    createdAt: new Date().toISOString()
  };

  saveState({
    ...globalState,
    tickets: [...globalState.tickets, newTicket]
  });

  return { success: true, ticket: newTicket };
}

/**
 * Cancel Ticket API Call with offline fallback
 */
export async function cancelTicketApi(ticketId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/queue/${ticketId}/cancel`, {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ticket) {
        const nextTickets = globalState.tickets.map(t => t.id === ticketId ? data.ticket : t);
        saveState({
          ...globalState,
          tickets: nextTickets
        });
        return true;
      }
    }
  } catch (err) {
    console.warn('Backend cancel API unavailable, updating locally:', err);
  }

  // Fallback local update
  const nextTickets = globalState.tickets.map(t => {
    if (t.id === ticketId) {
      return { ...t, status: 'Cancelled' as const };
    }
    return t;
  });
  saveState({
    ...globalState,
    tickets: nextTickets
  });
  return true;
}
