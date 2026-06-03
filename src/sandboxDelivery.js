/**
 * Portable sandbox recipient resolution for outbound mail.
 *
 * Callers decide policy via `delivery`:
 *   - { deliverToIntended: true } — send to the real `to` even when sandbox is on
 *   - { to: "a@b.com" }           — explicit override recipient(s) in sandbox
 *   - {}                          — redirect to SANDBOX_EMAILS when sandbox is on
 */

export function isTruthyEnv(value) {
    if (value == null) return false
    return /^(1|true|yes|on)$/i.test(String(value).trim())
}

export function resolveSandboxAddresses() {
    return (process.env.SANDBOX_EMAILS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
}

/**
 * Whether outbound mail should enter sandbox redirect mode.
 *
 * @param {{ sandbox?: boolean }} branding  Advertiser branding row
 */
export function resolveSandboxMode(branding = {}) {
    const forceSandbox = isTruthyEnv(process.env.MAIL_FORCE_SANDBOX)
    return !!(branding.sandbox || forceSandbox || process.env.NODE_ENV === "development")
}

/**
 * Resolve final To: addresses.
 *
 * @param {object} opts
 * @param {string|string[]} opts.intendedTo
 * @param {boolean}         opts.sandbox
 * @param {object}          [opts.delivery]
 * @param {boolean}         [opts.delivery.deliverToIntended]
 * @param {string|string[]} [opts.delivery.to]
 */
export function resolveEmailRecipients({ intendedTo, sandbox, delivery = {} }) {
    const intended = Array.isArray(intendedTo) ? intendedTo : [intendedTo]

    if (!sandbox) return intended
    if (delivery.deliverToIntended) return intended
    if (delivery.to) {
        return Array.isArray(delivery.to) ? delivery.to : [delivery.to]
    }

    const fallback = resolveSandboxAddresses()
    return fallback.length > 0 ? fallback : intended
}

/** Human-readable recipient for logs. */
export function formatEmailLogRecipient({ intendedTo, sandbox, delivery = {} }) {
    const resolved = resolveEmailRecipients({ intendedTo, sandbox, delivery })
    if (!sandbox) return resolved.join(", ")
    if (delivery.deliverToIntended || delivery.to) return resolved.join(", ")
    const sandboxList = resolveSandboxAddresses().join(", ")
    return sandboxList ? `SANDBOX(${sandboxList})` : resolved.join(", ")
}
