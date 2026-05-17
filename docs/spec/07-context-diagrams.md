# III. Software Requirement Specification

## 1. Product Overview

RCField is a digital operations and booking platform for RC car field businesses in Vietnam. It is designed for one provider or RC field chain with multiple cafe branches, where each branch can manage its own operating hours, pricing, vehicle fleet, service capacity, menu, packages, subscriptions, contests, and promotions through one shared system.

Source:
- `docs/spec/00-overview.md` -> "Bối cảnh": RCField is B2B software for one RC field business/chain with multiple branches.
- `docs/spec/00-overview.md` -> "Giải pháp": multi-branch management and operational core.
- `docs/spec/00-overview.md` -> "Scope / Phase 1": cafe, fleet, F&B, packages, subscriptions, contests, promotions, dispute resolution, staff assignment, cafe operations.

The platform addresses current operational pain points: bookings handled through phone/chat, missing handover evidence, manual fleet tracking, and manual payment calculation. RCField centralizes booking, session operations, fleet status, BYOC vehicles, inspection evidence, incident handling, payment audit trails, notifications, reviews, and trust score logs.

Source:
- `docs/spec/00-overview.md` -> "Pain points hiện tại".
- `docs/spec/00-overview.md` -> "Scope / Phase 1".
- `docs/spec/01-domain-model.md` -> ERD entities: `bookings`, `sessions`, `customer_vehicles`, `inspections`, `incidents`, `payment_components`, `payment_transactions`, `notification_logs`, `trust_score_logs`.

At its core, RCField separates planned booking data from actual operational data. `Booking` stores the reservation plan, planned participants, planned rental vehicles, play mode, slot, promotion, and payment snapshot. `Session` stores the actual play session created at check-in, including actual participants, actual rental/BYOC vehicles, inspections, extension proposals, incidents, and settlement data.

Source:
- `docs/spec/00-overview.md` -> "Kiến trúc dữ liệu cốt lõi".
- `docs/spec/00-overview.md` -> "Operational Core Data Rules".
- `docs/spec/01-domain-model.md` -> `Booking`, `BookingParticipant`, `BookingVehicle`, `Session`, `SessionParticipant`, `SessionVehicle`.
- `docs/diagrams/sequence/sequence-flow-booking-lifecycle.md` -> sections "Tạo Booking" and "Check-in: Booking -> Session".

Phase 1 focuses on the operational core: authentication, cafe/branch management, staff assignment, cafe closures/announcements, fleet, BYOC registry, booking/session lifecycle, inspections, slot extensions, component-based payments, F&B, packages, subscriptions, contests, promotions, incident policy resolution, basic dispute resolution, maintenance logs, reviews, notification logs, trust score logs, and feature flags. Phase 2 is reserved for SaaS tenant billing, multi-party dispute workflow, AI jobs, AI damage detection, AI recommendations, analytics, dynamic pricing, loyalty, and native mobile apps.

Source:
- `docs/spec/00-overview.md` -> "Scope / Phase 1 - Operational Core, bắt buộc".
- `docs/spec/00-overview.md` -> "Phase 2 - Business Expansion + AI/SaaS".
- `docs/spec/01-domain-model.md` -> "Phase 2 Entities".

## 2. Source Traceability Summary

| Content in this file | Source file | Source section |
|---|---|---|
| Product overview and business context | `docs/spec/00-overview.md` | "Bối cảnh", "Giải pháp", "Scope" |
| Actor list and target apps | `docs/spec/00-overview.md`, `docs/architecture/00-system-overview.md` | "Actors", "Actor & App Matrix" |
| System boundary and external systems | `docs/architecture/00-system-overview.md` | "System Context", "Container Diagram", "External Integrations" |
| Booking/session separation | `docs/spec/00-overview.md`, `docs/spec/01-domain-model.md` | "Kiến trúc dữ liệu cốt lõi", `Booking`, `Session` entities |
| Operational modules in diagrams | `docs/spec/00-overview.md`, `docs/spec/01-domain-model.md` | "Phase 1", ERD and core entities |
| Booking lifecycle and main flow | `docs/diagrams/sequence/sequence-flow-booking-lifecycle.md`, `docs/spec/02-state-machine.md` | Booking lifecycle sequence, booking/session state machines |
| Payment flow and settlement | `docs/spec/03-payment-engine.md`, `docs/architecture/00-system-overview.md` | Payment components, platform fee, payment gateway flow |
| Inspection and evidence flow | `docs/spec/04-inspection-flow.md` | Check-in flow, check-out flow, photo storage |
| Incident and dispute flow | `docs/spec/01-domain-model.md`, `docs/spec/business-rules/BR-dispute.md`, `docs/spec/04-inspection-flow.md` | Incident policy resolution, basic dispute, Admin resolution |
| API-level responsibilities | `docs/spec/05-api-contracts.md` | Auth, cafes, bookings, sessions, inspections, extensions, incidents, F&B, packages/subscriptions/contests |

