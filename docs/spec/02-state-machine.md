# 02 — Booking State Machine

**Last updated**: 2026-05  
**Status**: Active

> ⚠️ Đây là spec quan trọng thứ 2 (sau payment engine). Mọi transition phải đi qua `BookingService.transition(bookingId, event)`. KHÔNG update status trực tiếp.

---

## States & Transitions

```
                    ┌─────────────────────────────────────┐
                    │                                     │
         [customer books]                         [customer/provider cancels]
                    │                                     │
                    ▼                                     │
              PENDING ────────────────────────────► CANCELLED
                    │
         [payment confirmed]
                    │
                    ▼
           CONFIRMED ──────────────────────────── CANCELLED
                    │                          (before slot_start - 24h)
         [slot_start reached
          + staff check-in done]
                    │
                    ▼
             ACTIVE ──────────────────────────────────────────┐
                    │                                         │
         [staff initiates                           [customer/staff opens dispute]
          extension proposal]                                 │
                    │                                         ▼
                    ▼                                    DISPUTED
              EXTENDING                                       │
                    │                              [admin resolves]
         [customer approves/rejects]                          │
                    │                                         ▼
                    ▼                                    COMPLETED (với resolution)
             ACTIVE (resumed)
                    │
         [staff initiates check-out
          + photos + checklist submitted]
                    │
                    ▼
           CHECKING_OUT
                    │
         [customer confirms OR
          auto-confirm after timeout]
                    │
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
