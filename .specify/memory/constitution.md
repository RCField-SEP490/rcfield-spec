<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR — material update to Principle VI (NestJS-specific guidance replaced
with Express middleware equivalents) and full rewrite of Tech Stack & Constraints section
to reflect actual stack: TypeScript + Express (BE) + ReactJS/Vite (FE).

Modified principles:
  VI. RBAC Enforcement — implementation guidance updated:
      "NestJS Guards + decorators" → "Express auth middleware at router level"

Modified sections:
  - Tech Stack & Constraints: NestJS 10 → Express.js; Next.js 14 → ReactJS (Vite);
    class-validator → zod; DTO naming → Request/Response type naming

Removed sections: none
Added sections: none

Templates requiring updates:
  ✅ .specify/memory/constitution.md — this file
  ⚠  .specify/templates/plan-template.md — Constitution Check references still valid; no update needed
  ⚠  .specify/templates/spec-template.md — principle-agnostic; no update needed
  ⚠  .specify/templates/tasks-template.md — principle-agnostic; no update needed

Follow-up TODOs:
  - TODO(RATIFICATION_DATE): using project start date 2026-05-11 (first spec commit)
-->

<!-- AGENT INSTRUCTION: Before filling any placeholder, read ALL files in docs/spec/ (00-overview.md through the highest-numbered file present). Those files are the authoritative source of truth for business rules, domain model, state machine, payment engine, inspection flow, and API contracts. Do not infer principles from CLAUDE.md or README alone. -->

# RCField Constitution

## Core Principles

### I. Snapshot-First Pricing

All financial calculations MUST read from `booking.snapshot` (the immutable JSON captured
at booking creation time). Reading live prices from `Cafe` or `Vehicle` entities for any
money calculation is FORBIDDEN, even if the snapshot value appears identical.

- `booking.snapshot` contains: `slot_fee_rate`, `rental_fee`, `security_deposit`,
  `damage_multiplier`, `platform_fee_pct`, `refund_rules`.
- The snapshot is written once on `CONFIRMED` transition and MUST NOT be mutated afterward.
- Any feature that computes a fee, refund, damage charge, or platform fee MUST reference
  `booking.snapshot.*` fields, not `vehicle.hourly_rate` or `vehicle.security_deposit`.

**Rationale**: Prices may change between booking creation and settlement. Using snapshot
values ensures customers are charged exactly what was agreed at booking time and eliminates
retroactive pricing disputes.

### II. State Machine Gate

All booking status transitions MUST go through `BookingService.transition(bookingId, event)`.
Direct updates to `booking.status` via repository, query builder, or raw SQL are FORBIDDEN.

- Every transition is validated by `canTransition(currentStatus, event)` before applying.
- Invalid transitions MUST throw `BadRequestException` with code `INVALID_BOOKING_STATE`.
- The valid state graph is: PENDING → CONFIRMED → ACTIVE → EXTENDING → ACTIVE →
  CHECKING_OUT → COMPLETED; with CANCELLED and DISPUTED as terminal/branch states.
- Timeout transitions (auto-cancel, auto-confirm) MUST also use the same `transition()` method.

**Rationale**: A single entry point ensures audit logging, side-effect hooks (payment,
notifications), and guard logic execute consistently. Direct updates bypass these guarantees.

### III. Evidence-Based Handover (NON-NEGOTIABLE)

Every asset handover MUST produce a valid `InspectionRecord` with 4 photos and a
complete checklist. An incomplete inspection forfeits all damage claim rights.

- **4 photos required**: FRONT, BACK, LEFT, RIGHT — all must be uploaded to S3 and
  have valid URLs before the record can be submitted.
- **Checklist required**: `scratches`, `cracks`, `missing_parts`, `notes` — all fields
  MUST be present; empty string is acceptable, `null` is not.
- `pre_existing_flag = true` is only legally valid when 4 photos + checklist are present
  AND `customer_confirmed = true`.
- If a Provider submits a damage charge without a valid check-in AND check-out record,
  the system MUST reject the charge.
- Photo retention: minimum 90 days post-COMPLETED; extended to 30 days post-dispute
  RESOLVED if a dispute existed.

**Rationale**: This is the core value proposition of RCField — eliminating damage disputes
through structured digital evidence. Weakening this protocol invalidates the platform's
primary trust guarantee.

### IV. Payment Component Isolation

Each `PaymentComponent` has an independent lifecycle. Component amounts are immutable
after creation. Adjustments require creating a new component, never editing an existing one.

- Valid component types: `SLOT_FEE | RENTAL_FEE | SECURITY_DEPOSIT | EXTENSION_FEE |
  DAMAGE_CHARGE`.
- Valid statuses: `PENDING → HELD → DISBURSED | REFUNDED | PARTIALLY_REFUNDED`.
- `EXTENSION_FEE` cumulative total MUST NOT exceed `security_deposit × 0.50`.
- Platform fee (15%) applies ONLY to components disbursed to Provider
  (`SLOT_FEE + RENTAL_FEE + EXTENSION_FEE + DAMAGE_CHARGE`). `SECURITY_DEPOSIT` is
  excluded because it belongs to the customer.
