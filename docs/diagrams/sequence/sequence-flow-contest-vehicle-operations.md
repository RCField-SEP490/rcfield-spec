# Sequence Flow: Contest Vehicle Operations

**Last updated:** 2026-06-27  
**Status:** Active for current contest vehicle flow  
**Related docs:** `docs/spec/03-contest.md`, `docs/spec/business-rules/BR-contest.md`, `docs/spec/05-api-contracts.md`, `docs/spec/06-database.md`

Tai lieu nay bo sung sequence flow cho 2 luong chinh cua contest phase hien tai:

1. Rental contest link sang Booking/Session
2. BYOC contest registration review

No cung mo ta check-in, match operations, result correction va leaderboard guard.

---

## 1. Rental registration linked booking

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant FE as Customer UI
    participant BAPI as Booking API
    participant CAPI as Contest API
    participant DB as PostgreSQL
    participant Audit as ContestAudit

    C->>FE: Chon contest RENTAL_ONLY hoac MIXED + RENTAL
    FE->>BAPI: Tao booking rental binh thuong
    BAPI->>DB: Validate slot / vehicle / payment
    BAPI->>DB: Save booking + booking_vehicles
    BAPI-->>FE: Booking CONFIRMED

    C->>FE: Dang ky contest voi booking_id + vehicle_id
    FE->>CAPI: POST /contests/:id/register
    CAPI->>DB: Load contest
    CAPI->>DB: Validate vehicle_policy
    CAPI->>DB: Load booking by booking_id + customer_id
    CAPI->>DB: Validate booking CONFIRMED
    CAPI->>DB: Validate booking cafe in contest_cafes
    CAPI->>DB: Validate booking track_type = contest.track_type_id
    CAPI->>DB: Validate booking time covers contest window
    CAPI->>DB: Validate vehicle_id belongs to booking
    CAPI->>DB: Validate vehicle not already active in same contest
    CAPI->>DB: INSERT contest_registrations(status=PENDING, booking_id, vehicle_id)
    CAPI->>Audit: registration.created
    CAPI-->>FE: Registration PENDING
```

---

## 2. BYOC registration review

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant FE as Customer UI
    participant CAPI as Contest API
    participant DB as PostgreSQL
    participant Staff as Staff/Provider
    participant Audit as ContestAudit

    C->>FE: Tao hoac chon customer vehicle
    FE->>CAPI: POST /me/customer-vehicles
    CAPI->>DB: INSERT customer_vehicles(customer_id,...)
    CAPI-->>FE: customer_vehicle_id

    C->>FE: Dang ky contest bang BYOC
    FE->>CAPI: POST /contests/:id/register
    CAPI->>DB: Load contest + validate vehicle_policy
    CAPI->>DB: Load customer_vehicle by customer_id
    CAPI->>DB: Validate vehicle not already active in same contest
    CAPI->>DB: INSERT contest_registrations(status=PENDING, customer_vehicle_id)
    CAPI->>Audit: registration.created
    CAPI-->>FE: Registration PENDING

    Staff->>CAPI: POST /contest-registrations/:id/approve
    CAPI->>DB: Validate Provider owner hoac Staff assigned
    CAPI->>DB: UPDATE contest_registrations -> CONFIRMED
    CAPI->>Audit: registration.approved
    CAPI-->>Staff: Registration CONFIRMED
```

---

## 3. BYOC rejected and redirected to rental

```mermaid
sequenceDiagram
    autonumber
    participant Staff as Staff/Provider
    participant CAPI as Contest API
    participant DB as PostgreSQL
    participant FE as Customer UI
    participant C as Customer
    participant Audit as ContestAudit

    Staff->>CAPI: POST /contest-registrations/:id/reject { reason }
    CAPI->>DB: Validate operator permission
    CAPI->>DB: UPDATE contest_registrations -> CANCELLED
    CAPI->>Audit: registration.rejected
    CAPI-->>FE: registration cancelled + rejection_reason

    FE-->>C: Hien ly do reject
    alt Contest vehicle_policy = MIXED
        FE-->>C: Goi y dang ky lai bang rental flow
    else BYOC_ONLY
        FE-->>C: Chi hien ly do reject
    end
```

---

## 4. Contest check-in

