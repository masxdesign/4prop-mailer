import { getBranding } from "./branding.js"
import { renderEmail } from "./renderEmail.js"
import { sendEmail } from "./mailer.js"
import { verifyEmail } from "./templates/verifyEmail.js"
import { formatEmailLogRecipient, resolveSandboxMode } from "./sandboxDelivery.js"

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
 * @param {object} opts
 * @param {object} opts.abasePool
 * @param {{ id: number|string, email: string, firstname?: string }} opts.user
 * @param {string} opts.plainToken
 * @param {number} opts.advertiserId
 * @param {number} [opts.expiresInH=24]
 * @param {object} [opts.delivery]  Sandbox delivery policy — see sandboxDelivery.js
 */
export async function sendVerificationEmail({
    abasePool,
    user,
    plainToken,
    advertiserId,
    expiresInH = 24,
    delivery = {},
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

    const sandbox = resolveSandboxMode(branding)
    const logTo = formatEmailLogRecipient({ intendedTo: user.email, sandbox, delivery })
    console.log(`[verifyEmail] Sending to=${logTo} subject="${subject}" advertiserId=${advertiserId} branding.sandbox=${branding.sandbox}`)

    const result = await sendEmail({ to: user.email, from, subject, html, text, sandbox, delivery })
    console.log(`[verifyEmail] SES accepted MessageId=${result?.MessageId}`)
    return result
}
