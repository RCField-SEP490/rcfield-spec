# Data Model: Dynamic Pricing

**Date**: 2026-06-17 | **Feature**: 012 · Dynamic Pricing

---

## New Entities

### 1. CafePricingRule

Stores per-cafe multipliers for weekend and peak hour windows.

**Table**: `cafe_pricing_rules`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `cafe_id` | UUID | FK → cafes.id, NOT NULL | |
| `rule_type` | ENUM | NOT NULL | `WEEKEND` \| `PEAK_HOURS` |
| `multiplier` | NUMERIC(5,2) | NOT NULL, ≥ 1.0 | e.g. 1.5 |
| `peak_start_time` | TIME | nullable | Only for PEAK_HOURS (e.g. 18:00:00) |
| `peak_end_time` | TIME | nullable | Only for PEAK_HOURS (e.g. 21:00:00) |
| `is_active` | BOOLEAN | NOT NULL, default true | Soft-disable without delete |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |
| `deleted_at` | TIMESTAMPTZ | nullable | Soft delete |

**Indexes**: `(cafe_id, rule_type, is_active)`, `(cafe_id, deleted_at)`

**Constraints**:
- If `rule_type = WEEKEND`: `peak_start_time` and `peak_end_time` must be NULL
- If `rule_type = PEAK_HOURS`: both `peak_start_time` and `peak_end_time` must be NOT NULL, and `peak_start_time < peak_end_time`
- `multiplier >= 1.0` (DB CHECK constraint)
- Max 1 WEEKEND rule per cafe (UNIQUE on `(cafe_id, rule_type)` WHERE `rule_type = 'WEEKEND'`)
- Multiple PEAK_HOURS rules allowed per cafe (different time windows)

---

### 2. HolidayDate

Stores holiday dates — both system-provided national holidays and provider custom dates.

**Table**: `holiday_dates`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `cafe_id` | UUID | FK → cafes.id, nullable | NULL = system holiday (applies platform-wide as default) |
| `holiday_date` | DATE | NOT NULL | |
| `name` | VARCHAR(255) | NOT NULL | e.g. "Ngày Thống nhất 30/4", "Khai trương chi nhánh 2" |
| `multiplier` | NUMERIC(5,2) | NOT NULL, ≥ 1.0 | Provider overrides per-cafe |
| `holiday_type` | ENUM | NOT NULL | `SYSTEM` \| `CUSTOM` |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |
| `deleted_at` | TIMESTAMPTZ | nullable | CUSTOM only — SYSTEM rows never soft-deleted |

**Indexes**: `(cafe_id, holiday_date)`, `(holiday_type, holiday_date)`

**Constraints**:
- SYSTEM rows: `cafe_id = NULL`, cannot be deleted by Provider (only multiplier override allowed per cafe via `CafePricingRule` or a separate cafe-holiday override)
- CUSTOM rows: `cafe_id NOT NULL`
- UNIQUE on `(cafe_id, holiday_date)` for CUSTOM rows to prevent duplicates

---

### 3. CafeHolidayOverride

Per-cafe multiplier override cho SYSTEM holidays. Khi Provider muốn đổi multiplier của ngày 30/4 chỉ cho cafe mình — không đụng đến record SYSTEM gốc.

**Table**: `cafe_holiday_overrides`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `cafe_id` | UUID | FK → cafes.id, NOT NULL | |
| `holiday_date_id` | UUID | FK → holiday_dates.id, NOT NULL | Phải reference SYSTEM holiday |
| `multiplier` | NUMERIC(5,2) | NOT NULL, ≥ 1.0 | Override của cafe này |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Indexes**: `(cafe_id, holiday_date_id)` UNIQUE

**Constraints**:
- `holiday_date_id` phải trỏ vào record có `holiday_type = 'SYSTEM'`
- Mỗi cafe chỉ có 1 override per SYSTEM holiday (UNIQUE constraint)
- Không có `deleted_at` — xóa override = reset về SYSTEM default

**Lookup priority trong `getEffectiveMultiplier(cafeId, slotStart)`**:
```
1. CafeHolidayOverride  (cafe_id = X, ngày = D)   → per-cafe SYSTEM override
2. HolidayDate CUSTOM   (cafe_id = X, ngày = D)   → custom holiday của cafe
3. HolidayDate SYSTEM   (cafe_id = NULL, ngày = D) → platform default
4. CafePricingRule WEEKEND  (nếu là thứ 7/CN)
5. CafePricingRule PEAK_HOURS (nếu trong khung giờ)
→ Trả về multiplier CAO NHẤT trong các rule match (không nhân chồng)
```

---

## Modified Entities

### Booking.snapshot (existing JSONB field)

