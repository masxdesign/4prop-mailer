import AWS from "aws-sdk"

// AWS SES transport. Set AWS_SES_ACCESS_KEY_ID / AWS_SES_SECRET_ACCESS_KEY for
// explicit keys, or rely on the default AWS SDK credential provider chain (IAM
// role, shared credentials file, env, etc.).
const sesConfig = {
    region: process.env.AWS_SES_REGION || "eu-west-1",
}
if (process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY) {
    sesConfig.accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID
    sesConfig.secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY
}
const ses = new AWS.SES(sesConfig)

function resolveSandboxAddresses() {
    return (process.env.SANDBOX_EMAILS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
}

/**
 * Send a transactional email via SES.
 * When `sandbox` is true, recipients are replaced with SANDBOX_EMAILS
 * (comma-separated env var). Used to redirect outbound mail for advertisers
 * flagged with `sandbox = true` in a_magAdvertisers, or for dev environments.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to        Primary recipient(s)
 * @param {string}          opts.from      "Display Name <email@domain>" formatted
 * @param {string}          opts.subject
 * @param {string}          opts.html
 * @param {string}          [opts.text]    Falls back to subject if omitted
 * @param {boolean}         [opts.sandbox] Redirect to SANDBOX_EMAILS if true
 */
export async function sendEmail({ to, from, subject, html, text, sandbox = false }) {
    const sandboxAddresses = sandbox ? resolveSandboxAddresses() : []
    const toAddresses = sandboxAddresses.length > 0
        ? sandboxAddresses
        : Array.isArray(to) ? to : [to]

    const params = {
        Source: from,
        Destination: { ToAddresses: toAddresses },
        Message: {
            Subject: { Charset: "UTF-8", Data: subject },
            Body: {
                Html: { Charset: "UTF-8", Data: html },
                Text: { Charset: "UTF-8", Data: text || subject },
            },
        },
        ReplyToAddresses: [from],
    }

    const result = await ses.sendEmail(params).promise()
    return result
}
