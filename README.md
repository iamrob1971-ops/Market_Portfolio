# Market Portfolio — Manual Edition (v1)

Personal, local-first stock market and portfolio dashboard. Hosted as a static GitHub Pages HTML application. **Do not commit actual holdings, statements, personal account numbers, API keys, credentials, or JSON backups to this public repository.**

## What works today

- Owner groups such as Me, Mom, and Children; managed accounts are separate from My Portfolio by default.
- Multiple account labels and types (brokerage, IRA, Roth IRA, joint, custodial).
- Manual holdings with quantity, total cost basis, price, and unrealized P&L.
- Cash balance tracking without double-counting money market fund positions.
- Manual buy/sell transaction journal and recorded realized P&L estimates.
- Copy ticker list/Gemini research prompt, paste researched quotes with timestamps, preview and apply.
- Finnhub free-tier manual quote preview (session-only key), source/timestamp validation and optional Azure gateway.
- Local numeric Q&A and structured Gemini prompts with explicit owner scopes.
- Manual market-index/commodity indicators, shown as manual data.
- Dividend profiles and estimated annual income.
- Cross-account basket creation, tagging, and aggregate basket reports.
- Imported statement market values and pending adjustments, with 401(k)/BrokerageLink reconciliation.
- On-demand portfolio recalculation and historical valuation snapshots.
- CSV holdings import preview and manual approval.
- JSON export/restore backups and holdings CSV export.

## Publish with GitHub Pages

In GitHub, open **Settings → Pages → Build and deployment**. Select **Deploy from a branch**, branch **main**, folder **/(root)**, and save.

Expected Pages URL: https://iamrob1971-ops.github.io/Market_Portfolio/

Until Pages is enabled, the repository's `index.html` can be downloaded and run locally. All application data is local to the browser origin and device. The GitHub Pages URL and a local file are *different storage locations*; exporting/importing JSON moves data between them.

## First use

1. Open the app. Under **Accounts & Owners**, add brokerage accounts and assign owner groups.
2. Under **Holdings**, enter ticker, quantity, **aggregate total cost basis**, and manual current price.
3. Enter cash (excluding any money market fund already included as a holding).
4. Under **Dividends**, set recurring distribution amounts and frequency.
5. Enter indexes or commodities in **Market Indicators** if desired.
6. Return to **Dashboard**. Use **Recalculate** after modifying manual data.
7. Use **Import & Backup → Export full JSON backup** regularly.

The Owner dropdown defaults to *My Portfolio*, which includes only owner groups flagged as included. Select *Mom* or *All Portfolios* for separate monitoring/oversight. Account owners are reporting groups, not a representation of legal title.

## Import the reconciled Fidelity November 20, 2026 data

The private import file is delivered separately through the ChatGPT conversation. **Do not upload this JSON file or your raw Fidelity CSV statements into this public GitHub repository.**

1. Open the published app in the same browser/device you will use for managing the portfolio.
2. Open **Import & Backup**, then **Export full JSON backup** first if you already entered any accounts or holdings.
3. Under **Restore JSON**, choose the `Market_Portfolio_Fidelity_Import_2026-11-20.json` file downloaded from the conversation.
4. Confirm the replacement. This replaces current browser data; it does not merge. The app then shows the imported Fidelity accounts, positions, pending adjustments and baskets.
5. Select **My Portfolio** for the imported Fidelity overview, then **Baskets** to see grouped investments across accounts.

The private import includes four account views: joint taxable brokerage, traditional IRA, 401(k) core holdings, and 401(k) BrokerageLink. The 401(k) plan's summary BrokerageLink line is excluded because the linked account is imported at the detail level. A separate duplicate BrokerageLink CSV is also excluded.

The statements include pending adjustments and a mismatch between the 401(k)'s BrokerageLink summary line and linked-account detail; those are displayed separately under Dashboard → Statement Reconciliation, rather than silently netted into investment positions.

**Baskets are cross-account grouping tags.** A basket may include holdings from taxable brokerage, IRAs, and other accounts, but basket membership never changes account ownership, tax status, or account-level performance calculations. Each Fidelity source row is preserved separately to avoid collapsing distinct cash/margin lots of the same ticker.

## Transactions (new)

Go to **Transactions** and select an exact position row. Enter a BUY or SELL, quantity, execution price, date and optional note. The app updates the holding's quantity and cost basis and records the transaction in the local journal. A full sale leaves a zero-quantity position in place to preserve history; realized P&L on sales uses proportional average basis as an **estimate**, not brokerage tax-lot accounting.

