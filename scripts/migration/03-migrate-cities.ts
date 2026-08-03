// Maps each monolith `cities` row to a commune_insee_code in the new
// communes_fr table (the old `cities` table itself no longer exists in
// this schema — see the earlier "Replace cities table with communes_fr"
// work). Layered matching, in order:
//   1. exact code_postal match
//   2. codes_postaux contains it (covers big cities where the dataset's
//      primary code_postal isn't the monolith's chosen postal code, but a
//      secondary one is — e.g. Nantes' primary is 44200 but 44000 shows up
//      in codes_postaux)
//   3. name match within the postal code's implied department (covers
//      Paris/Marseille/Lyon, whose 1st-20th arrondissement postal codes
//      aren't present in this dataset's codes_postaux at all — the
//      dataset only carries one row for the whole city)
// City names with a trailing " N" (junk seed rows like "Paris 1",
// "Marseille 1") are stripped before matching.
//
// Cities outside France (Monaco, Brussels, Geneva, Amsterdam, Barcelona,
// Rome, London — all mis-tagged country_code='FR' in the monolith, a
// pre-existing data bug there) cannot match anything: communes_fr is
// exclusively French INSEE data. Those are left unmapped and reported, not
// silently dropped — see the printed "UNMATCHED" list.
import { rencontre } from "./lib/clients.js";
import { readOutput, writeOutput } from "./lib/io.js";

type City = {
  id: string;
  name: string;
  postal_code: string | null;
  country: string | null;
};

// communes_fr is exclusively French communes — country_code on every
// monolith city row is hardcoded 'FR' regardless of the real country (a
// pre-existing monolith bug), so `country` is the only reliable signal.
function looksFrench(city: City): boolean {
  return !city.country || city.country.trim().toLowerCase() === "france";
}

function cleanName(name: string) {
  return name.replace(/\s+\d+$/, "").trim();
}

function departmentCodeFromPostal(postal: string): string {
  if (postal.startsWith("97") || postal.startsWith("98")) return postal.slice(0, 3);
  return postal.slice(0, 2);
}

async function matchCity(city: City): Promise<{ codeInsee: string; nom: string; method: string } | null> {
  if (!looksFrench(city)) return null;
  if (!city.postal_code) return null;
  const postal = city.postal_code.trim();
  // French postal codes are exactly 5 digits — a foreign code that merely
  // looks numeric (Monaco/Belgium/Netherlands often use 4) must not reach
  // the codes_postaux substring check below, or it can match as a raw
  // substring of an unrelated 5-digit French code (e.g. "1000" inside
  // "31000" — caught live: Brussels/Amsterdam both false-matched Toulouse
  // this way before this guard was added).
  if (!/^\d{5}$/.test(postal)) return null;

  const exact = await rencontre.from("communes_fr").select("code_insee, nom_standard").eq("code_postal", postal).limit(1);
  if (exact.data?.length) {
    // code_insee is the primary key and nom_standard is not-null at the DB
    // level (see the communes_fr migration) — the generated Database type
    // is just conservative about a table this project didn't create.
    return { codeInsee: exact.data[0].code_insee!, nom: exact.data[0].nom_standard!, method: "code_postal exact" };
  }

  // Exact-token match against the comma-separated codes_postaux list —
  // not ILIKE substring, which has the same false-positive risk as above
  // even between two genuine 5-digit French codes (e.g. "31000" would
  // substring-match inside a hypothetical "131000").
  const candidates = await rencontre
    .from("communes_fr")
    .select("code_insee, nom_standard, codes_postaux, population")
    .ilike("codes_postaux", `%${postal}%`)
    .order("population", { ascending: false });
  const tokenMatch = candidates.data?.find((row) =>
    (row.codes_postaux ?? "").split(",").map((s) => s.trim()).includes(postal)
  );
  if (tokenMatch) {
    return { codeInsee: tokenMatch.code_insee!, nom: tokenMatch.nom_standard!, method: "codes_postaux exact token" };
  }

  const name = cleanName(city.name);
  const depCode = departmentCodeFromPostal(postal);
  const byName = await rencontre
    .from("communes_fr")
    .select("code_insee, nom_standard, population, dep_code")
    .ilike("nom_standard", name)
    .order("population", { ascending: false });
  if (byName.data?.length) {
    const inDept = byName.data.find((r) => r.dep_code === depCode);
    const pick = inDept ?? byName.data[0];
    return { codeInsee: pick.code_insee!, nom: pick.nom_standard!, method: inDept ? "name+department" : "name only (department mismatch, used anyway — verify)" };
  }

  return null;
}

async function main() {
  const { cities } = readOutput<{ cities: City[] }>("export");

  const cityMap: Record<string, string | null> = {};
  const unmatched: City[] = [];

  for (const city of cities) {
    const match = await matchCity(city);
    if (match) {
      console.log(`${city.name} (${city.postal_code}) -> ${match.nom} [${match.codeInsee}] via ${match.method}`);
      cityMap[city.id] = match.codeInsee;
    } else {
      console.log(`${city.name} (${city.postal_code}, ${city.country}) -> UNMATCHED`);
      cityMap[city.id] = null;
      unmatched.push(city);
    }
  }

  writeOutput("city-map", cityMap);

  if (unmatched.length) {
    console.log(`\n${unmatched.length} cities could not be mapped (profiles referencing them will migrate with commune_insee_code = null):`);
    for (const c of unmatched) console.log(`  - ${c.name} (${c.postal_code}, ${c.country})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
