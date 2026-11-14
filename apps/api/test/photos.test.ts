import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { admin, anonymousClient, api, cleanup, createMember, signPhoto, storedFiles, uploadPhoto, type Member } from "./helpers/world.js";
import { exifJpeg, jpeg, largeJpeg, svg } from "./helpers/images.js";

const download = async (url: string) => Buffer.from(await (await fetch(url)).arrayBuffer());

describe("photo upload", () => {
  let owner: Member, other: Member;

  before(async () => {
    owner = await createMember({ label: "owner" });
    other = await createMember({ label: "other" });
  });
  after(cleanup);

  it("needs a session and a profile", async () => {
    assert.equal((await uploadPhoto({ token: "garbage" }, await jpeg())).status, 401);
  });

  it("stores a re-encoded copy and a thumbnail, and records the photo", async () => {
    const res = await uploadPhoto(owner, await largeJpeg());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.profile_id, owner.profileId);
    assert.match(res.body.storage_key, new RegExp(`^${owner.profileId}/[0-9a-f-]{36}$`));
    assert.equal(res.body.moderation_status, "pending", "new photos wait for moderation");
    assert.equal(res.body.visibility, "private", "new photos start private");
    assert.equal(await storedFiles(res.body.storage_key), "display.webp,thumb.webp");

    const display = await sharp(await download((await signPhoto(owner, res.body.storage_key, "display")).url!)).metadata();
    const thumb = await sharp(await download((await signPhoto(owner, res.body.storage_key, "thumb")).url!)).metadata();
    assert.equal(display.format, "webp");
    assert.ok(display.width! <= 1600 && display.height! <= 1600, `display is ${display.width}x${display.height}`);
    assert.ok(thumb.width! <= 640 && thumb.height! <= 800, `thumb is ${thumb.width}x${thumb.height}`);
  });

  it("stores photos with a short cache lifetime", async () => {
    const res = await uploadPhoto(owner, await jpeg());
    assert.equal(res.status, 200);
    const info = await admin.storage.from("profile-photos").info(`${res.body.storage_key}/thumb.webp`);
    assert.ifError(info.error);
    assert.equal(info.data!.cacheControl, "max-age=600");
  });

  it("applies the orientation and drops camera and GPS metadata", async () => {
    const res = await uploadPhoto(owner, await exifJpeg());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const bytes = await download((await signPhoto(owner, res.body.storage_key, "display")).url!);
    const meta = await sharp(bytes).metadata();
    // 1200x800 pixels tagged "rotate 90°" must come out portrait.
    assert.equal(meta.width, 800);
    assert.equal(meta.height, 1200);
    assert.equal(meta.exif, undefined, "no EXIF survives");
    assert.equal(bytes.includes(Buffer.from("TestCamera")), false);
  });

  it("refuses things that are not photos", async () => {
    for (const [label, data, type] of [
      ["svg", svg(), "image/svg+xml"],
      ["text claiming to be a jpeg", Buffer.from("not an image at all"), "image/jpeg"],
      ["truncated jpeg", (await jpeg()).subarray(0, 100), "image/jpeg"],
    ] as const) {
      const res = await uploadPhoto(owner, data, { type });
      assert.equal(res.status, 400, label);
    }
  });

  it("refuses an empty request and an oversized file", async () => {
    const empty = await fetch(new URL("/photos", process.env.TEST_API_URL ?? "http://localhost:8787"), {
      method: "POST",
      headers: { Authorization: `Bearer ${owner.token}` },
      body: new FormData(),
    });
    assert.equal(empty.status, 400);
    const huge = await uploadPhoto(owner, Buffer.alloc(13 * 1024 * 1024, 7));
    assert.equal(huge.status, 413);
  });

  it("leaves nothing behind for refused uploads", async () => {
    const { count } = await admin.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", owner.profileId);
    const { data: folders } = await admin.storage.from("profile-photos").list(owner.profileId);
    assert.equal(folders!.length, count, "one stored folder per recorded photo");
  });

  it("stops at ten photos", async () => {
    const full = await createMember({ label: "full" });
    const rows = Array.from({ length: 10 }, (_, i) => ({
      profile_id: full.profileId,
      storage_key: `${full.profileId}/00000000-0000-4000-8000-00000000000${i}`,
      position: i,
    }));
    const { error } = await admin.from("profile_photos").insert(rows);
    assert.ifError(error);
    assert.equal((await uploadPhoto(full, await jpeg())).status, 409);
  });

  it("clients cannot create photo rows or objects themselves", async () => {
    const row = await owner.client
      .from("profile_photos")
      .insert({ profile_id: owner.profileId, storage_key: `${other.profileId}/00000000-0000-4000-8000-0000000000aa` });
    assert.ok(row.error, "row insert refused");
    const object = await owner.client.storage
      .from("profile-photos")
      .upload(`${owner.profileId}/forged/display.webp`, await jpeg(), { contentType: "image/webp" });
    assert.ok(object.error, "object upload refused");
  });
});

