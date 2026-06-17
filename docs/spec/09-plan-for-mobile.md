# 09 — Mobile App Screen Plan

> **RCField Mobile Application — Spec tổng quan màn hình**
>
> Tài liệu này xác định toàn bộ danh sách màn hình (screens) cần xây dựng cho ứng dụng di động
> RCField, phân chia theo vai trò **Customer (CUS)** và **Staff (STF)**, cùng với các màn hình dùng chung.
>
> Căn cứ từ: phân tích toàn bộ source code FE (`rcfield-fe`) và BE (`rcfield-be`) hiện tại.

---

## 1. Tổng quan kiến trúc Mobile

```
RCField Mobile App
├── Màn hình chung (SHARED)          ← Cả Staff & Customer đều dùng
│   ├── Login / Forgot Password / Reset Password
│   └── Profile & Settings
│
├── Luồng Customer (CUS)             ← Khách hàng đặt sân & chơi xe
│   ├── Explore (Khám phá sân)
│   ├── Booking Flow (Đặt lịch)
│   ├── My Bookings (Lịch sử)
│   ├── Active Session (Phiên đang chơi)
│   ├── Extension Response (Phản hồi gia hạn)
│   ├── Damage Review (Xem bằng chứng hư hại)
│   ├── Inspection Confirm (Ký biên bản)
│   ├── Payment Result
│   ├── Packages & Subscriptions
│   └── Reviews
│
└── Luồng Staff (STF)                ← Nhân viên vận hành tại sân
    ├── Staff Dashboard (Tổng quan ca trực)
    ├── Today Bookings (Lịch hôm nay + Walk-In)
    ├── Session Detail (Chi tiết ca chạy)
    ├── Inspection — Check-In (Lập biên bản nhận xe)
    ├── Inspection — Check-Out (Lập biên bản trả xe)
    ├── FnB Orders (Quản lý đơn ăn uống)
    ├── BYOC Management (Xe tự mang)
    ├── Incidents (Sự cố)
    └── Maintenance (Bảo trì xe)
```

---

## 2. Màn hình dùng chung (SHARED)

> Áp dụng cho cả **Customer** lẫn **Staff**. Điều hướng dựa vào role sau khi đăng nhập.

| #  | Screen ID           | Tên màn hình              | Mô tả chức năng                                                  | API / Service BE liên quan |
|----|---------------------|---------------------------|------------------------------------------------------------------|---------------------------|
| S1 | `shared/login`      | **Đăng nhập**             | Form email + password, nút Google OAuth. Redirect theo role sau login. | `POST /auth/login` |
| S2 | `shared/forgot-pw`  | **Quên mật khẩu**         | Nhập email, nhận OTP/link qua email để đặt lại mật khẩu.        | `POST /auth/forgot-password` |
| S3 | `shared/reset-pw`   | **Đặt lại mật khẩu**      | Form nhập mật khẩu mới + xác nhận, validate token từ email.      | `POST /auth/reset-password` |
| S4 | `shared/profile`    | **Hồ sơ cá nhân**         | Xem & sửa avatar, tên, SĐT, email, đổi mật khẩu, đăng xuất.    | `GET/PUT /profile` |

---

## 3. Luồng Customer (CUS) — Khách hàng

### 3.1 Khám phá & Đặt sân

| #   | Screen ID                        | Tên màn hình               | Mô tả chức năng                                                                                               | API liên quan |
|-----|----------------------------------|----------------------------|---------------------------------------------------------------------------------------------------------------|---------------|
| C1  | `cus/home`                       | **Trang chủ / Explore**    | Feed các chi nhánh RC có sẵn (tên, hình ảnh, địa chỉ, đánh giá). Filter theo thành phố, loại đường đua. | `GET /cafes` |
| C2  | `cus/cafe-detail/:id`            | **Chi tiết chi nhánh**     | Thông tin chi nhánh (ảnh, địa chỉ, giờ mở cửa, giá), danh sách track, menu F&B, ảnh gallery.               | `GET /cafes/:id` |
| C3  | `cus/booking/create`             | **Đặt lịch (Booking)**     | Wizard nhiều bước: chọn ngày/giờ → chọn loại xe (thuê hoặc BYOC) → nhập người tham gia → xác nhận giá → thanh toán VNPay. | `POST /bookings` |
| C4  | `cus/booking/payment-result`     | **Kết quả thanh toán**     | Hiển thị trạng thái giao dịch VNPay (thành công / thất bại / chờ xử lý), hiển thị mã booking.               | `GET /vnpay/return` |

### 3.2 Quản lý lịch đặt

