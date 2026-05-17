# Sequence Flow: Booking Lifecycle

**Last updated**: 2026-05-16  
**Status**: Reference — đồng bộ với Operational Core Phase 1

End-to-end flow từ khi Customer tạo booking đến khi booking/session hoàn tất hoặc bị huỷ.
Phase 1 dùng `sessions` cho phiên chơi thực tế và dùng `incidents` để log sự cố + kết quả
xử lý theo policy. Workflow dispute nhiều bên là Phase 2.

---

## 0. Identifiers

| Field | Value | Notes |
|-------|-------|-------|
| Play mode | `RENTAL` \| `BYOC` \| `MIXED` | Quyết định rental fee, deposit và BYOC capacity |
| Booking mode | `SINGLE` \| `PACKAGE` \| `SUBSCRIPTION` | Package/subscription là Phase 1 core |
| Booking path | `PENDING → CONFIRMED → COMPLETED` | Booking là kế hoạch đặt lịch |
| Session path | `CHECKED_IN → ACTIVE → EXTENDING → ACTIVE → CHECKING_OUT → COMPLETED` | Session là phiên chơi thực tế |
| Cancel path | `PENDING/CONFIRMED → CANCELLED`; `CONFIRMED → NO_SHOW` | Không huỷ booking đã có session active |
| Incident path | `RECORDED → REVIEWED → RESOLVED/WAIVED` | Không có trạng thái session tranh chấp riêng trong Phase 1 |
| Create booking | `POST /bookings` | Không gửi/lưu xe trực tiếp trên bảng `bookings` |
| Check-in | `POST /bookings/:id/sessions/check-in` | Tạo `sessions`, participants, vehicles thực tế |
| Check-out | `POST /sessions/:id/check-out` | Tạo inspection check-out |
| Raise incident | `POST /sessions/:id/incidents` | Khi có damage hoặc khách phản đối |
| Resolve incident | `POST /incidents/:id/resolve` | Staff/Admin ghi kết quả policy |

---

## 1. Tạo Booking

```mermaid
sequenceDiagram
    autonumber
    participant U as Customer
    participant W as Web App
    participant API as API
    participant DB as PostgreSQL
    participant R as Redis

    U->>W: chọn cafe, slot, play_mode, participants, rental vehicles
    W->>API: POST /bookings
    API->>R: lock slot rental/BYOC
    API->>DB: kiểm tra conflict qua booking_vehicles + bookings
    alt Conflict
        API-->>W: 409 SLOT_CONFLICT
    else Available
        API->>DB: INSERT bookings(status=PENDING, snapshot)
        API->>DB: INSERT booking_participants
        opt RENTAL/MIXED
            API->>DB: INSERT booking_vehicles với price snapshots
        end
        API-->>W: booking + paymentUrl
    end
```

Rule chính:

- Không lưu `vehicle_id` trực tiếp trong `bookings`.
- Xe rental dự kiến nằm ở `booking_vehicles`.
- Xe BYOC chỉ chốt khi check-in qua `session_vehicles.customer_vehicle_id`.
- Giá/policy phải snapshot tại thời điểm booking.

---

## 2. Thanh Toán

```mermaid
sequenceDiagram
    autonumber
    participant W as Web App
    participant API as API
    participant GW as Payment Gateway
    participant DB as PostgreSQL

    W->>GW: Customer thanh toán
    GW-->>W: callback/redirect
    W->>API: POST /bookings/:id/payment/confirm
    API->>GW: verify server-side
    alt Thành công
        API->>DB: INSERT payment_components từ booking.snapshot
        API->>DB: INSERT payment_transactions
        API->>DB: UPDATE bookings.status = CONFIRMED qua transition service
        API-->>W: CONFIRMED
    else Thất bại
        API-->>W: PAYMENT_REQUIRED
    end
```

---

## 3. Check-in: Booking → Session

