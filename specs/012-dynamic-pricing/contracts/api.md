# API Contracts: Dynamic Pricing

**Date**: 2026-06-17 | **Feature**: 012 · Dynamic Pricing

---

## Endpoints Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/cafes/:id/pricing` | None | Get pricing config for a cafe (public — shown to customer before booking) |
| `GET` | `/cafes/:id/pricing-preview` | None | Get effective price for a specific slot datetime |
| `GET` | `/provider/cafes/:id/pricing` | PROVIDER | Get full pricing config for management UI |
| `PUT` | `/provider/cafes/:id/pricing/rules` | PROVIDER | Upsert weekend + peak hour rules |
| `GET` | `/provider/cafes/:id/pricing/holidays` | PROVIDER | List holiday dates (system + custom) |
| `POST` | `/provider/cafes/:id/pricing/holidays` | PROVIDER | Add custom holiday |
| `PUT` | `/provider/cafes/:id/pricing/holidays/:holidayId` | PROVIDER | Update custom holiday |
| `DELETE` | `/provider/cafes/:id/pricing/holidays/:holidayId` | PROVIDER | Delete custom holiday |

---

## 1. GET `/cafes/:id/pricing`

Public endpoint — customer sees pricing rules before selecting a slot.

**Response 200**:
```json
{
  "base_price_per_hour": 50000,
  "slot_duration_minutes": 60,
  "rules": {
    "weekend": { "multiplier": 1.5, "label": "Cuối tuần" },
    "peak_hours": [
      { "start": "18:00", "end": "21:00", "multiplier": 1.3, "label": "Giờ cao điểm" }
    ],
    "upcoming_holidays": [
      { "date": "2026-09-02", "name": "Quốc khánh", "multiplier": 3.0, "label": "Ngày lễ Quốc khánh" }
    ]
  }
}
```

`upcoming_holidays` = next 30 days only, **effective multiplier > 1.0 only** — holidays where no override is set (effective = 1.0) are excluded from this list.

---

## 2. GET `/cafes/:id/pricing-preview`

Customer calls this when selecting a slot to see the effective price.

**Query params**:
```
slot_start: ISO8601 datetime (required)
slot_end:   ISO8601 datetime (required)
```

**Response 200**:
```json
{
  "base_price_per_hour": 50000,
  "effective_price_per_hour": 75000,
  "multiplier": 1.5,
  "label": "Cuối tuần",
  "slot_fee_total": 75000
}
```

`label` is `null` if base price applies. `slot_fee_total` = `effective_price_per_hour × slot_hours`.

**Zod schema (request)**:
```typescript
const PricingPreviewQuery = z.object({
  slot_start: z.string().datetime(),
  slot_end: z.string().datetime(),
});
```

---

## 3. GET `/provider/cafes/:id/pricing` (PROVIDER)

Full pricing config for management dashboard.

**Response 200**:
```json
{
  "base_price_per_hour": 50000,
  "rules": [
    { "id": "uuid", "rule_type": "WEEKEND", "multiplier": 1.5, "is_active": true },
    { "id": "uuid", "rule_type": "PEAK_HOURS", "multiplier": 1.3,
      "peak_start_time": "18:00", "peak_end_time": "21:00", "is_active": true }
  ]
}
```

---

## 4. PUT `/provider/cafes/:id/pricing/rules` (PROVIDER)

Upsert all pricing rules for the cafe. Replaces existing active rules.

**Request body**:
```json
{
  "weekend_multiplier": 1.5,
  "peak_hours": [
    { "start": "18:00", "end": "21:00", "multiplier": 1.3 }
  ]
}
```

`weekend_multiplier` = `null` to disable weekend pricing. `peak_hours` = `[]` to remove all peak rules.

**Zod schema**:
```typescript
const PeakHourInput = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  multiplier: z.number().min(1.0).max(10.0),
}).refine(d => d.start < d.end, { message: 'start must be before end' });

const UpdatePricingRulesBody = z.object({
  weekend_multiplier: z.number().min(1.0).max(10.0).nullable(),
  peak_hours: z.array(PeakHourInput).max(5),
}).refine(
  d => {
    const windows = d.peak_hours;
    for (let i = 0; i < windows.length; i++)
      for (let j = i + 1; j < windows.length; j++)
        if (windows[i].start < windows[j].end && windows[j].start < windows[i].end) return false;
    return true;
  },
  { message: 'Peak hour windows must not overlap' }
);
```

**Response 200**:
```json
{ "updated": true }
```

---

## 5. GET `/provider/cafes/:id/pricing/holidays` (PROVIDER)

**Query params**: `?year=2026` (default: current year)

