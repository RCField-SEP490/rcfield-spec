# 06 — Database Specification

**Last updated**: 2026-05-25

> Đọc `01-domain-model.md` để hiểu entity relationships trước khi đọc file này.  
> File này là nguồn sự thật cho schema Phase 1 Operational Core.

---

## 1. Conventions

| Convention | Quy tắc |
|-----------|---------|
| Tên bảng | `snake_case`, số nhiều (`users`, `bookings`) |
| Primary key | `id uuid DEFAULT gen_random_uuid()` |
| Foreign key | `{entity}_id uuid` |
| Timestamps | Bảng nghiệp vụ có `created_at`, `updated_at`; audit/log có thể chỉ có `created_at` |
| Tiền tệ | `numeric(15,2)`, không dùng `float` |
| JSON | `jsonb` cho snapshot/config/payload linh hoạt |
| Timezone | `timestamptz`, lưu UTC |
| Soft delete | `deleted_at timestamptz`, NULL = active |

---

## 2. ERD Tổng Quan — Operational Core

```mermaid
erDiagram
    users ||--o{ cafes : "provider owns"
    users ||--o{ bookings : "customer makes"
    users ||--o{ customer_vehicles : "owns BYOC"
    cafes ||--o{ cafe_images : "images"
    cafes ||--o{ vehicles : "fleet"
    cafes ||--o{ menu_items : "menu"
    cafes ||--o{ packages : "offers"
    cafes ||--o{ subscriptions : "supports"
    cafes ||--o{ contests : "organizes"
    cafes ||--o{ bookings : "receives"
    cafes ||--o{ sessions : "runs"

    vehicles ||--o{ vehicle_images : "images"
    vehicles ||--o{ vehicle_maintenance_logs : "maintenance"
    vehicles ||--o{ booking_vehicles : "planned"
    vehicles ||--o{ session_vehicles : "actual use"
    customer_vehicles ||--o{ session_vehicles : "BYOC use"

    bookings ||--o{ booking_participants : "planned people"
    bookings ||--o{ booking_vehicles : "planned rental vehicles"
    bookings ||--o{ sessions : "actual sessions"
    bookings ||--o{ payment_components : "payment ledger"
    bookings ||--o{ payment_transactions : "gateway logs"
    bookings ||--o{ fnb_orders : "food orders"
    bookings ||--o{ package_usages : "package usage"
    bookings ||--o{ reviews : "review"

    sessions ||--o{ session_participants : "actual people"
    sessions ||--o{ session_vehicles : "actual vehicles"
    sessions ||--o{ inspections : "inspections"
    sessions ||--o{ extension_proposals : "extensions"
    sessions ||--o{ incidents : "incidents"

    inspections ||--o{ inspection_photos : "photos"
    inspections ||--o{ inspection_checklists : "checklists"
    fnb_orders ||--o{ fnb_order_items : "items"
    menu_items ||--o{ fnb_order_items : "menu item"
    packages ||--o{ customer_packages : "purchased"
    customer_packages ||--o{ package_usages : "usage history"
    subscriptions ||--o{ bookings : "generates"
    contests ||--o{ contest_registrations : "registrations"

    cafes ||--o{ promotions : "promotions"
    promotions ||--o{ promotion_usages : "usage history"
    bookings ||--o| promotion_usages : "applies promo"

    users ||--o{ refresh_tokens : "sessions"
    users ||--o{ password_reset_tokens : "resets"
    users ||--o{ notification_logs : "notifications"
    users ||--o{ trust_score_logs : "trust audit"
    bookings ||--o{ trust_score_logs : "triggered by"
    sessions ||--o{ trust_score_logs : "triggered by"

    users ||--o| provider_profiles : "has profile"
    users ||--o{ provider_subscriptions : "subscription"
    users ||--o{ payment_requests : "payment requests"
    users ||--o{ notifications : "notifications"
    provider_subscriptions ||--o{ subscription_plans : "plan"
    payment_requests ||--o{ subscription_plans : "plan"
```

---

## 3. Phase 1 Schema Scope — 46 Tables

Phase 1 chỉ tạo schema/migration cho **46 bảng vận hành cốt lõi** dưới đây.

> Không cộng thêm bảng Phase 2 vào scope này. Chỉ các bảng multi-party dispute workflow nâng cao
> (`dispute_evidences`, `dispute_parties`), SaaS, AI và analytics nâng cao **không được tạo trong Phase 1**.

