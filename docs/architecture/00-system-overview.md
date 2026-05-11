# Architecture: System Overview

**Last updated**: 2026-05-11
**Status**: Draft — đang hoàn thiện dần

> Tài liệu này mô tả kiến trúc tổng thể của RCField ở mức system level.
> Đọc `docs/spec/00-overview.md` để hiểu business context trước.

> **Scope reminder**: RCField chỉ quản lý vận hành xe RC — đặt lịch, fleet, bàn giao tài sản, thanh toán.
> F&B / đồ uống tại sân **nằm ngoài app** — khách tự thanh toán trực tiếp tại quán.

---

## 1. System Context (C4 Level 1)

Toàn bộ hệ thống RCField gồm 1 platform phục vụ 4 nhóm actor, tương tác qua Web App duy nhất,
tích hợp với 2 external system (VNPay, S3).

```mermaid
C4Context
    title System Context — RCField Platform

    Person(customer, "Customer", "Đặt lịch, thuê xe / BYOC, thanh toán, xác nhận check-in/out")
    Person(staff, "Staff", "Check-in/out, đề xuất gia hạn, upload ảnh bằng chứng")
    Person(provider, "Provider", "Quản lý quán, đội xe, xem analytics")
    Person(admin, "Admin", "Duyệt quán, xử lý dispute, monitor platform")

    System(rcfield, "RCField Platform", "Web SaaS: booking, fleet, inspection, payment cho sân xe RC. KHÔNG bao gồm F&B.")

    System_Ext(vnpay, "VNPay Gateway", "Xử lý thanh toán trực tuyến (sandbox)")
    System_Ext(s3, "S3-compatible Storage", "Lưu ảnh check-in/out (4 góc per inspection)")

    Rel(customer, rcfield, "Đặt lịch, thanh toán, xác nhận")
    Rel(staff, rcfield, "Check-in/out, gia hạn, upload ảnh")
    Rel(provider, rcfield, "Quản lý fleet, xem doanh thu")
    Rel(admin, rcfield, "Duyệt cafe, xử lý dispute")
    Rel(rcfield, vnpay, "Tạo payment URL, verify callback")
    Rel(rcfield, s3, "Upload & retrieve inspection photos")
```

---

## 2. Actor & App Matrix

| Actor | Role | App | Device target | Permissions |
|-------|------|-----|--------------|-------------|
| Customer | Đặt lịch / thanh toán | Web (mobile-first) | Mobile browser | CUSTOMER role |
| Staff | Check-in/out, gia hạn | Web (mobile-first) | Mobile browser | STAFF role |
| Provider | Quản lý quán + fleet | Web | Desktop/tablet | PROVIDER role |
| Admin | Platform oversight | Web (admin portal) | Desktop | ADMIN role |

> Tất cả 4 actor dùng chung 1 React web app — routing và UI render dựa trên `UserRole` từ JWT.

---

## 3. Container Diagram (C4 Level 2)

```mermaid
C4Container
    title Container Diagram — RCField Platform

    Person(user, "All Actors", "Customer / Staff / Provider / Admin")

    Container_Boundary(rcfield, "RCField Platform") {
        Container(web, "Web App", "ReactJS + TypeScript + Tailwind", "SPA mobile-first. Role-based UI routing.")
        Container(api, "API Server", "Node.js 20 + Express + TypeScript", "REST API. JWT auth. Business logic. State machine.")
        ContainerDb(db, "PostgreSQL", "TypeORM", "Tất cả entity: User, Cafe, Booking, Payment, Inspection, Dispute")
        Container(scheduler, "Scheduler", "Node.js cron jobs", "Timeout rules: PENDING 30m, no-show 30m, checkout 2h/24h, dispute 72h")
    }

    System_Ext(vnpay, "VNPay", "Payment gateway")
    System_Ext(s3, "S3 Storage", "Photo storage")
    System_Ext(notify, "Push/SMS", "Notification (optional)")

    Rel(user, web, "Dùng app", "HTTPS")
    Rel(web, api, "API calls", "REST / JSON")
    Rel(api, db, "Read/write", "TypeORM")
    Rel(api, vnpay, "Create payment URL + verify callback", "HTTPS")
    Rel(api, s3, "Upload/get inspection photos", "S3 API")
    Rel(api, notify, "Push notifications", "HTTPS")
    Rel(scheduler, api, "Trigger timeout transitions", "Internal")
```

