# BR-Payment — Quy tắc nghiệp vụ: Thanh toán

**Last updated**: 2026-05-15
**Status**: Active

> **THAY ĐỔI:** Settlement giờ trigger bởi `session.COMPLETED` (không phải `booking.COMPLETED`).
> Mỗi session settle riêng. Booking chỉ xác nhận đã thanh toán xong khi tất cả sessions settled.
> Multi-vehicle: mỗi xe có RENTAL_FEE + SECURITY_DEPOSIT riêng.

## 1. Nguyên tắc cốt lõi

**BR-PM-001** — Snapshot-first  
Mọi tính toán tiền đều đọc từ `booking.snapshot` — KHÔNG dùng giá hiện tại của Cafe hoặc Vehicle

**BR-PM-002** — Immutable ledger  
Không được update `amount` của PaymentComponent đã tạo. Nếu cần điều chỉnh → tạo component mới

**BR-PM-003** — Component isolation  
Mỗi PaymentComponent có vòng đời độc lập (PENDING → HELD → DISBURSED / REFUNDED)

---

## 2. Tạo components

**BR-PM-004** — Components khi booking CONFIRMED  
IF: Booking chuyển sang CONFIRMED (thanh toán thành công)  
THEN: Tạo các components sau:
- `SLOT_FEE` (HELD) — luôn tạo
- `RENTAL_FEE` (HELD) — tạo cho mỗi xe thuê trong `booking_vehicles`
- `SECURITY_DEPOSIT` (HELD) — tạo cho mỗi xe thuê trong `booking_vehicles`

**BR-PM-004a** — FB_PREORDER component
IF: Booking có F&B pre-order
THEN: Tạo `FB_PREORDER` (HELD) component, gộp vào 1 lần thanh toán

**BR-PM-005** — Extension fee component  
IF: Extension được approve (theo session)  
THEN: Tạo `EXTENSION_FEE` (HELD), liên kết `session_id`; cộng dồn tổng không vượt 50% security_deposit

**BR-PM-006** — Damage charge component  
IF: Check-out có damage và customer confirm (hoặc auto-confirm)  
THEN: Tạo `DAMAGE_CHARGE` (HELD → DISBURSED)

---

## 3. Settlement khi COMPLETED

**BR-PM-007** — Disburse về Provider (khi session COMPLETED)
Khi session COMPLETED, disburse các components sau về Provider cho session đó:
- `SLOT_FEE` (toàn bộ hoặc pro-rata nếu early checkout)
- `RENTAL_FEE` (từng xe)
- `EXTENSION_FEE`
- `DAMAGE_CHARGE` (nếu có)

**BR-PM-008** — Hoàn deposit về Customer (khi session COMPLETED)
Khi session COMPLETED:
- Nếu không có damage: hoàn 100% `SECURITY_DEPOSIT` về Customer
- Nếu có damage: hoàn phần còn lại sau khi trừ `DAMAGE_CHARGE`

**BR-PM-009** — Platform fee  
```
platform_fee = 15% × tổng amount disbursed về Provider
```
Tính trên: SLOT_FEE + RENTAL_FEE + EXTENSION_FEE + DAMAGE_CHARGE  
KHÔNG tính trên: SECURITY_DEPOSIT (tiền của Customer, không phải doanh thu)  
Platform fee = 0% trên F&B (cả pre-order và on-site)

---

## 4. Refund rules

**BR-PM-010** — R1: Customer huỷ (theo thời điểm)

| Thời điểm huỷ | SLOT_FEE | RENTAL_FEE | DEPOSIT |
|---------------|----------|-----------|---------|
| > 24h trước slot_start | 100% | 100% | 100% |
| 12–24h trước slot_start | 50% | 100% | 100% |
| < 12h trước slot_start | 0% | 100% | 100% |
| Sau CHECK_IN (early checkout) | Pro-rata | 0% | Sau damage check |

**Pro-rata formula (early checkout):**
```
refund_slot_fee = slot_fee_total × (remaining_minutes / total_booked_minutes)
```

**BR-PM-011** — R2: Provider huỷ  
IF: Provider huỷ booking  
THEN: Hoàn 100% tất cả components. Platform KHÔNG thu phí.

**BR-PM-012** — R3: Timeout / No-show  
IF: Customer no-show (không check-in trong 30 phút sau slot_start)  
THEN:
- SLOT_FEE: hoàn 0%
- RENTAL_FEE: hoàn 100%
- SECURITY_DEPOSIT: hoàn 100%

---

## 5. Damage charge

**BR-PM-013** — Công thức tính damage  
```
damage_charge = base_damage_cost × vehicle.damage_multiplier
```

**BR-PM-014** — Damage trong giới hạn deposit  
IF: `damage_charge ≤ security_deposit`  
THEN: Trừ vào deposit, hoàn phần còn lại về Customer

**BR-PM-015** — Damage vượt deposit  
IF: `damage_charge > security_deposit`  
THEN: Trừ toàn bộ deposit. Tạo charge request bổ sung (xử lý thủ công — ngoài scope MVP)

**BR-PM-016** — Pre-existing damage không tính  
IF: Hư hỏng đã được flag ở check-in (`pre_existing_flag = true`) VÀ customer đã confirm  
THEN: KHÔNG tính `damage_charge` cho hư hỏng đó

---

## 6. F&B payment

**BR-PM-017** — F&B pre-order: gộp 1 transaction  
IF: Customer đặt F&B pre-order khi booking  
THEN: Thanh toán F&B pre-order gộp cùng booking fee vào 1 lần qua gateway

**BR-PM-018** — F&B on-site: ngoài platform  
IF: Staff ghi F&B order tại quán  
THEN: Customer trả thẳng Provider (tiền mặt hoặc chuyển khoản). Platform không xử lý khoản này.
