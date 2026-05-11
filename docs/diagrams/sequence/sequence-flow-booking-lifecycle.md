# Sequence Flow: Booking Lifecycle

End-to-end flow từ khi Customer tạo booking đến khi COMPLETED hoặc CANCELLED, bao gồm
payment, check-in/check-out, slot extension (optional), và dispute (optional).
Dựa trên `docs/spec/02-state-machine.md`, `03-payment-engine.md`, `04-inspection-flow.md`,
`05-api-contracts.md`, và `docs/docs/RCField_Overview-V1.0.0.docx`.

> ⚠️ **Lưu ý**: Tài liệu này chỉ mang tính **tham khảo** để hiểu tổng thể flow trước khi
> implement. Chưa được review và chưa áp dụng vào codebase. Cần chạy `/speckit-specify`
> và `/speckit-plan` trước khi bắt đầu implement bất kỳ block nào.

> See **Reference** at the bottom for related docs and legend.

---

## 0. Identifiers

| Field | Value | Notes |
|-------|-------|-------|
| Booking mode | `BookingMode.RENTAL` \| `BookingMode.BYOC` | Quyết định có tạo RENTAL_FEE + SECURITY_DEPOSIT không |
| Asset tier | `AssetTier.STANDARD` \| `PREMIUM` \| `RESTRICTED` | Ảnh hưởng deposit và damage_multiplier |
| State path (happy) | `PENDING → CONFIRMED → ACTIVE → CHECKING_OUT → COMPLETED` | |
| State path (cancel) | `PENDING → CANCELLED` \| `CONFIRMED → CANCELLED` | |
| State path (dispute) | `ACTIVE → DISPUTED → COMPLETED` \| `CHECKING_OUT → DISPUTED → COMPLETED` | |
| State path (extension) | `ACTIVE → EXTENDING → ACTIVE` | |
| Events | `PAYMENT_CONFIRMED`, `CHECK_IN_COMPLETED`, `CHECKOUT_INITIATED`, `CUSTOMER_CONFIRMED`, `DAMAGE_DISPUTED`, `DISPUTE_RESOLVED`, `CANCELLED`, `TIMEOUT` | `BookingEvent` enum |
| Create booking | `POST /bookings` | `BookingsController` |
| Cancel booking | `POST /bookings/:id/cancel` | Customer hoặc Provider |
| Confirm payment | `POST /bookings/:id/payment/confirm` | Customer sau VNPay callback |
| Check-in | `POST /bookings/:id/inspections/checkin` | Staff only |
| Check-in confirm | `POST /bookings/:id/inspections/checkin/confirm` | Customer |
| Check-out | `POST /bookings/:id/inspections/checkout` | Staff only |
| Check-out confirm | `POST /bookings/:id/inspections/checkout/confirm` | Customer |
| Dispute damage | `POST /bookings/:id/inspections/checkout/dispute-damage` | Customer |
| Extension propose | `POST /bookings/:id/extensions` | Staff |
| Extension approve | `POST /bookings/:id/extensions/:extId/approve` | Customer |
| Extension reject | `POST /bookings/:id/extensions/:extId/reject` | Customer |
| Open dispute | `POST /bookings/:id/disputes` | Customer hoặc Provider |
| Resolve dispute | `PATCH /disputes/:id/resolve` | Admin only |

---

## 1. Tạo Booking

Customer chọn cafe, slot, chế độ (RENTAL/BYOC), và gửi booking request. API snapshot giá
tại thời điểm này — mọi tính toán tiền sau đó dùng snapshot, không dùng giá hiện tại.

```mermaid
sequenceDiagram
    autonumber
    participant U as Customer
    participant M as Frontend<br/>(React / BookingPage)
    participant B as API<br/>(Express + TS / BookingsController)
    participant DB as PostgreSQL

    U->>M: chọn cafe, slot, mode (RENTAL/BYOC)
    M->>B: POST /bookings<br/>{ cafe_id, vehicle_id?, mode, slot_start, slot_end, byoc_vehicle_info? }

    B->>DB: kiểm tra slot conflict<br/>SELECT bookings WHERE vehicle_id + slot overlap

    alt Slot bị trùng
        DB-->>B: conflict found
        B-->>M: error { code: "SLOT_CONFLICT", statusCode: 409 }
        M->>U: "Slot đã có người đặt, vui lòng chọn giờ khác"
    else Slot available
        DB-->>B: clear
        Note over B: Snapshot giá tại thời điểm đặt:<br/>slot_fee_rate, rental_fee, security_deposit,<br/>damage_multiplier, platform_fee_pct=0.15, refund_rules="R1"
        B->>DB: INSERT booking { status: PENDING, snapshot: {...} }
        DB-->>B: booking created
        B-->>M: { data: { bookingId, status: "PENDING", paymentUrl } }
        M->>U: Redirect đến trang thanh toán VNPay
    end
```