---

## 4. Domain Modules

Hệ thống chia thành 7 module theo domain, mỗi module có router + controller + service riêng.

```mermaid
graph TD
    subgraph Core["Core Modules"]
        AUTH["Auth\n/auth\nJWT, register, login, refresh"]
        BOOKING["Booking\n/bookings\nLifecycle + State Machine"]
        PAYMENT["Payment\n(internal service)\nComponent lifecycle + settlement"]
    end

    subgraph Operations["Operations Modules"]
        FLEET["Fleet\n/cafes/:id/vehicles\nVehicle CRUD, tier, status"]
        INSPECTION["Inspection\n/bookings/:id/inspections\nCheck-in/out, photos, checklist"]
        EXTENSION["Extension\n/bookings/:id/extensions\nPropose, approve, reject"]
        DISPUTE["Dispute\n/bookings/:id/disputes\nOpen, resolve (Admin)"]
    end

    subgraph Discovery["Discovery Modules"]
        CAFE["Cafe\n/cafes\nListing, filter, profile"]
    end

    AUTH --> BOOKING
    BOOKING --> PAYMENT
    BOOKING --> INSPECTION
    BOOKING --> EXTENSION
    BOOKING --> DISPUTE
    CAFE --> FLEET
    FLEET --> BOOKING
```

---

## 5. Tech Stack

### Backend (`rcfield-app/apps/api`)

| Layer | Technology | Ghi chú |
|-------|-----------|---------|
| Runtime | Node.js 20+ | LTS |
| Language | TypeScript strict mode | `noImplicitAny`, strict null checks |
| Framework | Express.js | Router-per-domain architecture |
| ORM | TypeORM | Entity-based, migration-first |
| Database | PostgreSQL | Tất cả data — không dùng NoSQL |
| Auth | JWT + RBAC | 5 roles: CUSTOMER, PROVIDER, STAFF, ADMIN, PLATFORM |
| Validation | zod hoặc express-validator | Bắt buộc trên mọi request body |
| Payment | VNPay sandbox | Verify server-side signature |
| Storage | S3-compatible | 4 ảnh per inspection record |
| Jobs | node-cron | Timeout rules (PENDING 30m, no-show, dispute 72h) |

### Frontend (`rcfield-app/apps/web`)

| Layer | Technology | Ghi chú |
|-------|-----------|---------|
| Framework | ReactJS | Vite build |
| Language | TypeScript strict mode | |
| Styling | Tailwind CSS | Mobile-first |
| Server state | React Query | Fetch, cache, invalidate API data |
| Client state | Zustand | Auth session, UI state |
| HTTP client | Axios | Centralized API client |
| Language | Vietnamese | Toàn bộ UI tiếng Việt |

---

## 6. Data Flow — Booking Lifecycle (tóm tắt)

```mermaid
flowchart TD
    A([Customer tạo booking]) --> B[POST /bookings\nSnapshot giá vào DB]
    B --> C{Thanh toán VNPay}
    C -->|Thành công| D[Tạo PaymentComponents\nSLOT_FEE + RENTAL_FEE + DEPOSIT → HELD]
    C -->|Thất bại / 30m timeout| E([CANCELLED\nRefund 100%])
    D --> F[Staff Check-in\n4 ảnh + checklist → S3]
    F --> G([ACTIVE])
    G -->|Optional| H[Staff đề xuất gia hạn\n→ Customer approve/reject]
    H --> G
    G --> I[Staff Check-out\n4 ảnh + damage flag]
    I -->|No damage| J[Customer confirm / 2h auto]
    I -->|Có damage| K{Customer quyết định}
    K -->|Xác nhận| J
    K -->|Dispute| L[Admin xét xử\ndựa trên evidence ảnh]
    L --> J
    J --> M([COMPLETED\nPaymentEngine settle\nDisburse → Provider\nRefund → Customer])
```

---

## 7. Security & Auth

