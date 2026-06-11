# Architecture: Contest & Race Event

**Last Updated:** 2026-06-11  
**Spec refs:** `docs/spec/business-rules/BR-contest.md`, `docs/spec/01-domain-model.md`, `docs/spec/06-database.md`

---

## 1. Intent

Contest là module tổ chức sự kiện đua RC do Provider tạo và chọn nhiều chi nhánh tham gia. Nó phục vụ mục tiêu
"kết nối mọi người lại với nhau" bằng cách biến RCField từ nền tảng đặt lịch cá
nhân thành nơi Provider/cafe có thể tạo hoạt động cộng đồng: giải đua, time attack,
rental spec cup, BYOC race, party race và sau này là leaderboard/series.

Nguyên tắc kiến trúc:

```
CONTEST = event operations
BOOKING = planned play slot
SESSION = actual play session
```

Contest không nên bị ép thành một booking thường. Booking/session đang tối ưu cho
khách đặt giờ chơi, còn Contest cần quản lý đăng ký, rule, schedule, participant
check-in, kết quả, leaderboard và giải thưởng.

---

## 2. Phase Boundary

| Phase | Tên | Mục tiêu | Có thể dùng schema hiện tại? |
|---|---|---|---|
| Phase 1A | Registration MVP | Provider tạo contest multi-branch, public listing, customer đăng ký, staff/provider check-in | Cần `contest_cafes` |
| Phase 1C | Provider Participant | Provider đăng ký contest của Provider khác như racer | Có |
| Phase 1B | Operational Contest Core | Chạy contest thật mà không trùng booking/fleet/payment | Cần bổ sung nhẹ |
| Phase 2 | Race Management Core | Class, round, heat, result, leaderboard, reward | Cần bảng mới |
| Phase 2B | Large Tournament Controls | Protest, officials, bracket, audit, lap import | Cần bảng mới |
| Phase 3 | Community Expansion | Series, season points, multi-branch leaderboard, racer profile | Cần domain mới |
| Phase 4 | Timing Automation | Import/integrate transponder, live leaderboard, auto heat generation | Cần integration |

**Scope khuyến nghị cho capstone demo:** Phase 1A + một phần Phase 1B, format
`RENTAL_SPEC_CUP` hoặc `TIME_ATTACK` manual result.

---

## 3. Module Boundary

```mermaid
graph TD
    subgraph Discovery["Discovery"]
        CAFE["Cafe Module\n/cafes"]
        CONTEST_PUBLIC["Contest Public\n/contests\n/cafes/:id/contests\n/contests/:id"]
    end

    subgraph ContestOps["Contest Module"]
        CONTEST["Contest Service\nstate machine + config"]
        REG["Contest Registration Service\ncapacity + payment + check-in"]
        RESULT["Result Service\nmanual result + leaderboard hook"]
    end

    subgraph Operations["Operations Dependencies"]
        FLEET["Fleet/BYOC\nvehicle rule + rental pool"]
        PAYMENT["Payment Engine\nCONTEST_ENTRY"]
        SCHEDULE["Schedule Block\ntrack/time reservation"]
        INSPECTION["Inspection / Tech Check\nrental evidence + BYOC safety"]
        INCIDENT["Incident / Dispute\nrace damage / result protest"]
        NOTIFY["Notification\nregistration + event day"]
    end

    CAFE --> CONTEST_PUBLIC
    CONTEST_PUBLIC --> CONTEST
    CONTEST --> REG
    CONTEST --> RESULT
    CONTEST --> SCHEDULE
    REG --> PAYMENT
    REG --> FLEET
    REG --> INSPECTION
    RESULT --> INCIDENT
    CONTEST --> NOTIFY
```

**Responsibilities:**

| Module | Sở hữu |
|---|---|
| Contest Service | Provider ownership, participating cafes, `ContestStatus`, config validation, open/close/run/complete/cancel |
| Registration Service | Capacity lock, one user per contest in Phase 1A, payment status, provider-participant guard, check-in |
| Result Service | Manual result in Phase 1B, calculated leaderboard in Phase 2 |
| Schedule Block | Reserve track/time so contest does not collide with normal booking |
| Fleet/BYOC | Rental pool, assigned rental vehicle, BYOC eligibility/tech-check |
| Payment Engine | `CONTEST_ENTRY`, refund when contest/register cancelled |
| Incident/Dispute | Damage during race, BYOC/facility incident, result protest |

---

## 4. Current Target Entity Map

Phase 1A target schema:

