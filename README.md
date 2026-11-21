# Market Portfolio — Manual Edition (v1)

Personal, local-first stock market and portfolio dashboard. Hosted as a static GitHub Pages HTML application. **Do not commit actual holdings, statements, personal account numbers, API keys, credentials, or JSON backups to this public repository.**

## What works today

- Owner groups such as Me, Mom, and Children; managed accounts are separate from My Portfolio by default.
- Multiple account labels and types (brokerage, IRA, Roth IRA, joint, custodial).
- Manual holdings with quantity, total cost basis, price, and unrealized P&L.
- Cash balance tracking without double-counting money market fund positions.
- Manual market-index/commodity indicators, shown as manual data.
- Dividend profiles and estimated annual income.
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
