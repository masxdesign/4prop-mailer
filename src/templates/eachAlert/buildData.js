/**
 * One agent's EACH alert data, from their a_rpEACHAlertToday row: what the template's
 * parts print (see ./parts.js). Used by db-sync for the daily send and by bizchat for
 * Admin > Emails' "Send test to me", so the test is the email the agent gets.
 *
 * Ported unchanged from db-sync's send-EACHAlertDaily.js (quirks included: towns are
 * de-duplicated by name, and a location's 28-character cut is computed but then
 * overwritten, so long locations go out in full).
 *
 *   buildEachAlertData(row, { since, types, host }) →
 *     { prop_com, hash, since, nid, name, property_count, requirement_count,
 *       properties: [{ pc, label, href }],
 *       requirements: [{ href, types, locationHtml, size, logo, companyName }] }
 *
 * row:   { nid, hash, letter, cp, cr, p, r }. p / r are the row's "*"-joined strings
 *        (or already split arrays): p items "i|postcode|town", r items
 *        "rid^types^pics^company^unit^min^max^unitExt^minExt^maxExt^location".
 * since: the alert's day, YYMMDD (db-sync's previous working day).
 * types: the 4prop property-type list ([[id, label], …], /new/variables/types.json),
 *        see fetchEachAlertTypes().
 * Links go straight to the app's pages (see ./parts.js).
 */
import _ from 'lodash'
import { cleanText, companyLogo, sizeText, typesText } from './format.js'

export const EACH_ALERT_HOST = 'https://www.4prop.com'

const items = (value) => (Array.isArray(value) ? value : value ? String(value).split('*') : [])

export function buildEachAlertData({ nid, hash, letter, cp, cr, p, r }, { since, types, host = EACH_ALERT_HOST }) {
    const pItems = items(p)
    const rItems = items(r)

    const properties = _.uniqBy(
        pItems.map((item) => {
            const [i, pc, name] = item.split('|')
            return { i, pc, name }
        }),
        'name',
    ).map(({ i, pc, name }) => ({
        pc,
        label: cleanText(name.length > 23 ? name.substring(0, 20) + '...' : name),
        href: `${host}/each-alert?hash=${hash}&since=${since}&view=table&scrollkey=${_.snakeCase(name)}_${i}`,
    }))

    const requirements = rItems.map((item) => {
        let [rid, tp, ims, companyName, sizeunit, sizemin, sizemax, sizeunitexternal, minexternal, maxexternal, location] = item.split('^')

        const logo = ims !== '' ? companyLogo(ims, 2, host) : null
        const size = sizeText({ sizeunit, sizemin, sizemax, sizeunitexternal, minexternal, maxexternal })

        let typeLabels = typesText(tp, types)
        if (typeLabels.length > 28) typeLabels = typeLabels.substring(0, 25) + '...'

        if (/\[/.test(location) && !/\]/.test(location)) location += ']'

        const locationHtml = cleanText(
            location
                .replace(/ \[/g, '<small style="color:#ababab;margin-left:3px;margin-right:6px">')
                .replace(/\](,)?/g, '</small>'),
        )

        return {
            href: `${host}/requirements/${rid}?hash=${hash}&since=${since}`,
            types: cleanText(typeLabels),
            locationHtml,
            size,
            logo: logo || null,
            companyName,
        }
    })

    return {
        prop_com: host,
        name: letter,
        hash,
        since,
        nid,
        property_count: cp,
        requirement_count: cr,
        properties,
        requirements,
    }
}

const typesCache = new Map()

/** The 4prop property-type list ([[id, label], …]), fetched once per process per host. */
export async function fetchEachAlertTypes(host = EACH_ALERT_HOST) {
    if (!typesCache.has(host)) {
        const load = fetch(`${host}/new/variables/types.json`).then((res) => {
            if (!res.ok) throw new Error(`EACH alert types: ${res.status} from ${host}`)
            return res.json()
        })
        typesCache.set(host, load)
        load.catch(() => typesCache.delete(host))
    }
    return typesCache.get(host)
}