> **Timeout PENDING**: Nếu Customer không hoàn tất thanh toán trong **30 phút**, hệ thống
> tự động cancel booking và hoàn tiền 100% (nếu đã thu). Xem Block 7b.

---

## 2. Thanh Toán VNPay (PENDING → CONFIRMED)

Customer thanh toán qua VNPay. Sau khi VNPay callback thành công, API tạo các
PaymentComponent và trigger state transition.

```mermaid
sequenceDiagram
    autonumber
    participant U as Customer
    participant M as Frontend<br/>(React / PaymentPage)
    participant B as API<br/>(Express + TS / BookingsController)
    participant V as VNPay
    participant PE as PaymentEngine<br/>(PaymentsService)
    participant SM as StateMachine<br/>(BookingsService)
    participant DB as PostgreSQL
    participant N as Notify

    U->>V: thanh toán trên VNPay gateway
    V-->>M: redirect callback với vnp_ResponseCode

    alt vnp_ResponseCode = "00" (thành công)
        M->>B: POST /bookings/:id/payment/confirm { vnp_params }
        B->>V: verify chữ ký VNPay (server-side)
        V-->>B: signature valid

        B->>PE: createComponents(bookingId, snapshot, mode)
        Note over PE: Tạo components từ snapshot (KHÔNG từ giá hiện tại):<br/>• SLOT_FEE → HELD (luôn tạo)<br/>• RENTAL_FEE → HELD (chỉ nếu RENTAL)<br/>• SECURITY_DEPOSIT → HELD (chỉ nếu RENTAL)
        PE->>DB: INSERT payment_components (dùng DB transaction + row lock)
        DB-->>PE: components created

        PE-->>B: ok
        B->>SM: transition(bookingId, PAYMENT_CONFIRMED)
        SM->>DB: UPDATE booking.status = CONFIRMED
        DB-->>SM: ok
        SM-->>B: ok

        B->>N: push notification → Customer "Booking đã xác nhận"
        B-->>M: { data: { bookingId, status: "CONFIRMED" } }
        M->>U: "Đặt lịch thành công! Vui lòng đến đúng giờ."

    else vnp_ResponseCode ≠ "00" (thất bại / cancel)
        M->>B: POST /bookings/:id/payment/confirm { vnp_params }
        B-->>M: error { code: "PAYMENT_REQUIRED", statusCode: 402 }
        M->>U: "Thanh toán không thành công. Vui lòng thử lại."
        Note over M,B: Booking vẫn ở PENDING<br/>Customer có thể thử lại trong window 30 phút
    end
```

---

## 3. Check-in (CONFIRMED → ACTIVE)

Staff thực hiện kiểm tra xe, chụp ảnh 4 góc, hoàn thành checklist. Customer xác nhận
để tạo digital evidence baseline — bảo vệ cả 2 bên khi có tranh chấp sau này.

