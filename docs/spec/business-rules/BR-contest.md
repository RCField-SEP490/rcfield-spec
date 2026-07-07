# BR-Contest — Quy tắc nghiệp vụ Contest & Race Event

**Last updated**: 2026-07-07
**Status**: Active for current implementation  
**Owner**: Product / Backend / Frontend / Operations

> Contest trong RCField là event domain riêng ở phạm vi Provider: Provider tạo giải cho các cafe thuộc mình, Customer đăng ký, Provider/Staff monitoring và check-in, sau khi đóng đăng ký thì tạo lịch thi đấu dạng match/heat linh hoạt, nhập kết quả thủ công, publish leaderboard local và ghi audit log. Phase này cố ý giữ schema gọn để khả thi cho đồ án; Universal Racing Network là phase mở rộng sau contest.

---

## 1. Current Scope

### Now — Phase hiện tại

| Capability | Làm trong phase này |
|---|---|
| Provider tạo/sửa/open/close/cancel contest | Có |
| Public xem thông tin giải, luật, địa điểm, giải thưởng | Có |
| Customer đăng ký contest khi OPEN | Có |
| Provider xem dashboard người tham gia | Có |
| Staff lookup/check-in bằng code | Có |
| Close registration | Có |
| Generate schedule sau khi CLOSED/RUNNING | Có |
| Match linh hoạt 1, 2, 4 hoặc nhiều người | Có |
| Staff/Provider nhập result thủ công | Có |
| Advance winner/qualified sang match sau | Có |
| Publish leaderboard cuối | Có |
| Business monitoring bằng audit log DB | Có |

### Next — Làm sau khi phase này ổn

- Schedule block để contest không trùng booking thường.
- Payment subject `CONTEST_ENTRY` thật, không tạo booking giả.
- BYOC tech-check checklist structured.
- Rental vehicle assignment đầy đủ tại check-in.
- Reward claim lifecycle nếu muốn phát voucher/package tự động.
- Official roles: race director, timekeeper, tech inspector.
- Universal Racing Network Phase B: Driver Passport, verified global race records, leaderboard lien tinh/toan quoc.
- Universal Racing Network Phase C: Achievements tu check-in va race records.
- Universal Racing Network Phase D: Grand Prix Series gom nhieu contest da publish.
- Universal Racing Network Phase E: Team War/Clan War voi roster lock va captain approval.

### Backlog — Không mở scope đồ án hiện tại

- Multi-class trong một contest.
- Live timing/transponder/lap-by-lap.
- Protest workflow.
- Auto bracket phức tạp.
- Series/championship nhiều contest trong contest core; phase sau dùng module `league_series` riêng.
- Cash prize/payout.

---

## 2. Data Model Boundary

Schema mục tiêu phase này:

```text
contests
contest_cafes
contest_registrations
contest_matches
contest_match_participants
contest_audit_logs
```

Không dùng trong phase này:

```text
contest_classes
contest_rounds
contest_heats
contest_heat_entries
contest_results
contest_result_audits
contest_leaderboard_snapshots
contest_rewards
contest_reward_claims
contest_bracket_matches
```

**BR-CT-001 — Contest không phải booking thường**  
IF: Provider tổ chức một giải RC  
THEN: Tạo `Contest`, `ContestCafe`, `ContestRegistration`, `ContestMatch` thay vì tạo booking giả.

**BR-CT-002 — Một contest phase này là một hạng mục**  
IF: Provider muốn tách Beginner/Open/BYOC/Rental Spec trong cùng event  
THEN: Tạo nhiều contest riêng hoặc đưa multi-class vào backlog.

**BR-CT-003 — Config linh hoạt nằm trong `contests.config`**  
IF: Format, rule, prize, leaderboard cần thay đổi theo từng giải  
THEN: Dùng JSON config, không tạo bảng riêng trừ khi có workflow thật sự cần.

Config khuyến nghị:

```json
{
  "format": "KNOCKOUT | MULTI_DRIVER_HEAT | TIME_ATTACK",
  "drivers_per_match": 2,
  "seeding_mode": "MANUAL | CHECK_IN_ORDER",
  "rules_text": "The le giai...",
  "prizes": [
    { "rank": 1, "title": "Champion", "description": "Voucher 500k" }
  ],
  "leaderboard": []
}
```

