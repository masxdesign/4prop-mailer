/**
 * Self-contained email renderer.
 * Template functions receive { branding, data } and return
 * { subject: string, bodyHtml: string, bodyText?: string }.
 * This wrapper adds the branded layout shell around bodyHtml.
 *
 * @param {{
 *   branding: { siteName, logoUrl, primaryColor, fromEmail, fromName, baseUrl },
 *   templateFn: (opts: { branding, data }) => { subject: string, bodyHtml: string, bodyText?: string },
 *   data: object,
 *   tracking?: { messageId: string, userId: string|number, baseUrl: string },
 * }} opts
 * @returns {{ subject: string, html: string, text: string, from: string }}
 */
export async function renderEmail({ branding, templateFn, data, tracking = null }) {
    const result = await Promise.resolve(templateFn({ branding, data }))
    const { subject, bodyHtml, bodyText = "" } = result

    const logoHtml = branding.logoUrl
        ? `<img src="${escHtml(branding.logoUrl)}" alt="${escHtml(branding.siteName)}" style="max-height:40px;max-width:180px;display:block;">`
        : `<span style="font-size:18px;font-weight:700;color:#111;">${escHtml(branding.siteName)}</span>`

    // Open-tracking pixel. Caller passes tracking only for per-message emails
    // (jobs with messageIds.length === 1). Hidden 1×1 GIF served by
    // /api/messaging/track/open — recording an EmailOpens row per fetch.
    const trackingPixelHtml = tracking
        ? `<img src="${escHtml(tracking.baseUrl)}/api/messaging/track/open?m=${encodeURIComponent(tracking.messageId)}&u=${encodeURIComponent(String(tracking.userId))}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;opacity:0;">`
        : ""

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
          ${logoHtml}
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 32px 24px;">
          ${bodyHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">${escHtml(branding.siteName)}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
  ${trackingPixelHtml}
</body>
</html>`

    const text = `${branding.siteName}\n\n${bodyText || subject}`
    const from = `${branding.fromName} <${branding.fromEmail}>`

    return { subject, html, text, from }
}

/**
 * Escape a string for safe inline HTML attribute / text insertion.
 * Only used for branding values that come from the database.
 * Template body HTML is trusted (authored in code, not user input).
 */
function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}