```mermaid
sequenceDiagram
    autonumber
    participant P as Staff
    participant U as Customer
    participant M as Frontend<br/>(React / InspectionPage)
    participant B as API<br/>(Express + TS / InspectionsController)
    participant S3 as S3 Storage
    participant SM as StateMachine<br/>(BookingsService)
    participant DB as PostgreSQL
    participant N as Notify

    P->>M: mở booking → bắt đầu Check-in

    alt mode = RENTAL
        Note over P,M: Staff lấy xe từ fleet<br/>vehicle.status → IN_USE
        B->>DB: UPDATE vehicle.status = IN_USE
    else mode = BYOC
        Note over P,M: Staff kiểm tra xe của Customer<br/>(an toàn, pin, trọng lượng)<br/>Không lấy xe từ fleet
    end

    P->>M: chụp ảnh 4 góc (FRONT, BACK, LEFT, RIGHT)
    M->>B: upload multipart/form-data<br/>photo_front, photo_back, photo_left, photo_right

    Note over B: Validation: 4 ảnh bắt buộc<br/>Thiếu 1 → reject với INSPECTION_INCOMPLETE

    B->>S3: upload 4 photos<br/>path: inspections/{booking_id}/check_in/{angle}.jpg
    S3-->>B: 4 URLs

    P->>M: điền checklist { scratches, cracks, missing_parts, notes }<br/>bật pre_existing_flag nếu có hư hỏng sẵn

    M->>B: POST /bookings/:id/inspections/checkin<br/>{ photos: [4 URLs], checklist, pre_existing_flag }
    B->>DB: INSERT inspection_record { type: CHECK_IN, photos, checklist, pre_existing_flag }
    DB-->>B: record created

    B->>N: push notification → Customer "Kiểm tra xe hoàn tất, vui lòng xác nhận"
    B-->>M: { data: { inspectionId, status: "pending_customer_confirm" } }

    Note over U,N: Timeout: 15 phút<br/>Nếu Customer không confirm → auto-confirm (log lại)

    alt Customer xác nhận trong 15 phút
        U->>M: xem ảnh + checklist → bấm "Xác nhận"
        M->>B: POST /bookings/:id/inspections/checkin/confirm
        B->>DB: UPDATE inspection_record.customer_confirmed = true, confirmed_at = now()
    else Timeout 15 phút
        Note over B: Auto-confirm, ghi log<br/>customer_confirmed = true (system)
        B->>DB: UPDATE customer_confirmed = true (auto)
    end

    B->>SM: transition(bookingId, CHECK_IN_COMPLETED)
    SM->>DB: UPDATE booking.status = ACTIVE
    DB-->>SM: ok
    B-->>M: { data: { bookingId, status: "ACTIVE" } }
    M->>P: "Check-in hoàn tất. Session đã bắt đầu!"
```

> **Timeout CONFIRMED → no check-in**: Nếu Staff không check-in trong vòng **30 phút sau
> `slot_start`**, hệ thống auto-cancel, hoàn tiền theo **R3** (no-show): SLOT_FEE = 0%,
> RENTAL_FEE = 100%, DEPOSIT = 100%.

---

## 4. Gia Hạn Giờ Chơi — Slot Extension (ACTIVE → EXTENDING → ACTIVE)

Staff gửi đề xuất gia hạn khi khách muốn chơi thêm. Customer phê duyệt hoặc từ chối.
Extension fee bị cap ở mức 50% security_deposit (cộng dồn qua nhiều lần gia hạn).

```mermaid
sequenceDiagram
    autonumber
    participant P as Staff
    participant U as Customer
    participant M as Frontend<br/>(React / ExtensionPage)
    participant B as API<br/>(Express + TS / BookingsController)
    participant PE as PaymentEngine<br/>(PaymentsService)
    participant SM as StateMachine<br/>(BookingsService)
    participant DB as PostgreSQL
    participant N as Notify

    P->>M: chọn thời gian gia hạn (30/60/90 phút)
    M->>B: POST /bookings/:id/extensions<br/>{ duration_minutes, extension_fee }

    B->>DB: tính tổng extension_fee đã tích lũy
    Note over B: Kiểm tra cap:<br/>total_extension_fee + extension_fee_mới<br/>≤ security_deposit × 0.50

    alt Vượt cap
        B-->>M: error { code: "EXTENSION_FEE_EXCEEDED", statusCode: 422 }
        M->>P: "Đã đạt giới hạn gia hạn (50% tiền cọc)"
    else Trong cap
        B->>SM: transition(bookingId, EXTENSION_INITIATED)
        SM->>DB: UPDATE booking.status = EXTENDING
        B->>N: push notification → Customer "Đề xuất gia hạn X phút"
        B-->>M: { data: { extensionId, status: "pending" } }
        M->>P: "Đã gửi đề xuất, chờ khách xác nhận"

        Note over U,N: Customer có 10 phút để phản hồi

        alt Customer đồng ý
            U->>M: bấm "Đồng ý"
            M->>B: POST /bookings/:id/extensions/:extId/approve
            B->>PE: createComponent(EXTENSION_FEE, amount, status: HELD)
            PE->>DB: INSERT payment_component { type: EXTENSION_FEE, status: HELD }
            B->>DB: UPDATE booking.slot_end += duration_minutes
            B->>SM: transition(bookingId, EXTENSION_APPROVED)
            SM->>DB: UPDATE booking.status = ACTIVE
            B->>N: notify Staff + Customer "Gia hạn thành công đến HH:MM"
            B-->>M: { data: { bookingId, status: "ACTIVE", new_slot_end } }

        else Customer từ chối hoặc timeout
            U->>M: bấm "Từ chối" (hoặc hết 10 phút)
            M->>B: POST /bookings/:id/extensions/:extId/reject
            B->>SM: transition(bookingId, EXTENSION_REJECTED)
            SM->>DB: UPDATE booking.status = ACTIVE
            B->>N: notify Staff "Khách từ chối gia hạn"
            B-->>M: { data: { bookingId, status: "ACTIVE" } }
        end
    end
```

