# Contest Delivery Docs

**Last updated:** 2026-07-11  
**Owner:** Product / Backend / Frontend / QA

> Bộ tài liệu này là playbook triển khai thực tế cho Contest Core và các phase mở rộng liên quan.  
> Mục tiêu là để bất kỳ ai nhìn vào cũng hiểu: phase nào làm gì, thứ tự rollout, DB cần thêm gì, API nào cần mở, FE phải hiển thị ra sao, và checklist test/release trước khi merge.

---

## Mục lục

| File | Mục đích | Đọc khi nào |
|------|----------|-------------|
| [01-roadmap-and-scope.md](./01-roadmap-and-scope.md) | Roadmap tổng thể, boundary, mức scope từng phase | Trước khi lập kế hoạch hoặc estimate |
| [02-database-and-backend-rollout.md](./02-database-and-backend-rollout.md) | Kế hoạch DB/BE chi tiết theo phase, migration, entity, API, permission | Trước khi code backend |
| [03-frontend-rollout.md](./03-frontend-rollout.md) | Kế hoạch FE, route, state, UI rules, thay mock bằng live data | Trước khi code frontend |
| [04-testing-commit-and-release-checklist.md](./04-testing-commit-and-release-checklist.md) | Checklist test, commit strategy, release notes, branch handling | Trước khi commit / release |

---

## Nguyên tắc chung

1. Contest **không thay thế** booking/session/payment hiện có.
2. Contest entry fee **không được tạo booking giả**.
3. Mọi danh mục contest hiển thị ở FE phải đi từ DB -> BE -> FE.
4. Mọi thay đổi DB mới phải có bước **DB review** trước khi viết migration.
5. FE contest không dùng mock; dùng đúng visual system provider/public hiện có.

---

## Trạng thái implementation hiện tại

Đã implement trong repo:

- Contest catalog master data:
  - `contest_types`
  - `contest_formats`
  - `contest_templates`
- Contest runtime foundation:
  - `contests` refactor
  - `contest_cafes`
  - `contest_registrations` refactor
  - `contest_matches`
  - `contest_match_participants`
  - `contest_audit_logs`
- Backend APIs:
  - contest catalog
  - provider contest CRUD
  - public contest list/detail
  - customer rental contest registration
  - provider fee review / waive / approve / reject
  - provider/staff lookup + contest check-in
- Frontend:
  - provider contest list
  - provider contest create/edit
  - public contest list/detail
  - customer contest registrations

Chưa hoàn tất:

- Match generation runtime thật cho `TIME_TRIAL` / `KNOCKOUT`
- Result submission / correction / advance
- Publish leaderboard local
- Metrics / audit screen hoàn chỉnh
- Gateway payment cho `CONTEST_ENTRY`

