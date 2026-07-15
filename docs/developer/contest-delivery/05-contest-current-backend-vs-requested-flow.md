# Contest Current Backend vs Requested Flow

**Last updated:** 2026-07-14  
**Audience:** Backend, Frontend, Product, Demo operator  
**Purpose:** Đọc nhanh để biết yêu cầu contest đang muốn gì, backend hiện có gì, FE nên chia luồng thế nào, và gap nào không được hiểu nhầm là đã xong.

---

## 1. One-page Answer

| Bạn muốn làm rõ | Backend hiện có | Backend còn thiếu | FE nên làm |
|---|---|---|---|
| Ngày mở/đóng đăng ký và ngày diễn ra giải | Có `registration_opens_at`, `registration_closes_at`, `starts_at`, `ends_at` | Chưa auto-close status bằng cron | Hiển thị 2 timeline riêng: đăng ký và thi đấu |
| Provider có nhiều cafe, chọn sân nào để khóa | Có `participating_cafe_ids`, `track_type_id`, `config.resource_locks` | FE cần load track config theo cafe để chọn dễ | Màn Setup phải có bước Cafe/Track Lock |
| Khóa cả cafe hoặc một số sân | Có `FULL_BRANCH`, `SELECTED_TRACKS`; booking bị chặn khi trùng | Không thiếu ở backend core | UI phải cảnh báo ảnh hưởng booking thường |
| Tiền thưởng | Có thể lưu trong `config.prizes` | Chưa có phát thưởng/payout/claim | Hiển thị là manual prize, không như platform payout |
| Phí đăng ký/tiền thu vào | Có `entry_fee`, `entry_fee_amount`, `payment_status`, mark paid/waive | Chưa có VNPay contest, chưa có revenue dashboard đầy đủ | Tab Registrations hiển thị fee status; Metrics ghi rõ chưa đủ doanh thu |
| Người dùng biết bao nhiêu người đã tham gia | Có registrations list cho Provider; detail/list payload cần FE tổng hợp hoặc backend enrich | Public count/capacity chưa phải metric revenue rõ | Public card/detail hiển thị registered/capacity nếu payload có hoặc FE fetch thêm |
| Knockout/time trial quản lý thế nào | Có `runtime_format`, generate matches, submit/correct/advance/publish | UI hiện cần tách rõ theo format | Runtime page branch: bracket vs time trial |
| Publish leaderboard và xem lại sau giải | Có `published_leaderboard`, matches public, contest `COMPLETED` | Cần FE render rõ snapshot local | Public detail có section Hall of Fame/Leaderboard |
| Rút gọn trạng thái người dùng | Service đã derive customer journey status | FE cần dùng journey status thay vì state kỹ thuật | Customer chỉ thấy trạng thái dễ hiểu |
| Audit staff chống gian lận | Có audit logs và endpoint Provider đọc | Chưa có incident/ban contest riêng | Provider có tab Audit |
| Người phá giải/ban | Có cancel/reject/DQ mềm qua result | Chưa có contest ban list/evidence/unban | Docs ghi gap; chưa build UI ban như đã xong |

---

## 2. Provider Flow Đề Xuất

### Step 1: Setup contest

Provider nhập:

- Tên, mô tả, banner.
- Type/format/template từ contest catalog.
- Registration window:
  - `registration_opens_at`
  - `registration_closes_at`
- Race window:
  - `starts_at`
  - `ends_at`
- Track type:
  - `track_type_id`
- Cafe tham gia:
  - `participating_cafe_ids`
- Capacity:
  - `capacity`
- Fee:
  - `entry_fee`
- Prize/rules:
  - `config.prizes`
  - `config.rules_text` nếu FE dùng.

Backend hiện validate được time, catalog, cafe ownership, active track type và booking conflict.

### Step 2: Lock sân/cafe

Provider chọn một trong hai kiểu cho từng cafe:

| Option | Backend value | Khi nào dùng |
|---|---|---|
| Khóa cả quán/cafe | `FULL_BRANCH` | Giải chiếm toàn bộ venue, không nhận booking thường |
| Khóa một số sân | `SELECTED_TRACKS` | Cafe vẫn nhận booking ở sân khác |

Config gửi lên:

```json
{
  "resource_locks": [
    {
      "cafe_id": "uuid",
      "scope": "SELECTED_TRACKS",
      "track_config_ids": ["uuid"]
    }
  ]
}
```

Backend hiện:

- tự resolve active track configs;
- reject nếu contest lock đè booking existing;
- chặn booking mới khi overlap contest lock;
- availability báo unavailable khi slot bị contest giữ.

### Step 3: Open registration

Provider gọi:

```text
POST /api/v1/contests/:contestId/open
```

Customer chỉ đăng ký được khi contest `OPEN` và trong registration window.

### Step 4: Manage registrations and fee

Provider xem:

```text
GET /api/v1/contests/:contestId/registrations
```

Fee hiện là manual:

```text
POST /api/v1/contest-registrations/:registrationId/mark-entry-fee-paid
POST /api/v1/contest-registrations/:registrationId/waive-entry-fee
```

Provider approve/reject:

```text
POST /api/v1/contest-registrations/:registrationId/approve
POST /api/v1/contest-registrations/:registrationId/reject
```

Important gap: chưa có VNPay cho contest entry fee. Nếu entry fee > 0, FE không được tự redirect VNPay bằng booking payment flow.

### Step 5: Event day check-in

Staff/Provider lookup:

```text
GET /api/v1/contests/:contestId/registrations/lookup?check_in_code=...
```

Check-in:

```text
POST /api/v1/contest-registrations/:registrationId/check-in
```

Điều kiện:

- registration `CONFIRMED`;
- cafe check-in thuộc contest;
- Staff assigned đúng cafe.

