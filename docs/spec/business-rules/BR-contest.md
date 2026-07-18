# BR-Contest

**Last updated:** 2026-07-16  
**Status:** Aligned to current backend

---

## 1. Scope Truth

**BR-CT-001 — Contest là bounded context riêng**  
IF: Provider tổ chức giải  
THEN: dùng `contests`, `contest_registrations`, `contest_matches`, `contest_audit_logs`; không tạo booking giả để biểu diễn contest.

**BR-CT-002 — Docs phải phản ánh backend truth**  
IF: Backend đã có route/service/migration hoạt động  
THEN: docs không được ghi là gap.  
IF: Chưa có lifecycle hoàn chỉnh  
THEN: docs phải ghi rõ phần nào mới là current, phần nào vẫn là gap.

---

## 2. Time, Status, Capacity

**BR-CT-010 — Contest có registration window và race window**  
IF: tạo contest  
THEN: phải có `registration_opens_at`, `registration_closes_at`, `starts_at`, `ends_at`.

**BR-CT-011 — Registration close không được sau race start**  
IF: create/update contest  
THEN: `registration_closes_at <= starts_at`.

**BR-CT-012 — Register chỉ khi contest OPEN và trong window**  
IF: contest không `OPEN` hoặc nằm ngoài registration window  
THEN: reject registration.

**BR-CT-013 — Capacity tính registration chưa cancelled**  
IF: số registration active đạt capacity  
THEN: reject registration mới.  
NOTE: capacity check phải atomic (transaction + row-level lock) để tránh race condition overcapacity.

**BR-CT-014 — Auto-close OPEN -> CLOSED khi hết registration window**  
IF: contest `OPEN` và `registration_closes_at` đã qua  
THEN: cron job tự chuyển sang `CLOSED`. Register endpoint vẫn reject theo thời gian là fallback.

---

## 3. Cafe, Track Type, Resource Lock

**BR-CT-020 — Cafe contest phải thuộc Provider**  
IF: Provider tạo/update contest  
THEN: mọi `participating_cafe_ids` phải active và thuộc Provider đó.

**BR-CT-021 — Contest phải có active track type**  
IF: create/update contest  
THEN: `track_type_id` phải valid.

**BR-CT-022 — Resource lock là current feature**  
IF: contest có race window  
THEN: backend dùng `config.resource_locks` để block booking thường trùng tài nguyên/thời gian.

**BR-CT-023 — FULL_BRANCH khóa cả chi nhánh**  
IF: lock scope = `FULL_BRANCH`  
THEN: booking thường overlapping ở cafe đó bị chặn.

**BR-CT-024 — SELECTED_TRACKS khóa một phần tài nguyên**  
IF: lock scope = `SELECTED_TRACKS`  
THEN: booking bị chặn khi trùng track config, hoặc fallback theo `track_type_id` nếu booking thiếu `track_config_id`.

**BR-CT-025 — Không cho create/update contest đè booking hiện hữu**  
IF: có booking `PENDING` hoặc `CONFIRMED` overlap lock  
THEN: reject bằng conflict.

---

## 4. Registration, RENTAL, BYOC

**BR-CT-030 — Một user chỉ có một registration active trong contest**  
IF: user đã có registration chưa `CANCELLED`  
THEN: reject duplicate registration.

**BR-CT-031 — RENTAL registration phải link booking thật**  
IF: `vehicle_source = RENTAL`  
THEN: phải có `booking_id`, `vehicle_id`, booking phải `CONFIRMED`, đúng owner, đúng cafe contest, đúng track type, overlap race window.

**BR-CT-032 — BYOC registration đã là current backend behavior**  
IF: `vehicle_rule.vehicle_policy != RENTAL_ONLY`  
THEN: customer có thể register với `vehicle_source = BYOC` và khai báo xe.

**BR-CT-033 — BYOC hiện mới dừng ở declaration-based flow**  
IF: customer register BYOC  
THEN: backend đang lưu declaration trong `metadata`; chưa coi `customer_vehicle_id` là contract production-ready hoàn chỉnh.

**BR-CT-034 — Payment status ban đầu phụ thuộc entry fee**  
IF: `entry_fee > 0`  
THEN: registration vào `PENDING_PAYMENT`.  
IF: `entry_fee = 0`  
THEN: registration vào `PENDING_REVIEW`.

---

## 5. Entry Fee, VNPay, Manual Review

**BR-CT-040 — Entry fee contest có subject riêng**  
IF: customer tạo thanh toán entry fee  
THEN: payment transaction phải dùng `subject_type = CONTEST_ENTRY` và link `contest_registration_id`.

