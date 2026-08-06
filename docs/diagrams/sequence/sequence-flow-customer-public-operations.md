# Sequence Flow: Customer and Public Operations

**Last updated:** 2026-08-06

Coverage theo controller: `auth`, `cafe`, `featured-popup`, `favorite`, `review`, `customer-package`, `booking`, `session`, `vnpay`, `contest`, `racing-network`, `notification`, `chat`, `vehicle`.

---

## 1. Public Home, Explore, Cafe Detail and Featured Popup

```mermaid
sequenceDiagram
    autonumber
    actor U as Visitor / Customer
    participant Home as Screen<br/>(LandingPage)
    participant Explore as Screen<br/>(ExplorePage)
    participant CafeDetail as Screen<br/>(CafeDetailPage)
    participant PopupAPI as API<br/>(Express / FeaturedPopupController)
    participant CafeAPI as API<br/>(Express / CafeController)
    participant MenuAPI as API<br/>(Express / MenuController)
    participant PriceAPI as API<br/>(Express / PricingController)
    participant ReviewAPI as API<br/>(Express / ReviewController)
    participant DB as Database<br/>(PostgreSQL)

    U->>Home: Open public site
    Home->>PopupAPI: GET /api/v1/explore/featured-popup
    PopupAPI->>DB: SELECT active featured popup
    Home->>CafeAPI: GET /api/v1/cafes
    CafeAPI->>DB: SELECT active cafes + images + ratings

    U->>Explore: Search/filter cafes
    Explore->>CafeAPI: GET /api/v1/cafes?filters
    CafeAPI->>DB: SELECT cafes by city, track type, amenities, favorite state
    CafeAPI-->>Explore: cafe cards

    U->>CafeDetail: Open cafe
    CafeDetail->>CafeAPI: GET /api/v1/cafes/:cafeId
    CafeAPI->>DB: SELECT cafe detail + images + track configs
    CafeDetail->>MenuAPI: GET /api/v1/cafes/:cafeId/menu and popular
    MenuAPI->>DB: SELECT menu categories/items
    CafeDetail->>PriceAPI: GET /api/v1/cafes/:cafeId/pricing-preview
    PriceAPI->>DB: SELECT pricing rules + holidays
    CafeDetail->>ReviewAPI: GET /api/v1/cafes/:cafeId/reviews
    ReviewAPI->>DB: SELECT visible reviews
```

---

## 2. Auth, Profile, Favorites and Notifications

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant Auth as Screen<br/>(LoginPage / RegisterPage / ForgotPasswordPage / ResetPasswordPage)
    participant Profile as Screen<br/>(CustomerProfilePage / ProfilePage)
    participant Explore as Screen<br/>(ExplorePage / CafeDetailPage)
    participant Bell as Component<br/>(NotificationBell)
    participant AuthAPI as API<br/>(Express / AuthController)
    participant FavoriteAPI as API<br/>(Express / FavoriteController)
    participant NotifyAPI as API<br/>(Express / NotificationController)
    participant AuthSvc as AuthService<br/>(auth.service.ts)
    participant DB as Database<br/>(PostgreSQL)
    participant Redis as Cache<br/>(Redis)

    alt Login/register/reset password
        C->>Auth: Submit auth form
        Auth->>AuthAPI: POST /api/v1/auth/login/register/forgot-password/reset-password
        AuthAPI->>AuthSvc: auth action
        AuthSvc->>Redis: brute-force or refresh-token support
        AuthSvc->>DB: SELECT/INSERT/UPDATE users and reset tokens
        AuthAPI-->>Auth: user/tokens or reset status
    else Profile
        C->>Profile: Update profile/passport settings
        Profile->>AuthAPI: GET/PATCH /api/v1/auth/me
        AuthAPI->>DB: SELECT/UPDATE users
    else Favorite cafes
        C->>Explore: Add/remove/sync favorite
        Explore->>FavoriteAPI: GET/POST/DELETE /api/v1/customer/favorites
        FavoriteAPI->>DB: SELECT/INSERT/DELETE favorites
    else Notifications
        Bell->>NotifyAPI: GET /api/v1/notifications
        NotifyAPI->>DB: SELECT notifications
        C->>Bell: Mark read
        Bell->>NotifyAPI: PUT /api/v1/notifications/:id/read or read-all
        NotifyAPI->>DB: UPDATE notifications.read_at
    end
