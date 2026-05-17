# 03 — Payment Engine

**Last updated**: 2026-05-15
**Status**: Active

> ⚠️ CRITICAL SPEC. Đọc toàn bộ trước khi viết bất kỳ dòng code nào liên quan đến tiền.
> Viết unit test cho mọi rule trước khi implement.

---

## Nguyên tắc cốt lõi

1. **Snapshot-first**: Mọi tính toán dùng `booking.snapshot`, không dùng giá hiện tại
2. **Component isolation**: Mỗi PaymentComponent có vòng đời độc lập
3. **Immutable ledger**: Không update amount đã tạo — tạo component mới nếu cần điều chỉnh
4. **Platform fee chỉ tính trên consummated**: Nếu refund → platform fee cũng refund theo
5. **Race condition**: Dùng DB transaction + row lock khi update component status
6. **Settlement theo session**: Không phải booking — mỗi session khi COMPLETED sẽ trigger settle riêng

---

## Components & Lifecycle

### Luồng tạo components

```
Khi booking CONFIRMED:
  → tạo: SLOT_FEE (HELD)                      ← luôn tạo
  → tạo: RENTAL_FEE (HELD) per vehicle        ← mỗi xe thuê trong booking_vehicles
  → tạo: SECURITY_DEPOSIT (HELD) per vehicle   ← mỗi xe thuê trong booking_vehicles
  → tạo: FB_PREORDER (HELD)                   ← nếu có pre-order F&B

Khi extension APPROVED (theo session):
  → tạo: EXTENSION_FEE (HELD)
  → liên kết với session_id
  → cộng dồn nếu đã có (tổng không vượt 50% security_deposit)

Khi CHECK_OUT + có damage (theo session):
  → tạo: DAMAGE_CHARGE (PENDING → HELD sau customer confirm)

Khi SESSION COMPLETED:
  → disburse: SLOT_FEE → Provider
  → disburse: RENTAL_FEE → Provider (từng xe)
  → disburse: EXTENSION_FEE → Provider
  → refund: SECURITY_DEPOSIT → Customer (trừ damage nếu có)
  → disburse: DAMAGE_CHARGE → Provider (nếu có)
  → tính platform_fee (15%) trên tổng disbursed về Provider
```

### Lưu ý multi-vehicle

```
Mỗi xe thuê trong booking_vehicles tạo một cặp RENTAL_FEE + SECURITY_DEPOSIT riêng.
Khi settle, deposit được refund/full cho tất cả xe không damage.
Chỉ xe bị damage mới bị trừ deposit tương ứng.
```

---

## Refund Rules

### R1 — Customer huỷ booking

| Thời điểm huỷ | Hoàn SLOT_FEE | Hoàn RENTAL_FEE | Hoàn DEPOSIT |
|---------------|---------------|-----------------|--------------|
| > 24h trước slot_start | 100% | 100% | 100% |
| 12–24h trước slot_start | 50% | 100% | 100% |
| < 12h trước slot_start | 0% | 100% | 100% |
| Sau CHECK_IN (early checkout) | Pro-rata theo giờ thực chơi | 0% | Sau damage check |

**Pro-rata formula (early checkout):**
```
refund_slot_fee = slot_fee_total × (remaining_minutes / total_booked_minutes)
```

### R2 — Provider huỷ booking

Hoàn 100% tất cả components. Platform KHÔNG thu phí.

### R3 — Timeout / No-show

```
Nếu customer no-show (không đến sau slot_start + 30 phút):
  → SLOT_FEE: 0% hoàn (phí huỷ muộn)
  → RENTAL_FEE: 100% hoàn
  → SECURITY_DEPOSIT: 100% hoàn
```

---

## Extension Fee Cap

```
max_extension_fee = security_deposit × 0.50

Nếu customer muốn gia hạn nhưng:
  tổng extension_fee_đã_tích_lũy + extension_fee_mới > max_extension_fee
  → Từ chối extension proposal
  → Thông báo customer đã đạt giới hạn
```

---

## Damage Charge Calculation

```
damage_charge = base_damage_cost × vehicle.damage_multiplier

Nếu damage_charge ≤ security_deposit:
  → Trừ vào security_deposit
  → Hoàn phần còn lại về customer

Nếu damage_charge > security_deposit:
  → Trừ toàn bộ security_deposit
  → Tạo thêm charge request (manual, ngoài scope MVP)
```

**pre_existing_flag ảnh hưởng:**
- Nếu hư hỏng đã được flag ở check-in + customer đã confirm → KHÔNG tính damage_charge cho hư hỏng đó
- Nếu staff không hoàn thành inspection protocol (thiếu ảnh / checklist) → flag không có giá trị

---

## Discount (Mã giảm giá)

> Chi tiết validation và tạo mã: xem `business-rules/BR-promotions.md`

```
subtotal        = slot_fee_total + rental_fee_total
discount_amount = tính từ promotion (PERCENT hoặc FIXED, xem BR-PR-004)
total_charge    = subtotal - discount_amount    ← số tiền customer thực sự trả
```

`security_deposit` KHÔNG bị discount — luôn thu đủ.

Customer thanh toán `total_charge + security_deposit` trong 1 lần qua payment gateway.

---

## Platform Fee

```
platform_fee = 0.15 × sum(disbursed_components_to_provider)

Disbursed components = SLOT_FEE + RENTAL_FEE + EXTENSION_FEE + DAMAGE_CHARGE
  (tính theo giá trị thực tế sau discount, không phải subtotal gốc)
KHÔNG tính trên: SECURITY_DEPOSIT (là tiền của customer)
```

---

## Ví dụ số thực tế

**Setup:**
- Slot 3 tiếng, rate 150k/h → `slot_fee = 450,000đ`
- RENTAL, xe PREMIUM, `rental_fee = 100,000đ`
- `security_deposit = 500,000đ` (theo tier PREMIUM)
- `damage_multiplier = 1.5`

**Case 1: Hoàn thành bình thường, không damage**
```
Disburse → Provider:  450,000 + 100,000 = 550,000đ
Platform fee (15%):   82,500đ (trừ vào Provider)
Refund → Customer:    500,000đ (deposit hoàn full)
```

**Case 2: Early checkout sau 1 tiếng, không damage**
```
Pro-rata slot_fee:    450,000 × (120/180) = 300,000đ hoàn về customer
                      450,000 × (60/180)  = 150,000đ disburse về Provider
Rental_fee:           0đ hoàn (đã dùng xe)
Deposit:              500,000đ hoàn full
Platform fee:         (150,000 + 100,000) × 15% = 37,500đ
```

**Case 3: Hoàn thành, có damage**
```
damage_cost = 200,000đ × 1.5 = 300,000đ
Deposit remaining = 500,000 - 300,000 = 200,000đ hoàn về customer
Disburse → Provider: 450,000 + 100,000 + 300,000 = 850,000đ
Platform fee:        (450,000 + 100,000 + 300,000) × 15% = 127,500đ
```

---

## Implementation Checklist

- [ ] `BookingSnapshot` type đầy đủ, immutable sau khi tạo
- [ ] `PaymentComponentService` — tạo, hold, disburse, refund (từng method riêng)
- [ ] Unit test R1 (3 time windows + pro-rata)
- [ ] Unit test R2, R3
- [ ] Unit test extension fee cap
- [ ] Unit test damage charge (≤ deposit và > deposit)
- [ ] Unit test platform fee calculation
- [ ] Integration test: full booking lifecycle với payment
- [ ] DB transaction + row lock khi concurrent updates
