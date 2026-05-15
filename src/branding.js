// Email-safe hex palette per advertiser color_theme.
// Hand-picked equivalents of the oklch values defined in the frontend
// index.css `.accent-<name>` blocks. Email clients can't render oklch.
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

function resolveBubblePalette(colorTheme) {
    return BUBBLE_PALETTES[colorTheme] || NEUTRAL_BUBBLE_PALETTE
}

// Property-pub frontend origin. Used as the default verify-URL host when an
// advertiser has no hostname / subdomain_slug of its own. Set per environment:
//   - dev:    https://localhost:8083 (matches the property-pub container)
//   - prod:   https://property.pub
const PROPERTY_PUB_URL = (process.env.PROPERTY_PUB_URL || "https://property.pub").replace(/\/$/, "")

export const DEFAULT_BRANDING = {
    siteName:     "BizChat",
    logoUrl:      null,
    primaryColor: "#0070f3",
    fromEmail:    process.env.MAIL_FROM_EMAIL || "donotreply@bizchat.uk",
    fromName:     process.env.MAIL_FROM_NAME  || "BizChat",
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
                    a.sandbox         AS sandbox
                FROM a_magAdvertisers a
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
            logoUrl:      row.logoUrl      || DEFAULT_BRANDING.logoUrl,
            primaryColor: DEFAULT_BRANDING.primaryColor,
            fromEmail:    DEFAULT_BRANDING.fromEmail,
            fromName:     row.siteName     || DEFAULT_BRANDING.fromName,
            baseUrl,
            advertiserBranded,
            bubble:       resolveBubblePalette(row.colorTheme),
            sandbox:      !!row.sandbox,
        }
    } catch (err) {
        console.error(`[branding] Lookup failed for advertiserId=${id}:`, err.message)
        return DEFAULT_BRANDING
    }
}
