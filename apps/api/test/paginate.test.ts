import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchAll } from "../src/lib/paginate.js";

// A fake PostgREST: serves `total` rows, never more than `cap` per response.
const server = (total: number, cap: number) => async (from: number, to: number) => {
  const end = Math.min(to, from + cap - 1, total - 1);
  return { data: from >= total ? [] : Array.from({ length: end - from + 1 }, (_, i) => from + i), error: null, count: total };
};

describe("fetchAll", () => {
  it("returns everything across several pages", async () => {
    assert.equal((await fetchAll(server(2500, 1000))).length, 2500);
  });

  it("copes with a server cap smaller than the page size", async () => {
    const rows = await fetchAll(server(1234, 300));
    assert.equal(rows.length, 1234);
    assert.deepEqual(rows.slice(298, 302), [298, 299, 300, 301], "pages join up without gaps or repeats");
  });

  it("handles an empty result", async () => {
    assert.deepEqual(await fetchAll(server(0, 1000)), []);
  });

  it("throws on a read error", async () => {
    await assert.rejects(fetchAll(async () => ({ data: null, error: { message: "boom" }, count: null })), /boom/);
  });

  it("throws when no total is returned", async () => {
    await assert.rejects(fetchAll(async () => ({ data: [1], error: null, count: null })), /row count/);
  });

  it("throws rather than return a short list", async () => {
    // Claims 10 rows exist but stops serving after 4.
    let served = false;
    await assert.rejects(
      fetchAll(async () => {
        const data = served ? [] : [1, 2, 3, 4];
        served = true;
        return { data, error: null, count: 10 };
      }),
      /incomplete read: got 4 of 10/
    );
  });
});
