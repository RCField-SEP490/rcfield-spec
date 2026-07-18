# Contest Module Specification

**Last Updated:** 2026-07-14  
**Status:** Backend-current truth + requested operating flow  
**Related docs:** `docs/spec/business-rules/BR-contest.md`, `docs/architecture/03-contest.md`, `docs/developer/contest-delivery/05-contest-current-backend-vs-requested-flow.md`, `docs/spec/05-api-contracts.md`, `docs/spec/06-database.md`, `docs/spec/09-universal-racing-network.md`

---

## 1. Intent

Contest là module tổ chức giải đua ở phạm vi Provider. Provider tạo giải cho một hoặc nhiều cafe của mình, Customer đăng ký, Staff/Provider check-in và vận hành ngày thi đấu, sau đó Provider publish leaderboard local của giải.

Tài liệu này làm rõ **backend hiện có gì** và **những điểm sản phẩm muốn nhưng backend chưa đủ**. FE không được hiểu các gap như tính năng đã hoàn thành.

```text
CONTEST = event/tournament operations
BOOKING = lịch chơi/thuê xe thông thường
SESSION = ca chơi thực tế, inspection, checkout
```

---

## 2. Backend Current vs Requested

| Chủ đề | Backend hiện có | Còn thiếu / cần làm rõ |
|---|---|---|
| Thời gian contest | Có `registration_opens_at`, `registration_closes_at`, `starts_at`, `ends_at`; create validate đăng ký đóng trước hoặc bằng giờ bắt đầu | Cron tự chuyển `OPEN -> CLOSED` khi hết giờ đăng ký đã có; vẫn cần monitor job |
| Cafe tham gia | Có `contest_cafes`, `participating_cafe_ids`, chỉ cho cafe ACTIVE thuộc Provider | Update participating_cafe_ids khi đã có registration cần merge metadata thay vì xóa |
| Track type | Có `track_type_id`; registration rental phải có booking cùng track type | FE cần hiển thị rõ host/participating branches |
| Khóa sân/cafe | Có `config.resource_locks`, `FULL_BRANCH`, `SELECTED_TRACKS`; backend chặn booking trùng contest | FE cần phản ánh đây là current feature, không phải backlog |
| Entry fee | Có `entry_fee`, `entry_fee_amount`, `payment_status`; Provider mark paid/waive thủ công; `CONTEST_ENTRY` payment subject; chặn duplicate payment URL | Chưa nối VNPay IPN tự động xác nhận; refund tiền thật do payment flow xử lý |
| Revenue dashboard | Metrics có registration/match/leaderboard/global sync + revenue summary | Gross/paid/pending/waived/conversion đã có ở metrics |
| Prize | Có thể lưu trong `contests.config.prizes` để hiển thị | Chưa có reward claim, payout, tự phát voucher/package |
| Runtime format | Có `KNOCKOUT` và `TIME_TRIAL` qua `runtime_format`; dùng `contest_matches` | Multi-driver heat nâng cao chưa phải UI/runtime chính |
| Leaderboard | Có publish local leaderboard vào `contests.config.published_leaderboard`; contest -> `COMPLETED` | Public cần đọc snapshot này rõ ràng; global leaderboard đọc `race_records` sau sync |
| Audit | Có `contest_audit_logs`, Provider đọc `/audit-logs` với pagination | FE cần tab Audit; chưa có incident/ban riêng cho contest |
| Ban/phá giải | Có `contest_bans` với scope `CONTEST`/`PROVIDER`, evidence, expires, lift | Chưa có contest-specific incident table; chưa có rule tự động chặn đăng ký lại |

---

## 3. Create Contest Flow

Provider tạo contest bằng `POST /api/v1/contests`. Payload chính:

- `name`, `description`, `banner_image_url`
- `contest_type_id`, `contest_format_id`, `contest_template_id`
- `track_type_id`
- `participating_cafe_ids`
- `registration_opens_at`, `registration_closes_at`
- `starts_at`, `ends_at`
- `capacity`
- `entry_fee`
- `vehicle_rule`
- `config`

