# Final Web Parity Verification

## Related Issues

- Closes #13

## Scope

This document records the final verification pass for the `realillust-web`
rebuild line on `dev`.

The rebuild intentionally restored the application in issue-linked layers:

```mermaid
flowchart TD
    A["#3 React baseline overlay"] --> B["#4 App foundation"]
    B --> C["#5 Auth shell"]
    C --> D["#6 Public pages"]
    D --> E["#7 Onboarding"]
    E --> F["#8 Dashboard shell"]
    F --> G["#9 API client fetcher"]
    G --> H["#10 MSW mock backend"]
    H --> I["#11 Organization dashboard pages"]
    I --> J["#12 API key management"]
    J --> K["#13 Final parity verification"]
    K --> L["#26 Pre-rebuild design parity"]
```

## Verified Routes

```mermaid
flowchart LR
    A["/"] --> B["Public shell"]
    A --> C["/terms"]
    A --> D["/privacy"]
    A --> E["/dashboard"]
    E --> F["/dashboard/:organizationPublicId"]
    F --> G["/api-keys"]
    F --> H["/members"]
    F --> I["/settings"]
    F --> J["/usage"]
    F --> K["/webhooks"]
```

## Verification Commands

- `pnpm format:check`
- `pnpm lint`
- `pnpm build`
- `NEXT_PUBLIC_API_MOCKING=enabled NEXT_PUBLIC_API_BASE_URL= pnpm dev --port 3001`
- `curl -I http://localhost:3001/`
- `curl -I http://localhost:3001/terms`
- `curl -I http://localhost:3001/privacy`
- `curl -I http://localhost:3001/dashboard`
- `curl -I http://localhost:3001/opengraph-image`
- `curl -I http://localhost:3001/robots.txt`
- `curl -I http://localhost:3001/sitemap.xml`
- `curl -I http://localhost:3001/mockServiceWorker.js`
- Playwright browser smoke for `/`, `/terms`, and `/privacy`

## Result

All verification commands passed on June 27, 2026.

Public routes, dashboard entry, metadata routes, build, lint, formatting, and
the MSW browser worker are functional on the rebuilt `dev` branch.

The follow-up design parity pass in #26 restored the pre-rebuild visual layer
from `b1a2adf`: root route groups, landing page composition, static legal
pages, navbar/footer gates, Open Graph image route, favicons, web manifest,
dashboard shell visuals, UI primitives, and API key management UI. The restored
design code was adapted to the rebuilt auth/API/MSW layer without resetting git
history.

Direct organization dashboard routes remain SSR API-backed and require a real
API/session at runtime. The UI and API client contract for organization and API
key flows are present, and mock browser handlers are available for client-side
development with `NEXT_PUBLIC_API_MOCKING=enabled`.

## Follow-up

After this verification PR is merged into `dev`, create the release PR from
`dev` to `main`.