- Concurrent status updates MUST use DB transactions with row-level locks.

**Rationale**: An immutable ledger provides a complete audit trail of every financial
event. Editing amounts in-place would make forensic reconstruction impossible and create
race condition vulnerabilities.

### V. Test-First for Financial & State Logic

Unit tests for payment rules and state transitions MUST be written and confirmed failing
before any implementation code is written for those rules.

- Mandatory unit tests before implementation:
  - R1 refund rule (3 time windows + pro-rata formula)
  - R2 (provider cancellation — 100% refund, no platform fee)
  - R3 (timeout / no-show — 0% SLOT_FEE, 100% RENTAL_FEE + DEPOSIT)
  - Extension fee cap (cumulative sum ≤ 50% deposit)
  - Damage charge calculation (≤ deposit and > deposit branches)
  - Platform fee calculation (excluded vs included components)
  - `canTransition()` for every valid and invalid transition pair
- Integration test required: full booking lifecycle with payment settlement.

**Rationale**: Payment logic has zero tolerance for errors — incorrect refunds or charges
have direct financial and legal consequences. Test-first guarantees the spec is validated
before code is merged.

### VI. RBAC Enforcement

Every API endpoint MUST declare and enforce its required role(s). Cross-role access is
never assumed — it must be explicitly granted.

- Roles: `CUSTOMER | PROVIDER | STAFF | ADMIN`. `PLATFORM` is reserved for system tasks.
- Auth MUST be enforced via Express middleware applied at the router level; relying on
  business-logic checks inside services as the sole access control is FORBIDDEN.
- Each route file MUST apply `authenticate` (JWT verification) and `authorize(...roles)`
  (role check) middleware before the handler — never inside the handler.
- Staff actions (check-in, check-out, extension proposal) MUST validate that the staff
  member is assigned to the same cafe as the booking.
- Admin routes MUST be mounted under a dedicated router (e.g., `/admin/*`) with
  admin-only middleware, segregated from Provider/Customer routes.

**Rationale**: Vertical SaaS serving multiple tenants (providers) and roles requires
explicit, auditable access control. Implicit or layered-only checks create privilege
escalation risk.

## Tech Stack & Constraints

**Backend**: Node.js 20+, TypeScript strict mode (no `any`), Express.js —
router-per-domain architecture (`src/routes/`, `src/services/`, `src/models/`).

**Frontend**: ReactJS with Vite, TypeScript strict, Tailwind CSS, React Query
(server state), Zustand (client state), Vietnamese UI.

**Auth**: JWT access tokens + refresh tokens, RBAC enforced via Express middleware
(`authenticate` + `authorize(...roles)`) applied at the router level.

**Payment**: VNPay sandbox (production integration is Phase 2+).

**Storage**: S3-compatible object storage for inspection photos.

**Validation**: `zod` (preferred) or `express-validator` on all request bodies;
validation MUST occur in the route/controller layer, not inside services.

**Naming**:
- Models/Entities: PascalCase singular (`Booking`, `Vehicle`).
- Tables: snake_case plural (`bookings`, `vehicles`, `inspection_records`).
- Request/Response types: `CreateBookingBody`, `BookingResponse` (no "Dto" suffix).
- Enums: SCREAMING_SNAKE_CASE (`BookingStatus.PENDING`, `AssetTier.PREMIUM`).
- Every entity MUST have `created_at`, `updated_at`, and `deleted_at` (soft delete).
- Route files: `booking.routes.ts` | Services: `booking.service.ts` | Models: `booking.model.ts`.

## Development Workflow

**Branches**: `main` (protected, production-ready) → `develop` → `feature/TP<N>-<slug>`.

**Commit format**: `<type>(<scope>): <description>` — e.g.,
`feat(bookings): implement slot extension proposal flow`.

**PR rules**:
- Every PR MUST link to a GitHub Issue.
- PRs changing business logic MUST update the corresponding `docs/spec/` file in the same PR.
- PRs MUST not be merged with failing CI.

**Spec sync**: When any file in `docs/spec/` changes, re-run `/speckit-constitution` to
keep this constitution aligned with the updated business rules.

## Governance

This constitution supersedes informal conventions and ad-hoc decisions. Any amendment
requires: (1) update `docs/spec/` source file, (2) re-run `/speckit-constitution`,
(3) PR with spec + constitution changes together, (4) version bump per semver rules below.

**Versioning**:
- MAJOR: A principle is removed or fundamentally redefined (backward-incompatible governance change).
- MINOR: A new principle or section is added, or existing guidance is materially expanded.
- PATCH: Wording clarifications, typo fixes, non-semantic refinements.

**Compliance**: Every PR author MUST verify their changes do not violate principles I–VI
before requesting review. Reviewers MUST reject PRs that bypass the State Machine Gate
or Snapshot-First Pricing rules regardless of other quality signals.

**Version**: 1.1.0 | **Ratified**: 2026-05-11 | **Last Amended**: 2026-05-11
