# Salon Queue Management System — Screens & Features Specification

**Document ID:** `docs/02-screens.md`  
**Project:** Salon Queue Management System  
**Version:** 1.0.0  
**Theme:** Charcoal Slate (`#121820` / `#1F2937`) + Warm Gold (`#D4A017` / `#F59E0B`)  
**Typography & Targets:** Mobile-first, min 44px tap targets, 5-meter legibility for TV.  

---

## Screen Catalog Overview

| # | Screen Name | Route URL | Target Device | Primary User Role |
| :-: | :--- | :--- | :--- | :--- |
| **1** | Home & Salon Status | `/` | Smartphone (Mobile-first) | Customer / General Public |
| **2** | Join Queue | `/join` | Smartphone (Mobile-first) | Customer |
| **3** | My Status | `/status/:id` | Smartphone (Mobile-first) | Customer |
| **4** | Reception Dashboard | `/reception` | 10-inch Tablet (Landscape) | Receptionist / Manager |
| **5** | Barber View | `/barber/:name` | Smartphone (Station mount) | Barber |
| **6** | Waiting Area TV | `/display` | 42"–65" TV / Large Display | In-Salon Waiting Customers |
| **7** | Owner Settings & Stats | `/admin` | Desktop / Tablet / Mobile | Salon Owner / Manager |

---

## Screen 1: Home (`/`)

### 1.1 Purpose & User Profile
- **User:** Customer arriving at salon website or scanning the salon window QR code.
- **Goal:** Immediately grasp live salon waiting conditions, barber availability, operating hours, and initiate joining the queue or resume an existing spot.

### 1.2 Layout & UI Hierarchy (Top to Bottom)
1. **Top Navigation Bar:**
   - Left: Salon brand monogram/logo + Salon Name ("Royal Shave & Scissors" / "રોયલ શેવ અને સિઝર્સ").
   - Right: Language Toggle Pill (`[EN | GU]`), Staff Portal Access Link (icon with PIN lock tooltip).
2. **Salon Operating Status Banner:**
   - Pill badge displaying: `● Open · Closes 9:00 PM` (Emerald green dot + white text).
   - If queue is closed by Owner or time is within 30 min of closing: `● Queue Closed for Today` (Crimson red badge).
3. **Live Queue Pulse Card (Hero Card):**
   - High-contrast charcoal container with soft gold border.
   - Large live metric: `"6 people waiting · ~50 min wait"` (Gujarati: `"6 ગ્રાહકો રાહ જોઈ રહ્યા છે · અંદાજે 50 મિનિટ"`).
   - Sub-caption: `"Estimated wait times update dynamically as services finish."`
4. **Active Barber Status Grid / Chips:**
   - Horizontal scrolling or flex-wrap chips showing on-duty barbers:
     - `[Ravi: Busy (12m left)]` (Amber badge)
     - `[Amit: Free / Next Up]` (Green badge)
     - `[Imran: On Break]` (Muted gray badge)
5. **Primary Action Area:**
   - Prominent, full-width Warm Gold Button: `[ Join Queue / કતારમાં જોડાઓ ]` (Height: 52px, bold gold button with dark text `#121820`).
   - If Queue is closed: Button disabled with caption `"Online joining closed for today. Walk-ins may inquire at reception."`
6. **Resume Existing Spot Banner (Conditional):**
   - If `localStorage` contains an active token ID (e.g., `S-14`):
     - Displays sticky floating bar: `"You are currently in queue as Token S-14 (Position: 3rd). [ View My Status → ]"`.
7. **Quick Services & Pricing Preview (Accordion / Grid):**
   - Collapsible cards displaying popular offerings:
     - Haircut & Styling: ₹150 (30 min)
     - Beard Sculpting & Trim: ₹80 (15 min)
     - Royal Hair Spa & Massage: ₹400 (45 min)
     - Shave & Hot Towel: ₹100 (20 min)