**BR-CT-041 — Contest entry payment URL là current feature**  
IF: customer có registration `PENDING_PAYMENT`  
THEN: backend tạo payment URL qua `create-entry-fee-payment`.  
NOTE: chỉ cho phép một transaction `CONTEST_ENTRY` đang active (PENDING/PENDING_PAYMENT) tại một thời điểm; nếu đã có transaction chưa failed thì reject hoặc reuse thay vì tạo mới, tránh duplicate payment/orphan txn.

**BR-CT-042 — Operator vẫn có manual override**  
IF: Provider/Staff cần duyệt phí thủ công  
THEN: dùng `mark-entry-fee-paid` hoặc `waive-entry-fee`.

**BR-CT-043 — Contest cancel kích hoạt lifecycle cleanup**  
IF: contest chuyển sang `CANCELLED`  
THEN: hủy tất cả registrations chưa cancelled, đánh dấu paid registrations cần refund, chuyển matches sang `CANCELLED`, và ghi audit. Refund tiền thật vẫn do VNPay/IPN flow xử lý.

---

## 6. Approval, Check-in, Staff

**BR-CT-050 — Approve chỉ khi payment state hợp lệ**  
IF: registration vẫn ở trạng thái phí chưa xử lý  
THEN: không được approve.

**BR-CT-051 — Contest ban chặn approve/check-in**  
IF: participant có active contest/provider ban  
THEN: reject approve hoặc check-in.

**BR-CT-052 — Check-in chỉ cho registration CONFIRMED**  
IF: registration chưa `CONFIRMED`  
THEN: reject check-in.

**BR-CT-053 — Staff phải assigned đúng cafe**  
IF: staff lookup/check-in/runtime action  
THEN: staff phải là assigned staff của contest VÀ được assigned vào cafe nơi thao tác diễn ra (`checked_in_cafe_id` hoặc `match.cafe_id`). Provider owner được quyền trên toàn bộ cafe trong contest.

---

## 7. Runtime, Leaderboard, Metrics

**BR-CT-060 — Runtime chỉ nhận registration CHECKED_IN**  
IF: generate matches  
THEN: chỉ dùng registrations đủ điều kiện event-day.

**BR-CT-061 — Runtime format quyết định vận hành**  
IF: `runtime_format = KNOCKOUT`  
THEN: dùng bracket + advance flow.  
IF: `runtime_format = TIME_TRIAL`  
THEN: dùng run list + lap/time ranking flow.

**BR-CT-062 — Publish leaderboard là local snapshot**  
IF: operator publish leaderboard  
THEN: backend lưu `config.published_leaderboard` và đưa contest sang `COMPLETED`.

**BR-CT-063 — Local leaderboard không phải global leaderboard**  
IF: muốn bảng xếp hạng toàn hệ thống  
THEN: đọc từ `race_records`, không đọc trực tiếp từ config contest.

**BR-CT-064 — Metrics hiện đã có revenue summary cơ bản**  
IF: FE gọi metrics  
THEN: có `expected_revenue`, `paid_revenue`, `waived_revenue`, `pending_revenue`, `payment_conversion_rate` cùng registration/match/global sync stats.

---

## 8. Audit, Ban, Disqualify

**BR-CT-070 — Mutation quan trọng phải audit**  
IF: create/update/status/register/fee/check-in/runtime/publish/ban/disqualify  
THEN: ghi `contest_audit_logs`.

**BR-CT-071 — Ban theo contest hoặc provider là current behavior**  
IF: operator muốn chặn participant  
THEN: có thể tạo ban scope `CONTEST` hoặc `PROVIDER`, có `reason`, `evidence`, `expires_at`.

**BR-CT-072 — Lift ban phải có lịch sử**  
IF: operator gỡ ban  
THEN: lưu `lifted_at`, `lifted_by`, `lift_reason` và audit event.

**BR-CT-073 — Disqualify loại participant khỏi active matches**  
IF: operator disqualify participant  
THEN: chuyển registration sang `CANCELLED`, lưu reason và metadata disqualified, đồng thời xóa participant khỏi các `contest_match_participants` của matches chưa `COMPLETED` để bracket không tiếp tục đẩy người bị loại đi tiếp.

**BR-CT-074 — Incident/protest/appeal chưa có module riêng**  
IF: cần quy trình kỷ luật nhiều bước  
THEN: đó vẫn là gap, chưa phải current contract.