---

## 3. Actors & Permissions

| Actor | Quyền |
|---|---|
| Customer | Xem contest public, đăng ký, xem mã check-in, hủy đăng ký nếu còn hợp lệ |
| Provider owner | Tạo/sửa/open/close/cancel contest, xem full registrations, generate schedule, update participants, submit result, advance, publish leaderboard, xem audit logs |
| Staff | Lookup/check-in bằng code, update match/result nếu staff được assign vào cafe tham gia contest |
| Admin | Không nằm trong API vận hành phase này; can thiệp admin riêng nếu cần |

**BR-CT-010 — Provider owner là người sở hữu contest**  
IF: User thao tác contest core  
THEN: `contest.provider_id` phải bằng user id, trừ endpoint staff event-day được phép.

**BR-CT-013 — Contest không tự động cross-provider**
IF: Provider tạo contest
THEN: `participating_cafe_ids` chỉ được chứa cafe ACTIVE thuộc Provider đó. Contest toàn platform phải đi qua Universal Racing Network/Admin orchestration ở phase sau, không dùng Provider contest thường.


**BR-CT-011 — Staff không xem full provider registration list**  
IF: Staff vận hành event-day  
THEN: Staff dùng lookup bằng check-in code và chỉ thao tác tại cafe staff được assign.

**BR-CT-012 — Staff chỉ thao tác ở cafe tham gia contest**  
IF: Staff check-in hoặc nhập result  
THEN: Staff phải thuộc một cafe trong `contest_cafes`.

---

## 4. Contest State Machine

```text
DRAFT -> OPEN -> CLOSED -> RUNNING -> COMPLETED
   \       \        \          \
    \       \        \          -> CANCELLED
     \       \        -> CANCELLED
      \       -> CANCELLED
       -> CANCELLED
```

Rules:

- `DRAFT`: Provider cấu hình, public không thấy.
- `OPEN`: Public thấy và Customer được đăng ký nếu trong registration window.
- `CLOSED`: Khóa form đăng ký, chuẩn bị/generate lịch thi đấu.
- `RUNNING`: Event đang chạy, nhập result/advance/publish leaderboard.
- `COMPLETED`: Terminal cho event hoàn tất.
- `CANCELLED`: Terminal cho event hủy.

**BR-CT-020 — OPEN cần config đủ**  
IF: Provider gọi open  
THEN: Contest phải có cafe tham gia, time range hợp lệ, capacity > 0, registration window, vehicle_rule/config tối thiểu.

**BR-CT-021 — CLOSE khóa registration**  
IF: Contest chuyển `OPEN -> CLOSED`  
THEN: Không nhận registration mới.

**BR-CT-022 — Generate schedule chỉ sau close**  
IF: Provider/Staff generate matches  
THEN: Contest phải ở `CLOSED` hoặc `RUNNING`.

---

## 5. Registration Rules

```text
PENDING -> CONFIRMED -> CHECKED_IN
    \          \
     -> CANCELLED
```

**BR-CT-030 — Chỉ đăng ký khi OPEN**  
IF: Contest không ở `OPEN` hoặc ngoài registration window  
THEN: Reject registration.

**BR-CT-031 — Capacity tính registration active**  
IF: Capacity đã full  
THEN: Reject registration trong phase này. Waitlist là backlog.

**BR-CT-032 — Một user một registration**  
IF: User đã có registration chưa cancelled trong contest  
THEN: Reject duplicate.

**BR-CT-033 — Vehicle source phải theo rule**  
IF: Contest `vehicle_rule.vehicle_policy = RENTAL_ONLY`  
THEN: Reject BYOC. Tương tự cho `BYOC_ONLY`.

**BR-CT-034 — Check-in chỉ cho CONFIRMED**  
IF: Registration không ở `CONFIRMED`  
THEN: Reject check-in.

**BR-CT-035 — Cancel cần reason khi Provider/Staff cancel**  
IF: Provider hủy registration  
THEN: Bắt buộc reason để audit.

