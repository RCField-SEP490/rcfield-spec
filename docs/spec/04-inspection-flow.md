# 04 — Inspection Flow

**Last updated**: 2026-05-16  
**Status**: Active

---

## Tổng quan

Inspection là cơ chế tạo **digital evidence** tại mọi điểm bàn giao tài sản.
Không có inspection hợp lệ → không có cơ sở tính `DAMAGE_CHARGE` hoặc xử lý incident theo policy.

---

## CHECK-IN Flow

> **THAY ĐỔI:** Check-in giờ tạo một `Session` mới (không làm booking chuyển ACTIVE).
> Inspection gắn với session, có thể inspect từng xe riêng qua `inspection.session_vehicle_id`.

### RENTAL mode
```
1. Staff mở app → chọn booking → bắt đầu Check-in
2. System tạo Session (status = CHECKED_IN)
3. Staff lấy xe từ fleet (vehicle.status → IN_USE)
3. Staff chụp ảnh 4 góc: FRONT, BACK, LEFT, RIGHT
   - Mỗi ảnh upload lên S3, nhận URL
   - Tất cả 4 ảnh bắt buộc — không thể bỏ qua
4. Staff hoàn thành checklist:
   - scratches: string (mô tả vết trầy, hoặc "none")
   - cracks: string
   - missing_parts: string
   - notes: string (tự do)
5. Nếu có hư hỏng có sẵn → bật pre_existing_flag = true
6. System tạo Inspection (type: CHECK_IN) gắn với session
7. Staff gắn inspection vào từng session_vehicle (multi-vehicle support)
8. Push notification đến Customer app
9. Customer xem ảnh + checklist → bấm "Xác nhận"
   - customer_confirmed = true, customer_confirmed_at = now()
   - Timeout: 15 phút. Nếu không confirm → auto-confirm (log lại)
10. Session transition: CHECKED_IN → ACTIVE
```

### BYOC mode
```
Bước 1-4 tương tự nhưng:
- KHÔNG lấy xe từ fleet
- Staff chụp ảnh xe của Customer (4 góc)
- Staff chụp thêm ảnh cơ sở vật chất (track, barriers, decorations)
  → dùng để assess facility_damage_charge nếu có
- Checklist kiểm tra an toàn xe customer:
  - battery_secured: boolean
  - no_sharp_protrusions: boolean
  - weight_compliant: boolean
  - notes: string
```

---

## CHECK-OUT Flow

```
1. Staff mở app → chọn booking → chọn session đang ACTIVE → bắt đầu Check-out
2. Session transition: ACTIVE → CHECKING_OUT
3. Staff chụp lại 4 góc (cùng góc với check-in) cho từng xe
4. Staff hoàn thành checklist (giống check-in format) cho từng xe
5. System so sánh tự động:
   - So sánh photos (staff review, không phải AI tự động trong MVP)
   - So sánh checklist: highlight điểm mới so với check-in
6. Staff đánh dấu: "Có damage mới" hoặc "Không có damage"
7. Nếu có damage:
   - Staff nhập damage description + ước tính damage_cost
   - System tính damage_charge = damage_cost × damage_multiplier
   - Push notification đến Customer
   - Customer xem evidence → Xác nhận hoặc phản đối kết quả
     * Timeout: 24h. Im lặng = auto-confirm damage
     * Nếu phản đối: tạo `incidents` (policy-based) hoặc mở `disputes` (Admin xét xử)
8. Nếu không có damage:
   - Push notification đến Customer để confirm check-out
   - Timeout: 2h. Im lặng = auto-confirm
9. Sau confirm (hoặc auto-confirm):
   - Session transition: CHECKING_OUT → COMPLETED sau khi damage được xác nhận
     hoặc incident/dispute được resolve/waive
   - PaymentEngine.settle(sessionId) được gọi
   - vehicle.status → AVAILABLE (RENTAL mode)
   - Nếu tất cả sessions của booking đã COMPLETED → booking.status → COMPLETED
```

---

## Validation Rules

| Rule | Mô tả |
|------|-------|
| **4 ảnh bắt buộc** | Thiếu 1 trong 4 góc → không thể submit inspection |
| **Checklist đầy đủ** | Tất cả fields required (string rỗng = "none", không được null) |
| **pre_existing_flag chỉ có giá trị khi** | 4 ảnh + checklist đầy đủ + customer confirmed |
| **Staff phải được assign vào cafe** | Kiểm tra qua `staff_cafe_assignments` — không thể check-in booking của cafe khác |
| **Không thể check-in 2 lần** | Mỗi session chỉ có 1 CHECK_IN inspection |

---

## Photo Storage

**Provider**: Cloudinary — upload ảnh, lưu URL về DB. Không tự manage storage.

```
Lưu vào DB:
- `inspections`: biên bản kiểm tra
- `inspection_photos`: từng ảnh theo góc chụp
- `inspection_checklists`: từng checklist item

Folder convention trên Cloudinary:
  inspections/{session_id}/{session_vehicle_id}/{check_in|check_out}/{angle}

Retention: tối thiểu 90 ngày sau booking COMPLETED
           nếu có incident: giữ đến 30 ngày sau incident RESOLVED/WAIVED
           nếu có dispute: giữ đến 30 ngày sau dispute RESOLVED
```

---

## Damage Charge & Incident Policy Implications

Khi xét damage charge hoặc incident:
- Check-in photos + checklist là **baseline** (trạng thái khi bàn giao)
- Check-out photos + checklist là **current state** (trạng thái khi trả)
- `pre_existing_flag` + `customer_confirmed` → hư hỏng có sẵn, Provider không được tính
- Nếu Provider thiếu ảnh hoặc checklist → **mất quyền tính damage**
- Phase 1 có 2 lớp xử lý: `incidents` (policy-based, Staff/Admin áp rule) và `disputes` (tranh chấp chính thức, Admin xét xử)
- Multi-party arbitration workflow nâng cao chuyển sang Phase 2
