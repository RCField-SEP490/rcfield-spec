# BR-Booking — Quy tắc nghiệp vụ: Đặt lịch

**Last updated**: 2026-05-13  
**Status**: Active

---

## 1. Tạo booking

**BR-BK-001** — Snapshot giá tại thời điểm tạo  
IF: Customer tạo booking  
THEN: System snapshot toàn bộ giá (slot_fee_rate, rental_fee, security_deposit, damage_multiplier, platform_fee_pct) vào `booking.snapshot`  
NOTE: Mọi tính toán tiền SAU ĐÓ đều dùng snapshot — không dùng giá hiện tại của Cafe/Vehicle

**BR-BK-002** — Booking mode  
IF: Customer chọn xe từ fleet của quán  
THEN: `mode = RENTAL`, `vehicle_id` bắt buộc  
IF: Customer mang xe cá nhân  
THEN: `mode = BYOC`, `vehicle_id = null`

**BR-BK-003** — Cafe phải ACTIVE  
IF: Cafe có `status ≠ ACTIVE`  
THEN: Không cho phép tạo booking tại cafe đó

**BR-BK-004** — Không được đặt trùng slot  
IF: Xe đã có booking CONFIRMED hoặc ACTIVE trong khung giờ đó  
THEN: Từ chối booking mới cho xe đó trong cùng khung giờ

**BR-BK-005** — Booking channels  
Customer có thể tạo booking qua 3 kênh:
- App trực tiếp (Customer tự đặt)
- Shareable link (Provider/Staff tạo link → Customer bấm vào đặt)
- Staff tạo thủ công (walk-in hoặc gọi điện)

---

## 2. Thanh toán & xác nhận

**BR-BK-006** — Window thanh toán  
IF: Booking được tạo (status = PENDING)  
THEN: Customer phải hoàn thành thanh toán trong 30 phút  
IF: Quá 30 phút chưa thanh toán  
THEN: Auto-cancel, hoàn tiền 100%

**BR-BK-007** — F&B pre-order gộp vào 1 lần thanh toán  
IF: Customer chọn F&B pre-order khi đặt lịch  
THEN: Tổng thanh toán = booking fee + F&B pre-order fee (1 transaction duy nhất)

---

## 3. Huỷ booking

**BR-BK-008** — Customer huỷ trước 24h  
IF: Customer huỷ và thời điểm huỷ > 24h trước `slot_start`  
THEN: Hoàn 100% SLOT_FEE + 100% RENTAL_FEE + 100% DEPOSIT

**BR-BK-009** — Customer huỷ 12–24h trước giờ chơi  
IF: Customer huỷ và thời điểm huỷ trong khoảng 12–24h trước `slot_start`  
THEN: Hoàn 50% SLOT_FEE + 100% RENTAL_FEE + 100% DEPOSIT

**BR-BK-010** — Customer huỷ dưới 12h trước giờ chơi  
IF: Customer huỷ và thời điểm huỷ < 12h trước `slot_start`  
THEN: Hoàn 0% SLOT_FEE + 100% RENTAL_FEE + 100% DEPOSIT

**BR-BK-011** — Provider/Staff huỷ booking  
IF: Provider hoặc Staff huỷ booking (bất kỳ thời điểm nào)  
THEN: Hoàn 100% tất cả components. Platform KHÔNG thu phí

**BR-BK-012** — Huỷ sau ACTIVE  
IF: Booking đang ở trạng thái ACTIVE  
THEN: Không thể huỷ — chỉ có thể check-out hoặc mở dispute

---

## 4. No-show

**BR-BK-013** — Timeout no-show  
IF: Booking đang CONFIRMED và Staff không check-in trong vòng 30 phút sau `slot_start`  
THEN: Auto-cancel  
- SLOT_FEE: hoàn 0% (phí huỷ muộn)  
- RENTAL_FEE: hoàn 100%  
- SECURITY_DEPOSIT: hoàn 100%

---

## 5. Eligibility

**BR-BK-014** — Eligibility BYOC  
IF: Customer chọn BYOC  
THEN: Không cần điều kiện đặc biệt về trust_score

**BR-BK-015** — Eligibility RENTAL xe STANDARD  
IF: Customer muốn thuê xe STANDARD  
THEN: Cho phép tất cả customer (không phụ thuộc trust_score)

**BR-BK-016** — Eligibility RENTAL xe PREMIUM  
IF: Customer muốn thuê xe PREMIUM  
THEN: Cần đủ điều kiện (điều kiện cụ thể TBD — trust_score hoặc lịch sử booking)

**BR-BK-017** — Eligibility RENTAL xe RESTRICTED  
IF: Customer muốn thuê xe RESTRICTED  
THEN: Hạn chế, cần xét duyệt (trust_score cao, điều kiện cụ thể TBD)