```mermaid
sequenceDiagram
    autonumber
    participant O as Provider/Staff
    participant FE as Operator UI
    participant CAPI as Contest API
    participant DB as PostgreSQL
    participant Audit as ContestAudit

    O->>FE: Nhap check_in_code
    FE->>CAPI: GET /contests/:id/registrations/lookup
    CAPI->>DB: Load registration
    CAPI-->>FE: Registration summary

    O->>FE: Xac nhan cafe check-in
    FE->>CAPI: POST /contest-registrations/:id/check-in
    CAPI->>DB: Validate registration CONFIRMED
    CAPI->>DB: Validate cafe in contest_cafes
    alt Actor = STAFF
        CAPI->>DB: Validate staff_cafe_assignments includes cafe_id
    end
    CAPI->>DB: UPDATE registration CHECKED_IN + checked_in_cafe_id
    CAPI->>Audit: registration.checked_in
    CAPI-->>FE: CHECKED_IN
```

---

## 5. Generate matches and bye round auto-advance

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider
    participant FE as Provider UI
    participant CAPI as Contest API
    participant DB as PostgreSQL
    participant Audit as ContestAudit

    P->>FE: Chon registrations + cafe + track config
    FE->>CAPI: POST /contests/:id/matches/generate
    CAPI->>DB: Validate contest state
    CAPI->>DB: Validate registrations CONFIRMED/CHECKED_IN
    CAPI->>DB: INSERT contest_matches(cafe_id, track_config_id)
    CAPI->>DB: INSERT contest_match_participants
    CAPI->>DB: Scan bye matches
    opt Match chi co 1 participant
        CAPI->>DB: Auto mark source match COMPLETED
        CAPI->>DB: Auto advance participant sang next_match_id
    end
    CAPI->>Audit: match.schedule_generated
    CAPI-->>FE: Match list
```

---

## 6. Submit result and advance

```mermaid
sequenceDiagram
    autonumber
    participant O as Provider/Staff
    participant FE as Operator UI
    participant CAPI as Contest API
    participant DB as PostgreSQL
    participant Audit as ContestAudit

    O->>FE: Nhap ket qua
    FE->>CAPI: POST /contest-matches/:id/results
    CAPI->>DB: Load match + participants
    alt Actor = STAFF
        CAPI->>DB: Validate staff assigned to contest_matches.cafe_id
    end
    CAPI->>DB: Update participant result fields
    CAPI->>DB: Update match status COMPLETED
    CAPI->>Audit: match.result_submitted
    CAPI-->>FE: Match completed

    opt Co next_match_id
        FE->>CAPI: POST /contest-matches/:id/advance
        CAPI->>DB: Insert advancing participants to next match
        CAPI->>Audit: match.advanced
        CAPI-->>FE: Next match updated
    end
```

---

## 7. Result correction with cascade guard

```mermaid
sequenceDiagram
    autonumber
    participant O as Provider/Staff
    participant FE as Operator UI
    participant CAPI as Contest API
    participant DB as PostgreSQL
    participant Audit as ContestAudit

    O->>FE: Mo correction dialog
    FE->>CAPI: POST /contest-matches/:id/results/correct
    CAPI->>DB: Load match + descendants
    alt Actor = STAFF
        CAPI->>DB: Validate staff assigned to match cafe
        CAPI->>DB: Check downstream not COMPLETED
    else Actor = PROVIDER
        opt force_cascade = true
            CAPI->>DB: Invalidate descendants and re-seed winner flow
        end
    end
    CAPI->>DB: Rewrite participant results
    CAPI->>DB: Update match/result summary
    CAPI->>Audit: match.result_corrected
    CAPI-->>FE: Corrected match
```

---

## 8. Publish leaderboard guard

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider
    participant FE as Provider UI
    participant CAPI as Contest API
    participant DB as PostgreSQL
    participant Audit as ContestAudit

    P->>FE: Publish leaderboard
    FE->>CAPI: POST /contests/:id/leaderboard/publish
    CAPI->>DB: Count contest_matches with status not in (COMPLETED, CANCELLED)
    alt Van con unfinished matches
        CAPI-->>FE: 409 CONTEST_LEADERBOARD_MATCHES_UNFINISHED
    else All terminal
        CAPI->>DB: Build standings from final completed matches
        CAPI->>DB: Save leaderboard snapshot to contests.config
        CAPI->>Audit: leaderboard.published
        CAPI-->>FE: Standings published
    end
```

---

## 9. Operational Notes

- Rental contest khong duoc duplicate payment/inspection logic.
- BYOC approval la theo registration cua contest, khong la global car approval.
- Staff permission cho check-in va match ops phai localize theo cafe.
- Correction phai de lai audit trail day du.
- Metrics va audit logs la phan bat buoc de theo doi event day operations.
