# Tasks: Dynamic Pricing

**Input**: `specs/012-dynamic-pricing/`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Stack**: Node.js 20+, TypeScript strict, Express.js, TypeORM, PostgreSQL, zod

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on each other)
- **[Story]**: User story this task belongs to
- All backend paths relative to `rcfeild-be/` (note: typo in folder name is intentional)
- All frontend paths relative to `rcfield-fe/`

---

## Phase 1: Setup

**Purpose**: Enums, migration, and ICS seed script — must land before any entity or service work.

- [x] T001 Add `PricingRuleType` and `HolidayType` enums to `rcfeild-be/src/types/index.ts`
- [x] T002 Create TypeORM migration `rcfeild-be/src/migrations/TIMESTAMP-AddDynamicPricing.ts` — creates `cafe_pricing_rules`, `holiday_dates`, `cafe_holiday_overrides` tables with indexes and CHECK constraints per data-model.md
- [x] T003 Create ICS seed script `rcfeild-be/src/seeds/fetch-holidays-from-ics.ts` — reads `HOLIDAYS_ICS_URL` env var via `node-ical`, upserts SYSTEM holidays into `holiday_dates` with `cafe_id=NULL` and `multiplier=1.0`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All 3 entities + `PricingService.getEffectiveMultiplier()` — required by every user story.

**⚠️ CRITICAL**: No user story can begin until this phase is complete.

- [x] T004 [P] Create `CafePricingRule` TypeORM entity in `rcfeild-be/src/models/cafe-pricing-rule.entity.ts` — columns, enums, indexes per data-model.md
- [x] T005 [P] Create `HolidayDate` TypeORM entity in `rcfeild-be/src/models/holiday-date.entity.ts` — nullable `cafe_id`, `holiday_type` enum, soft-delete column
- [x] T006 [P] Create `CafeHolidayOverride` TypeORM entity in `rcfeild-be/src/models/cafe-holiday-override.entity.ts` — FK to `holiday_dates`, UNIQUE on `(cafe_id, holiday_date_id)`, no `deleted_at`
- [x] T007 Write unit tests for `getEffectiveMultiplier` in `rcfeild-be/src/services/__tests__/pricing.service.test.ts` — 11 test cases from quickstart.md **BEFORE** implementing the service; verify all tests FAIL first
- [x] T008 Implement `PricingService` in `rcfeild-be/src/services/pricing.service.ts` — `getEffectiveMultiplier(cafeId, slotStart)` with lookup priority (CafeHolidayOverride → CUSTOM holiday → SYSTEM holiday → WEEKEND → PEAK_HOURS → return max), UTC+7 weekend check, returns `{ multiplier: number, label: string | null }` (depends on T004–T007)

**Checkpoint**: Run T007 tests — all 11 must pass before proceeding.

---

## Phase 3: User Story 1 — Provider Configures Pricing Rules (P1) 🎯 MVP

**Goal**: Provider can set weekend multiplier and peak hour windows per cafe; rules are persisted and retrievable.

**Independent Test**: Provider sets `weekend_multiplier=1.5` via `PUT /provider/cafes/:id/pricing/rules`, then calls `GET /provider/cafes/:id/pricing` and sees the saved value.

- [x] T009 [US1] Implement `PricingController` in `rcfeild-be/src/controllers/pricing.controller.ts` — `GET /provider/cafes/:id/pricing` handler: returns `base_price_per_hour` from `cafe.slotFeeRate` + active rules from `cafe_pricing_rules`
- [x] T010 [US1] Add `PUT /provider/cafes/:id/pricing/rules` handler to `rcfeild-be/src/controllers/pricing.controller.ts` — Zod validation with `UpdatePricingRulesBody` (includes overlap refine), upserts WEEKEND rule (null = soft-delete), replaces PEAK_HOURS rules
- [x] T011 [US1] Add `GET /cafes/:id/pricing` public handler to `rcfeild-be/src/controllers/pricing.controller.ts` — returns base price + rules + `upcoming_holidays` (next 30 days, effective multiplier > 1.0 only)
- [x] T012 [US1] Add `GET /cafes/:id/pricing-preview` public handler to `rcfeild-be/src/controllers/pricing.controller.ts` — validates `PricingPreviewQuery` Zod schema, calls `getEffectiveMultiplier`, returns `{ base_price_per_hour, effective_price_per_hour, multiplier, label, slot_fee_total }`
- [x] T013 [US1] Create `rcfeild-be/src/routes/pricing.routes.ts` — register all 4 endpoints above with correct auth middleware (PROVIDER guard on provider routes, none on public routes); mount in `rcfeild-be/src/routes/index.ts`
- [x] T014 [P] [US1] Create Provider Pricing Dashboard page `rcfield-fe/src/pages/provider/ProviderPricingPage.tsx` — two sections: Pricing Rules (weekend toggle + peak hours CRUD) and Holiday Management placeholder; calls `GET /provider/cafes/:id/pricing`
- [x] T015 [P] [US1] Create `rcfield-fe/src/features/pricing/` hooks — React Query hooks for pricing config and rules mutation

