import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Determine database file path with persistent volume support (Render Persistent Disks, Docker, etc.)
const defaultDataDir = path.resolve(process.cwd(), 'server', 'data');
const customDbPath = process.env.DATABASE_PATH;
const customDataDir = process.env.DATA_DIR;

const dbPath = customDbPath
  ? path.resolve(customDbPath)
  : customDataDir
  ? path.join(path.resolve(customDataDir), 'salon.db')
  : path.join(defaultDataDir, 'salon.db');

const targetDir = path.dirname(dbPath);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

export const DEFAULT_INDIAN_SERVICES = [
  // --- Men's Category ---
  { id: 'srv-1', name: 'Men’s Classic Haircut & Styling', nameGu: 'મેન્સ ક્લાસિક હેરકટ અને સ્ટાઇલિંગ', category: 'men', durationMinutes: 30, price: 180 },
  { id: 'srv-2', name: 'Beard Sculpting, Trim & Oil Finish', nameGu: 'દાઢી ટ્રીમ, શેપ અને ઓઇલ ફિનિશ', category: 'men', durationMinutes: 20, price: 100 },
  { id: 'srv-6', name: 'Classic Hot Towel Shave & Balm', nameGu: 'ક્લાસિક હોટ ટોવેલ શેવ અને બામ', category: 'men', durationMinutes: 25, price: 120 },
  { id: 'srv-7', name: 'Men’s Charcoal Clean-up & Detan Pack', nameGu: 'મેન્સ ચારકોલ ક્લીન-અપ અને ડી-ટેન', category: 'men', durationMinutes: 30, price: 250 },
  { id: 'srv-8', name: 'Men’s Hair Colour & Grey Blending', nameGu: 'મેન્સ હેર કલર અને ગ્રે બ્લેન્ડિંગ', category: 'men', durationMinutes: 35, price: 350 },

  // --- Women's Category ---
  { id: 'srv-9', name: 'Women’s Precision Haircut & Blow-dry', nameGu: 'વિમેન્સ પ્રિસિઝન હેરકટ અને બ્લો-ડ્રાય', category: 'women', durationMinutes: 45, price: 350 },
  { id: 'srv-10', name: 'Eyebrow Threading & Upper Lip Grooming', nameGu: 'આઈબ્રો થ્રેડિંગ અને અપર લિપ', category: 'women', durationMinutes: 15, price: 60 },
  { id: 'srv-11', name: 'Full Arms & Full Legs Rica Waxing', nameGu: 'ફુલ આર્મ્સ અને લેગ્સ રિકા વેક્સિંગ', category: 'women', durationMinutes: 45, price: 450 },
  { id: 'srv-12', name: 'Underarms Aloe Vera Waxing', nameGu: 'અંડરઆર્મ્સ એલોવેરા વેક્સિંગ', category: 'women', durationMinutes: 15, price: 100 },
  { id: 'srv-13', name: 'Radiance Diamond Facial with Steam', nameGu: 'રેડિયન્સ ડાયમંડ ફેશિયલ અને સ્ટીમ', category: 'women', durationMinutes: 50, price: 650 },
  { id: 'srv-14', name: 'Keratin Hair Smoothening & Gloss', nameGu: 'કેરાટિન હેર સ્મૂધનિંગ અને ગ્લોસ', category: 'women', durationMinutes: 60, price: 800 },

  // --- Unisex Category ---
  { id: 'srv-3', name: 'Royal Hair Spa & Deep Scalp Therapy', nameGu: 'રોયલ હેર સ્પા અને સ્કેલ્પ થેરાપી', category: 'unisex', durationMinutes: 45, price: 450 },
  { id: 'srv-4', name: 'Deep Cleansing Herbal Gold Facial', nameGu: 'ડીપ ક્લીન્સિંગ હર્બલ ગોલ્ડ ફેશિયલ', category: 'unisex', durationMinutes: 40, price: 400 },
  { id: 'srv-5', name: 'Express Manicure & Hand Care', nameGu: 'એક્સપ્રેસ મેનિક્યોર અને હેન્ડ કેર', category: 'unisex', durationMinutes: 30, price: 300 },
  { id: 'srv-15', name: 'Deluxe Pedicure & Foot Reflexology', nameGu: 'ડીલક્સ પેડિક્યોર અને ફૂટ મસાજ', category: 'unisex', durationMinutes: 45, price: 400 },
  { id: 'srv-16', name: 'Stress Relief Head & Shoulder Massage', nameGu: 'હેડ, નેક અને શોલ્ડર રિલેક્સિંગ મસાજ', category: 'unisex', durationMinutes: 25, price: 250 },
  { id: 'srv-17', name: 'O3+ Instant Detan & Radiance Pack', nameGu: 'O3+ ઇન્સ્ટન્ટ ડી-ટેન ફેસ પેક', category: 'unisex', durationMinutes: 25, price: 300 },
];

