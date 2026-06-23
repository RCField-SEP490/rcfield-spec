# 05 — API Contracts

**Last updated**: 2026-06-23
> Convention: tất cả response đều wrap trong `{ data, meta?, error? }`
> Auth header: `Authorization: Bearer <jwt_token>`

---

## Auth

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| POST | `/auth/register` | Public | Đăng ký Customer/Provider |
| POST | `/auth/login` | Public | Đăng nhập, nhận JWT |
| POST | `/auth/refresh` | Auth | Refresh token |
| GET | `/auth/me` | Auth | Lấy thông tin user hiện tại |

---

## Cafes

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `/cafes` | Public | List cafe (filter: district, track_type, available) |
| GET | `/cafes/:id` | Public | Chi tiết cafe + reviews |
| POST | `/cafes` | PROVIDER | Tạo cafe mới (status: PENDING) |
| PATCH | `/cafes/:id` | PROVIDER | Update cafe profile |
| PATCH | `/cafes/:id/status` | ADMIN | Activate / Suspend cafe |

---

## Fleet (Vehicles)

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `/cafes/:cafeId/vehicles` | Auth | List xe của quán |
| POST | `/cafes/:cafeId/vehicles` | PROVIDER | Thêm xe mới |
| PATCH | `/cafes/:cafeId/vehicles/:id` | PROVIDER | Update xe (tier, rate, status) |
| DELETE | `/cafes/:cafeId/vehicles/:id` | PROVIDER | Retire xe (soft delete) |

---

## Bookings

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `/bookings` | Auth | List bookings (filter by role) |
| GET | `/bookings/:id` | Auth | Chi tiết booking + sessions |
| POST | `/bookings` | CUSTOMER | Tạo booking mới (hỗ trợ multi-vehicle + participants) |
| POST | `/bookings/:id/cancel` | CUSTOMER/PROVIDER | Huỷ booking |
| POST | `/bookings/:id/payment/confirm` | CUSTOMER | Xác nhận thanh toán VNPay |

**POST /bookings body (hỗ trợ multi-vehicle + participants):**
```json
{
  "cafe_id": "uuid",
  "play_mode": "RENTAL | BYOC | MIXED",
  "track_type": "DRIFT | CIRCUIT | OFFROAD",
  "slot_start": "2026-05-15T09:00:00+07:00",
  "slot_end": "2026-05-15T11:00:00+07:00",
  "participants": [
    {
      "participant_type": "BOOKER | REGISTERED_USER | WALK_IN_GUEST",
      "user_id": "uuid | null",
      "display_name": "string | null",
      "phone": "string | null",
      "is_primary_responsible": true
    }
  ],
  "vehicles": [
    {
      "vehicle_id": "uuid"
    }
  ],
  "fnb_preorder": [
    { "menu_item_id": "uuid", "quantity": 2 }
  ],
  "promotion_code": "SUMMER20 | null"
}
```

---

## Sessions

> **NEW** — Session endpoints cho vận hành thực tế.

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `/bookings/:id/sessions` | Auth | List sessions của booking |
| GET | `/sessions/:id` | Auth | Chi tiết session (participants, vehicles, inspections) |
| POST | `/bookings/:id/sessions/checkin` | STAFF | Bắt đầu check-in → tạo session |

---

## Inspections

> **THAY ĐỔI:** Inspection giờ qua session endpoint (không phải booking).

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| POST | `/sessions/:id/inspections/checkin` | STAFF | Submit check-in inspection |
| POST | `/sessions/:id/inspections/checkout` | STAFF | Submit check-out inspection |
| GET | `/sessions/:id/inspections` | Auth | Lấy inspections của session |
| POST | `/sessions/:id/inspections/checkin/confirm` | CUSTOMER | Confirm check-in |
| POST | `/sessions/:id/inspections/checkout/confirm` | CUSTOMER | Confirm check-out |
| POST | `/sessions/:id/inspections/checkout/report-damage` | STAFF | Ghi nhận damage charge Phase 1 |
| POST | `/sessions/:id/inspections/checkout/raise-incident` | CUSTOMER/STAFF | Ghi nhận incident để xử lý theo policy |

**POST /checkin body (multipart/form-data):**
```
photo_front: File
photo_back: File
photo_left: File
photo_right: File
session_vehicle_id: uuid | null    ← null nếu inspection cấp session
checklist: JSON string { scratches, cracks, missing_parts, notes }
pre_existing_flag: boolean
```

---

## Extensions

