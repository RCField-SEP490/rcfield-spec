# 04 — Inspection Flow

**Last updated**: 2026-05  
**Status**: Active

---

## Tổng quan

Inspection là cơ chế tạo **digital evidence** tại mọi điểm bàn giao tài sản.
Không có inspection record hợp lệ → không có cơ sở tính damage_charge → không thể thắng dispute.

---

## CHECK-IN Flow

### RENTAL mode
```
1. Staff mở app → chọn booking → bắt đầu Check-in
2. Staff lấy xe từ fleet (vehicle.status → IN_USE)
3. Staff chụp ảnh 4 góc: FRONT, BACK, LEFT, RIGHT
   - Mỗi ảnh upload lên S3, nhận URL
   - Tất cả 4 ảnh bắt buộc — không thể bỏ qua
4. Staff hoàn thành checklist:
   - scratches: string (mô tả vết trầy, hoặc "none")
   - cracks: string
   - missing_parts: string
   - notes: string (tự do)
5. Nếu có hư hỏng có sẵn → bật pre_existing_flag = true
6. System tạo InspectionRecord (type: CHECK_IN)
7. Push notification đến Customer app
8. Customer xem ảnh + checklist → bấm "Xác nhận"
   - customer_confirmed = true, customer_confirmed_at = now()
   - Timeout: 15 phút. Nếu không confirm → auto-confirm (log lại)
9. Booking transition: CONFIRMED → ACTIVE
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
1. Staff mở app → chọn booking đang ACTIVE → bắt đầu Check-out
2. Booking transition: ACTIVE → CHECKING_OUT
3. Staff chụp lại 4 góc (cùng góc với check-in)
4. Staff hoàn thành checklist (giống check-in format)
5. System so sánh tự động:
   - So sánh photos (staff review, không phải AI tự động trong MVP)
   - So sánh checklist: highlight điểm mới so với check-in
6. Staff đánh dấu: "Có damage mới" hoặc "Không có damage"
7. Nếu có damage:
   - Staff nhập damage description + ước tính damage_cost
   - System tính damage_charge = damage_cost × damage_multiplier
   - Push notification đến Customer
   - Customer xem evidence → Xác nhận hoặc Mở dispute
     * Timeout: 24h. Im lặng = auto-confirm damage
8. Nếu không có damage:
   - Push notification đến Customer để confirm check-out
   - Timeout: 2h. Im lặng = auto-confirm
9. Sau confirm (hoặc auto-confirm):
   - Booking transition: CHECKING_OUT → COMPLETED (nếu không dispute)
   - PaymentEngine.settle(bookingId) được gọi
   - vehicle.status → AVAILABLE (RENTAL mode)
```

---

## Validation Rules

| Rule | Mô tả |
|------|-------|
| **4 ảnh bắt buộc** | Thiếu 1 trong 4 góc → không thể submit inspection |
| **Checklist đầy đủ** | Tất cả fields required (string rỗng = "none", không được null) |
| **pre_existing_flag chỉ có giá trị khi** | 4 ảnh + checklist đầy đủ + customer confirmed |
| **Staff phải được assign vào cafe** | Không thể check-in booking của cafe khác |
| **Không thể check-in 2 lần** | Mỗi booking chỉ có 1 CHECK_IN record |

---

## Photo Storage

```
S3 path: inspections/{booking_id}/{check_in|check_out}/{front|back|left|right}.jpg

Retention: tối thiểu 90 ngày sau booking COMPLETED
           nếu có dispute: giữ đến 30 ngày sau dispute RESOLVED
```

---

## Dispute Implications

Khi Admin xét dispute:
- Check-in photos + checklist là **baseline** (trạng thái khi bàn giao)
- Check-out photos + checklist là **current state** (trạng thái khi trả)
- `pre_existing_flag` + `customer_confirmed` → hư hỏng có sẵn, Provider không được tính
- Nếu Provider thiếu ảnh hoặc checklist → **mất quyền tính damage**
- `trust_score` của Customer ảnh hưởng đến trọng số xét xử (không phải quyết định tuyệt đối)
