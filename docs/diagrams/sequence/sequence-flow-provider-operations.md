# Sequence Flow: Provider Operations

**Last updated:** 2026-08-06

Coverage theo controller: `provider-onboarding`, `provider-dashboard`, `ai-revenue-analytics`, `cafe`, `cafe-image`, `cafe-track-config`, `pricing`, `menu`, `menu-category`, `package`, `promotion`, `vehicle-catalog`, `vehicle`, `staff`, `fb-channel`, `chat/kb`, `review`, `contest`, `contest-fee`, `payment-request`.

---

## 1. Provider Workspace Load, KYC and Dashboard Analytics

```mermaid
sequenceDiagram
    autonumber
    actor P as Provider
    participant Home as Screen<br/>(ProviderDashboardPage)
    participant Kyc as Screen<br/>(PendingReviewPage / RejectedPage)
    participant API as API<br/>(Express / ProviderOnboardingController + ProviderDashboardController)
    participant AISvc as AIRevenueAnalyticsController<br/>(ai-revenue-analytics.controller.ts)
    participant Service as ProviderDashboardService<br/>(provider-dashboard.service.ts)
    participant DB as Database<br/>(PostgreSQL)
    participant Store as Storage<br/>(KYC uploads)

    alt Load provider workspace
        P->>Home: Open provider dashboard
        Home->>API: GET /api/v1/provider/me
        API->>DB: SELECT provider profile + registration_status
        Home->>API: GET /api/v1/provider/dashboard/kpi
        API->>Service: getKpi(providerId)
        Service->>DB: Aggregate bookings, sessions, revenue, branches
        Home->>API: GET revenue trend/breakdown/booking channels/branch performance
        Service->>DB: SELECT grouped operational metrics
        API-->>Home: dashboard datasets
    else Resubmit KYC
        P->>Kyc: Upload KYC documents
        Kyc->>API: POST /api/v1/provider/kyc/resubmit
        API->>Store: Store cccd_front, cccd_back, gpkd, venue_photo
        API->>DB: UPDATE provider_profiles KYC fields + registration_status PENDING
        API-->>Kyc: resubmission accepted
    else AI insights
        P->>Home: Generate insights
        Home->>AISvc: POST /api/v1/provider/dashboard/ai-insights
        AISvc->>DB: Load recent revenue and operation metrics
        AISvc-->>Home: AI insight cards
    end
```

---

## 2. Cafe Branch, Images, Track Configuration and Pricing

```mermaid
sequenceDiagram
    autonumber
    actor P as Provider
    participant CafeList as Screen<br/>(ProviderCafesPage)
    participant CafeForm as Screen<br/>(ProviderCafeCreatePage / ProviderCafeDetailPage)
    participant Config as Screen<br/>(ProviderConfigurationPage / ProviderPricingPage)
    participant CafeAPI as API<br/>(Express / CafeController + CafeImageController)
    participant TrackAPI as API<br/>(Express / CafeTrackConfigController)
    participant PriceAPI as API<br/>(Express / PricingController)
    participant Quota as SubscriptionService<br/>(checkBranchQuota)
    participant Store as Cloudinary
    participant DB as Database<br/>(PostgreSQL)

    alt Branch CRUD
        P->>CafeList: Create or edit branch
        CafeForm->>CafeAPI: POST/PATCH /api/v1/cafes
        CafeAPI->>Quota: checkBranchQuota(providerId)
        Quota->>DB: SELECT active subscription branch_limit
        CafeAPI->>DB: INSERT/UPDATE cafes
        CafeAPI-->>CafeForm: cafe detail
    else Images
        P->>CafeForm: Upload gallery images
        CafeForm->>CafeAPI: POST /api/v1/cafes/:cafeId/images
        CafeAPI->>Store: upload files
        CafeAPI->>DB: INSERT cafe_images
    else Track configuration
        P->>Config: Configure track lanes/capacity/images
        Config->>TrackAPI: POST/PATCH /api/v1/cafes/:cafeId/track-configs
        TrackAPI->>DB: INSERT/UPDATE cafe_track_configs
        Config->>TrackAPI: POST /api/v1/cafes/:cafeId/track-configs/:configId/images
        TrackAPI->>Store: upload track images
        TrackAPI->>DB: INSERT track config image refs
    else Pricing and holidays
        P->>Config: Edit pricing rules and holidays
        Config->>PriceAPI: GET /api/v1/provider/cafes/:cafeId/pricing
        PriceAPI->>DB: SELECT cafe_pricing_rules + holiday_dates
        Config->>PriceAPI: PUT /api/v1/provider/cafes/:cafeId/pricing/rules
        PriceAPI->>DB: UPSERT pricing rules
        Config->>PriceAPI: POST/PUT/DELETE holidays
        PriceAPI->>DB: INSERT/UPDATE/DELETE holiday_dates
    end
```

