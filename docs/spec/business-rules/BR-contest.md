# BR-Contest — Quy tắc nghiệp vụ Contest & Race Event

**Last updated:** 2026-07-14  
**Status:** Active, aligned with current backend  
**Owner:** Product / Backend / Frontend / Operations

> Contest là module vận hành giải đua ở phạm vi Provider. Tài liệu này ưu tiên sự thật backend hiện tại: tính năng nào đã có thì ghi là current, tính năng nào mới là mong muốn thì ghi rõ là gap/backlog.

---

## 1. Current Scope

| Capability | Trạng thái backend |
|---|---|
| Provider tạo/sửa/open/close/cancel contest | Có |
| Public list/detail contest | Có |
| Registration window | Có |
| Multi-cafe contest | Có |
| Track type trên contest | Có |
| Khóa cafe/sân trong giờ contest | Có, qua `config.resource_locks` |
| Entry fee field | Có |
| Entry fee VNPay | Chưa có |
| Entry fee manual mark/waive | Có |
| Revenue dashboard đầy đủ | Chưa có |
| Prize display config | Có thể lưu trong `config` |
| Reward claim/payout | Chưa có |
| Rental registration linked booking | Có |
| BYOC registration production-ready | Chưa có, service hiện rental-only |
| Check-in bằng code | Có |
| Knockout runtime | Có |
| Time trial runtime | Có |
| Publish local leaderboard | Có |
| Sync race records tối giản | Có |
| Audit logs Provider xem được | Có |
| Contest-specific ban list | Chưa có |

---

## 2. Data Model Boundary

Current tables:

```text
contests
contest_cafes
contest_registrations
contest_matches
contest_match_participants
contest_audit_logs
race_records
```

Không coi các bảng sau là current contest contract:

```text
contest_classes
contest_rounds
contest_heats
contest_results
contest_leaderboard_snapshots
contest_rewards
contest_reward_claims
contest_bans
contest_participant_incidents
```

**BR-CT-001 — Contest không phải booking thường**  
IF: Provider tổ chức giải  
THEN: Tạo `Contest`, `ContestCafe`, `ContestRegistration`, `ContestMatch`; không tạo booking giả để biểu diễn giải.

**BR-CT-002 — Một contest hiện tại là một hạng mục**  
IF: Provider muốn tách Beginner/Open/BYOC/Rental Spec  
THEN: Tạo nhiều contest riêng; multi-class trong một contest là backlog.

**BR-CT-003 — Config linh hoạt nằm trong `contests.config`**  
IF: Format, rule, prize, leaderboard, resource locks cần thay đổi theo từng giải  
THEN: Lưu trong `contests.config` nếu chưa có workflow riêng cần table riêng.

**BR-CT-004 — Không ghi nhầm gap thành current feature**  
IF: Backend chưa có endpoint/service/schema hoàn chỉnh  
THEN: Docs và FE phải ghi là gap/backlog, không hiển thị như feature đã hoàn tất.

---

## 3. Actors & Permissions

| Actor | Quyền hiện tại |
|---|---|
| Customer | Xem contest public, đăng ký rental-linked contest, xem registration của mình, hủy registration của mình |
| Provider owner | CRUD/status contest, xem registrations, mark/waive fee, approve/reject/cancel registration, check-in, generate matches, submit/correct result, advance, publish leaderboard, xem metrics/audit |
| Staff | Lookup/check-in và thao tác match/result nếu assigned đúng cafe |
| Admin | Không phải contest operator chính; có vai trò platform/admin ở module khác |

**BR-CT-010 — Provider owner là người sở hữu contest**  
IF: User thao tác contest management  
THEN: `contest.provider_id` phải bằng Provider user id.

**BR-CT-011 — Staff operation phải theo cafe assigned**  
IF: Staff lookup/check-in/reorder/submit/correct result  
THEN: Staff phải assigned vào cafe tương ứng trong contest/match.

