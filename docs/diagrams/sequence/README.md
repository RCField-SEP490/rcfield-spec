# Sequence Diagrams — RCField

**Last updated:** 2026-06-08

Các file trong thư mục này mô tả luồng end-to-end ở mức actor/service/database.
Đọc cùng business rules và architecture docs trước khi implement endpoint hoặc test
tích hợp.

| File | Luồng | Đọc khi nào |
|---|---|---|
| [`sequence-flow-booking-lifecycle.md`](./sequence-flow-booking-lifecycle.md) | Booking lifecycle tổng quát: create, payment, check-in, checkout, incident, settlement | Trước khi làm booking/session/payment |
| [`sequence-flow-booking-operations.md`](./sequence-flow-booking-operations.md) | Vận hành tại quán: scan QR, F&B on-site, extension, checkout damage | Trước khi làm Staff app operations |
| [`sequence-flow-contest-lifecycle.md`](./sequence-flow-contest-lifecycle.md) | Contest lifecycle: create/open, register, payment, check-in, race result, complete/cancel | Trước khi làm contest/tournament |
| [`sequence-flow-provider-onboarding-subscription.md`](./sequence-flow-provider-onboarding-subscription.md) | Provider onboarding, subscription, grace/expired jobs | Trước khi làm SaaS subscription/provider guard |
| [`sequence-flow-revenue-payout.md`](./sequence-flow-revenue-payout.md) | Revenue, commission, provider payout | Trước khi làm settlement/payout dashboard |

## Related Architecture Docs

- [`docs/architecture/00-system-overview.md`](../../architecture/00-system-overview.md)
- [`docs/architecture/01-booking-session.md`](../../architecture/01-booking-session.md)
- [`docs/architecture/03-contest.md`](../../architecture/03-contest.md)