---

## 5. Check-out (ACTIVE → CHECKING_OUT)

Staff kết thúc phiên chơi: chụp ảnh 4 góc, so sánh với check-in, đánh dấu damage hay
không. Đây là bước tạo evidence cho settlement và dispute (nếu có).

```mermaid
sequenceDiagram
    autonumber
    participant P as Staff
    participant U as Customer
    participant M as Frontend<br/>(React / CheckoutPage)
    participant B as API<br/>(Express + TS / InspectionsController)
    participant S3 as S3 Storage
    participant PE as PaymentEngine<br/>(PaymentsService)
    participant SM as StateMachine<br/>(BookingsService)
    participant DB as PostgreSQL
    participant N as Notify

    P->>M: mở booking ACTIVE → bắt đầu Check-out
    B->>SM: transition(bookingId, CHECKOUT_INITIATED)
    SM->>DB: UPDATE booking.status = CHECKING_OUT

    P->>M: chụp ảnh 4 góc (cùng angle với check-in)
    M->>B: upload 4 photos
    B->>S3: upload 4 photos<br/>path: inspections/{booking_id}/check_out/{angle}.jpg
    S3-->>B: 4 URLs

    P->>M: hoàn thành checklist (same format với check-in)
    Note over B: System highlight điểm khác biệt<br/>giữa check-in checklist và check-out checklist

    alt Không có damage mới
        P->>M: đánh dấu "Không có damage"
        M->>B: POST /bookings/:id/inspections/checkout<br/>{ photos, checklist, has_damage: false }
        B->>DB: INSERT inspection_record { type: CHECK_OUT, has_damage: false }
        B->>N: push notification → Customer "Xác nhận kết thúc phiên chơi"
        B-->>M: { data: { inspectionId, status: "pending_customer_confirm" } }

        Note over U: Timeout: 2 giờ<br/>Im lặng = auto-confirm → COMPLETED

        alt Customer xác nhận trong 2 giờ
            U->>M: bấm "Xác nhận"
            M->>B: POST /bookings/:id/inspections/checkout/confirm
        else Timeout 2 giờ
            Note over B: Auto-confirm checkout<br/>(log lại, không cần customer action)
        end
        Note over B: → Chuyển sang Block 6: Settlement

    else Có damage mới
        P->>M: đánh dấu "Có damage", nhập mô tả + damage_cost
        M->>B: POST /bookings/:id/inspections/checkout<br/>{ photos, checklist, has_damage: true, damage_cost }

        Note over B: Tính damage_charge:<br/>damage_charge = damage_cost × snapshot.damage_multiplier<br/>Kiểm tra pre_existing_flag: nếu hư hỏng đã ghi nhận check-in<br/>+ customer đã confirm → KHÔNG tính vào damage_charge này

        B->>PE: createComponent(DAMAGE_CHARGE, damage_charge, status: PENDING)
        PE->>DB: INSERT payment_component { type: DAMAGE_CHARGE, status: PENDING }
        B->>N: push notification → Customer "Phát hiện hư hỏng, xem bằng chứng"
        B-->>M: { data: { inspectionId, damage_charge, status: "pending_customer_decision" } }

        Note over U: Timeout: 24 giờ<br/>Im lặng = auto-confirm damage charge

        alt Customer xác nhận damage
            U->>M: xem ảnh + checklist → bấm "Xác nhận"
            M->>B: POST /bookings/:id/inspections/checkout/confirm
            B->>PE: updateComponent(DAMAGE_CHARGE, status: HELD)
            PE->>DB: UPDATE payment_component.status = HELD
            Note over B: → Chuyển sang Block 6: Settlement (có damage)

        else Customer mở dispute
            U->>M: bấm "Phản đối" + nhập lý do + upload evidence
            M->>B: POST /bookings/:id/inspections/checkout/dispute-damage
            B->>SM: transition(bookingId, DAMAGE_DISPUTED)
            SM->>DB: UPDATE booking.status = DISPUTED
            Note over B: → Chuyển sang Block 7: Dispute Resolution

        else Timeout 24 giờ
            Note over B: Auto-confirm damage charge<br/>DAMAGE_CHARGE.status → HELD
            Note over B: → Chuyển sang Block 6: Settlement (có damage)
        end
    end
```

