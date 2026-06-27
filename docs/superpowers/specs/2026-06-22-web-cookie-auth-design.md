# Web Cookie Authentication Design

Date: 2026-06-22

## Scope

This design updates `realillust-web` to match the backend cookie-based Google OAuth design implemented in `realillust-server`.

The frontend uses Next.js App Router. The backend owns authentication tokens and sends both the access token and refresh token as HttpOnly Secure cookies. The frontend must not read, store, or forward tokens manually.

The site is also reduced to a small public MVP surface.

Keep content routes:

- `/`
- `/terms`
- `/privacy`

Keep infrastructure route:

- `/auth/callback`

Remove all other current app routes and their route-specific components, including:

- `/admin/*`
- `/settings/*`
- `/ai-image-check`
- `/contest-ai-check`
- `/scans/[scanId]`
- `/auth/error`

If a removed route has dedicated navigation, metadata, mock data, generated copy, or local components that are no longer referenced by the kept routes, remove those references as part of implementation.

## Environment Contract

Local:

- Backend API origin: `http://localhost:8080`
- Frontend origin: `http://localhost:3000`
- Login endpoint: `http://localhost:8080/api/v1/auth/oauth2/authorize/google`

Production:

- Backend API origin: `https://api.realillust.com`
- Frontend origin: `https://realillust.com`
- Login endpoint: `https://api.realillust.com/api/v1/auth/oauth2/authorize/google`

`NEXT_PUBLIC_API_BASE_URL` remains the frontend's public API origin setting.

Recommended values:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

```env
NEXT_PUBLIC_API_BASE_URL=https://api.realillust.com
```

The frontend should not require `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Google OAuth starts on the backend.

## Backend Auth Contract

The frontend integrates with these backend routes:

- `GET /api/v1/auth/oauth2/authorize/google?returnTo=<internal-path>`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users/me`

The backend sets:

- `access_token`: HttpOnly Secure cookie
- `refresh_token`: HttpOnly Secure cookie

The frontend sends cookies with API requests:

```ts
fetch(url, {
  credentials: "include",
});
```

The frontend must not send `Authorization: Bearer ...` for this auth flow.

## Login Flow

The nav bar Google login button starts login by assigning `window.location.href`.

The target URL is:

```text
{NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/oauth2/authorize/google?returnTo={encodedReturnTo}
```

`returnTo` is computed from the current frontend path and query string.

Allowed return paths in this reduced site:

- `/`
- `/terms`
- `/privacy`

`/auth/callback` should not be used as a final return path. Unknown, absolute, protocol-relative, or malformed paths fall back to `/`.

The backend still validates `returnTo`. The frontend validation is for UI correctness and defense in depth.

## OAuth Callback Flow

The backend redirects to the frontend callback route after successful OAuth:

```text
/auth/callback?returnTo=<internal-path>
```

`app/auth/callback/page.tsx` should:

1. Read `returnTo` from the query string.
2. Normalize it to `/`, `/terms`, or `/privacy`.
3. Call `GET /api/v1/users/me` with `credentials: "include"`.
4. If the request succeeds, update the auth state with the returned user.
5. Replace the current route with the normalized `returnTo`.
6. If the request fails, clear auth state and replace with `/`.

The callback page is not a content page and should be excluded from sitemap output.

## SSR Login Bootstrap

Already logged-in users should have their login state reflected during SSR.

Add a server-side auth helper that:

1. Reads the incoming Next.js request cookies.
2. Calls `{API_BASE_URL}/api/v1/users/me`.
3. Sends the incoming cookies to the backend through the `Cookie` header.
4. Uses `credentials: "include"` where supported by the runtime.
5. Returns the current user on success.
6. Returns `null` for 401, network failure, malformed response, or missing API configuration.

The root layout passes the result into the client provider:

```tsx
<Providers initialUser={user}>{children}</Providers>
```

The client auth provider should initialize as:

- `authenticated` when `initialUser` is present
- `anonymous` when `initialUser` is null and auth API is configured
- `anonymous` when auth API is not configured

It should not perform an automatic refresh request on every page load. SSR `me` is the bootstrap source. Normal API calls handle expiration through refresh/retry.

## Auth State And Components

`AuthProvider` stores:

- `user`
- `status`
- `setUser` or equivalent state sync helper
- `logout`

Remove:

- `accessToken`
- any token response handling that assumes a readable access token
- any `Authorization` header dependency

