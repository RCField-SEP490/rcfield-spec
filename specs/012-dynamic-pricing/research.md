# Research: Dynamic Pricing

**Date**: 2026-06-17 | **Feature**: 012 · Dynamic Pricing

---

## Decision 1 — Pricing Rule Storage: Separate Tables vs JSONB on Cafe

**Decision**: Separate tables (`cafe_pricing_rules`, `holiday_dates`)

**Rationale**: JSONB on Cafe would make querying holiday dates across cafes difficult and validation complex. Separate tables allow indexed lookups, proper FK constraints, and easier seeding of system holidays. Cost: 2 extra tables, small joins.

**Alternatives considered**:
- JSONB on `cafes`: simpler schema, but no indexing on date ranges, harder to seed system holidays uniformly
- Single `pricing_rules` table for all rule types: too heterogeneous, nullable columns everywhere

---

## Decision 2 — Pricing Lookup Integration Point in `createBooking`

**Decision**: New `PricingService.getEffectiveMultiplier(cafeId, slotStart)` called between cafe fetch and `rawSlotFee` calculation (after line 260, before line 326 in `booking.service.ts`)

**Rationale**: The injection point is clear — cafe is already fetched, slotStart is validated. Function returns `{ multiplier: number, label: string | null }`. If no rule matches, returns `{ multiplier: 1.0, label: null }`.

**Stack priority logic**: When multiple rules match same slot (e.g., weekend + peak hours), return the rule with the highest multiplier — NOT the product of multipliers.

**Alternatives considered**:
- Middleware approach: rejected — pricing is business logic, not HTTP concern
- Caching in Redis: deferred — at ~50 cafes, DB query < 5ms; add cache if needed at scale

---

## Decision 3 — National Holidays Data Source

**Decision**: Google Calendar ICS export → `seeds/fetch-holidays-from-ics.ts` script → upsert vào `holiday_dates` table với `multiplier = 1.0`

**Rationale**: Team RCField tự maintain một Google Calendar riêng chứa ngày lễ Việt Nam. ICS export (URL dạng `https://calendar.google.com/calendar/ical/.../public/basic.ics`) được parse bằng `node-ical`, upsert vào DB mỗi năm bằng script — không hardcode, không dependency runtime, Tết dates luôn chính xác vì team tự kiểm soát source. Script chạy 1 lần trước khi deploy đầu năm mới.

**Implementation**:
```ts
// src/seeds/fetch-holidays-from-ics.ts
import ical from 'node-ical';
const events = await ical.fromURL(process.env.HOLIDAYS_ICS_URL);
// filter events trong năm target, upsert holiday_dates (cafe_id=NULL, multiplier=1.0, holiday_type=SYSTEM)
```

**Scope**: Script chỉ seed SYSTEM holidays (toàn platform). Provider tự thêm CUSTOM holidays và set per-cafe override multiplier qua dashboard.

**Alternatives considered**:
- Hardcode trong migration SQL: rejected — Tết dates thay đổi mỗi năm (âm lịch), sẽ cần migration mới hàng năm
- Nager.Date API (free): viable nhưng team không kiểm soát data; ICS từ calendar nội bộ linh hoạt hơn (có thể thêm ngày lễ tùy chỉnh toàn platform)
- holidays.rest API: rejected — $29/month cho 1–2 call/năm, không xứng đáng
- Fetch runtime mỗi lần lookup: rejected — latency + external dependency trong critical path booking

---

## Decision 4 — Frontend Slot Price Display

**Decision**: `GET /cafes/:id/pricing-preview?slot_start=&slot_end=` returns `{ effective_price_per_hour, multiplier, label }` for a given time range — called when customer selects a slot in the booking UI

**Rationale**: Frontend needs the effective price AND the label ("Cuối tuần", "Ngày lễ 30/4", "Giờ cao điểm") to display. Calculating this on the frontend would require shipping all pricing rules to the client — a privacy concern for provider config data.

**Alternatives considered**:
- Ship all pricing rules to frontend: rejected — exposes provider config, adds client-side complexity
- Embed price in slot availability endpoint: possible future optimization, but out of scope for this feature

---

## Decision 5 — Booking Snapshot Extension

**Decision**: Add two fields to the existing `booking.snapshot` JSONB at creation time:
```json
{
  "slot_fee_multiplier": 1.5,
  "pricing_rule_label": "Cuối tuần"
}
```

**Rationale**: Constitution Principle I requires snapshot-first. Storing the multiplier and label in snapshot means the booking history is self-contained — no need to re-query pricing rules to understand what was charged. `null` label = base price applied.

**Alternatives considered**:
- New `snapshot_pricing` column: rejected — over-engineered, snapshot JSONB is already established pattern
- Store full rule object in snapshot: rejected — label + multiplier is sufficient for display and audit

---

## Decision 6 — Weekend Definition

**Decision**: Saturday (day 6) and Sunday (day 0) in UTC+7 (Asia/Ho_Chi_Minh timezone)

**Rationale**: Vietnamese cafes operate on local time. A slot at 23:00 Saturday local time should use weekend pricing even if it's Sunday UTC.

**Implementation**: Convert `slotStart` to Asia/Ho_Chi_Minh before checking `getDay()`.

---

## Decision 7 — Peak Hours Scope

**Decision**: Peak hours apply every day (weekdays and weekends). If weekend + peak hours both match, use the higher multiplier only.

**Rationale**: An RC cafe at 7pm on a Saturday is both weekend AND peak — charge the higher rate, not both stacked. This was confirmed during spec clarification.