**Checkpoint**: Provider can open dashboard, set weekend multiplier, see updated value. Preview endpoint returns correct effective price.

---

## Phase 4: User Story 3 — Booking Auto-Applies Price (P1)

**Goal**: `createBooking` automatically looks up the applicable multiplier for the slot's date/time, applies it to slot fee, and freezes it in the snapshot.

**Independent Test**: Create booking on a Saturday (weekend rule = 1.5) → `breakdown.slot_fee_multiplier = 1.5`; change weekend rule → existing CONFIRMED booking unaffected.

- [x] T016 [US3] Modify `rcfeild-be/src/services/booking.service.ts` `createBooking()` — inject `PricingService.getEffectiveMultiplier(cafeId, slotStart)` after line 260 (cafe validation), before line 326 (`rawSlotFee`); multiply `cafe.slotFeeRate × slotMultiplier`
- [x] T017 [US3] Update snapshot construction in `rcfeild-be/src/services/booking.service.ts` — add `slot_fee_multiplier` and `pricing_rule_label` fields to the `snapshot` JSONB before `em.create(Booking, ...)`
- [x] T018 [US3] Update booking breakdown response in `rcfeild-be/src/services/booking.service.ts` — add `slot_fee_base`, `slot_fee_multiplier`, `pricing_rule_label` to the `breakdown` object per contracts/api.md

**Checkpoint**: Create booking on Saturday → snapshot has `slot_fee_multiplier: 1.5`; create booking on weekday → `slot_fee_multiplier: 1.0`, `pricing_rule_label: null`.

---

## Phase 5: User Story 4 — Booking UI Shows Dynamic Price (P1)

**Goal**: Booking calendar shows effective price with label when slot has dynamic pricing; customer is not surprised at checkout.

**Independent Test**: Select Saturday slot in booking UI → label "75k/h (Cuối tuần)" appears; select weekday slot → no label. Total in order summary reflects multiplied price.

- [x] T019 [P] [US4] Create `SlotPriceLabel` component in `rcfield-fe/src/shared/components/SlotPriceLabel.tsx` — accepts `{ effectivePrice, label }` props; renders "75k/h (Cuối tuần)" badge when label non-null, plain price when label is null
- [x] T020 [US4] Integrate `SlotPriceLabel` into booking slot selection in `rcfield-fe/src/pages/booking/CreateBookingPage.tsx` — on date select, call `GET /cafes/:id/pricing-preview` for the selected date; pass `effectivePrice + label` to `SlotPriceLabel` per slot
- [x] T021 [US4] Update booking order summary in `rcfield-fe/src/pages/booking/CreateBookingPage.tsx` — replace base price display with `effective_price_per_hour`; show `pricing_rule_label` as a line item explanation

**Checkpoint**: Full booking flow with weekend slot shows correct dynamic price at every step — slot selection, order summary, and post-booking confirmation.

---

## Phase 6: User Story 2 — Provider Holiday Management (P2)

**Goal**: Provider can view system holidays, add custom holidays, and set per-cafe multiplier overrides on system holidays.

**Independent Test**: Provider adds custom holiday 20/07/2026 × 2.0 → customer booking on that date gets multiplier 2.0. Provider tries to delete a system holiday (30/04) → `SYSTEM_HOLIDAY_NOT_DELETABLE` error.