| #   | Screen ID                        | Tên màn hình               | Mô tả chức năng                                                                                               | API liên quan |
|-----|----------------------------------|----------------------------|---------------------------------------------------------------------------------------------------------------|---------------|
| C5  | `cus/bookings`                   | **Lịch sử đặt sân (My Bookings)** | Danh sách tất cả booking của khách (tab: Sắp tới / Đang diễn ra / Đã kết thúc / Đã hủy). Filter theo trạng thái. | `GET /bookings?customerId=...` |
| C6  | `cus/bookings/:bookingId`        | **Chi tiết đặt sân**       | Hiển thị đầy đủ thông tin booking: thời gian, track, mode, xe, người tham gia, hoá đơn, QR check-in code, trạng thái. | `GET /bookings/:id` |

### 3.3 Phiên chơi thực tế (Live Session)

| #   | Screen ID                              | Tên màn hình                        | Mô tả chức năng                                                                                                               | API liên quan |
|-----|----------------------------------------|-------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|---------------|
| C7  | `cus/sessions/:sessionId`             | **Phiên đang chơi (Live Dashboard)**| Countdown thời gian còn lại (circular timer), danh sách xe đang chạy, lịch sử F&B đã gọi, nút liên kết. Flash alert khi Staff gửi đề xuất gia hạn hoặc phát hiện hư hại. | `GET /sessions/:id` |
| C8  | `cus/extension-response/:sessionId`   | **Phản hồi gia hạn**                | Hiển thị đề xuất gia hạn của Staff (số phút + phí). Nút Đồng ý / Từ chối. Cập nhật real-time qua websocket. | `POST /sessions/:id/extension-response` |
| C9  | `cus/damage-review/:sessionId`        | **Xem bằng chứng hư hại**           | So sánh ảnh check-in (baseline) vs ảnh check-out (thực tế), xem mô tả hư hại và số tiền bồi thường đề xuất. | `GET /sessions/:id/inspections` |
| C10 | `cus/inspection-confirm/:sessionId`   | **Ký biên bản kiểm xe**             | Khách hàng ký số (digital signature) để chấp nhận biên bản check-in xe trước khi lượt chơi bắt đầu. | `POST /sessions/:id/confirm-inspection` |

### 3.4 Gói dịch vụ & Đánh giá

| #   | Screen ID                  | Tên màn hình               | Mô tả chức năng                                                                              | API liên quan |
|-----|----------------------------|----------------------------|----------------------------------------------------------------------------------------------|---------------|
| C11 | `cus/packages`             | **Gói chơi của tôi**       | Danh sách các gói thời gian / lượt chơi đã mua, trạng thái còn lại, nút mua thêm.           | `GET /customer-packages` |
| C12 | `cus/subscriptions`        | **Đăng ký thành viên**     | Xem gói subscription đang dùng, ngày hết hạn, ưu đãi. Nút nâng cấp / gia hạn.             | `GET /subscriptions` |
| C13 | `cus/reviews`              | **Đánh giá của tôi**       | Danh sách các review đã viết, nút tạo review mới sau lượt chơi hoàn thành.                  | `GET/POST /reviews` |
| C14 | `cus/vehicles`             | **Xe của tôi (BYOC)**      | Quản lý danh sách xe tự mang: thêm, xem, xóa xe đã đăng ký.                                 | `GET/POST/DELETE /vehicles` |

---

## 4. Luồng Staff (STF) — Nhân viên vận hành

### 4.1 Tổng quan ca trực

| #   | Screen ID                   | Tên màn hình                     | Mô tả chức năng                                                                                                             | API liên quan |
|-----|-----------------------------|----------------------------------|-----------------------------------------------------------------------------------------------------------------------------|---------------|
| ST1 | `staff/dashboard`           | **Dashboard ca trực**            | Thống kê real-time: số phiên đang chạy, tổng đơn hôm nay, số đang chờ kiểm xe, số đơn F&B chờ. Hiển thị bản đồ track (Live Map) trạng thái từng làn đua. Nút QR Check-In và nút Walk-In. | `GET /staff/dashboard-summary` |

### 4.2 Check-In / Check-Out