`AuthStatus` in the nav bar should:

- Show the logged-in user's name or email when authenticated.
- Prefer `image` or equivalent backend user image field when available.
- Show a shadcn-style logout button when authenticated.
- Show a Google login button when anonymous.
- Avoid "Google OAuth 미설정" checks based on `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

`GoogleLoginButton` should:

- Use the current route as `returnTo`.
- Navigate to the backend OAuth authorize URL.
- Use existing shadcn-style local UI primitives where practical, especially `Button`.
- Keep the Google brand mark if it fits the current UI.

## App Shell And Routes

The app shell should be simplified to the retained public routes.

Header:

- Brand/home link.
- Optional links to `/terms` and `/privacy`.
- Right-aligned auth status.

Footer:

- Keep useful service and policy information.
- Remove links to deleted pages.

Remove admin, scan review, API key, contest, and sample-result navigation.

The implementation may remove route-specific components and mock data that become unused after route deletion. Shared UI primitives should stay.

## API Client And Refresh Retry

`lib/api/fetcher.ts` should become the shared cookie-aware API client.

Default behavior:

- Build URLs from `NEXT_PUBLIC_API_BASE_URL`.
- Send `credentials: "include"` for all browser API requests.
- Preserve JSON body handling and blob response handling.
- Parse backend app responses consistently where required by callers.

401 handling:

1. If a normal API request returns 401, call `POST /api/v1/auth/refresh`.
2. If refresh succeeds, retry the original request once.
3. If refresh fails, clear current user state where possible and surface the original auth failure.
4. If the retried original request still returns 401, stop.

Do not run refresh/retry for:

- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- OAuth authorize/callback navigation
- SSR bootstrap `GET /api/v1/users/me`
- requests explicitly marked public

Because backend refresh token rotation is enabled, concurrent 401 responses must share one in-flight refresh promise. Only one refresh request should be sent for a burst of expired-token failures.

## Logout Flow

Logout calls:

```text
POST /api/v1/auth/logout
```

with cookies included.

After logout completes or fails, the frontend should:

- Clear local user state.
- Stay on the current public page if it is `/`, `/terms`, or `/privacy`.
- Otherwise navigate to `/`.

Since only public content routes remain, logout should not need a protected-route redirect flow.

## Discovery Files

`app/sitemap.ts` should expose only:

- `/`
- `/terms`
- `/privacy`

`app/robots.ts` should not advertise deleted routes. It may disallow `/auth/callback` because that route is an OAuth infrastructure endpoint and should not be indexed.

If an RSS or feed implementation exists in this repository during implementation, update it to match the retained route set or remove it if it only existed for deleted content routes.

## Error Handling

Login start:

- Missing API base URL should disable the login action and show a compact configuration warning in development.
- In production, missing API base URL is a deployment configuration error; the UI should fail closed by not navigating to a relative OAuth URL.

Callback:

- Invalid `returnTo` falls back to `/`.
- Failed `/users/me` after callback clears auth state and returns to `/`.

API:

- 401 after refresh retry is treated as unauthenticated.
- Refresh failure should not loop.
- Backend error payloads should not be rewritten into token-specific messages.

## Testing And Verification

Required automated checks:

- `pnpm lint`
- `pnpm build` if local environment permits

Recommended targeted tests or manual browser checks:

- From `/`, login button navigates to `http://localhost:8080/api/v1/auth/oauth2/authorize/google?returnTo=%2F` in local.
- From `/terms`, login button includes `returnTo=%2Fterms`.
- From `/privacy`, login button includes `returnTo=%2Fprivacy`.
- Unknown current paths normalize to `/` if encountered.
- `/auth/callback?returnTo=/terms` calls `/api/v1/users/me` with cookies and routes to `/terms` after success.
- Already logged-in SSR requests render the nav with user state on the first page response.
- Missing or expired access cookie causes one refresh request and one original-request retry for normal API calls.
- Concurrent 401 responses share one refresh request.
- Logout calls backend logout with cookies and clears the nav user state.
- Sitemap contains only `/`, `/terms`, and `/privacy`.
- Robots does not expose deleted routes and excludes `/auth/callback` if disallow rules are present.

## Out Of Scope

- Client-visible access tokens.
- Bearer auth compatibility.
- Multiple OAuth providers.
- Protected application pages.
- Role or permission UI.
- Session management UI.
- CSRF token UI. Backend CSRF protection is intentionally deferred by the server MVP design.
