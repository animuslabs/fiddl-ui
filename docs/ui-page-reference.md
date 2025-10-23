# Fiddl UI Page Reference

This document details every routed page in the Fiddl UI (Quasar + Vue 3). It explains the purpose of each view, the data it pulls, and exactly how to construct deep links (including dynamic path segments and query parameters) so that third-party systems can launch users into the correct context.

All routes are declared in `src/router/routeData.json` and mounted under `layouts/MainLayout.vue`, unless noted otherwise. Components rely on the generated Orval client for API access—mirror that pattern when extending the app.

## Global Shell

`layouts/MainLayout.vue` renders the persistent header, navigation tabs, mission badge indicator, notification menu, and footer. It prefetches key routes on hover/touch and pushes notifications and points via the header buttons. All child pages are rendered inside `router-view`. Mobile users see a footer tab strip that mirrors the primary navigation.

## Route Index

| Name | Path(s) | Access | Highlights |
| --- | --- | --- | --- |
| Browse | `/`, `/browse`, `/discover` | Public | Infinite gallery powered by `useBrowserStore`, search bar with view toggles, media viewer integration |
| Home | `/home` | Logged-in focus | Recent creations strip + unlock feed |
| Newsletter Landing | `/newsletter` | Public | Landing with optional newsletter modal (`IndexPage.vue`) |
| Profile | `/@:username`, `/a` | Public (full features when logged in) | Tabs for favorites, creations, forge models, unlocked; deep-link via `tab` query |
| Stats | `/stats` | Admin only | Aggregated counts fetched via Orval stats endpoints |
| Create | `/create/:activeTab?` | Requires login for creation | Image/video creation orchestration with rich query support |
| Forge | `/forge/:mode?` | Logged in | Model training workflow; optional `customModelId` query |
| Studio | `/studio` | Logged in | Canvas-based editor backed by `useStudioStore` |
| Settings | `/settings` | Logged in | Account management, referrals, linked accounts |
| Add Points | `/addPoints` | Logged in for purchases | Points store (PayPal/Crypto/Telegram Stars) with history tab |
| Login | `/login` | Public | Magic link / code / OAuth entry; accepts `loginLink`, `token`, `payload`, `redirect` |
| Media Request | `/request/:type/:requestShortId/:index?`, `/r/:type/:requestShortId/:index?` | Public | Shows a specific image/video request; optional viewer index |
| Admin | `/admin/:adminTab?` | Admin only | Multi-tab admin console (promo codes, users, payments, etc.) |
| Claim Promo | `/claim/:claimShortId?` | Logged-in recommended | Claim promo codes by short id |
| Terms | `/tos` | Public | Terms of service |
| Pangea Login | `/pangeaLogin` | Public | Placeholder handler expecting `payload` query |
| Auth Callback | `/auth/callback` | Public | Legacy callback, redirects to login |
| OAuth Provider Callback | `/auth/callback/:provider` | Public | Handles OAuth login/link flows; reads query tokens |
| Tonomy Callback | `/tonomy/callback` | Public | Completes Tonomy ID login |
| Training Sets | `/trainingSet/:trainingSetId?` | Logged in | View user training sets or a specific set |
| Models | `/models/:filterTag?` | Public | Model catalogue filtered by tag |
| Model Detail | `/model/:modelName/:customModelId?` | Public view, logged-in to create | Shows model card, gallery, “create with model” |
| Magic Mirror Pro | `/magicMirror` | Logged in & points | Guided selfie-to-look workflow |
| Magic Mirror Fast | `/magicMirrorBanana` | Logged in & points | Streamlined “Fast” variant using Banana backend |
| Events & MOTD | `/events` | Logged in | Notification center + MOTD archive |
| Missions | `/missions` | Logged in | Mission list with claim actions |
| Telegram Login | `/tg-login` | Public | Finalizes Telegram auth using `?t=` JWT |
| Media Detail | `/image/:mediaId`, `/video/:mediaId` | Public | Fetches a creation by media id, auto-opens viewer; supports `commentId` |
| Avatar Crop | `/avatarCrop` | Logged in | Circular avatar cropper; requires `imageSrc` or `imageId` query |