**BR-CT-012 — Contest không tự động cross-provider**  
IF: Provider tạo contest  
THEN: `participating_cafe_ids` chỉ được chứa cafe ACTIVE thuộc Provider đó.

---

## 4. Contest Time & Status

**BR-CT-020 — Contest phải có 2 lớp thời gian**  
IF: Provider tạo contest  
THEN: Phải có registration window (`registration_opens_at`, `registration_closes_at`) và race window (`starts_at`, `ends_at`).

**BR-CT-021 — Registration close không được sau race start**  
IF: Create contest  
THEN: `registration_closes_at <= starts_at`.

**BR-CT-022 — Public register chỉ khi OPEN và trong window**  
IF: Contest không `OPEN`, chưa tới `registration_opens_at`, hoặc đã qua `registration_closes_at`  
THEN: Reject registration.

**BR-CT-023 — CLOSE khóa registration**  
IF: Contest chuyển `OPEN -> CLOSED`  
THEN: Không nhận registration mới.

**BR-CT-024 — Auto-close là gap**  
IF: `registration_closes_at` đã qua nhưng contest vẫn `OPEN`  
THEN: Backend register vẫn reject theo thời gian, nhưng status list có thể gây hiểu nhầm; cần cron/job auto close nếu muốn UX chặt.

---

## 5. Cafe, Track Type & Resource Lock

**BR-CT-030 — Cafe tham gia phải thuộc Provider**  
IF: Provider tạo/update contest  
THEN: mọi cafe trong `participating_cafe_ids` phải ACTIVE và thuộc Provider.

**BR-CT-031 — Contest phải có track type**  
IF: Contest tạo mới  
THEN: `track_type_id` phải là active track type.

**BR-CT-032 — Contest lock là current feature**  
IF: Contest có race window  
THEN: Backend dùng `config.resource_locks` để giữ tài nguyên trong giờ contest.

**BR-CT-033 — FULL_BRANCH khóa cả cafe**  
IF: Resource lock scope = `FULL_BRANCH`  
THEN: Booking thường trong cùng cafe và overlapping time bị chặn.

**BR-CT-034 — SELECTED_TRACKS khóa một số sân**  
IF: Resource lock scope = `SELECTED_TRACKS`  
THEN: Booking thường bị chặn nếu trùng `track_config_id` hoặc fallback trùng `track_type_id`.

**BR-CT-035 — Không tạo contest đè booking hiện có**  
IF: Đã có booking `PENDING` hoặc `CONFIRMED` overlap với lock  
THEN: Reject create/update contest bằng conflict.

---

## 6. Registration & Vehicle Rules

**BR-CT-040 — Một user một registration active trong contest**  
IF: User đã có registration chưa `CANCELLED`  
THEN: Reject duplicate.

**BR-CT-041 — Capacity tính active registration**  
IF: Active registrations >= capacity  
THEN: Reject registration.

**BR-CT-042 — Current registration flow là rental-linked booking**  
IF: Customer đăng ký bằng backend hiện tại  
THEN: `vehicle_source` phải là `RENTAL`, có `booking_id`, có `vehicle_id`.

**BR-CT-043 — Rental booking phải hợp lệ**  
IF: Registration dùng rental booking  
THEN: Booking phải `CONFIRMED`, thuộc customer, thuộc cafe contest, cùng track type, giao với race window, và vehicle thuộc booking.

**BR-CT-044 — BYOC là product intent nhưng chưa hoàn chỉnh**  
IF: Contest config cho `BYOC_ONLY` hoặc `MIXED`  
THEN: Không bật UI đăng ký BYOC production cho đến khi backend nhận `customer_vehicle_id`, review BYOC, và bỏ guard rental-only.

**BR-CT-045 — Check-in chỉ cho registration CONFIRMED**  
IF: Registration không `CONFIRMED`  
THEN: Reject check-in.

---

## 7. Entry Fee, VNPay & Revenue