export function seedOrUpdateServices() {
  const upsert = db.prepare(`
    INSERT INTO services (id, name, nameGu, category, durationMinutes, price, isActive)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      nameGu = excluded.nameGu,
      category = excluded.category,
      durationMinutes = excluded.durationMinutes,
      price = excluded.price
  `);

  for (const s of DEFAULT_INDIAN_SERVICES) {
    upsert.run(s.id, s.name, s.nameGu, s.category, s.durationMinutes, s.price);
  }
}

// Initialize schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nameGu TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'unisex',
      durationMinutes INTEGER NOT NULL,
      price INTEGER NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS barbers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      station INTEGER NOT NULL,
      specialty TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Free',
      currentTicketId TEXT,
      isOnDuty INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      customerName TEXT NOT NULL,
      phone TEXT NOT NULL,
      servicesJson TEXT NOT NULL,
      preferredBarberId TEXT NOT NULL DEFAULT 'any',
      assignedBarberId TEXT,
      status TEXT NOT NULL DEFAULT 'Waiting',
      createdAt TEXT NOT NULL,
      calledAt TEXT,
      startedAt TEXT,
      completedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS salon_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_auth (
      id TEXT PRIMARY KEY,
      passwordHash TEXT NOT NULL,
      salt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL
    );
  `);

  // Migrate services table if category column is missing
  try {
    db.exec(`ALTER TABLE services ADD COLUMN category TEXT NOT NULL DEFAULT 'unisex';`);
  } catch {
    // Column already exists
  }

  // Seed or update all Indian services without duplicating
  seedOrUpdateServices();

  // Seed default barbers if empty
  const barberCount = db.prepare('SELECT COUNT(*) as count FROM barbers').get() as { count: number };
  if (barberCount.count === 0) {
    const insertBarber = db.prepare(`
      INSERT INTO barbers (id, name, station, specialty, status, currentTicketId, isOnDuty)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    insertBarber.run('barber-1', 'Ravi', 1, 'Senior Stylist', 'Free', null);
    insertBarber.run('barber-2', 'Amit', 2, 'Master Barber', 'Free', null);
    insertBarber.run('barber-3', 'Imran', 3, 'Beard Specialist', 'Free', null);
  }

  // Seed default settings if empty
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM salon_settings').get() as { count: number };
  if (settingsCount.count === 0) {
    const insertSetting = db.prepare('INSERT INTO salon_settings (key, value) VALUES (?, ?)');
    insertSetting.run('isQueueOpen', 'true');
    insertSetting.run('closingTime', '21:00');
  }

  // Seed default tickets if empty (matching docs/03-flows-rules.md)
  const ticketCount = db.prepare('SELECT COUNT(*) as count FROM tickets').get() as { count: number };
  if (ticketCount.count === 0) {
    resetToSeedData();
  }

  console.log('✅ SQLite Database initialized at:', dbPath);
}

