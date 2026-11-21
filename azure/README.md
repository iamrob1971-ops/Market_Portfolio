# Azure Function gateway — optional deployment

This folder contains an **unconfigured**, read-only Azure Functions Node.js v4 starter. It is **not deployed** and contains no secrets.

## What it does

- \`GET /api/status\` — reports whether provider secrets are configured.
- \`POST /api/quotes\` — retrieves at most 20 unique valid US-style tickers per request from Finnhub, with basic throttling and errors.
- \`POST /api/ask\` — sends a user-approved question and summary facts to the Gemini API; instructs the model not to fabricate portfolio numbers.

**No trade placement, account login, order submission, or broker data synchronization.**

## Essential prerequisites — not optional for an internet-facing financial app

1. Create an **Azure Function App** with Node.js 20+ and Functions v4. Deploy the source from this \`azure/\` folder, not the GitHub Pages static HTML root.
2. **Before enabling public access**, open Function App → Authentication, configure **Microsoft Entra ID (Easy Auth)**, set **Require authentication** and reject unauthenticated calls with **HTTP 401**. Restrict allowed users/tenants as appropriate. In addition to platform authentication, the handlers check for \`x-ms-client-principal\` but that header alone is **not** security if Easy Auth is disabled. Neither a public endpoint nor a function key embedded in GitHub Pages is sufficient.
3. Configure **CORS** for only \`https://iamrob1971-ops.github.io\`; never use \`*\` with credentials. Remember that cross-origin cookies can be blocked by browser privacy controls; a proper MSAL token-based SPA configuration is the preferred production approach. The current experimental client uses credentialed requests, not full MSAL token acquisition. It may return HTTP 401 until auth flow is configured.
4. Store \`FINNHUB_API_KEY\` and \`GEMINI_API_KEY\` as protected Azure application settings or Key Vault references. **Never commit keys, refresh tokens, account information, or local.settings.json.**
5. Optionally configure \`GEMINI_MODEL\`, default \`gemini-2.5-flash\` (check availability/quotas on your own key and region).
6. Turn off verbose provider body logging and avoid logging request JSON containing balances or positions.
7. Test identity access, CORS, provider usage limits, and market-data licensing for intended display before relying on the service.

## Client setup

- Open **Price Refresh** in GitHub Pages and enter the HTTPS Azure Function origin.
- Choose **Test Azure connection**. If authentication is not configured, a 401 response is expected.
- **Fetch quotes through Azure** prepares preview rows. Select and apply only verified prices.
- **AI Insights → Ask Gemini securely via Azure** sends only the explicitly selected scope and optional per-position details after confirmation.

## Free development testing without Azure

- The **Price Refresh** screen also permits **Finnhub direct browser testing**. Sign up for a free Finnhub API token, type it into the session-only password field, fetch a preview, and apply selected quotes. The token is *not persisted*, but is still exposed to browser runtime/other extensions and therefore is less secure than Azure.
- **AI Insights** offers local calculations and a structured **Copy prompt** workflow for Google AI Studio. This does not require an API key inside the GitHub Pages code.

This app currently assumes USD on the direct quote path. Do not use it to reprice foreign-currency securities or money market/sweep positions. Quotes are not guaranteed real-time and can be stale or unavailable.

## Deployment notes

The \`package.json\` and \`host.json\` under this folder are for a **separate Azure Functions project**. For local debugging, use Azure Functions Core Tools and a non-committed \`local.settings.json\`.

Example sanitized request:

\`\`\`http
POST /api/quotes
Content-Type: application/json

{"symbols":["SPY","AAPL"]}
\`\`\`

The API deliberately does not accept arbitrary third-party URLs. Its symbol whitelist, request-size ceiling, rate pacing, and fact-length ceiling provide an initial defense against abusive usage. Apply Azure access restrictions and appropriate per-user rate limiting before any shared deployment.

## Known restrictions

- Authentication integration from GitHub Pages to Entra is a **starter** rather than a production-complete MSAL implementation. A credentialed cross-origin browser request may fail if third-party cookies are blocked.
- No database, scheduled refresh, automation, quote caching, extended throttling, or retry queue.
- Finnhub free-tier coverage, entitlements, CORS behavior and licensing are subject to the provider's current terms.
- Gemini can still make analytical errors: monetary calculations belong in the local deterministic engine. The model output must not silently alter holdings or P&L.
