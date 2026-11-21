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


## New: Free quote refresh (manual, review before apply)

Go to **Price Refresh**.

1. Create a free market-data token through [Finnhub](https://finnhub.io/). Verify the service's current license/quotas for personal use.
2. Enter that **limited market-data-only token** in the password field *in your own trusted browser*. It is held in the page's memory only; it is never written to IndexedDB, JSON backups, or GitHub. It is nevertheless visible to the client browser runtime, so use the future Azure gateway for stronger key protection.
3. Click **Fetch quote preview**. The app requests distinct USD stock/ETF symbols for the currently selected owner view. The initial limit is 20 symbols per refresh.
4. Review price, timestamp, coverage and possibly stale results. Uncheck anything questionable.
5. Click **Apply selected prices**. The app updates price and quote provenance across matching positions without changing quantities, cost basis, baskets, dividends or transaction history.
6. Use **Import & Backup → Export full JSON backup** regularly.

**No live-refresh-on-page-load; no broker trades.** A free-tier API may fail due to quota, missing symbols, CORS/browser restrictions or data entitlements. Direct quote mode does not handle foreign-currency shares, index derivatives, or money-market funds. Failed quotes never overwrite older values.

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
