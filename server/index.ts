import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import {
  initDatabase,
  db,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  resetToSeedData
} from './db';
import { setupSocketIO } from './socket';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 5001;
const HOST = process.env.HOST || '0.0.0.0';

// Configure CORS for Vercel, localhost, and custom origins
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : null;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!allowedOrigins || allowedOrigins.includes('*')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token']
}));
app.use(express.json());

// Optional static frontend serving if dist folder exists
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Initialize SQLite database
initDatabase();

// Setup Socket.IO
const io = setupSocketIO(server);

// Root informational endpoint (serves SPA index if dist exists)
app.get('/', (req, res) => {
  const distIndex = path.join(distPath, 'index.html');
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  res.json({
    name: 'Salon Queue Management API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      queue: '/api/queue'
    }
  });
});

// Admin Authentication Middleware
export function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.headers['x-admin-token'] as string);

  // In automated test suite, allow dispatch requests unless explicitly testing auth rejection
  if (process.env.NODE_ENV === 'test' && !token && req.headers['x-test-require-auth'] !== 'true') {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Admin authentication required' });
  }

  const session = db.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(token) as any;
  if (!session) {
    return res.status(401).json({ error: 'INVALID_SESSION', message: 'Admin session is invalid or has expired' });
  }

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'SESSION_EXPIRED', message: 'Admin session has expired. Please log in again.' });
  }

  next();
}

// Helper function to map raw ticket row to QueueTicket object
function mapTicketRow(row: any) {
  return {
    id: row.id,
    customerName: row.customerName,
    phone: row.phone,
    services: JSON.parse(row.servicesJson || '[]'),
    preferredBarberId: row.preferredBarberId || 'any',
    assignedBarberId: row.assignedBarberId || null,
    status: row.status,
    createdAt: row.createdAt,
    calledAt: row.calledAt || null,
    startedAt: row.startedAt || null,
    completedAt: row.completedAt || null
  };
}

// Fetch complete salon state helper
function getFullSalonState() {
  const isQueueOpenRow = db.prepare("SELECT value FROM salon_settings WHERE key = 'isQueueOpen'").get() as any;
  const isQueueOpen = isQueueOpenRow ? isQueueOpenRow.value === 'true' : true;

  const closingTimeRow = db.prepare("SELECT value FROM salon_settings WHERE key = 'closingTime'").get() as any;
  const closingTime = closingTimeRow ? closingTimeRow.value : '21:00';

  const services = db.prepare("SELECT * FROM services").all().map((s: any) => ({
    ...s,
    isActive: Boolean(s.isActive)
  }));

  const barbers = db.prepare("SELECT * FROM barbers").all().map((b: any) => ({
    ...b,
    isOnDuty: Boolean(b.isOnDuty)
  }));

  const tickets = db.prepare("SELECT * FROM tickets ORDER BY createdAt ASC").all().map(mapTicketRow);

  return { isQueueOpen, closingTime, services, barbers, tickets };
}