| # | Bảng | Mô tả |
|---|------|-------|
| 1 | `users` | Tài khoản và role |
| 2 | `refresh_tokens` | Refresh token sessions |
| 3 | `password_reset_tokens` | Reset password tokens |
| 4 | `cafes` | Chi nhánh/sân RC |
| 5 | `cafe_images` | Gallery ảnh chi nhánh |
| 6 | `vehicles` | Xe thuê của quán |
| 7 | `vehicle_images` | Ảnh xe thuê |
| 8 | `vehicle_maintenance_logs` | Lịch sử bảo trì/sửa chữa xe |
| 9 | `customer_vehicles` | Xe BYOC của khách |
| 10 | `bookings` | Đơn đặt lịch dự kiến |
| 11 | `booking_participants` | Người chơi dự kiến |
| 12 | `booking_vehicles` | Xe thuê dự kiến |
| 13 | `sessions` | Phiên chơi thực tế |
| 14 | `session_participants` | Người chơi thực tế |
| 15 | `session_vehicles` | Xe thực tế dùng trong session |
| 16 | `payment_components` | Ledger thanh toán |
| 17 | `payment_transactions` | Log gateway |
| 18 | `inspections` | Biên bản kiểm tra |
| 19 | `inspection_photos` | Ảnh inspection |
| 20 | `inspection_checklists` | Checklist inspection |
| 21 | `extension_proposals` | Đề xuất gia hạn |
| 22 | `incidents` | Sự cố + log xử lý theo policy |
| 23 | `menu_items` | Menu F&B |
| 24 | `fnb_orders` | Đơn F&B |
| 25 | `fnb_order_items` | Line items F&B |
| 26 | `packages` | Định nghĩa gói chơi |
| 27 | `customer_packages` | Gói khách đã mua |
| 28 | `package_usages` | Audit sử dụng gói |
| 29 | `subscriptions` | Lịch chơi định kỳ |
| 30 | `contests` | Giải đua/sự kiện |
| 31 | `contest_registrations` | Đăng ký giải đua |
| 32 | `promotions` | Mã khuyến mãi |
| 33 | `promotion_usages` | Audit dùng mã |
| 34 | `reviews` | Đánh giá |
| 35 | `notification_logs` | Log thông báo |
| 36 | `trust_score_logs` | Audit trust score |
| 37 | `feature_flags` | Bật/tắt module, config Phase 2 |
| 38 | `staff_cafe_assignments` | Staff assign vào chi nhánh |
| 39 | `disputes` | Tranh chấp booking |
| 40 | `cafe_closures` | Ngày đóng cửa đặc biệt |
| 41 | `cafe_announcements` | Thông báo/banner chi nhánh |
| 42 | `provider_profiles` | Hồ sơ đăng ký Provider, trạng thái duyệt |
| 43 | `subscription_plans` | Định nghĩa các gói: Trial, Starter, Growth, Pro |
| 44 | `provider_subscriptions` | Subscription đang active của từng Provider, quota AI |
| 45 | `payment_requests` | Yêu cầu thanh toán thủ công (chuyển khoản) |
| 46 | `notifications` | In-app notifications cho Provider |

Các nghiệp vụ bị loại khỏi schema Phase 1:

- SaaS tenant/billing.
- AI job/detail tables.
- Analytics nâng cao, dynamic pricing, loyalty và native mobile app.

---

## 4. Enum Chuẩn

```typescript
enum UserRole { CUSTOMER, PROVIDER, STAFF, ADMIN }
enum AuthProvider { LOCAL, GOOGLE }

enum CafeStatus { PENDING, ACTIVE, SUSPENDED }
enum TrackType { DRIFT, CIRCUIT, OFFROAD }

enum VehicleTier { STANDARD, PREMIUM, RESTRICTED }
enum VehicleStatus { AVAILABLE, IN_USE, MAINTENANCE, RETIRED }
enum VehicleSource { RENTAL, BYOC }
enum SessionVehicleStatus { ASSIGNED, IN_USE, RETURNED, DAMAGED }

enum BookingMode { SINGLE, PACKAGE, SUBSCRIPTION }
enum PlayMode { RENTAL, BYOC, MIXED }
enum BookingSource { APP, STAFF_MANUAL, SYSTEM_SUBSCRIPTION }
enum BookingStatus { PENDING, CONFIRMED, CANCELLED, NO_SHOW, COMPLETED }
enum SessionStatus { CHECKED_IN, ACTIVE, EXTENDING, CHECKING_OUT, COMPLETED, CANCELLED }

enum ParticipantType { BOOKER, REGISTERED_USER, WALK_IN_GUEST }
enum ParticipantRole { DRIVER, PLAYER, SPECTATOR, GUARDIAN }

enum PaymentComponentType {
  SLOT_FEE, RENTAL_FEE, SECURITY_DEPOSIT, EXTENSION_FEE,
  DAMAGE_CHARGE, FNB_PREORDER, FNB_ON_SITE, PACKAGE_PURCHASE, CONTEST_ENTRY
}
enum PaymentComponentStatus { PENDING, HELD, DISBURSED, REFUNDED, PARTIALLY_REFUNDED, CAPTURED }
enum PaymentTransactionType { PAYMENT, REFUND, CAPTURE, VOID }

enum InspectionType { CHECK_IN, CHECK_OUT, STAFF_HANDOVER }
enum InspectionSubjectType { RENTAL_VEHICLE, BYOC_VEHICLE }
enum InspectionItemStatus { OK, SCRATCHED, BROKEN, MISSING, DIRTY, NEEDS_REVIEW }
enum PhotoAngle { FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM, DETAIL, OTHER }

enum ExtensionProposalStatus { PENDING, APPROVED, REJECTED, EXPIRED, CANCELLED }
enum IncidentType { RENTAL_DAMAGE, BYOC_DAMAGE, COLLISION, LOST_ACCESSORY, STAFF_HANDLING, FACILITY, OTHER }
enum IncidentStatus { RECORDED, REVIEWED, RESOLVED, WAIVED }
enum ResponsibleParty { CUSTOMER, PROVIDER, STAFF, SHARED, UNKNOWN }
enum FnbOrderType { PRE_ORDER, ON_SITE }
enum FnbOrderStatus { PENDING, CONFIRMED, PREPARING, DELIVERED, CANCELLED }
enum PackageStatus { ACTIVE, INACTIVE, ARCHIVED }
enum CustomerPackageStatus { ACTIVE, EXPIRED, DEPLETED, CANCELLED }
enum SubscriptionStatus { ACTIVE, PAUSED, CANCELLED, EXPIRED }
enum ContestStatus { DRAFT, OPEN, CLOSED, RUNNING, COMPLETED, CANCELLED }
enum ContestRegistrationStatus { PENDING, CONFIRMED, CANCELLED, CHECKED_IN }
enum DiscountType { PERCENT, FIXED }
enum PromoApplicableTo { ALL, RENTAL, BYOC, MIXED }
enum NotificationChannel { PUSH, SMS, EMAIL }
enum NotificationStatus { PENDING, SENT, FAILED }
enum TrustScoreReason { NO_SHOW, DAMAGE_CONFIRMED, BOOKING_STREAK, ADMIN_ADJUSTMENT }

enum ProviderStatus { PENDING, ACTIVE, REJECTED, SUSPENDED }
enum ProviderSubscriptionStatus { TRIAL, ACTIVE, GRACE_PERIOD, EXPIRED }
enum PlanName { TRIAL, STARTER, GROWTH, PRO }
enum PaymentRequestStatus { PENDING, CONFIRMED, REJECTED }
enum NotificationType {
  ACCOUNT_APPROVED, ACCOUNT_REJECTED, ACCOUNT_SUSPENDED, ACCOUNT_UNSUSPENDED,
  TRIAL_EXPIRING_SOON, GRACE_PERIOD_STARTED, SUBSCRIPTION_EXPIRED,
  SUBSCRIPTION_ACTIVATED, PAYMENT_REQUEST_CONFIRMED, PAYMENT_REQUEST_REJECTED
}
```

