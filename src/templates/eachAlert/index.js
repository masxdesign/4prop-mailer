/**
 * EACH alert email: the template db-sync uploads to AWS SES, and a local renderer for
 * the Admin > Emails preview and for db-sync's pre-send check.
 *
 *   composeEachAlertTemplate() → { name, subject, html }  the parts inlined into one
 *                                                           SES template (SES has no partials)
 *   renderEachAlert(data)      → { subject, html }        rendered the way SES renders it
 *
 * The parts live in ./parts.js, sample data in ./sample.js.
 */
import Handlebars from 'handlebars'
import { PARTS, subject } from './parts.js'

export { PARTS } from './parts.js'
export { eachAlertSample } from './sample.js'

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

export function composeEachAlertTemplate(parts = PARTS) {
    return { name: EACH_ALERT_TEMPLATE_NAME, subject, html: inline(parts.wrapper, parts) }
}

// SES renders Handlebars without HTML-escaping; match it so the preview is what's sent.
const hb = Handlebars.create()

export function renderEachAlert(data, parts = PARTS) {
    const { html } = composeEachAlertTemplate(parts)
    return {
        subject: hb.compile(subject, { noEscape: true, strict: false })(data),
        html: hb.compile(html, { noEscape: true, strict: false })(data),
    }
}
