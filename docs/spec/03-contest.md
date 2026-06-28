# Contest Module Specification

**Last Updated:** 2026-06-27  
**Related docs:** `docs/spec/business-rules/BR-contest.md`, `docs/spec/05-api-contracts.md`, `docs/spec/06-database.md`, `docs/architecture/03-contest.md`, `docs/diagrams/sequence/sequence-flow-contest-vehicle-operations.md`

---

## 1. Intent

Contest la module van hanh giai dau rieng cua RCField. Module nay khong thay the booking/session ma dung song song voi booking/session cho cac nhu cau lien quan den event day operations:

1. Provider tao va cau hinh contest.
2. Customer xem thong tin giai dau va dang ky tham gia.
3. Provider/Staff review nguon xe cua van dong vien.
4. Staff/Provider check-in van dong vien tai chi nhanh duoc phan cong.
5. Provider/Staff tao lich thi dau, nhap ket qua, sua ket qua va cong bo leaderboard.
6. He thong luu audit log va metrics van hanh de theo doi su kien contest.

---

## 2. Scope va Boundary

### Trong phase hien tai

- Contest CRUD: create, edit, open, close, cancel, detail, public listing, banner upload
- Multi-branch contest qua `contest_cafes`
- Dang ky theo contest-level, moi user mot lan/contest
- `vehicle_rule.vehicle_policy = RENTAL_ONLY | BYOC_ONLY | MIXED`
- Review registration:
  - `PENDING -> CONFIRMED`
  - `PENDING/CONFIRMED -> CANCELLED`
- Check-in theo `check_in_code`
- Match generation bang `contest_matches` + `contest_match_participants`
- Knockout bye round auto-advance
- Result correction co audit
- Audit logs va metrics API

### Ngoai scope hien tai

- Global BYOC certification workflow
- Contest-specific rental payment engine rieng
- Live timing / transponder
- Multi-class / heat / round runtime tables cu
- Protest / appeal workflow day du
- Reward claim lifecycle day du

---

## 3. Roles va Permissions

| Role | Quyen chinh |
|---|---|
| CUSTOMER | Xem contest, tao/sua/xoa customer vehicle cua minh, dang ky contest, xem registration cua minh |
| PROVIDER owner | Tao/sua/open/close/cancel contest, review registration, check-in, generate match, submit/correct result, publish leaderboard, xem audit logs va metrics |
| STAFF assigned | Lookup registration, check-in tai dung cafe, reorder participants, submit/correct result tai dung cafe cua match |
| ADMIN | Khong phai primary operator trong flow nay; chi can truy vet/ho tro khi can |

Nguyen tac:

- Staff khong duoc thao tac neu khong thuoc cafe do.
- Provider duoc thao tac tren contest cua minh tren tat ca cafe tham gia.
- Customer khong duoc tu approve registration cua minh.

---

## 4. Core Entities

### Contest

- Chua event-level config
- So huu boi Provider
- Co nhieu cafe tham gia thong qua `contest_cafes`
- `config` luu format, seeding, leaderboard snapshot, runtime metadata

### CustomerVehicle

- La BYOC registry cua customer
- Thuoc `customer_id`
- Dung cho contest BYOC va co the tai su dung cho booking/session BYOC trong tuong lai
- Khong chua trang thai approve toan cuc cho contest

### ContestRegistration

- Mot user dang ky mot lan trong mot contest
- Chua `vehicle_source`, `vehicle_id`, `customer_vehicle_id`, `booking_id`
- Chua `check_in_code`
- Chua trang thai review/check-in

### ContestMatch

- Don vi runtime cua giai: match / heat / final / knockout node
- Co `cafe_id`, `track_config_id` de localize operation
- Co `next_match_id` de advance bracket

### ContestMatchParticipant

- Gan registration vao tung match
- Chua slot, lane, seeding, finish position, score, result note

### ContestAuditLog

- Ghi lai cac mutation quan trong:
  - contest created/opened/closed/cancelled
  - registration created/approved/rejected/checked_in/cancelled
  - schedule generated
  - participants updated
  - result submitted/corrected
  - leaderboard published

---

## 5. Contest Status Model

### Contest

`DRAFT -> OPEN -> CLOSED -> RUNNING -> COMPLETED`

Terminal cancel path:

`DRAFT/OPEN/CLOSED/RUNNING -> CANCELLED`

### Registration

`PENDING -> CONFIRMED -> CHECKED_IN`

Cancel path:

`PENDING/CONFIRMED -> CANCELLED`

### Match

`DRAFT -> READY -> RUNNING -> COMPLETED`

Cancel path:

`DRAFT/READY/RUNNING -> CANCELLED`

---

## 6. Vehicle Flows

### 6.1 Rental contest flow

Ap dung khi:

- contest `vehicle_policy = RENTAL_ONLY`, hoac
- contest `vehicle_policy = MIXED` va customer chon `vehicle_source = RENTAL`

Nguyen tac:

- Contest registration khong tao booking gia.
- Rental payment, vehicle hold, session check-in/check-out, inspection van di qua booking/session flow hien co.
- Registration chi link qua `booking_id` va `vehicle_id`.

Happy path:

1. Customer dat booking rental binh thuong.
2. Booking phai `CONFIRMED`.
3. Booking phai dung customer, dung branch contest, dung track type, va bao phu thoi gian contest.
4. Customer dang ky contest bang `vehicle_source = RENTAL`, `booking_id`, `vehicle_id`.
5. Registration tao `PENDING`.
6. Provider/Staff review va approve.
7. Den ngay thi dau, check-in contest va session/check-in booking van van hanh binh thuong.

Rui ro can chan:

- Booking chua thanh toan/xac nhan
- Booking sai branch
- Booking sai track type
- Booking khong cover du thoi gian contest
- Vehicle dang bi registration active khac giu trong cung contest

### 6.2 BYOC contest flow

Ap dung khi:

- contest `vehicle_policy = BYOC_ONLY`, hoac
- contest `vehicle_policy = MIXED` va customer chon `vehicle_source = BYOC`

Nguyen tac:

- Customer phai tao hoac chon `customer_vehicle_id`
- Approval la theo registration cua contest, khong phai approval toan cuc cua xe

Happy path:

1. Customer tao customer vehicle.
2. Customer dang ky contest voi `customer_vehicle_id`.
3. Registration tao `PENDING`.
4. Provider/Staff review xe theo the le va track.
5. Neu phu hop -> approve `CONFIRMED`.
6. Neu khong phu hop -> reject `CANCELLED` + `rejection_reason` + `reason_code`.
7. Neu contest la `MIXED`, UI nen goi y chuyen sang rental flow.

Rui ro can chan:

- Customer dung xe khong thuoc minh
- Xe BYOC da duoc active trong cung contest
- Review reject nhung khong co reason ro rang

---

## 7. Registration Review va Check-in

### Review

- Provider owner co the approve/reject moi registration trong contest cua minh
- Staff duoc phep review neu thuoc it nhat mot cafe tham gia contest
- Approve/reject phai ghi audit

### Check-in

- Registration phai o `CONFIRMED`
- `checked_in_cafe_id` phai thuoc `contest_cafes`
- Neu actor la STAFF:
  - phai duoc assign dung cafe check-in

Sau check-in:

- `status = CHECKED_IN`
- luu `checked_in_by`, `checked_in_at`, `checked_in_cafe_id`

---

## 8. Match Operations

### Generate Matches

- Contest phai dong dang ky hoac dang trong runtime state hop le
- Chi su dung registration `CONFIRMED` hoac `CHECKED_IN`
- `cafe_id` va `track_config_id` duoc truyen khi generate
- Knockout co the auto-advance bye rounds neu match chi co 1 participant

### Reorder Participants

- Provider duoc thao tac tren moi match cua contest
- Staff chi duoc thao tac neu `staff_cafe_assignments.cafe_id = contest_matches.cafe_id`
- Khong cho reorder match da `COMPLETED`

### Submit Results

- Result phai thuoc participant cua match
- Update participant status/score/position
- Match -> `COMPLETED`
- Neu co `next_match_id`, co the advance

### Correct Results

- Endpoint chinh: `POST /contest-matches/:id/results/correct`
- Staff chi sua duoc khi downstream chua hoan tat
- Provider co the `force_cascade=true` de sua khi downstream da hoan tat
- Moi correction phai co audit log

### Publish Leaderboard

- Chi publish khi khong con match non-terminal
- Neu van con `DRAFT`, `READY`, `RUNNING` thi reject

---

## 9. Monitoring

### Audit logs

Can truy vet duoc:

- ai thao tac
- thao tac nao
- contest/registration/match nao
- truoc va sau thay doi
- reason neu co

### Metrics

Can co it nhat:

- registration totals theo `BYOC` / `RENTAL`
- pending / confirmed / cancelled / checked-in counts
- check-in rate
- match totals theo status
- completed match duration summary neu tinh duoc
- correction / operation error counters neu backend da expose

---

## 10. Happy Cases can test

### Happy case 1: BYOC approved

1. Provider tao contest `MIXED` hoac `BYOC_ONLY`
2. Customer tao customer vehicle
3. Customer dang ky contest -> `PENDING`
4. Provider approve -> `CONFIRMED`
5. Staff/Provider check-in -> `CHECKED_IN`
6. Generate match
7. Submit result
8. Publish leaderboard

### Happy case 2: Rental linked booking

1. Customer tao booking rental `CONFIRMED`
2. Customer dang ky contest bang `booking_id` + `vehicle_id`
3. Provider approve
4. Contest check-in
5. Session/inspection van dung booking flow cu
6. Match ops dien ra binh thuong

---

## 11. Negative cases can test

- Dang ky sai `vehicle_policy`
- BYOC khong co `customer_vehicle_id`
- RENTAL khong co `booking_id`/`vehicle_id`
- Booking rental chua `CONFIRMED`
- Booking rental sai cafe / sai track / sai time window
- Duplicate active rental vehicle trong cung contest
- Duplicate active customer vehicle trong cung contest
- Staff check-in sai cafe
- Staff submit/correct result sai cafe
- Publish leaderboard khi con match unfinished
- Staff correction khi downstream da completed

---

## 12. Implementation Notes

- Uu tien happy case va guard nghiep vu vua du
- Khong mo rong thanh global vehicle certification system
- Khong nhan doi payment/inspection logic cua booking trong contest
- Docs, Postman, BE va FE phai cung mot contract:
  - `vehicle_policy`
  - `customer_vehicle_id`
  - `booking_id`
  - `results/correct`
  - `audit-logs`
  - `metrics`