### Step 6: Runtime by format

Generate:

```text
POST /api/v1/contests/:contestId/matches/generate
```

Backend chỉ nhận registration đã `CHECKED_IN`.

Nếu `runtime_format = KNOCKOUT`:

- FE hiển thị bracket.
- Staff nhập winner/finish position.
- Provider/Staff advance winner.

Nếu `runtime_format = TIME_TRIAL`:

- FE hiển thị từng lượt thi.
- Staff nhập `best_lap_ms` hoặc `total_time_ms`.
- Ranking sort theo leaderboard mode.

### Step 7: Publish leaderboard

Provider publish:

```text
POST /api/v1/contests/:contestId/leaderboard/publish
```

Backend:

- chặn nếu còn match chưa completed;
- build leaderboard;
- lưu vào `contests.config.published_leaderboard`;
- chuyển contest `COMPLETED`;
- ghi audit.

Public page sau giải nên hiển thị leaderboard như Hall of Fame local của contest.

### Step 8: Audit and metrics

Provider xem:

```text
GET /api/v1/contests/:contestId/audit-logs
GET /api/v1/contests/:contestId/metrics
```

Metrics hiện là operational metrics, chưa phải revenue report đầy đủ.

---

## 3. Customer Flow Đề Xuất

Customer public detail cần thấy:

- contest name/banner/description;
- cafe tham gia;
- track type;
- registration open/close;
- race start/end;
- capacity và số người đã đăng ký;
- entry fee;
- prize/rules;
- vehicle rule;
- CTA đăng ký;
- my registration status nếu đã đăng nhập;
- leaderboard sau khi publish.

Registration hiện tại yêu cầu customer có booking rental `CONFIRMED` phù hợp:

```json
{
  "booking_id": "uuid",
  "vehicle_id": "uuid",
  "vehicle_source": "RENTAL"
}
```

Customer-facing status nên dùng:

| Status | Text gợi ý |
|---|---|
| `PENDING_APPROVAL` | Chờ xác nhận đăng ký |
| `APPROVED_WAITING_CHECKIN` | Đã được duyệt, chờ check-in |
| `CHECKED_IN_WAITING_BRACKET` | Đã check-in, chờ xếp lượt |
| `IN_BRACKET` | Đang thi đấu |
| `ADVANCED` | Đã qua vòng |
| `ELIMINATED` | Đã bị loại |
| `FINISHED` | Đã hoàn thành giải |
| `CANCELLED` | Đăng ký đã hủy/từ chối |

Không bắt customer hiểu match `DRAFT`, `READY`, `RUNNING`.

---

## 4. Staff Flow Đề Xuất

Staff chỉ cần màn hình vận hành ngày thi:

1. Danh sách contest tại cafe được assign.
2. Lookup registration bằng check-in code.
3. Check-in.
4. Runtime theo format:
   - Knockout: chọn match, nhập kết quả, advance nếu được.
   - Time trial: chọn lượt, nhập time.
5. Không có quyền force cascade correction.
6. Mọi thao tác có audit để Provider kiểm tra.

---

## 5. Backend Gaps To Implement Later

### 5.1 VNPay Contest Entry

Cần thêm:

- payment subject `CONTEST_ENTRY`;
- payment transaction/component link `contest_registration_id`;
- create payment URL endpoint;
- VNPay return/IPN update registration payment;
- cancel/refund policy khi contest bị cancel;
- audit fee paid/refunded.

### 5.2 Revenue Dashboard

Cần trả từ metrics hoặc endpoint report riêng:

- total registrations;
- paid registrations;
- pending payment registrations;
- waived registrations;
- expected gross;
- paid gross;
- pending amount;
- waived amount;
- refunded amount nếu có payment thật;
- conversion rate.

### 5.3 BYOC Registration

Cần:

- `customer_vehicle_id` trong registration payload;
- service bỏ rental-only guard khi rule cho BYOC;
- validate vehicle thuộc customer;
- review BYOC theo contest;
- reject reason;
- FE hướng customer đổi sang rental nếu `MIXED`.

### 5.4 Contest Ban / Incident

Cần nếu muốn xử lý người phá giải bài bản:

```text
contest_participant_incidents
contest_bans
contest_disciplinary_actions
```

Minimum fields:

- `contest_id`
- `provider_id`
- `user_id`
- `registration_id`
- `scope`: `CONTEST` hoặc `PROVIDER`
- `reason`
- `evidence_urls`
- `starts_at`
- `expires_at`
- `created_by`
- `revoked_by`
- `revoked_at`

Rules:

- Ban/unban/disqualify phải audit.
- Customer bị ban không đăng ký được contest trong scope ban.
- Không dùng `users.is_active` cho contest ban, vì đó là khóa tài khoản toàn hệ thống.

### 5.5 Auto Close Registration

Cần job:

- scan contest `OPEN`;
- nếu `registration_closes_at <= now`, chuyển `CLOSED`;
- ghi audit actor `SYSTEM`.

---

## 6. Current Backend Evidence

Files đã đối chiếu:

- `rcfield-be/src/routes/contest.routes.ts`
- `rcfield-be/src/controllers/contest.controller.ts`
- `rcfield-be/src/services/contest.service.ts`
- `rcfield-be/src/services/contest-runtime.service.ts`
- `rcfield-be/src/services/contest-lock.service.ts`
- `rcfield-be/src/validate/index.ts`
- `rcfield-be/src/types/index.ts`
- `rcfield-be/src/__tests__/routes/contest-runtime.test.ts`

Existing test coverage confirms:

- time trial generate/submit/publish/metrics/audit;
- knockout advance and correction guard;
- reject runtime generation from non-check-in registration;
- reject contest create when booking conflict exists;
- availability unavailable when contest lock blocks the slot.