```mermaid
erDiagram
    users ||--o{ contests : "provider creates"
    contests ||--o{ contest_cafes : "participating branches"
    cafes ||--o{ contest_cafes : "hosts"
    contests ||--o{ contest_registrations : "registrations"
    users ||--o{ contest_registrations : "registers"
    vehicles ||--o{ contest_registrations : "rental vehicle optional"
    customer_vehicles ||--o{ contest_registrations : "BYOC vehicle optional"

    contests {
      uuid id
      uuid provider_id
      string name
      text description
      uuid track_type_id
      jsonb vehicle_rule
      timestamptz starts_at
      timestamptz ends_at
      timestamptz registration_opens_at
      timestamptz registration_closes_at
      integer capacity
      numeric entry_fee
      ContestStatus status
      text banner_image_url
      jsonb config
      uuid created_by
    }

    contest_cafes {
      uuid id
      uuid contest_id
      uuid cafe_id
      string role
      integer capacity_override
      boolean check_in_enabled
      integer display_order
    }

    contest_registrations {
      uuid id
      uuid contest_id
      uuid user_id
      UserRole participant_role_snapshot
      VehicleSource vehicle_source
      uuid vehicle_id
      uuid customer_vehicle_id
      ContestRegistrationStatus status
      string check_in_code
      uuid checked_in_cafe_id
      uuid checked_in_by
      timestamptz checked_in_at
    }
```

This supports:

- Public contest listing globally and by participating cafe.
- Provider-created contest with multiple participating branches.
- Customer registration.
- Basic registration status.
- Rental/BYOC selection.
- Staff/provider check-in at a participating cafe.

This does not support:

- Multiple classes/categories inside one contest.
- Heat/round/final schedule.
- Result/leaderboard.
- Contest payment without payment schema adjustment.
- Waitlist.
- Track/time schedule block.

---

## 5. Target Entity Map

Phase 2 target:

```mermaid
erDiagram
    contests ||--o{ contest_classes : "has classes"
    contest_classes ||--o{ contest_rounds : "rounds"
    contest_rounds ||--o{ contest_heats : "heats"
    contest_heats ||--o{ contest_heat_entries : "grid"
    contest_registrations ||--o{ contest_heat_entries : "runs in"
    contest_heat_entries ||--o{ contest_results : "result"
    contest_results ||--o{ contest_laps : "lap detail"
    contest_classes ||--o{ contest_leaderboard_snapshots : "published board"
    contests ||--o{ contest_rewards : "reward config"
    contest_rewards ||--o{ contest_reward_claims : "issued rewards"
    contest_results ||--o{ contest_result_audits : "corrections"
    contest_results ||--o{ contest_protests : "protests"

    contest_classes {
      uuid id
      uuid contest_id
      string name
      string code
      uuid track_type_id
      string vehicle_policy
      jsonb vehicle_rule
      string scoring_format
      jsonb scoring_config
      integer capacity
    }

    contest_heat_entries {
      uuid id
      uuid heat_id
      uuid registration_id
      integer grid_position
      string car_number
      string status
    }

    contest_results {
      uuid id
      uuid heat_id
      uuid heat_entry_id
      uuid registration_id
      integer lap_count
      integer elapsed_ms
      integer best_lap_ms
      numeric points
      numeric penalty_points
      numeric judge_score
      integer rank
      string status
      uuid verified_by
    }

    contest_rewards {
      uuid id
      uuid contest_id
      uuid contest_class_id
      string reward_scope
      integer rank
      string title
      string reward_type
      jsonb reward_payload
    }

    contest_reward_claims {
      uuid id
      uuid contest_reward_id
      uuid registration_id
      uuid user_id
      string status
    }
```

**Migration principle:** keep Phase 1 `contest_registrations` as the simple entry
table. Use `contest_heat_entries` to map registrations into heats. Introduce a
separate `contest_entries` table only if one registration can later join multiple
classes in the same contest.

---

## 6. State Machines

### ContestStatus

```text
DRAFT
  -> OPEN       [open registration]
  -> CANCELLED

OPEN
  -> CLOSED     [registration closes]
  -> CANCELLED

CLOSED
  -> RUNNING    [event starts]
  -> CANCELLED

RUNNING
  -> COMPLETED  [results verified / event finalized]
  -> CANCELLED  [event aborted]
```

Rules:

- All transitions go through `ContestService.transition(contestId, event)`.
- `OPEN` requires valid config, capacity, time range and vehicle rule.
- `RUNNING` locks critical fields: `track_type`, `entry_fee`, capacity, scoring
  config, prize config and vehicle rule.
