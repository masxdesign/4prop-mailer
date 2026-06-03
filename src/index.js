/**
 * @4prop/mailer — public surface.
 *
 * Sub-paths are also published in package.json `exports` so consumers can
 * import individual modules directly:
 *   import { sendEmail }              from "@4prop/mailer/mailer"
 *   import { renderEmail }            from "@4prop/mailer/renderEmail"
 *   import { getBranding }            from "@4prop/mailer/branding"
 *   import { verifyEmail }            from "@4prop/mailer/templates/verify"
 *   import { sendVerificationEmail }  from "@4prop/mailer/sendVerificationEmail"
 */
export { sendEmail, resolveEmailRecipients } from "./mailer.js"
export { renderEmail } from "./renderEmail.js"
export { getBranding, DEFAULT_BRANDING } from "./branding.js"
export {
    resolveSandboxMode,
    resolveSandboxAddresses,
    formatEmailLogRecipient,
    isTruthyEnv,
} from "./sandboxDelivery.js"
export { verifyEmail } from "./templates/verifyEmail.js"
export { resetPassword } from "./templates/resetPassword.js"
export { sendVerificationEmail } from "./sendVerificationEmail.js"
export { sendPasswordResetEmail } from "./sendPasswordResetEmail.js"
