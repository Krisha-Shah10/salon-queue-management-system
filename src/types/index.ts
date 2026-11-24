export type TicketStatus = 'Waiting' | 'Called' | 'In chair' | 'Done' | 'Cancelled' | 'No-show';

export type BarberStatus = 'Free' | 'In Service' | 'On Break' | 'Off Duty';

export type ServiceCategory = 'men' | 'women' | 'unisex';

export interface Service {
  id: string;
  name: string;
  nameGu: string;
  category?: ServiceCategory;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface Barber {
  id: string;
  name: string;
  station: number;
  specialty: string;
  status: BarberStatus;
  currentTicketId?: string | null;
  isOnDuty: boolean;
}

export interface QueueTicket {
  id: string;           // e.g. "S-14"
  customerName: string;
  phone: string;
  services: Service[];
  preferredBarberId: string; // barber ID or 'any'
  assignedBarberId?: string | null;
  status: TicketStatus;
  createdAt: string;    // ISO timestamp
  calledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface SalonState {
  isQueueOpen: boolean;
  closingTime: string; // e.g. "21:00"
  services: Service[];
  barbers: Barber[];
  tickets: QueueTicket[];
}
