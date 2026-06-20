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

**RCField** là **nền tảng SaaS multi-tenant** cho **nhiều Provider** vận hành sân xe RC tại Việt Nam. Mỗi Provider sở hữu một hoặc nhiều chi nhánh (cafes), đăng ký gói SaaS và vận hành độc lập trên cùng một hệ thống. Không phải marketplace — Provider quản lý chi nhánh của mình, Customer đặt lịch vào từng chi nhánh.

**Roles**:
- **ADMIN** — Team RCField (bên bán phần mềm): feature flag management, system monitoring
- **PROVIDER** — Chủ doanh nghiệp RC: quản lý toàn bộ chi nhánh, xem báo cáo tổng hợp
- **STAFF** — Nhân viên từng chi nhánh: vận hành check-in/out, F&B, gia hạn
- **CUSTOMER** — Khách đặt lịch: tìm chi nhánh gần nhất, đặt xe, thanh toán

Hai chế độ booking: **RENTAL** (thuê xe của quán) và **BYOC** (mang xe cá nhân).
Core value prop: structured evidence at every asset handover → eliminates damage disputes.

**Booking channels**: app trực tiếp / link chia sẻ (Zalo, FB) / Staff tạo thủ công (walk-in, gọi điện).

**F&B**: Customer pre-order khi đặt lịch (gộp 1 lần thanh toán) + Staff ghi order thêm tại quán (khách trả trực tiếp cho quán). Platform không thu phí trên F&B.

**Payment**: Booking + F&B pre-order → 1 lần qua payment gateway (TBD). F&B tại quán → tiền mặt hoặc chuyển khoản thẳng Provider. Platform không thu % trên booking — revenue model là SaaS subscription fee.

---

## Project-Specific Guidelines

> **Before writing any code**, read the `CLAUDE.md` inside the relevant project:
>
> - **Backend**: `rcfeild-be/CLAUDE.md` — controller conventions, logger usage, validation, enums, naming
> - **Frontend**: `rcfeild-fe/CLAUDE.md` — *(when available)*
>
> These files contain coding rules that all agents must follow for that project.

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

## Developer Guides — Đọc khi implement tính năng theo domain

| File | Khi nào cần đọc |
|------|----------------|
| `docs/developer/provider-subscription-enforcement.md` | **Bắt buộc** trước khi implement bất kỳ endpoint nào có role PROVIDER — subscription status check, quota guards, error codes |

---

## Tech Stack

### Backend (`rcfield-be`)
- **Runtime**: Node.js 20+, TypeScript strict mode
- **Framework**: Express.js — router-per-domain architecture
- **Database**: PostgreSQL via TypeORM
- **Auth**: JWT + RBAC (4 roles: CUSTOMER, PROVIDER, STAFF, ADMIN)
- **Payment**: Payment gateway TBD (VNPay / MoMo / VietQR)
- **File storage**: Cloudinary (upload ảnh check-in/out, lưu URL về DB)
- **Validation**: zod on all request bodies

### Frontend (`rcfield-fe`)
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

PaymentFlow:     Bước 1 (booking confirm): charge security_deposit → HELD
                 Bước 2 (session checkout): CAPTURE (total_charges − security_deposit)
                 total_charges = slot_fee + rental_fee + extension_fee + fnb + damage_charge
                 security_deposit = vehicle.market_value × 15%
                 extension_fee cap → max 50% security_deposit

PlatformFee:     15% chỉ tính trên consummated components

Timeout rules:   Xem rcfield-spec/docs/spec/02-state-machine.md
Refund rules:    Xem rcfield-spec/docs/spec/03-payment-engine.md (R1, R2, R3)
```

---

## Docusaurus — Tài liệu site (chạy local)

```bash
cd rcfield-workspace/rcfield-spec/website
npm start        # http://localhost:3100
```

### Hook — Khi tạo tài liệu mới, BẮT BUỘC cập nhật sidebar

Sau khi tạo bất kỳ file `.md` mới trong `docs/` hoặc `specs/`, phải cập nhật sidebar tương ứng:

| Tài liệu nằm ở | File cần cập nhật |
|----------------|-------------------|
| `docs/spec/`, `docs/architecture/`, `docs/diagrams/`, `docs/adr/`, `docs/developer/` | `website/sidebars.ts` |
| `specs/NNN-*/` (feature spec mới) | `website/sidebars-specs.ts` |

**Quy tắc đặt ID trong sidebar:**
- Docusaurus tự strip numeric prefix khỏi tên folder và file
- `docs/spec/00-overview.md` → ID là `spec/overview`
- `specs/010-new-feature/spec.md` → ID là `new-feature/spec`
- `specs/010-new-feature/contracts/api.md` → ID là `new-feature/contracts/api`

**Thêm feature spec mới vào `website/sidebars-specs.ts`:**
```ts
{
  type: 'category',
  label: '010 · Tên Feature',
  collapsed: true,
  items: [
    'ten-feature/spec',
    'ten-feature/plan',
    'ten-feature/data-model',
    'ten-feature/research',
    'ten-feature/quickstart',
    'ten-feature/tasks',
    'ten-feature/contracts/api',  // nếu có
  ],
},
```

**Thêm doc mới vào `website/sidebars.ts`** — thêm ID vào đúng category tương ứng.

Nếu không chắc ID là gì, chạy `npm run build` trong `website/` — Docusaurus sẽ liệt kê toàn bộ available document ids trong error message.

---

## Codegraph — Bắt buộc dùng khi `/speckit-plan`

> Codegraph là SQLite knowledge graph đã index toàn bộ symbol, entity, và file trong codebase.
> Dùng TRƯỚC khi generate `data-model.md` và `contracts/` để plan chính xác hơn.

Khi chạy `/speckit-plan`, **bắt buộc** query codegraph theo thứ tự:

1. **`codegraph_explore`** — hỏi về entities/services liên quan đến feature đang plan  
   Ví dụ: `"what booking and payment entities exist?"`, `"show me the cafe and provider models"`
2. **`codegraph_search`** — tìm symbol cụ thể khi cần verify tên chính xác  
   Ví dụ: tìm `BookingSnapshot`, `PaymentComponent`, `CafePricingConfig`
3. **`codegraph_callers`** — xem ai đang dùng method/service cần modify

**Dùng kết quả để:**
- Tránh tạo entity/table trùng với cái đã có
- Reuse service methods thay vì tạo mới
- Giữ đúng naming convention thực tế trong code (không chỉ dựa vào spec)
- Xác định đúng file path cần modify (không đoán)

**Lưu ý:** Codegraph index codebase tại `rcfield-app/`. Nếu chưa có codebase thì bỏ qua bước này.

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
Current active feature plan: `specs/012-dynamic-pricing/plan.md`
For implementation context, read in order:
1. `specs/012-dynamic-pricing/plan.md` — technical context, file structure, constitution check (Phase 2 promotion)
2. `specs/012-dynamic-pricing/research.md` — 7 decisions: table structure, lookup injection point, holidays seed, frontend API, snapshot extension, timezone, peak hours scope
3. `specs/012-dynamic-pricing/data-model.md` — 2 new entities (CafePricingRule, HolidayDate), booking snapshot extension, migration SQL with 2026 holiday seed data
4. `specs/012-dynamic-pricing/contracts/api.md` — 8 endpoints: public pricing/preview, provider config (rules + holidays CRUD); modified booking breakdown response; Zod schemas
5. `specs/012-dynamic-pricing/quickstart.md` — implementation order, 11 unit test cases, 5 E2E scenarios, exact code change location in createBooking
<!-- SPECKIT END -->