describe("photo deletion", () => {
  let owner: Member, other: Member;
  before(async () => {
    owner = await createMember({ label: "del-owner" });
    other = await createMember({ label: "del-other" });
  });
  after(cleanup);

  it("removes the row and both files, and only for the owner", async () => {
    const up = await uploadPhoto(owner, await jpeg());
    assert.equal(up.status, 200);
    const { id, storage_key } = up.body;

    assert.equal((await api(other, "DELETE", `/photos/${id}`)).status, 404, "someone else's photo looks like it does not exist");
    assert.equal((await api(null, "DELETE", `/photos/${id}`)).status, 401);
    assert.equal(await storedFiles(storage_key), "display.webp,thumb.webp", "untouched so far");

    assert.equal((await api(owner, "DELETE", `/photos/${id}`)).status, 200);
    assert.equal(await storedFiles(storage_key), "");
    const { data } = await admin.from("profile_photos").select("id").eq("id", id);
    assert.equal(data!.length, 0);
    assert.equal((await api(owner, "DELETE", `/photos/${id}`)).status, 404, "already gone");
  });
});

describe("who can see a photo", () => {
  let owner: Member, viewer: Member, stranger: Member, unapproved: Member, moderator: Member;
  let key: string;
  let photoId: string;

  const canSee = async (who: Member) => Boolean((await signPhoto(who, key)).url);

  before(async () => {
    owner = await createMember({ label: "pv-owner" });
    viewer = await createMember({ label: "pv-viewer" });
    stranger = await createMember({ label: "pv-stranger" });
    unapproved = await createMember({ label: "pv-unapproved", status: "pending" });
    moderator = await createMember({ label: "pv-mod", role: "moderator" });
    const up = await uploadPhoto(owner, await jpeg());
    assert.equal(up.status, 200);
    key = up.body.storage_key;
    photoId = up.body.id;
  });
  after(cleanup);

  const setPhoto = async (patch: { moderation_status?: string; visibility?: string }) => {
    const { error } = await admin.from("profile_photos").update(patch).eq("id", photoId);
    assert.ifError(error);
  };

  it("the owner and moderators always can; nobody else while it is pending", async () => {
    assert.equal(await canSee(owner), true);
    assert.equal(await canSee(moderator), true);
    assert.equal(await canSee(viewer), false);
    assert.equal(await canSee(anonymous()), false);
  });

  it("an approved public photo is visible to approved members only", async () => {
    await setPhoto({ moderation_status: "approved", visibility: "public" });
    assert.equal(await canSee(viewer), true);
    assert.equal(await canSee(stranger), true);
    assert.equal(await canSee(unapproved), false, "a member who is not approved yet sees no photos");
    assert.equal(await canSee(anonymous()), false);
  });

  it("a private photo follows the owner's grants, and withdrawing closes it again", async () => {
    await setPhoto({ moderation_status: "approved", visibility: "private" });
    assert.equal(await canSee(viewer), false);

    const request = await viewer.client.rpc("request_photo_access", { p_owner_profile_id: owner.profileId });
    assert.ifError(request.error);
    assert.equal(await canSee(viewer), false, "asking is not being allowed");

    const grant = await owner.client.rpc("set_photo_access", { p_viewer_profile_id: viewer.profileId, p_grant: true });
    assert.ifError(grant.error);
    assert.equal(await canSee(viewer), true);
    assert.equal(await canSee(stranger), false, "the grant is per member");

    const withdraw = await owner.client.rpc("set_photo_access", { p_viewer_profile_id: viewer.profileId, p_grant: false });
    assert.ifError(withdraw.error);
    assert.equal(await canSee(viewer), false);
  });

  it("a rejected photo is visible to its owner only", async () => {
    await setPhoto({ moderation_status: "rejected", visibility: "public" });
    assert.equal(await canSee(owner), true);
    assert.equal(await canSee(viewer), false);
  });

  it("once the photo is deleted nobody can get a new link to it", async () => {
    // (A link already handed out keeps working until it expires — it is a
    // bearer URL, and objects are cached for an hour. What must hold is that
    // no new one is issued.)
    await setPhoto({ moderation_status: "approved", visibility: "public" });
    assert.equal(await canSee(viewer), true);
    assert.equal((await api(owner, "DELETE", `/photos/${photoId}`)).status, 200);
    assert.equal(await canSee(viewer), false);
    assert.equal(await canSee(owner), false);
  });
});

function anonymous(): Member {
  return { client: anonymousClient() } as Member;
}
