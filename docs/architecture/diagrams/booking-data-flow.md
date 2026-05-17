# Booking Data Flow — Tables touched per step

> Happy path đi thẳng xuống. Unhappy cases rẽ ngang sang phải.

---

## Phase 1 — Booking Creation & Payment

```
┌─────────────────────────────────────────────┐
│  Customer: POST /bookings                   │
│  chọn slot + xe (RENTAL) hoặc BYOC         │
│  + tuỳ chọn: chọn nước/đồ ăn trước        │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│  bookings                      (PENDING)    │
│  booking_participants                       │
│  booking_vehicles              (if RENTAL)  │
│  fnb_orders                    (if preorder)│
│  fnb_order_items               (if preorder)│
│  payment_components            (PENDING)    │
└──────────────────────┬──────────────────────┘
                       │ thanh toán 1 lần
                       │ (slot + rental + deposit + F&B)
                       ▼
                [Payment Gateway]
                       │
            ┌──────────┴──────────────────────────────────┐
            │ ✓ success                    ✗ timeout 30m  │
            │                              customer cancel │
            ▼                                             ▼
┌────────────────────────────┐     ┌───────────────────────────────┐
│  payment_transactions      │     │  bookings         (CANCELLED) │
│  payment_components (HELD) │     │  payment_components           │
│    SLOT_FEE                │     │                   (REFUNDED)  │
│    RENTAL_FEE  per vehicle │     └───────────────────────────────┘
│    DEPOSIT     per vehicle │
│    FB_PREORDER if preorder │
│  bookings       (CONFIRMED)│
└──────────────┬─────────────┘
               │
               │ ✗ slot_start + 30m, no check-in
               ├────────────────────────────────────────────────────►
               │                              ┌──────────────────────┐
               │                              │ bookings   (NO_SHOW) │
               │                              │ SLOT_FEE:    0% hoàn │
               │                              │ DEPOSIT:   100% hoàn │
               │                              └──────────────────────┘
               │ ✓ Staff check-in
               ▼
          → Phase 2
```

---

## Phase 2 — Session Lifecycle

```
  ←── booking (CONFIRMED) + Staff check-in
                       │
                       ▼
┌─────────────────────────────────────────────┐
│  sessions                    (CHECKED_IN)   │
│  session_participants                       │
│  session_vehicles                           │
│  inspections                 (CHECK_IN)     │
│  inspection_photos           (4 angles)     │
│  inspection_checklists                      │
└──────────────────────┬──────────────────────┘
                       │ customer confirm (15m → auto-confirm)
                       ▼
┌─────────────────────────────────────────────┐
│  sessions                    (ACTIVE)       │
│                                             │
│  ··· extension_proposals     (optional)     │
│  ··· fnb_orders  [ON_SITE]   (optional)     │
│      fnb_order_items                        │
│      → khách gọi thêm tại quán,            │
│        trả thẳng Provider, ngoài platform  │
└──────────────────────┬──────────────────────┘
                       │ Staff check-out
                       ▼
┌─────────────────────────────────────────────┐
│  inspections                 (CHECK_OUT)    │
│  inspection_photos           (4 angles)     │
│  inspection_checklists                      │
└──────────────────────┬──────────────────────┘
                       │
            ┌──────────┴──────────────────────────────────┐
            │ ✓ no damage               ✗ damage flagged  │
            │   customer confirm                       │
            ▼                                             ▼
┌────────────────────────────┐     ┌───────────────────────────────┐
│  sessions       (COMPLETED)│     │  incidents                    │
│  payment_components        │     │  disputes  (if escalated)     │
│    SLOT_FEE   (DISBURSED)  │     │  payment_components           │
│    RENTAL_FEE (DISBURSED)  │     │    DAMAGE_CHARGE (HELD)       │
│    DEPOSIT    (REFUNDED)   │     └──────────────┬────────────────┘
│    DAMAGE_CHG (DISBURSED)  │                    │ resolved
│  trust_score_logs          │◄───────────────────┘
│  reviews                   │
└────────────────────────────┘
```

---

## Giải thích từng bảng

### Booking & Planning