---

## 3. Menu, Packages, Promotions and Public Preview

```mermaid
sequenceDiagram
    autonumber
    actor P as Provider
    participant Menu as Screen<br/>(ProviderMenuPage)
    participant Package as Screen<br/>(ProviderPackagesPage)
    participant Promo as Screen<br/>(ProviderPromotionsPage)
    participant MenuAPI as API<br/>(Express / MenuController + MenuCategoryController)
    participant PackageAPI as API<br/>(Express / PackageController)
    participant PromoAPI as API<br/>(Express / PromotionController)
    participant DB as Database<br/>(PostgreSQL)

    alt Menu categories/items/combos
        P->>Menu: Manage categories, menu items, combos
        Menu->>MenuAPI: POST/PATCH/DELETE /api/v1/cafes/:cafeId/menu/categories
        MenuAPI->>DB: INSERT/UPDATE/DELETE menu_categories
        Menu->>MenuAPI: POST/PATCH/DELETE /api/v1/cafes/:cafeId/menu or combos
        MenuAPI->>DB: INSERT/UPDATE/DELETE menu_items, variants, components
    else Packages
        P->>Package: Create/edit play packages
        Package->>PackageAPI: GET/POST/PATCH/DELETE /api/v1/cafes/:cafeId/packages
        PackageAPI->>DB: SELECT/INSERT/UPDATE/DELETE packages
    else Promotions
        P->>Promo: Create/edit promotion and preview discount
        Promo->>PromoAPI: GET/POST/PATCH/DELETE /api/v1/cafes/:cafeId/promotions
        PromoAPI->>DB: SELECT/INSERT/UPDATE promotions
        Promo->>PromoAPI: POST /api/v1/cafes/:cafeId/promotions/preview
        PromoAPI->>DB: Validate promotion rules against booking draft
        PromoAPI-->>Promo: discount preview
    end
```

---

## 4. Vehicle Catalog, Units and Maintenance Visibility

```mermaid
sequenceDiagram
    autonumber
    actor P as Provider
    participant Vehicles as Screen<br/>(ProviderVehiclesPage)
    participant Catalog as Screen<br/>(ProviderVehicleCatalogFormPage / ProviderVehicleCatalogDetailPage)
    participant Unit as Screen<br/>(ProviderVehicleUnitFormPage / ProviderVehicleDetailPage)
    participant CatalogAPI as API<br/>(Express / VehicleCatalogController)
    participant VehicleAPI as API<br/>(Express / VehicleController)
    participant DB as Database<br/>(PostgreSQL)

    P->>Vehicles: Open vehicles workspace
    Vehicles->>CatalogAPI: GET /api/v1/cafes/:cafeId/vehicle-catalogs
    CatalogAPI->>DB: SELECT vehicle_catalogs + images
    CatalogAPI-->>Vehicles: catalog list

    alt Catalog CRUD
        P->>Catalog: Create/update/delete catalog
        Catalog->>CatalogAPI: POST/PATCH/DELETE /api/v1/cafes/:cafeId/vehicle-catalogs/:catalogId
        CatalogAPI->>DB: INSERT/UPDATE/DELETE vehicle_catalogs
    else Unit CRUD
        P->>Unit: Create/update physical unit
        Unit->>VehicleAPI: POST/PATCH/DELETE /api/v1/cafes/:cafeId/vehicle-catalogs/:catalogId/units
        VehicleAPI->>DB: INSERT/UPDATE/DELETE vehicles
        VehicleAPI->>DB: Enforce unit status and branch ownership
    end
```

