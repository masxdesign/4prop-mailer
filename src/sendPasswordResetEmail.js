import { getBranding } from "./branding.js"
import { renderEmail } from "./renderEmail.js"
import { sendEmail } from "./mailer.js"
import { resetPassword } from "./templates/resetPassword.js"
import { formatEmailLogRecipient, resolveSandboxMode } from "./sandboxDelivery.js"

function buildResetUrl(branding, plainToken, advertiserId, returnTo) {
    if (advertiserId == null) {
        throw new Error("sendPasswordResetEmail: advertiserId is required")
    }
    const base = (branding.baseUrl || "").replace(/\/$/, "")
    const pathPrefix = branding.advertiserBranded ? "" : `/${advertiserId}`
    let url = `${base}${pathPrefix}/auth/reset-password?token=${encodeURIComponent(plainToken)}`
    // `returnTo` is the relative router path (path + search) the user was on when
    // they requested the reset, so the reset page can send them back there after
    // saving. Only same-origin RELATIVE paths are forwarded (see the route's own
    // open-redirect guard); we pass it through verbatim, URL-encoded.
    if (returnTo) {
        url += `&returnTo=${encodeURIComponent(returnTo)}`
    }
    return url
}

/**
 * Render and send the password-reset email. Used by POST /api/auth/forgot-password.
 *
 * @param {object} opts
 * @param {object} opts.abasePool
 * @param {{ id: number|string, email: string, firstname?: string }} opts.user
 * @param {string} opts.plainToken
 * @param {number} opts.advertiserId
 * @param {number} [opts.expiresInH=1]
 * @param {object} [opts.delivery]  Sandbox delivery policy — see sandboxDelivery.js
 */
export async function sendPasswordResetEmail({
    abasePool,
    user,
    plainToken,
    advertiserId,
    returnTo = null,
    expiresInH = 1,
    delivery = {},
}) {
    if (!user?.email) throw new Error("sendPasswordResetEmail: user.email is required")
    if (!plainToken)  throw new Error("sendPasswordResetEmail: plainToken is required")
    if (advertiserId == null) throw new Error("sendPasswordResetEmail: advertiserId is required")

    const branding = await getBranding(abasePool, advertiserId)
    const resetUrl = buildResetUrl(branding, plainToken, advertiserId, returnTo)

    const { subject, html, text, from } = await renderEmail({
        branding,
        templateFn: resetPassword,
        data: {
            resetUrl,
            firstname: user.firstname || null,
            expiresInH,
        },
    })

    const sandbox = resolveSandboxMode(branding)
    const logTo = formatEmailLogRecipient({ intendedTo: user.email, sandbox, delivery })
    console.log(`[resetPassword] Sending to=${logTo} subject="${subject}" advertiserId=${advertiserId} branding.sandbox=${branding.sandbox}`)

    const result = await sendEmail({ to: user.email, from, subject, html, text, sandbox, delivery })
    console.log(`[resetPassword] SES accepted MessageId=${result?.MessageId}`)
    return result
}
