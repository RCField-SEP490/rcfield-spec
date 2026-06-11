# Sequence Flow: Contest Lifecycle

**Last updated**: 2026-06-11  
**Status**: Draft for business review  
**Related rules**: `docs/spec/business-rules/BR-contest.md`  
**Architecture**: `docs/architecture/03-contest.md`

Tài liệu này mô tả luồng end-to-end của Contest theo mô hình mới: Provider tạo
contest ở cấp provider, chọn nhiều chi nhánh tham gia, customer đăng ký contest
chung, staff/provider check-in tại một chi nhánh trong `contest_cafes`, sau đó
vận hành race, nhập kết quả, publish leaderboard và hoàn tất hoặc hủy giải.

---

## 0. Identifiers

| Field | Value | Notes |
|---|---|---|
| Contest owner | `provider_id` | Provider tạo và sở hữu contest |
| Participating branches | `contest_cafes` | Một contest có nhiều cafe tham gia |
| Registration scope | Contest-level | MVP không bắt customer chọn chi nhánh khi đăng ký |
| Contest status | `DRAFT -> OPEN -> CLOSED -> RUNNING -> COMPLETED` | `CANCELLED` là terminal |
| Registration status | `PENDING -> CONFIRMED -> CHECKED_IN` | Phase 1A chưa có `WAITLIST`, `NO_SHOW`, `DISQUALIFIED` |
| Provider participant | Phase 1C | Provider được đăng ký contest của Provider khác |
| Payment component | `CONTEST_ENTRY` | Không tạo booking giả để thu entry fee |
| Schedule protection | `cafe_schedule_blocks` proposed | Phase 1B nếu contest chạy thật |
| Result mode | Manual in Phase 1B, calculated in Phase 2 | Phase 2 có round/heat/result tables |

---

## 1. Provider tạo Contest DRAFT

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider
    participant W as Web App
    participant API as API
    participant Sub as Subscription Service
    participant DB as PostgreSQL

    P->>W: Nhập contest config + participating_cafe_ids
    W->>API: POST /contests
    API->>Sub: assertSubscriptionActive(providerId)
    API->>DB: Validate cafes ACTIVE + owned by provider
    alt Not allowed
        API-->>W: 403 subscription/account/cafe error
    else Allowed
        API->>DB: INSERT contests(status=DRAFT, provider_id)
        API->>DB: INSERT contest_cafes rows
        API-->>W: Contest DRAFT + participating cafes
    end
```

Rules:

- Chỉ Provider tạo contest.
- Staff không tạo contest; staff chỉ hỗ trợ vận hành/check-in theo chi nhánh được assign.
- `DRAFT` chưa hiển thị public.
- Config có thể chưa hoàn chỉnh ở `DRAFT`, nhưng phải có ít nhất một cafe tham gia trước khi `OPEN`.

---

## 2. Open registration

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider
    participant API as API
    participant DB as PostgreSQL
    participant S as Schedule Service
    participant N as Notification Service

    P->>API: POST /contests/:id/open
    API->>DB: Load contest DRAFT owned by provider
    API->>DB: Validate contest_cafes count > 0
    API->>DB: Validate capacity, entry_fee, time range, registration window, vehicle_rule
    API->>S: Check track/time conflict per participating cafe
    alt Conflict
        API-->>P: 409 CONTEST_SCHEDULE_CONFLICT
    else Available
        S->>DB: INSERT cafe_schedule_blocks per cafe (Phase 1B)
        API->>DB: Contest DRAFT -> OPEN via transition service
        API->>N: Notify / publish contest announcement
        API-->>P: Contest OPEN
    end
```

Notes:

- Public listing bắt đầu hiển thị khi `OPEN`.
- `/cafes/:cafeId/contests` chỉ trả contest có cafe đó trong `contest_cafes`.

---

## 3. Customer đăng ký contest chung

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
    API-->>W: Contest detail + participating cafes + remaining capacity
    C->>W: Chọn vehicle_source RENTAL/BYOC
    W->>API: POST /contests/:id/register
    API->>DB: BEGIN transaction
    API->>DB: Lock contest row / capacity counter
    API->>DB: Validate contest OPEN + registration window
    API->>DB: Validate one registration per user
    API->>DB: Validate vehicle_rule
    API->>DB: INSERT contest_registrations(status=PENDING, participant_role_snapshot=CUSTOMER)
    alt entry_fee = 0
        API->>DB: registration PENDING -> CONFIRMED
        API->>DB: COMMIT
        API->>N: Send registration confirmation
        API-->>W: Registration CONFIRMED + QR
    else entry_fee > 0
        API->>DB: COMMIT
        API-->>W: Registration PENDING + manual payment required in MVP
        Pay-->>API: Payment success callback in Phase 1B
        API->>DB: registration PENDING -> CONFIRMED
    end
