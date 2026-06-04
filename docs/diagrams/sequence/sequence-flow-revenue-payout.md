# Sequence Flow: Revenue, Commission and Provider Payout

**Last updated**: 2026-06-04  
**Status**: Draft for mentor review  
**Related rules**: `docs/spec/business-rules/BR-revenue-payment-provider.md`

---

## 1. Settlement theo session và chi nhánh

```mermaid
sequenceDiagram
    autonumber
    participant S as Session Service
    participant PE as Payment Engine
    participant DB as Ledger DB
    participant R as Revenue Report
    participant P as Provider Dashboard

    S->>PE: settle(sessionId)
    PE->>DB: Load session, booking, cafe, provider
    PE->>DB: Load payment_components
    PE->>DB: Calculate gross by component
    PE->>DB: Calculate platform_fee
    PE->>DB: Calculate net_provider_amount
    PE->>DB: Mark eligible components settled/disbursed pending payout
    PE->>R: Update cafe revenue report
    R-->>P: Provider sees provider total -> cafe -> booking -> session
```

---

## 2. Provider payout profile

```mermaid
sequenceDiagram
    autonumber
    participant P as Provider
    participant API as API
    participant DB as DB
    participant A as Admin

    P->>API: Submit payout profile
    API->>DB: Save bank info encrypted/masked
    API->>DB: verification_status = PENDING
    A->>API: Review payout profile
    alt Approved
        API->>DB: verification_status = VERIFIED
        API-->>P: Payout enabled
    else Rejected
        API->>DB: verification_status = REJECTED
        API-->>P: Request correction
    end
```

---

## 3. Manual/mock payout Phase 1

```mermaid
sequenceDiagram
    autonumber
    participant Job as Settlement Job/Admin
    participant DB as DB
    participant A as Admin
    participant Bank as Bank/Mock Transfer
    participant P as Provider

    Job->>DB: Find completed sessions not paid out
    Job->>DB: Group by provider and cafe/period
    Job->>DB: Create settlement_batch READY
    A->>DB: Review gross, commission, refund, net payout
    A->>Bank: Manual/mock transfer net payout
    A->>DB: Enter transfer reference
    DB->>DB: settlement_batch READY -> PAID
    DB-->>P: Provider sees payout paid and item breakdown
```

---

## 4. Dispute hold không block toàn provider

```mermaid
flowchart TD
    A[Session completed] --> B{Has unresolved damage/dispute?}
    B -->|No| C[Eligible for payout]
    B -->|Yes| D[Hold affected components only]
    C --> E[Settlement batch READY]
    D --> F[Incident/dispute resolution]
    F --> G{Provider wins?}
    G -->|Yes| H[Create/confirm damage charge]
    G -->|No| I[Waive damage/release hold]
    H --> C
    I --> C
```