---

## 5. Bảng Chi Tiết

### 5.1 Identity

#### `users`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `email` | `varchar(255)` | NOT NULL, UNIQUE | |
| `phone` | `varchar(20)` | NULL | |
| `full_name` | `varchar(255)` | NOT NULL | |
| `password_hash` | `text` | NULL | NULL nếu OAuth |
| `auth_provider` | `AuthProvider` | NOT NULL, DEFAULT `LOCAL` | |
| `role` | `UserRole` | NOT NULL | |
| `trust_score` | `numeric(5,2)` | NOT NULL, DEFAULT `100.00` | CUSTOMER |
| `is_active` | `boolean` | NOT NULL, DEFAULT `true` | |
| `created_at`, `updated_at`, `deleted_at` | `timestamptz` | | |

```sql
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role);
```

#### `refresh_tokens`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `token` | `text` | NOT NULL, UNIQUE |
| `expires_at` | `timestamptz` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL |

#### `password_reset_tokens`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `token` | `text` | NOT NULL, UNIQUE |
| `expires_at` | `timestamptz` | NOT NULL |
| `used_at` | `timestamptz` | NULL |
| `created_at` | `timestamptz` | NOT NULL |

---

### 5.2 Cafe

#### `cafes`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `provider_id` | `uuid` | NOT NULL, FK -> users(id) | PROVIDER |
| `name` | `varchar(255)` | NOT NULL | |
| `slug` | `varchar(100)` | NOT NULL, UNIQUE | |
| `description` | `text` | NULL | |
| `phone` | `varchar(20)` | NULL | |
| `status` | `CafeStatus` | NOT NULL, DEFAULT `PENDING` | |
| `cover_image_url` | `text` | NULL | |
| `address` | `text` | NOT NULL | |
| `district` | `varchar(100)` | NOT NULL | |
| `city` | `varchar(100)` | NOT NULL | |
| `latitude`, `longitude` | `numeric(10,7)` | NULL | |
| `operating_hours` | `jsonb` | NOT NULL | |
| `track_types` | `text[]` | NOT NULL, DEFAULT `{}` | |
| `slot_duration_minutes` | `integer` | NOT NULL, DEFAULT `60` | |
| `slot_fee_rate` | `numeric(15,2)` | NOT NULL | Booking dùng snapshot |
| `max_concurrent_bookings` | `integer` | NOT NULL, DEFAULT `10` | |
| `byoc_capacity` | `integer` | NOT NULL, DEFAULT `5` | |
| `created_at`, `updated_at` | `timestamptz` | | |

#### `cafe_images`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `cafe_id` | `uuid` | NOT NULL, FK -> cafes(id) ON DELETE CASCADE |
| `url` | `text` | NOT NULL |
| `sort_order` | `integer` | NOT NULL, DEFAULT `0` |
| `created_at` | `timestamptz` | NOT NULL |

---

### 5.3 Fleet & BYOC

#### `vehicles`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `cafe_id` | `uuid` | NOT NULL, FK -> cafes(id) | |
| `name` | `varchar(255)` | NOT NULL | |
| `description` | `text` | NULL | |
| `tier` | `VehicleTier` | NOT NULL | |
| `status` | `VehicleStatus` | NOT NULL, DEFAULT `AVAILABLE` | |
| `hourly_rate` | `numeric(15,2)` | NOT NULL | |
| `security_deposit` | `numeric(15,2)` | NOT NULL | |
| `damage_multiplier` | `numeric(4,2)` | NOT NULL, DEFAULT `1.00` | |
| `compatible_track_types` | `text[]` | NOT NULL, DEFAULT `{}` | |
| `cover_image_url` | `text` | NULL | |
| `last_maintenance_at` | `timestamptz` | NULL | |
| `created_at`, `updated_at`, `deleted_at` | `timestamptz` | | |

#### `vehicle_images`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `vehicle_id` | `uuid` | NOT NULL, FK -> vehicles(id) ON DELETE CASCADE |
| `url` | `text` | NOT NULL |
| `sort_order` | `integer` | NOT NULL, DEFAULT `0` |
| `created_at` | `timestamptz` | NOT NULL |