```

Important:

- Capacity check must be transactional.
- Customer không chọn chi nhánh trong MVP.
- `CONTEST_ENTRY` should link to `contest_registration_id` or a generic payment subject in Phase 1B.
- Do not create fake `bookings` for contest payment.

---

## 4. Provider participant registration — Phase 1C

```mermaid
sequenceDiagram
    autonumber
    participant RP as Registering Provider
    participant W as Web App
    participant API as API
    participant DB as PostgreSQL

    RP->>W: Chọn contest của Provider khác
    W->>API: POST /contests/:id/register
    API->>DB: Load contest
    alt contest.provider_id == current user id
        API-->>W: 403 CONTEST_SELF_REGISTRATION_FORBIDDEN
    else Other Provider contest
        API->>DB: Validate OPEN + capacity + registration window
        API->>DB: INSERT contest_registrations(participant_role_snapshot=PROVIDER)
        API-->>W: Registration status
    end
```

---

## 5. Payment timeout / cancel registration

```mermaid
sequenceDiagram
    autonumber
    participant Job as Scheduler Job
    participant C as Participant
    participant API as API
    participant DB as PostgreSQL
    participant Pay as Payment Engine
    participant N as Notification Service

    alt Payment timeout
        Job->>DB: Find PENDING registrations past payment deadline
        Job->>DB: registration PENDING -> CANCELLED
        Job->>DB: Release capacity / promote waitlist if exists
        Job->>N: Notify participant
    else Participant cancels before cutoff
        C->>API: POST /contest-registrations/:id/cancel
        API->>DB: Validate cancellable status/window
        API->>Pay: Refund by contest refund_policy in Phase 1B
        API->>DB: registration -> CANCELLED
        API->>DB: Release capacity / promote waitlist if exists
        API->>N: Notify participant/provider
    end
```

---

## 6. Close registration and prepare event

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider
    participant API as API
    participant DB as PostgreSQL
    participant N as Notification Service

    P->>API: POST /contests/:id/close
    API->>DB: Validate contest OPEN owned by provider
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

## 7. Event day check-in

```mermaid
sequenceDiagram
    autonumber
    participant S as Staff/Provider
    participant W as Staff App
    participant API as API
    participant DB as PostgreSQL
    participant Store as Cloudinary
    participant C as Participant

    C->>S: Đưa QR / mã registration
    S->>W: Scan QR + select checked_in_cafe_id
    W->>API: POST /contest-registrations/:id/check-in
    API->>DB: Validate registration CONFIRMED
    API->>DB: Validate checked_in_cafe_id belongs to contest_cafes
    API->>DB: Validate Staff assigned to cafe if role STAFF
    alt RENTAL
        API->>DB: Assign rental car from contest/cafe pool
    else BYOC
        S->>API: Submit BYOC tech-check checklist
    end
    opt Evidence required
        S->>Store: Upload photos/checklist
        W->>API: Submit contest evidence metadata
        API->>DB: Save inspection/tech-check metadata
    end
    API->>DB: registration CONFIRMED -> CHECKED_IN
    API-->>W: Checked in + assigned vehicle/car number
```

Notes:

- For `RENTAL_SPEC_CUP`, assign at check-in to keep race fair.
- `checked_in_cafe_id` is the actual branch where the participant arrives.

---

## 8. Start contest and run heats/results

```mermaid
sequenceDiagram
    autonumber
    participant RD as Race Director/Provider
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
    API->>DB: Publish final leaderboard snapshot
    API->>DB: Create contest_reward_claims from contest_rewards
    API->>DB: Contest RUNNING -> COMPLETED
    API->>N: Notify participants final result and rewards
    API-->>Board: Publish final leaderboard/podium
```

---

## 10. Cancel contest and refund

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider
    participant API as API
    participant DB as PostgreSQL
    participant Pay as Payment Engine
    participant N as Notification Service

    P->>API: POST /contests/:id/cancel
    API->>DB: Validate contest owned by provider and not COMPLETED
    API->>DB: Contest -> CANCELLED
    API->>DB: Load paid/confirmed registrations
    loop Each paid registration
        API->>Pay: Refund CONTEST_ENTRY 100% in Phase 1B
        API->>DB: registration -> CANCELLED
    end
    API->>DB: Release schedule blocks per participating cafe
    API->>N: Notify participants
```

---

## 11. Edge sequence: result protest / incident

```mermaid
sequenceDiagram
    autonumber
    participant C as Participant
    participant API as API
    participant DB as DB
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
