/**
 * An error whose message is safe and useful to show to the end user
 * (validation failures, business-rule violations, "not found", ...).
 *
 * Anything that is NOT a UserError is treated as a bug: it is logged on the
 * server and the user only sees a generic message. This matters because
 * Next.js strips the message of errors thrown from Server Actions in
 * production builds, so actions return `ActionResult`s instead of throwing.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UserError"
  }
}