```mermaid
sequenceDiagram
    autonumber
    participant S as Staff
    participant W as Web App
    participant API as API
    participant ST as Cloudinary
    participant DB as PostgreSQL
    participant C as Customer

    S->>W: mở booking CONFIRMED
    W->>API: POST /bookings/:id/sessions/check-in
    API->>DB: INSERT sessions(status=CHECKED_IN)
    API->>DB: INSERT session_participants từ booking + walk-in guests
    API->>DB: INSERT session_vehicles rental/BYOC thực tế
    S->>W: chụp 4 ảnh + checklist
    W->>ST: upload photos
    W->>API: POST /sessions/:id/inspections/check-in
    API->>DB: INSERT inspections + inspection_photos + inspection_checklists
    API-->>C: yêu cầu xác nhận baseline
    C->>W: confirm hoặc timeout auto-confirm
    API->>DB: UPDATE sessions.status = ACTIVE qua transition service
```

---

## 4. Extension

```mermaid
sequenceDiagram
    autonumber
    participant S as Staff
    participant C as Customer
    participant API as API
    participant DB as PostgreSQL

    S->>API: POST /sessions/:id/extensions
    API->>DB: INSERT extension_proposals(status=PENDING)
    API-->>C: notify proposal
    alt Customer approve
        C->>API: approve
        API->>DB: INSERT payment_components(type=EXTENSION_FEE)
        API->>DB: UPDATE sessions.planned_end_at
        API->>DB: sessions EXTENDING → ACTIVE
    else Reject/timeout
        API->>DB: extension_proposals.status = REJECTED/EXPIRED
        API->>DB: sessions EXTENDING → ACTIVE
    end
```

---

## 5. Check-out + Incident Policy

```mermaid
sequenceDiagram
    autonumber
    participant S as Staff
    participant C as Customer
    participant API as API
    participant ST as Cloudinary
    participant DB as PostgreSQL
    participant PE as Payment Engine

    S->>API: POST /sessions/:id/check-out
    API->>DB: sessions ACTIVE → CHECKING_OUT
    S->>ST: upload 4 check-out photos
    S->>API: POST /sessions/:id/inspections/check-out
    API->>DB: INSERT inspections + photos + checklists
    alt Không damage
        C->>API: confirm hoặc timeout
        API->>PE: settle(sessionId)
        API->>DB: sessions CHECKING_OUT → COMPLETED
    else Có damage hoặc khách phản đối
        API->>DB: INSERT incidents(status=RECORDED)
        API-->>C: xem evidence + policy
        API->>DB: UPDATE incidents(status=REVIEWED)
        API->>DB: UPDATE incidents responsible_party/final_amount/resolution_note
        API->>DB: incidents.status = RESOLVED hoặc WAIVED
        opt final_amount > 0
            API->>PE: create DAMAGE_CHARGE component
        end
        API->>PE: settle(sessionId)
        API->>DB: sessions CHECKING_OUT → COMPLETED
    end
```

Incident được xem là done khi có `status`, `responsible_party`, `final_amount`,
`resolution_note`, `resolved_by`, `resolved_at`. Evidence dùng lại inspection photos/checklists.
Nếu cần dispute nhiều bên, upload evidence riêng hoặc arbitration nhiều bước, chuyển sang Phase 2.

---

## 6. Completion

```mermaid
sequenceDiagram
    autonumber
    participant API as API
    participant PE as Payment Engine
    participant DB as PostgreSQL

    API->>PE: settle(sessionId)
    PE->>DB: SLOT_FEE/RENTAL_FEE/EXTENSION_FEE/FNB/PACKAGE/CONTEST settlement
    PE->>DB: DAMAGE_CHARGE nếu incident resolved có final_amount > 0
    PE->>DB: refund/capture SECURITY_DEPOSIT theo policy
    API->>DB: release rental vehicles về AVAILABLE nếu applicable
    API->>DB: nếu mọi sessions completed → bookings.status = COMPLETED
```

---

## Reference

- `docs/spec/00-overview.md` — Scope và roadmap
- `docs/spec/01-domain-model.md` — Entity model và enums
- `docs/spec/02-state-machine.md` — Booking/session transitions
- `docs/spec/03-payment-engine.md` — Payment components
- `docs/spec/04-inspection-flow.md` — Inspection protocol
- `docs/spec/05-api-contracts.md` — API surface
