# 01 — Domain Model

**Last updated**: 2026-05  
**Status**: Active

---

## Core Entities

### User (base)
```
User
├── id: UUID
├── email: string (unique)
├── phone: string
├── full_name: string
├── role: UserRole  ← CUSTOMER | PROVIDER | STAFF | ADMIN
├── trust_score: number  ← chỉ dùng cho CUSTOMER (0–100, default 100)
├── created_at / updated_at / deleted_at
```

### Cafe
```
Cafe
├── id: UUID
├── provider_id: UUID → User
├── name: string
├── address: string
├── district: string
├── city: string
├── track_types: TrackType[]  ← DRIFT | OBSTACLE | HILL_CLIMB
├── operating_hours: JSON  ← { mon: {open, close}, ... }
├── status: CafeStatus  ← PENDING | ACTIVE | SUSPENDED
├── created_at / updated_at
```

### Vehicle
```
Vehicle
├── id: UUID
├── cafe_id: UUID → Cafe
├── name: string  ← "Traxxas Slash 4x4"
├── tier: AssetTier  ← STANDARD | PREMIUM | RESTRICTED
├── status: VehicleStatus  ← AVAILABLE | IN_USE | MAINTENANCE | RETIRED
├── hourly_rate: decimal
├── security_deposit: decimal  ← snapshot vào booking khi đặt
├── damage_multiplier: decimal  ← 1.0 | 1.5 | 2.0 theo tier
├── last_maintenance_at: timestamp
├── created_at / updated_at
```

**Tier rules:**
| Tier | deposit | damage_multiplier | customer eligibility |
|------|---------|-------------------|---------------------|
| STANDARD | thấp | 1.0x | tất cả |
| PREMIUM | trung bình | 1.5x | cần đủ điều kiện |
| RESTRICTED | cao | 2.0x | hạn chế, xét duyệt |

### Booking
```
Booking
├── id: UUID
├── customer_id: UUID → User
├── cafe_id: UUID → Cafe
├── vehicle_id: UUID? → Vehicle  ← null nếu BYOC
├── mode: BookingMode  ← RENTAL | BYOC
├── status: BookingStatus  ← xem state machine
├── slot_start: timestamp
├── slot_end: timestamp  ← update nếu gia hạn
├── snapshot: JSON  ← BookingSnapshot (xem dưới)
├── created_at / updated_at
```

#### BookingSnapshot (JSON, bất biến sau khi tạo)
```json
{
  "slot_fee_rate": 150000,
  "rental_fee": 50000,
  "security_deposit": 500000,
  "damage_multiplier": 1.5,
  "platform_fee_pct": 0.15,
  "refund_rules": "R1"
}
```
> ⚠️ Mọi tính toán tiền phải dùng snapshot, KHÔNG dùng giá hiện tại của Cafe/Vehicle.

### PaymentComponent
```
PaymentComponent
├── id: UUID
├── booking_id: UUID → Booking
├── type: ComponentType  ← SLOT_FEE | RENTAL_FEE | SECURITY_DEPOSIT | EXTENSION_FEE | DAMAGE_CHARGE
├── amount: decimal
├── status: ComponentStatus  ← PENDING | HELD | DISBURSED | REFUNDED | PARTIALLY_REFUNDED
├── disbursed_to: UUID?  ← provider_id khi disburse, null khi refund về customer
├── created_at / updated_at
```

### InspectionRecord
```
InspectionRecord
├── id: UUID
├── booking_id: UUID → Booking
├── type: InspectionType  ← CHECK_IN | CHECK_OUT
├── performed_by: UUID → User (Staff)
├── photos: string[]  ← 4 URLs: front, back, left, right
├── checklist: JSON  ← { scratches, cracks, missing_parts, notes }
├── pre_existing_flag: boolean  ← true nếu staff ghi nhận hư hỏng có sẵn
├── customer_confirmed: boolean
├── customer_confirmed_at: timestamp?
├── created_at
```

### Dispute
```
Dispute
├── id: UUID
├── booking_id: UUID → Booking
├── opened_by: UUID → User
├── reason: string
├── evidence_photos: string[]
├── status: DisputeStatus  ← OPEN | UNDER_REVIEW | RESOLVED
├── resolution: string?
├── resolved_by: UUID? → User (Admin)
├── resolved_at: timestamp?
├── created_at
```

---

## Quan hệ (ERD tóm tắt)

```
User (PROVIDER) ──< Cafe ──< Vehicle
                       │
User (CUSTOMER) ──< Booking >── Vehicle (nullable)
                       │
                       ├──< PaymentComponent (1..5)
                       ├──< InspectionRecord (2: check-in + check-out)
                       └──< Dispute (0..1)
```

---

## Enums

```typescript
enum UserRole       { CUSTOMER, PROVIDER, STAFF, ADMIN }
enum AssetTier      { STANDARD, PREMIUM, RESTRICTED }
enum BookingMode    { RENTAL, BYOC }
enum BookingStatus  { PENDING, CONFIRMED, ACTIVE, EXTENDING, CHECKING_OUT, DISPUTED, COMPLETED, CANCELLED }
enum ComponentType  { SLOT_FEE, RENTAL_FEE, SECURITY_DEPOSIT, EXTENSION_FEE, DAMAGE_CHARGE }
enum ComponentStatus{ PENDING, HELD, DISBURSED, REFUNDED, PARTIALLY_REFUNDED }
enum VehicleStatus  { AVAILABLE, IN_USE, MAINTENANCE, RETIRED }
enum CafeStatus     { PENDING, ACTIVE, SUSPENDED }
enum TrackType      { DRIFT, OBSTACLE, HILL_CLIMB }
enum InspectionType { CHECK_IN, CHECK_OUT }
enum DisputeStatus  { OPEN, UNDER_REVIEW, RESOLVED }
```
