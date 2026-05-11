# CLAUDE.md — RCField Workspace

> This file is read by Claude Code (and other AI agents) automatically on session start.
> Keep it accurate. When architecture changes, update this file in the same PR.

---

## Workspace Layout

```
rcfield-workspace/          ← Clone cả 2 repo vào đây
├── CLAUDE.md               ← File này — AI đọc đầu tiên
├── rcfield-spec/           ← github.com/rcfield-org/rcfield-spec
│   └── docs/spec/          ← Source of truth cho business logic
└── rcfield-app/            ← github.com/rcfield-org/rcfield-app
    └── apps/
        ├── api/            ← TypeScript + Express backend
        └── web/            ← ReactJS frontend
```

### Clone workspace lần đầu

```bash
mkdir rcfield-workspace && cd rcfield-workspace
git clone https://github.com/rcfield-org/rcfield-spec.git
git clone https://github.com/rcfield-org/rcfield-app.git
# Mở folder rcfield-workspace bằng VS Code / Cursor / Claude Code
```

---

## Project Overview

**RCField** là vertical SaaS platform số hóa vận hành cafe xe RC tại Việt Nam.
Kết nối 3 actor chính: **Customer** (đặt lịch/thuê xe), **Provider+Staff** (quản lý quán/đội xe), **Admin** (platform oversight).

Hai chế độ booking: **RENTAL** (thuê xe của quán) và **BYOC** (mang xe cá nhân).
Core value prop: structured evidence at every asset handover → eliminates damage disputes.

---

## Spec Files — Đọc trước khi implement bất kỳ feature nào

| File | Khi nào cần đọc |
|------|----------------|
| `rcfield-spec/docs/spec/00-overview.md` | Onboarding, hiểu toàn cảnh |
| `rcfield-spec/docs/spec/01-domain-model.md` | Trước khi tạo entity / schema |
| `rcfield-spec/docs/spec/02-state-machine.md` | Trước khi đụng vào booking lifecycle |
| `rcfield-spec/docs/spec/03-payment-engine.md` | **Bắt buộc** trước khi implement bất kỳ payment logic |
| `rcfield-spec/docs/spec/04-inspection-flow.md` | Trước khi làm check-in/out module |
| `rcfield-spec/docs/spec/05-api-contracts.md` | Trước khi tạo endpoint mới |

---

## Tech Stack

### Backend (`rcfield-app/apps/api`)
- **Runtime**: Node.js 20+, TypeScript strict mode
- **Framework**: Express.js — router-per-domain architecture
- **Database**: PostgreSQL via TypeORM
- **Auth**: JWT + RBAC (5 roles: CUSTOMER, PROVIDER, STAFF, ADMIN, PLATFORM)
- **Payment**: VNPay sandbox
- **File storage**: S3-compatible (check-in/out photos)
- **Validation**: express-validator hoặc zod on all request bodies

### Frontend (`rcfield-app/apps/web`)
- **Framework**: ReactJS (Vite hoặc CRA)
- **Language**: TypeScript strict mode
- **Styling**: Tailwind CSS
- **State**: React Query (server state) + Zustand (client state)
- **Language**: Vietnamese UI

---

## Express Project Structure (backend)

```
apps/api/src/
├── routes/         ← Express routers (auth, bookings, inspections, payments...)
├── controllers/    ← Request handlers, input validation
├── services/       ← Business logic (BookingService, PaymentService...)
├── models/         ← TypeORM entities (Booking, Vehicle, Inspection...)
├── middlewares/    ← JWT auth, RBAC guard, error handler
├── jobs/           ← Cron jobs (booking timeout, auto-confirm)
├── types/          ← Shared TypeScript interfaces & enums
└── config/         ← DB, S3, VNPay, JWT config
```

```
apps/web/src/
├── pages/          ← React page components (BookingPage, CheckinPage...)
├── components/     ← Reusable UI components
├── hooks/          ← Custom React hooks (useBooking, useInspection...)
├── api/            ← Axios API client functions
├── store/          ← Zustand stores
└── types/          ← Shared TypeScript interfaces
```

---

## Coding Conventions

### Chung
- **Không** dùng `any` trong TypeScript — dùng proper types hoặc `unknown`
- Mọi public method trong service đều phải có JSDoc ngắn
- Error handling: dùng Express error middleware, throw custom `AppError(message, statusCode)`

### Đặt tên
- Entity/Model: PascalCase singular (`Booking`, `Vehicle`, `Inspection`)
- Request/Response types: `CreateBookingBody`, `BookingResponse`
- Service method: `findOne`, `findAll`, `create`, `update`, `remove`
- Enum: SCREAMING_SNAKE_CASE (`BookingStatus.PENDING`, `AssetTier.PREMIUM`)
- Router file: `booking.routes.ts` | Controller: `booking.controller.ts` | Service: `booking.service.ts`

### Database
- Tên bảng: snake_case plural (`bookings`, `vehicles`, `inspection_records`)
- Foreign key: `entity_id` pattern (`booking_id`, `vehicle_id`)
- Timestamps: mọi entity đều có `created_at`, `updated_at`
- Soft delete: dùng `deleted_at` (TypeORM `@DeleteDateColumn`)

### Payment Engine — Rule đặc biệt
- **Không bao giờ** tính tiền trực tiếp từ giá hiện tại — luôn đọc từ `booking_snapshot`
- Mỗi payment component phải có status riêng: `HELD | DISBURSED | REFUNDED | PENDING`
- Viết unit test trước khi implement refund logic

---

## Git Workflow

```
main          ← production-ready, protected
develop       ← integration branch
feature/TP1-xxx   ← feature branches (prefix bằng Task Package)
fix/xxx
```

### Commit message format
```
feat(bookings): implement slot extension proposal flow
fix(payments): correct pro-rata refund calculation for early checkout
docs(spec): update state machine with timeout transitions
test(payments): add unit tests for damage charge component
```

### PR Rules
- Mọi PR phải link đến GitHub Issue
- Nếu PR thay đổi business logic → phải update spec file tương ứng trong cùng PR
- Không merge PR nếu CI fail

---

## Business Rules Nhanh (tóm tắt — đọc spec đầy đủ trước khi implement)

```
AssetTier:       STANDARD < PREMIUM < RESTRICTED
                 (deposit amount tăng dần, damage multiplier tăng dần)

BookingMode:     RENTAL  = customer thuê xe từ fleet
                 BYOC    = customer mang xe riêng

PaymentFlow:     slot_fee + rental_fee → thu trước
                 security_deposit      → hold, giải phóng sau check-out
                 extension_fee         → post-paid, trừ vào deposit (max 50%)
                 damage_charge         → trừ vào deposit hoặc charge thêm

PlatformFee:     15% chỉ tính trên consummated components

Timeout rules:   Xem rcfield-spec/docs/spec/02-state-machine.md
Refund rules:    Xem rcfield-spec/docs/spec/03-payment-engine.md (R1, R2, R3)
```

---

## GitNexus (chạy sau khi có codebase)

```bash
cd rcfield-workspace
npx gitnexus analyze rcfield-app   # index app codebase
npx gitnexus setup                 # configure MCP cho editor
```

## Graphify (chạy ngay sau khi setup spec)

```bash
cd rcfield-workspace/rcfield-spec
graphify install claude             # hook vào Claude Code
graphify run                        # build graph từ docs/spec/
```

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