## Discovery & Landing

### Browse (`src/pages/BrowsePage.vue`)
- **Purpose**: Landing gallery for browsing public creations. Loads batches via `useBrowserStore` with scroll-triggered pagination and recent creation refresh.
- **Key UI**: Sticky search bar (`components/BrowserSearchBar.vue`), `MediaGallery` toggling between mosaic and grid.
- **Data flow**: On mount, calls `browserStore.loadCreations()` and `loadRecentCreations()`; periodic refresh every five minutes.
- **Deep link tips**: No route params; use `/browse` (preferred) or `/discover`. The gallery supports `MediaGallery` events for “Use as input” linking to `create` with query injection handled by the store.

### Home (`src/pages/HomePage.vue`)
- **Purpose**: Authenticated dashboard showcasing `RecentCreationsStrip` and `UnlockUpvoteFeed`.
- **Access**: Users must be logged in to see personalized content; anonymous users are typically redirected elsewhere via nav.

### Newsletter Landing (`src/pages/IndexPage.vue`)
- **Paths**: `/newsletter`.
- **Behavior**: Renders marketing landing (`components/Landing.vue`) and sets `showMailForm` if route name is `newsletter`.
- **Deep link**: `/newsletter` forces the newsletter modal.

## User & Social Pages

### Profile (`src/pages/ProfilePage.vue`)
- **Paths**: `/@:username` (preferred), `/a` (account alias).
- **Purpose**: Public profile with tabs for favorites, creations (image/video), forge models, unlocked items. Logged-in owner sees additional tabs (`unlocked`) and account settings module inline.
- **Data sources**: Uses Orval `userFindByUsername`, `userPublicProfile`, collection APIs, and various stores (`useImageCreations`, `useVideoCreations`, `modelsStore`).
- **URL parameters**:
  - Path segment `username` (required unless using `/a`). Must include characters allowed by `validateUsername` regex.
  - Query `tab` (`favorites`, `creations`, `forgeModels`, `unlocked`). Invalid values fall back to defaults.
- **Account alias flow**: Visiting `/a` auto-attempts login (unless Telegram Mini App mode) and redirects to the user’s profile tab or to `/login?redirect=account`.
- **Deep link examples**:
  - `https://fiddl.art/@fiddlartist?tab=creations` – open creations tab.
  - `https://fiddl.art/a` – send authenticated users to their own unlocked tab.
- **Integration notes**: To prefill the Create page from profile cards, `editOnCreatePage` encodes `CreateImageRequest` JSON into `requestData` (see Create page section).

### Account Settings (`src/pages/AccountSettings.vue`)
- **Path**: `/settings`.
- **Purpose**: Manage profile bio, username, referral codes, linked accounts (email, Google, Telegram, X), notifications, discount codes, and affiliate payouts.
- **Deep link notes**: No custom query params. Use `/settings` after authentication flows (OAuth, Telegram, etc.) since those pages redirect here.

### Add Points (`src/pages/AddPointsPage.vue`)
- **Path**: `/addPoints`.
- **Purpose**: Purchase Fiddl Points through in-app packages (PayPal/Crypto) or Telegram Stars. Includes history tab.
- **State selectors**: `mainTab` (`buy` or `history`) is view state only. Mobile toggles adapt to `isTma` (Telegram Mini App) detection.
- **Integration tip**: When routing users here for upsells, pass optional marketing context through analytics rather than query params; the page reads `userAuth` directly.

### Events & Notifications (`src/pages/EventsPage.vue`)
- **Path**: `/events`.
- **Purpose**: Notification center with filters and MOTD archive.
- **Data sources**: Orval endpoints `eventsPrivateEvents`, `motdAvailable`, `motdGet`, plus `useMotdStore`.
- **Deep link**: No URL parameters, but opening a comment from a notification will forward users to `MediaCreationPage` with `commentId`.

