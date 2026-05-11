# ADR-002 — Mô hình UI & Tenant: Marketplace hay SaaS per-tenant?

**Ngày tạo**: 2026-05-11
**Cập nhật**: 2026-05-11
**Trạng thái**: Đề xuất **Mô hình C** — chờ mentor xác nhận
**Người đặt vấn đề**: Team RCField

---

## Bối cảnh

RCField phục vụ nhiều sân xe RC (Provider) trên cùng một platform. Mỗi sân có fleet,
staff, và booking riêng. Câu hỏi phát sinh khi team bắt đầu thiết kế kiến trúc:

> **Customer trải nghiệm platform theo mô hình nào — thấy tất cả sân hay chỉ thấy một sân?**

Câu trả lời quyết định cách thiết kế database, auth, API, và toàn bộ UI routing.

---

## Ba mô hình đang cân nhắc

### Mô hình A — Thuần Marketplace

```
rcfield.vn

Customer → duyệt danh sách sân → lọc quận/track → chọn sân → đặt lịch
```

- Customer có 1 tài khoản, thấy và đặt được tất cả sân
- Provider hiện diện công khai trên sàn chung
- Revenue model: platform thu commission per booking

---

### Mô hình B — Thuần SaaS per-tenant

```
san-a.rcfield.vn    san-b.rcfield.vn    san-c.rcfield.vn
(Sân A)             (Sân B)             (Sân C)
```

- Mỗi sân có subdomain/app riêng, customer của sân A không biết sân B tồn tại
- Provider trả subscription fee để dùng phần mềm
- Không có discovery / listing chung

---

### Mô hình C — Hybrid (Marketplace + SaaS workspace)

```
rcfield.vn                          ← 1 domain duy nhất

[Phía Customer]
  /explore          → browse tất cả sân, lọc theo khu vực / loại track
  /venues/:id       → trang chi tiết từng sân
  /bookings         → lịch sử booking của customer (nhiều sân)

[Phía Provider]
  /dashboard        → Provider A chỉ thấy data sân của mình
  /dashboard        → Provider B chỉ thấy data sân của mình
```

- **Customer**: Marketplace experience — 1 tài khoản, browse nhiều sân, đặt lịch bất kỳ
- **Provider**: SaaS workspace — isolated, chỉ thấy và quản lý data của sân mình
- **Giống Airbnb**: guest browse nhiều nhà, mỗi host có dashboard độc lập

---

## Bằng chứng từ Requirements (RCField_Overview-V1.0.0.docx)

Team đã đọc lại requirements gốc và tìm thấy các điểm sau:

**Section 6.2 — Web App Customer** ghi rõ:
> *"Tìm kiếm và khám phá quán RC theo **khu vực**, loại đường đua"*
> *"Đặt lịch theo chế độ RENTAL hoặc BYOC"*
> *"Xác nhận kết quả check-in/check-out; **đánh giá quán** sau khi kết thúc phiên"*

→ Customer thấy **nhiều sân**, tìm theo khu vực → Marketplace aspect rõ ràng.

**Section 3.1 — Browse & Book:**
> *"Khách hàng tìm kiếm quán theo khu vực, loại đường đua (drift, leo dốc, chướng ngại vật)"*

→ Discovery / listing là tính năng cốt lõi, không phải optional.

**Revenue model** (đã có trong spec `03-payment-engine.md`):
> Platform fee = **15% per booking** → commission model → platform là trung gian

Tất cả bằng chứng đều trỏ về **Mô hình C**.

---

## So sánh 3 mô hình

| Tiêu chí | Mô hình A | Mô hình B | Mô hình C |
|----------|-----------|-----------|-----------|
| Customer thấy nhiều sân | Có | Không | Có |
| Provider data isolated | Không rõ | Có (subdomain) | Có (row-level) |
| Discovery / listing | Cần | Không cần | Cần |
| Auth | 1 tài khoản | Tài khoản riêng per sân | 1 tài khoản |
| Domain | 1 domain | Subdomain per tenant | 1 domain |
| Revenue model | Commission | Subscription | Commission |
| Phù hợp requirement | Gần đúng | Không phù hợp | Phù hợp nhất |
| Độ phức tạp MVP | Thấp–Trung | Cao | Trung |

---

## Đề xuất của team: Mô hình C

Dựa trên requirements, team đề xuất **Mô hình C — Hybrid**, vì:

1. Requirements ghi rõ Customer tìm kiếm theo khu vực → cần listing chung
2. Platform fee 15% per booking → cần transaction đi qua platform trung gian
3. Provider quản lý sân riêng → data isolated, không thấy chéo nhau
4. Độ phức tạp vừa phải, phù hợp timeline SEP490

---

## Câu hỏi cần mentor xác nhận

Dù requirement khá rõ, vẫn còn 3 điểm chưa được document ghi tường minh:

**Câu hỏi 1 — Scope discovery trong MVP**
> Feature "tìm kiếm và khám phá sân" có ưu tiên cao trong TP-1 không,
> hay có thể defer sang TP-3 để tập trung vào booking lifecycle trước?

**Câu hỏi 2 — Provider có thể "private" không?**
> Có sân nào muốn dùng RCField như phần mềm nội bộ (không hiện trên listing công khai)?
> Nếu có, cần thêm field `is_public` vào Cafe entity.

**Câu hỏi 3 — Platform fee disbursement**
> 15% platform fee được thu theo cơ chế nào:
> a) Tự động trừ trực tiếp khỏi số tiền disburse cho Provider (đơn giản hơn)
> b) Tạo thêm PaymentComponent riêng type `PLATFORM_FEE`
> Cơ chế (a) hay (b) — hay khác?

---

## Tác động kiến trúc (sau khi mentor confirm)

Nếu Mô hình C được xác nhận, các quyết định thiết kế tiếp theo:

- **Database**: Shared DB, row-level isolation qua `provider_id` / `cafe_id`
- **RBAC middleware**: Mọi Provider query phải auto-filter theo `cafe_id` thuộc sở hữu
- **API**: Public endpoints cho listing (`GET /venues`), auth-required cho management
- **Frontend routing**: `/explore` (public) tách biệt với `/dashboard` (Provider-only)

---

*Tạo: 2026-05-11 · Cần mentor xác nhận 3 câu hỏi trên trước khi thiết kế DB schema*