## 3. System Context Diagram

The diagram below shows RCField as one central platform interacting with four actor groups and the required external/supporting systems.

Source:
- Actors: `docs/spec/00-overview.md` -> "Actors"; `docs/architecture/00-system-overview.md` -> "Actor & App Matrix".
- External systems: `docs/architecture/00-system-overview.md` -> "System Context", "Container Diagram".
- Scheduler/timeouts: `docs/spec/02-state-machine.md` -> "Timeout Rules"; `docs/architecture/00-system-overview.md` -> Scheduler container.

Note: this diagram stays at context level. It groups small API actions into business capabilities so the system boundary remains readable.

```mermaid
flowchart TB
    customer["Customer<br>Web mobile-first"]
    staff["Staff<br>Web mobile-first"]
    provider["Provider<br>Web desktop/tablet"]
    admin["Admin<br>Admin web portal"]

    rcfield(("RCField Platform<br>RC car field operations<br>and booking system"))

    payment["Payment Gateway<br>VNPay / MoMo / VietQR"]
    storage["Cloudinary<br>Inspection photo storage"]
    notify["Push / SMS / Email<br>Notification provider"]
    scheduler["Scheduler<br>Timeout and auto-confirm jobs"]

    customer -->|"Authenticate account"| rcfield
    rcfield -->|"Return authentication result"| customer
    customer -->|"Discover cafes, menu, packages, contests"| rcfield
    rcfield -->|"Return discovery results"| customer
    customer -->|"Manage BYOC vehicle profile"| rcfield
    rcfield -->|"Return BYOC profile status"| customer
    customer -->|"Create rental, BYOC, or mixed booking"| rcfield
    rcfield -->|"Return booking creation result"| customer
    customer -->|"Cancel booking before active session"| rcfield
    rcfield -->|"Return cancellation result"| customer
    customer -->|"Purchase package, create subscription, register contest"| rcfield
    rcfield -->|"Return package, subscription, contest result"| customer
    customer -->|"Pay booking, rental, deposit, F&B pre-order"| rcfield
    rcfield -->|"Return payment result"| customer
    customer -->|"Confirm inspections and respond to extensions"| rcfield
    rcfield -->|"Return inspection and extension status"| customer
    customer -->|"Raise incident or submit review"| rcfield
    rcfield -->|"Return incident and review result"| customer
    customer -->|"Open formal dispute"| rcfield
    rcfield -->|"Return dispute status"| customer

    staff -->|"Create manual booking or shareable link"| rcfield
    rcfield -->|"Return manual booking or link result"| staff
    staff -->|"Cancel booking by operation policy"| rcfield
    rcfield -->|"Return staff cancellation result"| staff
    staff -->|"Check-in/out and create actual sessions"| rcfield
    rcfield -->|"Return check-in/out session status"| staff
    staff -->|"Record actual participants and vehicles"| rcfield
    rcfield -->|"Return participants and vehicles status"| staff
    staff -->|"Submit inspection photos and checklist"| rcfield
    rcfield -->|"Return inspection submission result"| staff
    staff -->|"Create F&B on-site order or propose extension"| rcfield
    rcfield -->|"Return F&B order or extension result"| staff
    staff -->|"Support authorized menu, subscription, contest operations"| rcfield
    rcfield -->|"Return authorized operation result"| staff
    staff -->|"Report damage and log incident"| rcfield
    rcfield -->|"Return damage and incident result"| staff
    staff -->|"Open dispute by operation policy"| rcfield
    rcfield -->|"Return staff dispute status"| staff
    staff -->|"Publish authorized cafe announcement"| rcfield
    rcfield -->|"Return announcement status"| staff

    provider -->|"Manage branches, profiles, operating hours, slots, pricing"| rcfield
    rcfield -->|"Return branch and pricing status"| provider
    provider -->|"Manage staff assignments, closures, announcements"| rcfield
    rcfield -->|"Return staff and cafe ops status"| provider
    provider -->|"Manage fleet, maintenance, vehicle status"| rcfield
    rcfield -->|"Return fleet and maintenance status"| provider
    provider -->|"Manage menu, packages, contests"| rcfield
    rcfield -->|"Return commerce management status"| provider
    provider -->|"Manage promotions and usage audit"| rcfield
    rcfield -->|"Return promotion audit status"| provider
    provider -->|"Cancel booking before active session"| rcfield
    rcfield -->|"Return provider cancellation result"| provider
    provider -->|"View revenue, settlement, reviews, incidents, disputes"| rcfield
    rcfield -->|"Return revenue, settlement, review, incident, dispute data"| provider

    admin -->|"Activate or suspend cafes"| rcfield
    rcfield -->|"Return cafe moderation status"| admin
    admin -->|"Manage users, roles, feature flags"| rcfield
    rcfield -->|"Return user, role, feature flag status"| admin
    admin -->|"Monitor incidents and policy resolution"| rcfield
    rcfield -->|"Return incident and policy monitoring data"| admin
    admin -->|"Resolve formal disputes"| rcfield
    rcfield -->|"Return dispute resolution result"| admin
    admin -->|"Manage staff assignments and cafe operations"| rcfield
    rcfield -->|"Return staff and cafe ops status"| admin
    admin -->|"Audit platform activity and system configuration"| rcfield
    rcfield -->|"Return audit and configuration data"| admin

    rcfield -->|"Create payment URL"| payment
    payment -->|"Return payment URL"| rcfield
    rcfield -->|"Verify payment status"| payment
    payment -->|"Return verified payment status and transaction id"| rcfield
    payment -->|"Send payment callback"| rcfield
    rcfield -->|"Return callback acknowledgment"| payment
    rcfield -->|"Request refund"| payment
    payment -->|"Return refund result"| rcfield
    rcfield -->|"Request capture"| payment
    payment -->|"Return capture result"| rcfield
    rcfield -->|"Request settlement"| payment
    payment -->|"Return settlement result"| rcfield

    rcfield -->|"Upload check-in inspection photos"| storage
    storage -->|"Return check-in photo URLs"| rcfield
    rcfield -->|"Upload check-out inspection photos"| storage
    storage -->|"Return check-out photo URLs"| rcfield

    rcfield -->|"Send booking alerts"| notify
    notify -->|"Return booking delivery status"| rcfield
    rcfield -->|"Send inspection alerts"| notify
    notify -->|"Return inspection delivery status"| rcfield
    rcfield -->|"Send extension alerts"| notify
    notify -->|"Return extension delivery status"| rcfield
    rcfield -->|"Send incident alerts"| notify
    notify -->|"Return incident delivery status"| rcfield
    rcfield -->|"Send dispute alerts"| notify
    notify -->|"Return dispute delivery status"| rcfield
    rcfield -->|"Send timeout alerts"| notify
    notify -->|"Return timeout delivery status"| rcfield

    scheduler -->|"Trigger payment timeout"| rcfield
    rcfield -->|"Return payment timeout transition result"| scheduler
    scheduler -->|"Trigger no-show"| rcfield
    rcfield -->|"Return no-show transition result"| scheduler
    scheduler -->|"Trigger auto-confirm"| rcfield
    rcfield -->|"Return auto-confirm result"| scheduler
    scheduler -->|"Trigger checkout timeout"| rcfield
    rcfield -->|"Return checkout timeout result"| scheduler
    scheduler -->|"Release expired slot locks"| rcfield
    rcfield -->|"Return slot release result"| scheduler
    scheduler -->|"Trigger promo rollback"| rcfield
    rcfield -->|"Return promo rollback result"| scheduler
```