---

## 6. Settlement & Completion (CHECKING_OUT → COMPLETED)

Sau khi Customer confirm (hoặc auto-confirm), PaymentEngine settle toàn bộ components.
Đây là bước cuối của happy path.

```mermaid
sequenceDiagram
    autonumber
    participant B as API<br/>(Express + TS / BookingsController)
    participant PE as PaymentEngine<br/>(PaymentsService)
    participant SM as StateMachine<br/>(BookingsService)
    participant DB as PostgreSQL
    participant N as Notify

    Note over B: Triggered sau customer confirm checkout<br/>(hoặc auto-confirm timeout)

    B->>SM: transition(bookingId, CUSTOMER_CONFIRMED)
    SM->>DB: UPDATE booking.status = COMPLETED

    B->>PE: settle(bookingId)

    Note over PE: Dùng DB transaction + row lock<br/>để tránh race condition

    PE->>DB: SLOT_FEE → DISBURSED (to Provider)
    PE->>DB: RENTAL_FEE → DISBURSED (to Provider) [nếu RENTAL]

    alt Có EXTENSION_FEE
        PE->>DB: EXTENSION_FEE → DISBURSED (to Provider)
    end

    alt Có DAMAGE_CHARGE (status: HELD)
        PE->>DB: DAMAGE_CHARGE → DISBURSED (to Provider)
        Note over PE: SECURITY_DEPOSIT = SECURITY_DEPOSIT - damage_charge<br/>Phần còn lại → REFUNDED (to Customer)
    else Không có damage
        PE->>DB: SECURITY_DEPOSIT → REFUNDED (to Customer) — 100%
    end

    Note over PE: Platform fee = 15% × (SLOT_FEE + RENTAL_FEE + EXTENSION_FEE + DAMAGE_CHARGE)<br/>KHÔNG tính trên SECURITY_DEPOSIT

    alt mode = RENTAL
        PE->>DB: UPDATE vehicle.status = AVAILABLE
    end

    PE-->>B: settlement complete
    B->>N: push notification → Customer "Phiên chơi kết thúc. Chi tiết thanh toán: ..."
    B->>N: push notification → Provider "Doanh thu từ booking #X đã được ghi nhận"
```

**Settlement outcomes theo scenario:**

| Scenario | SLOT_FEE | RENTAL_FEE | DEPOSIT | DAMAGE_CHARGE | Platform fee |
|----------|----------|------------|---------|---------------|-------------|
| Hoàn thành, no damage | Disburse → Provider | Disburse → Provider | Refund → Customer 100% | — | 15% × (slot + rental) |
| Hoàn thành, có damage ≤ deposit | Disburse → Provider | Disburse → Provider | Refund phần còn lại | Disburse → Provider | 15% × (slot + rental + damage) |
| Early checkout, no damage | Pro-rata → Provider | Không hoàn | Refund 100% | — | 15% × phần đã disburse |

---

## 7. Dispute Resolution (DISPUTED → COMPLETED)

Khi Customer phản đối damage charge, Admin xét xử dựa trên digital evidence (ảnh
check-in/out, checklist, trust_score). Đây là nhánh ngoài happy path.