**Important:** Transactions do not place broker orders, adjust separate cash balances, handle fees, taxes, corporate actions or reconcile pending activity. Record cash separately from a brokerage statement. Holdings with recorded transactions cannot be overwritten through the standard manual holding form, CSV import, or deletion without first preserving the ledger.

## AI-assisted price intake (new)

Go to **Import & Backup → Research Quote Intake**.

1. Click **Copy tickers** or **Copy Gemini prompt**. The copied request contains symbols, not holdings or balances.
2. Ask Gemini (or a research service with current source access) for a plain CSV: `symbol,price,currency,asof,source`.
3. Paste the CSV into the app, **Preview quotes**, check each source, timestamp and symbol, and **Apply prices**.
4. A matching ticker is updated across all accounts without changing quantity, cost basis or transaction history. Imported quotes retain source and timestamp metadata in the local database.

Quote intake currently accepts USD and valid ISO 8601 timestamps with timezones. AI-generated market data is **unverified** and may be inaccurate or stale; do not treat it as a real-time feed. This does not automatically call Gemini or require an API key. Free-tier quote API providers can be integrated later via Azure Functions.


## Actual US indexes: TradingView hosted widget

The Dashboard embeds TradingView's free branded **Market Data / Market Quotes** widget with the actual index symbols **DJ:DJI** (Dow Jones Industrial Average), **SP:SPX** (S&P 500) and **NASDAQ:IXIC** (Nasdaq Composite). These are **index point levels**, not SPY/DIA/QQQ ETF share prices and not Nasdaq-100.