---

## 6. Match / Heat / Tournament Rules

Phase này dùng `contest_matches` thay cho class/round/heat/bracket cũ.

Match types:

| Type | Ý nghĩa |
|---|---|
| `HEAD_TO_HEAD` | 1v1 kiểu knockout/world cup |
| `MULTI_DRIVER` | Một heat có nhiều driver, ví dụ 4 xe chạy cùng vòng |
| `TIME_ATTACK` | Một hoặc nhiều driver chạy lấy best lap/time |
| `FINAL` | Match/vòng cuối để xác định podium |

**BR-CT-040 — Drivers per match là config**  
IF: Provider generate schedule  
THEN: `drivers_per_match` quyết định số participant tối đa mỗi match, không hard-code 2 người.

**BR-CT-041 — Registration hợp lệ để đưa vào match**  
IF: Registration status không phải `CONFIRMED` hoặc `CHECKED_IN`  
THEN: Không được đưa vào match.

**BR-CT-042 — Drag/drop participants không đổi identity**  
IF: Provider/Staff reorder slot/lane/grid  
THEN: Chỉ update `slot_no`, `lane`, `grid_position`, `seed_no`; không tạo registration mới.

**BR-CT-043 — Result thủ công phải có reason**  
IF: Staff submit result  
THEN: Ghi reason và audit `match.result_submitted`.

**BR-CT-044 — Advance dựa trên winner/finish position**  
IF: Advance winner sang next match  
THEN: Chỉ advance participant có `is_winner=true` hoặc thỏa `advancement_rule`.

---

## 7. Leaderboard & Prize

**BR-CT-050 — Leaderboard phase này là snapshot trong contest config**  
IF: Publish leaderboard  
THEN: Ghi ordered standings vào `contests.config.leaderboard` và audit `leaderboard.published`.

**BR-CT-051 — Không publish nếu chưa có result hoàn tất**  
IF: Không có completed final/result hợp lệ  
THEN: Reject publish leaderboard.

**BR-CT-052 — Prize chỉ là config hiển thị**  
IF: Contest có prize  
THEN: Lưu trong `contests.config.prizes`; không phát voucher/package tự động trong phase này.

**BR-CT-053 — Cash prize nằm ngoài platform**  
IF: Provider trao tiền mặt  
THEN: Hệ thống chỉ ghi mô tả manual, không xử lý payout/thuế/fraud.

**BR-CT-054 — Local leaderboard không phải global leaderboard**
IF: Provider publish leaderboard của contest
THEN: Chỉ ghi snapshot local vào `contests.config.leaderboard`; bảng xếp hạng liên tỉnh/toàn quốc phải đọc từ `race_records` đã verified trong Universal Racing Network.

**BR-CT-055 — Global sync chỉ sau publish/correction hợp lệ**
IF: Contest muốn sync kết quả sang Universal Racing Network
THEN: Contest phải có leaderboard đã publish, không còn match non-terminal, và mọi correction liên quan phải được audit trước khi tạo/cập nhật `race_records`.


---

## 8. Monitoring & Audit

Audit events bắt buộc:

```text
contest.created
contest.updated
contest.opened
contest.closed
contest.cancelled
registration.created
registration.cancelled
registration.checked_in
match.schedule_generated
match.participants_updated
match.result_submitted
match.advanced
leaderboard.published
race_records.synced
```

**BR-CT-060 — Audit log nằm trong cùng transaction**  
IF: Business mutation ghi DB  
THEN: Audit row phải được ghi cùng transaction với mutation đó.

**BR-CT-061 — Audit payload nhỏ và hữu ích**  
IF: Ghi `before_json`/`after_json`  
THEN: Chỉ lưu fields thay đổi, không lưu payload quá lớn.

**BR-CT-062 — Logger vẫn cần cho vận hành runtime**  
IF: Ghi audit DB  
THEN: Vẫn log `ContestAudit` bằng logger để debug production.

---

## 9. Payment & Schedule Gaps

**BR-CT-070 — Không tạo booking giả cho entry fee**  
IF: Contest có `entry_fee > 0`  
THEN: Phase payment sau phải dùng `CONTEST_ENTRY` subject riêng hoặc `contest_registration_id` nullable trong payment component.