```mermaid
sequenceDiagram
    autonumber
    participant U as Customer
    participant A as Admin
    participant M as Frontend<br/>(React / DisputePage)
    participant B as API<br/>(Express + TS / DisputesController)
    participant PE as PaymentEngine<br/>(PaymentsService)
    participant SM as StateMachine<br/>(BookingsService)
    participant DB as PostgreSQL
    participant N as Notify

    Note over U,B: booking.status = DISPUTED<br/>(sau DAMAGE_DISPUTED hoặc DISPUTE_OPENED)

    U->>M: xem dispute detail + upload thêm evidence (optional)
    M->>B: POST /bookings/:id/disputes<br/>{ reason, evidence_photos[] }
    B->>DB: INSERT dispute { status: OPEN, reason, evidence_photos }
    B->>N: notify Admin "Dispute mới cần xử lý"

    Note over A,B: Timeout: 72 giờ<br/>Admin PHẢI resolve — escalate nếu quá hạn

    A->>M: mở Admin portal → GET /disputes/:id<br/>xem check-in photos, check-out photos,<br/>checklist so sánh, pre_existing_flag,<br/>Customer trust_score
    B->>DB: SELECT inspection_records + photos + dispute evidence
    DB-->>B: full evidence package
    B-->>M: evidence data
    M->>A: hiển thị evidence để xét xử

    A->>M: đưa ra phán quyết + ghi resolution note
    M->>B: PATCH /disputes/:id/resolve<br/>{ resolution, damage_charge_override? }

    alt Admin chấp nhận damage (Customer thua)
        B->>PE: confirm DAMAGE_CHARGE (HELD → DISBURSED)
        PE->>DB: UPDATE payment_component DAMAGE_CHARGE = DISBURSED
        Note over PE: Settle phần còn lại của SECURITY_DEPOSIT<br/>như Block 6 (có damage)
    else Admin từ chối damage (Provider thua)
        B->>PE: cancel DAMAGE_CHARGE (HELD → REFUNDED)
        PE->>DB: UPDATE payment_component DAMAGE_CHARGE = REFUNDED
        Note over PE: SECURITY_DEPOSIT → REFUNDED 100% về Customer
    else Admin điều chỉnh một phần
        B->>PE: partial: DAMAGE_CHARGE_override amount
        Note over PE: Tạo component mới với adjusted amount<br/>(Immutable ledger — không edit amount cũ)
    end

    B->>DB: UPDATE dispute.status = RESOLVED, resolved_by, resolved_at
    B->>SM: transition(bookingId, DISPUTE_RESOLVED)
    SM->>DB: UPDATE booking.status = COMPLETED
    B->>N: notify Customer + Provider "Dispute đã được giải quyết: {resolution}"
    B-->>M: { data: { disputeId, status: "RESOLVED", resolution } }
```

---

## 7b. Timeout & Cancellation Paths

```mermaid
sequenceDiagram
    autonumber
    participant B as API<br/>(Express + TS / SchedulerService)
    participant PE as PaymentEngine<br/>(PaymentsService)
    participant SM as StateMachine<br/>(BookingsService)
    participant DB as PostgreSQL
    participant N as Notify

    Note over B: Cron job hoặc scheduled task kiểm tra timeout

    alt PENDING > 30 phút chưa thanh toán
        B->>SM: transition(bookingId, TIMEOUT)
        SM->>DB: UPDATE booking.status = CANCELLED
        B->>PE: refund ALL components 100%
        B->>N: notify Customer "Booking đã hết hạn thanh toán"

    else CONFIRMED + slot_start + 30 phút chưa check-in (no-show)
        Note over B: Rule R3: no-show<br/>SLOT_FEE = 0% refund (phí hủy muộn)<br/>RENTAL_FEE = 100% refund<br/>SECURITY_DEPOSIT = 100% refund
        B->>SM: transition(bookingId, TIMEOUT)
        SM->>DB: UPDATE booking.status = CANCELLED
        B->>PE: apply R3 refund rules
        B->>N: notify Customer + Provider

    else Customer hủy thủ công (PENDING hoặc CONFIRMED)
        Note over B: Rule R1 — tùy thời điểm hủy so với slot_start:<br/>> 24h: SLOT_FEE 100% hoàn<br/>12–24h: SLOT_FEE 50% hoàn<br/>< 12h: SLOT_FEE 0% hoàn<br/>RENTAL_FEE + DEPOSIT: luôn 100% hoàn
        B->>SM: transition(bookingId, CANCELLED)
        SM->>DB: UPDATE booking.status = CANCELLED
        B->>PE: apply R1 refund per time window
        B->>N: notify Customer + Provider

    else Provider hủy (bất kỳ lúc nào)
        Note over B: Rule R2: Provider hủy<br/>Hoàn 100% TẤT CẢ components<br/>Platform KHÔNG thu phí
        B->>SM: transition(bookingId, CANCELLED)
        SM->>DB: UPDATE booking.status = CANCELLED
        B->>PE: refund ALL 100%, no platform fee
        B->>N: notify Customer "Booking bị hủy bởi Provider — hoàn tiền 100%"
    end
```

---

## 8. Decision Logic Summary