```

---

## 3. Booking, Payment, QR and Active Session Response

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant Create as Screen<br/>(CreateBookingPage)
    participant Detail as Screen<br/>(BookingDetailPage / CustomerBookingsPage)
    participant PayResult as Screen<br/>(PaymentResultPage)
    participant Session as Screen<br/>(CustomerActiveSessionPage / CustomerInspectionConfirmPage)
    participant BookingAPI as API<br/>(Express / BookingController)
    participant SessionAPI as API<br/>(Express / SessionController)
    participant VnpayAPI as API<br/>(Express / VnpayController)
    participant BookingSvc as BookingService<br/>(booking.service.ts)
    participant PaySvc as PaymentService<br/>(payment.service.ts)
    participant VNPay as Third-party<br/>(VNPay)
    participant DB as Database<br/>(PostgreSQL)

    C->>Create: Select cafe, track, slot, vehicles, F&B, promo, package
    Create->>BookingAPI: POST /api/v1/bookings
    BookingAPI->>BookingSvc: createBooking(payload)
    BookingSvc->>DB: Validate cafe/slot/vehicle/package/promotion
    BookingSvc->>DB: INSERT booking, participants, booking_vehicles, fnb_order
    BookingAPI-->>Create: booking PENDING

    C->>Create: Start checkout
    Create->>BookingAPI: POST /api/v1/bookings/:id/checkout
    BookingAPI->>PaySvc: create checkout transaction
    PaySvc->>DB: INSERT payment_transaction
    BookingAPI-->>Create: paymentUrl
    Create->>VNPay: Redirect customer
    VNPay->>VnpayAPI: GET /api/v1/payments/vnpay/ipn
    VnpayAPI->>PaySvc: confirm transaction
    PaySvc->>DB: UPDATE booking CONFIRMED + payment_transaction PAID
    VNPay-->>PayResult: GET /api/v1/payments/vnpay/return

    alt Booking detail/QR/cancel
        C->>Detail: View booking or QR
        Detail->>BookingAPI: GET /api/v1/bookings/:id and /:id/qr
        BookingAPI->>DB: SELECT booking detail + QR payload
        C->>Detail: Cancel booking
        Detail->>BookingAPI: POST /api/v1/bookings/:id/cancel
        BookingAPI->>BookingSvc: cancelBooking()
        BookingSvc->>DB: UPDATE booking CANCELLED + refund components when eligible
    else Active session response
        C->>Session: Confirm inspection or extension
        Session->>SessionAPI: POST /api/v1/sessions/:sessionId/inspection/confirm
        SessionAPI->>DB: UPDATE inspection/session state
        Session->>SessionAPI: POST /api/v1/sessions/:sessionId/extensions/respond
        SessionAPI->>DB: UPDATE extension_proposal and session planned_end_at
    end
```

---

## 4. Customer Packages, Reviews and Damage Review

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant Packages as Screen<br/>(CustomerPackagesPage)
    participant Reviews as Screen<br/>(CustomerReviewsPage / ReviewFormModal)
    participant Damage as Screen<br/>(CustomerDamageReviewPage)
    participant PackageAPI as API<br/>(Express / CustomerPackageController)
    participant ReviewAPI as API<br/>(Express / ReviewController)
    participant SessionAPI as API<br/>(Express / SessionController)
    participant PaySvc as PaymentService<br/>(payment.service.ts)
    participant DB as Database<br/>(PostgreSQL)

    alt Package purchase/list/usage/repay
        C->>Packages: Open packages
        Packages->>PackageAPI: GET /api/v1/customers/me/packages
        PackageAPI->>DB: SELECT customer_packages + usage
        C->>Packages: Purchase package
        Packages->>PackageAPI: POST /api/v1/cafes/:cafeId/packages/:packageId/purchase
        PackageAPI->>PaySvc: create package payment when needed
        PaySvc->>DB: INSERT payment transaction + customer_package
        Packages->>PackageAPI: GET usage or POST repay
        PackageAPI->>DB: SELECT usage history or create repay transaction
    else Review flow
        C->>Reviews: View pending reviews
        Reviews->>ReviewAPI: GET /api/v1/customer/reviews/pending
        ReviewAPI->>DB: SELECT completed bookings without review
        C->>Reviews: Submit/dismiss review
        Reviews->>ReviewAPI: POST /api/v1/customer/reviews or /:bookingId/dismiss
        ReviewAPI->>DB: INSERT review or dismissed reminder
    else Damage review
        C->>Damage: Open damage evidence
        Damage->>SessionAPI: GET /api/v1/sessions/:sessionId
        SessionAPI->>DB: SELECT inspection photos + damage items
        C->>Damage: Accept/dispute damage
        Damage->>SessionAPI: POST inspection confirm
        SessionAPI->>DB: UPDATE damage acceptance/dispute state
    end