**BR-CT-071 — Schedule block là next phase quan trọng**  
IF: Contest chạy thật trong khung giờ sân  
THEN: Cần block lịch track/cafe để booking thường không trùng.

**BR-CT-072 — BYOC tech-check là next phase**  
IF: Contest cho BYOC  
THEN: Phase sau cần checklist structured; phase này có thể ghi manual note trong registration metadata.

---

## 10. Acceptance Checklist

- [ ] Provider tạo/sửa/open/close/cancel contest được.
- [ ] Public không thấy DRAFT.
- [ ] Customer đăng ký khi OPEN và bị chặn sau CLOSED.
- [ ] Provider dashboard xem registrations, counts, status, vehicle source, check-in info.
- [ ] Staff lookup/check-in bằng code, không lộ full list.
- [ ] Generate 1v1 knockout và multi-driver heat bằng cùng model match.
- [ ] Patch participants hỗ trợ reorder slot/lane/grid.
- [ ] Submit result và advance winner/qualified được audit.
- [ ] Publish leaderboard vào config và public detail đọc được.
- [ ] Audit logs có row cho mọi mutation quan trọng.
- [ ] Legacy advanced endpoints/model cũ không còn là contract phase này.

---

## 11. Recommended Demo Flow

Demo hợp lý nhất cho capstone:

1. Provider tạo `RCField Rental Spec Cup`.
2. Chọn 1-2 cafe tham gia, capacity 8 hoặc 16.
3. Config `format=KNOCKOUT`, `drivers_per_match=2`, rule rental-only, prize manual.
4. Open contest.
5. Customer đăng ký.
6. Staff check-in bằng mã.
7. Provider close registration.
8. Generate bracket 1v1.
9. Staff nhập result từng match và advance winner.
10. Publish leaderboard/podium.
11. Xem audit log để chứng minh monitoring.

## 12. Contest Vehicle Review & Rental Link Finalization

**BR-CT-090 — Rental contest uses Booking/Session, not fake contest rental**  
IF: Contest requires organizer rental car (`vehicle_rule.vehicle_policy = RENTAL_ONLY`) or a `MIXED` contest registration chooses `vehicle_source = RENTAL`  
THEN: Customer must use the normal Booking flow for rental payment, vehicle hold, session check-in/check-out, and inspection. Contest registration stores `booking_id`/`vehicle_id` only as a link to that operational flow. Contest must not create a fake booking or duplicate rental payment/inspection logic.

**BR-CT-091 — BYOC review is per contest registration**  
IF: Customer chooses `vehicle_source = BYOC`  
THEN: Customer must submit/select a `customer_vehicle_id`; the contest registration starts as `PENDING`. Provider or assigned Staff reviews whether that car is acceptable for this contest/track, then approves to `CONFIRMED` or rejects to `CANCELLED` with a reason. This is not a global permanent vehicle certification.

**BR-CT-092 — Rejected BYOC should offer a rental path when allowed**  
IF: BYOC is rejected in a `MIXED` contest  
THEN: UI should show the rejection reason and guide the customer to register again with organizer rental. If contest is `BYOC_ONLY`, UI only shows the rejection reason.

**BR-CT-093 — Staff operation is localized by match cafe**  
IF: Staff checks in a registration, reorders match participants, submits results, or corrects results  
THEN: Staff must be assigned to the exact cafe used by that registration/match. Provider owner can operate across their contest cafes.

**BR-CT-094 — Result correction and leaderboard guard**  
IF: A result is corrected after downstream matches are completed  
THEN: only Provider can force cascade, and the correction must be audit logged. Leaderboard cannot be published while any contest match is still non-terminal (`DRAFT`, `READY`, `RUNNING`).

**BR-CT-095 — Corrected published result must re-sync race records**
IF: Result correction changes `best_lap_ms`, `total_time_ms`, `finish_position`, `score`, `is_winner`, or disqualification after race records were synced
THEN: Backend must mark previous synced record as `SUPERSEDED` or update through an audited re-sync flow before global leaderboard can use the corrected value.