### Missions (`src/pages/MissionsPage.vue`)
- **Path**: `/missions`.
- **Purpose**: Displays active and claimed missions for logged-in users with claim actions driven by `useMissionsStore`.
- **Notes**: No deep link parameters; respects authentication state to reset or refresh missions.

## Content Detail Pages

### Media Request (`src/pages/MediaRequestPage.vue`)
- **Paths**:
  - `/request/:type/:requestShortId/:index?`
  - `/r/:type/:requestShortId/:index?` (short share URL)
- **Parameters**:
  - `type`: `"image"` or `"video"`; determines which store fetches data.
  - `requestShortId`: Short identifier (use `longIdToShort` / `shortIdToLong` from `lib/util` when generating links server-side).
  - `index` (optional): Zero-based media index to auto-open inside the viewer dialog.
- **Behavior**: Loads the request via `useMediaRequests.getRequest`, prefetches creator username (`userGetUsername`), and automatically opens the gallery with `mediaViwer.show` when `index` is present.
- **Deep link example**: `https://fiddl.art/r/image/abc123/0` opens the first image in viewer mode.

### Media Detail (`src/pages/MediaCreationPage.vue`)
- **Paths**:
  - `/image/:mediaId`
  - `/video/:mediaId`
- **Query**:
  - `commentId` (optional): Scrolls the media viewer to a specific comment thread.
- **Behavior**: Uses Orval `creationsGetCreationData` to map media to its parent request, then calls `getCreationRequest` to hydrate the full `UnifiedRequest`. Auto-opens the media viewer to the media ID referenced in the URL. Provides author link-out.
- **Deep link examples**:
  - `https://fiddl.art/image/img_12345?commentId=com_678` – image viewer focused on a specific comment.
  - `https://fiddl.art/video/vid_222` – video viewer.

### Model Catalogue (`src/pages/ModelsPage.vue`)
- **Path**: `/models/:filterTag?`.
- **Purpose**: Lists public and custom models with chip-based tag filters.
- **Parameter**:
  - `filterTag` (optional): Any of the `ModelTags` exported from `lib/imageModels`. When provided, the route syncs `modelsStore.filter.tag` and scrolls the chip into view.
- **Deep link example**: `https://fiddl.art/models/portrait` scrolls to and filters the “portrait” tag.

### Model Detail (`src/pages/ModelPage.vue`)
- **Path**: `/model/:modelName/:customModelId?`.
- **Usage**:
  - Base models: `modelName` equals the slug (`flux-dev`, `seedream4`, `veo-2`, etc.); omit `customModelId`.
  - Custom models: use `/model/custom/:customModelId`.
- **Behavior**: Loads model metadata through `modelsStore.loadCurrentModel` and fetches creator username via `userGetUsername`. Populates image/video galleries from creation stores based on whether the model is an image or video model.
- **Deep link helper**: Use `toCreatePage` / `buildCreateRoute` so “Create with this model” flows remain consistent; see Create page section.
- **Example**:
  - `https://fiddl.art/model/flux-dev`
  - `https://fiddl.art/model/custom/mdl_abc123`

### Terms of Service (`src/pages/TosPage.vue`)
- **Path**: `/tos`.
- **Purpose**: Static content; no parameters.

### Claim Promo (`src/pages/ClaimPage.vue`)
- **Path**: `/claim/:claimShortId?`.
- **Behavior**: Converts `claimShortId` to the long form (`shortIdToLong`) and fetches promo details via `promoGetPromoCodeDetails`. When unclaimed, allows logged-in users to claim via `promoClaimPromoCode`.
- **Integration notes**: Generate short IDs server-side with `longIdToShort` so they match the front-end expectation.
- **Example**: `https://fiddl.art/claim/xyz789`.

## Creation, Training & Advanced Tools

