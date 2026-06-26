# Sequence Diagrams - RCField

**Last updated:** 2026-06-27

Cac file trong thu muc nay mo ta luong end-to-end o muc actor/service/database.
Doc cung business rules va architecture docs truoc khi implement endpoint hoac test
tich hop.

| File | Luong | Doc khi nao |
|---|---|---|
| [`sequence-flow-booking-lifecycle.md`](./sequence-flow-booking-lifecycle.md) | Booking lifecycle tong quat: create, payment, check-in, checkout, incident, settlement | Truoc khi lam booking/session/payment |
| [`sequence-flow-booking-operations.md`](./sequence-flow-booking-operations.md) | Van hanh tai quan: scan QR, F&B on-site, extension, checkout damage | Truoc khi lam Staff app operations |
| [`sequence-flow-contest-lifecycle.md`](./sequence-flow-contest-lifecycle.md) | Contest lifecycle: create/open, register, payment, check-in, race result, complete/cancel | Truoc khi lam contest/tournament |
| [`sequence-flow-contest-vehicle-operations.md`](./sequence-flow-contest-vehicle-operations.md) | Contest vehicle operations: booking-linked rental, BYOC review, check-in, correction, leaderboard guard | Truoc khi lam luong xe contest, review hoac match ops |
| [`sequence-flow-provider-onboarding-subscription.md`](./sequence-flow-provider-onboarding-subscription.md) | Provider onboarding, subscription, grace/expired jobs | Truoc khi lam SaaS subscription/provider guard |
| [`sequence-flow-revenue-payout.md`](./sequence-flow-revenue-payout.md) | Revenue, commission, provider payout | Truoc khi lam settlement/payout dashboard |

## Related Architecture Docs

- [`docs/architecture/00-system-overview.md`](../../architecture/00-system-overview.md)
- [`docs/architecture/01-booking-session.md`](../../architecture/01-booking-session.md)
- [`docs/architecture/03-contest.md`](../../architecture/03-contest.md)