| #   | Screen ID                               | Tên màn hình                             | Mô tả chức năng                                                                                                                               | API liên quan |
|-----|-----------------------------------------|------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| ST2 | `staff/today-bookings`                  | **Lịch đặt hôm nay**                    | Danh sách booking trong ngày, filter theo trạng thái (PENDING / CONFIRMED / COMPLETED / CANCELLED). Tìm kiếm theo tên khách. Nút "Check-In bàn giao" cho từng booking đã xác nhận. Countdown đếm ngược giờ bắt đầu. | `GET /staff/today-bookings` |
| ST3 | `staff/today-bookings?tab=walkin`       | **Tạo đơn Walk-In**                     | Form tạo nhanh ca chơi trực tiếp cho khách vãng lai: nhập tên khách, SĐT, chọn mode (RENTAL/BYOC/MIXED), chọn đường đua, thời lượng, chọn xe. Xem chi tiết hóa đơn dự kiến. | `POST /bookings/walk-in` |
| ST4 | `staff/checkin-scan`                    | **Quét QR Check-In**                    | Camera quét QR hoặc nhập mã shortcode thủ công. Validation tự động trạng thái booking. Redirect sang màn hình session detail khi thành công. | `POST /bookings/:id/checkin` |
| ST5 | `staff/sessions/:sessionId`             | **Chi tiết ca chạy (Session Detail)**   | Hiển thị timer đếm ngược, thông tin khách & xe. 3 module hoạt động chính: (1) Gia hạn +15/30/60 phút, (2) Đổi xe thực tế (Vehicle Swap), (3) Gọi món F&B. Nút "Lập biên bản Check-In" (khi status=CHECKED_IN) và "Kiểm xe thu hồi Check-Out" (khi status=ACTIVE). Quyết toán hóa đơn cuối. | `GET/PUT /sessions/:id` |

### 4.3 Biên bản kiểm xe (Inspection)

| #   | Screen ID                                        | Tên màn hình                                | Mô tả chức năng                                                                                                                                                     | API liên quan |
|-----|--------------------------------------------------|---------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| ST6 | `staff/inspection?sessionId=...&type=CHECK_IN`   | **Biên bản bàn giao (Check-In Inspection)** | Chụp ảnh 4 góc xe (FRONT/BACK/LEFT/RIGHT) bằng camera. Checklist an toàn linh kiện: pin, servo, lốp, remote. Ghi chú tổng quan. Submit để khởi động phiên chơi. | `POST /sessions/:id/inspections` |
| ST7 | `staff/inspection?sessionId=...&type=CHECK_OUT`  | **Biên bản thu hồi (Check-Out Inspection)** | Chụp ảnh 4 góc xe sau khi chơi. So sánh side-by-side với ảnh Check-In gốc. Checklist tình trạng xe. Đánh dấu hư hại (nếu có): nhập mô tả, kéo thanh ước tính chi phí, hệ số nhân xe premium. Tự động tính số tiền khấu trừ từ cọc. | `POST /sessions/:id/inspections` |

### 4.4 Vận hành phụ trợ

| #    | Screen ID                  | Tên màn hình               | Mô tả chức năng                                                                                          | API liên quan |
|------|----------------------------|----------------------------|----------------------------------------------------------------------------------------------------------|---------------|
| ST8  | `staff/fnb-orders`         | **Đơn F&B hôm nay**        | Danh sách tất cả đơn ăn uống trong ca, filter PENDING/PREPARING/SERVED/CANCELLED. Cập nhật trạng thái từng đơn. | `GET/PUT /fnb-orders` |
| ST9  | `staff/byoc`               | **Quản lý xe tự mang (BYOC)** | Danh sách xe BYOC của khách đã đăng ký lượt chơi, xác nhận xe đã qua kiểm định an toàn trước khi cho xuống làn. | `GET /staff/byoc-vehicles` |
| ST10 | `staff/incidents`          | **Báo cáo sự cố**          | Xem danh sách sự cố trong ngày. Tạo sự cố mới: loại sự cố, mô tả, ảnh, xe liên quan, mức độ nghiêm trọng. | `GET/POST /incidents` |
| ST11 | `staff/maintenance`        | **Bảo trì xe**             | Danh sách xe cần bảo trì hoặc đang bảo trì, xem lịch sử bảo trì. Cập nhật trạng thái từ MAINTENANCE → AVAILABLE. | `GET/PUT /vehicles/units/:id` |
| ST12 | `staff/packages`           | **Gói chơi khách hàng**    | Xem danh sách gói thời gian của khách (khi khách check-in sử dụng gói thay vì thanh toán trực tiếp). Validate và áp dụng gói. | `GET /customer-packages` |
| ST13 | `staff/shifts`             | **Thông tin ca làm việc**  | Xem ca được phân công, chi nhánh phụ trách, giờ bắt đầu/kết thúc ca. Xác nhận đi làm đúng giờ.         | `GET /shifts/my-shift` |

---

## 5. Ưu tiên phát triển (Priority Matrix)

### Phase 1 — MVP (Phải có)

> Các màn hình cốt lõi để vận hành được một ca chơi từ đầu đến cuối.

**Staff:**
- [ ] ST1 Dashboard ca trực
- [ ] ST2 Lịch đặt hôm nay
- [ ] ST4 Quét QR Check-In
- [ ] ST5 Chi tiết ca chạy (Session Detail)
- [ ] ST6 Biên bản Check-In Inspection
- [ ] ST7 Biên bản Check-Out Inspection