**Response 200**:
```json
{
  "holidays": [
    {
      "id": "uuid",
      "date": "2026-04-30",
      "name": "Ngày Thống nhất",
      "multiplier": 1.0,
      "holiday_type": "SYSTEM",
      "can_delete": false,
      "can_override": true,
      "override_multiplier": null
    },
    {
      "id": "uuid",
      "date": "2026-09-02",
      "name": "Quốc khánh",
      "multiplier": 1.0,
      "holiday_type": "SYSTEM",
      "can_delete": false,
      "can_override": true,
      "override_multiplier": 3.0
    },
    {
      "id": "uuid",
      "date": "2026-07-20",
      "name": "Ngày khai trương chi nhánh 2",
      "multiplier": 1.8,
      "holiday_type": "CUSTOM",
      "can_delete": true,
      "can_override": false,
      "override_multiplier": null
    }
  ]
}
```

`multiplier` = SYSTEM default (luôn là 1.0 — marker only, không có giá trị pricing). `override_multiplier` = giá trị cafe tự set qua `cafe_holiday_overrides` (`null` = chưa set, effective multiplier fallback về 1.0 = base price).

---

## 6. POST `/provider/cafes/:id/pricing/holidays` (PROVIDER)

Add a custom holiday.

**Request body**:
```json
{
  "date": "2026-07-20",
  "name": "Ngày khai trương chi nhánh 2",
  "multiplier": 1.8
}
```

**Zod schema**:
```typescript
const CreateHolidayBody = z.object({
  date: z.string().date(),
  name: z.string().min(1).max(255),
  multiplier: z.number().min(1.0).max(10.0),
});
```

**Response 201**: `{ "id": "uuid" }`

**Error 409**: `{ "code": "HOLIDAY_DATE_CONFLICT", "message": "A holiday already exists on this date" }`

---

## 7. PUT `/provider/cafes/:id/pricing/holidays/:holidayId` (PROVIDER)

Hai trường hợp khác nhau dựa vào `holiday_type`:

**CUSTOM holiday** — update `name` và/hoặc `multiplier` trực tiếp:
```json
{ "name": "Updated name", "multiplier": 2.0 }
```

**SYSTEM holiday** — chỉ set/update per-cafe override multiplier trong `cafe_holiday_overrides`:
```json
{ "multiplier": 3.0 }
```
Server tạo hoặc update record trong `cafe_holiday_overrides(cafe_id, holiday_date_id)`. SYSTEM holiday gốc không bị đụng tới.

**Zod schema**:
```typescript
const UpdateHolidayBody = z.object({
  name: z.string().min(1).max(255).optional(),
  multiplier: z.number().min(1.0).max(10.0),
});
```

**Error 403**: `{ "code": "SYSTEM_HOLIDAY_NAME_READONLY" }` — nếu gửi `name` cho SYSTEM holiday.

**Response 200**: `{ "updated": true }`

---

## 7b. DELETE `/provider/cafes/:id/pricing/holidays/:holidayId/override` (PROVIDER)

Xóa per-cafe override của SYSTEM holiday → reset về SYSTEM default multiplier.

**Response 200**: `{ "reset": true }`

**Error 404**: Nếu không có override nào tồn tại cho cafe + holiday đó.

---

## 8. DELETE `/provider/cafes/:id/pricing/holidays/:holidayId` (PROVIDER)

Delete CUSTOM holiday. Trả `403` cho SYSTEM holidays.

**Response 200**: `{ "deleted": true }`

**Error 403**: `{ "code": "SYSTEM_HOLIDAY_NOT_DELETABLE" }`

---

## Booking Creation — Modified Behavior

`POST /bookings` (existing endpoint) is modified internally. No request schema change.

The `breakdown` in the response now includes pricing info:
```json
{
  "breakdown": {
    "slot_fee": 75000,
    "slot_fee_base": 50000,
    "slot_fee_multiplier": 1.5,
    "pricing_rule_label": "Cuối tuần",
    "rental_fee": 300000,
    "security_deposit": 300000,
    "fnb_total": 0,
    "discount": 0,
    "total": 675000
  }
}
```

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `HOLIDAY_DATE_CONFLICT` | 409 | Custom holiday date already exists for this cafe |
| `SYSTEM_HOLIDAY_NOT_DELETABLE` | 403 | Cannot delete system-provided holidays |
| `SYSTEM_HOLIDAY_NAME_READONLY` | 403 | Cannot change name of system holidays |
| `INVALID_PEAK_HOURS` | 400 | Peak start must be before peak end |
| `OVERLAPPING_PEAK_HOURS` | 400 | Two or more peak hour windows overlap |
| `MULTIPLIER_TOO_LOW` | 400 | Multiplier must be ≥ 1.0 |
| `PRICING_LOOKUP_FAILED` | 500 | Pricing service DB error during booking creation — booking rejected |
