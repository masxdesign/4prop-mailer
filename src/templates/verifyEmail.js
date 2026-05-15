/**
 * Email-verification template. Renders the "click the link to verify your
 * email" message sent on register and on resend.
 *
 * Signature matches the templateFn contract used by renderEmail():
 *   ({ branding, data }) => { subject, bodyHtml, bodyText }
 *
 * Expected `data`:
 *   - verifyUrl   {string}  Full URL the user clicks to verify (token in query)
 *   - firstname?  {string}  Optional greeting personalization
 *   - expiresInH  {number}  TTL hint shown in the body, e.g. 24
 */
export function verifyEmail({ branding, data }) {
    const { verifyUrl, firstname, expiresInH = 24 } = data

    const greeting = firstname ? `Hi ${escHtml(firstname)},` : "Hi,"
    const subject = `Verify your email for ${branding.siteName}`

    const bodyHtml = `
<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111;">Verify your email</h2>

<p style="margin:0 0 12px;font-size:14px;color:#374151;">${greeting}</p>

<p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.5;">
  Click the button below to confirm this email address. This helps us keep
  your account secure and lets you send enquiries.
</p>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td align="center">
    <a href="${escHtml(verifyUrl)}"
       style="display:inline-block;padding:12px 32px;background:#111;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
      Verify email
    </a>
  </td></tr>
</table>

<p style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.5;">
  Or paste this link into your browser:<br>
  <span style="color:#374151;word-break:break-all;">${escHtml(verifyUrl)}</span>
</p>

<p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
  This link expires in ${Number(expiresInH)} hours. If you didn't create an
  account, you can safely ignore this email.
</p>
`

    const bodyText = [
        greeting.replace(/<[^>]+>/g, ""),
        "",
        `Click the link below to verify your email address for ${branding.siteName}:`,
        verifyUrl,
        "",
        `This link expires in ${Number(expiresInH)} hours.`,
        "If you didn't create an account, you can safely ignore this email.",
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