Validation hiện có:

- `ends_at > starts_at`
- `registration_opens_at < registration_closes_at`
- `registration_closes_at <= starts_at`
- cafe tham gia phải ACTIVE và thuộc Provider
- `track_type_id` phải active
- contest type/format/template phải active và khớp nhau
- không được tạo contest nếu resource lock trùng booking đang `PENDING` hoặc `CONFIRMED`

State chính:

```text
DRAFT -> OPEN -> CLOSED -> RUNNING -> COMPLETED
   \       \        \          \
    \       \        \          -> CANCELLED
     \       \        -> CANCELLED
      \       -> CANCELLED
       -> CANCELLED
```

Backend hiện cho Provider chuyển:

- `DRAFT -> OPEN`
- `OPEN -> CLOSED` (thủ công hoặc tự động qua cron khi hết registration window)
- `DRAFT/OPEN/CLOSED/RUNNING -> CANCELLED` (kích hoạt cleanup registrations + matches + refund flags)
- `RUNNING/COMPLETED` xảy ra qua runtime/result/publish flow

---

## 4. Resource Lock: Khóa Sân Hoặc Khóa Cafe

Contest không dùng luồng đóng/mở cửa cafe. Contest dùng `config.resource_locks` để giữ tài nguyên thi đấu trong thời gian `starts_at -> ends_at`.

Shape khuyến nghị:

```json
{
  "resource_locks": [
    {
      "cafe_id": "uuid",
      "scope": "FULL_BRANCH",
      "track_config_ids": []
    },
    {
      "cafe_id": "uuid",
      "scope": "SELECTED_TRACKS",
      "track_config_ids": ["uuid-track-config-1"]
    }
  ]
}
```

Ý nghĩa:

- `FULL_BRANCH`: khóa cả cafe trong thời gian contest, booking thường không được tạo ở cafe đó.
- `SELECTED_TRACKS`: chỉ khóa các track config được chọn. Nếu booking không có `track_config_id`, backend fallback so với `track_type_id`.

Backend hiện có:

- `resolveContestResourceLocks`: tự resolve lock theo cafe và track config active.
- `assertNoContestBookingConflicts`: chặn tạo/update contest nếu đã có booking trùng.
- `assertBookingNotBlockedByContest`: chặn customer booking nếu slot bị contest giữ.
- Cafe availability trả unavailable khi khung giờ bị contest lock.

FE Provider cần:

1. Khi chọn cafe, load danh sách track configs active của cafe đó.
2. Cho Provider chọn khóa cả cafe hoặc chọn từng sân.
3. Hiển thị cảnh báo nếu khóa cả cafe sẽ làm mất booking thường trong thời gian contest.
4. Gửi `resource_locks` trong `config`.

---

## 5. Public Registration Flow

Customer chỉ đăng ký được khi:

- contest `OPEN`
- thời điểm hiện tại nằm trong registration window
- capacity chưa đầy
- user chưa có registration active trong contest
- phải khớp `vehicle_rule.vehicle_policy` (`RENTAL_ONLY`, `BYOC_ONLY`, `MIXED`)
- với `RENTAL`, có 2 cách:
  1. Dùng booking đã có: booking thuộc customer, `CONFIRMED` (hoặc đang tạo từ rental slot), cùng `track_type_id`, thuộc cafe tham gia contest, giao với thời gian contest, có `vehicle_id` thuộc booking.
  2. Thuê xe ngay trong form đăng ký qua `rental_slot`: backend tạo booking PENDING, customer thanh toán booking trước khi provider duyệt đăng ký.
- với `BYOC`, khai báo tên xe/hãng/class và chờ provider duyệt.

Endpoint:

```text
POST /api/v1/contests/:contestId/register
```

Payload RENTAL với booking đã có:

```json
{
  "booking_id": "uuid",
  "vehicle_id": "uuid",
  "vehicle_source": "RENTAL"
}
```

Payload RENTAL thuê xe ngay:

```json
{
  "vehicle_source": "RENTAL",
  "rental_slot": {
    "cafe_id": "uuid",
    "slot_start": "2026-07-20T09:00:00.000Z",
    "slot_end": "2026-07-20T10:00:00.000Z",
    "track_config_id": "uuid | null",
    "vehicle_catalog_id": "uuid | null"
  }
}
```

Payload BYOC:

```json
{
  "vehicle_source": "BYOC",
  "byoc_vehicle_name": "Yokomo MD 2.0",
  "byoc_vehicle_brand": "Yokomo",
  "byoc_vehicle_class": "Drift",
  "byoc_vehicle_notes": "Front motor conversion"
}
```

Đăng ký thành công tạo notification in-app và email xác nhận cho customer.

Public FE cần hiển thị:

- tên giải, banner, mô tả, luật
- registration open/close
- race start/end
- cafe tham gia
- track type
- capacity và số đăng ký hiện tại
- entry fee
- prize/rules từ config
- trạng thái đăng ký của chính customer nếu đã đăng nhập
- leaderboard nếu đã publish

---

## 6. Entry Fee, VNPay Và Revenue

Backend hiện có dữ liệu phí:

- `contests.entry_fee`
- `contest_registrations.entry_fee_amount`
- `contest_registrations.payment_status`

Payment statuses:

```text
NOT_REQUIRED
PENDING_PAYMENT
PENDING_REVIEW
WAIVED
MARKED_PAID
```

Endpoint thủ công hiện có:

```text
POST /api/v1/contest-registrations/:registrationId/mark-entry-fee-paid
POST /api/v1/contest-registrations/:registrationId/waive-entry-fee
```

Hiện backend **đã có VNPay contest payment** qua `POST /api/v1/contest-registrations/:registrationId/create-entry-fee-payment`. Hệ thống tạo payment transaction với subject `CONTEST_ENTRY`, link `contest_registration_id`. VNPay return/IPN cập nhật `payment_status`.

Khi dùng `rental_slot` để thuê xe ngay trong đăng ký, booking thuê xe được tạo ở trạng thái PENDING. Customer thanh toán booking riêng; provider chỉ duyệt đăng ký contest khi booking thuê xe đã `CONFIRMED`. Không dùng booking giả để thu entry fee.
- audit `registration.entry_fee_paid`
- refund policy khi contest bị cancel

Revenue metrics hiện còn thiếu. `GET /api/v1/contests/:contestId/metrics` hiện có:

- registration counts
- match counts
- leaderboard status
- global sync status

Nếu FE cần dashboard doanh thu contest, backend cần bổ sung:

- expected gross = active registrations * entry fee
- paid gross = registrations `MARKED_PAID`
- waived amount/count
- pending amount/count
- cancelled/refunded amount/count nếu có payment thật
- payment conversion rate

---

## 7. Prize / Reward

Backend có thể lưu prize trong `contests.config`, ví dụ:

```json
{
  "prizes": [
    {
      "rank": 1,
      "title": "Champion",
      "description": "Cash 1,000,000 VND"
    }
  ]
}
```

Current behavior:

- prize chỉ là thông tin hiển thị
- cash prize nằm ngoài platform
- không có payout/thuế/fraud workflow
- không tự phát voucher/package
- không có reward claim lifecycle

FE cần hiển thị prize như cam kết thủ công của Provider, không hiển thị như phần thưởng đã được platform bảo đảm thanh toán.

---

## 8. Check-in Và Trạng Thái Người Dùng

Registration state thật:

```text
PENDING -> CONFIRMED -> CHECKED_IN
    \          \
     -> CANCELLED
```

Check-in:

```text
POST /api/v1/contest-registrations/:registrationId/check-in
```

Điều kiện:

- registration phải `CONFIRMED`
- contest phải `CLOSED` hoặc `RUNNING` và nằm trong race window (`starts_at <= now <= ends_at`)
- `checked_in_cafe_id` thuộc contest
- Staff phải assigned đúng cafe đó
- Provider owner có thể thao tác toàn bộ cafe trong contest
- Check-in code được tạo ngẫu nhiên bảo mật và có unique constraint DB