---

## 5. Provider Staff, Reviews and Impersonation

```mermaid
sequenceDiagram
    autonumber
    actor P as Provider
    participant StaffList as Screen<br/>(ProviderStaffPage)
    participant StaffDetail as Screen<br/>(ProviderStaffDetailPage)
    participant Reviews as Component<br/>(ProviderReviewsTab)
    participant API as API<br/>(Express / StaffController + ReviewController)
    participant StaffSvc as StaffService<br/>(staff.service.ts)
    participant Mail as EmailService<br/>(email.service.ts)
    participant DB as Database<br/>(PostgreSQL)

    alt Staff lifecycle
        P->>StaffList: Create staff account
        StaffList->>API: POST /api/v1/provider/staff
        API->>StaffSvc: createStaff(providerId, payload)
        StaffSvc->>DB: INSERT user STAFF + staff invite token
        StaffSvc->>Mail: send activation email
        P->>StaffDetail: View KPI/activity/detail
        StaffDetail->>API: GET /api/v1/provider/staff/:staffId/kpi and activity
        API->>DB: SELECT staff bookings, sessions, inspections
        P->>StaffDetail: Deactivate/reactivate/transfer/impersonate
        StaffDetail->>API: PATCH/POST staff action endpoints
        API->>DB: UPDATE staff assignment or issue impersonation token
    else Review moderation
        P->>Reviews: View cafe reviews
        Reviews->>API: GET /api/v1/provider/reviews
        API->>DB: SELECT reviews by provider cafes
        P->>Reviews: Hide/show review
        Reviews->>API: PATCH /api/v1/provider/reviews/:id/visibility
        API->>DB: UPDATE review visibility
    end
```

---

## 6. Channels, Chat Widget and Knowledge Base

```mermaid
sequenceDiagram
    autonumber
    actor P as Provider
    participant Channel as Screen<br/>(ChannelSettingsPage / FacebookOAuthCallbackPage)
    participant Widget as Component<br/>(WidgetConfigForm)
    participant KB as Component<br/>(KbDocumentsSection)
    participant ChannelAPI as API<br/>(Express / FbChannelController)
    participant CafeAPI as API<br/>(Express / CafeController)
    participant KbAPI as API<br/>(Express / KbController)
    participant Quota as SubscriptionService<br/>(checkChannelQuota)
    participant FB as Third-party<br/>(Facebook OAuth)
    participant DB as Database<br/>(PostgreSQL)

    alt Connect Facebook page
        P->>Channel: Click connect
        Channel->>ChannelAPI: GET /api/v1/channels/facebook/connect
        ChannelAPI->>Quota: checkChannelQuota(providerId)
        Quota->>DB: SELECT subscription channel_limit
        ChannelAPI-->>Channel: Facebook OAuth URL
        Channel->>FB: Redirect provider
        FB-->>Channel: callback code/state
        Channel->>ChannelAPI: GET /api/v1/channels/facebook/callback
        ChannelAPI->>DB: INSERT cafe_channels with page token
    else Widget config
        P->>Widget: Edit widget color/greeting/behavior
        Widget->>CafeAPI: PUT /api/v1/cafes/:cafeId/widget-config
        CafeAPI->>DB: UPSERT cafe_widget_config
    else Knowledge base
        P->>KB: Upload or delete KB docs
        KB->>KbAPI: GET/POST/DELETE /api/v1/cafes/:cafeId/kb/documents
        KbAPI->>DB: INSERT kb_documents + kb_chunks
    end
```

---

## 7. Provider Contest Management and Contest Fee