> **THAY ĐỔI:** Extension giờ qua session (không phải booking).

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| POST | `/sessions/:id/extensions` | STAFF | Gửi đề xuất gia hạn |
| POST | `/sessions/:id/extensions/:extId/approve` | CUSTOMER | Chấp nhận gia hạn |
| POST | `/sessions/:id/extensions/:extId/reject` | CUSTOMER | Từ chối gia hạn |

**POST /extensions body:**
```json
{
  "duration_minutes": 60,
  "fee_amount": 150000
}
```

---

## Incidents & Policy Resolution

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `/sessions/:id/incidents` | Auth | List incidents của session |
| POST | `/sessions/:id/incidents` | STAFF | Ghi nhận incident mới |
| PATCH | `/incidents/:id` | STAFF/ADMIN | Update incident note/status |
| POST | `/incidents/:id/resolve` | STAFF/ADMIN | Áp policy, ghi responsible_party/final_amount/resolution_note |

---

## F&B

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `/cafes/:cafeId/menu` | Public | Xem menu chi nhánh |
| POST | `/cafes/:cafeId/menu` | PROVIDER/STAFF | Thêm item menu |
| PATCH | `/cafes/:cafeId/menu/:id` | PROVIDER/STAFF | Update item menu |
| GET | `/bookings/:id/fnb-orders` | Auth | List F&B orders của booking |
| POST | `/bookings/:id/fnb-orders` | CUSTOMER | Tạo pre-order F&B |
| POST | `/sessions/:id/fnb-orders` | STAFF | Tạo on-site order |
| POST | `/fnb-orders/:id/confirm` | STAFF | Confirm order |
| PATCH | `/fnb-orders/:id/status` | STAFF | Update order status |

---

## Packages, Subscriptions, Contests

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `/cafes/:cafeId/packages` | Public | List packages |
| POST | `/cafes/:cafeId/packages` | PROVIDER | Tạo package |
| POST | `/packages/:id/purchase` | CUSTOMER | Mua package |
| GET | `/me/packages` | CUSTOMER | Gói đã mua |
| POST | `/subscriptions` | CUSTOMER/STAFF | Tạo lịch định kỳ |

### Contest Core

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `/contests` | Public/Auth | List contests public; Provider có thể dùng filter riêng để xem contest của mình |
| GET | `/cafes/:cafeId/contests` | Public/Auth | List contests có chi nhánh này tham gia |
| GET | `/contests/:id` | Public/Auth | Chi tiết contest + participating cafes + registration summary + published leaderboard |
| POST | `/contests` | PROVIDER | Tạo contest DRAFT ở cấp Provider |
| PATCH | `/contests/:id` | PROVIDER owner | Sửa DRAFT/OPEN fields được phép |
| POST | `/contests/:id/open` | PROVIDER owner | DRAFT -> OPEN |
| POST | `/contests/:id/close` | PROVIDER owner | OPEN -> CLOSED, khóa form đăng ký |
| POST | `/contests/:id/cancel` | PROVIDER owner | Hủy contest chưa COMPLETED |

### Registration & Check-In

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| POST | `/contests/:id/register` | CUSTOMER | Đăng ký contest khi OPEN |
| GET | `/contests/:id/registrations` | PROVIDER owner | Danh sách người đăng ký để dashboard/monitoring |
| GET | `/contests/:id/registrations/lookup?check_in_code=...` | PROVIDER/STAFF | Lookup một registration bằng mã check-in |
| GET | `/me/contest-registrations` | CUSTOMER | Danh sách contest đã đăng ký của user hiện tại |
| POST | `/contest-registrations/:id/check-in` | PROVIDER/STAFF | CONFIRMED -> CHECKED_IN tại một chi nhánh tham gia contest |
| POST | `/contest-registrations/:id/cancel` | CUSTOMER/PROVIDER | Hủy registration với reason |

### Tournament Schedule & Results

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `/contests/:id/matches` | Public/Auth | Lịch match/heat/final của contest |
| POST | `/contests/:id/matches/generate` | PROVIDER owner / STAFF assigned | Tạo lịch thi đấu sau khi contest CLOSED/RUNNING |
| PATCH | `/contest-matches/:id/participants` | PROVIDER owner / STAFF assigned | Cập nhật người tham gia trong match, hỗ trợ drag/drop slot |
| POST | `/contest-matches/:id/results` | PROVIDER owner / STAFF assigned | Nhập kết quả thủ công cho match |
| POST | `/contest-matches/:id/advance` | PROVIDER owner / STAFF assigned | Đẩy winner/qualified registrations sang next match |
| POST | `/contests/:id/leaderboard/publish` | PROVIDER owner / STAFF assigned | Publish leaderboard vào `contests.config.leaderboard` |
| GET | `/contests/:id/audit-logs` | PROVIDER owner | Xem business audit logs của contest |