export function resetToSeedData() {
  db.prepare('DELETE FROM tickets').run();
  seedOrUpdateServices();

  // Reset default barbers
  db.prepare(`
    INSERT INTO barbers (id, name, station, specialty, status, currentTicketId, isOnDuty)
    VALUES
      ('barber-1', 'Ravi', 1, 'Senior Stylist', 'In Service', 'S-12', 1),
      ('barber-2', 'Amit', 2, 'Master Barber', 'Free', 'S-13', 1),
      ('barber-3', 'Imran', 3, 'Beard Specialist', 'On Break', NULL, 1)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      currentTicketId = excluded.currentTicketId,
      isOnDuty = excluded.isOnDuty
  `).run();

  // Seed default tickets matching docs/03-flows-rules.md Section 9
  const insertTicket = db.prepare(`
    INSERT INTO tickets (id, customerName, phone, servicesJson, preferredBarberId, assignedBarberId, status, createdAt, calledAt, startedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // S-12: Kunal Mehta (In chair with Ravi)
  insertTicket.run(
    'S-12',
    'Kunal Mehta',
    '9825011111',
    JSON.stringify([{ id: 'srv-1', name: 'Haircut & Styling', nameGu: 'હેરકટ અને સ્ટાઇલ', durationMinutes: 30, price: 150, isActive: true }]),
    'barber-1',
    'barber-1',
    'In chair',
    new Date(Date.now() - 30 * 60000).toISOString(),
    new Date(Date.now() - 20 * 60000).toISOString(),
    new Date(Date.now() - 18 * 60000).toISOString()
  );

  // S-13: Jayesh Shah (Called to Amit)
  insertTicket.run(
    'S-13',
    'Jayesh Shah',
    '9825022222',
    JSON.stringify([{ id: 'srv-6', name: 'Classic Shave & Hot Towel', nameGu: 'શેવ અને હોટ ટોવેલ', durationMinutes: 20, price: 100, isActive: true }]),
    'barber-2',
    'barber-2',
    'Called',
    new Date(Date.now() - 25 * 60000).toISOString(),
    new Date(Date.now() - 2 * 60000).toISOString(),
    null
  );

  // S-14: Rahul Patel (Waiting, any)
  insertTicket.run(
    'S-14',
    'Rahul Patel',
    '9825033333',
    JSON.stringify([
      { id: 'srv-1', name: 'Haircut & Styling', nameGu: 'હેરકટ અને સ્ટાઇલ', durationMinutes: 30, price: 150, isActive: true },
      { id: 'srv-2', name: 'Beard Sculpting & Trim', nameGu: 'દાઢી ટ્રીમ અને શેપ', durationMinutes: 15, price: 80, isActive: true }
    ]),
    'any',
    null,
    'Waiting',
    new Date(Date.now() - 24 * 60000).toISOString(),
    null,
    null
  );

  // S-15: Suresh Kumar (Waiting, barber-1)
  insertTicket.run(
    'S-15',
    'Suresh Kumar',
    '9825044444',
    JSON.stringify([{ id: 'srv-1', name: 'Haircut & Styling', nameGu: 'હેરકટ અને સ્ટાઇલ', durationMinutes: 30, price: 150, isActive: true }]),
    'barber-1',
    null,
    'Waiting',
    new Date(Date.now() - 18 * 60000).toISOString(),
    null,
    null
  );

  // S-16: Hardik Pandya (Waiting, any)
  insertTicket.run(
    'S-16',
    'Hardik Pandya',
    '9825055555',
    JSON.stringify([{ id: 'srv-3', name: 'Royal Hair Spa & Massage', nameGu: 'રોયલ હેર સ્પા', durationMinutes: 45, price: 400, isActive: true }]),
    'any',
    null,
    'Waiting',
    new Date(Date.now() - 15 * 60000).toISOString(),
    null,
    null
  );

  // S-17: Bhavin Dave (Waiting, barber-3)
  insertTicket.run(
    'S-17',
    'Bhavin Dave',
    '9825066666',
    JSON.stringify([{ id: 'srv-2', name: 'Beard Sculpting & Trim', nameGu: 'દાઢી ટ્રીમ અને શેપ', durationMinutes: 15, price: 80, isActive: true }]),
    'barber-3',
    null,
    'Waiting',
    new Date(Date.now() - 10 * 60000).toISOString(),
    null,
    null
  );

  // S-18: Chirag Joshi (Waiting, any)
  insertTicket.run(
    'S-18',
    'Chirag Joshi',
    '9825077777',
    JSON.stringify([{ id: 'srv-1', name: 'Haircut & Styling', nameGu: 'હેરકટ અને સ્ટાઇલ', durationMinutes: 30, price: 150, isActive: true }]),
    'any',
    null,
    'Waiting',
    new Date(Date.now() - 5 * 60000).toISOString(),
    null,
    null
  );

  // Default settings
  db.prepare("INSERT INTO salon_settings (key, value) VALUES ('isQueueOpen', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'").run();
  db.prepare("INSERT INTO salon_settings (key, value) VALUES ('closingTime', '21:00') ON CONFLICT(key) DO UPDATE SET value = '21:00'").run();
}

// ── Admin Authentication & Cryptographic Helpers ──────────────────────────────

/**
 * Hash password with PBKDF2 using SHA-512, 100,000 iterations and a cryptographically secure 16-byte salt
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

/**
 * Verify plaintext password against stored PBKDF2 hash using timing-safe comparison
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const { hash } = hashPassword(password, salt);
    const hashBuf = Buffer.from(hash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (hashBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, storedBuf);
  } catch {
    return false;
  }
}

/**
 * Generate cryptographically secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Reset admin auth data (for tests or initial state reset)
 */
export function resetAdminAuth() {
  db.prepare('DELETE FROM admin_auth').run();
  db.prepare('DELETE FROM admin_sessions').run();
}