**Customer:**
- [ ] S1 Đăng nhập
- [ ] C1 Explore / Trang chủ
- [ ] C3 Đặt lịch
- [ ] C4 Kết quả thanh toán
- [ ] C5 Lịch sử đặt sân
- [ ] C6 Chi tiết đặt sân (có QR code)
- [ ] C7 Phiên đang chơi (Live Session)

**Shared:**
- [ ] S1 Đăng nhập
- [ ] S4 Hồ sơ cá nhân

### Phase 2 — Hoàn thiện nghiệp vụ

**Staff:**
- [ ] ST3 Walk-In booking form
- [ ] ST8 Đơn F&B hôm nay
- [ ] ST9 Xe BYOC
- [ ] ST10 Báo cáo sự cố
- [ ] ST11 Bảo trì xe
- [ ] ST13 Ca làm việc

**Customer:**
- [ ] C8 Phản hồi gia hạn
- [ ] C9 Xem bằng chứng hư hại
- [ ] C10 Ký biên bản kiểm xe
- [ ] C2 Chi tiết chi nhánh
- [ ] S2 Quên mật khẩu
- [ ] S3 Đặt lại mật khẩu

### Phase 3 — Nâng cao trải nghiệm

- [ ] C11 Gói chơi của tôi
- [ ] C12 Đăng ký thành viên
- [ ] C13 Đánh giá của tôi
- [ ] C14 Xe của tôi (BYOC)
- [ ] ST12 Validate gói chơi
- [ ] Push notification (Gia hạn, hư hại, F&B sẵn sàng)

---

## 6. Tổng kết số lượng màn hình

| Nhóm       | Số màn hình |
|------------|-------------|
| Shared     | 4           |
| Customer   | 14          |
| Staff      | 13          |
| **Tổng**   | **31**      |

---

## 7. Navigation Structure

### Customer Bottom Tab Bar

```
[🏠 Khám phá] [📅 Lịch sử] [🎮 Phiên live] [📦 Gói của tôi] [👤 Hồ sơ]
```

### Staff Bottom Tab Bar

```
[📊 Trực Ca] [📋 Lịch Hôm Nay] [🍔 F&B] [⚠️ Sự Cố / Bảo Trì] [👤 Hồ Sơ]
```

---

## 8. Luồng dữ liệu chính (Key Flows)

### Flow 1: Customer Đặt Sân & Chơi

```
C1 (Explore) → C2 (Chi tiết chi nhánh) → C3 (Booking Wizard)
→ C4 (Kết quả thanh toán) → C6 (Chi tiết booking + QR)
→ [Đến sân] → ST4 (Staff quét QR) → ST6 (Biên bản check-in)
→ C10 (Khách ký biên bản) → C7 (Live Session Dashboard)
→ [Hết giờ] → ST7 (Biên bản check-out) → C9 (Xem bằng chứng nếu có hư hại)
→ Hoàn thành → C13 (Đánh giá)
```

### Flow 2: Staff Xử lý Walk-In

```
ST1 (Dashboard) → ST3 (Form Walk-In) → ST5 (Session Detail)
→ ST6 (Check-In Inspection) → [Customer ký] → ST5 (Session đang chạy)
→ [Hết giờ / Checkout] → ST7 (Check-Out Inspection)
```

### Flow 3: Gia hạn thời gian

```
ST5 (Staff đề xuất gia hạn) → C8 (Customer nhận notification)
→ C8 (Đồng ý / Từ chối) → ST5 (Cập nhật timer)
```

### Flow 4: Phát hiện hư hại

```
ST7 (Staff đánh dấu hư hại + ước tính chi phí)
→ C9 (Customer nhận alert → xem ảnh so sánh)
→ Khấu trừ từ tiền đặt cọc tự động
```

---

## 9. Ghi chú kỹ thuật Mobile

### 9.1 Permissions cần thiết
- **Camera**: Bắt buộc cho Inspection (chụp ảnh 4 góc xe)
- **Camera (QR Scanner)**: Cần cho Staff quét mã check-in
- **Notifications (Push)**: Cho gia hạn, hư hại, F&B alerts

### 9.2 Offline considerations
- Màn hình Live Session (C7) cần fallback khi mất mạng
- Biên bản inspection nên có queue để sync khi có kết nối

### 9.3 Real-time (WebSocket)
- `C7` — Customer nhận push về gia hạn / hư hại / hết giờ
- `C8` — Extension response cần real-time (timeout 10 phút)
- `ST5` — Staff nhận confirm từ khách real-time

### 9.4 Tích hợp VNPay
- Màn hình `C3` trigger VNPay Deep Link / In-app WebView
- Màn hình `C4` xử lý callback từ VNPay (success/fail/pending)

---

*Tài liệu cập nhật: 2026-06-17*
*Căn cứ: rcfield-fe source code (pages/staff, pages/customer, pages/booking, pages/auth) + rcfield-be controllers & services*
