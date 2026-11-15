import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const BUCKET = "profile-photos";
// Unique per test process, and baked into every email, so cleanup (and the
// leftover check) can find exactly what this run created and nothing else.
export const RUN = randomUUID().slice(0, 8);
export const EMAIL_DOMAIN = "rencontre.invalid";

export const admin: SupabaseClient = createClient(env.supabaseUrl, env.serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export type Member = {
  userId: string;
  profileId: string;
  email: string;
  token: string;
  /** supabase-js client signed in as this member — i.e. what the browser has. */
  client: SupabaseClient;
};

const created: Member[] = [];
const webhookEventIds: string[] = [];
let counter = 0;

type MemberOptions = {
  label?: string;
  status?: "approved" | "pending" | "rejected" | "disabled";
  role?: "admin" | "moderator";
  gender?: "male" | "female";
  emailNotifications?: boolean;
  /** Live (already approved) text, written directly as the service role. */
  bio?: string;
  lookingFor?: string;
};

/**
 * A member with a profile and a real session. The session comes from an admin-
 * generated magic-link token verified server-side — the same path a person
 * clicking the emailed link takes, without needing any mailbox.
 */
export async function createMember(options: MemberOptions = {}): Promise<Member> {
  const label = options.label ?? `m${++counter}`;
  const email = `test-${RUN}-${label}@${EMAIL_DOMAIN}`;

  // Registered the moment it exists and filled in as we go, so a failure half
  // way through still gets cleaned up.
  const member = { email } as Member;
  created.push(member);

  const { data: user, error: userError } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (userError) throw userError;
  member.userId = user.user.id;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      user_id: member.userId,
      nickname: `T-${label}-${RUN}`,
      gender: options.gender ?? "female",
      birthdate: "1990-01-01",
      special_category_consent: true,
      special_category_consent_at: new Date().toISOString(),
      moderation_status: options.status ?? "approved",
      email_new_message_notifications: options.emailNotifications ?? false,
      bio: options.bio ?? null,
      looking_for: options.lookingFor ?? null,
    })
    .select("id")
    .single();
  if (profileError) throw profileError;
  member.profileId = profile.id;

  if (options.role) {
    const { error } = await admin.from("user_roles").insert({ user_id: member.userId, role: options.role });
    if (error) throw error;
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError) throw linkError;
  const client = createClient(env.supabaseUrl, env.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const session = await verifyWithPatience(client, link.properties.hashed_token);
  member.token = session.access_token;
  member.client = client;
  return member;
}

// A hosted Supabase project throttles token verifications per IP (30 per five
// minutes by default), which a whole suite exceeds. A local stack lets CI raise
// that limit; against a hosted project, wait it out instead of failing.
async function verifyWithPatience(client: SupabaseClient, tokenHash: string) {
  const deadline = Date.now() + 8 * 60_000;
  for (;;) {
    const { data, error } = await client.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (!error && data.session) return data.session;
    const throttled = error && (error.status === 429 || (error as { code?: string }).code === "over_request_rate_limit");
    if (!throttled || Date.now() > deadline) throw error ?? new Error("no session");
    await sleep(15_000);
  }
}

/** Gives the member an active subscription, so the paywall (if the project has one enabled) lets them message. */
export async function grantSubscription(member: Pick<Member, "userId">) {
  const { error } = await admin.from("user_subscriptions").insert({
    user_id: member.userId,
    stripe_subscription_id: `sub_test_${RUN}_${member.userId.slice(0, 8)}`,
    stripe_customer_id: `cus_test_${RUN}`,
    status: "active",
    current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString(),
  });
  if (error) throw error;
}

/** Remembers a webhook event id so cleanup removes it. */
export const trackWebhookEvent = (id: string) => {
  webhookEventIds.push(id);
  return id;
};

/** A client with no session at all. */
export const anonymousClient = () =>
  createClient(env.supabaseUrl, env.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

export type ApiResult<T = any> = { status: number; body: T };

/** Calls this repo's API as a member (or with no token). */
export async function api<T = any>(
  member: Pick<Member, "token"> | null,
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  const response = await fetch(env.apiUrl + path, {
    method,
    headers: {
      ...(member ? { Authorization: `Bearer ${member.token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as T };
}

export async function uploadPhoto(
  member: Pick<Member, "token">,
  data: Buffer,
  { type = "image/jpeg", name = "photo.jpg" } = {}
): Promise<ApiResult> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type }), name);
  const response = await fetch(env.apiUrl + "/photos", {
    method: "POST",
    headers: { Authorization: `Bearer ${member.token}` },
    body: form,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

/** Asks Storage for a signed URL exactly as the web app does. */
export async function signPhoto(
  member: Pick<Member, "client">,
  storageKey: string,
  variant: "thumb" | "display" = "thumb"
): Promise<{ url?: string; error?: string }> {
  const { data, error } = await member.client.storage
    .from(BUCKET)
    .createSignedUrls([`${storageKey}/${variant}.webp`], 3600);
  const entry = data?.[0];
  return entry?.signedUrl ? { url: entry.signedUrl } : { error: entry?.error ?? error?.message ?? "refused" };
}

export async function storedFiles(storageKey: string): Promise<string> {
  const { data } = await admin.storage.from(BUCKET).list(storageKey);
  return (data ?? []).map((f) => f.name).sort().join(",");
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Removes everything this test process created: stored photos, then the users (rows cascade). */
export async function cleanup() {
  // The audit trail is written by moderators acting on things (reports,
  // photos…), and deliberately survives them — so remove it while we can still
  // tell whose it is. After the users are gone the actor column is null.
  const actorIds = created.flatMap((m) => (m.userId ? [m.userId] : []));
  if (actorIds.length) {
    const { error } = await admin.from("admin_audit_log").delete().in("admin_user_id", actorIds);
    if (error) throw new Error(`cleanup: audit log by actor: ${error.message}`);
  }
  for (const member of created) {
    if (!member.profileId) continue;
    const { data: folders } = await admin.storage.from(BUCKET).list(member.profileId);
    for (const folder of folders ?? []) {
      await admin.storage
        .from(BUCKET)
        .remove([`${member.profileId}/${folder.name}/thumb.webp`, `${member.profileId}/${folder.name}/display.webp`]);
    }
  }
  for (const member of created) {
    if (!member.userId) continue;
    const { error } = await admin.auth.admin.deleteUser(member.userId);
    if (error && !/not found/i.test(error.message)) {
      throw new Error(`cleanup: could not delete test user ${member.email}: ${error.message}`);
    }
  }
  // Rows that outlive their users on purpose: the audit trail keeps an entry
  // after the admin or the target is gone, and webhook events belong to no user.
  const targets = created.flatMap((m) => [m.userId, m.profileId].filter(Boolean));
  if (targets.length) {
    const { error } = await admin.from("admin_audit_log").delete().in("target_id", targets);
    if (error) throw new Error(`cleanup: audit log: ${error.message}`);
  }
  if (webhookEventIds.length) {
    const { error } = await admin.from("webhook_events").delete().in("id", webhookEventIds);
    if (error) throw new Error(`cleanup: webhook events: ${error.message}`);
  }
  created.length = 0;
  webhookEventIds.length = 0;
}