| Bảng | Ý nghĩa |
|------|---------|
| `bookings` | Đơn đặt lịch dự kiến. Lưu thông tin slot, mode (RENTAL/BYOC/MIXED), trạng thái, snapshot giá tại thời điểm đặt. Không chứa dữ liệu vận hành thực tế. |
| `booking_participants` | Danh sách người chơi **dự kiến** khai khi đặt lịch — có thể khác người thực tế check-in. |
| `booking_vehicles` | Xe thuê **dự kiến** — Customer chọn xe nào khi đặt lịch. Chỉ dùng cho RENTAL mode. |

### Payment

| Bảng | Ý nghĩa |
|------|---------|
| `payment_components` | **Ledger bất biến** — mỗi khoản tiền (slot fee, deposit, damage...) là 1 record riêng với status riêng. Không bao giờ sửa amount đã tạo, chỉ tạo component mới. |
| `payment_transactions` | Log raw từ payment gateway (VNPay/MoMo) — lưu request/response gốc để audit. Tách biệt với component ledger. |

### Session & Actual Operations

| Bảng | Ý nghĩa |
|------|---------|
| `sessions` | Phiên chơi **thực tế** — chỉ tạo khi Staff check-in. Lưu giờ thực tế, ai check-in/out, tổng tiền thực tế. Một booking có thể có nhiều sessions. |
| `session_participants` | Người thực sự **có mặt** trong session — có thể khác `booking_participants`. |
| `session_vehicles` | Xe thực tế dùng trong session — có thể đổi xe so với kế hoạch. Hỗ trợ cả RENTAL (`vehicle_id`) và BYOC (`customer_vehicle_id`). |

### Inspection & Evidence

| Bảng | Ý nghĩa |
|------|---------|
| `inspections` | Biên bản kiểm tra xe tại điểm bàn giao (check-in hoặc check-out). Ghi nhận có damage không, customer đã confirm chưa. |
| `inspection_photos` | Ảnh thực tế — mỗi góc chụp (FRONT/BACK/LEFT/RIGHT) là 1 record riêng. URL lưu trên Cloudinary. |
| `inspection_checklists` | Từng mục kiểm tra (scratches, cracks, missing_parts...) — mỗi item là 1 record. Là bằng chứng số khi xảy ra tranh chấp. |

### Extensions & F&B

| Bảng | Ý nghĩa |
|------|---------|
| `extension_proposals` | Đề xuất gia hạn thêm giờ chơi — Staff gửi, Customer approve/reject. Có timeout 10 phút tự động reject. |
| `fnb_orders` | Đơn F&B. Có 2 loại: **PRE_ORDER** — chọn cùng lúc khi đặt slot, gộp chung vào 1 lần thanh toán; **ON_SITE** — gọi thêm tại quán trong lúc chơi, khách trả thẳng Provider, platform không xử lý khoản này. |
| `fnb_order_items` | Từng món trong đơn F&B — lưu snapshot tên/giá tại thời điểm order. |

### Incident & Dispute

| Bảng | Ý nghĩa |
|------|---------|
| `incidents` | Log sự cố vận hành (hư hỏng, va chạm, mất phụ kiện). Staff/Admin áp policy tự động: ghi `responsible_party`, `final_amount`, `resolution_note`. |
| `disputes` | Tranh chấp chính thức khi Customer không đồng ý kết quả damage. Tối đa 1 dispute per booking, chỉ Admin (team RCField) xét xử. |

### Audit & Trust

| Bảng | Ý nghĩa |
|------|---------|
| `trust_score_logs` | Lịch sử thay đổi điểm uy tín của Customer — ghi lý do (no-show, damage confirmed, booking streak...). Điểm ảnh hưởng đến quyền thuê xe tier RESTRICTED. |
| `reviews` | Đánh giá sau booking — Customer rate cafe/experience. Chỉ tạo được khi booking COMPLETED. |

---

## Ghi chú

| Ký hiệu | Ý nghĩa |
|---------|---------|
| `✓` | Happy path |
| `✗` | Unhappy / edge case |
| `···` | Optional step |
| `(PENDING / HELD / DISBURSED)` | Trạng thái của `payment_components` |
| `(CHECKED_IN / ACTIVE / COMPLETED)` | Trạng thái của `sessions` |
