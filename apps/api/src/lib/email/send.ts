import { env } from "../../env.js";
import { resend } from "../resend.js";

// Email delivery is a side effect, never the main point of the request it's
// triggered from (sending a message, processing a webhook) — a Resend
// outage must not fail the underlying operation. Log and swallow instead
// of throwing.
export async function sendEmail(to: string, { subject, html }: { subject: string; html: string }) {
  try {
    const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });
    if (error) {
      console.error("Resend send failed", { to, subject, error });
    }
  } catch (err) {
    console.error("Resend send threw", { to, subject, error: err });
  }
}
