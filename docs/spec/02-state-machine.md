# 02 — Booking & Session State Machine

**Last updated**: 2026-05-15
**Status**: Active

> ⚠️ **Thay đổi lớn:** Do tách `bookings` và `sessions`, giờ có **2 state machines riêng biệt**.
> - `Booking` states: quản lý vòng đời đơn đặt lịch (từ PENDING → COMPLETED/CANCELLED)
> - `Session` states: quản lý vòng đời phiên chơi thực tế (từ CHECKED_IN → COMPLETED/CANCELLED)
>
> Mọi transition phải qua service layer: `BookingService` hoặc `SessionService`.
> KHÔNG update status trực tiếp.

---

## 1. Booking State Machine

Booking quản lý trạng thái đơn đặt lịch, không liên quan đến vận hành thực tế.

```
         [customer books]
                │
                ▼
          ┌─────────┐
          │ PENDING │ ─── [payment timeout] ──► CANCELLED
          └────┬────┘
               │
      [payment confirmed]
               │
               ▼
          ┌───────────┐
          │ CONFIRMED │ ─── [customer/provider cancels] ──► CANCELLED
          └─────┬─────┘
                │
         [staff check-in starts session]
                │
          ┌──────┴──────┐
          │             │
          ▼             ▼
    ┌──────────┐  ┌──────────┐
    │ NO_SHOW  │  │COMPLETED │  ← booking completed khi session hoàn tất
    └──────────┘  └──────────┘
```

**Booking status routing:**

| Status | Ý nghĩa |
|--------|---------|
| `PENDING` | Đã tạo, chờ thanh toán (TTL 30 phút → auto-cancel) |
| `CONFIRMED` | Đã thanh toán, chờ check-in |
| `CANCELLED` | Bị huỷ (bởi customer/provider/timeout) |
| `NO_SHOW` | Quá hạn check-in, không có session nào được tạo |
| `COMPLETED` | Tất cả sessions đã hoàn tất và settled |

**Transition rules:**

```
Booking chỉ có thể có session nếu status = CONFIRMED.
Khi session đầu tiên được check-in:
  → Booking.status KHÔNG ĐỔI (vẫn CONFIRMED)
Khi tất cả sessions đã COMPLETED:
  → Booking.status → COMPLETED
Khi booking quá hạn check-in mà không có session:
  → Booking.status → NO_SHOW
```

---

## 2. Session State Machine

Session quản lý vòng đời phiên chơi thực tế — đây là state machine vận hành chính.

```
                      ┌──────────────────────────────────────┐
                      │                                      │
          [staff check-in]                            [cancelled before start]
                      │                                      │
                      ▼                                      ▼
            ┌─────────────┐                           ┌───────────┐
            │ CHECKED_IN  │                           │ CANCELLED │
            └──────┬──────┘                           └───────────┘
                   │
         [session starts / vehicle assigned]
                   │
                   ▼
             ┌────────┐
             │ ACTIVE │ ───────────────────────────────────────────┐
             └───┬────┘                                           │
                 │                                                │
      [staff initiates                                   [customer/staff
       extension proposal]                                opens dispute]
                 │                                                │
                 ▼                                                ▼
           ┌───────────┐                                    ┌──────────┐
           │ EXTENDING │                                    │ DISPUTED │
           └─────┬─────┘                                    └────┬─────┘
                 │                                               │
      [customer approves/rejects]                      [admin resolves]
                 │                                               │
                 ▼                                               ▼
            ┌────────┐                                    ┌───────────┐
            │ ACTIVE │  (resumed)                         │ COMPLETED │
            └───┬────┘                                    └───────────┘
                │
      [staff initiates check-out
       + photos + checklist submitted]
                │
                ▼
          ┌──────────────┐
          │ CHECKING_OUT │
          └──────┬───────┘
                 │
      [customer confirms OR auto-confirm]
                 │
         ┌───────┴───────┐
  [no damage]       [damage found & confirmed]
         │                 │
         ▼                 ▼
    ┌───────────┐    ┌───────────┐
    │ COMPLETED │    │ COMPLETED │  (with damage_charge)
    └───────────┘    └───────────┘
         │                 │
         ▼                 ▼
  [settle: disburse   [settle: disburse
   fees, refund       fees, deduct deposit,
   deposit]           disburse damage]
```

