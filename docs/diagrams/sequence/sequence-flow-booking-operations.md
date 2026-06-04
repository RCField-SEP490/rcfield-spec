# Sequence Flow: Booking Operations

**Last updated**: 2026-06-04  
**Status**: Draft for business review  
**Related rules**: `docs/spec/business-rules/BR-booking-lifecycle.md`

Tai lieu nay tap trung vao luong van hanh tai quan sau khi booking da duoc tao:
quet ma check-in, vao san, order tai quan, gia han, check-out va settlement.

---

## 0. Booking modes truoc khi vao luong van hanh

RCField co 3 booking modes:

| Mode | Nghiep vu | Ket qua truoc check-in |
|---|---|---|
| `SINGLE` | Dat binh thuong tung lan | Booking duoc payment confirm |
| `PACKAGE` | Dung goi slot da mua, vi du 10 slot | Booking tru `customer_packages.remaining_slots` |
| `SUBSCRIPTION` | Lich co dinh, vi du Thu Bay hang tuan | Scheduler sinh booking tu `subscriptions` |

Sau khi booking da `CONFIRMED`, ca 3 mode deu di vao luong check-in/session
ben duoi.

---

## 0.1 SINGLE: Dat binh thuong tung lan

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant FE as Customer App
    participant API as API
    participant DB as PostgreSQL
    participant Pay as Payment Gateway

    C->>FE: Chon cafe, track, slot_count, play_mode, xe/F&B neu co
    FE->>API: POST /bookings booking_mode=SINGLE
    API->>DB: Check cafe ACTIVE, slot, vehicle/BYOC availability
    API->>DB: INSERT Booking PENDING
    API->>DB: INSERT booking_participants, booking_vehicles neu rental
    API->>Pay: Create payment/hold deposit
    alt Payment success trong 30 phut
        Pay-->>API: Success callback
        API->>DB: Booking PENDING -> CONFIRMED
    else Timeout/fail
        API->>DB: Booking PENDING -> CANCELLED
        API->>DB: Release slot locks
    end
```

---

## 0.2 PACKAGE: Mua goi slot va dung den khi het slot

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant FE as Customer App
    participant API as API
    participant DB as PostgreSQL
    participant Pay as Payment Gateway

    C->>FE: Chon goi 10 slot cua Cafe A
    FE->>API: POST /packages/:id/purchase
    API->>DB: Validate packages.status=ACTIVE, cafe ACTIVE
    API->>Pay: Charge PACKAGE_PURCHASE
    Pay-->>API: Payment success
    API->>DB: INSERT customer_packages(remaining_slots=10, status=ACTIVE)

    C->>FE: Dung goi dat lich 2 slot
    FE->>API: POST /bookings booking_mode=PACKAGE, customer_package_id
    API->>DB: SELECT customer_package FOR UPDATE
    API->>DB: Check ACTIVE, not expired, remaining_slots >= 2
    API->>DB: Check slot/vehicle/BYOC availability
    API->>DB: INSERT Booking booking_mode=PACKAGE
    API->>DB: INSERT package_usages(used_slots=2)
    API->>DB: remaining_slots 10 -> 8
    opt Rental vehicle deposit still required
        API->>Pay: Hold/charge security deposit
        Pay-->>API: Deposit success
    end
    API->>DB: Booking -> CONFIRMED
    API-->>FE: Booking confirmed, remaining_slots=8
```

Example:

```text
Goi 10 slot
Lan 1 dat 2 slot: remaining 10 -> 8
Lan 2 dat 3 slot: remaining 8 -> 5
Lan 3 dat 5 slot: remaining 5 -> 0, package DEPLETED
```

---

## 0.3 SUBSCRIPTION: Lich co dinh sinh booking

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant FE as Customer App
    participant API as API
    participant DB as PostgreSQL
    participant Job as Scheduler Job

    C->>FE: Chon lich Thu Bay hang tuan 14:00-16:00
    FE->>API: POST /subscriptions
    API->>DB: Validate cafe, play_mode, track_type, frequency_rule
    API->>DB: INSERT subscriptions(status=ACTIVE)
    API-->>FE: Fixed schedule active

    Job->>DB: Scan active subscriptions
    Job->>DB: Calculate next occurrence
    Job->>DB: Check cafe closure, operating hours, availability
    alt Available
        Job->>DB: INSERT Booking booking_mode=SUBSCRIPTION, source=SYSTEM_SUBSCRIPTION
        Job->>DB: Set subscription_id on booking
        Job->>DB: Booking CONFIRMED/PENDING theo payment policy
        Job-->>C: Notify generated booking
    else Conflict
        Job->>DB: No booking confirmed
        Job-->>C: Notify choose replacement slot
    end
```

---

## 1. Happy path: Dat truoc + thue xe + check-in bang QR/code

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant FE as Customer App
    participant Staff as Staff App
    participant API as API
    participant DB as PostgreSQL
    participant Pay as Payment Engine
    participant Store as Cloudinary

    C->>FE: Chon cafe, track, slot, rental vehicles, optional F&B
    FE->>API: POST /bookings
    API->>DB: Check cafe ACTIVE, slot, vehicle availability
    API->>DB: INSERT Booking PENDING + participants + booking_vehicles
    API->>Pay: Create payment intent / hold deposit
    C->>Pay: Pay within 30 minutes
    Pay-->>API: Payment confirmed
    API->>DB: Booking PENDING -> CONFIRMED

    C->>Staff: Dua QR/code tai quay
    Staff->>API: Scan QR/code
    API->>DB: Validate booking CONFIRMED, cafe, time window, staff assignment
    API->>DB: INSERT Session CHECKED_IN
    API->>DB: INSERT session_participants + session_vehicles
    API->>DB: Vehicle AVAILABLE -> IN_USE

    Staff->>Store: Upload 4 check-in photos per vehicle
    Staff->>API: Submit check-in checklist
    API->>DB: INSERT CHECK_IN inspection evidence
    API-->>FE: Request baseline confirmation
    C->>FE: Confirm baseline
    FE->>API: Confirm inspection
    API->>DB: Session CHECKED_IN -> ACTIVE
    API-->>Staff: Cho phep customer vao san
```