## 4. Context Data Flow Diagram

The diagram below groups the same context by data flow: business inputs from actors, operational outputs from RCField, and external system exchanges.

Source:
- Operational core modules: `docs/spec/00-overview.md` -> "Phase 1"; `docs/architecture/00-system-overview.md` -> "Domain Modules".
- Data entities: `docs/spec/01-domain-model.md` -> ERD and core entities.
- Lifecycle flow: `docs/diagrams/sequence/sequence-flow-booking-lifecycle.md`.

```mermaid
flowchart LR
    customer["Customer"]
    staff["Staff"]
    provider["Provider"]
    admin["Admin"]
    payment["Payment Gateway"]
    storage["Cloudinary"]
    notify["Notification Provider"]
    scheduler["Scheduler"]

    rcfield(("RCField Operational Core<br>Auth, Cafe, Staff Ops, Booking, Session,<br>Fleet, BYOC, Inspection, Payment, F and B,<br>Package, Subscription, Contest,<br>Promotion, Incident, Dispute, Trust"))

    customer -->|"Auth, cafe discovery, BYOC profile, booking request, participants, rental or BYOC mode"| rcfield
    rcfield -->|"Available slots, cafe profile, booking detail, session status"| customer
    customer -->|"Package purchase, subscription request, contest registration"| rcfield
    customer -->|"Payment confirmation, inspection confirmation, review, incident response, dispute request"| rcfield
    rcfield -->|"Payment result, refund status, evidence, extension request, dispute status"| customer

    staff -->|"Manual booking, shareable link, actual participants, actual vehicles, multiple sessions"| rcfield
    staff -->|"Check-in or check-out, F and B order, extension proposal"| rcfield
    staff -->|"Inspection checklist, damage report, incident input, dispute input, announcement data"| rcfield
    rcfield -->|"Booking queue, session state, inspection baseline, policy guidance, dispute status"| staff

    provider -->|"Branch setup, fleet setup, maintenance, menu data"| rcfield
    provider -->|"Staff assignment, closure, announcement, package, contest, promotion data"| rcfield
    rcfield -->|"Revenue, settlements, fleet utilization, reviews, incident and dispute summaries"| provider

    admin -->|"Cafe approval, user control, feature flag, incident supervision, dispute resolution, staff/cafe ops"| rcfield
    rcfield -->|"Audit logs, trust score logs, platform monitoring data, dispute resolution result"| admin

    rcfield -->|"Payment amount, booking snapshot, transaction verify request"| payment
    payment -->|"Callback, gateway transaction id, payment status"| rcfield

    rcfield -->|"Inspection image files and metadata"| storage
    storage -->|"Photo URLs for evidence records"| rcfield

    rcfield -->|"Notification event payloads"| notify
    notify -->|"Sent or failed delivery logs"| rcfield

    scheduler -->|"Timeout event, no-show event, auto-confirm event, checkout timeout, slot release, rollback event"| rcfield
    rcfield -->|"Job schedule, transition result, audit log"| scheduler
```

