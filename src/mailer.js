import AWS from "aws-sdk"
import { resolveEmailRecipients } from "./sandboxDelivery.js"

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

/**
 * Send a transactional email via SES.
 *
 * When `sandbox` is true, recipients are normally replaced with SANDBOX_EMAILS.
 * Pass `delivery.deliverToIntended: true` to keep the real recipient, or
 * `delivery.to` for an explicit override — policy belongs to the caller.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to
 * @param {string}          opts.from
 * @param {string}          opts.subject
 * @param {string}          opts.html
 * @param {string}          [opts.text]
 * @param {boolean}         [opts.sandbox]
 * @param {object}          [opts.delivery]
 * @param {boolean}         [opts.delivery.deliverToIntended]
 * @param {string|string[]} [opts.delivery.to]
 */
export async function sendEmail({ to, from, subject, html, text, sandbox = false, delivery = {} }) {
    const toAddresses = resolveEmailRecipients({ intendedTo: to, sandbox, delivery })

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

export { resolveEmailRecipients } from "./sandboxDelivery.js"
