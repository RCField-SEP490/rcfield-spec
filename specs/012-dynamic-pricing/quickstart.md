# Quickstart: Dynamic Pricing

**Date**: 2026-06-17 | **Feature**: 012 · Dynamic Pricing

---

## Implementation Order

Follow this order to avoid breaking existing booking flow:

1. **Enums & migration** — add `PricingRuleType`, `HolidayType` to `types/index.ts`, create migration
2. **Models** — `CafePricingRule`, `HolidayDate` entities
3. **PricingService** — `getEffectiveMultiplier()` with unit tests (Test-First)
4. **Modify `createBooking`** — inject multiplier, update snapshot
5. **Pricing endpoints** — Provider config routes + public preview endpoint
6. **Frontend** — Provider pricing dashboard + `SlotPriceLabel` component in booking UI

---

## Unit Test Checklist (Test-First — before implementing PricingService)

```typescript
// src/services/__tests__/pricing.service.test.ts

describe('getEffectiveMultiplier', () => {
  it('returns 1.0 + null label for weekday non-peak with no rules', ...)
  it('returns weekend multiplier for Saturday slot', ...)
  it('returns weekend multiplier for Sunday slot', ...)
  it('returns peak multiplier for slot within peak hours window', ...)
  it('returns higher of weekend vs peak (not product) when both apply', ...)
  it('returns holiday multiplier for system holiday date', ...)
  it('returns holiday multiplier for custom cafe holiday', ...)
  it('returns higher of holiday vs weekend when both apply (holiday usually wins)', ...)
  it('returns 1.0 when rule exists but is_active=false', ...)
  it('uses Asia/Ho_Chi_Minh timezone for weekend check', ...)
  it('slot at boundary of peak hours (exactly 21:00 start) is NOT peak', ...)
})
```

---

## E2E Scenarios

### Scenario 1 — Base price (no rules configured)

1. Provider has no pricing rules for cafe
2. Customer books slot Thursday 15:00–16:00
3. `GET /cafes/:id/pricing-preview?slot_start=...` → `multiplier: 1.0, label: null`
4. Booking created → `snapshot.slot_fee_multiplier = 1.0`, `snapshot.pricing_rule_label = null`
5. `breakdown.slot_fee = slotFeeRate × 1`

---

### Scenario 2 — Weekend pricing

1. Provider sets `weekend_multiplier = 1.5` via `PUT /provider/cafes/:id/pricing/rules`
2. Customer books Saturday 14:00–15:00
3. Preview returns `{ multiplier: 1.5, label: "Cuối tuần", effective_price: slotFeeRate × 1.5 }`
4. Booking created → snapshot captures `{ slot_fee_multiplier: 1.5, pricing_rule_label: "Cuối tuần" }`
5. Provider changes weekend multiplier to 2.0 → existing CONFIRMED booking unaffected

---

### Scenario 3 — Holiday pricing

1. System holiday 02/09 exists with multiplier 2.0
2. Customer books 02/09 10:00–11:00
3. Preview returns `{ multiplier: 2.0, label: "Ngày lễ Quốc khánh" }`
4. Booking snapshot frozen with multiplier 2.0

---

### Scenario 4 — Weekend + Peak hours conflict (highest wins)

1. Provider sets: `weekend_multiplier = 1.5`, peak 18:00–21:00 multiplier 1.3
2. Customer books Saturday 19:00–20:00 (both weekend AND peak)
3. System uses 1.5 (weekend > peak) → `label: "Cuối tuần"`
4. NOT 1.5 × 1.3 = 1.95

---

### Scenario 5 — Provider adds custom holiday

1. Provider adds 20/07/2026 "Ngày khai trương" multiplier 2.0
2. Customer books 20/07/2026 → `label: "Ngày lễ Ngày khai trương"`, multiplier 2.0
3. Provider tries to delete 30/04 (SYSTEM) → error `SYSTEM_HOLIDAY_NOT_DELETABLE`
4. Provider deletes their custom holiday → future bookings on 20/07 use base price

---

## Key Code Change: `createBooking` in `booking.service.ts`

After line 260 (cafe validation), before line 326 (rawSlotFee calculation):

```typescript
// Dynamic pricing lookup
const { multiplier: slotMultiplier, label: pricingLabel } =
  await PricingService.getEffectiveMultiplier(body.cafe_id, slotStart);

// Apply multiplier to slot fee (line 326 becomes):
const rawSlotFee = Number(cafe.slotFeeRate) * slotMultiplier * slotCount * playerCount;
```

And in the snapshot construction (before `em.create(Booking, ...)`):

```typescript
snapshot.slot_fee_multiplier = slotMultiplier;
snapshot.pricing_rule_label = pricingLabel;
```
