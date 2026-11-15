import { supabaseAdmin } from "../supabase-admin.js";
import { PHOTO_BUCKET } from "../photos/storage.js";
import { fetchAll } from "../paginate.js";

// Photo download links in an export stay valid this long.
const PHOTO_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

// Explicit column lists, not select("*"): an export is a statement of what we
// hold about the person, so what goes in it is decided here, field by field.
// A column added to a table later does not silently start leaking into it, and
// internal fields are left out on purpose — the identity of the admin who
// moderated something (moderated_by / reviewed_by), moderators' private notes
// on a report (admin_notes), and storage paths (replaced by working links).
const PROFILE_COLUMNS =
  "id, nickname, bio, looking_for, bio_pending, looking_for_pending, gender, birthdate, interests, height, weight, eye_color, hair_color, body_type, education_level, occupation, employment_status, income_range, ethnicity, religion, religiosity_level, languages_spoken, relationship_goal, smoker, drinker, has_children, wants_children, commune_insee_code, origin_country_code, moderation_status, moderation_notes, moderated_at, special_category_consent, special_category_consent_at, show_online_status, email_new_message_notifications, email_new_message_cooldown_minutes, last_seen_at, deleted_at, created_at, updated_at";
const PHOTO_COLUMNS = "id, storage_key, position, visibility, moderation_status, created_at";
const CONVERSATION_COLUMNS = "id, profile1_id, profile2_id, created_at";
const MESSAGE_COLUMNS =
  "id, conversation_id, sender_profile_id, recipient_profile_id, content, is_read, created_at";
const FAVORITE_COLUMNS = "id, favorited_profile_id, created_at";
const IGNORE_COLUMNS = "id, ignored_profile_id, created_at";
const PHOTO_ACCESS_COLUMNS = "id, owner_profile_id, viewer_profile_id, status, created_at, updated_at";
const REPORT_COLUMNS = "id, content_type, content_id, reason, description, status, created_at";
const SUBSCRIPTION_COLUMNS =
  "id, status, stripe_subscription_id, stripe_customer_id, trial_start, trial_end, current_period_start, current_period_end, cancel_at_period_end, created_at";

/**
 * Everything tied to one account, for GDPR Art. 15/20 (access, portability).
 * Throws if any part cannot be read in full — a partial export must never be
 * presented as a complete one.
 */
export async function buildAccountExport(userId: string, email: string | undefined) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw new Error(`read failed: ${profileError.message}`);

  const [reports, subscriptions] = await Promise.all([
    fetchAll((from, to) =>
      supabaseAdmin
        .from("reports")
        .select(REPORT_COLUMNS, { count: "exact" })
        .eq("reporter_id", userId)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabaseAdmin
        .from("user_subscriptions")
        .select(SUBSCRIPTION_COLUMNS, { count: "exact" })
        .eq("user_id", userId)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
  ]);

  const base = { exportedAt: new Date().toISOString(), account: { id: userId, email }, reports, subscriptions };

  // No profile yet: nothing else exists to export.
  if (!profile) {
    return {
      ...base,
      profile: null,
      photos: [],
      conversations: [],
      messages: [],
      favorites: [],
      ignores: [],
      photoAccess: { asOwner: [], asViewer: [] },
    };
  }

  const profileId = profile.id;
  const involvingMe = `profile1_id.eq.${profileId},profile2_id.eq.${profileId}`;
  const [photoRows, conversations, messages, favorites, ignores, accessRows] = await Promise.all([
    fetchAll((from, to) =>
      supabaseAdmin
        .from("profile_photos")
        .select(PHOTO_COLUMNS, { count: "exact" })
        .eq("profile_id", profileId)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabaseAdmin
        .from("conversations")
        .select(CONVERSATION_COLUMNS, { count: "exact" })
        .or(involvingMe)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabaseAdmin
        .from("messages")
        .select(MESSAGE_COLUMNS, { count: "exact" })
        .or(`sender_profile_id.eq.${profileId},recipient_profile_id.eq.${profileId}`)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabaseAdmin
        .from("profile_favorites")
        .select(FAVORITE_COLUMNS, { count: "exact" })
        .eq("profile_id", profileId)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabaseAdmin
        .from("profile_ignores")
        .select(IGNORE_COLUMNS, { count: "exact" })
        .eq("ignorer_profile_id", profileId)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabaseAdmin
        .from("photo_access")
        .select(PHOTO_ACCESS_COLUMNS, { count: "exact" })
        .or(`owner_profile_id.eq.${profileId},viewer_profile_id.eq.${profileId}`)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
  ]);

  // The photos themselves: a time-limited link to the full-size file for each,
  // not the storage path. (Private photos too — they are the member's own.)
  let urlByKey = new Map<string, string>();
  if (photoRows.length > 0) {
    const paths = photoRows.map((p) => `${p.storage_key}/display.webp`);
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, PHOTO_LINK_TTL_SECONDS);
    if (signError || !signed) throw new Error(`photo links failed: ${signError?.message ?? "no result"}`);
    const failed = signed.find((entry) => !entry.signedUrl);
    if (failed) throw new Error(`photo link failed for ${failed.path}: ${failed.error ?? "unknown"}`);
    // By path, not by position: don't rely on the response order.
    const urlByPath = new Map(signed.map((entry) => [entry.path, entry.signedUrl as string]));
    urlByKey = new Map(
      photoRows.flatMap((p) => {
        const url = urlByPath.get(`${p.storage_key}/display.webp`);
        return url ? [[p.storage_key, url] as const] : [];
      })
    );
  }

  return {
    ...base,
    profile,
    photos: photoRows.map(({ storage_key, ...photo }) => ({ ...photo, file_url: urlByKey.get(storage_key) ?? null })),
    photoLinksExpireAt: photoRows.length
      ? new Date(Date.now() + PHOTO_LINK_TTL_SECONDS * 1000).toISOString()
      : null,
    conversations,
    messages,
    favorites,
    ignores,
    photoAccess: {
      asOwner: accessRows
        .filter((r) => r.owner_profile_id === profileId)
        .map(({ id, viewer_profile_id, status, created_at, updated_at }) => ({
          id,
          viewer_profile_id,
          status,
          created_at,
          updated_at,
        })),
      // A decline or a later withdrawal is silent by design — the requester
      // only ever sees "pending". The export must not reveal it either.
      asViewer: accessRows
        .filter((r) => r.viewer_profile_id === profileId)
        .map(({ id, owner_profile_id, status, created_at, updated_at }) => ({
          id,
          owner_profile_id,
          status: status === "denied" ? "pending" : status,
          created_at,
          updated_at: status === "denied" ? created_at : updated_at,
        })),
    },
  };
}
