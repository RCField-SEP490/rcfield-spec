# Sequence Flow: Contest Lifecycle

**Last updated**: 2026-06-08  
**Status**: Draft for business review  
**Related rules**: `docs/spec/business-rules/BR-contest.md`  
**Architecture**: `docs/architecture/03-contest.md`

Tài liệu này mô tả luồng end-to-end của Contest từ lúc Provider tạo giải, mở đăng
ký, customer đăng ký, staff check-in, vận hành race, nhập kết quả, publish
leaderboard và hoàn tất hoặc hủy giải.

---

## 0. Identifiers

| Field | Value | Notes |
|---|---|---|
| Contest status | `DRAFT -> OPEN -> CLOSED -> RUNNING -> COMPLETED` | `CANCELLED` là terminal |
| Registration status | `PENDING -> CONFIRMED -> CHECKED_IN` | Phase 1A chưa có `WAITLIST`, `NO_SHOW`, `DISQUALIFIED` |
| First MVP format | `RENTAL_SPEC_CUP` hoặc `TIME_ATTACK` | Tốt nhất cho demo và người mới |
| Payment component | `CONTEST_ENTRY` | Không tạo booking giả để thu entry fee |
| Schedule protection | `cafe_schedule_blocks` proposed | Phase 1B nếu contest chạy thật |
| Result mode | Manual in Phase 1B, calculated in Phase 2 | Phase 2 có round/heat/result tables |

---

## 1. Provider tạo Contest DRAFT

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider/Staff
    participant W as Web App
    participant API as API
    participant Sub as Subscription Service
    participant DB as PostgreSQL

    P->>W: Nhập tên giải, cafe, track_type, starts_at/ends_at
    W->>API: POST /cafes/:cafeId/contests
    API->>DB: Validate cafe ACTIVE + provider/staff scope
    API->>Sub: assertSubscriptionActive(providerId)
    alt Not allowed
        API-->>W: 403 subscription/account/cafe error
    else Allowed
        API->>DB: INSERT contests(status=DRAFT, vehicle_rule/config)
        API-->>W: Contest DRAFT
    end
```

Rules:

- Staff chỉ tạo contest trong chi nhánh được assign.
- `DRAFT` chưa hiển thị public.
- Config có thể chưa hoàn chỉnh ở `DRAFT`.

---

## 2. Open registration

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider/Staff
    participant API as API
    participant DB as PostgreSQL
    participant S as Schedule Service
    participant N as Notification Service

    P->>API: POST /contests/:id/open
    API->>DB: Load contest DRAFT
    API->>DB: Validate capacity, entry_fee, time range, vehicle_rule
    API->>S: Check track/time conflict
    alt Conflict
        API-->>P: 409 CONTEST_SCHEDULE_CONFLICT
    else Available
        S->>DB: INSERT cafe_schedule_blocks(source_type=CONTEST)
        API->>DB: Contest DRAFT -> OPEN via transition service
        API->>N: Notify / publish contest announcement
        API-->>P: Contest OPEN
    end
```

Notes:

- `cafe_schedule_blocks` là đề xuất Phase 1B. Nếu chưa có, ít nhất service phải
  check conflict với booking/cafe closure trước khi open.
- Khi `OPEN`, public listing bắt đầu hiển thị.

---