## 5. Actors And External Systems

| Element | Type | Main responsibility | Source |
|---|---|---|---|
| Customer | Actor | Books RC play sessions, pays online, manages BYOC profile, confirms inspections, responds to extensions/incidents, opens disputes, and submits reviews. | `docs/spec/00-overview.md` -> Actors; `docs/spec/05-api-contracts.md` -> Bookings, Inspections, Extensions; `docs/spec/business-rules/BR-dispute.md` |
| Staff | Actor | Handles manual bookings, check-in/check-out, inspections, actual participants/vehicles, F&B on-site orders, extension proposals, damage reports, incident records, dispute input, and authorized cafe announcements. | `docs/spec/00-overview.md` -> Actors; `docs/spec/04-inspection-flow.md`; `docs/spec/05-api-contracts.md`; `docs/spec/business-rules/BR-dispute.md` |
| Provider | Actor | Manages branches, staff assignments, cafe closures/announcements, fleet, pricing, menu, packages, contests, promotions, revenue, reviews, incidents, and maintenance. | `docs/spec/00-overview.md` -> Actors/Scope; `docs/spec/01-domain-model.md` -> Cafe, Vehicle, Package, Contest, Promotion; `docs/spec/06-database.md` -> staff/cafe ops tables |
| Admin | Actor | Manages platform governance, cafe approval, users, roles, feature flags, staff/cafe operations, audit logs, trust logs, notification logs, incident supervision, and formal dispute resolution. | `docs/spec/00-overview.md` -> Actors/Scope; `docs/spec/05-api-contracts.md` -> Cafes, Incidents; `docs/spec/business-rules/BR-dispute.md` |
| Payment Gateway | External system | Creates payment URLs, verifies callbacks, provides transaction ids/status, and supports refund/capture/settlement operations. | `docs/architecture/00-system-overview.md` -> External Integrations; `docs/spec/03-payment-engine.md` |
| Cloudinary | External system | Stores check-in/check-out inspection photos and returns URLs for evidence records. | `docs/architecture/00-system-overview.md` -> System Context; `docs/spec/04-inspection-flow.md` -> Photo Storage |
| Notification Provider | External system | Sends booking, payment, inspection, extension, timeout, and incident notifications; returns delivery logs. | `docs/architecture/00-system-overview.md` -> Container Diagram; `docs/spec/01-domain-model.md` -> `notification_logs` |
| Scheduler | Internal supporting system | Runs payment timeout, no-show, inspection auto-confirm, extension timeout, checkout timeout, slot release, and promotion rollback jobs. | `docs/spec/02-state-machine.md` -> Timeout Rules; `docs/spec/business-rules/BR-promotions.md` -> promo rollback; `docs/architecture/00-system-overview.md` -> Scheduler |

