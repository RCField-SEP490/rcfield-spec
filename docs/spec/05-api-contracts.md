# 05 — API Contracts

**Last updated**: 2026-05-16
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
| GET | `/cafes/:cafeId/contests` | Public | List contests |
| POST | `/cafes/:cafeId/contests` | PROVIDER/STAFF | Tạo contest |
| POST | `/contests/:id/register` | CUSTOMER | Đăng ký contest |

---

## Phase 2 APIs

Các nhóm API sau không thuộc Phase 1: staff/cafe assignment nâng cao, cafe closures/announcements, dispute workflow nhiều bên, SaaS tenant admin, AI jobs, analytics nâng cao, loyalty/dynamic pricing.

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
