# BR-Inspection — Quy tắc nghiệp vụ: Check-in / Check-out

**Last updated**: 2026-05-13  
**Status**: Active

---

## 1. Nguyên tắc

Inspection là cơ chế tạo **digital evidence** tại mọi điểm bàn giao tài sản.  
Không có inspection record hợp lệ → không có cơ sở tính damage_charge → không thể thắng dispute.

---

## 2. Yêu cầu ảnh & checklist

**BR-IN-001** — 4 ảnh bắt buộc  
IF: Staff đang submit inspection (check-in hoặc check-out)  
THEN: Phải upload đủ 4 ảnh: FRONT, BACK, LEFT, RIGHT  
NOTE: Thiếu 1 trong 4 → không thể submit

**BR-IN-002** — Checklist đầy đủ  
Tất cả fields trong checklist đều required: `scratches`, `cracks`, `missing_parts`, `notes`  
String rỗng hợp lệ (= "none"), nhưng không được null

**BR-IN-003** — Pre_existing_flag chỉ có giá trị khi  
Cả 3 điều kiện phải đúng:
1. 4 ảnh đầy đủ
2. Checklist đầy đủ
3. Customer đã confirm inspection

---

## 3. Check-in

**BR-IN-004** — Chỉ 1 check-in per booking  
Mỗi booking chỉ được có đúng 1 `InspectionRecord` loại `CHECK_IN`

**BR-IN-005** — Staff phải thuộc chi nhánh  
IF: Staff không được assign vào chi nhánh của booking đó  
THEN: Không thể thực hiện check-in

**BR-IN-006** — RENTAL check-in: lấy xe từ fleet  
IF: `mode = RENTAL`  
THEN: Staff lấy xe → `vehicle.status → IN_USE` → chụp 4 góc xe → checklist

**BR-IN-007** — BYOC check-in: xe của Customer  
IF: `mode = BYOC`  
THEN: Staff chụp 4 góc xe của Customer + ảnh cơ sở vật chất (track, barriers)  
Checklist an toàn: `battery_secured`, `no_sharp_protrusions`, `weight_compliant`, `notes`

**BR-IN-008** — Customer confirm check-in  
IF: InspectionRecord CHECK_IN được tạo  
THEN: Push notification đến Customer → Customer xem ảnh + checklist → confirm  
Timeout: 15 phút. Nếu không confirm → auto-confirm (log lại)

**BR-IN-009** — Booking chuyển ACTIVE sau check-in  
IF: Customer confirm (hoặc auto-confirm) check-in  
THEN: `booking.status → ACTIVE`

---

## 4. Check-out

**BR-IN-010** — Check-out bắt đầu từ ACTIVE  
IF: Staff bắt đầu check-out  
THEN: `booking.status → CHECKING_OUT` ngay lập tức

**BR-IN-011** — Chụp cùng 4 góc như check-in  
Staff chụp lại 4 góc (FRONT, BACK, LEFT, RIGHT) để so sánh với ảnh check-in

**BR-IN-012** — Staff đánh dấu damage  
Sau khi so sánh ảnh check-in vs check-out, Staff phải chọn:
- "Không có damage" → notify Customer confirm check-out
- "Có damage mới" → nhập mô tả + ước tính damage_cost → notify Customer

**BR-IN-013** — Customer confirm không có damage  
Timeout: 2 giờ. Im lặng = auto-confirm  
IF: Confirmed → `booking.status → COMPLETED`

**BR-IN-014** — Customer nhận damage notification  
Timeout: 24 giờ. Im lặng = auto-confirm damage charge  
IF: Customer xác nhận → COMPLETED  
IF: Customer từ chối → `booking.status → DISPUTED`

---

## 5. Lưu trữ ảnh

**BR-IN-015** — Cloudinary folder convention  
```
inspections/{booking_id}/{check_in|check_out}/{front|back|left|right}
```
Upload lên Cloudinary → lấy URL về lưu vào `inspection_records.photos` (jsonb)

**BR-IN-016** — Retention  
- Tối thiểu 90 ngày sau booking COMPLETED
- Nếu có dispute: giữ đến 30 ngày sau dispute RESOLVED
