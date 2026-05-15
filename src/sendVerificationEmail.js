import { getBranding } from "./branding.js"
import { renderEmail } from "./renderEmail.js"
import { sendEmail } from "./mailer.js"
import { verifyEmail } from "./templates/verifyEmail.js"

/**
 * Build a verification URL the user clicks. advertiserId is required — every
 * verify email is sent in the context of one advertiser.
 *
 *   - Advertiser-branded (custom hostname or subdomain_slug set):
 *       https://<advertiser-host>/auth/verify-email?token=...
 *     The advertiser is resolved from the request hostname when the user
 *     lands on the page — no id-in-path needed.
 *
 *   - Generic (no advertiser-specific host configured for this row):
 *       https://property.pub/<advertiserId>/auth/verify-email?token=...
 *     The advertiser is resolved from the path segment.
 */
function buildVerifyUrl(branding, plainToken, advertiserId) {
    if (advertiserId == null) {
        throw new Error("sendVerificationEmail: advertiserId is required")
    }
    const base = (branding.baseUrl || "").replace(/\/$/, "")
    const pathPrefix = branding.advertiserBranded ? "" : `/${advertiserId}`
    return `${base}${pathPrefix}/auth/verify-email?token=${encodeURIComponent(plainToken)}`
}

/**
 * Render and send the email-verification message. Used by:
 *   - POST /api/auth/register             (initial verification)
 *   - POST /api/auth/resend-verification  (manual resend)
 *
 * Branding is advertiser-scoped — advertiserId is required. Every verify
 * email is sent in the context of one advertiser and must land the user back
 * on that advertiser's surface.
 *
 * @param {object} opts
 * @param {object} opts.abasePool   mssql pool (or promise) — needed for branding lookup
 * @param {{ id: number|string, email: string, firstname?: string }} opts.user
 * @param {string} opts.plainToken  Plaintext verification token (NOT the hash)
 * @param {number} opts.advertiserId  Required. Advertiser whose branding should be used.
 * @param {number} [opts.expiresInH]  Display-only TTL hint, default 24
 */
export async function sendVerificationEmail({
    abasePool,
    user,
    plainToken,
    advertiserId,
    expiresInH = 24,
}) {
    if (!user?.email) throw new Error("sendVerificationEmail: user.email is required")
    if (!plainToken)  throw new Error("sendVerificationEmail: plainToken is required")
    if (advertiserId == null) throw new Error("sendVerificationEmail: advertiserId is required")

    const branding = await getBranding(abasePool, advertiserId)
    const verifyUrl = buildVerifyUrl(branding, plainToken, advertiserId)

    const { subject, html, text, from } = await renderEmail({
        branding,
        templateFn: verifyEmail,
        data: {
            verifyUrl,
            firstname: user.firstname || null,
            expiresInH,
        },
    })

    // Sandbox mode is honored when any of these is true:
    //   - the advertiser row has `sandbox = 1`
    //   - MAIL_FORCE_SANDBOX env is truthy (global override for dev / staging)
    //   - NODE_ENV is "development"
    // When on, recipients are redirected to SANDBOX_EMAILS (see mailer.js).
    const forceSandbox = isTruthyEnv(process.env.MAIL_FORCE_SANDBOX)
    const sandbox = branding.sandbox || forceSandbox || process.env.NODE_ENV === "development"
    const logTo = sandbox ? `SANDBOX(${process.env.SANDBOX_EMAILS ?? ""})` : user.email
    console.log(`[verifyEmail] Sending to=${logTo} subject="${subject}" advertiserId=${advertiserId ?? "(none)"} branding.sandbox=${branding.sandbox} force=${forceSandbox}`)

    const result = await sendEmail({ to: user.email, from, subject, html, text, sandbox })
    console.log(`[verifyEmail] SES accepted MessageId=${result?.MessageId}`)
    return result
}

// Treat "1", "true", "yes", "on" (case-insensitive) as truthy. Anything else
// — including empty, "0", "false", undefined — is false.
function isTruthyEnv(value) {
    if (value == null) return false
    return /^(1|true|yes|on)$/i.test(String(value).trim())
}