**BR-CT-050 — Entry fee hiện là field + manual workflow**  
IF: Contest có `entry_fee > 0`  
THEN: Registration lưu `entry_fee_amount` và `payment_status`; Provider có thể mark paid hoặc waive thủ công.

**BR-CT-051 — Chưa có VNPay contest entry**  
IF: Customer đăng ký contest trả phí  
THEN: Backend hiện chưa tạo VNPay URL riêng cho contest; FE không được redirect VNPay cho contest entry nếu chưa có endpoint mới.

**BR-CT-052 — Không tạo booking giả để thu entry fee**  
IF: Implement payment contest  
THEN: Dùng payment subject `CONTEST_ENTRY` hoặc link `contest_registration_id`; không tạo booking/session giả.

**BR-CT-053 — Revenue metrics hiện chưa đủ**  
IF: Provider cần xem doanh thu contest  
THEN: Backend cần bổ sung gross expected, paid gross, pending amount, waived amount, cancelled/refunded amount, conversion rate.

**BR-CT-054 — Metrics hiện tại không phải revenue report**  
IF: FE gọi `GET /contests/:contestId/metrics`  
THEN: Chỉ coi là operational metrics: registration counts, match counts, leaderboard, global sync.

---

## 8. Prize & Reward

**BR-CT-060 — Prize hiện là config hiển thị**  
IF: Contest có prize  
THEN: Lưu trong `contests.config.prizes` hoặc tương đương config; FE hiển thị như thông tin Provider công bố.

**BR-CT-061 — Cash prize nằm ngoài platform**  
IF: Provider trao tiền mặt  
THEN: Hệ thống không xử lý payout, thuế, fraud, claim hoặc dispute tiền thưởng trong phase hiện tại.

**BR-CT-062 — Reward automation là gap**  
IF: Muốn tự phát voucher/package/reward claim  
THEN: Cần workflow/table riêng, không coi `config.prizes` là payout engine.

---

## 9. Match / Tournament Runtime

**BR-CT-070 — Runtime chỉ lấy người đã CHECKED_IN**  
IF: Generate matches  
THEN: Registration phải `CHECKED_IN`.

**BR-CT-071 — Runtime format quyết định UI**  
IF: `runtime_format = KNOCKOUT`  
THEN: FE dùng bracket UI.  
IF: `runtime_format = TIME_TRIAL`  
THEN: FE dùng run list/time entry/ranking UI.

**BR-CT-072 — Knockout advance qua next match**  
IF: Match có `next_match_id` và đã `COMPLETED`  
THEN: Winner/qualified được advance sang match kế tiếp.

**BR-CT-073 — Time trial ranking theo thời gian**  
IF: Format là `TIME_TRIAL`  
THEN: Result nhập `best_lap_ms` hoặc `total_time_ms`; leaderboard sort theo mode tương ứng.

**BR-CT-074 — Result submit phải có reason**  
IF: Staff/Provider submit result  
THEN: Payload phải có `reason` và audit phải ghi lại.

**BR-CT-075 — Correction có guard downstream**  
IF: Result đã advance sang match sau  
THEN: Correction cần `force_cascade`; Staff không được force; downstream completed thì reject.

---

## 10. Leaderboard & Global Sync

**BR-CT-080 — Local leaderboard là snapshot trong contest config**  
IF: Provider publish leaderboard  
THEN: Backend lưu vào `contests.config.published_leaderboard` và chuyển contest `COMPLETED`.

**BR-CT-081 — Không publish nếu match chưa xong**  
IF: Còn match `DRAFT`, `READY`, hoặc `RUNNING`  
THEN: Reject publish.

**BR-CT-082 — Public được xem lại sau giải**  
IF: Contest đã public/completed  
THEN: Public detail/matches có thể hiển thị lại bracket/result/leaderboard snapshot.

**BR-CT-083 — Local leaderboard không phải global leaderboard**  
IF: Cần leaderboard liên tỉnh/toàn quốc  
THEN: Đọc từ `race_records` verified, không đọc trực tiếp từ `contests.config.published_leaderboard`.