- [x] T022 [P] [US2] Add `GET /provider/cafes/:id/pricing/holidays` handler to `rcfeild-be/src/controllers/pricing.controller.ts` — returns merged list of SYSTEM holidays (with `override_multiplier` from `cafe_holiday_overrides`) and CUSTOM holidays; filtered by `?year` query param
- [x] T023 [P] [US2] Add `POST /provider/cafes/:id/pricing/holidays` handler to `rcfeild-be/src/controllers/pricing.controller.ts` — validates `CreateHolidayBody` Zod schema, creates CUSTOM `holiday_dates` record, returns 409 `HOLIDAY_DATE_CONFLICT` if date exists
- [x] T024 [P] [US2] Add `PUT /provider/cafes/:id/pricing/holidays/:holidayId` handler — branches on `holiday_type`: CUSTOM → update `holiday_dates` directly; SYSTEM → upsert into `cafe_holiday_overrides`; returns 403 `SYSTEM_HOLIDAY_NAME_READONLY` if name sent for SYSTEM
- [x] T025 [P] [US2] Add `DELETE /provider/cafes/:id/pricing/holidays/:holidayId` handler — soft-deletes CUSTOM holiday; returns 403 `SYSTEM_HOLIDAY_NOT_DELETABLE` for SYSTEM holidays
- [x] T026 [P] [US2] Add `DELETE /provider/cafes/:id/pricing/holidays/:holidayId/override` handler — deletes `cafe_holiday_overrides` record (reset to system default 1.0); returns 404 if no override exists
- [x] T027 [US2] Add all 5 holiday CRUD routes to `rcfeild-be/src/routes/pricing.routes.ts` with PROVIDER auth guard
- [x] T028 [US2] Implement Holiday Management section in `rcfield-fe/src/pages/provider/ProviderPricingPage.tsx` — year filter dropdown, SYSTEM holiday list (lock icon, Set/Edit override button, no delete), CUSTOM holiday list (edit + delete), "Add custom holiday" modal; wire to all 5 CRUD endpoints

**Checkpoint**: Provider can add custom holiday, set override on national holiday, and customer booking on those dates gets the correct multiplier.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T029 Add `'dynamic-pricing/tasks'` entry to `website/sidebars-specs.ts` in the 012 category
- [ ] T030 Run E2E validation per quickstart.md — 5 scenarios covering base price, weekend, holiday, conflict resolution, custom holiday CRUD
- [ ] T031 Verify snapshot immutability — create CONFIRMED booking, update pricing config, confirm booking snapshot values unchanged

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (enums must exist before entities; migration must exist before DB setup)
- **Phase 3–6 (User Stories)**: All depend on Phase 2 completion
  - US1 and US2 share the same controller/routes file — implement US1 endpoints first
  - US3 depends on `PricingService` (Phase 2) and modifies `booking.service.ts`
  - US4 depends on `GET /cafes/:id/pricing-preview` (US1, T012)
  - US2 holiday endpoints can start in parallel with US3/US4 (different files)
- **Phase 7 (Polish)**: Depends on all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Start after Phase 2 — independent
- **US3 (P1)**: Start after Phase 2 — independent (modifies booking.service.ts only)
- **US4 (P1)**: Start after T012 (pricing-preview endpoint) — frontend only, no backend conflicts
- **US2 (P2)**: Start after Phase 2 — shares controller/routes file with US1, implement sequentially

### Within Each Phase

- T004, T005, T006 in Phase 2 can run in parallel (different files)
- T007 (tests) MUST be written and FAIL before T008 (implementation) — Constitution Principle V
- T009–T013 in US1 are sequential (same controller + routes file)
- T014, T015 in US1 can run in parallel (different files, no backend dependency except contract shape)
- T022–T026 in US2 can run in parallel (same controller file — coordinate to avoid conflicts)

---

## Parallel Example: Phase 2 Foundation

```bash
# These 3 tasks can run simultaneously:
Task A: "Create CafePricingRule entity in rcfeild-be/src/models/cafe-pricing-rule.entity.ts"
Task B: "Create HolidayDate entity in rcfeild-be/src/models/holiday-date.entity.ts"
Task C: "Create CafeHolidayOverride entity in rcfeild-be/src/models/cafe-holiday-override.entity.ts"

# Then sequentially:
Task D: "Write failing unit tests in rcfeild-be/src/services/__tests__/pricing.service.test.ts"
Task E: "Implement PricingService.getEffectiveMultiplier() — make T007 tests pass"
```

---

## Implementation Strategy

### MVP (US1 + US3 only)

1. Phase 1: Setup (enums + migration)
2. Phase 2: Foundation (entities + PricingService + tests)
3. Phase 3 (US1): Provider can configure weekend + peak hours rules
4. Phase 4 (US3): Booking applies correct multiplier, freezes in snapshot
5. **STOP and VALIDATE** — pricing works end-to-end before adding UI or holiday management

### Full Delivery Order

1. Setup → Foundation → US1 → US3 → US4 → US2 → Polish
2. Each phase independently testable before proceeding
3. US3 and US4 can be parallelized after US1 backend is complete