#### `customer_vehicles`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `customer_id` | `uuid` | NOT NULL, FK -> users(id) | |
| `brand` | `varchar(100)` | NULL | |
| `model` | `varchar(100)` | NULL | |
| `serial_number` | `varchar(100)` | NULL | |
| `description` | `text` | NULL | |
| `notes` | `text` | NULL | |
| `created_at`, `updated_at`, `deleted_at` | `timestamptz` | | |

#### `vehicle_maintenance_logs`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `vehicle_id` | `uuid` | NOT NULL, FK -> vehicles(id) | |
| `type` | `varchar(50)` | NOT NULL | `SCHEDULED`, `REPAIR`, `INSPECTION` |
| `description` | `text` | NOT NULL | |
| `cost` | `numeric(15,2)` | NULL | |
| `performed_by` | `uuid` | NULL, FK -> users(id) | Staff hoặc NULL nếu gửi ngoài |
| `performed_at` | `timestamptz` | NOT NULL | |
| `next_scheduled_at` | `timestamptz` | NULL | |
| `related_session_id` | `uuid` | NULL, FK -> sessions(id) | Nếu phát sinh từ session |
| `created_at` | `timestamptz` | NOT NULL | |

---

### 5.4 Booking Layer

#### `bookings`

> Không lưu `vehicle_id` trực tiếp trong `bookings`.

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `customer_id` | `uuid` | NOT NULL, FK -> users(id) | |
| `cafe_id` | `uuid` | NOT NULL, FK -> cafes(id) | |
| `subscription_id` | `uuid` | NULL, FK -> subscriptions(id) | Nếu sinh từ lịch định kỳ |
| `booking_mode` | `BookingMode` | NOT NULL, DEFAULT `SINGLE` | |
| `play_mode` | `PlayMode` | NOT NULL | RENTAL/BYOC/MIXED |
| `source` | `BookingSource` | NOT NULL, DEFAULT `APP` | |
| `track_type` | `varchar(50)` | NOT NULL | |
| `status` | `BookingStatus` | NOT NULL, DEFAULT `PENDING` | |
| `slot_start`, `slot_end` | `timestamptz` | NOT NULL | Dự kiến |
| `slot_count` | `integer` | NOT NULL, DEFAULT `1` | |
| `payment_expires_at` | `timestamptz` | NOT NULL | |
| `snapshot` | `jsonb` | NOT NULL | Giá/policy bất biến |
| `promotion_id` | `uuid` | NULL, FK -> promotions(id) | |
| `discount_amount` | `numeric(15,2)` | NULL | |
| `notes` | `text` | NULL | |
| `cancelled_by` | `uuid` | NULL, FK -> users(id) | |
| `cancelled_at` | `timestamptz` | NULL | |
| `cancellation_reason` | `text` | NULL | |
| `created_at`, `updated_at` | `timestamptz` | | |

```sql
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_cafe_slot ON bookings(cafe_id, track_type, slot_start, slot_end);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_payment_expires ON bookings(payment_expires_at)
  WHERE status = 'PENDING';
```

#### `booking_participants`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | NOT NULL, FK -> bookings(id) ON DELETE CASCADE |
| `user_id` | `uuid` | NULL, FK -> users(id) |
| `participant_type` | `ParticipantType` | NOT NULL |
| `display_name` | `varchar(255)` | NULL |
| `phone` | `varchar(20)` | NULL |
| `is_primary_responsible` | `boolean` | NOT NULL, DEFAULT `false` |
| `created_at`, `updated_at` | `timestamptz` | |

#### `booking_vehicles`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `booking_id` | `uuid` | NOT NULL, FK -> bookings(id) ON DELETE CASCADE | |
| `vehicle_id` | `uuid` | NOT NULL, FK -> vehicles(id) | |
| `assigned_to_participant_id` | `uuid` | NULL, FK -> booking_participants(id) | |
| `hourly_rate_snapshot` | `numeric(15,2)` | NOT NULL | |
| `security_deposit_snapshot` | `numeric(15,2)` | NOT NULL | |
| `damage_multiplier_snapshot` | `numeric(4,2)` | NOT NULL | |
| `created_at` | `timestamptz` | NOT NULL | |

```sql
CREATE UNIQUE INDEX idx_booking_vehicles_unique ON booking_vehicles(booking_id, vehicle_id);
```

---

### 5.5 Session Layer

#### `sessions`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `booking_id` | `uuid` | NOT NULL, FK -> bookings(id) | |
| `cafe_id` | `uuid` | NOT NULL, FK -> cafes(id) | |
| `status` | `SessionStatus` | NOT NULL, DEFAULT `CHECKED_IN` | |
| `checked_in_by` | `uuid` | NOT NULL, FK -> users(id) | Staff |
| `checked_out_by` | `uuid` | NULL, FK -> users(id) | Staff |
| `actual_start_at` | `timestamptz` | NOT NULL | |
| `actual_end_at` | `timestamptz` | NULL | |
| `planned_end_at` | `timestamptz` | NOT NULL | |
| `actual_total_amount` | `numeric(15,2)` | NOT NULL, DEFAULT `0` | |
| `notes` | `text` | NULL | |
| `created_at`, `updated_at` | `timestamptz` | | |

