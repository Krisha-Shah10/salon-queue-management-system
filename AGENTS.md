# AGENTS.md — Salon Queue Management System

> High-velocity AI Coding Agent instruction sheet. Read this document and referenced specifications in `docs/` before writing any code.

Queue application for a premium salon: customers join remotely from their phones, track wait times, and get called; receptionists and barbers coordinate live chair dispatch; waiting lounge TV broadcasts live token progress.

---

## 1. Documentation Index (Read First)

Always consult these specifications before implementing any screen or feature:
- [01-brief.md](file:///d:/Salon-Queue-Management/docs/01-brief.md) — Problem statement, user personas, must-have features, and explicit **"Don't Build" list**.
- [02-screens.md](file:///d:/Salon-Queue-Management/docs/02-screens.md) — Comprehensive visual layouts, UI hierarchy, buttons, validations, and empty states for all 7 screens.
- [03-flows-rules.md](file:///d:/Salon-Queue-Management/docs/03-flows-rules.md) — User flows, state machine lifecycle, FIFO dispatch logic, wait-time math, no-show rules, test checklist, and seed data.

---

## 2. Technology Stack & Run Commands

- **Framework:** React (v18+) with Vite (`npm create vite@latest`)
- **Styling:** Tailwind CSS with custom palette configuration (`tailwind.config.js`)
- **Icons:** Lucide React (`lucide-react`)
- **Routing:** React Router DOM (`react-router-dom`)
- **Language / i18n:** Dedicated translation dictionaries (`src/i18n/translations.ts` or `en.json` & `gu.json`) with custom `useTranslation()` hook.
- **Run Command:** `npm run dev` (starts local development server)
- **Build Command:** `npm run build`
- **Hosting Targets:**
  - Frontend SPA: Vercel
  - Real-time Backend / State: Render / Railway or hosted real-time database (Supabase / Firebase / WebSockets).
- **Live Submission Requirement:** The live deployed URL must appear as the very first line after the title in `README.md`:
  ```markdown
  # Salon Queue Management System
  **Live demo:** https://salon-queue-mscit.vercel.app
  **Staff Test PIN:** 1234
  ```

---

## 3. Recommended Project File Structure

```
salon-queue/
├── AGENTS.md                  # This instruction file
├── docs/
│   ├── 01-brief.md            # Scope & Boundaries
│   ├── 02-screens.md          # Visual hierarchy & Screen behaviors
│   └── 03-flows-rules.md      # Rules, Math, Test checklist & Seed data
├── src/
│   ├── components/            # Reusable UI widgets (Header, Modal, Badge, Timer)
│   ├── screens/               # 7 Screen components
│   │   ├── HomeScreen.tsx
│   │   ├── JoinQueueScreen.tsx
│   │   ├── MyStatusScreen.tsx
│   │   ├── ReceptionScreen.tsx
│   │   ├── BarberScreen.tsx
│   │   ├── DisplayScreen.tsx
│   │   └── AdminScreen.tsx
│   ├── services/
│   │   ├── queueRules.ts      # SINGLE SOURCE OF TRUTH for wait times, FIFO dispatch, transitions
│   │   └── queueStore.ts      # State management + multi-tab synchronization
│   ├── i18n/
│   │   ├── translations.ts    # EN and GU language dictionaries
│   │   └── useTranslation.ts  # Custom i18n hook
│   ├── types/
│   │   └── index.ts           # Customer, Barber, Service, QueueTicket types
│   ├── App.tsx
│   └── main.tsx
└── tailwind.config.js
```

---

## 4. 8-Step Incremental Build Roadmap

The agent must build iteratively, strictly following one step per task:
1. **Step 1 — Understand & Set Up:** Initialize React + Vite + Tailwind, dark charcoal (`#1F2937`) + gold (`#D4A017`) theme, router with 7 blank screens, and EN/GU language toggle.
2. **Step 2 — Home + Join Queue:** Build Screen 1 (`/`) and Screen 2 (`/join`) with mock services and barbers. Enforce 10-digit phone regex and 3-service maximum.
3. **Step 3 — My Status:** Build Screen 3 (`/status/:id`). Display generated token, live position, countdown, "Start coming" alert (2nd in line), and "It's your turn!" gold takeover screen.
4. **Step 4 — Reception Dashboard:** Build Screen 4 (`/reception`) for tablet landscape. Implement barber chair cards, walk-in modal, amber SLA alert (>60m wait), and strict barber-preference `[Call Next]`.
5. **Step 5 — Barber View + TV:** Build Screen 5 (`/barber/:name`) and Screen 6 (`/display`). Wire up `[Start]`, `[Done]`, break toggles, TV flashing animations, and audio chime.
6. **Step 6 — Owner Settings:** Build Screen 7 (`/admin`). Implement service catalog toggles, barber on-duty toggles, online queue open/close switch, and daily stats.
7. **Step 7 — Rules, Edge Cases & Polish:** Implement no-show late arrival rule, duplicate phone rejection, Gujarati label check, touch targets ≥ 44px. Run full verification against `03-flows-rules.md`.
8. **Step 8 — Deploy & Add Live Link:** Verify production build (`npm run build`), prepare Vercel deploy, and add live URL + Staff PIN to top of `README.md`.

---

## 5. Storage & Real-Time Sync Strategy

> **Rule:** Choose the simplest architecture that keeps Phone, Tablet, and TV screens strictly in sync within ≤ 2 seconds. Explain your choice in 3 lines before implementing.

- **Recommended Approach for Fast Lab Iteration:**
  - A shared state service or lightweight backend (or Firebase Firestore / Supabase Realtime) that synchronizes queue state, barber chair states, and active calls.
  - For standalone client-side multi-window testing: Use a unified `QueueStore` backed by `localStorage` + `BroadcastChannel API` so that multiple browser tabs/windows (Customer phone, Receptionist tablet, Barber mobile, and Waiting TV) reactively sync in real-time without manual page reloads.

---

## 6. Design System & Theme Directives

- **Primary Colors:**
  - Charcoal Background: `#121820` / `#1F2937`
  - Charcoal Card Surface: `#1F2937` / `#283344`
  - Warm Gold Accent: `#D4A017` / `#F59E0B`
  - Crisp Text: `#F9FAFB`
  - Secondary Text: `#9CA3AF`
  - Success Green: `#10B981`
  - Warning Amber (>60m wait): `#F59E0B`
  - Danger / No-Show Red: `#EF4444`
- **Card Aesthetics:** Rounded corners (`rounded-xl` or `rounded-2xl`), subtle border (`border border-gray-700/60`), elevated shadows.
- **Touch Ergonomics:** Minimum **44px × 44px** tap target size for all interactive buttons on mobile and tablet.
- **TV Display Ergonomics:** High-contrast 54pt+ typography on `/display`, designed to be legible from 5 meters away.

---

## 7. Non-Negotiable Coding Rules for the Agent

1. **One Screen or Feature per Task:** Build incrementally. Never touch unrelated screens or refactor global state during a single screen task.
2. **Centralize Queue Rules in ONE Place:** All queue calculations, status transitions (`Waiting` → `Called` → `In chair` → `Done`), barber preference filtering, and wait-time algorithms must live in a single service module (`src/services/queueRules.ts`). Re-use this single source of truth across all screens.
3. **Zero Hardcoded Strings:** Every button label, screen title, error message, badge text, and confirmation prompt must be served through the English/Gujarati translation file. No hardcoded English text inside JSX tags.
4. **Strictly Obey the "Don't Build" List:**
   - ❌ NO online payment gateways or UPI integrations.
   - ❌ NO future-date appointment booking or calendar pickers.
   - ❌ NO external SMS or WhatsApp APIs (Twilio, Gupshup).
   - ❌ NO customer login passwords or user authentication accounts.
   - ❌ NO loyalty reward programs or coupon codes.
   - ❌ NO multi-salon branch support.
5. **Enforce State Immutability & Valid Moves:**
   - Status transitions can NEVER move backwards (e.g. `In chair` can never become `Waiting`).
   - A customer choosing Barber Ravi must NEVER be given to Barber Amit.
   - A barber chair can only seat ONE customer at a time.
   - One active token per phone number.
6. **Staff PIN Protection:**
   - Default PIN for receptionist, barber, and owner screens is `1234`.
7. **Post-Task Reporting:** After completing each task, always report:
   - Exactly which files were created or modified.
   - Step-by-step instructions for how the developer can manually test and verify the change in the browser.