| Trạng thái booking | Điều kiện | Hành động / Routing |
|-------------------|-----------|---------------------|
| `PENDING` | Vừa tạo xong | Chờ Customer thanh toán VNPay |
| `PENDING` | > 30 phút không thanh toán | Auto-cancel, refund 100% (TIMEOUT) |
| `CONFIRMED` | Payment thành công | Chờ Staff check-in đúng slot |
| `CONFIRMED` | slot_start + 30 phút, Staff chưa check-in | Auto-cancel, apply R3 (no-show) |
| `CONFIRMED` | Customer hủy > 24h trước slot | Cancel, SLOT_FEE hoàn 100% (R1) |
| `CONFIRMED` | Customer hủy 12–24h trước slot | Cancel, SLOT_FEE hoàn 50% (R1) |
| `CONFIRMED` | Customer hủy < 12h trước slot | Cancel, SLOT_FEE hoàn 0% (R1) |
| `ACTIVE` | Đang chơi bình thường | Staff có thể propose extension |
| `ACTIVE` | Staff propose extension | → `EXTENDING`, chờ Customer approve |
| `EXTENDING` | Customer approve | → `ACTIVE`, EXTENSION_FEE HELD, slot_end tăng |
| `EXTENDING` | Customer reject / timeout | → `ACTIVE`, không tạo component |
| `ACTIVE` | Staff initiate checkout | → `CHECKING_OUT` |
| `CHECKING_OUT` | No damage, Customer confirm / 2h timeout | → `COMPLETED`, settle |
| `CHECKING_OUT` | Có damage, Customer confirm / 24h timeout | → `COMPLETED`, settle với DAMAGE_CHARGE |
| `CHECKING_OUT` | Có damage, Customer dispute | → `DISPUTED` |
| `DISPUTED` | Admin resolve | → `COMPLETED`, settle theo phán quyết |
| `DISPUTED` | > 72h chưa resolve | Escalate Admin |
| `COMPLETED` | Settlement done | Không thể mở dispute |

---

## 9. Key Files

### Backend (`rcfield-app/apps/api`) — TypeScript + Express

| Area | Path | Note |
|------|------|------|
| Booking router | `src/routes/booking.routes.ts` | CRUD + cancel + payment confirm |
| Inspection router | `src/routes/inspection.routes.ts` | check-in, check-out, confirm, dispute-damage |
| Dispute router | `src/routes/dispute.routes.ts` | open dispute, resolve (Admin) |
| Extension router | `src/routes/extension.routes.ts` | propose, approve, reject |
| Booking service | `src/services/booking.service.ts` | `transition()` — cổng duy nhất vào state machine |
| State machine | `src/services/booking.state-machine.ts` | `canTransition()`, valid transition map |
| Inspection service | `src/services/inspection.service.ts` | photo upload, checklist validation, S3 |
| Payment service | `src/services/payment.service.ts` | createComponents, settle, refund |
| Dispute service | `src/services/dispute.service.ts` | open, resolve, evidence |
| Booking model | `src/models/booking.model.ts` | TypeORM entity: snapshot, status, slot times |
| Payment component model | `src/models/payment-component.model.ts` | type, status, amount, disbursed_to |
| Scheduler | `src/jobs/booking-timeout.job.ts` | cron jobs cho timeout rules |

### Frontend (`rcfield-app/apps/web`) — ReactJS

| Area | Path | Note |
|------|------|------|
| Booking page | `src/pages/BookingPage.tsx` | Create booking form |
| Payment page | `src/pages/PaymentPage.tsx` | VNPay redirect + confirm |
| Check-in page | `src/pages/CheckinPage.tsx` | Staff: upload ảnh + checklist |
| Check-out page | `src/pages/CheckoutPage.tsx` | Staff: upload ảnh + damage flag |
| Dispute page | `src/pages/DisputePage.tsx` | Customer: open dispute |
| Admin disputes | `src/pages/admin/DisputeDetailPage.tsx` | Admin: review + resolve |
| Booking hook | `src/hooks/useBooking.ts` | fetch/mutate booking state |
| Inspection hook | `src/hooks/useInspection.ts` | upload photos, confirm |
| Payment hook | `src/hooks/usePayment.ts` | VNPay confirm flow |
| API client | `src/api/booking.api.ts` | axios calls đến Express backend |

---

## 10. Open Questions

1. **VNPay IPN vs redirect**: Hiện spec dùng `POST /bookings/:id/payment/confirm` sau khi
   Customer redirect về — cần xác nhận có cần thêm VNPay IPN (server-to-server) callback
   để đảm bảo an toàn khi Customer đóng browser giữa chừng không.

2. **Extension timeout**: Spec chưa nêu rõ Customer có bao nhiêu phút để phản hồi đề xuất
   gia hạn. Tạm dùng 10 phút — cần confirm với Product.

3. **Dispute sau ACTIVE (không phải damage)**: `DISPUTE_OPENED` event (ACTIVE → DISPUTED)
   được trigger như thế nào? Spec đề cập nhưng chưa có endpoint rõ ràng cho case này
   (khác với `dispute-damage` ở check-out).