### 1.3 Button Actions & Interactivity
- `[ Join Queue ]`: Navigates to `/join`.
- `[ View My Status ]`: Navigates to `/status/:id`.
- `[ EN | GU ]`: Switches entire application locale immediately; active language highlighted in gold.
- `[ Staff Portal Link ]`: Opens modal prompting for 4-digit Staff PIN (`1234`), providing quick shortcuts to `/reception`, `/barber/Ravi`, `/barber/Amit`, `/barber/Imran`, or `/admin`.

### 1.4 State Variations
- **Empty Queue (No wait):** Hero card displays: `"No one waiting — walk right in! Available immediately!"` (Emerald border).
- **Queue Closed:** Big button disabled, banner explains hours, walk-in inquiries encouraged.
- **Loading State:** Skeleton shimmering cards with charcoal gradients.

---

## Screen 2: Join Queue (`/join`)

### 2.1 Purpose & User Profile
- **User:** Customer on mobile phone wanting to secure their place in line.
- **Goal:** Input customer details, choose up to 3 services, select a barber (or 'Any'), preview price and wait time, and confirm entry into the queue.

### 2.2 Layout & UI Hierarchy (Top to Bottom)
1. **Header Bar:**
   - Back icon button `[ ← Back to Home ]`, title `"Join the Queue / કતારમાં જોડાઓ"`, Language Switcher `[EN | GU]`.
2. **Customer Contact Section:**
   - Field 1: **Full Name** (Input: text, placeholder: `"e.g. Rahul Patel"`, required, min 2 chars).
   - Field 2: **Mobile Phone Number** (Input: tel, 10-digit numeric with prefix `+91`, validation regex: `^[6-9]\d{9}$`).
   - Validation note: Informative micro-copy: *"Used solely to identify your token in the salon."*
3. **Service Selection Section:**
   - Header: `"Select Services (Choose 1 to 3 services) / સેવાઓ પસંદ કરો (મહત્તમ 3)"`.
   - Selection Counter Badge: `"Selected: 2 / 3"`.
   - Grid of interactive service cards:
     - Each card displays: Service Name (bilingual), Duration pill (`30 min`), Price (`₹150`), and checkbox/check-circle.
     - State on select: Charcoal card outline switches to solid Warm Gold border (`#D4A017`) with gold checkmark.
     - Constraint enforcement: If 3 services are selected, remaining unselected cards become dimmed/disabled with tooltip `"Maximum 3 services allowed per visit"`.
4. **Barber Preference Section:**
   - Header: `"Select Preferred Barber / બાર્બર પસંદ કરો"`.
   - Card 1 (Default / Recommended): `"Any Barber (Fastest) / કોઈપણ બાર્બર (સૌથી ઝડપી)"` with lightning bolt badge and live estimate `"Wait: ~25 min"`.
   - Cards 2..N: Individual on-duty barbers (Photo/Avatar, Name, Current status, Individual wait estimate):
     - Example: `[Avatar] Ravi — Busy (Wait: ~40 min)`
     - Example: `[Avatar] Amit — Free (Wait: ~10 min)`
     - Example: `[Avatar] Imran — On Break (Wait: ~55 min)`
   - Clear rule hint: *"Selecting 'Any Barber' gets you served by whichever barber becomes free first."*
5. **Sticky Live Summary Drawer (Bottom of Viewport):**
   - High-contrast charcoal bottom sheet with gold accents:
     - Left side: `"2 Services · Total 45 min · ₹230"`
     - Right side: `"Expected Wait: ~35 min"`
   - Main Button: Full-width Gold Button `[ Confirm & Get Token / પુષ્ટિ કરો અને ટોકન મેળવો ]`.

