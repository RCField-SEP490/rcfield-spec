# Feature Specification: Dynamic Pricing

**Feature Branch**: `003-fb-messenger-channel` (working on existing branch)
**Created**: 2026-06-17
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Provider Configures Pricing Rules (Priority: P1)

Provider muốn đặt giá khác nhau cho từng khung thời gian trong tuần để tối ưu doanh thu — cuối tuần và giờ cao điểm thường đông hơn nên cần giá cao hơn.

**Why this priority**: Đây là core của feature. Nếu không có khả năng cấu hình, toàn bộ dynamic pricing không hoạt động.

**Independent Test**: Provider đăng nhập dashboard, vào trang pricing của cafe, set multiplier cho weekend = 1.5, lưu lại. Tạo booking vào ngày thứ 7 → giá hiển thị = base price × 1.5.

**Acceptance Scenarios**:

1. **Given** Provider đã đăng nhập và chọn cafe cần cấu hình, **When** Provider đặt weekend multiplier = 1.5 và lưu, **Then** hệ thống lưu cấu hình thành công và hiển thị lại giá trị đã lưu.
2. **Given** Pricing config đã được lưu, **When** khách tạo booking vào thứ 7, **Then** slot fee hiển thị = base price × 1.5.
3. **Given** Provider chưa cấu hình multiplier, **When** khách tạo booking bất kỳ ngày nào, **Then** hệ thống dùng base price (multiplier mặc định = 1.0).
4. **Given** Provider đặt peak hours 18:00–21:00 với multiplier = 1.3, **When** khách chọn slot 19:00–20:00 ngày thường, **Then** slot fee = base price × 1.3.
5. **Given** Slot rơi vào cuối tuần VÀ peak hours, **When** tính giá, **Then** hệ thống dùng multiplier cao nhất (1.5 hoặc 1.3, không nhân chồng).

---

### User Story 2 - Provider Quản Lý Ngày Lễ (Priority: P2)

Provider muốn áp dụng giá đặc biệt vào ngày lễ quốc gia và các sự kiện riêng của quán (khai trương, giải đấu địa phương).

**Why this priority**: Ngày lễ là dịp đông khách nhất, nếu không có pricing riêng thì bỏ qua cơ hội tăng doanh thu lớn.

**Independent Test**: Provider vào trang holiday management, xem danh sách ngày lễ quốc gia (30/4, 1/5, Tết...) đã có sẵn, thêm ngày khai trương riêng với multiplier = 2.0. Tạo booking vào ngày đó → giá = base × 2.0.

**Acceptance Scenarios**:

1. **Given** Provider vào trang quản lý ngày lễ, **When** trang load, **Then** danh sách ngày lễ quốc gia Việt Nam năm hiện tại đã hiển thị sẵn (không cần nhập thủ công).
2. **Given** Provider thêm custom date "Ngày khai trương" 20/07/2026 với multiplier = 2.0, **When** lưu, **Then** ngày đó xuất hiện trong danh sách với label tùy chọn.
3. **Given** Custom holiday đã tạo, **When** khách booking slot ngày 20/07/2026, **Then** giá = base price × 2.0.
4. **Given** Provider muốn xóa một custom holiday, **When** xóa, **Then** booking sau đó vào ngày đó dùng giá thường.
5. **Given** Ngày lễ quốc gia trong danh sách system, **When** Provider cố xóa, **Then** hệ thống không cho xóa (chỉ allow override multiplier).

---

### User Story 3 - Booking Tự Động Áp Giá Đúng (Priority: P1)

Khi khách tạo booking, hệ thống tự động tính đúng giá cho ngày/giờ được chọn mà không cần khách hay staff làm gì thêm.

**Why this priority**: Đây là integration point — nếu booking không apply đúng giá thì cả feature vô nghĩa.

**Independent Test**: Tạo booking ngày thường giờ thường → giá base. Tạo booking thứ 7 → giá × weekend multiplier. Đổi pricing sau khi booking CONFIRMED → booking cũ giữ nguyên giá cũ.

**Acceptance Scenarios**:

1. **Given** Khách chọn slot ngày thường, **When** xem tổng tiền trước khi thanh toán, **Then** slot fee = base price × 1.0.
2. **Given** Khách chọn slot thứ 7 tuần tới, **When** xem tổng tiền, **Then** slot fee = base price × weekend multiplier của cafe đó.
3. **Given** Khách đã CONFIRMED booking với giá X, **When** Provider đổi weekend multiplier lên cao hơn, **Then** booking đã confirm vẫn giữ nguyên giá X (snapshot bất biến).
4. **Given** Cafe chưa setup pricing, **When** khách tạo booking, **Then** hệ thống dùng base price, không báo lỗi.
5. **Given** Khách xem lịch sử booking, **When** xem chi tiết, **Then** thấy rõ giá tại thời điểm đặt (không phải giá hiện tại).

