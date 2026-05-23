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

### Luồng thanh toán 2 bước

```
Bước 1 — Khi booking CONFIRMED:
  → charge: SECURITY_DEPOSIT (HELD) per vehicle  ← charge NGAY qua gateway
  → tạo:    SLOT_FEE     (PENDING)               ← ghi nhận, tính vào checkout
  → tạo:    RENTAL_FEE   (PENDING) per vehicle   ← ghi nhận, tính vào checkout
  → tạo:    FNB_PREORDER (PENDING)               ← ghi nhận, tính vào checkout

Khi extension APPROVED (trong session):
  → tạo: EXTENSION_FEE (PENDING)                 ← ghi nhận, tính vào checkout
  → tổng extension fees không vượt 50% security_deposit

Khi CHECK_OUT + có damage (customer confirm):
  → tạo: DAMAGE_CHARGE (PENDING)                 ← tính vào checkout

Bước 2 — Khi SESSION COMPLETED (checkout):
  total_charges    = SLOT_FEE + RENTAL_FEE + EXTENSION_FEE + FNB_PREORDER + DAMAGE_CHARGE
  checkout_amount  = total_charges − security_deposit

  → txn: CAPTURE checkout_amount
  → disburse: tất cả components (bao gồm SECURITY_DEPOSIT) → Provider
  → tính platform_fee (15%) trên (total_charges − FNB_PREORDER nếu tách)
```

**Ví dụ số (không damage, có extension):**
```
total_charges   = 50 + 300 + 75 + 60 = 485k
checkout_amount = 485k − 300k cọc = 185k   ← khách chỉ phải trả thêm 185k
Khách đã trả:   300k (cọc) + 185k (checkout) = 485k ✓
```

**Ví dụ số (có damage 300k):**
```
total_charges   = 485k + 300k damage = 785k
checkout_amount = 785k − 300k cọc = 485k
Khách đã trả:   300k (cọc) + 485k (checkout) = 785k ✓
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

> SLOT_FEE và RENTAL_FEE chưa được charge (PENDING) — "không hoàn" = không charge; "charge" = tạo payment mới.
> DEPOSIT đã HELD — "void" = release hold (không phải refund transaction).

| Thời điểm huỷ | SLOT_FEE | RENTAL_FEE | DEPOSIT |
|---------------|----------|------------|---------|
| > 24h trước slot_start | Không charge (CANCELLED) | Không charge | VOID (released) |
| 12–24h trước slot_start | Charge 50% (phạt) | Không charge | VOID (released) |
| < 12h trước slot_start | Charge 100% (phạt) | Không charge | VOID (released) |
| Sau CHECK_IN (early checkout) | Charge pro-rata theo giờ thực chơi | Charge 100% (đã dùng xe) | VOID sau damage check |

**Pro-rata formula (early checkout):**
```
refund_slot_fee = slot_fee_total × (remaining_minutes / total_booked_minutes)
```

### R2 — Provider huỷ booking

Hoàn 100% tất cả components. Platform KHÔNG thu phí.

### R3 — Timeout / No-show

```
Nếu customer no-show (không đến sau slot_start + 30 phút):
  → SLOT_FEE:        charge 100% (phạt no-show) → txn: PAYMENT slot_fee → DISBURSED Provider
  → RENTAL_FEE:      CANCELLED (xe chưa dùng, không charge)
  → SECURITY_DEPOSIT: VOID (hold released, không charge)
  → FNB_PREORDER:    CANCELLED (không charge)
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

**Bước 1 (booking confirm)**: Customer thanh toán `security_deposit` → HELD.
**Bước 2 (checkout)**: Platform CAPTURE `total_charges − security_deposit`.

```
total_charges = slot_fee + rental_fee + fnb_preorder + extension_fee + damage_charge
checkout_amount = total_charges − security_deposit   ← số tiền thực trả lúc checkout
```

`security_deposit` KHÔNG bị discount — luôn thu đủ theo giá trị xe.

---

## Platform Fee

```
platform_fee = 0.15 × sum(disbursed_components_to_provider)

Disbursed components = SLOT_FEE + RENTAL_FEE + EXTENSION_FEE + DAMAGE_CHARGE
  (tính theo giá trị thực tế sau discount, không phải subtotal gốc)
KHÔNG tính trên: SECURITY_DEPOSIT (là tiền của customer)
```

---

## Cách tính security_deposit

`security_deposit = vehicle.market_value × 15%`

Field trực tiếp trên bảng `vehicles`, Provider đặt khi thêm xe vào fleet.

```
VD: xe Traxxas TRX-4 trị giá 2,000,000đ → security_deposit = 300,000đ  (15%)
    xe Arrma Kraton trị giá 5,000,000đ  → security_deposit = 750,000đ  (15%)
    xe STANDARD mini trị giá 500,000đ   → security_deposit = 75,000đ   (15%)
```

Khi booking được tạo → `booking_vehicles.security_deposit_snapshot` lấy giá trị này (không đổi về sau).

**Tại checkout:**
- Không damage → VOID authorization (hold released, không charge thêm, **không refund**)
- Có damage    → CAPTURE (damage_charge ≤ deposit: capture phần damage + void phần còn lại)
                          (damage_charge > deposit: capture toàn bộ + additional charge out of scope)

---

## Ví dụ số thực tế

**Setup:**
- Slot 3 tiếng, rate 150k/h → `slot_fee = 450,000đ`
- RENTAL, xe PREMIUM (Traxxas TRX-4, trị giá 8M), `rental_fee = 100,000đ`
- `security_deposit = 800,000đ` (Provider đặt theo giá trị xe ~8,000,000đ)
- `damage_multiplier = 1.5`

**Setup:**
- Xe trị giá 2,000,000đ → `security_deposit = 300,000đ` (15%)
- Slot 2 tiếng, `slot_fee = 50,000đ`
- RENTAL, `rental_fee = 300,000đ` (150k/h × 2h)
- `damage_multiplier = 1.5`

**Case 1: Hoàn thành bình thường, không damage**
```
total_charges   = 50,000 + 300,000 = 350,000đ
checkout_amount = 350,000 − 300,000 = 50,000đ  ← khách trả thêm 50k
Khách tổng:     300k (cọc) + 50k (checkout) = 350,000đ

Disburse → Provider:  350,000đ
Platform fee (15%):   52,500đ
Provider nhận:        297,500đ
```

**Case 2: Early checkout sau 1 tiếng, không damage**
```
Pro-rata slot_fee:    50,000 × (60/120) = 25,000đ
total_charges   = 25,000 + 300,000 = 325,000đ  (rental tính đủ vì đã dùng xe)
checkout_amount = 325,000 − 300,000 = 25,000đ  ← khách trả thêm 25k
Khách tổng:     300k + 25k = 325,000đ
Platform fee:   325,000 × 15% = 48,750đ
```

**Case 3: Hoàn thành, có damage**
```
damage_cost     = 200,000đ × 1.5 = 300,000đ
total_charges   = 50,000 + 300,000 + 300,000 = 650,000đ
checkout_amount = 650,000 − 300,000 = 350,000đ  ← khách trả thêm 350k
Khách tổng:     300k (cọc) + 350k (checkout) = 650,000đ

Disburse → Provider:  650,000đ
Platform fee (15%):   97,500đ
Provider nhận:        552,500đ
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
