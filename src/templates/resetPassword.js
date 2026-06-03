/**
 * Password-reset email template. Renders the "click the link to reset your
 * password" message sent on POST /api/auth/forgot-password.
 *
 * Signature matches the templateFn contract used by renderEmail():
 *   ({ branding, data }) => { subject, bodyHtml, bodyText }
 *
 * Expected `data`:
 *   - resetUrl    {string}  Full URL the user clicks to reset (token in query)
 *   - firstname?  {string}  Optional greeting personalization
 *   - expiresInH  {number}  TTL hint shown in the body, e.g. 1
 */
export function resetPassword({ branding, data }) {
    const { resetUrl, firstname, expiresInH = 1 } = data

    const greeting = firstname ? `Hi ${escHtml(firstname)},` : "Hi,"
    const subject = `Reset your ${branding.siteName} password`

    const bodyHtml = `
<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111;">Reset your password</h2>

<p style="margin:0 0 12px;font-size:14px;color:#374151;">${greeting}</p>

<p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.5;">
  Someone — hopefully you — asked to reset the password on this account.
  Click the button below to choose a new one.
</p>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td align="center">
    <a href="${escHtml(resetUrl)}"
       style="display:inline-block;padding:12px 32px;background:#111;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
      Reset password
    </a>
  </td></tr>
</table>

<p style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.5;">
  Or paste this link into your browser:<br>
  <span style="color:#374151;word-break:break-all;">${escHtml(resetUrl)}</span>
</p>

<p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
  This link expires in ${Number(expiresInH)} ${Number(expiresInH) === 1 ? 'hour' : 'hours'}.
  If you didn't request this, you can safely ignore this email — your
  password won't change unless you click the link and choose a new one.
</p>
`

    const bodyText = [
        greeting.replace(/<[^>]+>/g, ""),
        "",
        `Reset your ${branding.siteName} password by clicking this link:`,
        resetUrl,
        "",
        `This link expires in ${Number(expiresInH)} ${Number(expiresInH) === 1 ? 'hour' : 'hours'}.`,
        "If you didn't request a reset, you can safely ignore this email.",
    ].join("\n")

    return { subject, bodyHtml, bodyText }
}

function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}
