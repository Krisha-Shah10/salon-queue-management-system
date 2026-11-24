# Salon Queue Management System — Project Brief & Scope

**Document ID:** `docs/01-brief.md`  
**Project:** Salon Queue Management System  
**Version:** 1.0.0  
**Target Delivery:** MSc IT Vibe Coding Lab  

---

## 1. Executive Summary & Problem Statement

### The Problem
In busy, walk-in-oriented salons and barbershops, especially during peak weekend hours, customers endure unpredictable wait times of 1 to 2 hours without knowing when their turn will come. Waiting areas become overcrowded, frustrated patrons leave without service (costing revenue), and arrival-order disputes ("Who came first?") cause friction between clients and front-desk staff. Furthermore, customers who prefer a specific barber have no visibility into that barber's individual queue, while barbers lack clear visibility into upcoming workloads.

### The Solution
The **Salon Queue Management System** is a lightweight, mobile-first, real-time web application tailored for a premium salon. It allows customers to view live queue times, join the queue remotely from their mobile phones, track their real-time position with live updates, and receive an automated "Start coming to the salon" alert when their turn nears. Walk-in customers are logged by the receptionist into the same centralized queue. Barbers manage chair states directly from their personal mobile screens, while a high-contrast TV board in the waiting lounge broadcasts queue progress to keep waiting patrons relaxed and informed.

---

## 2. Target User Personas & Roles

The system is strictly designed around **four user roles**:

| Role | Primary Device | Key Objectives |
| :--- | :--- | :--- |
| **Customer** | Smartphone (Mobile Web) | Check live wait times from home/office; select up to 3 services; choose a preferred barber or 'Any'; receive a digital queue token (e.g., `S-14`); monitor live position and countdown; self-cancel if plans change. |
| **Receptionist** | 10-inch Tablet (Landscape) / Desktop | Add physical walk-in clients into the queue; view global waiting list; see real-time barber chair allocations; call the next customer for available barbers; handle late arrivals and mark no-shows; cancel spots on request. |
| **Barber** | Smartphone (Station Mount / Pocket) | View currently assigned client and chosen services; start service timer; mark service complete (`Done`); toggle chair availability between `Available` and `On Break`; preview next assigned client. |
| **Owner / Manager** | Desktop / Tablet / Smartphone | Manage service catalog (pricing, duration, active switch, bilingual titles); manage barber roster (toggle on-duty status); toggle online queue access (`Open` / `Closed`); review real-time daily metrics (customers served, average wait time, no-show rate). |

---

## 3. Must-Have Core Features (In-Scope)

1. **Live Salon Dashboard & Hours**: Publicly visible salon status badge (`Open · Closes 9:00 PM` or `Queue Closed`), total waiting count, estimated overall wait time, and live barber status chips (`Ravi: busy`, `Amit: free`, `Imran: on break`).
2. **Mobile Customer Queue Enrollment**: Clean, 2-step onboarding requiring Customer Name and a validated 10-digit phone number, multi-selection of up to 3 salon services (with duration & price display), and barber preference picker (`Any Barber (Fastest)` vs specific barber).
3. **Live Token & Position Tracking (`My Status`)**: Unique daily token generation (e.g., `S-1`, `S-2`, `S-14`), persistent browser session storage, live position indicator ("4th in line"), real-time estimated wait countdown, proactive "Start coming to the salon" alert at 2nd in line, and full-screen gold alert with sound chime when called.
4. **Tablet Receptionist Operations**: Unified queue dashboard featuring barber chair status cards with one-tap `[Call Next]`, ordered waiting queue list, quick `[+ Add Walk-in]` modal, wait-time SLA alerts (amber warning for wait > 60 minutes), and explicit `[No-Show]` and `[Cancel]` controls.
5. **Barber Chair Mobile Control**: Dedicated station view displaying the active client, service breakdown, elapsed service timer, big tactile touch buttons for `[Start Service]` and `[Done]`, upcoming customer preview, and quick `On Break / Available` toggle.
6. **Waiting Lounge TV Display**: 5-meter-readable, landscape board displaying active barber stations with currently served tokens, top 5 "Up Next" tokens with estimated call times, and attention-grabbing gold flash animations with chime when a token is called.
7. **Owner Administration & Daily Analytics**: PIN-protected settings panel to toggle barber duty status, configure service catalog (pricing, duration, on/off switch, English/Gujarati names), control online queue status (`Open`/`Closed`), and review today's operational KPIs.
8. **Bilingual Localization (English & Gujarati)**: First-class native support for English (`EN`) and Gujarati (`GU - ગુજરાતી`) across all screens, buttons, notices, and statuses with instantaneous zero-reload switching.
9. **Real-Time Cross-Device Synchronization**: Instant updates across customer phones, receptionist tablet, barber devices, and waiting TV screen without requiring manual page reloads.