```mermaid
sequenceDiagram
    autonumber
    actor P as Provider
    participant Form as Screen<br/>(ProviderContestFormPage)
    participant Workspace as Screen<br/>(ProviderContestWorkspacePage)
    participant FeePanel as Component<br/>(ContestFeePanel)
    participant ContestAPI as API<br/>(Express / ContestController)
    participant FeeAPI as API<br/>(Express / ContestFeeController)
    participant Runtime as ContestRuntimeService<br/>(contest-runtime.service.ts)
    participant DB as Database<br/>(PostgreSQL)

    alt Create/update/open contest
        P->>Form: Configure contest
        Form->>ContestAPI: POST/PATCH /api/v1/contests
        ContestAPI->>DB: INSERT/UPDATE contests, contest_cafes, config
        Form->>ContestAPI: POST /api/v1/contests/:contestId/banner
        ContestAPI->>DB: UPDATE contest banner URL
        P->>Workspace: Open/close/cancel contest
        Workspace->>ContestAPI: POST open/close/cancel
        ContestAPI->>DB: UPDATE contest status + audit log
    else Registration and event operations
        P->>Workspace: Review registrations, assign staff, bans
        Workspace->>ContestAPI: GET registrations/staff-assignments/bans
        ContestAPI->>DB: SELECT operational data
        Workspace->>ContestAPI: approve/reject/disqualify/assign/bans
        ContestAPI->>DB: UPDATE registrations, assignments, bans
    else Runtime and leaderboard
        P->>Workspace: Generate bracket or submit results
        Workspace->>ContestAPI: POST matches/generate, results, advance, publish
        ContestAPI->>Runtime: execute runtime transition
        Runtime->>DB: INSERT/UPDATE contest_matches + participants + leaderboard snapshot
    else Contest fee
        P->>FeePanel: Submit contest fee bank transfer
        FeePanel->>FeeAPI: GET/POST/DELETE/transfer /api/v1/contests/:contestId/fee
        FeeAPI->>DB: INSERT/UPDATE contest_fee_orders
    end
```

---

## 8. Class Diagram: Provider Operations

```mermaid
classDiagram
    class ProviderDashboardPage
    class ProviderCafesPage
    class ProviderConfigurationPage
    class ProviderMenuPage
    class ProviderPackagesPage
    class ProviderPromotionsPage
    class ProviderVehiclesPage
    class ProviderStaffPage
    class ChannelSettingsPage
    class ProviderContestWorkspacePage
    class ProviderOnboardingController
    class ProviderDashboardController
    class CafeController
    class PricingController
    class MenuController
    class PackageController
    class PromotionController
    class VehicleCatalogController
    class StaffController
    class FbChannelController
    class ContestController
    class ContestFeeController
    class ProviderProfile
    class Cafe
    class CafeTrackConfig
    class MenuItem
    class Package
    class Promotion
    class VehicleCatalog
    class Vehicle
    class StaffAssignment
    class CafeChannel
    class Contest

    ProviderDashboardPage --> ProviderDashboardController
    ProviderCafesPage --> CafeController
    ProviderConfigurationPage --> PricingController
    ProviderMenuPage --> MenuController
    ProviderPackagesPage --> PackageController
    ProviderPromotionsPage --> PromotionController
    ProviderVehiclesPage --> VehicleCatalogController
    ProviderStaffPage --> StaffController
    ChannelSettingsPage --> FbChannelController
    ProviderContestWorkspacePage --> ContestController
    ProviderProfile "1" --> "*" Cafe
    Cafe "1" --> "*" CafeTrackConfig
    Cafe "1" --> "*" MenuItem
    Cafe "1" --> "*" Package
    Cafe "1" --> "*" Promotion
    Cafe "1" --> "*" VehicleCatalog
    VehicleCatalog "1" --> "*" Vehicle
    ProviderProfile "1" --> "*" StaffAssignment
    Cafe "1" --> "*" CafeChannel
    ProviderProfile "1" --> "*" Contest
```