#### `session_participants`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `session_id` | `uuid` | NOT NULL, FK -> sessions(id) ON DELETE CASCADE |
| `booking_participant_id` | `uuid` | NULL, FK -> booking_participants(id) |
| `user_id` | `uuid` | NULL, FK -> users(id) |
| `display_name` | `varchar(255)` | NULL |
| `phone` | `varchar(20)` | NULL |
| `role` | `ParticipantRole` | NOT NULL |
| `is_primary_responsible` | `boolean` | NOT NULL, DEFAULT `false` |
| `checked_in_at` | `timestamptz` | NOT NULL |
| `created_at`, `updated_at` | `timestamptz` | |

#### `session_vehicles`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `session_id` | `uuid` | NOT NULL, FK -> sessions(id) ON DELETE CASCADE | |
| `booking_vehicle_id` | `uuid` | NULL, FK -> booking_vehicles(id) | |
| `vehicle_source` | `VehicleSource` | NOT NULL | RENTAL/BYOC |
| `vehicle_id` | `uuid` | NULL, FK -> vehicles(id) | Required khi RENTAL |
| `customer_vehicle_id` | `uuid` | NULL, FK -> customer_vehicles(id) | Required khi BYOC |
| `assigned_to_participant_id` | `uuid` | NULL, FK -> session_participants(id) | |
| `status` | `SessionVehicleStatus` | NOT NULL, DEFAULT `ASSIGNED` | |
| `started_at`, `returned_at` | `timestamptz` | NULL | |
| `notes` | `text` | NULL | |
| `created_at`, `updated_at` | `timestamptz` | | |

---

### 5.6 Payment

#### `payment_components`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `booking_id` | `uuid` | NOT NULL, FK -> bookings(id) | |
| `session_id` | `uuid` | NULL, FK -> sessions(id) | |
| `type` | `PaymentComponentType` | NOT NULL | |
| `amount` | `numeric(15,2)` | NOT NULL | Immutable |
| `status` | `PaymentComponentStatus` | NOT NULL, DEFAULT `PENDING` | |
| `disbursed_to` | `uuid` | NULL, FK -> users(id) | |
| `disbursed_at`, `refunded_at` | `timestamptz` | NULL | |
| `refunded_amount` | `numeric(15,2)` | NULL | |
| `note` | `text` | NULL | |
| `created_at`, `updated_at` | `timestamptz` | | |

#### `payment_transactions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | NOT NULL, FK -> bookings(id) |
| `session_id` | `uuid` | NULL, FK -> sessions(id) |
| `gateway` | `varchar(50)` | NOT NULL |
| `gateway_transaction_id` | `varchar(255)` | NULL |
| `type` | `PaymentTransactionType` | NOT NULL |
| `amount` | `numeric(15,2)` | NOT NULL |
| `status` | `varchar(50)` | NOT NULL |
| `raw_request`, `raw_response` | `jsonb` | NULL |
| `created_at` | `timestamptz` | NOT NULL |

---

### 5.7 Inspection

#### `inspections`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `session_id` | `uuid` | NOT NULL, FK -> sessions(id) | |
| `session_vehicle_id` | `uuid` | NULL, FK -> session_vehicles(id) | |
| `type` | `InspectionType` | NOT NULL | |
| `subject_type` | `InspectionSubjectType` | NOT NULL | |
| `performed_by` | `uuid` | NOT NULL, FK -> users(id) | Staff |
| `pre_existing_flag` | `boolean` | NOT NULL, DEFAULT `false` | |
| `damage_noted` | `boolean` | NOT NULL, DEFAULT `false` | |
| `damage_description` | `text` | NULL | |
| `damage_cost_estimate` | `numeric(15,2)` | NULL | |
| `ai_analysis_json` | `jsonb` | NULL | Phase 2 hook |
| `customer_confirmed` | `boolean` | NOT NULL, DEFAULT `false` | |
| `customer_confirmed_at` | `timestamptz` | NULL | |
| `created_at`, `updated_at` | `timestamptz` | | |

#### `inspection_photos`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `inspection_id` | `uuid` | NOT NULL, FK -> inspections(id) ON DELETE CASCADE |
| `angle` | `PhotoAngle` | NOT NULL |
| `url` | `text` | NOT NULL |
| `uploaded_by` | `uuid` | NOT NULL, FK -> users(id) |
| `metadata` | `jsonb` | NULL |
| `created_at` | `timestamptz` | NOT NULL |

#### `inspection_checklists`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `inspection_id` | `uuid` | NOT NULL, FK -> inspections(id) ON DELETE CASCADE |
| `item_key` | `varchar(100)` | NOT NULL |
| `item_label` | `varchar(255)` | NOT NULL |
| `status` | `InspectionItemStatus` | NOT NULL |
| `note` | `text` | NULL |
| `created_at`, `updated_at` | `timestamptz` | |

---

### 5.8 Extension, Promotion, Audit

#### `extension_proposals`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `session_id` | `uuid` | NOT NULL, FK -> sessions(id) |
| `proposed_by` | `uuid` | NOT NULL, FK -> users(id) |
| `duration_minutes` | `integer` | NOT NULL |
| `fee_amount` | `numeric(15,2)` | NOT NULL |
| `status` | `ExtensionProposalStatus` | NOT NULL, DEFAULT `PENDING` |
| `responded_by` | `uuid` | NULL, FK -> users(id) |
| `responded_at` | `timestamptz` | NULL |
| `created_at`, `updated_at` | `timestamptz` | |

