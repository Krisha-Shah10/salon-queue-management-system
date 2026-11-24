# Salon Queue Management System
**Live demo:** https://salon-queue-mscit.vercel.app *(Pending Step 8 deployment)*  
**Staff Test PIN:** 1234

Queue application for a premium salon: customers join remotely from their phones, track wait times, and get called; receptionists and barbers coordinate live chair dispatch; waiting lounge TV broadcasts live token progress.

---

## 1. Documentation Index
- [01-brief.md](file:///d:/Salon-Queue-Management/docs/01-brief.md) — Scope, Personas, Features, "Don't Build" list.
- [02-screens.md](file:///d:/Salon-Queue-Management/docs/02-screens.md) — Layouts, UI Hierarchy, 7 Screens.
- [03-flows-rules.md](file:///d:/Salon-Queue-Management/docs/03-flows-rules.md) — State Lifecycle, FIFO Math, Seed Data, Test Checklist.
- [AGENTS.md](file:///d:/Salon-Queue-Management/AGENTS.md) — Project-wide instructions for AI coding agent.

---

## 2. Tech Stack & Architecture
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite persistent storage (`server/data/salon.db`)
- **Real-Time:** Socket.IO for cross-device synchronization
- **Internationalization:** English (`EN`) and Gujarati (`GU - ગુજરાતી`)

---

## 3. Getting Started

### Install Dependencies
```bash
npm install
```

### Run Concurrent Development Environment (Frontend + Backend)
```bash
npm run dev
```
- **Frontend App:** http://localhost:3000
- **Backend API & WebSockets:** http://localhost:5000
- **Health Check Endpoint:** http://localhost:5000/api/health

### Production Build
```bash
npm run build
```