### 2.3 Form Validations & Edge Cases
- **Phone Number Validation:** Must be exactly 10 digits starting with 6, 7, 8, or 9. Prevents letters or symbols. Shows inline error: `"Please enter a valid 10-digit Indian mobile number."`
- **Zero Services Selected:** Button disabled until at least 1 service is chosen.
- **More Than 3 Services:** Prevented by UI lock and alert toast: `"You can select up to 3 services per queue entry."`
- **Duplicate Phone Number Check:** If the entered phone number already has an active token in state (`Waiting` or `Called`):
  - Displays modal: `"Phone number already in queue! You currently hold Token S-14. Would you like to view your status?"` with options `[ View Token S-14 ]` or `[ Cancel ]`.
- **Closed Queue Submission:** If queue closed between page load and submit, display modal: `"Sorry, online queue just closed. Please visit reception in person."`

---

## Screen 3: My Status (`/status/:id`)

### 3.1 Purpose & User Profile
- **User:** Customer holding an active token tracking their place from home, nearby cafe, or salon lounge.
- **Goal:** Real-time visibility of queue rank, countdown timer, milestone notifications, and cancellation option.

### 3.2 Layout & UI Hierarchy (Top to Bottom)
1. **Header Bar:**
   - Salon logo, live clock, Language Toggle `[EN | GU]`.
2. **Token Identity Card:**
   - Giant Gold Token Pill: `"TOKEN: S-14"` (36pt bold font, `#D4A017`).
   - Customer Name: `"Rahul Patel"`
   - Assigned / Requested Barber: `"Barber: Amit"` (or `"Any Barber"`).
   - Selected Services Summary: `"Haircut + Beard Trim (45 min · ₹230)"`.
3. **Live Queue Position Metric:**
   - Prominent badge: `"4th in line"` (Updates live: 4th → 3rd → 2nd → Next!).
4. **Circular Countdown & Wait Time Ring:**
   - Animated SVG circular progress indicator with charcoal track and metallic gold stroke.
   - Center text: `"~35 min"` (Primary) / `"Estimated Wait Time"` (Secondary).
   - Dynamic real-time recalculation: Updates automatically as barbers complete preceding services.
5. **Milestone State Banners (Dynamic Alert Box):**
   - **Position ≥ 3 (Relaxed):**
     - Dark card with blue/gray accent: `"You have time. Relax! We'll notify you when your turn approaches."`
   - **Position == 2 (Threshold Alert — "Start Coming"):**
     - High-visibility Amber pulsing banner:  
       `"⚠️ Start coming to the salon! You are 2nd in line. Arrive within 10 minutes to secure your chair."`  
       *(Gujarati: "⚠️ સલૂન આવવાનું શરૂ કરો! તમે લાઈનમાં બીજા ક્રમે છો.")*
   - **Status == 'Called' (Full-Screen Gold Modal Takeover):**
     - Screen transforms into vibrant, celebratory Gold background (`#D4A017` / `#F59E0B`) with high-contrast black typography:
       - Large Icon: Pulsing Barber Pole or Scissors.
       - Giant Text: `"IT'S YOUR TURN! / તમારો વારો આવી ગયો છે!"`
       - Instruction: `"Please proceed immediately to Barber Amit at Station 2."`
       - System actions: Audio chime plays; phone triggers `navigator.vibrate([200, 100, 200])`.
       - Sub-notice: `"Grace period: 10 minutes before being marked No-Show."`
   - **Status == 'In chair':**
     - Emerald Green badge: `"Currently in the chair with Barber Amit. Relax and enjoy your grooming!"`
   - **Status == 'Done':**
     - Success banner: `"Service completed! Thank you for visiting Royal Shave & Scissors."`
     - Button: `[ Return to Home / હોમ પર પાછા જાઓ ]` (Clears token from `localStorage`).
6. **Cancellation Action:**
   - Subordinate, subtle Red-bordered button at bottom: `[ Cancel My Spot / મારી જગ્યા રદ કરો ]`.
   - On tap: Modal confirmation dialog: `"Are you sure you want to cancel your spot S-14? You will lose your position in line."` with buttons `[ Keep My Spot ]` and `[ Yes, Cancel ]`.
   - *Constraint:* Button is disabled once status changes to `In chair`.