## 6. Coverage Validation

### 6.1 Phase 1 Scope Checklist

| Phase 1 item | Covered in diagram | Evidence in diagram | Source |
|---|---|---|---|
| Auth, refresh token, reset password | Yes | Customer -> RCField auth actions | `docs/spec/00-overview.md` -> Phase 1; `docs/spec/05-api-contracts.md` -> Auth |
| Cafe/branch management | Yes | Customer browses cafes; Provider manages branches; Admin activates/suspends cafes | `docs/spec/00-overview.md` -> Phase 1; `docs/spec/05-api-contracts.md` -> Cafes |
| Staff assignment | Yes | Provider/Admin manage staff assignments; Staff operations are tied to authorized cafe scope | `docs/spec/00-overview.md`; `docs/spec/04-inspection-flow.md`; `docs/spec/06-database.md` -> `staff_cafe_assignments` |
| Cafe closures and announcements | Yes | Provider/Admin manage closures; Provider/Staff publish announcements | `docs/spec/00-overview.md`; `docs/spec/06-database.md` -> `cafe_closures`, `cafe_announcements` |
| Vehicle fleet management | Yes | Provider manages fleet/status; Staff records actual vehicles | `docs/spec/00-overview.md`; `docs/spec/01-domain-model.md` -> Vehicle |
| BYOC vehicle registry | Yes | Customer registers BYOC vehicle profile | `docs/spec/00-overview.md`; `docs/spec/01-domain-model.md` -> CustomerVehicle |
| Booking lifecycle for rental, BYOC, mixed | Yes | Customer creates rental/BYOC/mixed booking; Customer/Provider/Staff cancellation is represented; Scheduler handles timeout/no-show | `docs/spec/00-overview.md`; `docs/spec/02-state-machine.md`; `docs/spec/business-rules/BR-booking.md` |
| Multi-vehicle booking | Yes | Customer adds vehicles; Staff records actual vehicles | `docs/spec/01-domain-model.md` -> BookingVehicle, SessionVehicle |
| Planned and actual participants | Yes | Customer adds planned participants; Staff records actual participants | `docs/spec/00-overview.md`; `docs/spec/01-domain-model.md` |
| Multiple sessions per booking | Yes | Staff creates one or more actual sessions | `docs/spec/01-domain-model.md` -> Session; `docs/spec/02-state-machine.md` |
| Actual vehicles through session vehicles | Yes | Staff records actual vehicles | `docs/spec/01-domain-model.md` -> SessionVehicle |
| Check-in/check-out inspection with photos and checklist | Yes | Staff uploads photos/checklist; Cloudinary stores photos | `docs/spec/04-inspection-flow.md` |
| Slot extension proposal | Yes | Staff proposes extension; Customer approves/rejects | `docs/spec/02-state-machine.md`; `docs/spec/05-api-contracts.md` -> Extensions |
| Component-based payment and gateway transaction log | Yes | Payment Gateway exchanges transaction id/status | `docs/spec/03-payment-engine.md`; `docs/spec/01-domain-model.md` -> PaymentComponent, PaymentTransaction |
| F&B menu, pre-order, on-site order | Yes | Customer browses/pre-orders; Staff creates on-site order; Provider/authorized Staff manage menu | `docs/spec/00-overview.md`; `docs/spec/05-api-contracts.md` -> F&B; `docs/spec/business-rules/BR-fnb.md` |
| Packages and usage history | Yes | Customer purchases package; Provider manages packages | `docs/spec/01-domain-model.md` -> Package, CustomerPackage, PackageUsage |
| Subscriptions generating bookings | Yes | Customer or Staff creates subscription request | `docs/spec/01-domain-model.md` -> Subscription; `docs/spec/05-api-contracts.md` -> POST `/subscriptions` |
| Contests and registration | Yes | Customer registers contest; Provider manages contests | `docs/spec/01-domain-model.md` -> Contest, ContestRegistration |
| Promotions and usage audit | Yes | Provider creates promotions and views usage audit | `docs/spec/01-domain-model.md` -> Promotion, PromotionUsage; `docs/spec/business-rules/BR-promotions.md` |
| Incident logging and policy resolution | Yes | Customer raises incident; Staff logs incident; Admin monitors resolution | `docs/spec/01-domain-model.md` -> Incident; `docs/spec/04-inspection-flow.md` |
| Basic formal dispute resolution | Yes | Customer/Staff can open dispute; Admin resolves dispute based on evidence | `docs/spec/01-domain-model.md` -> Dispute; `docs/spec/business-rules/BR-dispute.md`; `docs/spec/04-inspection-flow.md` |
| Vehicle maintenance logs | Yes | Provider manages maintenance and vehicle status | `docs/spec/00-overview.md`; `docs/spec/01-domain-model.md` -> vehicle maintenance logs |
| Reviews | Yes | Customer reviews; Provider views reviews | `docs/spec/00-overview.md`; `docs/spec/01-domain-model.md` -> reviews |
| Notification logs | Yes | Notification provider returns delivery logs; Admin sees notification logs | `docs/spec/01-domain-model.md` -> notification_logs |
| Trust score and trust score audit | Yes | Customer receives trust score; Admin receives trust score logs | `docs/spec/01-domain-model.md` -> User.trust_score, trust_score_logs |
| Feature flags | Yes | Admin manages feature flags | `docs/spec/00-overview.md`; `docs/spec/01-domain-model.md` -> FeatureFlag |

