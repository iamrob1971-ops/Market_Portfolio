# Fidelity Connected — read-only Azure preview

Status: source committed, Azure deployment pending.

## Security boundary

- Requires App Service Authentication (Microsoft Entra Easy Auth) with unauthenticated requests denied.
- Requires the `BROKERAGE_ALLOWED_OBJECT_ID` Function App setting (Microsoft Entra **user object ID**, not client ID). Missing or mismatched setting denies access.
- The `market-portfolio-gateway-uami` user-assigned identity resolves four existing Key Vault references: `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY`, `SNAPTRADE_USER_ID`, `SNAPTRADE_USER_SECRET`.
- Never place any of those values in GitHub or browser code. Avoid revealing app setting values, credentials, request bodies or provider errors in screenshots/logs.
- Endpoints do not create/rotate SnapTrade users, authorize new accounts, place orders, or write IndexedDB.

## Routes

- `GET /api/brokerage/fidelity` — authenticated Azure-hosted viewer (same-origin).
- `POST /api/brokerage/fidelity/preview` — authenticated JSON preview.
- A new `Fidelity Connected` tab in GitHub Pages links to the viewer; the browser does not send SnapTrade credentials.

## Setup after checkout

From the repository's **azure** directory on the Windows deployment machine:

```powershell
npm install --omit=dev
npm run check
```

This updates package-lock.json locally and installs the newly required `snaptrade-typescript-sdk`. Make the deployment ZIP with `host.json`, `package.json`, `src/`, `node_modules/`, and `package-lock.json` at the ZIP root. ZIP internal paths must use forward slashes; the previous Windows backslash-path package failed Azure function discovery. Use the existing Azure Deployment Center manual ZIP push procedure.

Configure the user allowlist as a **protected Azure app setting**, without exposing credentials:

```bash
az ad signed-in-user show --query id --output tsv
```

Copy the returned **Entra user object ID** into `BROKERAGE_ALLOWED_OBJECT_ID` on the Function App → Settings → Environment variables, then Apply. This is a server-side authorization check separate from successful Entra sign-in.

## Validation

1. After deployment, verify existing `status`, `quotes`, and `ask` function registrations are still enabled, plus `fidelityPreview` and `fidelityViewer`.
2. Verify anonymous requests return 401.
3. Open the authenticated Azure viewer from the GitHub Pages `Fidelity Connected` tab.
4. The viewer initially shows **no account data** until you click **Retrieve Fidelity preview**. For a wrong/missing allowed object ID it returns 403/503.
5. Confirm account count, net equity, money-market `cashEquivalent` flags, cash currency breakdown, null versus explicit zero margin loans, and provider freshness. Fidelity totals may not equal a local CSV snapshot taken earlier.
6. If balances V2 fails, it may be an endpoint entitlement or provider issue. The preview reports a per-account failure rather than treating it as zero.
7. **Do not delete obsolete IndexedDB records before the preview works.** User has approved later replacement and does not require a backup for obsolete Fidelity CSV import.

## Provider notes

SnapTrade `/accounts/all` returns daily-cached account listings with `kind: investment` and `display_name`, but does not guarantee a human institution name. This initial preview shows every connected investment account under the existing one-user Commercial Test integration; confirm identities before adding other brokerages or treating all rows as Fidelity. Balance V2 and position endpoints can report independent as-of timestamps. Cash-equivalent money market holdings may already be reflected in cash; do not sum blindly.

Docs: https://docs.snaptrade.com/docs/commercial-api-key
