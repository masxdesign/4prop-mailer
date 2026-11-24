/**
 * The EACH alert's editable paragraph: the lines under "Dear <name>" (Admin > Emails, edited
 * in place with the rich-text editor). Everything else in the email stays in code.
 *
 * Stored as the editor's HTML (one <p> per line) in a_magEmailTemplateParts
 * (template_key 'each_alert', part 'intro'; newest row live, html NULL = back to default),
 * cleaned before it is stored AND before it is used, so a hand-edited row can't break the
 * email either. In the email each <p> becomes one line of the original paragraph, joined with
 * <br />, so the default renders exactly like the old hard-coded text.
 *
 * Allowed: paragraphs, line breaks, bold, italic, underline, strikethrough and links (http,
 * https, mailto, tel). Variables: {{hash}} {{name}} {{prop_com}} {{since}} only (e.g. a link
 * to "https://www.each.co.uk/?alert{{hash}}*s"); any other {{…}} is removed, so the text can't
 * open a Handlebars block or reach other data when SES renders it.
 */
import sanitizeHtml from 'sanitize-html'

// No `import sql from 'mssql'` here, on purpose: this package has no mssql of its own, so it
// resolved the monorepo root's copy (11) while db-sync's pool is its own (12). Types made by
// one copy fail in the other ("parameter.type.validate is not a function"), and the 24 Nov
// 2026 alert went out with the default paragraph. Parameters are passed untyped (the
// caller's driver infers NVarChar) and cast in SQL where the column needs it.

export const EACH_ALERT_INTRO_KEY = { template: 'each_alert', part: 'intro' }

/** The text db-sync sent before it was editable, as editor HTML. */
export const EACH_ALERT_INTRO_DEFAULT =
    '<p>Agents new Properties &amp; Requirements of your day to day interest.</p>' +
    '<p><a href="https://www.each.co.uk/?alert{{hash}}*s" target="_blank">Not exactly what you want? update Types/Locations/Filters here</a></p>' +
    '<p>or call 020 7602 5947.</p>'

export const EACH_ALERT_INTRO_VARIABLES = ['hash', 'name', 'prop_com', 'since']

/** Longest accepted text, in characters of HTML (the default is ~270). */
export const EACH_ALERT_INTRO_MAX = 4000

const SANITIZE = {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'a'],
    allowedAttributes: { a: ['href', 'target'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
        b: 'strong',
        i: 'em',
        strike: 's',
        // Links always open a new tab; the editor's rel / class are dropped.
        a: (tagName, attribs) => ({ tagName, attribs: { ...(attribs.href ? { href: attribs.href } : {}), target: '_blank' } }),
    },
    // A link with no (allowed) href is kept as its text.
    exclusiveFilter: (frame) => frame.tag === 'a' && !frame.attribs.href,
}

const VARIABLE = /\{\{\s*([a-z_]+)\s*\}\}/g

/** Keep the allowed {{variables}} (tidied to {{name}}) and remove every other brace pair. */
function cleanVariables(html) {
    const kept = []
    const marked = html.replace(VARIABLE, (whole, name) => {
        if (!EACH_ALERT_INTRO_VARIABLES.includes(name)) return ''
        kept.push(`{{${name}}}`)
        return `\u0000${kept.length - 1}\u0000`
    })
    return marked
        .replace(/[{}]{2,}/g, '')
        .replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)])
}

/**
 * The editor's HTML → the stored, safe form. Throws (with a message for the admin) when it
 * is too long or empty after cleaning.
 */
export function cleanEachAlertIntro(html) {
    const raw = String(html ?? '')
    if (raw.length > EACH_ALERT_INTRO_MAX * 2) throw new Error('The text is too long.')
    // Bare text (no paragraph) is one line.
    const withParagraphs = /<p[\s>]/i.test(raw) ? raw : `<p>${raw}</p>`
    const clean = cleanVariables(sanitizeHtml(withParagraphs, SANITIZE)).trim()
    if (clean.length > EACH_ALERT_INTRO_MAX) throw new Error('The text is too long.')
    if (!clean.replace(/<[^>]*>/g, '').trim()) throw new Error('The text is empty.')
    return clean
}

/** Cleaned editor HTML → the paragraph's inside in the email: one line per <p>, <br /> between. */
export function introToEmailHtml(cleanHtml) {
    const lines = []
    const re = /<p>([\s\S]*?)<\/p>/g
    let match
    while ((match = re.exec(cleanHtml))) lines.push(match[1])
    if (lines.length === 0) lines.push(cleanHtml)
    return lines.join('\n<br />\n')
}

// ── Storage (a_magEmailTemplateParts), shared by bizchat and db-sync ─────────────────────

/**
 * The live intro: { html (cleaned editor HTML), isDefault, createdBy, createdAt }. Missing
 * table, no row, a NULL row or a row that no longer cleans: the default (logged, never thrown).
 * @param {import('mssql').ConnectionPool} pool  an all_public pool
 */
export async function loadEachAlertIntro(pool) {
    const fallback = { html: EACH_ALERT_INTRO_DEFAULT, isDefault: true, createdBy: null, createdAt: null }
    try {
        const { recordset } = await pool.request()
            .input('template', EACH_ALERT_INTRO_KEY.template)
            .input('part', EACH_ALERT_INTRO_KEY.part)
            .query(`
                SELECT TOP 1 html, created_by, created_at
                FROM a_magEmailTemplateParts
                WHERE template_key = @template AND part = @part
                ORDER BY id DESC
            `)
        const row = recordset[0]
        if (!row) return fallback
        const meta = { createdBy: row.created_by != null ? String(row.created_by) : null, createdAt: row.created_at ?? null }
        if (row.html == null) return { ...fallback, ...meta }
        return { html: cleanEachAlertIntro(row.html), isDefault: false, ...meta }
    } catch (err) {
        console.warn(`[eachAlert] intro: using the default (${err.message})`)
        return fallback
    }
}

/**
 * Save a new version: `html` (editor HTML, cleaned here) or null to go back to the default.
 * Returns the cleaned html stored (null for the default).
 */
export async function saveEachAlertIntro(pool, { html, userId }) {
    const clean = html == null ? null : cleanEachAlertIntro(html)
    await pool.request()
        .input('template', EACH_ALERT_INTRO_KEY.template)
        .input('part', EACH_ALERT_INTRO_KEY.part)
        .input('html', clean)
        .input('userId', userId == null ? null : String(userId))
        .query(`
            INSERT INTO a_magEmailTemplateParts (template_key, part, html, created_by)
            VALUES (@template, @part, @html, CAST(@userId AS BIGINT))
        `)
    return clean
}
