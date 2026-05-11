# 00 — Project Overview

**Last updated**: 2026-05  
**Status**: Active

---

## Tên đề tài

- **English**: RCField – RC Car Field Operations & Booking Platform  
- **Vietnamese**: Nền tảng Số hóa Vận hành và Đặt lịch Sân Xe RC  
- **Mã**: SU26SE098 | **GVHD**: Nguyễn Minh Sang

---

## Bối cảnh

Sân xe RC (Radio-Controlled Car) là mô hình giải trí trải nghiệm đang nổi tại Việt Nam. Các địa điểm này thường được gọi là "cafe xe RC" theo tên thông dụng, nhưng **RCField chỉ số hóa phần vận hành xe** — đặt lịch, thuê xe, bàn giao tài sản, thanh toán. Đồ uống / F&B tại quán là dịch vụ ngoài app, khách tự thanh toán trực tiếp tại quán.

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

RCField là **vertical SaaS marketplace** kết hợp:
1. **Operations digitalization** — booking, fleet, inspection, payment
2. **Evidence-based handover** — ảnh 4 góc + checklist tại mọi điểm bàn giao tài sản
3. **Dispute resolution** — admin xét xử dựa trên digital evidence

---

## Actors

| Actor | Mô tả | App |
|-------|-------|-----|
| **Customer** | Đặt lịch, thuê xe / BYOC, thanh toán, đánh giá | Web (mobile-first) |
| **Provider** | Chủ quán: quản lý hồ sơ, đội xe, analytics | Web |
| **Staff** | Nhân viên quán: check-in/out, gia hạn | Web (mobile-first) |
| **Admin** | Platform: duyệt quán, xử lý dispute, monitor | Web |

---

## Scope (In / Out)

### Trong scope (MVP)
- Cafe listing & discovery
- Booking lifecycle (RENTAL + BYOC)
- Asset Risk Tier classification
- Check-in / Check-out inspection với photo evidence
- Slot extension proposal
- Component-based payment (VNPay sandbox)
- Dispute resolution
- Provider analytics dashboard
- Full test suite + deployment

### Ngoài scope (mọi phase)
- **F&B / đồ uống** — khách tự mua trực tiếp tại quán, không qua app
- **POS / order đồ ăn uống** — không thuộc RCField

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
