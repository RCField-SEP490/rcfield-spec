# BR-Fleet — Quy tắc nghiệp vụ: Quản lý Đội xe

**Last updated**: 2026-05-14  
**Status**: Active

---

## 1. Asset Tier

**BR-FL-001** — Phân loại tier  
Ba tier cho xe trong fleet, theo thứ tự tăng dần về giá trị và rủi ro:

| Tier | Deposit | Damage multiplier | Ai được thuê |
|------|---------|-------------------|-------------|
| STANDARD | Thấp | 1.0x | Tất cả customer |
| PREMIUM | Trung bình | 1.5x | Đủ điều kiện |
| RESTRICTED | Cao | 2.0x | Hạn chế, xét duyệt |

**BR-FL-002** — Giá và deposit per-branch  
IF: Provider cấu hình xe cho 1 chi nhánh  
THEN: `hourly_rate` và `security_deposit` là config riêng của chi nhánh đó — các chi nhánh khác có thể khác nhau

---

## 2. Trạng thái xe (VehicleStatus)

**BR-FL-003** — Xe chỉ cho thuê khi AVAILABLE  
IF: `vehicle.status ≠ AVAILABLE`  
THEN: Không thể tạo booking RENTAL cho xe đó

**BR-FL-004** — Xe chuyển sang IN_USE khi check-in  
IF: Staff hoàn thành check-in cho booking RENTAL  
THEN: `vehicle.status → IN_USE`

**BR-FL-005** — Xe trở về AVAILABLE sau check-out  
IF: Booking hoàn thành (COMPLETED) hoặc bị huỷ sau khi đã IN_USE  
THEN: `vehicle.status → AVAILABLE`

**BR-FL-006** — Xe MAINTENANCE không cho thuê  
IF: Provider/Staff đánh dấu xe cần bảo trì (`status = MAINTENANCE`)  
THEN: Không thể tạo booking mới cho xe đó cho đến khi status trở về AVAILABLE

**BR-FL-007** — Xe RETIRED  
IF: `vehicle.status = RETIRED`  
THEN: Không thể tạo booking. Không thể chuyển về AVAILABLE. Chỉ dùng cho lưu trữ lịch sử.

---

## 3. Track compatibility

> Track types hợp lệ: **DRIFT** · **CIRCUIT** · **OFFROAD**

**BR-FL-010** — Xe RENTAL gắn với sân cụ thể  
IF: `vehicle.compatible_track_types` không rỗng (VD: `['DRIFT']`)  
THEN: Xe đó chỉ available để book khi customer chọn đúng track type đó  
NOTE: Dùng cho xe chuyên dụng — xe drift chỉ ra sân DRIFT, không dùng sân CIRCUIT hay OFFROAD

**BR-FL-011** — Xe RENTAL dùng được mọi sân  
IF: `vehicle.compatible_track_types` rỗng (`[]`)  
THEN: Xe đó available cho tất cả track type mà chi nhánh có

**BR-FL-012** — BYOC không bị giới hạn track  
IF: `booking.mode = BYOC`  
THEN: Customer chọn bất kỳ sân nào của chi nhánh — hệ thống không kiểm tra tính tương thích  
NOTE: Customer tự chịu trách nhiệm về xe cá nhân có phù hợp sân không

---

## 4. Quản lý fleet per-branch

**BR-FL-008** — Fleet thuộc về chi nhánh  
Mỗi xe (`Vehicle`) thuộc về đúng 1 `Cafe` (chi nhánh). Xe không thể chia sẻ giữa các chi nhánh.

**BR-FL-009** — Staff chỉ thao tác xe của chi nhánh mình  
IF: Staff không được assign vào chi nhánh X  
THEN: Staff không thể check-in/check-out xe của chi nhánh X
