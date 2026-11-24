# Salon Queue Management System — Flows, Business Rules & Test Checklist

**Document ID:** `docs/03-flows-rules.md`  
**Project:** Salon Queue Management System  
**Version:** 1.0.0  
**Purpose:** Precise algorithmic specifications, state machines, business constraints, calculation logic, and automated/manual verification checklist.

---

## 1. Core End-to-End User Flows

```
[ Customer Remote / Walk-In ]
             │
             ▼
      ( Queue Entry ) ────► Token Generated (e.g. S-14)
             │
             ▼
        [ WAITING ] ◄───── Position updates & Countdown
             │
      ( 2nd in line ) ───► Banner: "Start coming to the salon!"
             │
             ▼
      [ CALL NEXT ] ────► Barber X or Receptionist triggers Call
             │
             ▼
        [ CALLED ] ──────► Gold Alert Screen + Chime (10-min grace period)
          │    │
          │    └─── (No show in 10m) ──► [ NO-SHOW ] (Re-added at END if arrives)
          ▼
      [ IN CHAIR ] ─────► Barber taps "Start Service" (Timer running)
          │
          ▼
        [ DONE ] ───────► Barber taps "Done" (Stats updated, Chair freed)
```

---

### Flow 1: Remote Customer Journey (Self-Service)
1. **Discovery:** Customer accesses the salon web application URL on their mobile browser (`/`).
2. **Review Status:** Customer checks the live hero card showing active wait time (e.g., 6 waiting, ~50 min) and barber availability chips.
3. **Queue Entry (`/join`):**
   - Customer enters Name ("Rahul Patel") and 10-digit Mobile Phone (`9876543210`).
   - Customer selects 1 to 3 services (e.g., Haircut ₹150 [30m] + Beard Trim ₹80 [15m]).
   - Customer picks Barber preference: either `"Any Barber (Fastest)"` or a specific professional (`"Amit"`).
   - Dynamic summary calculates: Total Duration: 45 min, Total Cost: ₹230, Estimated Wait: ~35 min.
   - Customer taps `[ Confirm & Get Token ]`.
4. **Token Generation & Persistence:**
   - System validates inputs, assigns sequential daily token `S-14`, saves `token_id` in `localStorage`, and transitions directly to `/status/S-14`.
5. **Remote Monitoring (`/status/S-14`):**
   - Customer monitors position (e.g., `"4th in line"`) and live countdown from home or a nearby coffee shop.
6. **Approach Alert (Threshold = 2nd in line):**
   - As preceding customers are served, customer advances to `"2nd in line"`.
   - App flashes an amber banner: *"Start coming to the salon! You are 2nd in line."*
