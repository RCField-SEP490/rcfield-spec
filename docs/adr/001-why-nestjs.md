# ADR 001 — Chọn NestJS cho Backend

**Date**: 2026-05  
**Status**: Accepted

## Context

Cần chọn backend framework cho RCField API. Các lựa chọn: NestJS, Express thuần, Fastify.

## Decision

Chọn **NestJS**.

## Reasoning

- Module-per-domain architecture phù hợp với bounded context của RCField (bookings, payments, inspections tách biệt rõ ràng)
- TypeScript first class — tránh được nhiều bug về type khi implement payment logic phức tạp
- Built-in support cho Guards (RBAC), Interceptors, Pipes (validation) — không cần tự build
- State machine có thể implement sạch trong một NestJS service riêng
- Team đã quen NestJS qua môn học

## Consequences

- Learning curve với decorators nếu thành viên mới chưa quen
- Cần discipline trong module boundaries — không import chéo giữa modules (dùng shared module cho common)
- Horizontal scaling Phase 2 dễ dàng với NestJS microservices pattern