---

## 2. Trong session: order F&B tai quan

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant Staff as Staff App
    participant API as API
    participant DB as PostgreSQL

    C->>Staff: Goi them do an/do uong
    Staff->>API: POST /sessions/:id/fnb-orders
    API->>DB: Validate Session ACTIVE
    API->>DB: INSERT FnbOrder ON_SITE + items snapshot
    Staff->>C: Giao mon
    C->>Staff: Tra tien truc tiep cho quan
    Staff->>API: Update order DELIVERED
    API->>DB: FnbOrder status -> DELIVERED
```

Note: F&B on-site khong di qua platform payment gateway va khong tinh platform fee.

---

## 3. Trong session: gia han gio choi

```mermaid
sequenceDiagram
    autonumber
    participant Staff as Staff App
    participant API as API
    participant DB as PostgreSQL
    participant C as Customer App

    Staff->>API: POST /sessions/:id/extensions
    API->>DB: Validate Session ACTIVE
    API->>DB: Check total extension fee <= 50% security deposit
    alt Allowed
        API->>DB: Session ACTIVE -> EXTENDING
        API->>DB: INSERT ExtensionProposal PENDING
        API-->>C: Notify extension proposal
        alt Customer approves
            C->>API: Approve proposal
            API->>DB: INSERT PaymentComponent EXTENSION_FEE
            API->>DB: Update session.planned_end_at
            API->>DB: Proposal APPROVED
            API->>DB: Session EXTENDING -> ACTIVE
        else Customer rejects or timeout 10 minutes
            API->>DB: Proposal REJECTED/EXPIRED
            API->>DB: Session EXTENDING -> ACTIVE
        end
    else Not allowed
        API-->>Staff: EXTENSION_NOT_ALLOWED
    end
```

---

## 4. Check-out: khong damage

```mermaid
sequenceDiagram
    autonumber
    participant Staff as Staff App
    participant API as API
    participant DB as PostgreSQL
    participant Store as Cloudinary
    participant C as Customer App
    participant Pay as Payment Engine

    Staff->>API: POST /sessions/:id/check-out
    API->>DB: Session ACTIVE -> CHECKING_OUT
    Staff->>Store: Upload 4 check-out photos per vehicle
    Staff->>API: Submit check-out checklist, no damage
    API->>DB: INSERT CHECK_OUT inspection evidence
    API-->>C: Request checkout confirmation
    C->>API: Confirm checkout or 2h timeout
    API->>Pay: settle(sessionId)
    Pay->>DB: Capture checkout amount = total charges - deposit
    Pay->>DB: Disburse eligible components
    API->>DB: Vehicle IN_USE -> AVAILABLE
    API->>DB: Session CHECKING_OUT -> COMPLETED
    API->>DB: If all sessions completed, Booking -> COMPLETED
```

---

## 5. Check-out: co damage hoac customer phan doi

```mermaid
sequenceDiagram
    autonumber
    participant Staff as Staff App
    participant API as API
    participant DB as PostgreSQL
    participant Store as Cloudinary
    participant C as Customer App
    participant Pay as Payment Engine
    participant Admin as Admin/Provider

    Staff->>API: POST /sessions/:id/check-out
    API->>DB: Session ACTIVE -> CHECKING_OUT
    Staff->>Store: Upload check-out photos
    Staff->>API: Submit checklist + damage estimate
    API->>DB: INSERT CHECK_OUT inspection evidence
    API->>DB: Calculate damage_charge = estimate * damage_multiplier
    API-->>C: Send damage evidence
    alt Customer confirms or 24h timeout
        API->>DB: INSERT PaymentComponent DAMAGE_CHARGE
        API->>Pay: settle(sessionId)
        Pay->>DB: Capture/settle according to components
        API->>DB: Session CHECKING_OUT -> COMPLETED
    else Customer disputes
        API->>DB: INSERT Incident or Dispute
        Admin->>API: Resolve policy result
        API->>DB: Incident RESOLVED/WAIVED
        opt final_amount > 0
            API->>DB: INSERT PaymentComponent DAMAGE_CHARGE
        end
        API->>Pay: settle(sessionId)
        API->>DB: Session CHECKING_OUT -> COMPLETED
    end
```

---

## 6. BYOC/MIXED check-in difference

```mermaid
sequenceDiagram
    autonumber
    participant Staff as Staff App
    participant API as API
    participant DB as PostgreSQL
    participant Store as Cloudinary
    participant C as Customer

    Staff->>API: Scan booking code
    API->>DB: Validate Booking CONFIRMED and BYOC/MIXED capacity
    API->>DB: INSERT Session CHECKED_IN
    Staff->>API: Select/create CustomerVehicle
    API->>DB: INSERT session_vehicle vehicle_source=BYOC
    opt MIXED also has rental vehicles
        API->>DB: INSERT rental session_vehicles
        API->>DB: Rental vehicles -> IN_USE
    end
    Staff->>Store: Upload BYOC photos and optional facility baseline
    Staff->>API: Submit BYOC safety checklist
    API->>DB: INSERT CHECK_IN inspection evidence
    C->>API: Confirm baseline or timeout
    API->>DB: Session CHECKED_IN -> ACTIVE
```
