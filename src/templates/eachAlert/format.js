/**
 * Formatting helpers for the EACH alert's rows, moved unchanged from db-sync
 * (src/utils/property-parser.js, Size.js, displaySizeProperly.js, number-format.js) so
 * db-sync's send and the Admin > Emails test send build the same email.
 */

/** PHP-style number_format: 12000 → "12,000"; under 1000 returned as is. */
export const numberFormat = (number, decimals, decPoint, thousandsSep) => {
    if (number < 1000) return number
    number = (parseFloat(number) + '').replace(/[^0-9+\-Ee.]/g, '')
    const n = !isFinite(+number) ? 0 : +number
    const prec = !isFinite(+decimals) ? 0 : Math.abs(decimals)
    const sep = (typeof thousandsSep === 'undefined') ? ',' : thousandsSep
    const dec = (typeof decPoint === 'undefined') ? '.' : decPoint
    const toFixedFix = (v, p) => {
        const k = Math.pow(10, p)
        return '' + Math.round(v * k) / k
    }
    const s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.')
    if (s[0].length > 3) s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep)
    if ((s[1] || '').length < prec) {
        s[1] = s[1] || ''
        s[1] += new Array(prec - s[1].length + 1).join('0')
    }
    return s.join(dec)
}

class Size {
    units = { 0: 'sqft', 1: 'sqm', 2: 'sqft', 4: 'acres', 8: 'ha' }
    constructor(min, max, unit) {
        this._min = this.getRound(min)
        this._max = this.getRound(max)
        this._unit = unit
    }
    getLabel(suffix, value) {
        return `${suffix} ${value > 999 ? numberFormat(value) : value} ${this.unit}`
    }
    getRound(val) {
        return Math.round(val * 100) / 100
    }
    get isDefined() {
        return Math.max(this._min, this._max) > 0
    }
    get isRange() {
        return Math.min(this._min, this._max) > 0
    }
    get nonRangeLabel() {
        if (!this.isDefined || this.isRange) return null
        return this._min > 0 ? this.getLabel('min', this._min) : this.getLabel('max', this._max)
    }
    get unit() {
        return this.units[this._unit]
    }
}

const nf = (value, decimal = 0) => {
    const numberValue = Number(value)
    return numberValue > 10 ? numberFormat(value) : parseFloat(numberValue.toFixed(decimal))
}
const displayMinMax = (min, max, decimal) => `${min !== max && min > 0 ? `${nf(min, decimal)} - ` : ''}${nf(max, decimal)}`
const isFloat = (n) => Number(n) === n && n % 1 !== 0
const displaySize = (min, max, decimal) => {
    const sizeRangeText = displayMinMax(min, max, decimal)
    if (min === 0 || max === 0) return `${min === 0 ? 'max' : 'min'} ${sizeRangeText}`
    return sizeRangeText
}
const money = (value) => Math.round(value * 100) / 100

const displaySizeProperly = (sizemin, sizemax) => {
    const min = money(Math.min(sizemin, sizemax))
    const max = money(Math.max(sizemin, sizemax))
    return displaySize(min, max, isFloat(min) || isFloat(max) ? 2 : 0)
}

/** "Size: <b>2,000 - 5,000 sqft</b> | Land: <b>3 acres</b>" (either part optional). */
export function sizeText({ sizeunit, sizemin, sizemax, sizeunitexternal, minexternal, maxexternal }) {
    const size = new Size(sizemin, sizemax, sizeunit)
    const sizeExt = new Size(minexternal, maxexternal, sizeunitexternal)
    const parts = []
    if (size.isDefined) {
        parts.push(`Size: <b>${size.nonRangeLabel ?? `${displaySizeProperly(sizemin, sizemax)} ${size.unit}`}</b>`)
    }
    if (sizeExt.isDefined) {
        parts.push(`Land: <b>${sizeExt.nonRangeLabel ?? `${displaySizeProperly(minexternal, maxexternal)} ${sizeExt.unit}`}</b>`)
    }
    return parts.join(' | ')
}

/** Comma-separated type labels for "1,2,3" type ids, from the 4prop type list. */
export function typesText(tp, types) {
    if (!tp) throw new Error(`EACH alert types: ${tp} undefined`)
    return tp.split(',').map((t) => {
        const found = types.find(([i]) => i === Number(t))
        if (!found) console.log(`tid: ${t} does not exist`)
        return found?.[1]
    }).filter((f) => f).join(', ')
}

/** A company's logo URL from EACH's "pics|t|i" field, size `x` thumbnail. */
export function companyLogo(ims, x, host) {
    if (!ims) throw new Error(`companyLogo 'ims' is undefined`)
    const [s, t, i] = ims.split('|')
    let p = s.split('?')
    if (p.length > 0) {
        p = p[p.length - 1] // the last is always the chosen one
        p = p.split('~')
        if (p.length > 0) {
            const e = p[2] ? p[2] : 'jpg'
            let p2 = p[0]
            const p2a = p2.split('d')
            const p2b = p2a.length > 1
            const p1 = p2b ? p2a[0] : `${t}${i}`
            if (p2b) p2 = p2a[1]
            return `${host}/JSON/NIDs/DIDs/${p1}/${p2}/${x}.${e}`
        }
    }
}

/** EACH's encodings in names / labels: xR0 = line break, xR1 = apostrophe. */
export const cleanText = (text) => text.replace(/xR0/g, '<br/>').replace(/xR1/g, "'").trim()