---

## Screen 4: Reception Dashboard (`/reception`)

### 4.1 Purpose & User Profile
- **User:** Front-desk Receptionist or Salon Manager operating on a 10-inch counter tablet in landscape orientation.
- **Goal:** Comprehensive command-and-control over the entire queue, walk-in customer enrollment, barber dispatching, and handling delays or no-shows.

### 4.2 Layout & UI Hierarchy (Landscape Split-View)
1. **Top Action Bar:**
   - Salon Name & Real-time Live Clock (HH:MM:SS AM/PM).
   - Queue Status Toggle: Pill switch `[ Online Queue: OPEN / CLOSED ]`.
   - Primary Header Action: Large Gold Button `[ + Add Walk-in Customer ]` (opens rapid-entry modal).
   - Staff PIN lock indicator, Language Switcher `[EN | GU]`.
2. **Left Column (40% Width): Barber Station Chairs Grid:**
   - Responsive cards for each on-duty barber (e.g., Ravi, Amit, Imran):
     - **Barber Header:** Avatar, Barber Name, Current Chair Status pill (`Free` [Green], `In Service` [Amber], `On Break` [Gray]).
     - **Active Customer Details (if occupied):**
       - Token ID (`S-12`), Client Name (`Kunal M.`), Services (`Haircut`).
       - Service Duration vs Elapsed Time Progress Bar (e.g., `"18 min / 30 min"`).
     - **Station Action Controls:**
       - If Chair is Free: Big Gold Button `[ Call Next Customer ]` (fetches earliest eligible customer for this barber).
       - If Chair is Busy (`In chair`): Button `[ Mark Done ]` (marks service completed on behalf of barber if needed).
       - If Chair is Occupied with `Called`: Button `[ Mark No-Show ]` (enabled after 10m grace period) and `[ Start Service ]`.
       - Status Toggle: `[ Put on Break / Resume Duty ]` (toggles barber availability).
3. **Right Column (60% Width): Active Waiting Queue Table:**
   - Header with queue count: `"Waiting List (8 customers in line)"`.
   - Table columns:
     - `#` (Queue order: 1, 2, 3...)
     - `Token` (Bold gold badge: `S-14`, `S-15`)
     - `Customer` (Name & 10-digit Phone)
     - `Services` (Pill badges with total time & price: e.g. `Haircut + Beard (45m) · ₹230`)
     - `Barber Pref.` (`Any Barber` or `Ravi`)
     - `Wait Time Elapsed` (Live timer since joined; **highlighted in bright Amber if > 60 minutes** to signal SLA breach).
     - `Status` (`Waiting` / `Called`)
     - `Actions` Menu / Buttons:
       - `[ Call Next ]` (Dispatches customer to their eligible barber chair)
       - `[ Mark No-Show ]` (Red outline button, enabled only when status is `Called`)
       - `[ Cancel Spot ]` (Trash icon button with confirmation prompt, moves ticket to `Cancelled`)

### 4.3 Add Walk-in Modal (`+ Add Walk-in`)
- Clean overlay dialog optimized for fast touch typing:
  - Input: Customer Name (auto-focuses).
  - Input: 10-digit Phone Number (optional for walk-in if customer prefers not to give, but recommended for token identification).
  - Multi-select Service Chips (1 to 3 services).
  - Barber Preference Radio: `Any (Fastest)` or specific barber.
  - Action Button: `[ Add to Queue & Print/Show Token ]`.
  - Behavior: Generates immediate next token (e.g. `S-15`), inserts at end of queue (FIFO), and presents large pop-up with token number for receptionist to tell the customer.

### 4.4 Empty & Alert States
- **Queue Empty:** Right column displays friendly visual: `"No customers currently waiting. Chairs are open for immediate walk-ins."`
- **SLA Breach (> 60m):** Entire row glows in soft amber pulse, alerting receptionist to prioritize customer.

