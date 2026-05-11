# 05 — API Contracts

**Last updated**: 2026-05  
**Status**: Living document — cập nhật khi thêm/đổi endpoint

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
| GET | `/bookings/:id` | Auth | Chi tiết booking |
| POST | `/bookings` | CUSTOMER | Tạo booking mới |
| POST | `/bookings/:id/cancel` | CUSTOMER/PROVIDER | Huỷ booking |
| POST | `/bookings/:id/payment/confirm` | CUSTOMER | Xác nhận thanh toán VNPay |

**POST /bookings body:**
```json
{
  "cafe_id": "uuid",
  "vehicle_id": "uuid | null",
  "mode": "RENTAL | BYOC",
  "slot_start": "2026-05-15T09:00:00+07:00",
  "slot_end": "2026-05-15T11:00:00+07:00",
  "byoc_vehicle_info": {
    "name": "string",
    "weight_kg": 2.5
  }
}
```

---

## Inspections

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| POST | `/bookings/:id/inspections/checkin` | STAFF | Submit check-in record |
| POST | `/bookings/:id/inspections/checkout` | STAFF | Submit check-out record |
| GET | `/bookings/:id/inspections` | Auth | Lấy cả 2 inspection records |
| POST | `/bookings/:id/inspections/checkin/confirm` | CUSTOMER | Confirm check-in |
| POST | `/bookings/:id/inspections/checkout/confirm` | CUSTOMER | Confirm check-out |
| POST | `/bookings/:id/inspections/checkout/dispute-damage` | CUSTOMER | Mở dispute về damage |

**POST /checkin body (multipart/form-data):**
```
photo_front: File
photo_back: File
photo_left: File
photo_right: File
checklist: JSON string { scratches, cracks, missing_parts, notes }
pre_existing_flag: boolean
```

---

## Extensions

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| POST | `/bookings/:id/extensions` | STAFF | Gửi đề xuất gia hạn |
| POST | `/bookings/:id/extensions/:extId/approve` | CUSTOMER | Chấp nhận gia hạn |
| POST | `/bookings/:id/extensions/:extId/reject` | CUSTOMER | Từ chối gia hạn |

**POST /extensions body:**
```json
{
  "duration_minutes": 60,
  "extension_fee": 150000
}
```

---

## Disputes

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| POST | `/bookings/:id/disputes` | CUSTOMER/PROVIDER | Mở dispute |
| GET | `/disputes` | ADMIN | List disputes (filter: status) |
| GET | `/disputes/:id` | Auth | Chi tiết dispute + evidence |
| PATCH | `/disputes/:id/resolve` | ADMIN | Giải quyết dispute |

---

## Analytics (Provider)

| Method | Endpoint | Actor | Mô tả |
|--------|----------|-------|-------|
| GET | `/cafes/:id/analytics/revenue` | PROVIDER | Doanh thu theo ngày/tuần/tháng |
| GET | `/cafes/:id/analytics/fleet` | PROVIDER | Fleet utilization |
| GET | `/cafes/:id/analytics/vehicles/:vehicleId` | PROVIDER | Revenue theo xe |

---

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