No schema change needed — JSONB is additive. Two new fields added at booking creation:

```typescript
// Added to existing snapshot object in createBooking()
{
  // ... existing fields (track_config_id, package_used, etc.) ...
  slot_fee_multiplier: number,   // e.g. 1.5 (1.0 if base price)
  pricing_rule_label: string | null  // e.g. "Cuối tuần", "Ngày lễ 30/4", null if base
}
```

---

## New Enums (types/index.ts)

```typescript
export enum PricingRuleType {
  WEEKEND = 'WEEKEND',
  PEAK_HOURS = 'PEAK_HOURS',
}

export enum HolidayType {
  SYSTEM = 'SYSTEM',
  CUSTOM = 'CUSTOM',
}
```

---

## Entity Relationships

```
Cafe (1) ──── (0..N) CafePricingRule
Cafe (1) ──── (0..N) HolidayDate [CUSTOM only]
Cafe (1) ──── (0..N) CafeHolidayOverride
HolidayDate [SYSTEM, cafe_id=NULL] ←── CafeHolidayOverride (per-cafe override)
```

---

## Migration Plan

**File**: `src/migrations/TIMESTAMP-AddDynamicPricing.ts`

```sql
-- 1. Create enum types
CREATE TYPE pricing_rule_type_enum AS ENUM ('WEEKEND', 'PEAK_HOURS');
CREATE TYPE holiday_type_enum AS ENUM ('SYSTEM', 'CUSTOM');

-- 2. Create cafe_pricing_rules table
CREATE TABLE cafe_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID NOT NULL REFERENCES cafes(id),
  rule_type pricing_rule_type_enum NOT NULL,
  multiplier NUMERIC(5,2) NOT NULL CHECK (multiplier >= 1.0),
  peak_start_time TIME,
  peak_end_time TIME,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_cafe_pricing_rules_cafe ON cafe_pricing_rules(cafe_id, rule_type, is_active);
CREATE UNIQUE INDEX idx_cafe_pricing_rules_weekend ON cafe_pricing_rules(cafe_id)
  WHERE rule_type = 'WEEKEND' AND deleted_at IS NULL;

-- 3. Create holiday_dates table
CREATE TABLE holiday_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID REFERENCES cafes(id),
  holiday_date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  multiplier NUMERIC(5,2) NOT NULL CHECK (multiplier >= 1.0),
  holiday_type holiday_type_enum NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_holiday_dates_cafe_date ON holiday_dates(cafe_id, holiday_date);
CREATE INDEX idx_holiday_dates_system ON holiday_dates(holiday_type, holiday_date)
  WHERE holiday_type = 'SYSTEM';

-- 4. Create cafe_holiday_overrides table
CREATE TABLE cafe_holiday_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID NOT NULL REFERENCES cafes(id),
  holiday_date_id UUID NOT NULL REFERENCES holiday_dates(id),
  multiplier NUMERIC(5,2) NOT NULL CHECK (multiplier >= 1.0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cafe_id, holiday_date_id)
);
CREATE INDEX idx_cafe_holiday_overrides_cafe ON cafe_holiday_overrides(cafe_id);

-- 5. Seed Vietnamese national holidays 2026–2027
-- multiplier = 1.0: SYSTEM records are markers only — providers configure
-- their own effective multiplier per-cafe via cafe_holiday_overrides.
INSERT INTO holiday_dates (holiday_date, name, multiplier, holiday_type, cafe_id) VALUES
  ('2026-01-01', 'Tết Dương lịch', 1.0, 'SYSTEM', NULL),
  ('2026-01-28', 'Tết Nguyên Đán (28 Tết)', 1.0, 'SYSTEM', NULL),
  ('2026-01-29', 'Tết Nguyên Đán (29 Tết)', 1.0, 'SYSTEM', NULL),
  ('2026-01-30', 'Giao thừa', 1.0, 'SYSTEM', NULL),
  ('2026-01-31', 'Mùng 1 Tết', 1.0, 'SYSTEM', NULL),
  ('2026-02-01', 'Mùng 2 Tết', 1.0, 'SYSTEM', NULL),
  ('2026-02-02', 'Mùng 3 Tết', 1.0, 'SYSTEM', NULL),
  ('2026-04-07', 'Giỗ Tổ Hùng Vương', 1.0, 'SYSTEM', NULL),
  ('2026-04-30', 'Ngày Thống nhất', 1.0, 'SYSTEM', NULL),
  ('2026-05-01', 'Quốc tế Lao động', 1.0, 'SYSTEM', NULL),
  ('2026-09-02', 'Quốc khánh', 1.0, 'SYSTEM', NULL);
```