---

## 3. Timeout Rules

### Booking timeouts

| State | Timeout | Action |
|-------|---------|--------|
| PENDING | 30 phút | Auto-cancel, hoàn tiền 100% |
| CONFIRMED | slot_start + 30 phút nếu không có session | Auto NO_SHOW, phí huỷ theo R2 |

### Session timeouts

| State | Timeout | Action |
|-------|---------|--------|
| CHECKING_OUT (no damage) | 2 giờ | Auto-confirm: disburse fees, hoàn deposit |
| CHECKING_OUT (damage flagged) | 24 giờ | Auto-confirm damage charge nếu customer im lặng |
| DISPUTED | 72 giờ | Admin phải resolve — escalate nếu quá hạn |

---

## 4. Events (tên dùng trong code)

### Booking events

```typescript
enum BookingEvent {
  PAYMENT_CONFIRMED   = 'PAYMENT_CONFIRMED',   // PENDING → CONFIRMED
  CANCELLED           = 'CANCELLED',           // PENDING/CONFIRMED → CANCELLED
  TIMEOUT             = 'TIMEOUT',             // PENDING → CANCELLED / CONFIRMED → NO_SHOW
  ALL_SESSIONS_DONE   = 'ALL_SESSIONS_DONE',   // CONFIRMED → COMPLETED
}
```

### Session events

```typescript
enum SessionEvent {
  CHECK_IN_COMPLETED    = 'CHECK_IN_COMPLETED',    // SCHEDULED → CHECKED_IN
  SESSION_STARTED       = 'SESSION_STARTED',        // CHECKED_IN → ACTIVE
  EXTENSION_INITIATED   = 'EXTENSION_INITIATED',    // ACTIVE → EXTENDING
  EXTENSION_APPROVED    = 'EXTENSION_APPROVED',     // EXTENDING → ACTIVE
  EXTENSION_REJECTED    = 'EXTENSION_REJECTED',     // EXTENDING → ACTIVE
  CHECKOUT_INITIATED    = 'CHECKOUT_INITIATED',     // ACTIVE → CHECKING_OUT
  CUSTOMER_CONFIRMED    = 'CUSTOMER_CONFIRMED',     // CHECKING_OUT → COMPLETED
  DAMAGE_DISPUTED       = 'DAMAGE_DISPUTED',        // CHECKING_OUT → DISPUTED
  DISPUTE_OPENED        = 'DISPUTE_OPENED',          // ACTIVE → DISPUTED
  DISPUTE_RESOLVED      = 'DISPUTE_RESOLVED',        // DISPUTED → COMPLETED
  TIMEOUT               = 'TIMEOUT',                 // xử lý theo từng state
  CANCELLED             = 'CANCELLED',               // SCHEDULED → CANCELLED
}
```

---

## 5. Session → Booking status mapping

| Session status cuối cùng | Booking status |
|--------------------------|----------------|
| Có ít nhất 1 session COMPLETED | COMPLETED |
| Không có session nào (hết giờ check-in) | NO_SHOW |
| CANCELLED (trước check-in) | CANCELLED (nếu không còn session khác) |

---

## 6. Flow examples

### Flow bình thường (RENTAL, 1 xe, không incident)

```
[App] Customer books → Booking.PENDING
[Payment] → Booking.CONFIRMED
[Staff] Check-in → Session.CHECKED_IN → ACTIVE
[Staff] Check-out → Session.CHECKING_OUT
[Customer] Confirm → Session.COMPLETED
→ Booking.COMPLETED
```

### Flow có extension + dispute

```
...Session.ACTIVE
[Staff] Propose extension → Session.EXTENDING
[Customer] Approve → Session.ACTIVE (with extended slot_end)
[Staff] Check-out → Session.CHECKING_OUT (damage found)
[Customer] Dispute damage → Session.DISPUTED
[Admin] Resolve → Session.COMPLETED (with damage_charge confirmed)
→ Booking.COMPLETED
```

### Flow no-show

