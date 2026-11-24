# Prompts

1. Develop a Vibe Coding Project for a Salon Queue Management System based on the provided Vibe Coding Guide. Create the project brief, screen descriptions, user flows, business rules, and project instructions in the required documentation files.

2. Update my existing Salon Queue Management System to a **Unisex Salon** serving men and women. Replace male-focused services and the term "Barber" with inclusive services and "Stylist/Professional". Preserve all existing functionality, architecture and queue rules; do not rebuild anything.

3. Give the entire website a modern, premium salon aesthetic: elegant typography, warm ivory backgrounds, charcoal sections, champagne-gold accents, beautiful service photography, subtle animations, clean cards and generous spacing. Make it responsive across mobile, tablet and desktop. Avoid generic dashboard templates, excessive gradients and clutter. Preserve existing functionality.

4. Build Staff View and `/display` as defined in `docs/02-screens.md`. Implement Start, Done and Available/On Break actions with valid backend status transitions. Create a premium full-screen TV display showing each stylist and the next 5 tokens. Synchronize all screens instantly using Socket.IO.

5. Build the Reception Dashboard at `/reception` using `docs/02-screens.md`. Show waiting customers, tokens, selected services and stylist availability, with Call Next, Walk-in, Cancel and No-show actions. Enforce queue allocation and stylist preferences on the backend. Make it modern, responsive and real-time.

6. Build `/admin` with service and stylist management, including add, edit, delete and availability controls. Support men's, women's and unisex service categories, prices and durations. Add today's customer statistics and persist all changes in SQLite. Use a clean, modern admin interface.

7. Implement all business rules and edge cases in `docs/03-flows-rules.md`, including cancellations, no-shows, duplicate customers, stylist breaks and closing restrictions. Improve loading states, empty states, error messages and English/Gujarati translations. Check responsiveness and ensure every button works without redesigning completed screens.

8. Act as a senior QA engineer and test the complete application against `docs/03-flows-rules.md`. Test all customer, reception, staff, TV and admin flows, database persistence, real-time updates, edge cases and multiple browser sessions. Fix reproducible bugs, run automated tests and production builds locally, and report PASS/FAIL with evidence. Do not deploy.

9. My unisex salon is missing women's services. Add Women's, Men's and Unisex categories with realistic Indian services, descriptions, durations and INR prices (e.g. haircut, hair spa, waxing, threading, facial, manicure and pedicure). Ensure all services appear on the customer menu and can be managed through Admin. Update SQLite seed data without duplicating existing records. Do not change working screens.

10. Fix the Admin/Owner portal if it is currently broken. Then inspect its authentication and remove all hardcoded or reusable default PINs. Implement owner-configured password setup, secure hashed storage, backend verification, and protected admin routes/APIs. Preserve existing functionality and explain the exact steps to create and access my owner account.

11. Fix the Admin/Owner portal if it is currently broken. Then inspect its authentication and remove all hardcoded or reusable default PINs. Implement owner-configured password setup, secure hashed storage, backend verification, and protected admin routes/APIs. Preserve existing functionality and explain the exact steps to create and access my owner account.

12. After changing the Admin/Owner password, the portal displays a blank screen. Diagnose the issue by checking frontend console errors, backend terminal logs, authentication flow, API responses and route protection. Identify the exact cause, fix it, and verify that login, dashboard loading and existing admin features work. Do not remove authentication or expose credentials.

13. Create or update the root .gitignore for this project. Ignore node_modules, dist, build, .env files, secrets, logs, OS/editor files, SQLite database files and backups. Keep .env.example allowed for safe configuration documentation. Do not delete or modify any existing project files.

14. Prepare my project for immediate Render and Vercel deployment. Verify server binding to 0.0.0.0, PORT configuration, production build, API CORS, Socket.IO origins, SQLite persistence and environment variables. Make necessary deployment fixes without changing existing features. Provide exact Render and Vercel settings.
