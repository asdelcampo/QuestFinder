// Resets the demo data: seeded people, their groups, events, RSVPs, and bucket items.
// Safe to re-run; each run moves the events to fresh dates relative to now.
// Run with: npm run db:seed   (needs SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local)
// Groups and venues come from supabase/seed.sql, which must be applied first.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoEmail = process.env.DEMO_EMAIL;
const demoPassword = process.env.DEMO_PASSWORD;
if (!url || !secretKey || !demoEmail || !demoPassword) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), DEMO_EMAIL, and DEMO_PASSWORD in .env.local",
  );
}

// The secret key bypasses row-level security. It only ever runs here, on your machine.
const admin = createClient<Database>(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const GROUPS = {
  climbers: "a1000000-0000-4000-8000-000000000001",
  foodCrawl: "a1000000-0000-4000-8000-000000000002",
};

// Fixed ids from supabase/seed.sql
const VENUES = {
  poPilar: "b1000000-0000-4000-8000-000000000001",
  hive: "b1000000-0000-4000-8000-000000000002",
  climbCentral: "b1000000-0000-4000-8000-000000000003",
  automat: "b1000000-0000-4000-8000-000000000004",
  ayalaTriangle: "b1000000-0000-4000-8000-000000000005",
  brewman: "b1000000-0000-4000-8000-000000000006",
  blackBean: "b1000000-0000-4000-8000-000000000007",
};

type PersonKey = "demo" | "mara" | "jo" | "bea" | "leo";

const PEOPLE: Record<PersonKey, { email: string; name: string; level: number; foodCrawl: boolean }> = {
  demo: { email: demoEmail, name: "Demo Climber", level: 1, foodCrawl: false },
  mara: { email: "mara@questfinder.test", name: "Mara", level: 3, foodCrawl: false },
  jo: { email: "jo@questfinder.test", name: "Jo", level: 5, foodCrawl: false },
  bea: { email: "bea@questfinder.test", name: "Bea", level: 2, foodCrawl: true },
  leo: { email: "leo@questfinder.test", name: "Leo", level: 0, foodCrawl: true },
};

// 7pm Manila time, `days` from today (Manila is UTC+8 with no daylight saving)
function daysFromNowAt7pm(days: number) {
  const manilaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(manilaNow.getUTCFullYear(), manilaNow.getUTCMonth(), manilaNow.getUTCDate() + days, 19 - 8),
  ).toISOString();
}

type SeedEvent = {
  key: string;
  host: PersonKey;
  venue: keyof typeof VENUES;
  activity: string;
  sessionType: Database["public"]["Enums"]["session_type"];
  levels?: [number, number];
  day: number;
  price: number;
  capacity: number | null;
  group?: keyof typeof GROUPS;
  going: PersonKey[]; // guests besides the host, who is added by the database trigger
  waitlist?: PersonKey[];
};

// One event per rule the demo needs to show (implementation.md, Phase 3)
const EVENTS: SeedEvent[] = [
  { key: "E1", host: "mara", venue: "poPilar", activity: "Dinner at Po & Pilar", sessionType: "social", day: 2, price: 700, capacity: 4, group: "climbers", going: ["jo"] },
  { key: "E2", host: "jo", venue: "hive", activity: "Climb at Bouldering Hive", sessionType: "bouldering", levels: [0, 3], day: 1, price: 800, capacity: null, going: ["bea", "mara"] },
  { key: "E3", host: "mara", venue: "climbCentral", activity: "Intro roped session at Climb Central", sessionType: "intro", day: 3, price: 600, capacity: 4, going: ["jo", "bea", "demo"], waitlist: ["leo"] },
  { key: "E4", host: "bea", venue: "automat", activity: "Dinner at Automat", sessionType: "social", day: 4, price: 500, capacity: 6, group: "foodCrawl", going: ["leo"] },
  { key: "E5", host: "demo", venue: "ayalaTriangle", activity: "Picnic at Ayala Triangle", sessionType: "social", day: 5, price: 0, capacity: null, going: [] },
  { key: "E6", host: "bea", venue: "brewman", activity: "Coffee at The Brewman", sessionType: "social", day: 6, price: 250, capacity: 6, going: ["mara"] },
  { key: "E7", host: "jo", venue: "hive", activity: "Project night at Bouldering Hive", sessionType: "bouldering", levels: [4, 6], day: 2, price: 800, capacity: 8, going: [] },
  { key: "E8", host: "leo", venue: "blackBean", activity: "Board games and coffee", sessionType: "social", day: 7, price: 300, capacity: 3, going: ["bea"] },
];

