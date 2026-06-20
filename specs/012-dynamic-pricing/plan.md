# Implementation Plan: Dynamic Pricing

**Branch**: `003-fb-messenger-channel` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

## Summary

Provider configures per-cafe pricing multipliers (weekend, holiday, peak hours). At booking creation, the system looks up the applicable multiplier for the slot's date/time, applies it to `cafe.slotFeeRate`, and stores the result in the booking snapshot. The booking UI displays the effective price with a label indicating the active pricing rule.

## Technical Context

**Language/Version**: Node.js 20+, TypeScript strict mode
**Primary Dependencies**: Express.js, TypeORM, PostgreSQL, zod
**Storage**: PostgreSQL — 3 new tables (`cafe_pricing_rules`, `holiday_dates`, `cafe_holiday_overrides`) + migration
**Testing**: Jest unit tests for pricing lookup logic (Test-First, Constitution Principle V)
**Target Platform**: Linux server (same as existing backend)
**Project Type**: Web service — adds pricing config endpoints + modifies booking creation
**Performance Goals**: Pricing lookup < 10ms (cached or indexed query per cafe)
**Constraints**: Snapshot-first (Constitution Principle I) — multiplier must be frozen in snapshot at booking creation. Changes to pricing config MUST NOT affect existing CONFIRMED bookings.
**Scale/Scope**: ~50 cafes initially; pricing rules per cafe < 20 rows

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Snapshot-First Pricing | ✅ PASS | Must add `slot_fee_multiplier` and `pricing_rule_label` to `booking.snapshot` at creation |
| II. State Machine Gate | ✅ N/A | No booking/session state transitions modified |
| III. Evidence-Based Handover | ✅ N/A | No inspection flow affected |
| IV. Payment Component Isolation | ✅ PASS | SLOT_FEE still uses snapshotted rate; multiplier captured at creation time |
| V. Test-First for Financial Logic | ⚠️ REQUIRED | Unit tests for `getEffectiveMultiplier()` must be written before implementation |
| VI. RBAC Enforcement | ✅ PASS | Provider config endpoints: `PROVIDER` role; public slot price endpoint: no auth required |
| Phase 2 Promotion | ✅ PROMOTED | Constitution allows promotion "when a new spec explicitly promotes" — spec 012 is that spec |

## Project Structure

### Documentation (this feature)

```text
specs/012-dynamic-pricing/
├── plan.md              ← this file
├── research.md          ← Phase 0 decisions
├── data-model.md        ← entity definitions
├── quickstart.md        ← integration scenarios
├── contracts/
│   └── api.md           ← endpoint contracts + zod schemas
└── tasks.md             ← Phase 2 (/speckit-tasks output)
```

### Source Code (backend — rcfeild-be/)

```text
rcfeild-be/src/
├── models/
│   ├── cafe-pricing-rule.entity.ts      ← NEW
│   ├── holiday-date.entity.ts           ← NEW
│   └── cafe-holiday-override.entity.ts  ← NEW
├── services/
│   ├── pricing.service.ts            ← NEW  (getEffectiveMultiplier, getPricingConfig)
│   └── booking.service.ts            ← MODIFY (inject multiplier into createBooking)
├── routes/
│   └── pricing.routes.ts             ← NEW
├── controllers/
│   └── pricing.controller.ts         ← NEW
├── migrations/
│   └── TIMESTAMP-AddDynamicPricing.ts ← NEW
├── types/
│   └── index.ts                      ← MODIFY (add PricingRuleType, HolidayType enums)
└── seeds/
    └── fetch-holidays-from-ics.ts    ← NEW (parse Google Calendar ICS → upsert SYSTEM holiday_dates)
```

### Source Code (frontend — rcfield-fe/)

```text
rcfield-fe/src/
├── shared/components/
│   └── SlotPriceLabel.tsx            ← NEW (shows "75k/h (Cuối tuần)" badge)
├── pages/provider/
│   └── ProviderPricingPage.tsx       ← NEW (pricing config dashboard)
└── features/pricing/                 ← NEW (React Query hooks for pricing config)
```