#### `promotions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `cafe_id` | `uuid` | NULL, FK -> cafes(id) |
| `code` | `varchar(50)` | NOT NULL, UNIQUE |
| `discount_type` | `DiscountType` | NOT NULL |
| `discount_value` | `numeric(15,2)` | NOT NULL |
| `max_discount_amount` | `numeric(15,2)` | NULL |
| `min_order_amount` | `numeric(15,2)` | NULL |
| `max_uses` | `integer` | NULL |
| `max_uses_per_user` | `integer` | NOT NULL, DEFAULT `1` |
| `uses_count` | `integer` | NOT NULL, DEFAULT `0` |
| `applicable_to` | `PromoApplicableTo` | NOT NULL, DEFAULT `ALL` |
| `starts_at` | `timestamptz` | NOT NULL |
| `expires_at` | `timestamptz` | NULL |
| `is_active` | `boolean` | NOT NULL, DEFAULT `true` |
| `created_by` | `uuid` | NOT NULL, FK -> users(id) |
| `created_at`, `updated_at` | `timestamptz` | |

#### `promotion_usages`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `promotion_id` | `uuid` | NOT NULL, FK -> promotions(id) |
| `booking_id` | `uuid` | NOT NULL, UNIQUE, FK -> bookings(id) |
| `user_id` | `uuid` | NOT NULL, FK -> users(id) |
| `discount_amount` | `numeric(15,2)` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL |

#### `reviews`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | NOT NULL, UNIQUE, FK -> bookings(id) |
| `cafe_id` | `uuid` | NOT NULL, FK -> cafes(id) |
| `customer_id` | `uuid` | NOT NULL, FK -> users(id) |
| `rating` | `integer` | NOT NULL |
| `comment` | `text` | NULL |
| `is_visible` | `boolean` | NOT NULL, DEFAULT `true` |
| `created_at` | `timestamptz` | NOT NULL |

#### `notification_logs`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK -> users(id) |
| `booking_id` | `uuid` | NULL, FK -> bookings(id) |
| `session_id` | `uuid` | NULL, FK -> sessions(id) |
| `type` | `varchar(100)` | NOT NULL |
| `channel` | `NotificationChannel` | NOT NULL |
| `title` | `varchar(255)` | NOT NULL |
| `body` | `text` | NOT NULL |
| `status` | `NotificationStatus` | NOT NULL, DEFAULT `PENDING` |
| `error` | `text` | NULL |
| `sent_at` | `timestamptz` | NULL |
| `created_at` | `timestamptz` | NOT NULL |

#### `trust_score_logs`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | NOT NULL, FK -> users(id) |
| `booking_id` | `uuid` | NULL, FK -> bookings(id) |
| `session_id` | `uuid` | NULL, FK -> sessions(id) |
| `delta` | `numeric(5,2)` | NOT NULL |
| `score_before` | `numeric(5,2)` | NOT NULL |
| `score_after` | `numeric(5,2)` | NOT NULL |
| `reason` | `TrustScoreReason` | NOT NULL |
| `note` | `text` | NULL |
| `created_by` | `uuid` | NULL, FK -> users(id) |
| `created_at` | `timestamptz` | NOT NULL |

#### `feature_flags`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `key` | `varchar(100)` | NOT NULL, UNIQUE | |
| `description` | `text` | NULL | |
| `is_enabled` | `boolean` | NOT NULL, DEFAULT `false` | |
| `config` | `jsonb` | NOT NULL, DEFAULT `{}` | Phase 2/SaaS-ready |
| `created_at`, `updated_at` | `timestamptz` | | |

---

### 5.9 F&B

| Bảng | Cột chính | Ghi chú |
|------|----------|---------|
| `menu_items` | `cafe_id`, `name`, `description`, `price`, `category`, `image_url`, `is_available`, `deleted_at` | Menu theo chi nhánh |
| `fnb_orders` | `booking_id`, `session_id`, `order_type`, `status`, `total_amount`, `created_by`, `confirmed_by`, `confirmed_at`, `notes` | `PRE_ORDER` hoặc `ON_SITE` |
| `fnb_order_items` | `order_id`, `menu_item_id`, `quantity`, `unit_price`, `item_name_snapshot`, `created_at` | Snapshot giá/tên món |

Rules:

- `PRE_ORDER` gắn với booking và có thể `session_id = NULL`.
- `ON_SITE` nên gắn với session.
- Một booking chỉ có tối đa một pre-order chưa cancel.

### 5.10 Packages, Subscriptions & Contests

| Bảng | Cột chính | Ghi chú |
|------|----------|---------|
| `packages` | `cafe_id`, `name`, `description`, `slot_count`, `price`, `valid_days`, `applicable_play_modes`, `status`, `deleted_at` | Định nghĩa gói chơi |
| `customer_packages` | `package_id`, `customer_id`, `remaining_slots`, `purchased_at`, `expires_at`, `status` | Gói khách đã mua |
| `package_usages` | `customer_package_id`, `booking_id`, `used_slots`, `created_at` | Audit trừ slot |
| `subscriptions` | `cafe_id`, `customer_id`, `play_mode`, `track_type`, `frequency_rule`, `slot_count`, `starts_at`, `ends_at`, `status` | Lịch định kỳ sinh booking |
| `contests` | `cafe_id`, `name`, `description`, `track_type`, `vehicle_rule`, `starts_at`, `ends_at`, `capacity`, `entry_fee`, `status`, `created_by` | Giải đua/sự kiện |
| `contest_registrations` | `contest_id`, `user_id`, `vehicle_source`, `vehicle_id`, `customer_vehicle_id`, `status` | Một user đăng ký một lần cho một contest |

Rules:

- `Booking.booking_mode = PACKAGE` phải có `package_usages`.
- `Booking.booking_mode = SUBSCRIPTION` phải có `subscription_id`.
- Contest registration hỗ trợ cả `RENTAL` và `BYOC`.

