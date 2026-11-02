import { buildEmailPalette } from "@4prop/brand-theme/colors"

// Email-safe hex palette per advertiser color_theme.
// Hand-picked equivalents of the oklch values defined in the frontend
// `.accent-<name>` blocks. Email clients can't render oklch.
//
// PRESETS ONLY. Custom colours are admin-created and cannot be listed here, so
// they are derived from their stored base hex instead — see resolveBubblePalette.
// These stay hand-picked rather than derived so existing branded emails do not
// shift colour when the engine's ramp is tuned.
const BUBBLE_PALETTES = {
    orange: { brand: "#ea580c", subtleBg: "#fff7ed", subtleText: "#9a3412", border: "#fed7aa" },
    blue:   { brand: "#1d4ed8", subtleBg: "#eff6ff", subtleText: "#1e3a8a", border: "#bfdbfe" },
    red:    { brand: "#b91c1c", subtleBg: "#fef2f2", subtleText: "#7f1d1d", border: "#fecaca" },
}

const NEUTRAL_BUBBLE_PALETTE = {
    brand:      "#374151",
    subtleBg:   "#f9fafb",
    subtleText: "#374151",
    border:     "#e5e7eb",
}

/**
 * Preset → its hand-picked palette. Custom theme → derived from `baseHex`.
 * Anything else (no theme, or a custom theme whose row has gone) → neutral.
 */
function resolveBubblePalette(colorTheme, baseHex) {
    if (BUBBLE_PALETTES[colorTheme]) return BUBBLE_PALETTES[colorTheme]
    if (baseHex) return buildEmailPalette(baseHex) || NEUTRAL_BUBBLE_PALETTE
    return NEUTRAL_BUBBLE_PALETTE
}

// The fallback web origin, used when an advertiser has no hostname or
// subdomain_slug of its own.
//
// property.pub IS the default, and it must NOT be an advertiser's domain.
// 4prop.com looks like a platform address but is advertiser #4's `hostname`
// (a_magAdvertisers: company "4Prop", subdomain_slug "4prop"), so defaulting to
// it would send every unbranded email to one advertiser's site — and, since the
// path prefix carries a DIFFERENT advertiser's id, to a URL like
// 4prop.com/5011/bookings that belongs to neither.
//
// Nothing sets PROPERTY_PUB_URL in either app today, so this literal is what
// production uses. Override per environment if needed (e.g.
// https://localhost:8083 to point dev mail at the local container).
const PROPERTY_PUB_URL = (process.env.PROPERTY_PUB_URL || "https://property.pub").replace(/\/$/, "")

export const DEFAULT_BRANDING = {
    // The platform's own name, shown when no advertiser owns the email. Note
    // this is deliberately NOT paired with 4prop.com: the NAME is the operator's
    // brand, while the LINK must stay on property.pub, which belongs to no
    // advertiser. Advertiser #4 happens to trade as "4Prop" too, but a real
    // advertiser email carries its own branding and never reaches this default.
    siteName:     "4prop",
    logoUrl:      null,
    primaryColor: "#0070f3",
    // NOT @4prop.com, and not an oversight.
    //
    // Mail goes out through AWS SES, and 4prop.com's SPF record authorises
    // GoDaddy (`include:secureserver.net -all`), not SES — a hard fail. Sending
    // as @4prop.com before the domain is verified in SES and its DKIM records
    // published would put every email in spam or have it rejected outright.
    // bizchat.uk is the verified sending identity, so it stays until that work
    // is done; MAIL_FROM_EMAIL then flips it with no code change.
    fromEmail:    process.env.MAIL_FROM_EMAIL || "donotreply@bizchat.uk",
    fromName:     process.env.MAIL_FROM_NAME  || "4prop",
    // Generic web origin used by the email layout shell (logo links, footer)
    // when no advertiser-specific URL is available. NOT used directly for the
    // verify-URL — that's built per-call with the advertiser context too.
    baseUrl:      PROPERTY_PUB_URL,
    // True when the advertiser has its own custom hostname or subdomain — i.e.
    // baseUrl points at THE ADVERTISER'S site, not at the generic property-pub
    // root. Verify-URL builder uses this to decide path-prefix vs domain.
    advertiserBranded: false,
    bubble:       NEUTRAL_BUBBLE_PALETTE,
    sandbox:      false,
}

