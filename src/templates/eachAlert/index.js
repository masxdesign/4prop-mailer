/**
 * EACH alert email: the template db-sync uploads to AWS SES, and a local renderer for
 * the Admin > Emails preview and for db-sync's pre-send check.
 *
 *   composeEachAlertTemplate(o) → { name, subject, html } the parts inlined into one
 *                                                           SES template (SES has no partials)
 *   renderEachAlert(data)      → { subject, html }        rendered the way SES renders it
 *   buildEachAlertData(row, …) → data                     one agent's alert row → template data
 *
 * The parts live in ./parts.js, sample data in ./sample.js.
 */
import Handlebars from 'handlebars'
import { PARTS, subject } from './parts.js'
import { EACH_ALERT_INTRO_DEFAULT, cleanEachAlertIntro, introToEmailHtml } from './intro.js'

export { PARTS } from './parts.js'
export { eachAlertSample } from './sample.js'
export { buildEachAlertData, fetchEachAlertTypes, EACH_ALERT_HOST } from './buildData.js'
export { eachAlertSince, previousWorkingDay, fetchUkBankHolidays } from './since.js'
export {
    EACH_ALERT_INTRO_DEFAULT,
    EACH_ALERT_INTRO_VARIABLES,
    EACH_ALERT_INTRO_MAX,
    cleanEachAlertIntro,
    introToEmailHtml,
    loadEachAlertIntro,
    saveEachAlertIntro,
} from './intro.js'

/** The SES template name db-sync sends through. The old hand-made one stays "EACHAlert". */
export const EACH_ALERT_TEMPLATE_NAME = 'EACHAlertV2'

/** Sender name db-sync uses (`NEW EACH Alert 4Prop <DoNotReplyAlert@each.co.uk>`). */
export const EACH_ALERT_FROM = 'NEW EACH Alert 4Prop <DoNotReplyAlert@each.co.uk>'

const PARTIAL = /\{\{>\s*(\w+)\s*\}\}/g

/** Inline {{> part}} markers, recursively (a part may use another), failing on an unknown one. */
function inline(text, parts, depth = 0) {
    if (depth > 5) throw new Error('EACH alert template: parts nest too deep')
    return text.replace(PARTIAL, (_, name) => {
        if (!(name in parts) || name === 'wrapper') throw new Error(`EACH alert template: unknown part "${name}"`)
        return inline(parts[name], parts, depth + 1)
    })
}

/** Marks the editable paragraph for Admin > Emails' in-place editor (preview only, never sent). */
export const EACH_ALERT_INTRO_MARKER = 'data-each-alert-intro'

/**
 * The SES template: the parts with {{> part}} inlined, the intro text included.
 *   introHtml  the editable paragraph as editor HTML (cleaned here); default: the code copy
 *   markIntro  wrap it in <span data-each-alert-intro> for the in-place editor
 *   parts      override the parts (the per-part previews)
 */
export function composeEachAlertTemplate({ parts = PARTS, introHtml = EACH_ALERT_INTRO_DEFAULT, markIntro = false } = {}) {
    const text = introToEmailHtml(cleanEachAlertIntro(introHtml))
    const introText = markIntro ? `<span ${EACH_ALERT_INTRO_MARKER}="1">${text}</span>` : text
    return { name: EACH_ALERT_TEMPLATE_NAME, subject, html: inline(parts.wrapper, { ...parts, introText }) }
}

// SES renders Handlebars without HTML-escaping; match it so the preview is what's sent.
const hb = Handlebars.create()

/** Render like SES does. `options` as composeEachAlertTemplate. */
export function renderEachAlert(data, options = {}) {
    const { html } = composeEachAlertTemplate(options)
    return {
        subject: hb.compile(subject, { noEscape: true, strict: false })(data),
        html: hb.compile(html, { noEscape: true, strict: false })(data),
    }
}