### 5.11 Incidents & Policy Resolution

| Bảng | Cột chính | Ghi chú |
|------|----------|---------|
| `incidents` | `session_id`, `reported_by`, `type`, `status`, `occurred_at`, `description`, `estimated_amount`, `responsible_party`, `final_amount`, `resolution_note`, `resolved_by`, `resolved_at` | Sự cố + log kết quả xử lý theo policy |

Rules:

- Incident là log sự cố và kết quả xử lý theo policy.
- Phase 1 không tách dispute thành nhiều bảng. Nếu khách phản đối, staff/admin cập nhật `incidents.status`, `resolution_note`, `responsible_party`, `final_amount`.
- Evidence dùng lại `inspections`, `inspection_photos`, `inspection_checklists`. Upload evidence riêng và dispute nhiều bên là Phase 2.

---

### 5.13 Provider Subscription

#### `provider_profiles`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | NOT NULL, UNIQUE, FK -> users(id) ON DELETE CASCADE | 1:1 với users |
| `business_name` | `varchar(255)` | NOT NULL | |
| `business_description` | `text` | NULL | |
| `registration_status` | `ProviderStatus` | NOT NULL, DEFAULT `PENDING` | |
| `rejection_reason` | `text` | NULL | |
| `suspended_at` | `timestamptz` | NULL | |
| `suspended_reason` | `text` | NULL | |
| `created_at`, `updated_at`, `deleted_at` | `timestamptz` | | |

#### `subscription_plans`

Seeded, read-only. `-1` = unlimited.

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `name` | `PlanName` | NOT NULL, UNIQUE | |
| `branch_limit` | `int` | NOT NULL | -1 = unlimited |
| `ai_quota_per_month` | `int` | NOT NULL | -1 = unlimited |
| `channel_limit` | `int` | NOT NULL | -1 = unlimited |
| `price_per_month` | `decimal(12,2)` | NOT NULL | 0.00 cho TRIAL |
| `is_trial` | `boolean` | NOT NULL, DEFAULT `false` | |
| `created_at`, `updated_at` | `timestamptz` | | |

**Seed data:**

| name | branch_limit | ai_quota_per_month | channel_limit | price_per_month |
|------|--------------|--------------------|---------------|-----------------|
| TRIAL | 1 | 500 | 1 | 0 |
| STARTER | 1 | 1000 | 1 | 299,000 |
| GROWTH | 3 | 5000 | 3 | 699,000 |
| PRO | -1 | -1 | -1 | 1,499,000 |

#### `provider_subscriptions`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `provider_id` | `uuid` | NOT NULL, FK -> users(id) ON DELETE CASCADE | |
| `plan_id` | `uuid` | NOT NULL, FK -> subscription_plans(id) | |
| `status` | `ProviderSubscriptionStatus` | NOT NULL | |
| `started_at` | `timestamptz` | NOT NULL | |
| `expires_at` | `timestamptz` | NOT NULL | |
| `grace_ends_at` | `timestamptz` | NULL | expires_at + 7 ngày |
| `ai_messages_used` | `int` | NOT NULL, DEFAULT `0` | Reset hàng tháng |
| `ai_quota_reset_at` | `timestamptz` | NOT NULL | Ngày đầu tháng sau |
| `created_at`, `updated_at`, `deleted_at` | `timestamptz` | | |

```sql
CREATE INDEX idx_provider_subscriptions_provider_status ON provider_subscriptions (provider_id, status);
CREATE INDEX idx_provider_subscriptions_expires_status ON provider_subscriptions (expires_at, status);
```

#### `payment_requests`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `provider_id` | `uuid` | NOT NULL, FK -> users(id) ON DELETE CASCADE | |
| `plan_id` | `uuid` | NOT NULL, FK -> subscription_plans(id) | |
| `status` | `PaymentRequestStatus` | NOT NULL, DEFAULT `PENDING` | |
| `transfer_reference` | `varchar(255)` | NOT NULL | Nội dung CK |
| `transfer_date` | `date` | NOT NULL | Ngày CK |
| `transfer_amount` | `decimal(12,2)` | NOT NULL | Số tiền VNĐ |
| `admin_notes` | `text` | NULL | Ghi chú Admin |
| `reviewed_by` | `uuid` | NULL, FK -> users(id) | Admin duyệt |
| `reviewed_at` | `timestamptz` | NULL | |
| `created_at`, `updated_at`, `deleted_at` | `timestamptz` | | |

#### `notifications`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | NOT NULL, FK -> users(id) ON DELETE CASCADE | |
| `type` | `NotificationType` | NOT NULL | |
| `title` | `varchar(255)` | NOT NULL | |
| `message` | `text` | NOT NULL | |
| `read_at` | `timestamptz` | NULL | NULL = chưa đọc |
| `created_at`, `updated_at` | `timestamptz` | | |

```sql
CREATE INDEX idx_notifications_user_read_at ON notifications (user_id, read_at);
```

---

## 6. Redis — Slot Locking

Redis chỉ giữ slot tạm trong checkout. DB là nguồn sự thật sau khi booking được tạo.

### RENTAL / MIXED

Mỗi xe thuê trong `booking_vehicles` cần một lock riêng:

```text
Key:   slot:rental:{cafeId}:{vehicleId}:{date}:{slotStart}
Value: {userId}:{checkoutSessionId}
TTL:   1800s
Cmd:   SET NX EX
```