---

## Screen 5: Barber View (`/barber/:name`)

### 5.1 Purpose & User Profile
- **User:** Barber (e.g., Ravi, Amit, Imran) using their personal phone mounted near the styling mirror.
- **Goal:** Hands-free, low-friction station management: see who is in the chair, track time, finish services with one tap, and preview the next client.

### 5.2 Layout & UI Hierarchy (Mobile Portrait)
1. **Top Station Bar:**
   - Barber Name and Avatar: `"Barber: Amit · Station 2"`.
   - Duty Toggle Switch: `[ Available / હાજર ]` vs `[ On Break / બ્રેક પર ]`.
   - Language Switcher `[EN | GU]`.
2. **Current Customer Card (The Active Chair):**
   - High-contrast charcoal card with gold accent boundary.
   - **When Customer is Assigned/Called:**
     - Client Name & Large Token Badge: `S-14 · Rahul Patel`
     - Service List: `"Haircut (30m) + Beard Trim (15m)"`
     - Total Estimated Duration: `"45 minutes"`
     - Action Button: Full-width Gold Button `[ Start Service / સેવા શરૂ કરો ]`.
     - Secondary Action: `[ Customer No-Show ]` (if customer did not show up).
   - **When Service is In Progress (`In chair`):**
     - Elapsed Stopwatch: Large digital timer counting up (`18:24 / 45:00`).
     - Progress bar filling from 0% to 100%.
     - Primary Action: Giant Full-width Green Button `[ Done / સેવા પૂર્ણ ]` (Height: 60px, impossible to miss).
3. **Next Customer Preview Card ("Next for You"):**
   - Card displaying upcoming queue ticket matched to this barber:
     - `"Next for you: S-15 Kunal (Haircut · 30 min)"`
     - If preferred specifically: `"Customer requested you!"` badge.
   - If no one in line: `"No upcoming customers in line."`
4. **Empty Chair State (When idle):**
   - Display: `"Chair is currently empty."`
   - Action Button: Large Gold Button `[ Call Next Customer / આગામી ગ્રાહકને બોલાવો ]`.
   - Triggering this automatically checks the queue for the earliest eligible customer and moves them to `Called`.

---

## Screen 6: Waiting Area TV Display (`/display`)

### 6.1 Purpose & User Profile
- **User:** Customers sitting in the salon lounge looking at a wall-mounted 50"+ 1080p/4K TV screen from 3 to 7 meters away.
- **Goal:** Passive, glanceable, ultra-legible queue awareness that relieves anxiety and prevents customers from repeatedly asking staff about their turn.

### 6.2 Layout & Visual Architecture (1920×1080 Landscape TV Grid)
1. **Top Banner (Height: 12%):**
   - Left: Salon Gold Monogram + `"ROYAL SHAVE & SCISSORS"` in high-contrast gold.
   - Center: Live Digital Clock (HH:MM:SS AM/PM) & Date.
   - Right: Current Waiting Count (`"Waiting in Lounge: 6"`), Sound Chime Toggle `[ 🔊 Audio On / Muted ]`, and `[ ⛶ Fullscreen ]` toggle.
   - Note on Browser Audio: Displays a brief banner if audio is locked by browser policy: `"Click anywhere to enable voice/chime alerts"`.
2. **Left Panel: "Now Serving in Chairs" (Width: 60%):**
   - 2-column or 3-column grid of barber station cards:
     - Station Number & Barber Photo + Name (e.g. `Station 1: Ravi`, `Station 2: Amit`, `Station 3: Imran`).
     - Giant Active Token: e.g. `S-12` (Font size: 54pt, Gold text).
     - Customer First Name & Services: `Kunal · Haircut`.
     - Status Indicator:
       - `In Chair` (Solid Emerald Green border & badge).
       - `CALLED — PROCEED TO CHAIR` (Animated flashing gold border).
       - `Chair Available` (Subtle gray text).
       - `On Break` (Muted orange badge).