**BR-CT-084 — Global sync chỉ sau publish**  
IF: Sync contest sang racing network  
THEN: Contest phải có published local leaderboard và không còn match non-terminal.

---

## 11. Audit & Anti-cheat Operations

**BR-CT-090 — Mutation quan trọng phải audit**  
IF: Create/update/status/register/fee/check-in/generate/result/correction/advance/publish/sync  
THEN: Ghi `contest_audit_logs`.

**BR-CT-091 — Provider phải xem được audit**  
IF: Provider sở hữu contest  
THEN: `GET /contests/:contestId/audit-logs` trả lịch sử thao tác.

**BR-CT-092 — Audit cần reason khi có yếu tố phán quyết**  
IF: Reject/cancel/mark fee/correct result/disqualify future  
THEN: Reason phải được ghi để Provider truy vết.

**BR-CT-093 — Staff không được vượt quyền cafe**  
IF: Staff thao tác ở match/cafe không assigned  
THEN: Reject, vì đây là guard chống gian lận vận hành.

---

## 12. Unhappy Cases, Disqualification & Ban

**BR-CT-100 — Current disqualify mềm qua participant result**  
IF: Người thi bị loại vì vi phạm trong match  
THEN: Backend hiện có thể lưu participant status `DQ` và result note khi submit/correct result.

**BR-CT-101 — Current cancel/reject chỉ ở registration**  
IF: Người đăng ký không hợp lệ hoặc bị loại trước runtime  
THEN: Provider có thể reject/cancel registration có reason và audit.

**BR-CT-102 — Chưa có contest ban list**  
IF: Customer phá giải và Provider muốn cấm tham gia lại  
THEN: Backend hiện chưa có `contest_bans`; không dùng `users.is_active` vì đó là khóa tài khoản toàn hệ thống.

**BR-CT-103 — Ban theo contest/provider là gap cần implement**  
IF: Cần chống phá giải bài bản  
THEN: Thêm `contest_bans` hoặc `contest_participant_incidents`, scope theo `contest_id` hoặc `provider_id`, có reason/evidence/expires_at/audit.

**BR-CT-104 — Incident contest không dùng nhầm booking incident**  
IF: Sự cố xảy ra trong giải nhưng không gắn session/inspection  
THEN: Cần incident contest riêng hoặc mở rộng incident subject; không nhét mù vào booking/session nếu không có session.

---

## 13. FE State Simplification

Customer-facing journey status nên dùng:

```text
PENDING_APPROVAL
APPROVED_WAITING_CHECKIN
CHECKED_IN_WAITING_BRACKET
IN_BRACKET
ADVANCED
ELIMINATED
FINISHED
CANCELLED
```

**BR-CT-110 — Không lộ state kỹ thuật không cần thiết**  
IF: UI dành cho Customer  
THEN: Không bắt Customer hiểu `DRAFT`, `READY`, `RUNNING` của match; map về journey status.

**BR-CT-111 — Provider/Staff UI phải chia tab theo công việc**  
IF: FE làm contest dashboard  
THEN: Tách Setup, Registrations, Check-in, Runtime, Leaderboard, Metrics, Audit.

---

## 14. Recommended Demo Flow

1. Provider tạo contest rental-only, chọn cafe, track type, registration/race window.
2. Provider chọn resource lock: khóa cả cafe hoặc sân cụ thể.
3. Provider cấu hình entry fee/prizes/rules.
4. Provider open contest.
5. Customer có booking rental `CONFIRMED` đăng ký contest.
6. Provider mark fee paid hoặc waive nếu entry fee > 0.
7. Provider approve registration.
8. Staff check-in bằng code tại đúng cafe.
9. Provider generate `KNOCKOUT` hoặc `TIME_TRIAL`.
10. Staff nhập result theo UI format.
11. Provider publish leaderboard.
12. Provider xem metrics và audit logs.