- TradingView hosts and updates the display while the dashboard is open; it **does not** consume Finnhub or FMP API calls, or require us to poll these three values every two minutes.
- Market-data timeliness is controlled by TradingView and each exchange. Free official index feeds can be delayed (for example, TradingView's coverage page lists delayed Dow Jones and Nasdaq index data). Never label this embedded widget as guaranteed real-time.
- Keep TradingView branding and attribution. Widget values are isolated from portfolio holdings and calculations (there is no supported API for harvesting the widget's internal data).
- A browser blocker or provider widget outage can prevent display. The widget has an external link to TradingView's US-index quotes.
- The older **Actual Indexes** FMP test remains available as an optional experimental separate tab but its duplicate Dashboard card is hidden. Free FMP access previously returned HTTP 402, so leave automatic polling off.

## Focus watchlists and visible-only market updates

There are two **separate** live features, neither of which places orders or syncs with brokerage accounts.

### Watchlists & Live — Finnhub WebSocket

The **Watchlists & Live** tab supports multiple local watchlist groups. Add symbols from currently visible holdings or manually type any valid stock symbol; remove them or delete a group without affecting holdings.

- To stream, enter the same Finnhub API token used for **Price Refresh** and click **Start live updates**. The application opens one \`wss://ws.finnhub.io\` connection and subscribes to the union of the watchlist symbols, capped at **20 unique symbols** for this initial implementation. Finnhub's plan-specific subscription/connection entitlement should be verified with the user's free key.
- Trade event prices appear in the live watchlist only. They are **not** guaranteed to be consolidated/official exchange prices or to update every second.
- A **Stop** control closes the connection. The connection also closes while the browser page is hidden and resumes when visible, unless the user stopped it. Reconnection attempts are limited with backoff.
- Streamed prices **do not automatically modify portfolio valuations**. Use **Apply streamed prices to holdings** after review to change saved prices for matching holdings; shares and cost basis never change.
- The WebSocket token is kept in the browser tab's memory and included in the provider's WebSocket URL. It is visible to the browser/runtime and should not be placed in the public GitHub repository. One open connection per API key is safest for free-tier testing; avoid multiple browser tabs with an active stream.
- **Refresh All** remains available for a complete REST portfolio snapshot with previous-closing-price data. Trade stream messages do not include the complete REST quote fields.

### Actual Indexes — optional FMP direct-index feed (experimental)

The **Actual Indexes** tab is separate from all equity ETFs. It expects direct index point values from Financial Modeling Prep (FMP) for **\`^DJI\`**, **\`^GSPC\`** and **\`^IXIC\`** via **one batch request** to \`/stable/batch-index-quotes\`. The misleading SPY/DIA/QQQ/IWM benchmark proxy header tiles were removed.

- Obtain an FMP free API key separately. Free-tier support for this specific endpoint, data freshness, browser CORS access, and index redistribution rights are **not guaranteed**; use **Test once** to verify.
- If the test works, select **Enable visible-only auto updates**. The default is **every two minutes**, on US weekdays during **9:30 AM–4:00 PM Eastern**, only while the page is visible. Other options: three or five minutes.
- The free plan documents **250 API calls per day**. The app uses a conservative **200-request local per-day browser-tab cap**, which may not capture calls made on other tabs/devices. Two-minute polling for a 6.5-hour regular session consumes about 195 calls, assuming a working one-request batch endpoint.
- If the provider rejects a request, a browser/network request fails, or the response lacks expected actual indexes, automatic requests stop rather than wasting the daily allowance.
- The provider's response timestamp (when included) is distinguished from the retrieval timestamp; no index value is invented or silently replaced by ETF proxy values. Indexes saved to the portfolio are strictly display data and do not reprice account holdings.
- **Automatic polling does not run after the page is closed or while hidden.** GitHub Pages is still a static site and does not run a background scheduler.

### MarketWatch scraping

No MarketWatch scraper has been implemented. Repeatedly scraping a news/quote webpage can break with page changes, run into browser CORS and bot controls, and raise market-data licensing/terms issues. Prefer authorized APIs or an explicitly licensed embedded index widget instead of treating website display as permission to extract market quotes.

## Market overview: gold and silver spot plus WTI market reference

The dashboard Market Overview now displays independently sourced **spot gold** and **spot silver** quotes in **USD per troy ounce** from [Gold-API](https://gold-api.com/docs), plus a **WTI crude reference** in **USD per barrel** from [AmericasOilWatch](https://americasoilwatch.com/api). The latter is typically a quoted **front-month futures contract**, **not the official physical Cushing WTI spot price**, and the tile identifies the provider and reference type. The oil endpoint may fall back to older EIA/FRED spot observations. Always inspect as-of times and instrument descriptions.

To avoid substituting inaccurate ETF values for commodity spot prices, GLD, SLV, and USO have been removed from the *market indicator header*. They remain eligible holdings if you actually own them. The other optional Finnhub header indicators remain:

| Label | Symbol | Meaning |
| --- | --- | --- |
| S&P 500 | SPY | ETF share price, **not** index level |
| Dow Jones | DIA | ETF share price, **not** index level |
| Nasdaq-100 | QQQ | ETF share price, **not** Nasdaq Composite |
| Russell 2000 | IWM | ETF share price, **not** index level |
| Long Treasuries | TLT | Bond ETF share price, **not** Treasury yield |

**Refresh behavior:**
- **Refresh All — Preview Quotes** retrieves all eligible portfolio and optional header ETF symbols through Finnhub, deduplicated and paced at a minimum 1.5 seconds between request starts (maximum approximately 40/minute).
- The same button **also starts** the independent Gold-API (two requests) and AmericasOilWatch (one request) fetch. Or use **Refresh Gold, Silver & WTI** separately without a Finnhub key.
- Spot/reference requests **do not use Finnhub's quota**. Each provider is checked at most once per 60 seconds per open tab. Market spot/reference values save locally after validation; portfolio positions are not altered.
- Finnhub quotes are still **previewed and explicitly applied** before changing holdings or existing Finnhub header ETF quotes.
- Spot gold/silver quote endpoints do **not** supply an authenticated comparable previous-day close in the free response, so no day-over-day change is invented. WTI change is shown only when the upstream response supplies one.
- On request failure, the prior saved value (if any) remains; it is accompanied by its original timestamp. The app does not infer a fresh price when none was delivered.

For actual **WTI Cushing spot assessments**, the authoritative free source is the [U.S. Energy Information Administration](https://www.eia.gov/opendata/), which requires free API registration and generally reports assessed data later than an intraday futures market. The current no-key WTI card is labeled as a market reference, not guaranteed physical spot.

These sources are publicly accessible but not guaranteed available or accurate at every refresh; validate usage terms, quote age, and availability before relying on the numbers.

## Previous-close comparison and daily movement

Finnhub's existing `GET /quote` response provides current/last price (`c`), previous session closing price (`pc`), change (`d`), and percent change (`dp`). The browser app calculates change from `c - pc` and `(c / pc - 1) × 100` so **no additional Finnhub requests** are needed.

After **Refresh All → Review → Apply selected prices**:

- **Price Refresh** shows Current/Last, Previous Close, and Change per share.
- **Holdings** shows Last Price, Previous Close, Day Change per share, and Position Day Change (shares × per-share change).
- **Dashboard** displays Daily Price Change for *covered holdings only*, with its percentage weighted by the prior-close values of those covered positions.
- Previous close is saved along with quote source and timestamp in IndexedDB / JSON backups. Older manual/imported rows without this field show a dash rather than an invented comparison.

**Important:** The quoted prior close is the previous trading session's close relative to the provider's quote, not an arbitrary historical date. Quotes may be stale or delayed. The portfolio daily change excludes cash, unmatched/missing-price holdings, pending adjustments and flows, and it is **not** a cash-flow-adjusted investment return. All portfolio values remain user-entered or quote-imported; no brokerage balances are fetched.

## New: Free quote refresh (manual, review before apply)

Go to **Price Refresh**.

1. Create a free market-data token through [Finnhub](https://finnhub.io/). Verify the service's current license/quotas for personal use.
2. Enter that **limited market-data-only token** in the password field *in your own trusted browser*. It is held in the page's memory only; it is never written to IndexedDB, JSON backups, or GitHub. It is nevertheless visible to the client browser runtime, so use the future Azure gateway for stronger key protection.
3. Click **Refresh All — Preview Quotes**. The app requests all distinct eligible USD stock/ETF symbols in the currently selected owner view, spacing request starts by at least 1.5 seconds (40/minute at most in this browser tab). Use **First 10 (test)** for small trials. A Stop button ends the run after the active request.
4. Watch the progress counter. If Finnhub reports HTTP 429, the app pauses at least 65 seconds and retries once; if rate limiting persists, it stops and keeps previously fetched previews. Review price, timestamp, coverage and possibly stale results. Uncheck anything questionable.
5. Click **Apply selected prices**. The app updates price and quote provenance across matching positions without changing quantities, cost basis, baskets, dividends or transaction history.
6. Use **Import & Backup → Export full JSON backup** regularly.

**No live-refresh-on-page-load; no broker trades.** Finnhub usage elsewhere under the same key counts toward its provider limits; spacing the requests in one browser tab cannot guarantee the provider will never return 429. A free-tier API may fail due to quota, missing symbols, CORS/browser restrictions or data entitlements. Direct quote mode does not handle foreign-currency shares, index derivatives, or money-market funds. Failed quotes never overwrite older values.

## New: Portfolio Q&A and Gemini

Go to **AI Insights**. The local Q&A calculates account values, unrealized P&L, estimated dividend income, and basket values directly from saved records—**without an external model**. Select the owner scope carefully; *All owners* includes managed accounts.

For Gemini explanations, type a question and click **Prepare prompt**. Review the structured prompt before copying it into [Google AI Studio](https://aistudio.google.com/). By default it shares account-level summaries; selecting **Include individual positions** explicitly adds ticker, quantity, account label and cost basis details.

**Future secure connected mode:** the \`azure/\` folder now contains an Azure Functions gateway for Finnhub quote calls and Gemini Q&A. Once you deploy it, enable Microsoft Entra Easy Auth, restrict authorized users, add provider secrets in protected Azure settings, and set appropriate CORS. Enter the function origin in **Price Refresh** to test it. The Azure client is a starter that may need an MSAL authentication integration to work across browser origins; it is not deployed or automatically functional today. See [Azure gateway instructions](azure/README.md).

Gemini responses are *narrative assistance*, never the source of authoritative holdings calculations.

## CSV import

CSV header: `account,symbol,quantity,basis,price`

```csv
account,symbol,quantity,basis,price
Roth IRA,SCHD,100,2500,27.50
```

The `account` value must uniquely match an account label already configured in the app. Importing updates a matching position by account+symbol. Use *Preview CSV* before approving.

## Calculation rules

- Position value = quantity × entered price.
- Unrealized P&L = position value − entered total cost basis.
- Account value = securities and money-market-fund values + separately recorded cash.
- Estimated annual income = quantity × declared manual distribution per share × payments/year.
- Estimated income is not a guarantee; special/irregular dividends, tax lots, external cash flows, foreign currencies, and realized gains are not modeled yet.
- Snapshots show recorded account values, not investment performance adjusted for deposits and withdrawals.

## Data and security

Data is saved in browser **IndexedDB**, *not* GitHub or SharePoint. Keep a current backup; clearing site data, changing browsers, or moving devices can cause local data loss. The site has no authentication or encryption, so access it only on a trusted personal device. Do not store secrets or account numbers. The code is public if the repository is public.

## Roadmap

1. Manual-entry polish and account/owner reporting.
2. Smarter CSV/PDF statement import with reconciliation.
3. Secure Azure Function market-data gateway using Schwab OAuth; IBKR and Twelve Data adapters optional.
4. SharePoint/Graph persistence, authenticated cross-device sync, audit history.
5. Historical market data, dividend calendars, verified total-return calculations, and AI-assisted analysis.

**No broker trading/order endpoints are planned.**
