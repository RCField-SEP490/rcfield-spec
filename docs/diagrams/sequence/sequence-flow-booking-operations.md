# Sequence Flow: Booking Operations

**Last updated**: 2026-06-04  
**Status**: Draft for business review  
**Related rules**: `docs/spec/business-rules/BR-booking-lifecycle.md`

Tai lieu nay tap trung vao luong van hanh tai quan sau khi booking da duoc tao:
quet ma check-in, vao san, order tai quan, gia han, check-out va settlement.

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