### Create (`src/pages/CreatePage.vue` + `useCreateOrchestrator.ts`)
- **Path**: `/create/:activeTab?` where `activeTab` defaults to `"image"`; set to `"video"` for video workflow.
- **Purpose**: Unified creation hub for image/video requests with orchestration logic that applies URL parameters to stores, auto-opens dialogs on mobile, and coordinates the gallery filters.
- **Supported query parameters**:
  - `mediaId`: Rehydrate creation params from an existing image/video. Requires accompanying `type`.
  - `type`: `"image"` or `"video"`; used with `mediaId`.
  - `editType`: `"prompt"`, `"all"`, or `"video"`; scopes which fields are applied when cloning a creation.
  - `inputImageId`: Injects an image into the input stack and auto-opens the quick-edit dialog. Optional `model` query selects model (defaults to `nano-banana` when absent).
  - `requestData`: URI-encoded JSON blob representing a `CreateImageRequest` or `CreateVideoRequest`. `useCreateOrchestrator` decodes and applies it.
  - `model`: Preselects the model slug. For custom models pair with `customModelId` (and optional `customModelName`).
  - `customModelId`: Selects a specific custom model (image flow).
  - `customModelName`: Optional label shown in UI when preselecting a custom model.
  - `dynamicModel`: `1`/`true` to sync gallery filters with the selected model; `0`/`false` to disable.
  - `createMode`: `1`/`true` forces the create drawer open on load (useful on desktop); `0` hides it.
  - `noCreateModal`: Any value suppresses auto-opening the create drawer on mobile.
- **Deep link helper**: Use `buildCreateRoute` or `toCreatePage` (`src/lib/routeHelpers.ts`) to generate consistent links:
  ```ts
  import { buildCreateRoute } from "src/lib/routeHelpers"
  const route = buildCreateRoute({ type: "image", model: "flux-dev" })
  // => { name: "create", params: { activeTab: "image" }, query: { model: "flux-dev" } }
  ```
- **Example URLs**:
  - `https://fiddl.art/create/image?model=flux-dev&dynamicModel=1`
  - `https://fiddl.art/create/video?mediaId=vid_abc&type=video&editType=video`
  - `https://fiddl.art/create/image?inputImageId=img_123&model=flux-dev&noCreateModal=1`

### Forge (`src/pages/ForgeHomePage.vue`)
- **Path**: `/forge/:mode?` with modes: `pick` (default), `createModel`, `train`, `createSet`.
- **Queries**:
  - `customModelId`: When present, auto-fetches the custom model via `modelsGetCustomModel` and either resumes training or prepares the model for use.
  - Other queries are preserved during mode switches for shareability.
- **Purpose**: Manage and train custom models, pick training sets, monitor status, and jump into create flows through `toCreatePage`.
- **Integration tips**:
  - Use `/forge/createModel?customModelId=mdl_123` to jump straight into the training monitor for a specific model.
  - Selecting a training set routes to `/trainingSet/:trainingSetId`.

### Training Sets (`src/pages/TrainingSetPage.vue`)
- **Path**: `/trainingSet/:trainingSetId?`.
- **Behavior**: Without `trainingSetId`, lists the user’s sets via `useTrainingSetsGetUserSets`. With it, loads details (`useTrainingSetsGetSet`) and shows thumbnails, model list, and quick action buttons.
- **Deep link example**: `https://fiddl.art/trainingSet/set_456` opens a specific set.
- **Cross-linking**: The “Train Model” button calls `router.push({ name: "forge", params: { mode: "createModel" }, query: { trainingSetId: ... } })`. Mirror this if linking back from other experiences.

### Studio (`src/pages/StudioPage.vue`)
- **Path**: `/studio`.
- **Purpose**: Canvas-based composition tool with asset drawer, layer inspector, and output queue managed by `useStudioStore`.
- **Notes**: Relies on local state; no routing params. When embedding from external tools, route users to `/studio` after seeding assets in the store (e.g., via Pinia persistence).