Nếu thuê nhiều xe, phải acquire đủ lock. Nếu một lock fail, rollback các lock đã acquire.

### BYOC / MIXED

```text
Key:   slot:byoc:{cafeId}:{trackType}:{date}:{slotStart}
Value: counter
TTL:   1800s
Cmd:   INCR -> check <= byoc_capacity, nếu vượt thì DECR + từ chối
```

### DB conflict query

Kiểm tra xe thuê qua `booking_vehicles`, không qua cột xe trực tiếp trên `bookings`:

```sql
SELECT 1
FROM booking_vehicles bv
JOIN bookings b ON b.id = bv.booking_id
WHERE bv.vehicle_id = :vehicle_id
  AND b.status IN ('PENDING', 'CONFIRMED')
  AND tstzrange(b.slot_start, b.slot_end, '[)') && tstzrange(:slot_start, :slot_end, '[)');
```

---

## 7. Phase 2 Backlog — Not Part Of Phase 1 Schema

Các bảng dưới đây chỉ là backlog thiết kế cho Phase 2. Không tạo migration, entity hoặc API bắt buộc cho các bảng này trong Phase 1.

| Nhóm | Bảng |
|------|------|
| Staff/cafe ops | `staff_cafe_assignments`, `cafe_closures`, `cafe_announcements` |
| Advanced dispute | `incident_participants`, `disputes`, `dispute_evidences`, `dispute_parties` |
| SaaS | `tenants`, `tenant_members`, `saas_plans`, `tenant_subscriptions` |
| AI | `ai_analysis_jobs`, `ai_damage_detections`, `ai_recommendations` |
| Advanced analytics | analytics aggregate/cache tables nếu cần |
| Loyalty/dynamic pricing | loyalty points, price rules, campaign optimization |

---

### 5.12 Staff, Disputes & Cafe Operations

#### `staff_cafe_assignments`

> 1 Staff chỉ thuộc đúng 1 chi nhánh tại một thời điểm.

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `staff_id` | `uuid` | NOT NULL, UNIQUE, FK -> users(id) | UNIQUE enforce 1 staff → 1 cafe |
| `cafe_id` | `uuid` | NOT NULL, FK -> cafes(id) | |
| `assigned_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `assigned_by` | `uuid` | NOT NULL, FK -> users(id) | PROVIDER hoặc ADMIN |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_staff_cafe_staff_id ON staff_cafe_assignments(staff_id);
CREATE INDEX idx_staff_cafe_cafe_id ON staff_cafe_assignments(cafe_id);
```

---

#### `disputes`

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `booking_id` | `uuid` | NOT NULL, UNIQUE, FK -> bookings(id) | Mỗi booking max 1 dispute |
| `opened_by` | `uuid` | NOT NULL, FK -> users(id) | Customer hoặc Staff |
| `reason` | `text` | NOT NULL | |
| `evidence_photos` | `text[]` | NOT NULL, DEFAULT '{}' | Cloudinary URLs |
| `status` | `DisputeStatus` | NOT NULL, DEFAULT `OPEN` | |
| `resolution` | `text` | NULL | Admin ghi quyết định |
| `resolution_favor` | `varchar(20)` | NULL | `CUSTOMER` hoặc `PROVIDER` |
| `resolved_by` | `uuid` | NULL, FK -> users(id) | Admin |
| `resolved_at` | `timestamptz` | NULL | |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL | |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_disputes_booking_id ON disputes(booking_id);
CREATE INDEX idx_disputes_status ON disputes(status);
```

---

#### `cafe_closures`

> Ngày đóng cửa đặc biệt — block booking cho ngày đó.

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `cafe_id` | `uuid` | NOT NULL, FK -> cafes(id) | |
| `closed_date` | `date` | NOT NULL | Chỉ ngày, không có giờ |
| `reason` | `varchar(255)` | NULL | VD: "Nghỉ Tết", "Bảo trì sân" |
| `created_by` | `uuid` | NOT NULL, FK -> users(id) | PROVIDER hoặc ADMIN |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_cafe_closures_date ON cafe_closures(cafe_id, closed_date);
CREATE INDEX idx_cafe_closures_cafe_id ON cafe_closures(cafe_id);
```

---

#### `cafe_announcements`

> Thông báo/banner hiển thị trên web của chi nhánh.

| Column | Type | Constraints | Ghi chú |
|--------|------|-------------|---------|
| `id` | `uuid` | PK | |
| `cafe_id` | `uuid` | NOT NULL, FK -> cafes(id) | |
| `title` | `varchar(255)` | NOT NULL | |
| `content` | `text` | NULL | |
| `image_url` | `text` | NULL | Cloudinary URL |
| `starts_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `ends_at` | `timestamptz` | NULL | NULL = hiển thị mãi |
| `is_active` | `boolean` | NOT NULL, DEFAULT true | |
| `created_by` | `uuid` | NOT NULL, FK -> users(id) | PROVIDER hoặc STAFF |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL | |

**Indexes:**
```sql
CREATE INDEX idx_cafe_announcements_cafe_id ON cafe_announcements(cafe_id, is_active, starts_at DESC);
```

---

## Reference

- `docs/spec/00-overview.md` — Scope và roadmap
- `docs/spec/01-domain-model.md` — Entity definitions, enums
- `docs/spec/02-state-machine.md` — Booking/session status transitions
- `docs/spec/03-payment-engine.md` — Payment component rules
- `docs/spec/04-inspection-flow.md` — Inspection protocol

---

*Last updated: 2026-05-25 · 46 tables (41 operational core + 5 provider subscription)*