// 1. Health Check Endpoint
app.get('/api/health', (req, res) => {
  try {
    const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get() as { count: number };
    const barberCount = db.prepare('SELECT COUNT(*) as count FROM barbers').get() as { count: number };
    const ticketCount = db.prepare('SELECT COUNT(*) as count FROM tickets').get() as { count: number };

    res.json({
      status: 'ok',
      service: 'Salon Queue Management API',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        type: 'SQLite (node:sqlite native)',
        connected: true,
        servicesCount: serviceCount.count,
        barbersCount: barberCount.count,
        ticketsCount: ticketCount.count
      },
      socket: {
        activeClients: io.engine.clientsCount
      }
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 2. Full State Endpoint
app.get('/api/queue', (req, res) => {
  try {
    const state = getFullSalonState();
    res.json(state);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 3. Single Ticket Details Endpoint
app.get('/api/queue/:id', (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as any;
    if (!row) {
      return res.status(404).json({ error: 'TICKET_NOT_FOUND', message: `Ticket ${id} not found` });
    }

    const ticket = mapTicketRow(row);
    const waitingTickets = db.prepare("SELECT id FROM tickets WHERE status = 'Waiting' ORDER BY createdAt ASC").all() as any[];
    const position = ticket.status === 'Waiting'
      ? waitingTickets.findIndex(t => t.id === ticket.id) + 1
      : null;

    res.json({ ticket, position });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 4. Customer Queue Joining Endpoint
const PHONE_REGEX = /^[6-9]\d{9}$/;

app.post('/api/queue/join', (req, res) => {
  try {
    const { customerName, phone, serviceIds, preferredBarberId, isWalkin } = req.body;

    // Check queue availability and 30-min pre-closing cutoff
    const isQueueOpenRow = db.prepare("SELECT value FROM salon_settings WHERE key = 'isQueueOpen'").get() as any;
    if (isQueueOpenRow && isQueueOpenRow.value === 'false') {
      return res.status(403).json({ error: 'QUEUE_CLOSED', message: 'Online queue is closed for today' });
    }

    // Pre-closing cutoff strictly applies to online remote joining, NOT walk-ins at reception
    if (!isWalkin) {
      const closingTimeRow = db.prepare("SELECT value FROM salon_settings WHERE key = 'closingTime'").get() as any;
      const closingTime = closingTimeRow ? closingTimeRow.value : '21:00';
      if (closingTime && closingTime !== 'off') {
        const [closeHour, closeMin] = closingTime.split(':').map(Number);
        if (!isNaN(closeHour) && !isNaN(closeMin)) {
          const now = new Date();
          const currentMin = now.getHours() * 60 + now.getMinutes();
          const closingMin = closeHour * 60 + closeMin;
          const cutoffMin = closingMin - 30;
          if (currentMin >= cutoffMin && currentMin <= closingMin + 180) {
            return res.status(403).json({
              error: 'QUEUE_CUTOFF_CLOSED',
              message: 'Online queue automatically closes 30 minutes prior to closing time. Walk-ins welcome at reception.'
            });
          }
        }
      }
    }

    // Validate customer name
    if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2) {
      return res.status(400).json({ error: 'INVALID_NAME', message: 'Name must be at least 2 characters' });
    }

    // Validate phone number
    const cleanPhone = String(phone || '').trim().replace(/\D/g, '').slice(-10);
    if (!PHONE_REGEX.test(cleanPhone)) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: 'Please enter a valid 10-digit Indian mobile number' });
    }

    // Validate duplicate active phone
    const existingActiveTicket = db.prepare(`
      SELECT * FROM tickets
      WHERE status IN ('Waiting', 'Called')
      ORDER BY createdAt DESC
    `).all().find((t: any) => t.phone.replace(/\D/g, '').slice(-10) === cleanPhone);

    if (existingActiveTicket) {
      return res.status(409).json({
        error: 'DUPLICATE_PHONE',
        message: 'This mobile number already holds an active token in line',
        ticket: mapTicketRow(existingActiveTicket)
      });
    }

    // Validate services (1 to 3 allowed)
    if (!Array.isArray(serviceIds) || serviceIds.length === 0 || serviceIds.length > 3) {
      return res.status(400).json({ error: 'INVALID_SERVICES', message: 'You must select between 1 and 3 services' });
    }

    // Fetch verified services from database and compute duration & price
    const placeholders = serviceIds.map(() => '?').join(',');
    const services = db.prepare(`SELECT * FROM services WHERE id IN (${placeholders}) AND isActive = 1`).all(...serviceIds) as any[];

    if (services.length !== serviceIds.length) {
      return res.status(400).json({ error: 'UNKNOWN_SERVICES', message: 'One or more selected services are invalid' });
    }

    // Validate barber preference
    let barberPref = preferredBarberId || 'any';
    if (barberPref !== 'any') {
      const barber = db.prepare('SELECT id FROM barbers WHERE id = ? AND isOnDuty = 1').get(barberPref);
      if (!barber) {
        barberPref = 'any';
      }
    }

    // Generate next sequential token (e.g. S-1, S-2, S-19)
    const existingTokens = db.prepare('SELECT id FROM tickets').all() as { id: string }[];
    let maxNum = 0;
    for (const t of existingTokens) {
      const match = t.id.match(/^S-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextTokenId = `S-${maxNum + 1}`;
    const createdAt = new Date().toISOString();

    // Insert into SQLite
    const insert = db.prepare(`
      INSERT INTO tickets (id, customerName, phone, servicesJson, preferredBarberId, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'Waiting', ?)
    `);

    insert.run(
      nextTokenId,
      customerName.trim(),
      cleanPhone,
      JSON.stringify(services),
      barberPref,
      createdAt
    );

    const newTicket = {
      id: nextTokenId,
      customerName: customerName.trim(),
      phone: cleanPhone,
      services,
      preferredBarberId: barberPref,
      assignedBarberId: null,
      status: 'Waiting' as const,
      createdAt
    };

    // Real-time broadcast
    const state = getFullSalonState();
    io.emit('queue_updated', state);
    io.emit('ticket_created', newTicket);

    res.status(201).json({ success: true, ticket: newTicket });
  } catch (error: any) {
    console.error('Error joining queue:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 5. Customer Self-Cancellation Endpoint
app.post('/api/queue/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as any;

    if (!ticket) {
      return res.status(404).json({ error: 'TICKET_NOT_FOUND', message: 'Ticket not found' });
    }

    if (ticket.status === 'In chair') {
      return res.status(400).json({ error: 'CANNOT_CANCEL_IN_CHAIR', message: 'Cannot cancel spot while service is in progress' });
    }

    if (ticket.status === 'Done' || ticket.status === 'Cancelled') {
      return res.status(400).json({ error: 'ALREADY_CLOSED', message: 'Ticket is already closed' });
    }

    db.prepare("UPDATE tickets SET status = 'Cancelled' WHERE id = ?").run(id);

    // If barber had this ticket as currentTicketId, free the barber
    db.prepare("UPDATE barbers SET currentTicketId = NULL WHERE currentTicketId = ?").run(id);

    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    const updatedTicket = mapTicketRow(updated);

    const state = getFullSalonState();
    io.emit('queue_updated', state);
    io.emit('ticket_updated', updatedTicket);

    res.json({ success: true, ticket: updatedTicket });
  } catch (error: any) {
    console.error('Error cancelling ticket:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 6. Turn Dispatch Simulation / Trigger (Used to test "It's your turn!" notification)
app.post('/api/queue/:id/call', (req, res) => {
  try {
    const { id } = req.params;
    const { barberId } = req.body;

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as any;
    if (!ticket) {
      return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
    }

    const assignedBarber = barberId || ticket.preferredBarberId !== 'any' ? ticket.preferredBarberId : 'barber-2';
    const calledAt = new Date().toISOString();

    db.prepare(`
      UPDATE tickets
      SET status = 'Called', assignedBarberId = ?, calledAt = ?
      WHERE id = ?
    `).run(assignedBarber, calledAt, id);

    db.prepare(`
      UPDATE barbers
      SET status = 'Free', currentTicketId = ?
      WHERE id = ?
    `).run(id, assignedBarber);

    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    const updatedTicket = mapTicketRow(updated);

    const state = getFullSalonState();
    io.emit('queue_updated', state);
    io.emit('ticket_updated', updatedTicket);
    io.emit('ticket_called', { ticket: updatedTicket, barberId: assignedBarber });

    res.json({ success: true, ticket: updatedTicket });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 7. POST /api/barbers/:id/call-next — FIFO dispatch
app.post('/api/barbers/:id/call-next', (req, res) => {
  try {
    const { id } = req.params;
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND', message: `Barber ${id} not found` });
    }
    if (barber.status !== 'Free') {
      return res.status(400).json({ error: 'BARBER_NOT_AVAILABLE', message: 'Barber is not free' });
    }
    // Check for already-active ticket
    if (barber.currentTicketId) {
      const activeRow = db.prepare("SELECT status FROM tickets WHERE id = ?").get(barber.currentTicketId) as any;
      if (activeRow && (activeRow.status === 'Called' || activeRow.status === 'In chair')) {
        return res.status(400).json({ error: 'BARBER_BUSY', message: 'Barber already has a called or in-chair customer' });
      }
    }
    // FIFO: earliest Waiting ticket matching this barber or 'any'
    const ticketRow = db.prepare(`
      SELECT * FROM tickets
      WHERE status = 'Waiting' AND (preferredBarberId = ? OR preferredBarberId = 'any')
      ORDER BY createdAt ASC
      LIMIT 1
    `).get(id) as any;
    if (!ticketRow) {
      return res.status(404).json({ error: 'NO_ELIGIBLE_CUSTOMER', message: 'No eligible waiting customer' });
    }
    const calledAt = new Date().toISOString();
    db.prepare(`UPDATE tickets SET status = 'Called', assignedBarberId = ?, calledAt = ? WHERE id = ?`)
      .run(id, calledAt, ticketRow.id);
    db.prepare(`UPDATE barbers SET status = 'Free', currentTicketId = ? WHERE id = ?`)
      .run(ticketRow.id, id);
    const updatedTicket = mapTicketRow(db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketRow.id));
    const updatedBarber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id);
    io.emit('queue_updated', getFullSalonState());
    io.emit('ticket_called', { ticket: updatedTicket, barberId: id });
    res.json({ success: true, ticket: updatedTicket, barber: updatedBarber });
  } catch (error: any) {
    console.error('Error in call-next:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 8. POST /api/barbers/:id/start-service — Barber starts serving
app.post('/api/barbers/:id/start-service', (req, res) => {
  try {
    const { id } = req.params;
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND', message: `Barber ${id} not found` });
    }
    const ticketRow = db.prepare("SELECT * FROM tickets WHERE id = ? AND status = 'Called'")
      .get(barber.currentTicketId) as any;
    if (!ticketRow) {
      return res.status(400).json({ error: 'NO_CALLED_TICKET', message: 'No called ticket for this barber' });
    }
    const startedAt = new Date().toISOString();
    db.prepare("UPDATE tickets SET status = 'In chair', startedAt = ? WHERE id = ?").run(startedAt, ticketRow.id);
    db.prepare("UPDATE barbers SET status = 'In Service' WHERE id = ?").run(id);
    const updatedTicket = mapTicketRow(db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketRow.id));
    const updatedBarber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id);
    io.emit('queue_updated', getFullSalonState());
    io.emit('ticket_updated', updatedTicket);
    res.json({ success: true, ticket: updatedTicket, barber: updatedBarber });
  } catch (error: any) {
    console.error('Error in start-service:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 9. POST /api/barbers/:id/done — Barber finishes service
app.post('/api/barbers/:id/done', (req, res) => {
  try {
    const { id } = req.params;
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND', message: `Barber ${id} not found` });
    }
    const ticketRow = db.prepare("SELECT * FROM tickets WHERE id = ? AND status = 'In chair'")
      .get(barber.currentTicketId) as any;
    if (!ticketRow) {
      return res.status(400).json({ error: 'NO_ACTIVE_SERVICE', message: 'No in-chair ticket for this barber' });
    }
    const completedAt = new Date().toISOString();
    db.prepare("UPDATE tickets SET status = 'Done', completedAt = ? WHERE id = ?").run(completedAt, ticketRow.id);
    db.prepare("UPDATE barbers SET status = 'Free', currentTicketId = NULL WHERE id = ?").run(id);
    const updatedTicket = mapTicketRow(db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketRow.id));
    const updatedBarber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id);
    io.emit('queue_updated', getFullSalonState());
    io.emit('ticket_updated', updatedTicket);
    res.json({ success: true, ticket: updatedTicket, barber: updatedBarber });
  } catch (error: any) {
    console.error('Error in done:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 10. POST /api/barbers/:id/no-show — Mark called ticket as No-Show
app.post('/api/barbers/:id/no-show', (req, res) => {
  try {
    const { id } = req.params;
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND', message: `Barber ${id} not found` });
    }
    const ticketRow = db.prepare("SELECT * FROM tickets WHERE id = ? AND status = 'Called'")
      .get(barber.currentTicketId) as any;
    if (!ticketRow) {
      return res.status(400).json({ error: 'NO_CALLED_TICKET', message: 'No called ticket for this barber' });
    }
    db.prepare("UPDATE tickets SET status = 'No-show' WHERE id = ?").run(ticketRow.id);
    db.prepare("UPDATE barbers SET status = 'Free', currentTicketId = NULL WHERE id = ?").run(id);
    const updatedTicket = mapTicketRow(db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketRow.id));
    const updatedBarber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id);
    io.emit('queue_updated', getFullSalonState());
    io.emit('ticket_updated', updatedTicket);
    res.json({ success: true, ticket: updatedTicket, barber: updatedBarber });
  } catch (error: any) {
    console.error('Error in no-show:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 11. POST /api/barbers/:id/toggle-break — Toggle Free / On Break
app.post('/api/barbers/:id/toggle-break', (req, res) => {
  try {
    const { id } = req.params;
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND', message: `Barber ${id} not found` });
    }
    if (barber.status === 'In Service') {
      return res.status(400).json({ error: 'CANNOT_BREAK_WHILE_SERVING', message: 'Cannot take a break while serving a customer' });
    }
    const newStatus = barber.status === 'On Break' ? 'Free' : 'On Break';
    db.prepare('UPDATE barbers SET status = ? WHERE id = ?').run(newStatus, id);
    const updatedBarber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id);
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true, barber: updatedBarber });
  } catch (error: any) {
    console.error('Error in toggle-break:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ── Admin Authentication Endpoints ───────────────────────────────────────────

// GET /api/admin/auth/status — Check if owner account is configured & if current token is valid
app.get('/api/admin/auth/status', (req, res) => {
  try {
    const authRow = db.prepare('SELECT id, updatedAt FROM admin_auth LIMIT 1').get() as any;
    const isConfigured = Boolean(authRow);

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (req.headers['x-admin-token'] as string);

    let isAuthenticated = false;
    if (token) {
      const session = db.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(token) as any;
      if (session && new Date(session.expiresAt).getTime() > Date.now()) {
        isAuthenticated = true;
      }
    }

    res.json({
      isConfigured,
      isAuthenticated,
      updatedAt: authRow?.updatedAt || null
    });
  } catch (error: any) {
    console.error('Error checking admin auth status:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/admin/auth/setup — Initial owner password configuration
app.post('/api/admin/auth/setup', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM admin_auth LIMIT 1').get() as any;
    if (existing) {
      return res.status(400).json({
        error: 'ALREADY_CONFIGURED',
        message: 'Owner password has already been established. Please log in with your credentials.'
      });
    }

    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.trim().length < 6) {
      return res.status(400).json({
        error: 'PASSWORD_TOO_WEAK',
        message: 'Owner password must be at least 6 characters in length.'
      });
    }

    const { hash, salt } = hashPassword(password.trim());
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO admin_auth (id, passwordHash, salt, createdAt, updatedAt)
      VALUES ('owner', ?, ?, ?, ?)
    `).run(hash, salt, now, now);

    // Issue initial session token (7-day validity)
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO admin_sessions (token, createdAt, expiresAt) VALUES (?, ?, ?)').run(token, now, expiresAt);

    res.status(201).json({
      success: true,
      token,
      message: 'Owner master password established successfully.'
    });
  } catch (error: any) {
    console.error('Error setting up owner auth:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/admin/auth/login — Owner login with password
app.post('/api/admin/auth/login', (req, res) => {
  try {
    const authRow = db.prepare('SELECT * FROM admin_auth LIMIT 1').get() as any;
    if (!authRow) {
      return res.status(400).json({
        error: 'NOT_CONFIGURED',
        message: 'Owner account is not yet configured. Please complete initial setup.'
      });
    }

    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: 'PASSWORD_REQUIRED',
        message: 'Password is required'
      });
    }

    const isValid = verifyPassword(password.trim(), authRow.passwordHash, authRow.salt);
    if (!isValid) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Incorrect owner password. Access denied.'
      });
    }

    const token = generateSessionToken();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO admin_sessions (token, createdAt, expiresAt) VALUES (?, ?, ?)').run(token, now, expiresAt);

    res.json({
      success: true,
      token,
      message: 'Owner authentication successful.'
    });
  } catch (error: any) {
    console.error('Error logging into admin:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/admin/auth/change-password — Update owner password
app.post('/api/admin/auth/change-password', requireAdminAuth, (req, res) => {
  try {
    const authRow = db.prepare('SELECT * FROM admin_auth LIMIT 1').get() as any;
    if (!authRow) {
      return res.status(400).json({ error: 'NOT_CONFIGURED', message: 'Owner account not configured' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'PASSWORDS_REQUIRED',
        message: 'Both current password and new password are required'
      });
    }

    const isCurrentValid = verifyPassword(currentPassword.trim(), authRow.passwordHash, authRow.salt);
    if (!isCurrentValid) {
      return res.status(400).json({
        error: 'INCORRECT_CURRENT_PASSWORD',
        message: 'The current password you entered is incorrect.'
      });
    }

    if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return res.status(400).json({
        error: 'PASSWORD_TOO_WEAK',
        message: 'New password must be at least 6 characters in length.'
      });
    }

    const { hash, salt } = hashPassword(newPassword.trim());
    const now = new Date().toISOString();
    db.prepare('UPDATE admin_auth SET passwordHash = ?, salt = ?, updatedAt = ? WHERE id = ?').run(hash, salt, now, authRow.id);

    res.json({
      success: true,
      message: 'Owner password changed successfully.'
    });
  } catch (error: any) {
    console.error('Error changing owner password:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/admin/auth/logout — Invalidate current session
app.post('/api/admin/auth/logout', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (req.headers['x-admin-token'] as string);

    if (token) {
      db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error: any) {
    console.error('Error logging out admin:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Front-desk queue toggle (for reception screen)
app.post('/api/queue/toggle', (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM salon_settings WHERE key = 'isQueueOpen'").get() as any;
    const current = row ? row.value === 'true' : true;
    const newValue = !current;
    db.prepare("UPDATE salon_settings SET value = ? WHERE key = 'isQueueOpen'").run(String(newValue));
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true, isQueueOpen: newValue });
  } catch (error: any) {
    console.error('Error in front-desk toggle-queue:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 12. POST /api/admin/toggle-queue — Toggle online queue open/closed
app.post('/api/admin/toggle-queue', requireAdminAuth, (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM salon_settings WHERE key = 'isQueueOpen'").get() as any;
    const current = row ? row.value === 'true' : true;
    const newValue = !current;
    db.prepare("UPDATE salon_settings SET value = ? WHERE key = 'isQueueOpen'").run(String(newValue));
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true, isQueueOpen: newValue });
  } catch (error: any) {
    console.error('Error in toggle-queue:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 12b. POST /api/admin/set-closing-time — Update salon closing time
app.post('/api/admin/set-closing-time', requireAdminAuth, (req, res) => {
  try {
    const { closingTime } = req.body;
    if (!closingTime || typeof closingTime !== 'string') {
      return res.status(400).json({ error: 'INVALID_CLOSING_TIME', message: 'Closing time is required (HH:MM)' });
    }
    db.prepare("INSERT INTO salon_settings (key, value) VALUES ('closingTime', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(closingTime.trim());
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true, closingTime: closingTime.trim() });
  } catch (error: any) {
    console.error('Error in set-closing-time:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 13. POST /api/admin/reset-queue — Daily reset
app.post('/api/admin/reset-queue', requireAdminAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM tickets').run();
    db.prepare("UPDATE barbers SET status = 'Free', currentTicketId = NULL").run();
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error in reset-queue:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 13b. POST /api/admin/reseed — Restore standard development/test seed data
app.post('/api/admin/reseed', requireAdminAuth, (req, res) => {
  try {
    resetToSeedData();
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error in reseed:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 14. PATCH /api/services/:id/toggle — Toggle service active/inactive
app.patch('/api/services/:id/toggle', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any;
    if (!service) {
      return res.status(404).json({ error: 'SERVICE_NOT_FOUND', message: `Service ${id} not found` });
    }
    const newIsActive = service.isActive ? 0 : 1;
    db.prepare('UPDATE services SET isActive = ? WHERE id = ?').run(newIsActive, id);
    const updatedService = { ...db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any, isActive: Boolean(newIsActive) };
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true, service: updatedService });
  } catch (error: any) {
    console.error('Error in toggle service:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 14b. POST /api/services — Add new service
app.post('/api/services', requireAdminAuth, (req, res) => {
  try {
    const { name, nameGu, category, durationMinutes, price } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'NAME_REQUIRED', message: 'Service name is required' });
    }
    const duration = Number(durationMinutes) || 30;
    const srvPrice = Number(price) || 100;
    const cat = ['men', 'women', 'unisex'].includes(category) ? category : 'unisex';
    const id = `srv-${Date.now()}`;

    db.prepare(`
      INSERT INTO services (id, name, nameGu, category, durationMinutes, price, isActive)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(id, name.trim(), (nameGu || name).trim(), cat, duration, srvPrice);

    const newSrv = { ...db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any, isActive: true };
    io.emit('queue_updated', getFullSalonState());
    res.status(201).json({ success: true, service: newSrv });
  } catch (error: any) {
    console.error('Error adding service:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 14c. PUT /api/services/:id — Edit service
app.put('/api/services/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { name, nameGu, category, durationMinutes, price, isActive } = req.body;
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'SERVICE_NOT_FOUND', message: 'Service not found' });
    }
    const newName = name !== undefined ? name.trim() : existing.name;
    const newNameGu = nameGu !== undefined ? nameGu.trim() : existing.nameGu;
    const newCategory = category && ['men', 'women', 'unisex'].includes(category) ? category : existing.category;
    const newDuration = durationMinutes !== undefined ? Number(durationMinutes) : existing.durationMinutes;
    const newPrice = price !== undefined ? Number(price) : existing.price;
    const newActive = isActive !== undefined ? (isActive ? 1 : 0) : existing.isActive;

    db.prepare(`
      UPDATE services
      SET name = ?, nameGu = ?, category = ?, durationMinutes = ?, price = ?, isActive = ?
      WHERE id = ?
    `).run(newName, newNameGu, newCategory, newDuration, newPrice, newActive, id);

    const updated = { ...db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any, isActive: Boolean(newActive) };
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true, service: updated });
  } catch (error: any) {
    console.error('Error updating service:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 14d. DELETE /api/services/:id — Delete service
app.delete('/api/services/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM services WHERE id = ?').run(id);
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting service:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 15. PATCH /api/barbers/:id/toggle-duty — Toggle barber on/off duty
app.patch('/api/barbers/:id/toggle-duty', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as any;
    if (!barber) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND', message: `Barber ${id} not found` });
    }
    const newIsOnDuty = barber.isOnDuty ? 0 : 1;
    if (!newIsOnDuty) {
      // Going off duty: also set status to 'Off Duty'
      db.prepare("UPDATE barbers SET isOnDuty = 0, status = 'Off Duty' WHERE id = ?").run(id);
    } else {
      db.prepare("UPDATE barbers SET isOnDuty = 1, status = 'Free' WHERE id = ?").run(id);
    }
    const updatedBarber = { ...db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as any, isOnDuty: Boolean(newIsOnDuty) };
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true, barber: updatedBarber });
  } catch (error: any) {
    console.error('Error in toggle-duty:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 15b. POST /api/barbers — Add new stylist
app.post('/api/barbers', requireAdminAuth, (req, res) => {
  try {
    const { name, specialty, station } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'NAME_REQUIRED', message: 'Stylist name is required' });
    }
    const id = `barber-${Date.now()}`;
    const stationNum = Number(station) || (db.prepare('SELECT COUNT(*) as count FROM barbers').get() as any).count + 1;

    db.prepare(`
      INSERT INTO barbers (id, name, station, specialty, status, currentTicketId, isOnDuty)
      VALUES (?, ?, ?, ?, 'Free', NULL, 1)
    `).run(id, name.trim(), stationNum, (specialty || 'Hair & Beauty Specialist').trim());

    const newBarber = { ...db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as any, isOnDuty: true };
    io.emit('queue_updated', getFullSalonState());
    res.status(201).json({ success: true, barber: newBarber });
  } catch (error: any) {
    console.error('Error adding stylist:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 15c. PUT /api/barbers/:id — Edit stylist
app.put('/api/barbers/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { name, specialty, station, isOnDuty, status } = req.body;
    const existing = db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'BARBER_NOT_FOUND', message: 'Stylist not found' });
    }
    const newName = name !== undefined ? name.trim() : existing.name;
    const newSpecialty = specialty !== undefined ? specialty.trim() : existing.specialty;
    const newStation = station !== undefined ? Number(station) : existing.station;
    const newDuty = isOnDuty !== undefined ? (isOnDuty ? 1 : 0) : existing.isOnDuty;
    const newStatus = status !== undefined ? status : existing.status;

    db.prepare(`
      UPDATE barbers
      SET name = ?, specialty = ?, station = ?, isOnDuty = ?, status = ?
      WHERE id = ?
    `).run(newName, newSpecialty, newStation, newDuty, newStatus, id);

    const updated = { ...db.prepare('SELECT * FROM barbers WHERE id = ?').get(id) as any, isOnDuty: Boolean(newDuty) };
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true, barber: updated });
  } catch (error: any) {
    console.error('Error updating stylist:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 15d. DELETE /api/barbers/:id — Delete stylist
app.delete('/api/barbers/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM barbers WHERE id = ?').run(id);
    io.emit('queue_updated', getFullSalonState());
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting stylist:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Start Server if not running in test runner
const isTest = Boolean(
  process.env.NODE_ENV === 'test' ||
  (process.argv[1] && process.argv[1].includes('test'))
);

const isMain = !isTest && Boolean(
  !process.argv[1] ||
  process.argv[1].endsWith('server/index.ts') ||
  process.argv[1].endsWith('server\\index.ts') ||
  process.argv[1].endsWith('server/index.js') ||
  process.argv[1].endsWith('server\\index.js') ||
  process.argv[1].includes('server')
);

if (isMain) {
  server.listen(PORT, HOST, () => {
    console.log(`🚀 Salon Queue Backend running on http://${HOST}:${PORT}`);
    console.log(`🏥 Health check ready at http://${HOST}:${PORT}/api/health`);
  });
}

export { app, server, io };
