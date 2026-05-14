# BR-Booking — Quy tắc nghiệp vụ: Đặt lịch

**Last updated**: 2026-05-14  
**Status**: Active

---

## 1. Slot system

**BR-BK-000-A** — Fixed slots  
Hệ thống generate sẵn các khung giờ theo `cafe.slot_duration_minutes`:
```
slot_duration = 60 phút → slots: 09:00, 10:00, 11:00, ..., 21:00
slot_duration = 90 phút → slots: 09:00, 10:30, 12:00, ..., 19:30
```
Customer chỉ được chọn `slot_start` trùng với boundary đó — không tự nhập giờ tự do.

**BR-BK-000-B** — Multi-slot booking  
Customer chọn giờ bắt đầu + số tiếng (1h / 2h / 3h / 4h):
```
slot_start = 10:00, slot_count = 2 → slot_end = 12:00
```
Hệ thống check tất cả N slots liên tiếp đều available trước khi cho đặt.

**BR-BK-000-C** — Availability check RENTAL  
IF: Customer muốn đặt xe X cho sân T trong khung giờ T  
THEN: Xe X available khi:
1. `vehicle.status = AVAILABLE`
2. Không có booking nào của xe X với `status NOT IN ('CANCELLED')` overlap khung giờ T
3. `vehicle.compatible_track_types` rỗng **HOẶC** chứa `booking.track_type` customer chọn

**BR-BK-000-D** — Availability check BYOC  
IF: Customer muốn đặt BYOC trong khung giờ T  
THEN: BYOC available khi:
1. Số BYOC booking trong khung giờ T có `status NOT IN ('CANCELLED')` < `cafe.byoc_capacity`
2. `booking.track_type` phải thuộc `cafe.track_types` (sân đó phải tồn tại tại chi nhánh)  
NOTE: Hệ thống KHÔNG kiểm tra xe của customer có phù hợp sân không — customer tự chịu trách nhiệm

**BR-BK-000-E** — Nhiều khách cùng slot  
Nhiều customer có thể book cùng 1 khung giờ nếu mỗi người đặt xe khác nhau (RENTAL) hoặc còn chỗ BYOC:
```
Slot 10:00–11:00:
  Khách A → xe Traxxas Slash   ✅
  Khách B → xe Arrma Kraton    ✅ (xe khác, không conflict)
  Khách C → BYOC               ✅ (nếu byoc_capacity chưa đầy)
  Khách D → xe Traxxas Slash   ❌ (xe đã bị A đặt)
```

**BR-BK-000-F** — Track type selection  
Customer chọn loại sân (`DRIFT` / `CIRCUIT` / `OFFROAD`) trước khi chọn xe:
- Sân phải thuộc `cafe.track_types`
- RENTAL: hệ thống chỉ hiển thị xe có `compatible_track_types` rỗng hoặc chứa sân đã chọn
- BYOC: hiển thị tất cả sân của cafe, customer tự quyết định

---

## 2. Tạo booking

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

## 3. Thanh toán & xác nhận

**BR-BK-006** — Window thanh toán  
IF: Booking được tạo (status = PENDING)  
THEN: Customer phải hoàn thành thanh toán trong 30 phút  
IF: Quá 30 phút chưa thanh toán  
THEN: Auto-cancel, hoàn tiền 100%

**BR-BK-007** — F&B pre-order gộp vào 1 lần thanh toán  
IF: Customer chọn F&B pre-order khi đặt lịch  
THEN: Tổng thanh toán = booking fee + F&B pre-order fee (1 transaction duy nhất)

---

## 4. Huỷ booking

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

## 5. No-show

**BR-BK-013** — Timeout no-show  
IF: Booking đang CONFIRMED và Staff không check-in trong vòng 30 phút sau `slot_start`  
THEN: Auto-cancel  
- SLOT_FEE: hoàn 0% (phí huỷ muộn)  
- RENTAL_FEE: hoàn 100%  
- SECURITY_DEPOSIT: hoàn 100%

---

## 6. Eligibility

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