7. **Call Alert (It's Your Turn!):**
   - Receptionist or Barber Amit clicks `[ Call Next ]`.
   - Customer's screen instantly transforms into full-screen gold alert with audio chime and vibration: *"It's your turn! Go to Barber Amit at Station 2."*
   - A 10-minute arrival grace countdown initiates.
8. **Chair Service:**
   - Customer arrives at Station 2. Barber Amit taps `[ Start Service ]`. Status moves to `In chair`.
9. **Service Completion:**
   - Amit finishes haircuts and taps `[ Done ]`. Status moves to `Done`.
   - Customer screen updates with thank you note, and `localStorage` token is cleared.

---

### Flow 2: Physical Walk-In Customer Journey
1. **Arrival:** Customer walks directly into the salon lounge without an existing token.
2. **Reception Intake:** Receptionist taps `[ + Add Walk-in ]` on the tablet dashboard (`/reception`).
3. **Data Logging:** Receptionist enters Customer Name, optional mobile number, selects services, and sets barber preference.
4. **Queue Insertion:**
   - Walk-in customer is inserted into the queue strictly at the **end** (FIFO order).
   - System assigns the next sequential token (e.g. `S-15`).
   - Receptionist verbally informs customer: *"You are Token S-15. Your estimated wait is about 40 minutes."*
5. **Lounge Monitoring:**
   - Customer sits in the waiting area watching the Waiting Area TV Display (`/display`), which lists `S-15` under "Up Next".
6. **Turn Announcement:**
   - When called, the TV flashes `S-15` in brilliant gold with an audible chime: *"Now Calling S-15 to Station 1"*.

---

### Flow 3: Barber Station Service Flow
1. **Station Ready:** Barber opens `/barber/:name` on their station mobile device.
2. **Next Customer Call:**
   - Barber taps `[ Call Next Customer ]`.
   - System evaluates queue priority and assigns the next customer matching this barber or 'Any'.
3. **Customer Arrival & Start:**
   - Customer walks to chair. Barber taps `[ Start Service ]`.
   - Live elapsed stopwatch begins ticking on screen.
4. **Finishing Service:**
   - Barber finishes grooming and taps `[ Done ]`.
   - Customer is archived to `Done`; chair status returns to `Free`.
   - Daily KPI counters (Customers served, Revenue) increment immediately.
5. **Break Management:**
   - Barber toggles `[ On Break ]`. Status updates instantly across TV, Reception, and Join screens.

---

## 2. State Machine & Status Lifecycle Rules

### 2.1 State Definitions
- `Waiting`: Customer is registered and waiting in the queue.
- `Called`: Customer's turn has arrived; summoned to a specific barber's station.
- `In chair`: Customer is physically seated and service is underway.
- `Done`: Service has completed successfully.
- `Cancelled`: Customer or receptionist withdrew the ticket before service began.
- `No-show`: Customer was called but failed to arrive within the 10-minute grace period.

### 2.2 Allowed State Transitions Matrix

| From Status | To Status | Triggered By | Allowed? | Notes |
| :--- | :--- | :--- | :---: | :--- |
| `Waiting` | `Called` | Barber / Receptionist `[ Call Next ]` | ✅ **YES** | Dispatches to designated barber chair. |
| `Called` | `In chair` | Barber `[ Start Service ]` | ✅ **YES** | Timer starts. |
| `In chair` | `Done` | Barber `[ Done ]` | ✅ **YES** | Increments stats; chair freed. |
| `Waiting` | `Cancelled` | Customer or Receptionist `[ Cancel ]` | ✅ **YES** | Removes customer from active queue. |
| `Called` | `No-show` | Receptionist or Barber `[ No-show ]` | ✅ **YES** | Permitted after grace period expires. |
| `In chair` | `Waiting` | Any | ❌ **FORBIDDEN** | Status can never move backwards. |
| `Done` | `In chair` | Any | ❌ **FORBIDDEN** | Terminal state. |
| `Done` | `Waiting` | Any | ❌ **FORBIDDEN** | Terminal state. |
| `Cancelled` | `Waiting` | Any | ❌ **FORBIDDEN** | Must register anew as walk-in at end of line. |
| `No-show` | `Waiting` | Any | ❌ **FORBIDDEN** | Must register anew as walk-in at end of line. |

---

## 3. Algorithmic Queue Rules & Barber Dispatching

### Rule 1: First-Come, First-Served (FIFO) Priority
Queue order is determined strictly by creation timestamp (`createdAt` ascending). Customers who registered earlier are always positioned ahead of customers who registered later.

### Rule 2: Barber Preference & Dispatch Logic
When Barber $B$ triggers `[ Call Next ]`:
1. Search the active `Waiting` queue from beginning (oldest) to end (newest).
2. The eligible customer is the **earliest customer** who meets either:
   - `preferredBarber === B.id` **OR**
   - `preferredBarber === 'any'`
3. **Strict Barber Loyalty Enforcement:**
   - If Customer $C$ explicitly selected Barber $A$, Customer $C$ **must NEVER** be dispatched to Barber $B$.
   - Barber $B$ will skip Customer $C$ and evaluate the next customer in line.
4. **Capacity Constraint:** Each barber station can only have **one** customer in `Called` or `In chair` status at any moment.

### Rule 3: Single Active Spot per Phone Number
A phone number cannot hold multiple concurrent active spots.
- If an input phone number matches an existing ticket with status `Waiting` or `Called`, the system rejects duplicate submission and directs the user to their active ticket.
- Once a ticket reaches `Done`, `Cancelled`, or `No-show`, that phone number is immediately eligible to join again.

---

## 4. Waiting Time Calculation Formula

The application uses an empirical formula to deliver transparent, predictable wait estimates. All wait times are rounded up to the nearest whole minute.

### 4.1 Chair Remaining Time Formula
For any barber $B$ currently serving a customer in `In chair` status:
$$\text{RemainingChairTime}(B) = \max\left(0, \text{TotalServiceDuration} - \text{ElapsedTimeSinceStart}\right)$$
If barber $B$ has no customer in chair (or is in `Free` state), $\text{RemainingChairTime}(B) = 0$.

### 4.2 Global Queue Wait Time (Home Screen Hero Card `/`)
For the public hero card on `/`:
$$\text{Estimated Overall Wait (min)} = \left\lceil \frac{\sum_{i \in \text{Waiting}} \text{Duration}(i)}{\max(1, N_{\text{Active Barbers}})} \right\rceil + \text{AvgRemainingChairTime}$$
*Where:*
- $N_{\text{Active Barbers}}$ is the number of on-duty barbers currently marked as `Available` (excluding barbers who are `On Break` or `Off Duty`).
- If $N_{\text{Active Barbers}} == 0$, wait time displays *"All barbers currently on break"*.
- If the waiting queue is empty AND all chairs are free: wait time is strictly **`0 min`** (*"No one waiting — walk right in!"*).

### 4.3 Individual Customer Wait Time (Screen 2 & Screen 3)
When calculating estimated wait for a specific ticket $T$:

#### Case A: Customer chose 'Any Barber (Fastest)'
$$\text{Wait}(T) = \left\lceil \frac{\sum_{k \in \text{Ahead}(T)} \text{Duration}(k)}{N_{\text{Active Barbers}}} \right\rceil + \text{AvgRemainingChairTime}$$

#### Case B: Customer chose Specific Barber $B$
$$\text{Wait}(T) = \sum_{j \in \text{Ahead}(T, B)} \text{Duration}(j) + \text{RemainingChairTime}(B) + \text{BreakPenalty}(B)$$
*Where:*
- $\text{Ahead}(T, B)$ is the set of customers ahead of $T$ who chose Barber $B$ OR chose 'Any Barber' and will be assigned to $B$.
- $\text{BreakPenalty}(B) = 15 \text{ min}$ if Barber $B$ is currently marked `On Break`, otherwise $0$.

*Sanity Invariant:* As long as there are customers ahead in line (or a client currently in chair), the calculated wait time is strictly greater than 0. It only reaches 0 when the chair is empty and customer is next in line.

---

## 5. No-Show & Cancellation Policies

### 5.1 No-Show Policy & Grace Period
- When a customer is marked `Called`, an internal 10-minute countdown begins.
- The customer's mobile screen displays the countdown and sounds an alert.
- The Receptionist dashboard displays an elapsed call-timer badge: `Called 06:12 ago`.
- If the customer does not arrive at the station within **10 minutes**:
  - The receptionist or barber has the authority to click `[ Mark No-Show ]`.
  - The ticket status changes to `No-show`.
  - The barber's chair is immediately freed to call the next customer.
- **Late Arrival Rule:** If a no-show customer physically arrives later and asks for service, they **CANNOT** regain their old queue spot. The receptionist must create a brand new walk-in entry at the **very END** of the queue with a fresh token.

### 5.2 Customer Cancellation Policy
- A customer may tap `[ Cancel My Spot ]` on `/status/:id` at any time while in `Waiting` state.
- System requires 1-tap confirmation: *"Are you sure you want to cancel your spot?"*
- Upon cancellation, status transitions to `Cancelled`, local token is cleared, and remaining customers in line immediately advance by 1 position.
- Once a customer is moved to `In chair`, the cancel button is disabled.

---

## 6. Salon Operational Rules & Edge Cases

### 6.1 Online Queue Operating Hours & Cutoff
- Regular salon hours: 9:00 AM to 9:00 PM.
- **Cutoff Rule:** Online queue joining automatically closes **30 minutes prior to closing time** (at 8:30 PM), because services require 30–45 minutes to finish before salon shutdown.
- Physical walk-in additions at the reception desk remain enabled at the discretion of the receptionist.
- The Owner can manually toggle `[ Online Queue: OPEN / CLOSED ]` at any time from `/admin` or `/reception`.

### 6.2 Barber Break Logic
- When a barber toggles `On Break`:
  - Their station badge switches to `On Break` on Reception, Barber View, and Waiting TV.
  - On `/status/:id`, any customer waiting specifically for that barber receives an informational notice: *"Barber [Name] is currently on a short break. Your turn will be called as soon as they return."*
  - The barber is excluded from the active divisor in the 'Any Barber' wait-time formula until they toggle back to `Available`.

### 6.3 Maximum Service Limit
- A customer is permitted to select a maximum of **3 services** per visit to prevent accidental or malicious queue monopolization.

---

## 7. Real-Time Synchronization Protocol

To ensure seamless operation between customer phones, reception tablet, barber mobile phones, and the TV display:
- Every status mutation (`join`, `call`, `start`, `done`, `cancel`, `noshow`, `toggle_break`, `toggle_queue`) generates an immediate state broadcast event.
- Devices receive state updates and re-render within **≤ 2 seconds**.
- **Offline / Reconnection:** If a customer's phone loses connectivity temporarily, the app re-syncs state immediately upon network reconnection.

---

## 8. Exhaustive Test Checklist

Use this checklist to verify every feature and business rule before deployment:

| Test ID | Test Scenario | Steps to Execute | Expected Result | Pass / Fail |
| :---: | :--- | :--- | :--- | :---: |
| **TC-01** | Multi-Service Selection & Pricing | Select Haircut (₹150, 30m) + Beard Trim (₹80, 15m) on `/join`. | Live summary displays `2 Services · Total 45 min · ₹230`. Expected wait calculates correctly. | [ ] |
| **TC-02** | 3-Service Selection Cap | Attempt to select 4 services on `/join`. | 4th selection blocked; UI displays limit badge: "Max 3 services allowed". | [ ] |
| **TC-03** | Phone Number Validation | Enter `98765` or `ABCDE12345` into phone input. | Inline validation error: "Please enter a valid 10-digit Indian mobile number". Submit button disabled. | [ ] |
| **TC-04** | Duplicate Phone Number Block | Join queue with phone `9876543210`. In a separate window, try joining again with `9876543210`. | Form blocks duplicate; shows modal: "Phone number already in queue! You hold Token S-X" with link to My Status. | [ ] |
| **TC-05** | Strict Barber Preference Filtering | Customer A chooses Barber Ravi. Receptionist clicks `[ Call Next ]` on Barber Amit's card. | Customer A is **skipped** by Amit. Amit calls the earliest customer who chose Amit or 'Any'. Customer A remains in queue for Ravi. | [ ] |
| **TC-06** | Real-Time 'Called' Screen & Audio Chime | Receptionist calls Token `S-14`. Customer phone is open on `/status/S-14`. | Within 2 seconds, Customer phone displays full-screen gold alert with "It's your turn!", vibrates, and TV display flashes gold + plays chime. | [ ] |
| **TC-07** | Approaching Alert (2nd in line) | Customer is 3rd in line. Advance the 1st customer to chair. | Customer position moves to 2nd; amber banner appears: "Start coming to the salon! You are 2nd in line". | [ ] |
| **TC-08** | Barber Lifecycle (Start → Done) | Barber Amit clicks `[ Start Service ]` on `/barber/Amit`, then clicks `[ Done ]`. | Status transitions `Called` → `In chair` → `Done`. Timer runs during service. After `Done`, chair becomes Free and stats counter increments. | [ ] |
| **TC-09** | No-Show Re-addition at End | Mark `S-14` as No-Show. Later, receptionist re-adds them as walk-in. | Customer is appended to the **very end** of the queue with a **new token** (e.g. `S-15`), NOT restored to previous rank. | [ ] |
| **TC-10** | Online Queue Closing Switch | In `/admin`, toggle Online Queue to `CLOSED`. Open `/` and `/join` in mobile view. | Home button is disabled with message. `/join` displays "Online queue closed for today. Walk-ins welcome at reception". | [ ] |
| **TC-11** | Bilingual Localization (English ↔ Gujarati) | Click `[ GU ]` toggle in top header on any screen. | All screen labels, button texts, statuses, and badges switch to clean Gujarati instantly without broken layouts. Click `[ EN ]` restores English. | [ ] |
| **TC-12** | Cross-Device Multi-Screen Sync | Open `/reception` in Window 1, `/barber/Ravi` in Window 2, `/display` in Window 3, and `/status/:id` in Window 4. | Actions in any window reflect across all other 3 windows within 2 seconds without manual browser refresh. | [ ] |
| **TC-13** | Wait Time Recalculation on Finish | Customer waiting sees ~30 min wait. A barber completes a 30 min service ahead of them. | Wait time on My Status decreases dynamically to reflect fewer minutes remaining ahead. | [ ] |
| **TC-14** | Barber Break Status Propagation | Barber Imran toggles `[ On Break ]` on mobile screen. | Waiting TV and Reception show Imran as "On Break". Home screen chip updates. Wait time formula excludes Imran from active divisor. | [ ] |

---

## 9. Standard Seed Data for Development & Testing

To eliminate agent guesswork during development and ensure reproducible tests across all 7 screens, the following mock state must be seeded by default:

### 9.1 Default Barbers
| ID | Name | Station | Specialty | Initial Status | Initial Assignment |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `barber-1` | **Ravi** | Station 1 | Senior Stylist | `In Service` | Serving Token `S-12` (Haircut, 18 min elapsed / 30 min) |
| `barber-2` | **Amit** | Station 2 | Master Barber | `Free` | None (Chair Ready) |
| `barber-3` | **Imran** | Station 3 | Beard & Spa Specialist | `On Break` | None (10 min remaining on break) |

### 9.2 Default Service Catalog
| ID | English Name | Gujarati Name | Duration | Price | Active? |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `srv-1` | Haircut & Styling | હેરકટ અને સ્ટાઇલ | 30 min | ₹150 | ✅ ON |
| `srv-2` | Beard Sculpting & Trim | દાઢી ટ્રીમ અને શેપ | 15 min | ₹80 | ✅ ON |
| `srv-3` | Royal Hair Spa & Massage | રોયલ હેર સ્પા | 45 min | ₹400 | ✅ ON |
| `srv-4` | Classic Shave & Hot Towel | શેવ અને હોટ ટોવેલ | 20 min | ₹100 | ✅ ON |

### 9.3 Default Initial Queue (8 Sample Customers for Reception & TV Testing)
| Token | Customer Name | Phone | Services | Pref. Barber | Status | Elapsed Wait |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: |
| `S-12` | Kunal Mehta | 9825011111 | Haircut (30m) | Ravi | `In chair` | At Ravi's chair (18m in) |
| `S-13` | Jayesh Shah | 9825022222 | Classic Shave (20m) | Amit | `Called` | Called to Amit (2m ago) |
| `S-14` | Rahul Patel | 9825033333 | Haircut + Beard (45m) | Any | `Waiting` | 24 min |
| `S-15` | Suresh Kumar | 9825044444 | Haircut (30m) | Ravi | `Waiting` | 18 min |
| `S-16` | Hardik Pandya | 9825055555 | Royal Hair Spa (45m) | Any | `Waiting` | 15 min |
| `S-17` | Bhavin Dave | 9825066666 | Beard Trim (15m) | Imran | `Waiting` | 10 min |
| `S-18` | Chirag Joshi | 9825077777 | Haircut (30m) | Any | `Waiting` | 5 min |
| `S-19` | Mehul Vora | 9825088888 | Haircut + Spa (75m) | Amit | `Waiting` | 65 min *(Amber SLA breach)* |

---

## 10. Canonical Gujarati & English Translation Dictionary Reference

To satisfy the **Zero Hardcoded Strings** rule, all screen text must be resolved from this canonical vocabulary:

```json
{
  "en": {
    "app_name": "Royal Shave & Scissors",
    "open_badge": "Open · Closes 9:00 PM",
    "closed_badge": "Queue Closed for Today",
    "people_waiting": "{{count}} people waiting",
    "about_wait": "about {{minutes}} min wait",
    "join_queue": "Join Queue",
    "confirm_token": "Confirm & Get Token",
    "your_token": "Token",
    "in_line": "in line",
    "estimated_wait": "Estimated Wait Time",
    "start_coming": "Start coming to the salon! You are 2nd in line.",
    "its_your_turn": "IT'S YOUR TURN!",
    "proceed_to_barber": "Please proceed to Barber {{barber}} at Station {{station}}",
    "cancel_spot": "Cancel My Spot",
    "keep_spot": "Keep My Spot",
    "add_walkin": "+ Add Walk-in Customer",
    "call_next": "Call Next Customer",
    "start_service": "Start Service",
    "done_service": "Done",
    "mark_noshow": "Mark No-Show",
    "status_waiting": "Waiting",
    "status_called": "Called",
    "status_in_chair": "In Chair",
    "status_done": "Done",
    "status_cancelled": "Cancelled",
    "status_noshow": "No-Show",
    "on_break": "On Break",
    "available": "Available",
    "any_barber": "Any Barber (Fastest)"
  },
  "gu": {
    "app_name": "રોયલ શેવ અને સિઝર્સ",
    "open_badge": "ખુલ્લું છે · રાત્રે ૯ વાગ્યે બંધ થશે",
    "closed_badge": "આજના દિવસ માટે કતાર બંધ છે",
    "people_waiting": "{{count}} ગ્રાહકો પ્રતીક્ષામાં",
    "about_wait": "અંદાજે {{minutes}} મિનિટ પ્રતીક્ષા",
    "join_queue": "કતારમાં જોડાઓ",
    "confirm_token": "પુષ્ટિ કરો અને ટોકન મેળવો",
    "your_token": "ટોકન",
    "in_line": "લાઈનમાં",
    "estimated_wait": "અંદાજિત રાહ જોવાનો સમય",
    "start_coming": "સલૂન આવવાનું શરૂ કરો! તમે લાઈનમાં બીજા ક્રમે છો.",
    "its_your_turn": "તમારો વારો આવી ગયો છે!",
    "proceed_to_barber": "કૃપા કરીને સ્ટેશન {{station}} પર બાર્બર {{barber}} પાસે જાઓ",
    "cancel_spot": "મારી જગ્યા રદ કરો",
    "keep_spot": "જગ્યા ચાલુ રાખો",
    "add_walkin": "+ વોક-ઇન ગ્રાહક ઉમેરો",
    "call_next": "આગામી ગ્રાહકને બોલાવો",
    "start_service": "સેવા શરૂ કરો",
    "done_service": "સેવા પૂર્ણ",
    "mark_noshow": "ગેરહાજર નોંધો",
    "status_waiting": "પ્રતીક્ષામાં",
    "status_called": "બોલાવ્યા",
    "status_in_chair": "ખુરશીમાં",
    "status_done": "પૂર્ણ",
    "status_cancelled": "રદ કરેલ",
    "status_noshow": "ગેરહાજર",
    "on_break": "બ્રેક પર",
    "available": "હાજર",
    "any_barber": "કોઈપણ બાર્બર (સૌથી ઝડપી)"
  }
}
```