### Magic Mirror Pro (`src/pages/MagicMirrorPage.vue`)
- **Path**: `/magicMirror`.
- **Purpose**: Selfie-to-character workflow with capture, training, template selection, and results. Requires sufficient points (`magicMirrorProTotalPoints`).
- **Features**:
  - Auto-checks points; shows “Magic Mirror Fast” upsell when insufficient.
  - Uses `useMagicMirrorResults` to trigger saves, downloads, and video animations, often routing to Create (`toCreatePage`) or Add Points.
  - Dialogs respect mobile fullscreen requirement (`:maximized="$q.screen.lt.md"`).
- **Deep link**: No query params; share `/magicMirror` directly after gating user login/points.

### Magic Mirror Fast (`src/pages/MagicMirrorBananaPage.vue`)
- **Path**: `/magicMirrorBanana`.
- **Purpose**: Accelerated Magic Mirror variant hooking into Banana pipeline (`Nano Banana` + `Seedream`). Provides inline `toCreatePage` navigation for further editing.
- **Notes**: No custom params; route users when promoting the faster experience.

## Economy & Rewards

### Stats (`src/pages/StatsPage.vue`)
- **Path**: `/stats`.
- **Access**: Admin only (checks `$userAuth.userData?.admin`).
- **Data**: Fetches users, images, collections, payments via Orval endpoints. Includes copy-to-clipboard for admin JWT.

### Missions (covered above) & Event flows feed mission badges in `MainLayout`.

## Authentication & Identity Flows

### Login (`src/pages/LoginPage.vue`)
- **Path**: `/login`.
- **Purpose**: Central entry point for magic link login, code login, passkey experiment, and Privy social login.
- **Query parameters**:
  - `loginLink`, `token`, or `payload`: Candidates for magic-link token. The first present is used.
  - `redirect`: Route name (e.g., `account`, `create`) to navigate to after successful login.
- **Behavior**: Auto-detects link tokens on mount and swaps the UI into “completing login” mode. Tracks events via Umami.
- **Example**: `https://fiddl.art/login?token=abc123&redirect=create`.

### Legacy Auth Callback (`src/pages/AuthCallback.vue`)
- **Path**: `/auth/callback`.
- **Purpose**: Back-compat handler for older auth flows. Stores `returnTo` from query and redirects to `/login`.

### OAuth Provider Callback (`src/pages/OAuthProviderCallback.vue`)
- **Path**: `/auth/callback/:provider`.
- **Supported providers**: `google`, `twitter` (`x` alias).
- **Query parameters**:
  - `token` (required), `userId` (required) — session payload from the server.
  - `mode`: `"login"` (default) or `"link"`.
  - `returnTo`: Absolute or relative URL to redirect to (ignores `/login`).
  - `error` / `error_detail`: Error messaging from provider.
- **Conflict handling**: Uses sessionStorage `linkInitiatorUserId` to resolve account-link conflicts; displays options to login to the other account or re-link.
- **Post-success**: Defaults to `/settings` if no `returnTo`.

### Tonomy Callback (`src/pages/TonomyCallback.vue`)
- **Path**: `/tonomy/callback`.
- **Behavior**: Uses `ExternalUser.verifyLoginResponse()` to obtain JWT, then calls `userAuth.tonomyLogin`. Redirects to `returnTo` from sessionStorage or `/settings`.

### Telegram Login Completion (`src/pages/TgLogin.vue`)
- **Path**: `/tg-login`.
- **Query**:
  - `t`: JWT provided by Telegram login bot.
- **Behavior**: Parses the JWT for `userId`, persists it via `lib/jwt`, warms user data, then routes to `/settings`. On failure, shows message with quick link to settings.
- **Deep link**: `https://fiddl.art/tg-login?t=<jwt>`.

### Pangea Login (`src/pages/PangeaLoginPage.vue`)
- **Path**: `/pangeaLogin`.
- **Query**:
  - `payload`: Expected to contain the Pangea login payload (integration currently commented out).