- `COMPLETED` is terminal unless a dedicated correction workflow exists.

### ContestRegistrationStatus

```text
PENDING
  -> CONFIRMED  [payment success / free contest / manual confirm]
  -> CANCELLED  [payment timeout / customer cancel]

CONFIRMED
  -> CHECKED_IN [event day check-in]
  -> CANCELLED  [cancel before cutoff]

CHECKED_IN is terminal in Phase 1A.
```

Recommended later statuses:

- `WAITLIST`: contest full, waiting for capacity.
- `NO_SHOW`: confirmed but not checked in.
- `DISQUALIFIED`: failed tech-check or rule violation.

---

## 7. Critical Flows

### 7.1 Create and Open Contest

```mermaid
flowchart TD
    A[Provider creates contest] --> B[Validate provider active + subscription active]
    B --> C[Validate participating cafes ACTIVE + owned by provider]
    C --> D[Save Contest DRAFT + contest_cafes]
    D --> E[Provider configures vehicle_rule, capacity, entry_fee, time range]
    E --> F{Open registration?}
    F -->|No| D
    F -->|Yes| G[Validate config completeness]
    G --> H[Create schedule blocks per participating cafe if Phase 1B]
    H --> I[Contest DRAFT -> OPEN]
```

### 7.2 Register

```mermaid
flowchart TD
    A[Customer registers] --> B[Validate contest OPEN + registration window]
    B --> C[Lock contest/capacity]
    C --> D[Validate vehicle_source + vehicle_rule]
    D --> E[Create registration PENDING]
    E --> F{entry_fee > 0?}
    F -->|No| G[Registration CONFIRMED]
    F -->|Yes| H[Create CONTEST_ENTRY payment]
    H --> I{Payment success?}
    I -->|Yes| G
    I -->|No/Timeout| J[Registration CANCELLED + release capacity]
```

Phase 1C extends this flow by allowing role `PROVIDER` to register only when
`contest.provider_id != currentUser.id`; the registration stores
`participant_role_snapshot = PROVIDER`.

### 7.3 Event Day

```mermaid
flowchart TD
    A[Staff/Provider scans registration QR] --> B[Validate CONFIRMED + checked_in_cafe_id in contest_cafes]
    B --> C{Vehicle source}
    C -->|RENTAL| D[Assign rental car from pool]
    C -->|BYOC| E[Run BYOC tech check]
    D --> F[Registration CHECKED_IN]
    E --> F
    F --> G[Safety briefing + staging]
    G --> H[Run practice/heat/final]
    H --> I[Manual/import result]
    I --> J[Verify result]
    J --> K[Publish leaderboard/podium]
    K --> L[Contest COMPLETED]
```

---

## 8. Payment Integration

Contest uses `PaymentComponentType.CONTEST_ENTRY`, but the current payment schema
requires `booking_id`. Do not create fake bookings for contest payments.

Recommended architecture:

```text
payment_components
  booking_id nullable
  session_id nullable
  contest_registration_id nullable
  type = CONTEST_ENTRY
```

Alternative generic model:

```text
payment_components
  subject_type = BOOKING | SESSION | CONTEST_REGISTRATION | PACKAGE_PURCHASE
  subject_id
```

Phase 1B decision:

- `CONTEST_ENTRY` is paid before registration becomes `CONFIRMED`.
- Provider cancels contest -> refund 100%.
- Customer cancels -> refund by `contest.refund_policy`.
- Platform fee policy must be explicit. Recommended: treat contest entry as
  Provider event revenue, platform fee configurable or same commission as booking
  if the business wants consistency.

---

## 9. Schedule and Capacity

Contest must reserve track/time before it can run. Without this, a cafe can open a
contest at 15:00-17:00 while normal bookings still take the same track.

Recommended Phase 1B table:

```text
cafe_schedule_blocks
  id
  cafe_id
  track_type
  starts_at
  ends_at
  source_type = CONTEST | MAINTENANCE | CLOSURE | MANUAL
  source_id
  created_by
  created_at
```

Booking availability must check:

- Existing bookings.
- Cafe closures.
- Schedule blocks.
- Rental vehicle reserved pool if contest uses rental cars.
- BYOC capacity.

---

## 10. Fleet, BYOC and Inspection

### Rental

For `RENTAL_SPEC_CUP`, assignment should happen at check-in, not registration.
This keeps the race fair and avoids locking a specific car too early.

Required decisions:

- Rental pool: which vehicles are available for contest.
- Damage policy: normal racing wear included or deposit/inspection required.
- Replacement policy: what happens if one rental car fails before a heat.