```
Request → JWT Middleware → RBAC Guard → Controller → Service
              │                │
              │                └─ Kiểm tra role (CUSTOMER/PROVIDER/STAFF/ADMIN)
              └─ Verify token, extract userId + role
```

- **JWT**: access token (short-lived) + refresh token
- **RBAC**: mỗi endpoint khai báo role được phép, guard reject 403 nếu không đủ quyền
- **Trust score**: Customer có `trust_score` (0–100, default 100) — ảnh hưởng eligibility thuê xe RESTRICTED tier
- **Snapshot**: giá được lock vào `booking.snapshot` lúc tạo — không thể thay đổi sau đó

---

## 8. External Integrations

### VNPay

```
Customer                Web App             API Server            VNPay
   │──── chọn thanh toán ──>│                   │                   │
   │                        │── POST /bookings ─>│                   │
   │                        │<── paymentUrl ─────│── tạo URL ────────│
   │<─── redirect to URL ───│                   │                   │
   │──────────────────────────────────────────────────────────────── thanh toán
   │                        │<── redirect + params ─────────────────│
   │                        │── POST /payment/confirm ──>│          │
   │                        │                   │── verify signature ─>│
   │                        │                   │<── valid ──────────│
   │                        │<─── CONFIRMED ────│                   │
```

> ⚠️ Cần xem xét thêm VNPay IPN (server-to-server callback) để handle trường hợp Customer
> đóng browser giữa chừng sau khi thanh toán thành công. Xem Open Questions trong sequence diagram.

### S3 Storage

- Path convention: `inspections/{booking_id}/{check_in|check_out}/{angle}.jpg`
- 4 angles bắt buộc: `front`, `back`, `left`, `right`
- Upload trước khi ghi DB — nếu upload thất bại, reject toàn bộ inspection request

---

## 9. Key Architectural Decisions

| Quyết định | Lý do | Tham khảo |
|-----------|-------|-----------|
| Snapshot-first payment | Giá xe/slot có thể thay đổi — dùng snapshot đảm bảo tính toán đúng | `03-payment-engine.md` |
| Component-based payment | Mỗi khoản tiền có vòng đời độc lập → dễ audit, refund từng phần | `03-payment-engine.md` |
| Immutable ledger | Không edit amount component đã tạo — tạo component mới | `03-payment-engine.md` |
| Single state machine | Mọi booking state change đều qua `BookingService.transition()` | `02-state-machine.md` |
| Evidence-based handover | 4 ảnh + checklist tại mỗi điểm bàn giao → dispute có bằng chứng số | `04-inspection-flow.md` |
| Express.js thay NestJS | Lightweight, phù hợp team size và timeline SEP490 | `docs/adr/001-why-nestjs.md` |
| Role-based routing (FE) | 1 app cho 4 actor — đơn giản hóa deployment | — |

---

## 10. Open Questions (Architecture level)

1. **Notification service**: Hiện chưa chọn provider cụ thể (Firebase FCM? Twilio SMS?).
   Spec chỉ note "Push/SMS" — cần quyết định trước TP-2.

2. **VNPay IPN**: Có cần server-to-server callback không? (xem Block 2 trong sequence diagram)

3. **Hosting / Deployment**: Chưa xác định — cloud provider, containerization (Docker?),
   CI/CD pipeline. Cần quyết định trong TP-3.

4. **Platform fee disbursement mechanism**: Spec nêu 15% nhưng chưa rõ cơ chế thực thu
   (trừ từ Provider disbursement hay tạo component riêng).

---

## Reference

- `docs/spec/00-overview.md` — Business context, actors, scope
- `docs/spec/01-domain-model.md` — Entities, enums, ERD
- `docs/spec/02-state-machine.md` — Booking state machine
- `docs/spec/03-payment-engine.md` — Payment component lifecycle
- `docs/spec/04-inspection-flow.md` — Check-in/out protocol
- `docs/spec/05-api-contracts.md` — REST API endpoints
- `docs/diagrams/sequence/sequence-flow-booking-lifecycle.md` — End-to-end sequence diagram
- `docs/adr/001-why-nestjs.md` — Framework decision record

---

*Last updated: 2026-05-11 · Status: Draft*