/**
 * Logos uploaded through the admin are stored as site-relative paths
 * (`/uploads/logos/6/wordmark.png?v=...`). A web page resolves those against its own
 * host, but an email has no host to resolve against, so mail apps show a broken image.
 * Prefix the advertiser's site (every advertiser host serves /uploads), and give
 * protocol-relative URLs https. Absolute URLs pass through unchanged.
 */
export function absoluteLogoUrl(logoUrl, baseUrl) {
    const url = String(logoUrl ?? "").trim()
    if (!url) return null
    if (url.startsWith("//")) return `https:${url}`
    if (url.startsWith("/")) return `${String(baseUrl || "").replace(/\/$/, "")}${url}`
    return url
}

/**
 * Fetch branding for a given advertiser ID.
 * Falls back to DEFAULT_BRANDING on missing id or any lookup failure so emails
 * always have something to send with.
 *
 * Pool is injected — the package doesn't own a connection. Pass the ABASE
 * pool from whichever app is calling.
 *
 * @param {object|Promise<object>} poolOrPromise  mssql pool (or a promise of one)
 * @param {number}                 advertiserId
 * @returns {Promise<{siteName, logoUrl, primaryColor, fromEmail, fromName, baseUrl, bubble, sandbox}>}
 */
export async function getBranding(poolOrPromise, advertiserId) {
    const id = Number(advertiserId)
    if (!id || !Number.isFinite(id)) return DEFAULT_BRANDING

    try {
        const pool = await poolOrPromise
        // Don't pass an explicit mssql type — workspace deduplication can leave
        // the package resolving its own copy of mssql while the pool was built
        // with the consumer's copy, producing "parameter.type.validate is not a
        // function". Letting mssql infer the type from the JS number works
        // across both copies.
        const result = await pool.request()
            .input("advertiserId", id)
            .query(`
                SELECT
                    a.company         AS siteName,
                    a.hostname        AS hostname,
                    a.subdomain_slug  AS subdomainSlug,
                    a.logo_url        AS logoUrl,
                    a.color_theme     AS colorTheme,
                    ct.base_hex       AS colorThemeHex,
                    a.sandbox         AS sandbox
                FROM a_magAdvertisers a
                LEFT JOIN a_magAdvertiserColorThemes ct ON ct.slug = a.color_theme
                WHERE a.id = @advertiserId
            `)

        const row = result.recordset[0]
        if (!row) {
            console.warn(`[branding] No advertiser found for id=${advertiserId}, using defaults`)
            return DEFAULT_BRANDING
        }

        // Resolve the advertiser's web origin in priority order:
        //   1. Custom hostname (e.g. shopproperty.co)
        //   2. subdomain_slug → <slug>.property.pub
        //   3. Fall back to the generic property-pub root — verify URLs will
        //      need to inject the advertiser id as a path prefix in that case.
        const hostname = row.hostname || null
        const subdomainSlug = row.subdomainSlug || null
        let baseUrl
        let advertiserBranded
        if (hostname) {
            baseUrl = `https://${hostname}`
            advertiserBranded = true
        } else if (subdomainSlug) {
            baseUrl = `https://${subdomainSlug}.property.pub`
            advertiserBranded = true
        } else {
            baseUrl = DEFAULT_BRANDING.baseUrl
            advertiserBranded = false
        }

        return {
            siteName:     row.siteName     || DEFAULT_BRANDING.siteName,
            logoUrl:      absoluteLogoUrl(row.logoUrl, baseUrl) || DEFAULT_BRANDING.logoUrl,
            // As stored (often site-relative). Only for in-browser previews, which
            // resolve it against the page's own host; emails use logoUrl.
            logoPath:     row.logoUrl || null,
            primaryColor: DEFAULT_BRANDING.primaryColor,
            fromEmail:    DEFAULT_BRANDING.fromEmail,
            fromName:     row.siteName     || DEFAULT_BRANDING.fromName,
            baseUrl,
            advertiserBranded,
            bubble:       resolveBubblePalette(row.colorTheme, row.colorThemeHex),
            sandbox:      !!row.sandbox,
        }
    } catch (err) {
        console.error(`[branding] Lookup failed for advertiserId=${id}:`, err.message)
        return DEFAULT_BRANDING
    }
}
