# 00 — Project Overview

**Last updated**: 2026-05-13  
**Status**: Active

---

## Tên đề tài

- **English**: RCField – RC Car Field Operations & Booking Platform  
- **Vietnamese**: Nền tảng Số hóa Vận hành và Đặt lịch Sân Xe RC  
- **Mã**: SU26SE098 | **GVHD**: Nguyễn Minh Sang

---

## Bối cảnh

Sân xe RC (Radio-Controlled Car) là mô hình giải trí trải nghiệm đang nổi tại Việt Nam. Các địa điểm này thường được gọi là "cafe xe RC" theo tên thông dụng.

**RCField** là phần mềm B2B bán cho **1 doanh nghiệp** vận hành chuỗi sân xe RC. Doanh nghiệp đó có nhiều **chi nhánh** (branches) ở các địa điểm khác nhau — mỗi chi nhánh có config riêng (giá, đội xe, menu F&B) nhưng dùng chung 1 hệ thống. Không phải marketplace nhiều thương hiệu — giống mô hình chuỗi hơn là sàn thương mại điện tử.

RCField số hóa toàn bộ vận hành: đặt lịch, thuê xe, bàn giao tài sản có bằng chứng, thanh toán, và quản lý F&B.

Hai nhóm khách:

- **RENTAL customers**: vãng lai, thuê xe của quán, không cần mang xe riêng
- **BYOC customers** (Bring Your Own Car): hobbyist, mang xe cá nhân đến luyện tập / giao lưu

**Pain points hiện tại:**

| Vấn đề | Hậu quả |
|--------|---------|
| Đặt lịch qua Zalo/điện thoại | Double-booking, bỏ sót, mất khách |
| Không có bằng chứng bàn giao xe | Tranh chấp hư hỏng không giải quyết được |
| Quản lý đội xe bằng sổ tay | Xe hỏng vẫn cho thuê, mất doanh thu |
| Tính tiền thủ công | Sai sót hoàn tiền, thất thoát |

---

## Giải pháp

RCField là **B2B SaaS** cho chuỗi sân xe RC, kết hợp:
1. **Multi-branch management** — 1 Provider quản lý nhiều chi nhánh, mỗi chi nhánh config độc lập
2. **Operations digitalization** — booking, fleet, inspection, payment, F&B
3. **Evidence-based handover** — ảnh 4 góc + checklist tại mọi điểm bàn giao tài sản
4. **Dispute resolution** — admin xét xử dựa trên digital evidence

**Booking channels** — khách có thể đặt lịch qua:
- App trực tiếp (Customer tự đặt)
- Link chia sẻ (Provider paste lên Zalo/FB → khách bấm vào đặt)
- Thủ công (Staff tạo booking trên app cho khách walk-in / gọi điện)

---

## Actors

| Actor | Mô tả | App |
|-------|-------|-----|
| **Customer** | Đặt lịch, chọn F&B pre-order, thanh toán, xác nhận check-in/out, đánh giá | Web (mobile-first) |
| **Provider** | Chủ quán: quản lý hồ sơ, đội xe, menu F&B, xem doanh thu | Web |
| **Staff** | Nhân viên quán: check-in/out, ghi F&B order, đề xuất gia hạn | Web (mobile-first) |
| **Admin** | Platform: duyệt quán, xử lý dispute, monitor | Web |

---

## Scope (In / Out)

### Trong scope (MVP)
- Venue listing & discovery
- Booking lifecycle (RENTAL + BYOC)
- Multi-channel booking (app / link chia sẻ / thủ công)
- Asset Risk Tier classification
- Check-in / Check-out inspection với photo evidence
- Slot extension proposal + notification khi gần hết giờ
- F&B management: pre-order khi đặt lịch + ghi order tại quán
- Component-based payment (gateway TBD)
- Dispute resolution
- Provider analytics dashboard (xe + F&B)
- Full test suite + deployment

### Ngoài scope (Phase 2)
- Tournament management
- Marketplace (mua bán xe, phụ kiện)
- Loyalty program
- Dynamic pricing
- Mobile app native

---

## Timeline

| Giai đoạn | Thời gian | Nội dung |
|-----------|-----------|---------|
| TP-1 Core Platform | Tháng 1-2 | Auth, booking lifecycle, fleet, state machine |
| TP-2 Inspection & Payment | Tháng 2-3 | Check-in/out, payment engine, dispute |
| TP-3 Analytics & Testing | Tháng 3-4 | Dashboard, testing, deployment, docs |

**Tổng**: 04/2026 → 08/2026