```

---

## 5. Customer Contest, Rental/BYOC Registration and Racing Network

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant ContestList as Screen<br/>(PublicContestsPage / ContestDiscoveryRail)
    participant ContestDetail as Screen<br/>(PublicContestDetailPage / ContestRegistrationPanel)
    participant MyRegs as Screen<br/>(CustomerContestRegistrationsPage)
    participant Passport as Screen<br/>(CustomerProfilePage / PublicGlobalLeaderboardPage)
    participant ContestAPI as API<br/>(Express / ContestController)
    participant RacingAPI as API<br/>(Express / RacingNetworkController)
    participant BookingAPI as API<br/>(Express / BookingController)
    participant DB as Database<br/>(PostgreSQL)

    alt Discover contest
        C->>ContestList: Browse contests
        ContestList->>ContestAPI: GET /api/v1/contests
        ContestAPI->>DB: SELECT OPEN/PUBLISHED contests
        C->>ContestDetail: Open contest detail
        ContestDetail->>ContestAPI: GET /api/v1/contests/:contestId + matches
        ContestAPI->>DB: SELECT contest, registrations, matches, leaderboard snapshot
    else Register rental/BYOC
        C->>ContestDetail: Select rental or BYOC
        ContestDetail->>ContestAPI: GET rental-options / available-rental-vehicles
        ContestAPI->>DB: SELECT eligible booking slots and vehicles
        opt Rental booking required
            ContestDetail->>BookingAPI: POST /api/v1/bookings/contest-rental
            BookingAPI->>DB: INSERT contest rental booking + booking_vehicles
        end
        ContestDetail->>ContestAPI: POST /api/v1/contests/:contestId/register
        ContestAPI->>DB: INSERT contest_registration PENDING/CONFIRMED
        ContestDetail->>ContestAPI: POST create-entry-fee-payment when fee required
        ContestAPI->>DB: INSERT contest fee transaction
    else My registrations
        C->>MyRegs: View registrations
        MyRegs->>ContestAPI: GET /api/v1/me/contest-registrations
        ContestAPI->>DB: SELECT registrations + contest state
        C->>MyRegs: Cancel or update BYOC declaration
        MyRegs->>ContestAPI: POST cancel or PATCH byoc-declaration
        ContestAPI->>DB: UPDATE contest_registrations
    else Racing network
        C->>Passport: View/update passport and leaderboard
        Passport->>RacingAPI: GET /api/v1/me/driver-passport
        RacingAPI->>DB: SELECT race_records + achievements + driver profile
        Passport->>RacingAPI: PATCH /api/v1/me/driver-passport
        RacingAPI->>DB: UPDATE public handle/avatar/bio settings
        Passport->>RacingAPI: GET /api/v1/leaderboards/global
        RacingAPI->>DB: SELECT global ranking
    end
```

---

## 6. Chat Widget and Full Page Chat

```mermaid
sequenceDiagram
    autonumber
    actor U as Visitor / Customer
    participant Widget as Component<br/>(ChatWidget)
    participant FullPage as Screen<br/>(CafeFullPageChatPage)
    participant API as API<br/>(Express / ChatController)
    participant ChatSvc as ChatService<br/>(chat.service.ts)
    participant KbSvc as KbService<br/>(kb.service.ts)
    participant NLU as Service<br/>(NLU FastAPI)
    participant Gemini as Third-party<br/>(Gemini)
    participant DB as Database<br/>(PostgreSQL)

    U->>Widget: Ask cafe question
    Widget->>API: POST /api/v1/cafes/:cafeId/chat/stream
    API->>ChatSvc: ragChatStream(cafeId, message)
    ChatSvc->>NLU: classify intent
    ChatSvc->>KbSvc: retrieve cafe KB chunks
    KbSvc->>DB: SELECT kb_chunks by embedding
    ChatSvc->>Gemini: generate response/tool call
    Gemini-->>ChatSvc: streamed tokens
    ChatSvc-->>Widget: SSE chunks

    U->>FullPage: Open full chat page
    FullPage->>API: GET /api/v1/cafes/:cafeId/chat/config
    API->>DB: SELECT cafe_widget_config
```

---

## 7. Class Diagram: Customer and Public Operations

```mermaid
classDiagram
    class LandingPage
    class ExplorePage
    class CafeDetailPage
    class LoginPage
    class CustomerProfilePage
    class CreateBookingPage
    class BookingDetailPage
    class CustomerPackagesPage
    class CustomerReviewsPage
    class PublicContestDetailPage
    class CustomerContestRegistrationsPage
    class ChatWidget
    class CafeController
    class AuthController
    class BookingController
    class SessionController
    class CustomerPackageController
    class ReviewController
    class FavoriteController
    class ContestController
    class RacingNetworkController
    class ChatController
    class User
    class Cafe
    class Booking
    class Session
    class CustomerPackage
    class Review
    class Favorite
    class ContestRegistration
    class RaceRecord

    LandingPage --> CafeController
    ExplorePage --> CafeController
    CafeDetailPage --> CafeController
    LoginPage --> AuthController
    CustomerProfilePage --> AuthController
    CreateBookingPage --> BookingController
    BookingDetailPage --> BookingController
    CustomerPackagesPage --> CustomerPackageController
    CustomerReviewsPage --> ReviewController
    PublicContestDetailPage --> ContestController
    CustomerContestRegistrationsPage --> ContestController
    ChatWidget --> ChatController
    User "1" --> "*" Booking
    User "1" --> "*" CustomerPackage
    User "1" --> "*" Review
    User "1" --> "*" Favorite
    User "1" --> "*" ContestRegistration
    User "1" --> "*" RaceRecord
    Cafe "1" --> "*" Booking
    Booking "1" --> "*" Session
```