### 6.2 Main Flow Walkthrough

| Step | Main flow | Covered | Source |
|---|---|---|---|
| 1 | Customer browses cafes, packages, contests, and menu. | Yes | `docs/spec/05-api-contracts.md` -> Cafes, Packages, Contests, F&B |
| 2 | Customer creates booking with play mode, participants, vehicles, and optional F&B pre-order. | Yes | `docs/diagrams/sequence/sequence-flow-booking-lifecycle.md` -> "Tạo Booking"; `docs/spec/05-api-contracts.md` -> POST `/bookings` |
| 3 | RCField creates payment URL through Payment Gateway. | Yes | `docs/architecture/00-system-overview.md` -> Payment Gateway flow |
| 4 | Payment Gateway returns callback, transaction id, and payment status. | Yes | `docs/spec/03-payment-engine.md`; `docs/diagrams/sequence/sequence-flow-booking-lifecycle.md` -> "Thanh Toán" |
| 5 | Staff opens confirmed booking and creates one or more actual sessions. | Yes | `docs/spec/04-inspection-flow.md`; `docs/spec/02-state-machine.md` |
| 6 | Staff records actual participants and actual rental/BYOC vehicles. | Yes | `docs/spec/01-domain-model.md` -> SessionParticipant, SessionVehicle |
| 7 | Staff uploads check-in inspection photos and checklist to Cloudinary. | Yes | `docs/spec/04-inspection-flow.md` -> CHECK-IN Flow, Photo Storage |
| 8 | Customer confirms check-in evidence or Scheduler auto-confirms. | Yes | `docs/spec/04-inspection-flow.md`; `docs/spec/02-state-machine.md` -> Timeout Rules |
| 9 | Session becomes active; Staff can add F&B on-site order or propose extension. | Yes | `docs/spec/02-state-machine.md`; `docs/spec/05-api-contracts.md` -> F&B, Extensions |
| 10 | Customer approves/rejects extension; Notification Provider carries alerts. | Yes | `docs/spec/02-state-machine.md`; `docs/spec/05-api-contracts.md` -> Extensions |
| 11 | Staff performs check-out inspection and records damage if any. | Yes | `docs/spec/04-inspection-flow.md` -> CHECK-OUT Flow |
| 12 | Customer confirms check-out, raises incident, or opens a formal dispute. | Yes | `docs/spec/04-inspection-flow.md`; `docs/spec/05-api-contracts.md` -> Incidents; `docs/spec/business-rules/BR-dispute.md` |
| 13 | Staff/Admin resolves incident by policy; Admin resolves formal dispute when needed. | Yes | `docs/spec/01-domain-model.md` -> Incident Policy Resolution & Disputes; `docs/spec/05-api-contracts.md` -> Incidents |
| 14 | RCField settles payment, refund/capture, and provider payout through payment records. | Yes | `docs/spec/03-payment-engine.md`; `docs/diagrams/sequence/sequence-flow-booking-lifecycle.md` -> Completion |
| 15 | Provider views revenue, settlements, reviews, fleet utilization, and incidents. | Yes | `docs/spec/00-overview.md` -> Actors/Scope |
| 16 | Admin audits platform health, feature flags, users, incidents, disputes, trust score logs, and notification logs. | Yes | `docs/spec/00-overview.md`; `docs/spec/01-domain-model.md` -> FeatureFlag, TrustScoreLog, NotificationLog, Dispute |