// Bucket items as [owner, title, venue]; "Try <venue>" titles are filled from the venue names
const BUCKET: [PersonKey, string | null, keyof typeof VENUES | null][] = [
  ["demo", null, "poPilar"],
  ["demo", null, "brewman"],
  ["demo", "Climb outdoors in Montalban", null],
  ["mara", null, "climbCentral"],
  ["jo", null, "poPilar"],
  ["bea", null, "automat"],
];

// Unwraps a Supabase response, stopping the seed on the first error
async function check<R extends { data: unknown; error: unknown }>(label: string, promise: PromiseLike<R>) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${JSON.stringify(result.error)}`);
  return result.data as NonNullable<R["data"]>;
}

async function upsertPeople() {
  const existing = await check("list users", admin.auth.admin.listUsers({ perPage: 1000 }));
  const ids = {} as Record<PersonKey, string>;

  for (const [key, person] of Object.entries(PEOPLE) as [PersonKey, (typeof PEOPLE)[PersonKey]][]) {
    // Only the demo login is documented; the others get a fresh random password each run
    const password = key === "demo" ? demoPassword! : randomUUID();
    const found = existing.users.find((u) => u.email?.toLowerCase() === person.email.toLowerCase());
    if (found) {
      await check(`update ${key}`, admin.auth.admin.updateUserById(found.id, { password }));
      ids[key] = found.id;
    } else {
      const created = await check(
        `create ${key}`,
        admin.auth.admin.createUser({
          email: person.email,
          password,
          email_confirm: true,
          user_metadata: { display_name: person.name },
        }),
      );
      ids[key] = created.user!.id;
    }
    // The signup trigger made the profile and joined Climbers; reset name and level each run
    await check(
      `profile ${key}`,
      admin.from("profiles").update({ display_name: person.name, climbing_level: person.level }).eq("id", ids[key]),
    );
    await check(
      `groups ${key}`,
      admin.from("group_members").upsert(
        [
          { group_id: GROUPS.climbers, user_id: ids[key] },
          ...(person.foodCrawl ? [{ group_id: GROUPS.foodCrawl, user_id: ids[key] }] : []),
        ],
        { ignoreDuplicates: true },
      ),
    );
  }
  return ids;
}

async function main() {
  const venues = await check("venues", admin.from("venues").select("id, name"));
  const venueName = new Map(venues.map((v) => [v.id, v.name]));
  const missing = Object.entries(VENUES).filter(([, id]) => !venueName.has(id));
  if (missing.length) {
    throw new Error(
      `Missing venues in supabase/seed.sql: ${missing.map(([key]) => key).join(", ")}. Add them, then re-run.`,
    );
  }

  const ids = await upsertPeople();
  const seededUserIds = Object.values(ids);

  // Reset: demo events, plus anything reviewers created while logged in as a seeded person.
  // Deleting events also removes their RSVPs (cascade).
  await check("delete demo events", admin.from("events").delete().eq("is_demo", true));
  await check("delete seeded hosts' events", admin.from("events").delete().in("host_id", seededUserIds));
  await check("delete bucket items", admin.from("bucket_items").delete().in("user_id", seededUserIds));

  for (const event of EVENTS) {
    const created = await check(
      `event ${event.key}`,
      admin
        .from("events")
        .insert({
          host_id: ids[event.host],
          venue_id: VENUES[event.venue],
          activity: event.activity,
          session_type: event.sessionType,
          level_min: event.levels?.[0] ?? null,
          level_max: event.levels?.[1] ?? null,
          starts_at: daysFromNowAt7pm(event.day),
          price_per_person: event.price,
          capacity: event.capacity,
          visibility: event.group ? "private" : "public",
          group_id: event.group ? GROUPS[event.group] : null,
          is_demo: true,
        })
        .select("id")
        .single(),
    );

    // Explicit, increasing timestamps keep the waitlist order fixed
    const base = Date.now() - 24 * 60 * 60 * 1000;
    const guests = [
      ...event.going.map((p) => ({ person: p, status: "going" as const })),
      ...(event.waitlist ?? []).map((p) => ({ person: p, status: "waitlist" as const })),
    ];
    if (guests.length) {
      await check(
        `rsvps ${event.key}`,
        admin.from("rsvps").insert(
          guests.map((g, i) => ({
            event_id: created.id,
            user_id: ids[g.person],
            status: g.status,
            created_at: new Date(base + i * 60_000).toISOString(),
          })),
        ),
      );
    }
  }

  await check(
    "bucket items",
    admin.from("bucket_items").insert(
      BUCKET.map(([owner, title, venue]) => ({
        user_id: ids[owner],
        title: title ?? `Try ${venueName.get(VENUES[venue!])}`,
        venue_id: venue ? VENUES[venue] : null,
      })),
    ),
  );

  console.log(`Seeded ${seededUserIds.length} people, ${EVENTS.length} events, ${BUCKET.length} bucket items.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