**POST /contests body:**
```json
{
  "name": "RCField Rental Spec Cup",
  "description": "Giai dua rental spec cho cong dong RCField",
  "track_type_id": "uuid",
  "participating_cafe_ids": ["uuid-cafe-1", "uuid-cafe-2"],
  "starts_at": "2026-07-20T09:00:00+07:00",
  "ends_at": "2026-07-20T12:00:00+07:00",
  "registration_opens_at": "2026-07-01T09:00:00+07:00",
  "registration_closes_at": "2026-07-19T18:00:00+07:00",
  "capacity": 32,
  "entry_fee": 0,
  "banner_image_url": "https://cdn.rcfield.vn/contests/spec-cup.jpg",
  "vehicle_rule": {
    "vehicle_policy": "RENTAL_ONLY",
    "assignment_policy": "AT_CHECK_IN"
  },
  "config": {
    "format": "KNOCKOUT",
    "drivers_per_match": 2,
    "seeding_mode": "MANUAL",
    "rules_text": "The le giai...",
    "prizes": [
      { "rank": 1, "title": "Champion", "description": "Voucher 500k" }
    ]
  }
}
```

**POST /contests/:id/matches/generate body:**
```json
{
  "format": "KNOCKOUT",
  "drivers_per_match": 2,
  "registration_ids": ["registration-1", "registration-2", "registration-3", "registration-4"],
  "seeding_mode": "MANUAL"
}
```

**PATCH /contest-matches/:id/participants body:**
```json
{
  "participants": [
    { "registration_id": "registration-1", "slot_no": 1, "lane": "A", "grid_position": 1 },
    { "registration_id": "registration-2", "slot_no": 2, "lane": "B", "grid_position": 2 }
  ]
}
```

**POST /contest-matches/:id/results body:**
```json
{
  "results": [
    {
      "registration_id": "registration-1",
      "finish_position": 1,
      "score": 10,
      "best_lap_ms": 18234,
      "total_time_ms": 120000,
      "is_winner": true,
      "result_note": "Won final"
    }
  ],
  "reason": "Manual staff entry"
}
```

**Leaderboard response:**
```json
{
  "data": {
    "standings": [
      {
        "rank": 1,
        "registration_id": "uuid",
        "user_id": "uuid",
        "fullName": "Nguyen Van A",
        "email": "driver@example.com",
        "score": 10,
        "best_lap_ms": 18234,
        "source_match_id": "uuid"
      }
    ]
  }
}
```

Rules:

- Chỉ `PROVIDER` owner tạo/sửa/open/close/cancel contest.
- `STAFF` không gọi full provider registration list; staff lookup/check-in bằng code và chỉ tại cafe được assign.
- `participating_cafe_ids` chỉ nhận cafe ACTIVE thuộc Provider hiện tại.
- Không tạo booking giả cho contest entry fee; `CONTEST_ENTRY` payment subject là phase payment sau.
- Schedule generation chỉ sau `CLOSED` hoặc `RUNNING`, và chỉ dùng registration `CONFIRMED`/`CHECKED_IN`.
- Một match không cố định A/B; dùng `contest_match_participants` để hỗ trợ 1, 2, 4 hoặc nhiều driver.
- Leaderboard phase này lưu trong `contests.config.leaderboard`; reward/prize là config hiển thị, không phát voucher tự động.
- Mọi mutation phải ghi `contest_audit_logs`.

---

## Phase 2 APIs

Các nhóm API sau không thuộc Phase 1: multi-party dispute workflow nâng cao, SaaS tenant admin, AI jobs, analytics nâng cao, loyalty/dynamic pricing.

## Response Format

```typescript
// Success
{
  "data": T,
  "meta": {           // optional, cho list endpoints
    "total": number,
    "page": number,
    "limit": number
  }
}

// Error
{
  "error": {
    "code": "BOOKING_NOT_FOUND",
    "message": "Booking không tồn tại",
    "statusCode": 404
  }
}
```

## Common Error Codes

```
UNAUTHORIZED              401 — chưa đăng nhập
FORBIDDEN                 403 — không có quyền
BOOKING_NOT_FOUND         404
VEHICLE_NOT_AVAILABLE     409 — xe đã có người đặt
SLOT_CONFLICT             409 — trùng slot
INVALID_BOOKING_STATE     422 — transition không hợp lệ
EXTENSION_FEE_EXCEEDED    422 — vượt 50% deposit cap
INSPECTION_INCOMPLETE     422 — thiếu ảnh hoặc checklist
PAYMENT_REQUIRED          402 — chưa thanh toán
```
