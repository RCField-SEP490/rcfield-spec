# BR-Incident-Resolution — Quy tắc nghiệp vụ: Incident Policy Resolution

**Last updated**: 2026-05-16  
**Status**: Active

Phase 1 không dùng workflow dispute nhiều bảng. Tranh chấp/hư hỏng được xử lý bằng policy cụ thể, inspection evidence và log kết quả trên `incidents`.

---

## 1. Nguyên tắc

**BR-IR-001** — Incident là log sự cố  
IF: Có hư hỏng, va chạm, mất phụ kiện hoặc phản đối kết quả check-out  
THEN: Tạo hoặc cập nhật `incidents` gắn với `session_id`.

**BR-IR-002** — Evidence dùng inspection  
IF: Incident liên quan damage  
THEN: Evidence chính là check-in/check-out trong `inspections`, `inspection_photos`, `inspection_checklists`.

**BR-IR-003** — Không đủ evidence thì không tính phí  
IF: Thiếu check-in hoặc check-out inspection hợp lệ  
THEN: Không tạo `DAMAGE_CHARGE`, hoặc set `incidents.status = WAIVED`.

---

## 2. Policy xử lý

**BR-IR-004** — Rental damage  
IF: Damage mới trên xe thuê được xác nhận bằng inspection  
THEN: `responsible_party = CUSTOMER`, `final_amount = min(estimated_amount × damage_multiplier, deposit_cap_policy)`.

**BR-IR-005** — BYOC damage  
IF: Xe BYOC bị hư hại  
THEN: Staff/Admin ghi nhận incident; chỉ charge customer nếu evidence cho thấy customer gây thiệt hại cho tài sản quán hoặc xe thuê.

**BR-IR-006** — Staff/facility fault  
IF: Evidence cho thấy lỗi do staff hoặc cơ sở vật chất  
THEN: `responsible_party = PROVIDER` hoặc `STAFF`, `final_amount = 0` với customer.

**BR-IR-007** — Shared/unknown responsibility  
IF: Không đủ bằng chứng phân trách nhiệm rõ ràng  
THEN: `responsible_party = UNKNOWN` hoặc `SHARED`, `final_amount` do Admin/Staff quyết định theo policy vận hành.

---

## 3. Resolution log

**BR-IR-008** — Done tranh chấp bằng incident resolution  
Một incident được xem là xử lý xong khi có:

- `status = RESOLVED` hoặc `WAIVED`
- `responsible_party`
- `final_amount`
- `resolution_note`
- `resolved_by`
- `resolved_at`

**BR-IR-009** — Payment adjustment không sửa ledger cũ  
IF: Resolution cần thu phí  
THEN: Tạo payment component mới (`DAMAGE_CHARGE`) thay vì sửa component cũ.

**BR-IR-010** — Phase 2 escalation  
Nếu cần nhiều bên tranh chấp, upload evidence riêng, arbitration nhiều bước hoặc appeal, chuyển sang Phase 2 với các bảng `disputes`, `dispute_evidences`, `dispute_parties`.
