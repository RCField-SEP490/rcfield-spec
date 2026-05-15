# BR-Dispute — Quy tắc nghiệp vụ: Xử lý Tranh chấp

**Last updated**: 2026-05-15
**Status**: Active

> **THAY ĐỔI:** Dispute giờ gắn với `Session` (không phải `Booking`).
> Hỗ trợ dispute từ incident. Thêm dispute_type để phân loại.

## 1. Mở dispute

**BR-DI-001** — Ai có thể mở dispute  
- Customer: mở dispute khi không đồng ý với damage charge tại check-out  
- Customer hoặc Staff: mở dispute bất kỳ lúc nào booking đang ACTIVE (sự cố trong khi chơi)

**BR-DI-002** — Không thể mở dispute sau session COMPLETED
IF: `session.status = COMPLETED`
THEN: Không thể mở dispute — window đã đóng

**BR-DI-003** — Chỉ 1 dispute per session (trừ dispute từ incident khác)
Mỗi session có thể có nhiều dispute nếu có nhiều incident độc lập, nhưng tối đa 1 dispute per incident.

**BR-DI-004** — Dispute chuyển trạng thái session
IF: Dispute được mở
THEN: `session.status → DISPUTED`

---

## 2. Evidence

**BR-DI-005** — Ảnh check-in là baseline  
Check-in photos + checklist = trạng thái tài sản lúc bàn giao. Admin dùng làm chuẩn so sánh.

**BR-DI-006** — Ảnh check-out là current state  
Check-out photos + checklist = trạng thái tài sản lúc trả. Admin so sánh với baseline.

**BR-DI-007** — Provider mất quyền tính damage nếu thiếu evidence  
IF: Staff không hoàn thành inspection protocol (thiếu ảnh hoặc checklist)  
THEN: Provider mất quyền tính damage_charge cho booking đó

**BR-DI-008** — Pre-existing damage được bảo vệ  
IF: Hư hỏng đã được ghi nhận ở check-in (`pre_existing_flag = true`) VÀ customer đã confirm  
THEN: Admin KHÔNG tính khoản đó là damage mới khi xét dispute

---

## 3. Xét xử

**BR-DI-009** — Chỉ Admin xét xử  
IF: Dispute đang OPEN hoặc UNDER_REVIEW  
THEN: Chỉ ADMIN (team RCField) có quyền resolve dispute

**BR-DI-010** — Admin dựa trên digital evidence  
Admin xét xử dựa trên: ảnh check-in vs check-out, checklist, `pre_existing_flag`, `trust_score` của Customer

**BR-DI-011** — trust_score ảnh hưởng trọng số  
`trust_score` của Customer ảnh hưởng đến trọng số xét xử — không phải quyết định tuyệt đối

---

## 4. Timeout

**BR-DI-012** — Admin phải resolve trong 72 giờ  
IF: Dispute đã mở 72 giờ mà Admin chưa resolve  
THEN: Escalate (alert Admin cấp cao hơn hoặc system flag)

**BR-DI-013** — Sau resolve → COMPLETED  
IF: Admin resolve dispute  
THEN: `booking.status → COMPLETED` + `PaymentEngine.settle(bookingId)` với resolution quyết định payment outcome