4. **Platform fee disbursement**: Spec nêu platform fee = 15% nhưng chưa rõ cơ chế
   thực thu — trừ trực tiếp từ Provider disbursement hay tạo thêm component riêng?

5. **partial refund cho damage > deposit**: Spec note "tạo thêm charge request (manual,
   ngoài scope MVP)" — cần xác nhận API/UI cho Admin để handle trường hợp này.

---

## 11. Application Flow Overview

```mermaid
flowchart LR
    subgraph CUSTOMER["Customer (Frontend)"]
        direction TB
        C1["Tạo Booking<br/>POST /bookings"]:::happy
        C2["Thanh toán VNPay"]:::happy
        C3["Xác nhận Check-in"]:::happy
        C4["Approve/Reject Extension"]:::wait
        C5["Xác nhận Check-out"]:::happy
        C6["Dispute Damage"]:::error
        C1 --> C2 --> C3
        C3 -.-> C4
        C3 --> C5
        C5 -.-> C6
    end

    subgraph STAFF["Staff (Frontend)"]
        direction TB
        S1["Check-in<br/>4 photos + checklist"]:::happy
        S2["Propose Extension"]:::wait
        S3["Check-out<br/>4 photos + damage flag"]:::happy
        S1 -.-> S2 -.-> S1
        S1 --> S3
    end

    subgraph API["API (Express + TS)"]
        direction TB
        A1["BookingService.transition()"]:::happy
        A2["PaymentEngine.createComponents()"]:::happy
        A3["InspectionService.submit()"]:::happy
        A4["PaymentEngine.settle()"]:::happy
        A5["DisputeService"]:::error
        A1 --> A2
        A3 --> A4
        A4 -.-> A5
    end

    subgraph ADMIN["Admin"]
        direction TB
        AD1["Review Evidence"]:::wait
        AD2["PATCH /disputes/:id/resolve"]:::wait
        AD1 --> AD2
    end

    subgraph STATES["Booking Status"]
        direction TB
        P1["PENDING"]
        P2["CONFIRMED"]
        P3["ACTIVE"]
        P4["EXTENDING"]
        P5["CHECKING_OUT"]
        P6["COMPLETED"]:::happy
        P7["CANCELLED"]:::error
        P8["DISPUTED"]:::wait
        P1 --> P2 --> P3
        P3 --> P4 --> P3
        P3 --> P5 --> P6
        P5 --> P8 --> P6
        P3 --> P8
        P1 --> P7
        P2 --> P7
    end

    C1 --> A1 --> P1
    C2 --> A2 --> P2
    S1 --> A3 --> P3
    S2 --> A1 --> P4
    C4 --> A1 --> P3
    S3 --> A3 --> P5
    C5 --> A4 --> P6
    C6 --> A5 --> P8
    AD2 --> A4 --> P6

    classDef happy fill:#e6f4ea,stroke:#1e8449,color:#0d3d1f
    classDef error fill:#fde2e2,stroke:#c0392b,color:#7a1f1f
    classDef wait  fill:#fff4d6,stroke:#b8860b,color:#5c3c00
```

---

## Reference

### Related docs
- `docs/spec/00-overview.md` — Actors, scope, timeline
- `docs/spec/01-domain-model.md` — Entities, enums, BookingSnapshot structure
- `docs/spec/02-state-machine.md` — State transitions, timeout rules, BookingEvent enum
- `docs/spec/03-payment-engine.md` — Payment components, R1/R2/R3 refund rules, platform fee
- `docs/spec/04-inspection-flow.md` — Check-in/out protocol, photo validation, S3 paths
- `docs/spec/05-api-contracts.md` — Endpoint paths, request/response formats, error codes
- `docs/docs/RCField_Overview-V1.0.0.docx` — Project overview document (analyzed via Python extraction)

### Legend
- **Frontend** = `rcfield-app/apps/web` (ReactJS)
- **API** = `rcfield-app/apps/api` (TypeScript + Express)
- **SM** = `BookingsService.transition(bookingId, event)` — mọi state change đều đi qua đây
- **PE** = `PaymentsService` — mọi payment component operation đều đi qua đây
- `-->>` = response / async return
- `->>` = request / sync call
- `opt` = bước optional (có thể xảy ra hoặc không)
- `alt/else` = nhánh điều kiện
- `loop` = polling hoặc retry
- `par` = parallel fan-out

---

*Last updated: 2026-05-11 · Based on: docs/spec/00→05, RCField_Overview-V1.0.0.docx*
