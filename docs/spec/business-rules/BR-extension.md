# BR-Extension — Quy tắc nghiệp vụ: Gia hạn Slot

**Last updated**: 2026-05-13  
**Status**: Active

---

## 1. Điều kiện gia hạn

**BR-EX-001** — Chỉ gia hạn khi ACTIVE  
IF: `booking.status ≠ ACTIVE`  
THEN: Không thể đề xuất gia hạn  
NOTE: Đặc biệt — không cho phép gia hạn khi đang ở CHECKING_OUT

**BR-EX-002** — Staff đề xuất, Customer quyết định  
IF: Staff bấm "Đề xuất gia hạn"  
THEN: `booking.status → EXTENDING` + Push notification đến Customer  
Customer chọn: Approve → gia hạn | Reject → tiếp tục session bình thường

**BR-EX-003** — Gần hết giờ → notify  
IF: Còn X phút trước `slot_end` (thời gian cụ thể TBD)  
THEN: System notify cả Staff và Customer để chuẩn bị gia hạn hoặc check-out

---

## 2. Giới hạn phí gia hạn

**BR-EX-004** — Extension fee cap  
```
max_extension_fee = security_deposit × 50%
```

**BR-EX-005** — Từ chối khi vượt cap  
IF: `tổng extension_fee tích lũy + extension_fee_mới > max_extension_fee`  
THEN: Từ chối extension proposal. Notify Customer đã đạt giới hạn gia hạn.

**BR-EX-006** — Nhiều lần gia hạn  
Cho phép gia hạn nhiều lần trong 1 booking, với điều kiện tổng phí không vượt cap (BR-EX-005)

---

## 3. Thanh toán gia hạn

**BR-EX-007** — Extension fee là post-paid  
IF: Extension được approve  
THEN: Tạo `EXTENSION_FEE` component (HELD). Khoản này trừ vào `SECURITY_DEPOSIT` khi settle.

**BR-EX-008** — Slot_end cập nhật  
IF: Extension được approve  
THEN: `booking.slot_end` cập nhật theo thời gian gia hạn mới