## 3. Customer đăng ký miễn phí hoặc có entry fee

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant W as Web App
    participant API as API
    participant DB as PostgreSQL
    participant Pay as Payment Gateway
    participant N as Notification Service

    C->>W: Xem contest public
    W->>API: GET /contests/:id
    API-->>W: Contest detail + remaining capacity
    C->>W: Chọn vehicle_source RENTAL/BYOC
    W->>API: POST /contests/:id/register
    API->>DB: BEGIN transaction
    API->>DB: Lock contest row / capacity counter
    API->>DB: Validate contest OPEN + registration window
    API->>DB: Validate one registration per user
    API->>DB: Validate vehicle_rule
    API->>DB: INSERT contest_registrations(status=PENDING)
    alt entry_fee = 0
        API->>DB: registration PENDING -> CONFIRMED
        API->>DB: COMMIT
        API->>N: Send registration confirmation
        API-->>W: Registration CONFIRMED + QR
    else entry_fee > 0
        API->>DB: COMMIT
        API->>Pay: Create payment URL for CONTEST_ENTRY
        API-->>W: paymentUrl
        C->>Pay: Pay contest entry fee
        Pay-->>API: Callback/IPN
        API->>Pay: Verify signature
        API->>DB: INSERT payment_component(type=CONTEST_ENTRY)
        API->>DB: INSERT payment_transaction
        API->>DB: registration PENDING -> CONFIRMED
        API->>N: Send registration confirmation
    end
```

Important:

- Capacity check must be transactional.
- `CONTEST_ENTRY` should link to `contest_registration_id` or generic payment subject.
- Do not create fake `bookings` for contest payment.

---

## 4. Payment timeout / cancel registration

```mermaid
sequenceDiagram
    autonumber
    participant Job as Scheduler Job
    participant C as Customer
    participant API as API
    participant DB as PostgreSQL
    participant Pay as Payment Engine
    participant N as Notification Service

    alt Payment timeout
        Job->>DB: Find PENDING registrations past payment deadline
        Job->>DB: registration PENDING -> CANCELLED
        Job->>DB: Release capacity / promote waitlist if exists
        Job->>N: Notify customer
    else Customer cancels before cutoff
        C->>API: POST /contest-registrations/:id/cancel
        API->>DB: Validate cancellable status/window
        API->>Pay: Refund by contest refund_policy
        API->>DB: registration -> CANCELLED
        API->>DB: Release capacity / promote waitlist if exists
        API->>N: Notify customer/staff
    end
```

---

## 5. Close registration and prepare event

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider/Staff
    participant API as API
    participant DB as PostgreSQL
    participant N as Notification Service

    P->>API: POST /contests/:id/close
    API->>DB: Validate contest OPEN
    API->>DB: Contest OPEN -> CLOSED
    API->>DB: Load CONFIRMED registrations
    alt Phase 1A/1B manual schedule
        API->>DB: Save simple schedule/config note
    else Phase 2 race management
        API->>DB: Generate contest_rounds
        API->>DB: Generate contest_heats
        API->>DB: Generate contest_heat_entries
    end
    API->>N: Notify participants event schedule/check-in instructions
    API-->>P: Contest CLOSED + schedule ready
```

---

## 6. Event day check-in: Rental

```mermaid
sequenceDiagram
    autonumber
    participant S as Staff
    participant W as Staff App
    participant API as API
    participant DB as PostgreSQL
    participant Store as Cloudinary
    participant C as Customer

    C->>S: Đưa QR / mã registration
    S->>W: Scan QR
    W->>API: POST /contest-registrations/:id/check-in
    API->>DB: Validate registration CONFIRMED + contest CLOSED/RUNNING
    API->>DB: Validate staff belongs to cafe
    API->>DB: Select rental car from contest rental pool
    opt Contest requires rental handover evidence
        S->>Store: Upload photos/checklist
        W->>API: Submit contest handover/inspection evidence
        API->>DB: Save inspection/tech-check metadata
    end
    API->>DB: registration CONFIRMED -> CHECKED_IN
    API-->>W: Checked in + assigned vehicle/car number
```

Notes:

- For `RENTAL_SPEC_CUP`, assign at check-in to keep race fair.
- If a rental car fails before event, staff can replace from rental pool with audit note.

---

## 7. Event day check-in: BYOC