### BYOC

BYOC registration should not trust self-declared vehicle data blindly. Event-day
tech check must verify the minimum safety/class rule.

Recommended Phase 1B:

- Tech check checklist stored in contest registration metadata or a dedicated table.
- Fail tech check -> registration cancelled/no-show/disqualified depending policy.
- BYOC damage to own car is usually not charged by platform.
- BYOC damage to facility/other cars becomes Incident/Dispute.

---

## 11. Result and Leaderboard

Phase 1B can use manual result:

```text
contest_result_summary
  registration_id
  rank
  best_lap_ms
  lap_count
  elapsed_ms
  note
```

Phase 2 should compute leaderboard from verified `contest_results`.

Scoring formats:

| Format | Sort |
|---|---|
| Time attack | `best_lap_ms ASC`, then second-best lap |
| Race heat/final | `lap_count DESC`, then `elapsed_ms ASC` |
| Points rounds | points by config, explicit tie-breakers |
| Drift judged | `judge_score DESC`, then penalty |
| Crawler trial | `penalty_points ASC`, then elapsed time |

All public results must be traceable to a result row and verifier.

### 11.1 Rewards

Phase 1B/2 rewards should be non-cash and traceable to a final leaderboard/result.

```text
contest_rewards
  reward_scope = FINAL_RANK | BEST_LAP | PARTICIPATION | CUSTOM
  reward_type = VOUCHER | PACKAGE_SLOT | FNB_COUPON | TROPHY_MANUAL | POINTS | CUSTOM

contest_reward_claims
  status = PENDING | ISSUED | CLAIMED | EXPIRED | CANCELLED
```

Rules:

- Do not process cash prize/payout inside Phase 1/2 platform scope.
- Reward claims are created only from verified final standings or verified source results.
- Public reward config must not be reduced after contest is OPEN without audit.

---

## 12. API Surface

Phase 1A:

```text
GET  /contests
GET  /cafes/:cafeId/contests
GET  /contests/:id
POST /contests
PATCH /contests/:id
POST /contests/:id/open
POST /contests/:id/register
GET  /contests/:id/registrations
POST /contest-registrations/:id/check-in
POST /contest-registrations/:id/cancel
POST /contests/:id/cancel
```

Phase 1B/2:

```text
POST /contests/:id/close
POST /contests/:id/start
POST /contests/:id/results
POST /contests/:id/complete
GET  /contests/:id/leaderboard

POST /contests/:id/classes
POST /contests/:id/generate-heats
GET  /contests/:id/schedule
POST /contest-heats/:id/results
POST /contest-results/:id/verify
POST /contests/:id/leaderboard/publish
POST /contests/:id/rewards
POST /contests/:id/rewards/issue
GET  /me/contest-reward-claims
```

---

## 13. Architecture Decisions

| Decision | Recommendation |
|---|---|
| Contest vs Booking | Contest is separate event domain; do not fake booking for entry fee |
| Phase 1 scope | Provider-owned multi-branch registration/check-in MVP |
| First demo format | `RENTAL_SPEC_CUP` or `TIME_ATTACK` |
| Schedule protection | Add schedule block before running real contests |
| Payment | Extend ledger subject to support contest registration |
| Result | Manual result in Phase 1B, calculated leaderboard in Phase 2 |
| Reward | Non-cash rewards and claims in Phase 1B/2; no cash payout |
| Result audit | Required once results can be verified/edited |
| Multi-branch | Phase 1 via `contest_cafes`; championship/series is Phase 3 |
| Provider participant | Phase 1C allows Provider to register contests owned by other providers |
| Transponder/live timing | Phase 4 integration/import |

---

## Reference

- [`docs/spec/business-rules/BR-contest.md`](../spec/business-rules/BR-contest.md) — Full business rules and phase roadmap
- [`docs/spec/06-database.md`](../spec/06-database.md) — Current `contests` and `contest_registrations` schema
- [`docs/spec/03-payment-engine.md`](../spec/03-payment-engine.md) — Payment component rules
- [`docs/spec/business-rules/BR-fleet.md`](../spec/business-rules/BR-fleet.md) — Vehicle status and track compatibility
- [`docs/diagrams/sequence/sequence-flow-contest-lifecycle.md`](../diagrams/sequence/sequence-flow-contest-lifecycle.md) — End-to-end sequence
- [`docs/architecture/diagrams/contest-lifecycle-flow.md`](./diagrams/contest-lifecycle-flow.md) — Flowchart view