3. **Right Panel: "Up Next in Queue" (Width: 40%):**
   - Header: `"UP NEXT (TOP 5) / હવે પછીનો વારો"`.
   - List of the next 5 waiting tickets:
     - Each ticket row displays:
       - Rank (`#1`, `#2`, `#3`, `#4`, `#5`)
       - Token Badge: `S-14`, `S-15`, `S-16`, `S-17`, `S-18` (High-contrast charcoal badge with gold numbers).
       - Customer First Name (`Rahul P.`, `Suresh K.`)
       - Barber Assignment (`Amit` or `Any Barber`)
       - Estimated Call In (`~5 min`, `~15 min`, `~25 min`).
4. **Call Announcement Overlay & Audio Chime:**
   - Whenever any token changes status to `Called`:
     - Screen triggers a 10-second banner / card flash in brilliant gold.
     - Audio chime plays automatically: melodic 2-tone chime (via Web Audio API or audio asset).
     - Visual announcement pill: `🔔 NOW CALLING TOKEN S-14 (Rahul Patel) -> Station 2 (Amit)`.
5. **Bottom Scrolling Ticker (Height: 8%):**
   - Subtle animated gold/gray text ticker:
     - `"Welcome to Royal Shave & Scissors · Free High-Speed Wi-Fi: RoyalGuest (Pass: shave2026) · Complimentary tea and coffee available at reception."`

---

## Screen 7: Owner Settings & Analytics (`/admin`)

### 7.1 Purpose & User Profile
- **User:** Salon Owner / Senior Administrator managing day-to-day salon configuration, pricing, staff rosters, and business performance.
- **Goal:** Complete administrative oversight without touching database code or server configs.

### 7.2 Access Control & Security
- Protected by a simple 4-digit Owner PIN modal (`Default PIN: 1234`).
- Session remembered in browser storage with a `[ Logout / લૉગ આઉટ ]` button.

### 7.3 Tabbed Layout & Controls

#### Tab 1: Service Catalog (`/admin#services`)
- Table/Cards of all offered services with inline editing toggles:
  - Service Name (English & Gujarati): e.g. `Haircut / હેરકટ`.
  - Service Duration (minutes): e.g. `30`.
  - Service Price (₹): e.g. `150`.
  - Active Switch: `[ ON / OFF ]`. (Turning a service OFF immediately hides it from the `/join` screen).
- Action: `[ + Add New Service ]` modal with fields for English Name, Gujarati Name, Duration, and Price.

#### Tab 2: Barber Staff Roster (`/admin#barbers`)
- List of salon barbers:
  - Avatar, Name (`Ravi`, `Amit`, `Imran`), Specialty (`Master Barber`).
  - Toggle Switch: `[ On Duty Today / હાજર ]` vs `[ Off Duty / રજા પર ]`.
  - Effect: Off-duty barbers are excluded from the `/join` barber picker and omitted from waiting-time math.

#### Tab 3: Queue & Operating Hours Controls (`/admin#queue`)
- Master Switch: `[ Online Queue: OPEN / CLOSED ]`.
  - When CLOSED: The public `/join` screen disables submission and shows a courteous notice: *"Online joining is currently closed for the day. Please walk into our salon directly."*
- Operating Hours Settings: Displays salon opening (e.g. 09:00 AM) and closing (09:00 PM).
- Reset Daily Queue Action: Big red button `[ Reset Queue for New Day ]` with confirmation popup (clears all waiting/called/done tokens for a clean start).

#### Tab 4: Today's Analytics & Stats Cards (`/admin#stats`)
- High-visibility metric cards:
  - **Total Customers Served Today:** `24`
  - **Average Wait Time:** `26 minutes`
  - **Total No-Shows / Cancellations:** `2 / 1`
  - **Estimated Revenue Generated:** `₹6,450` (Sum of prices for `Done` services)
  - **Busiest Barber of the Day:** `Amit (10 clients)`
