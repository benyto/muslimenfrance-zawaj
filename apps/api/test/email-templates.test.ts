import { describe, it } from "node:test";
import assert from "node:assert/strict";

// The templates read the API's environment when imported; these emails are
// built, not sent, so placeholders are enough (real values win if present).
Object.assign(process.env, {
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  SITE_URL: process.env.SITE_URL ?? "http://localhost:5173",
  SUPABASE_URL: process.env.SUPABASE_URL ?? "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? "placeholder",
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "placeholder",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_placeholder",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "re_placeholder",
});
const templates = await import("../src/lib/email/templates.js");
const { emailLayout, escapeHtml } = await import("../src/lib/email/layout.js");

// Anything a member (or a moderator) can type ends up in these emails. If any
// of it survives as markup, a message like this becomes a live link or a
// tracking pixel in a mail sent from our own domain.
const HOSTILE = `<img src=x onerror=alert(1)> <a href="https://evil.example/x">cliquez</a> "q" 'a' & <script>1</script>`;
const FUTURE = new Date(Date.now() + 5 * 86_400_000).toISOString();

// One entry per template. The test below fails if a template is added to
// templates.ts and not listed here.
const builders: Record<string, () => { subject: string; html: string }[]> = {
  newMessageEmail: () => [templates.newMessageEmail({ recipientNickname: HOSTILE, senderNickname: HOSTILE, preview: HOSTILE })],
  subscriptionStartedEmail: () => [
    templates.subscriptionStartedEmail({ nickname: HOSTILE, trialEnd: FUTURE }),
    templates.subscriptionStartedEmail({ nickname: HOSTILE, trialEnd: null }),
  ],
  trialEndingSoonEmail: () => [templates.trialEndingSoonEmail({ nickname: HOSTILE, trialEnd: FUTURE })],
  paymentFailedEmail: () => [templates.paymentFailedEmail({ nickname: HOSTILE })],
  subscriptionCanceledEmail: () => [templates.subscriptionCanceledEmail({ nickname: HOSTILE })],
  reportReceivedEmail: () => [templates.reportReceivedEmail({ nickname: HOSTILE })],
  profileModeratedEmail: () => [
    templates.profileModeratedEmail({ nickname: HOSTILE, approved: true }),
    templates.profileModeratedEmail({ nickname: HOSTILE, approved: false, notes: HOSTILE }),
  ],
  photoRejectedEmail: () => [templates.photoRejectedEmail({ nickname: HOSTILE })],
  profileTextsReviewedEmail: () => [
    templates.profileTextsReviewedEmail({ nickname: HOSTILE, approved: true }),
    templates.profileTextsReviewedEmail({ nickname: HOSTILE, approved: false, notes: HOSTILE }),
  ],
  reportResolvedEmail: () => [templates.reportResolvedEmail()],
};

describe("email templates", () => {
  it("are all covered by this test", () => {
    assert.deepEqual(Object.keys(builders).sort(), Object.keys(templates).sort());
  });

  for (const [name, build] of Object.entries(builders)) {
    it(`${name} never lets typed text through as markup`, () => {
      for (const { html } of build()) {
        assert.equal(html.includes("<img"), false, "raw <img>");
        assert.equal(html.includes("<script"), false, "raw <script>");
        assert.equal(html.includes('href="https://evil'), false, "injected link");
        assert.equal(html.includes("<a href=\"https://evil.example"), false, "injected anchor");
      }
    });
  }

  it("shows the text as text instead of dropping it", () => {
    const { html } = templates.newMessageEmail({ recipientNickname: "Sara", senderNickname: HOSTILE, preview: HOSTILE });
    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "visible, harmless");
    assert.ok(html.includes("Sara"));
  });

  it("keeps ordinary names readable, apostrophes and accents included", () => {
    const { html } = templates.paymentFailedEmail({ nickname: "Zoé l'Amie" });
    assert.ok(html.includes("Zoé l&#39;Amie"));
  });

  it("escapes the title in the shared layout too", () => {
    const html = emailLayout("Message de <b>x</b>", "<p>ok</p>");
    assert.equal(html.includes("<b>x</b>"), false);
    assert.ok(html.includes("<p>ok</p>"), "the body is trusted markup built by the templates");
  });

  it("escapeHtml handles every character that matters", () => {
    assert.equal(escapeHtml(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
  });
});