---

## 4. Explicit "Don't Build" List (Out-of-Scope)

To maintain rapid development velocity and ensure an immaculate, bug-free core user experience, the following features are **strictly prohibited**:

- ❌ **No Online Payments or Deposits**: No payment gateway integration (Stripe, Razorpay, UPI, credit card processing). All service payments occur physically inside the salon upon service completion.
- ❌ **No Future-Date Appointments or Slot Booking**: No calendar widgets, advance reservations, or scheduled appointments for tomorrow or next week. The system is strictly a **live, same-day queue**.
- ❌ **No External SMS / WhatsApp Notifications**: No integration with Twilio, Gupshup, or WhatsApp Cloud API. Tracking is conducted entirely via web link, QR code, and browser `localStorage`.
- ❌ **No Customer Accounts or Passwords**: Customers do not register, create passwords, or verify OTPs. Verification is handled strictly by active phone number and active token session.
- ❌ **No Loyalty Programs, Points, or Promo Codes**: No reward points, discount vouchers, or referral systems.
- ❌ **No Multi-Branch / Multi-Tenant Support**: The system is hardcoded for a single physical salon location.
- ❌ **No Inventory Management or Staff Payroll**: Focus remains exclusively on customer queue flow and barber chair dispatching.

---

## 5. Look, Feel & Design Language

- **Visual Aesthetic**: Premium, masculine, high-end modern barbershop aesthetic. Clean, dark, uncluttered, and tactile.
- **Color Palette**:
  - **Primary Background**: Deep Charcoal Slate (`#121820` / `#1F2937`)
  - **Surface / Card Background**: Charcoal Card Gray (`#1F2937` / `#283344`)
  - **Accent & Highlights**: Warm Metallic Gold (`#D4A017` / `#F59E0B`)
  - **Primary Typography**: High-contrast Off-White (`#F9FAFB`)
  - **Secondary Typography**: Cool Muted Gray (`#9CA3AF`)
  - **Status Semantic Colors**:
    - *Available / Free / Success*: Emerald Green (`#10B981`)
    - *In Chair / Busy*: Amber Gold (`#D4A017`)
    - *Long Wait (>60 min) / Warning*: Warning Amber (`#F59E0B`)
    - *No-Show / Cancelled / Error*: Crimson Red (`#EF4444`)
- **Card Styling**: Rounded corner cards (`rounded-xl` / `rounded-2xl`) with subtle slate borders (`border border-gray-700/60`), subtle depth shadows, and gold focus rings.
- **Typography & Ergonomics**:
  - Sans-serif, modern, geometric (Inter, Outfit, or system-ui).
  - High legibility Gujarati font rendering (Noto Sans Gujarati or system-ui fallback).
  - Large touch targets (minimum **44px × 44px**) for effortless mobile tapping in busy salon environments.
  - Giant, high-contrast typography on the TV board visible from 5+ meters.

---

## 6. Language & Localization Requirements

The application must support complete two-way language switching:
- **English (EN)**: Default international language.
- **Gujarati (GU - ગુજરાતી)**: Regional language support for local patrons, staff, and barbers.
- **Localization Architecture**: Single centralized key-value translation map (`src/i18n/translations.ts` or `en.json` / `gu.json`). Every screen, button, modal dialog, empty state, validation error, and badge must resolve labels through a localization helper (`t('key')`). Zero hardcoded text in JSX markup.

---

## 7. High-Level Technical Architecture

- **Frontend Application**: React 18 / 19 SPA powered by Vite and Tailwind CSS.
- **Routing**: React Router with clean, semantic routes:
  - `/` — Home / Landing Screen
  - `/join` — Customer Queue Registration
  - `/status/:id` — Live Customer Status & Countdown
  - `/reception` — Receptionist Tablet Dashboard
  - `/barber/:name` — Barber Station Mobile View
  - `/display` — Waiting Area TV Board
  - `/admin` — Owner Settings & Analytics Panel
- **State & Data Synchronization**: Shared reactive data store with real-time broadcasting across multiple browser tabs and remote devices (e.g., Supabase Realtime, Firebase Firestore, or lightweight WebSocket backend; falling back to BroadcastChannel / LocalStorage events for local testing).
- **Target Deployment**: Vercel (Frontend SPA) + Render / Railway (Backend / Hosted Realtime DB if applicable).