### 6.3 Actor Coverage Check

| Actor | Expected responsibility | Covered | Source |
|---|---|---|---|
| Customer | Browse cafes, create/cancel bookings, manage BYOC, pay, buy packages, create subscriptions, register contests, confirm inspections, respond to extensions/incidents, open disputes, review. | Yes | `docs/spec/00-overview.md` -> Actors/Scope; `docs/spec/05-api-contracts.md`; `docs/spec/business-rules/BR-booking.md`; `docs/spec/business-rules/BR-dispute.md` |
| Staff | Manual booking/shareable link, operation-policy cancellation, check-in/out, actual participants, actual vehicles, inspection, F&B on-site, extension proposal, damage report, incident log, dispute input, authorized menu/subscription/contest/announcement operations. | Yes | `docs/spec/00-overview.md` -> Booking channels/Actors; `docs/spec/04-inspection-flow.md`; `docs/spec/05-api-contracts.md`; `docs/spec/business-rules/BR-fnb.md`; `docs/spec/business-rules/BR-dispute.md` |
| Provider | Manage branches, operating hours, pricing, staff assignments, cafe closures/announcements, fleet, maintenance, menu, packages, contests, promotions, booking cancellation, revenue, reviews, incidents/disputes. | Yes | `docs/spec/00-overview.md` -> Actors/Scope; `docs/spec/01-domain-model.md`; `docs/spec/business-rules/BR-booking.md` |
| Admin | Activate/suspend cafes, manage users, roles, feature flags, staff/cafe operations, audit logs, notification logs, trust score logs, incident policy supervision, formal dispute resolution. | Yes | `docs/spec/00-overview.md` -> Actors/Scope; `docs/spec/05-api-contracts.md`; `docs/spec/business-rules/BR-dispute.md` |

## 7. Notes On Diagram Scope

This file is a context-level SRS artifact. It intentionally does not model internal containers such as Web App, API Server, PostgreSQL, or Redis in detail. Those belong to `docs/architecture/00-system-overview.md` and the sequence/API/domain documents.

Source:
- `docs/architecture/00-system-overview.md` -> "Container Diagram".
- `docs/spec/05-api-contracts.md` -> REST API surface.
- `docs/spec/01-domain-model.md` -> detailed entity model.

## 8. Spec Consistency Notes

The context diagram now follows the latest Phase 1 scope from `docs/spec/00-overview.md`, `docs/spec/01-domain-model.md`, `docs/spec/04-inspection-flow.md`, and the business-rule files. A few source documents still need alignment:

| Topic | Current conflict | Impact on diagram |
|---|---|---|
| Staff booking cancellation | `docs/spec/business-rules/BR-booking.md` allows Provider or Staff cancellation, but `docs/spec/05-api-contracts.md` lists `/bookings/:id/cancel` as CUSTOMER/PROVIDER only. | Diagram includes Staff cancellation because business rules require it. |
| Basic dispute API | `docs/spec/00-overview.md`, `docs/spec/01-domain-model.md`, `docs/spec/04-inspection-flow.md`, and `BR-dispute.md` define Phase 1 dispute behavior, but `docs/spec/05-api-contracts.md` has no dispute endpoints. | Diagram includes dispute at context level; API contract should add or explicitly defer dispute endpoints. |
| Staff assignment and cafe operations | `docs/spec/00-overview.md` says Phase 1 includes staff assignment and cafe operations. `docs/spec/06-database.md` both lists `staff_cafe_assignments`, `cafe_closures`, `cafe_announcements` in the 41 Phase 1 tables and also says staff/cafe ops are not Phase 1 in another section. | Diagram includes these as Phase 1 because the latest overview and table list include them, but `06-database.md` should be cleaned up. |
