# Salon Queue Management System

**Live demo:** https://salon-queue-management-system-steel.vercel.app/

**Hosted on:** Vercel (Frontend) + Render (Backend)

**Staff Test PIN:** 1234 (Demo only)

## About

A modern queue management application for a unisex salon. Customers can join the queue remotely, track their waiting time and receive updates when their turn arrives. Receptionists and stylists manage the queue, while the waiting-area display shows live token progress.

## Documentation Index

- `docs/01-brief.md` — Project scope, personas and features.
- `docs/02-screens.md` — Screen layouts and UI hierarchy.
- `docs/03-flows-rules.md` — Queue lifecycle and business rules.
- `AGENTS.md` — Project-wide instructions.

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

---

## 4. Deployment Guide (Render + Vercel)

### A. Deploy Backend to Render (Web Service)
1. In the [Render Dashboard](https://dashboard.render.com), click **New +** > **Web Service**.
2. Connect your Git repository.
3. Configure the service settings:
   - **Name:** `salon-queue-backend`
   - **Language / Environment:** `Node`
   - **Region:** Any (e.g. `Oregon (US West)`)
   - **Branch:** `main`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
4. Add the following **Environment Variables** in Render:
   - `NODE_VERSION` = `22.12.0` (required for native `node:sqlite`)
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (Render binds this port automatically)
   - `HOST` = `0.0.0.0`
   - `CORS_ORIGIN` = `*` (or your Vercel frontend domain, e.g. `https://salon-queue-mscit.vercel.app`)
5. *(Optional for Persistent Storage across restarts)*:
   - Under **Disks**, click **Add Disk**.
   - **Name:** `salon-data`
   - **Mount Path:** `/var/data`
   - **Size:** `1 GB`
   - Add Environment Variable: `DATA_DIR` = `/var/data` (or `DATABASE_PATH` = `/var/data/salon.db`)
6. Click **Create Web Service**. Once deployed, copy your Render URL (e.g. `https://salon-queue-backend.onrender.com`).

---

### B. Deploy Frontend to Vercel (SPA)
1. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New...** > **Project**.
2. Import your Git repository.
3. Configure the project settings:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add the following **Environment Variable** in Vercel:
   - `VITE_API_URL` = `https://your-backend-name.onrender.com` *(paste your Render backend URL from step A, with NO trailing slash)*
5. Click **Deploy**.
6. When Vercel finishes building, your single-page application is live! `vercel.json` ensures all client-side routes (`/reception`, `/barber/:name`, `/display`, `/admin`, `/status/:id`) route directly to the SPA without 404s.