---

### User Story 4 - Booking UI Hiển Thị Giá Dynamic (Priority: P1)

Khi khách chọn slot rơi vào cuối tuần, ngày lễ, hoặc giờ cao điểm, UI booking phải hiển thị rõ giá thực tế kèm nhãn lý do — khách không bị bất ngờ khi checkout.

**Why this priority**: Nếu khách không thấy giá cao hơn trước khi confirm, sẽ gây khiếu nại và mất tin tưởng. Cần làm song song với US3.

**Independent Test**: Chọn slot thứ 7 → thấy "75k/h (Cuối tuần)" thay vì "50k/h". Chọn slot ngày thường → thấy "50k/h" không có label. Chọn slot 30/4 → thấy "100k/h (Ngày lễ 30/4)".

**Acceptance Scenarios**:

1. **Given** Khách đang chọn slot trên booking UI, **When** slot đó rơi vào ngày thường, **Then** hiển thị giá bình thường, không có label bổ sung.
2. **Given** Khách chọn slot thứ 7 hoặc chủ nhật, **When** cafe có weekend multiplier, **Then** hiển thị "Xk/h (Cuối tuần)" — X là base price × multiplier.
3. **Given** Khách chọn slot vào ngày lễ quốc gia (30/4, 1/5, Tết...), **When** cafe có holiday multiplier, **Then** hiển thị "Xk/h (Ngày lễ [tên ngày])".
4. **Given** Khách chọn slot trong peak hours, **When** cafe có peak multiplier, **Then** hiển thị "Xk/h (Giờ cao điểm)".
5. **Given** Slot vừa là cuối tuần vừa là peak hours, **When** hiển thị label, **Then** chỉ hiện label của rule có multiplier cao nhất.
6. **Given** Khách xem tổng tiền trước khi confirm, **When** booking có dynamic pricing, **Then** tổng tiền phản ánh đúng giá đã nhân multiplier.

---

### Edge Cases

- Điều gì xảy ra nếu Provider đổi base price sau khi đã có booking CONFIRMED? → Snapshot giữ nguyên giá cũ.
- Slot nằm đúng ranh giới peak hours (ví dụ 21:00 — kết thúc peak) → Áp dụng peak multiplier nếu slot START trong khung peak.
- Provider set multiplier = 0? → Hệ thống validate: multiplier phải ≥ 1.0.
- Cùng một ngày vừa là ngày lễ quốc gia vừa là cuối tuần → Dùng multiplier cao nhất trong số các rule áp dụng.
- Cafe không có base price? → Không cho tạo booking, hiển thị thông báo "Cafe chưa cấu hình giá".
- Pricing service lỗi khi tạo booking? → Trả lỗi `PRICING_LOOKUP_FAILED` (500), booking không được tạo.
- Provider thêm custom holiday trùng ngày lễ quốc gia → Dùng multiplier cao hơn trong hai.
- SYSTEM holiday chưa được provider set override (effective = 1.0) → Không hiện trong danh sách `upcoming_holidays` trả về cho khách — không có tác động giá nên không cần thông báo.
- Provider set hai khung peak hours overlap nhau (ví dụ 12:00–14:00 và 13:00–15:00) → Hệ thống từ chối, trả lỗi `OVERLAPPING_PEAK_HOURS`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Base price (VND/hour) per cafe được chỉnh trong Cafe Settings (không phải trong Pricing Dashboard). Pricing Dashboard chỉ quản lý multiplier và ngày lễ.
- **FR-002**: Provider MUST be able to set a weekend multiplier (Saturday & Sunday) per cafe.
- **FR-003**: Provider MUST be able to set peak hours (start time, end time, multiplier) per cafe — multiple peak hour windows allowed.
- **FR-004**: System MUST provide a pre-populated list of Vietnamese national holidays for the current year and next year.
- **FR-005**: Provider MUST be able to override the multiplier of any system-provided national holiday for their own cafe — override is per-cafe, does not affect other cafes or the system default.
- **FR-006**: Provider MUST be able to add custom holiday dates with a label and multiplier.
- **FR-007**: Provider MUST be able to edit or delete custom holiday dates AND edit their per-cafe override of system holidays.
- **FR-008**: System MUST NOT allow deletion of system-provided national holidays. Provider can only override the multiplier, not the date or name.
- **FR-009**: When multiple pricing rules apply to the same slot (e.g., weekend + peak hours), system MUST apply the single highest multiplier only (no stacking).
- **FR-010**: At booking creation, system MUST automatically look up the applicable pricing rule for the selected slot date and time.
- **FR-011**: Calculated slot fee MUST be stored in booking snapshot at time of booking creation.
- **FR-012**: Changes to pricing configuration MUST NOT affect bookings already in CONFIRMED status or beyond.
- **FR-013**: System MUST validate that multiplier values are ≥ 1.0.
- **FR-014**: System MUST validate that base price is > 0 before allowing bookings for that cafe.
- **FR-015**: Pricing configuration MUST be per-cafe (not per-track, not per-provider globally).
- **FR-016**: Booking UI MUST display the effective price per hour alongside a label indicating the pricing rule applied (e.g., "75k/h (Cuối tuần)", "100k/h (Ngày lễ 30/4)", "65k/h (Giờ cao điểm)").
- **FR-017**: When a slot has normal (weekday, non-peak) pricing, booking UI MUST display price without any label.
- **FR-018**: When multiple pricing rules apply to a slot, booking UI MUST show only the label of the highest-multiplier rule.
- **FR-019**: The order summary before payment confirmation MUST reflect the dynamic price, not the base price.
- **FR-020**: Booking UI MUST fetch pricing for all slots of a selected date in a single API call (not per-slot). Triggered once when user selects a date.
- **FR-021**: Public pricing endpoint MUST only include holidays in `upcoming_holidays` when their effective multiplier > 1.0. SYSTEM holidays without a per-cafe override MUST NOT appear in this list.
- **FR-022**: System MUST reject peak hour configurations where two or more windows overlap. Returns `OVERLAPPING_PEAK_HOURS` error.