FE Customer không nên hiển thị quá nhiều trạng thái kỹ thuật. Dùng journey status rút gọn:

| Journey status | Ý nghĩa |
|---|---|
| `PENDING_APPROVAL` | Đã đăng ký, chờ Provider duyệt/phí |
| `APPROVED_WAITING_CHECKIN` | Đã được duyệt, chờ tới ngày thi |
| `CHECKED_IN_WAITING_BRACKET` | Đã check-in, chờ xếp lịch |
| `IN_BRACKET` | Đang trong bracket/lượt thi |
| `ADVANCED` | Đã qua vòng |
| `ELIMINATED` | Đã bị loại |
| `FINISHED` | Giải đã kết thúc |
| `CANCELLED` | Đăng ký bị hủy/từ chối |

---

## 9. Runtime: Knockout Và Time Trial

Tất cả runtime dùng:

```text
contest_matches
contest_match_participants
```

Generate:

```text
POST /api/v1/contests/:contestId/matches/generate
```

Payload:

```json
{
  "cafe_id": "uuid",
  "track_config_id": "uuid-or-null",
  "registration_ids": ["uuid"],
  "drivers_per_match": 2,
  "seeding_mode": "CHECK_IN_ORDER"
}
```

Backend chỉ cho đưa registration đã `CHECKED_IN` vào runtime.  
Generate matches bị chặn nếu contest đã có match `COMPLETED` hoặc `RUNNING` để tránh xóa kết quả đã có.

`updateMatchParticipants` dùng UPSERT thay vì xóa toàn bộ, giữ lại result data đã nhập.  
Không được chỉnh participant khi match đang `RUNNING`.

### Knockout

Khi `runtime_format = KNOCKOUT`:

- backend tạo round/match dạng bracket
- first round nhận participant theo seed/check-in order
- mỗi match có `next_match_id`
- submit result xong có thể advance winner sang match kế tiếp
- leaderboard mode mặc định `KNOCKOUT_WINS`

UI Provider/Staff cần:

- bracket view theo round
- match detail panel
- participant slots/lane/grid
- form nhập `finish_position`, `is_winner`, `score`, `result_note`
- action `Advance winner`
- correction flow có reason và `force_cascade` chỉ cho Provider

### Time Trial

Khi `runtime_format = TIME_TRIAL`:

- mỗi registration tạo một match/lượt thi riêng
- match type `TIME_ATTACK`
- nhập `best_lap_ms` hoặc `total_time_ms`
- leaderboard sort theo `BEST_LAP` hoặc `TOTAL_TIME`

UI Provider/Staff cần:

- danh sách lượt thi theo thứ tự
- form nhập thời gian từng người
- bảng ranking realtime sau khi match completed
- nút publish leaderboard khi mọi lượt đã completed

---

## 10. Result Correction Và Publish Leaderboard

Submit result:

```text
POST /api/v1/contest-matches/:matchId/results
```

Correct result:

```text
POST /api/v1/contest-matches/:matchId/results/correct
```

Advance:

```text
POST /api/v1/contest-matches/:matchId/advance
```

Publish:

```text
POST /api/v1/contests/:contestId/leaderboard/publish
```

Guard hiện có:

- result phải thuộc participant của match
- submit result cần `reason`
- match completed mới được correct
- Staff không được `force_cascade`; Provider mới có force_cascade
- nếu downstream đã linked, correction không force sẽ bị chặn
- nếu **bất kỳ downstream match** nào đã completed, force correction cũng bị chặn
- correction xóa toàn bộ downstream participants và reset chúng về `DRAFT`
- publish bị chặn nếu còn match `DRAFT`, `READY`, `RUNNING` hoặc thiếu result
- publish local leaderboard vào `contests.config.published_leaderboard`
- contest chuyển `COMPLETED`

Public sau giải:

- `GET /api/v1/contests/:contestId` cần hiển thị `published_leaderboard` nếu có
- `GET /api/v1/contests/:contestId/matches` vẫn cho xem lại bracket/matches của contest public
- local leaderboard khác global leaderboard
- global leaderboard chỉ đọc `race_records` verified sau `sync-race-records`

---

## 11. Audit Và Metrics

Audit:

```text
GET /api/v1/contests/:contestId/audit-logs?page=1&limit=20
```

Response dạng paginated: `data`, `meta.total`, `meta.page`, `meta.limit`.

Metrics:

```text
GET /api/v1/contests/:contestId/metrics
```

Audit events hiện có trong backend gồm:

- `contest.created`
- `contest.updated`
- `contest.opened`
- `contest.closed`
- `contest.cancelled`
- `registration.created`
- `registration.entry_fee_marked_paid`
- `registration.entry_fee_waived`
- `registration.approved`
- `registration.rejected`
- `registration.cancelled`
- `registration.checked_in`
- `contest.matches_generated`
- `match.participants_updated`
- `match.results_submitted`
- `match.results_corrected`
- `match.advanced`
- `contest.leaderboard_published`
- `race_records.synced`

FE Provider cần có tab Audit để xem:

- actor id/role
- event type
- registration/match liên quan
- before/after json
- reason
- created time

---

## 12. Unhappy Cases, Disqualification Và Ban

Backend hiện xử lý được:

- reject/cancel/disqualify registration có reason; disqualify đồng thời xóa participant khỏi matches chưa completed
- cancel contest: hủy registrations, đánh dấu refund_needed cho paid, chuyển matches sang CANCELLED, ghi audit
- contest-specific ban list với scope `CONTEST`/`PROVIDER`, evidence, expires, lift
- sửa result có audit
- chặn Staff thao tác sai cafe
- chặn publish khi match chưa xong hoặc thiếu result
- chặn booking trùng contest lock
- chặn duplicate entry-fee payment URL
- atomic capacity check + unique check-in code

Backend chưa có:

- contest-specific incident table
- rule tự động chặn người đã phá giải đăng ký lại
- automated refund qua payment gateway (refund flag được set, tiền thật cần payment flow xử lý)

Không dùng `users.is_active` để thay contest ban, vì đó là khóa tài khoản toàn hệ thống.

Nếu muốn làm bài bản, phase sau cần:

```text
contest_participant_incidents
contest_bans
contest_disciplinary_actions
```

Minimum behavior đề xuất:

- Staff/Provider report incident với reason/evidence.
- Provider có thể disqualify registration khỏi match/contest.
- Provider có thể ban user khỏi contest hiện tại hoặc khỏi contest của provider trong thời hạn nhất định.
- Ban/unban/disqualify đều ghi audit.
- Customer bị ban không đăng ký được contest nằm trong scope ban.

---

## 13. FE Screen Contract

Provider nên chia contest thành các màn hình/tabs:

1. **Setup**: info, time, cafe, track type, resource locks, prize, fee.
2. **Registrations**: danh sách người đăng ký, payment status, approve/reject/cancel.
3. **Check-in**: lookup/check-in code, cafe check-in.
4. **Runtime**:
   - Knockout bracket UI nếu `runtime_format=KNOCKOUT`
   - Time trial run list/ranking UI nếu `runtime_format=TIME_TRIAL`
5. **Leaderboard**: preview/publish, local snapshot.
6. **Metrics**: counts hiện có, revenue khi backend bổ sung.
7. **Audit**: lịch sử thao tác.

Staff nên có:

- contest list theo cafe assigned
- check-in screen
- runtime screen theo format
- result submit/correct không force cascade

Customer nên có:

- public listing/detail
- registration status rõ ràng
- my contest registrations
- bracket/leaderboard read-only

---

## 14. Implementation Notes

- Không viết docs như thể VNPay contest đã xong.
- Không viết BYOC như đã xong; backend register hiện rental-only.
- Không viết schedule block là future; backend đã có contest lock.
- Không dùng `contests.config.published_leaderboard` làm global leaderboard.
- Không dùng user global deactivate thay contest ban.