- **Behavior**: If payload missing, notifies and routes home; otherwise shows loading and (when re-enabled) handles login.

## Operations & Admin

### Admin Console (`src/pages/AdminPage.vue`)
- **Path**: `/admin/:adminTab?`.
- **Tabs**: Promo codes, MOTD, email funnels, users, user attributions, payments, uploaded images, training images, discount codes, affiliate payouts, stats.
- **Route behavior**:
  - `adminTab` is slugified (see `slugForTab` / `normalizeAdminTab`)—values like `promo-codes`, `motd`, `email-funnels`, etc.
  - Tab watcher keeps the URL in sync via `router.replace`.
- **Linking tips**:
  - `https://fiddl.art/admin/discount-codes` jumps straight to the discount code manager.
  - `https://fiddl.art/admin/promo-codes` to open promo tab.
- **Data**: Uses many Orval endpoints (`promoGetPromoCodeDetails`, user search, payments). Ensure new admin pages also rely on Orval for consistency.

## Utility Interfaces

### Avatar Crop (`src/pages/AvatarCrop.vue`)
- **Path**: `/avatarCrop`.
- **Query parameters**:
  - `imageSrc`: Absolute URL of image to crop, or
  - `imageId`: Media id resolved via `compressedUrl(imageId, "lg")`.
  - Optional `x`, `y`, `scale`: Numbers used to initialize the crop position/zoom.
- **Behavior**: Loads image, sets transform state, and signals readiness by setting `document.body.dataset.avatarReady`.
- **Deep link example**: `https://fiddl.art/avatarCrop?imageId=img_123&scale=1.2`.

### Terms (`/tos`) and other statics share the layout shell with no parameters.

## Linking Recipes

### Linking to an Image or Video Request
1. Obtain a creation short id from the backend (convert via `longIdToShort` if you have the long form).
2. Choose `type` (`image` or `video`) and optional viewer index.
3. Build URL: `/r/{type}/{shortId}/{index?}` (short form) or `/request/{type}/{shortId}/{index?}`.

### Linking directly to a specific media asset
1. Collect `mediaId` (e.g., from API response).
2. Use `/image/{mediaId}` or `/video/{mediaId}` and append `?commentId=` when you want to highlight a discussion.

### Launching the Create Page with prefilled data
- For existing creations: `/create/image?mediaId=img_123&type=image&editType=all`.
- For quick-edit of an input image: `/create/image?inputImageId=img_987&model=nano-banana`.
- To force a custom model: `/create/image?model=custom&customModelId=mdl_abc&customModelName=Space%20Portraits&dynamicModel=1`.
- Use `buildCreateRoute` / `toCreatePage` whenever constructing routes in code.

### Direct Model Access
- Public model: `/model/flux-dev`.
- Custom model: `/model/custom/{customModelId}`—the page fetches metadata via Orval and offers “Create with this model,” which routes back through the Create helper.

### Admin Tab URLs
- `/admin/promo-codes` − promo tab.
- `/admin/affiliate-payouts` − payouts tab. The component ensures the slug stays normalized.

### Promo Code Claiming
- Share `/claim/{shortId}`. Users must be logged in to claim; the page handles success/failure dialogs and redirects to `/browse`.

## Notes on Data Access

- The UI consistently relies on the Orval-generated client in `src/lib/orval`. When replicating behavior (e.g., building integrations that hit internal endpoints before routing users into the web app), use the same client or the underlying REST endpoints with matching parameters.
- Stores (`useBrowserStore`, `useImageCreations`, `useMissionsStore`, etc.) encapsulate pagination, filtering, and caching. When deep linking from third-party experiences, prefer to pass minimal context through the URL and let the stores rehydrate via their normal workflows.
- Respect mobile dialog behavior: new dialogs must bind `:maximized="$q.screen.lt.md"` to comply with the project’s responsive guideline.

This reference should make it straightforward to understand what each route does and how to deep-link into any page, whether you are wiring up in-product shortcuts, external marketing campaigns, or partner integrations.