### Key Entities

- **CafePricingConfig**: Giá base và multiplier mặc định (weekend, holiday) cho một cafe. Mỗi cafe có đúng một config.
- **PeakHourRule**: Khung giờ cao điểm của một cafe — có thể có nhiều rule (ví dụ: 12:00-14:00 và 18:00-21:00). Mỗi rule có start_time, end_time, multiplier.
- **HolidayRule**: Ngày đặc biệt với multiplier. Có 2 loại: SYSTEM (ngày lễ quốc gia, không xóa được) và CUSTOM (Provider tự thêm, có label).
- **BookingSnapshot** (mở rộng entity hiện có): Đã có sẵn trong domain — cần đảm bảo lưu `applied_multiplier` và `pricing_rule_type` (WEEKDAY / WEEKEND / HOLIDAY / PEAK) tại thời điểm booking.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Provider có thể hoàn thành cấu hình pricing đầy đủ (base price + multipliers + 1 custom holiday) trong dưới 3 phút.
- **SC-002**: Giá hiển thị khi khách chọn slot phản ánh đúng pricing rule của ngày/giờ đó trong 100% trường hợp.
- **SC-003**: Booking đã CONFIRMED không bao giờ bị thay đổi giá khi Provider cập nhật pricing config.
- **SC-004**: Danh sách ngày lễ quốc gia Việt Nam năm hiện tại được cung cấp sẵn — Provider không cần nhập thủ công bất kỳ ngày lễ nào trong năm.
- **SC-005**: Khi nhiều rule cùng áp dụng, giá tính ra luôn nhất quán (không có trường hợp giá khác nhau cho cùng 1 slot khi test lại nhiều lần).

---

## Clarifications

### Session 2026-06-17

- Q: Base price update — chỉnh trong Pricing Dashboard hay Cafe Settings? → A: Base price chỉnh trong Cafe Settings. Pricing Dashboard chỉ quản lý multiplier và holidays.
- Q: Override multiplier ngày lễ quốc gia — Provider có đổi được không? → A: Có. Provider đổi được multiplier của SYSTEM holiday cho riêng cafe mình — hệ thống lưu override per-cafe, không ảnh hưởng cafe khác.
- Q: Khi nào UI booking gọi API lấy giá? → A: Gọi 1 lần khi khách chọn ngày, load giá cho tất cả slot trong ngày đó.
- Q: Nếu pricing lookup lỗi khi tạo booking thì sao? → A: Booking fail, trả lỗi cho khách — không fallback về base price để tránh charge sai giá.

---

## Assumptions

- Pricing config apply cho tất cả track trong một cafe — không có pricing riêng per-track.
- "Weekend" được định nghĩa là thứ 7 và chủ nhật theo giờ địa phương (UTC+7).
- Peak hours áp dụng mọi ngày trong tuần (kể cả cuối tuần) — nếu cuối tuần có peak hours, dùng multiplier cao nhất.
- Danh sách ngày lễ quốc gia do team RCField maintain và cập nhật hàng năm — không phải realtime từ API ngoài.
- Multiplier tối đa không bị giới hạn bởi hệ thống (Provider tự chịu trách nhiệm business decision).
- Pricing config có thể thay đổi bất kỳ lúc nào — chỉ ảnh hưởng booking tạo SAU khi thay đổi.
- Base price tính theo đơn vị VND/giờ — khớp với unit hiện tại trong domain model.
- Feature này là prerequisite cho Walk-in Booking (spec 010) vì walk-in cũng cần tính đúng giá theo ngày/giờ.