```
...Booking.CONFIRMED
[System] Timeout (30 phút sau slot_start, không có session)
→ Booking.NO_SHOW
```

---

## Reference

- `docs/spec/01-domain-model.md` — Entity definitions
- `docs/spec/03-payment-engine.md` — Settlement khi COMPLETED
- `docs/spec/04-inspection-flow.md` — Check-in / Check-out protocol
- `docs/spec/business-rules/BR-booking.md` — Booking business rules

---

*Last updated: 2026-05-15*

            ┌───────┴───────┐
     [no damage]       [damage found]
            │                 │
            ▼                 ▼
       COMPLETED          CHECKING_OUT (disputed)
                               │
                    [customer disputes damage]
                               │
                               ▼
                          DISPUTED
                               │
                    [admin resolves]
                               │
                               ▼
                          COMPLETED
```

---

## Timeout Rules

| State | Timeout | Action khi hết giờ |
|-------|---------|-------------------|
| PENDING | 30 phút | Auto-cancel, hoàn tiền 100% |
| CONFIRMED → không check-in | slot_start + 30 phút | Auto-cancel nếu staff không check-in, phí huỷ theo R2 |
| CHECKING_OUT (no damage) | 2 giờ | Auto-confirm: disburse slot_fee + rental_fee, hoàn deposit |
| CHECKING_OUT (damage flagged) | 24 giờ | Auto-confirm damage charge nếu customer im lặng |
| DISPUTED | 72 giờ | Admin phải resolve — escalate nếu quá hạn |

---

## Events (tên dùng trong code)

```typescript
enum BookingEvent {
  PAYMENT_CONFIRMED     = 'PAYMENT_CONFIRMED',      // PENDING → CONFIRMED
  CHECK_IN_COMPLETED    = 'CHECK_IN_COMPLETED',      // CONFIRMED → ACTIVE
  EXTENSION_INITIATED   = 'EXTENSION_INITIATED',     // ACTIVE → EXTENDING
  EXTENSION_APPROVED    = 'EXTENSION_APPROVED',      // EXTENDING → ACTIVE
  EXTENSION_REJECTED    = 'EXTENSION_REJECTED',      // EXTENDING → ACTIVE
  CHECKOUT_INITIATED    = 'CHECKOUT_INITIATED',      // ACTIVE → CHECKING_OUT
  CUSTOMER_CONFIRMED    = 'CUSTOMER_CONFIRMED',      // CHECKING_OUT → COMPLETED
  DAMAGE_DISPUTED       = 'DAMAGE_DISPUTED',         // CHECKING_OUT → DISPUTED
  DISPUTE_OPENED        = 'DISPUTE_OPENED',          // ACTIVE → DISPUTED
  DISPUTE_RESOLVED      = 'DISPUTE_RESOLVED',        // DISPUTED → COMPLETED
  TIMEOUT               = 'TIMEOUT',                 // xử lý theo từng state
  CANCELLED             = 'CANCELLED',               // PENDING/CONFIRMED → CANCELLED
}
```

---

## Edge Cases cần handle

1. **Extension trong CHECKING_OUT**: không cho phép — staff đã bắt đầu check-out
2. **Dispute sau COMPLETED**: không cho phép — window đã đóng
3. **Multiple extension**: cho phép, nhưng tổng extension_fee không vượt 50% security_deposit
4. **BYOC check-in**: không có vehicle để lấy từ fleet — staff chỉ chụp ảnh cơ sở vật chất + kiểm tra xe của customer
5. **Staff không hoàn thành checklist**: `pre_existing_flag` không có giá trị pháp lý nếu thiếu ảnh

---

## Implementation Note

Dùng NestJS + một state machine library (ví dụ `xstate` hoặc tự implement với enum guard):

```typescript
// bookings/booking.state-machine.ts
export function canTransition(
  currentStatus: BookingStatus,
  event: BookingEvent
): boolean { ... }

// bookings/bookings.service.ts
async transition(bookingId: string, event: BookingEvent, payload?: any) {
  const booking = await this.findOneOrFail(bookingId);
  if (!canTransition(booking.status, event)) {
    throw new BadRequestException(`Cannot ${event} from ${booking.status}`);
  }
  // ... apply transition
}
```