```mermaid
sequenceDiagram
    autonumber
    participant S as Staff
    participant API as API
    participant DB as PostgreSQL
    participant Store as Cloudinary
    participant C as Customer

    C->>S: Đưa xe cá nhân + QR
    S->>API: POST /contest-registrations/:id/check-in
    API->>DB: Validate registration CONFIRMED
    S->>API: Submit BYOC tech-check checklist
    opt Photos required
        S->>Store: Upload BYOC safety/facility photos
        API->>DB: Save evidence metadata
    end
    alt Tech check passed
        API->>DB: registration -> CHECKED_IN
        API-->>S: Allow staging
    else Failed
        API->>DB: registration -> CANCELLED / DISQUALIFIED if Phase 2
        API-->>S: Reject entry, refund by policy
    end
```

---

## 8. Start contest and run heats/results

```mermaid
sequenceDiagram
    autonumber
    participant RD as Race Director/Staff
    participant API as API
    participant DB as PostgreSQL
    participant Board as Public Board

    RD->>API: POST /contests/:id/start
    API->>DB: Contest CLOSED -> RUNNING
    loop Each heat/run
        RD->>API: Start heat/run
        alt Phase 1B manual timing
            RD->>API: POST /contests/:id/results manual result
            API->>DB: Save result summary draft
        else Phase 2 heat result
            RD->>API: POST /contest-heats/:id/results
            API->>DB: INSERT contest_results
            API->>DB: Calculate rank by scoring_config
        end
        RD->>API: Verify result
        API->>DB: Mark result verified
        API-->>Board: Update leaderboard snapshot
    end
```

Scoring examples:

- Time attack: `best_lap_ms ASC`.
- Race final: `lap_count DESC`, then `elapsed_ms ASC`.
- Drift: `judge_score DESC`, then penalty.

---

## 9. Complete contest and award prizes

```mermaid
sequenceDiagram
    autonumber
    participant RD as Race Director/Provider
    participant API as API
    participant DB as PostgreSQL
    participant N as Notification Service
    participant Board as Public Result Page

    RD->>API: POST /contests/:id/complete
    API->>DB: Validate all required results verified
    API->>DB: Compute final leaderboard / podium
    API->>DB: Assign prize records or voucher/package rewards
    API->>DB: Contest RUNNING -> COMPLETED
    API->>N: Notify participants final result
    API-->>Board: Publish final leaderboard/podium
```

---

## 10. Cancel contest and refund

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider/Admin
    participant API as API
    participant DB as PostgreSQL
    participant Pay as Payment Engine
    participant N as Notification Service

    P->>API: POST /contests/:id/cancel
    API->>DB: Validate contest not COMPLETED
    API->>DB: Contest -> CANCELLED
    API->>DB: Load paid/confirmed registrations
    loop Each paid registration
        API->>Pay: Refund CONTEST_ENTRY 100%
        Pay->>DB: payment_component -> REFUNDED
        API->>DB: registration -> CANCELLED
    end
    API->>DB: Release schedule block
    API->>N: Notify participants
```

---

## 11. Edge sequence: result protest / incident

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant API as API
    participant DB as PostgreSQL
    participant Admin as Provider/Admin

    C->>API: Report result/damage issue
    API->>DB: Create incident/dispute or result protest record
    Admin->>API: Review result/evidence
    alt Correction accepted
        API->>DB: Update result with audit before_json/after_json
        API->>DB: Recalculate leaderboard
    else Rejected
        API->>DB: Mark protest rejected with reason
    end
    API-->>C: Notify decision
```

Phase 1 can handle this manually through incident/dispute notes. Phase 2 should add
dedicated `contest_result_audits` and protest workflow.

---

## Reference

- `docs/architecture/03-contest.md` — module architecture
- `docs/architecture/diagrams/contest-lifecycle-flow.md` — lifecycle flowchart
- `docs/spec/business-rules/BR-contest.md` — full business rules and roadmap
- `docs/spec/03-payment-engine.md` — payment component lifecycle
- `docs/spec/06-database.md` — current contest schema

