/**
 * The EACH alert's day ("since", YYMMDD with a 0-based month, e.g. 261020 = 20 Nov 2026):
 * the previous working day in London, skipping weekends and England & Wales bank
 * holidays. Same rule as db-sync's getPreviousWorkingDay (src/utils/getPreviousWorkingDay.js),
 * which the daily send uses; this copy is for Admin > Emails' "Send test to me".
 */

const HOLIDAYS_URL = 'https://www.gov.uk/bank-holidays.json'
const DAY_MS = 24 * 60 * 60 * 1000

let holidays = null
let holidaysAt = 0

/** England & Wales bank holiday dates ("YYYY-MM-DD"), cached a day. Empty set if unreachable. */
export async function fetchUkBankHolidays() {
    if (holidays && Date.now() - holidaysAt < DAY_MS) return holidays
    try {
        const res = await fetch(HOLIDAYS_URL, { signal: AbortSignal.timeout(10000) })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        holidays = new Set((data?.['england-and-wales']?.events || []).map((e) => e.date))
        holidaysAt = Date.now()
    } catch {
        // Weekends only until it answers again: at worst the day is off by a bank holiday.
        if (!holidays) return new Set()
    }
    return holidays
}

/** Today's date in London as [year, month (1-12), day]. */
function londonDate(now) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
            .formatToParts(now)
            .map(({ type, value }) => [type, value]),
    )
    return [Number(parts.year), Number(parts.month), Number(parts.day)]
}

/** The previous working day before `now` (London), as the alert's YYMMDD. */
export function previousWorkingDay(now = new Date(), holidaySet = new Set()) {
    const [y, m, d] = londonDate(now)
    let date = new Date(Date.UTC(y, m - 1, d) - DAY_MS)
    for (;;) {
        const iso = date.toISOString().slice(0, 10)
        const dow = date.getUTCDay()
        if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) break
        date = new Date(date.getTime() - DAY_MS)
    }
    const yy = String(date.getUTCFullYear()).slice(2)
    const mm = String(date.getUTCMonth()).padStart(2, '0') // 0-based, as EACH stores it
    const dd = String(date.getUTCDate()).padStart(2, '0')
    return `${yy}${mm}${dd}`
}

/** The alert's day for a send happening now. */
export async function eachAlertSince(now = new Date()) {
    return previousWorkingDay(now, await fetchUkBankHolidays())
}
