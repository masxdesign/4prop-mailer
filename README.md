# @4prop/mailer

Shared transactional-email primitives for the 4prop monorepo.

This package owns the email transport (AWS SES) and the layout shell used by
all branded outbound emails. Feature-specific templates can live either here
(see `src/templates/`) or alongside the feature in its own app. The branding
lookup (`getBranding`) reads `a_magAdvertisers` so emails carry the advertiser's
logo, name and color theme.

## What's here

| Module | Purpose |
| --- | --- |
| `src/mailer.js` | `sendEmail({to, from, subject, html, text, sandbox})` — SES `sendEmail` wrapper with sandbox-redirect support |
| `src/renderEmail.js` | Wraps a template function in the branded layout shell + adds an optional tracking pixel |
| `src/branding.js` | `getBranding(pool, advertiserId)` — fetches advertiser-scoped branding; falls back to `DEFAULT_BRANDING` |
| `src/templates/verifyEmail.js` | Email-verification template (CTA button + paste-fallback) |
| `src/sendVerificationEmail.js` | High-level: branding lookup → render → send for the verify flow |

## Why injected pool

`getBranding` requires a mssql pool but does NOT own one — both bizchat and
property-pub already have their own ABASE pool plumbing. Pass it in:

```js
import { sendVerificationEmail } from "@4prop/mailer"
import getAbasePool from "./utils/getAbasePool.js"

await sendVerificationEmail({
  abasePool: getAbasePool(),
  user,
  plainToken,
  advertiserId,
})
```

This keeps the package portable and avoids two-pool footguns.

## Sandbox / SES setup

`sendEmail` honours a `sandbox` flag. When true, recipients are replaced with
the comma-separated `SANDBOX_EMAILS` env var. The verify helper turns sandbox
mode on when **any** of these is true:

- `a_magAdvertisers.sandbox = 1` for the resolved advertiser (per-tenant)
- `MAIL_FORCE_SANDBOX` env var is truthy (`1`/`true`/`yes`/`on`) — **global override**, ideal for dev / staging
- `NODE_ENV === "development"`

Use `MAIL_FORCE_SANDBOX=true` in dev to redirect every outbound mail to
`SANDBOX_EMAILS` regardless of advertiser configuration. In production, leave
the flag unset and rely on per-advertiser `sandbox` rows.

AWS SES credentials: set `AWS_SES_ACCESS_KEY_ID` and `AWS_SES_SECRET_ACCESS_KEY`
(plus `AWS_SES_REGION`, default `eu-west-1`), or omit those keys and use the
SDK default credential chain (IAM role, `~/.aws/credentials`, etc.).

## Verification URL host

`sendVerificationEmail` builds the verify URL as:

```
<branding.baseUrl>/auth/verify-email?token=...
```

When `advertiserId` is provided and that advertiser has a `hostname`, the
verify link lands on their site. Otherwise it falls back to `PROPERTY_PUB_URL`
or `https://property.pub`.
