# QuestFinder

A friend-group-first app for planning hangouts at real places in Metro Manila. Someone posts "Dinner at Po & Pilar, Fri, ₱700 per person, 4 spots, Climbers Friend Group only", and friends see it, join, and fill the table. Events carry a climbing session type and level range, and each profile keeps a bucket list of side quests that can be turned into an event in one tap.

**Live:** https://quest-finder-gamma.vercel.app

Built with Next.js 16, TypeScript, and Supabase (auth, Postgres, row-level security), and deployed on Vercel.

## Try it

**Demo login:** `demo@questfinder.test` / `password123`

You can also sign up with any email. There's no email confirmation, and every new account joins **Climbers Friend Group** automatically, so the feed is populated on first visit.

The demo account is shared. Running `npm run db:seed` resets it, along with all the demo data, and moves the demo events to fresh dates.

### A 5-minute tour

1. **Sign up with a fresh account.**
   - The feed shows upcoming events. *Dinner at Po & Pilar* carries the **Climbers Friend Group** badge: it's private, and you can see it because you're in that group.
   - There's also a private *Dinner at Automat* for **Food Crawl Crew**. You won't see it, because new accounts never join that group.
2. **Join *Board games and coffee*.** You take the last spot, so the card turns **FULL!**
3. **Create an event** with the **+** button. Try a past date, a lowest level above the highest, or Private with no group, and each one shows an error under its field. Then create a valid one: you're counted as going, and times are Manila time.
4. **Go to Profile and set your level to V1.** In **For you**, the V0–V3 climb at Bouldering Hive ranks above the V4–V6 project night, and the reason says "fits your level".
5. **Add a side quest with a venue, then tap Make it happen.** Create Event opens with that venue filled in. After you create the event, the side quest shows **Planned** and links to it.
6. **Log in as the demo user and leave *Intro roped session at Climb Central*.** The event is full, so Leo moves up from the waitlist to going. Join again and you're **Waitlist #1**.

## What works

- [x] Email sign-up, log-in, and sign-out. Accounts own their data.
- [x] Seeded groups, venues, people, and events, with auto-join on sign-up.
- [x] A feed of upcoming events with the right public and private visibility.
- [x] Create Event, validated in the browser and again on the server: session type, level range, date and time, price, capacity, and visibility with a group.
- [x] RSVP with capacity, a Full state, a waitlist, and promotion when someone leaves.
- [x] A profile with climbing level, events hosted and joined, and a bucket list (add, delete, Make it happen, and check off once the event has happened).
- [x] Recommendations, each with a one-line reason, shown on the profile and as a **For you** strip on the feed.
- [x] A design pass inspired by [Bump](https://apps.apple.com/ph/app/bump-real-life-is-happening/id6471519217): glass cards, a floating dock, heavy display type, emoji stickers, and avatar clusters. The app is light-only.

## How the rules are enforced

Every rule lives in the database or in a server action, so the UI can't bypass it.

| Rule | Where | How |
|---|---|---|
| **Visibility.** You can read an event if it's public, you host it, or you're in its group. | [`schema.sql`](supabase/migrations/20261021081516_schema.sql) | A row-level security policy on `events`. Group checks go through `private.is_member()`, a `security definer` function, because a policy on `group_members` can't query `group_members` itself without infinite recursion. RSVPs inherit their event's visibility through a policy subquery. |
| **Capacity and waitlist** | [`rsvp.sql`](supabase/migrations/20261021084203_rsvp.sql) | `rsvp()` and `cancel_rsvp()` lock the event row (`select … for update`), so two people can't both take the last spot. Cancelling a going RSVP promotes the earliest person on the waitlist. Clients have no direct write access to `rsvps`. |
| **The host counts as going** | `schema.sql` | An `after insert` trigger on `events`. The host can't leave their own event. |
| **Start time must be in the future** | `schema.sql` | A trigger, not a `CHECK`, because a `CHECK` would re-run `now()` on every later update. |
| **Audience and ownership are fixed** | `schema.sql` | Column-level grants. Signed-in users can't change `visibility`, `group_id`, or `host_id`. Signed-out visitors (`anon`) get no table access at all. |
| **Cancelled events release side quests** | `schema.sql` | A trigger moves linked bucket items from `planned` back to `wishlist`. |
| **Recommendations** | [`lib/recommend.ts`](lib/recommend.ts) | A pure function, unit-tested. +3 if the venue is on your bucket list, +2 for level fit (climbing sessions only), +2 per friend going (at most 3 friends), +1 if the price is at or below your usual. Full, joined, and your own events are left out. |

## Run it locally

You need Node 22 (`nvm use` reads `.nvmrc`), a Supabase project, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

1. Install the dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in the values from Supabase → Project Settings → API Keys:

   | Variable | Where it's used |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | App. The bare project URL, with no `/rest/v1/` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App. Public by design |
   | `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) | `npm run db:seed` only. Keep it local: never commit it, never add it to Vercel |
   | `DEMO_EMAIL`, `DEMO_PASSWORD` | The demo login the seed creates |

3. In Supabase, turn off **Authentication → Sign In / Providers → Email → Confirm email**.
4. Link the project, then apply the migrations, groups, and venues:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
   ```bash
   supabase db push --include-seed
   ```
5. Seed the demo people and events:
   ```bash
   npm run db:seed
   ```
6. Start the app:
   ```bash
   npm run dev
   ```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` / `test` | ESLint, `tsc` (after `next typegen`), Vitest |
| `npm run db:types` | Regenerates `lib/database.types.ts` from the linked project |
| `npm run db:seed` | Resets the demo data |

## Tests

- `npm test` runs 44 Vitest tests covering validation, Manila time and peso formatting, the spots and waitlist helpers, and recommendation scoring, including the spec's V1 check.
- During development, the migrations were also checked against PGlite (Postgres in WebAssembly) with a stubbed Supabase auth layer. That's 34 checks on schema and policies and 15 on the RSVP functions. These checks aren't in the repo yet.

## What's incomplete, and what was cut

This was built against a tight timebox, cutting in the order the spec set.

**Not built yet:**
- Filters on the feed (date, price, group, session type).
- Editing or cancelling your own event. The database side already handles the effects of a cancelled event.
- A daily job that moves demo events to new dates. Until then, the seeded events age, so re-run `npm run db:seed` before sharing the link.
- A map of upcoming events, Google Places autocomplete, and seeing friends' bucket lists.
- A load test of the last-spot race. The row lock is designed for it, but no test has simulated concurrent RSVPs.

**Out of scope on purpose:**
- **TikTok and Instagram saves:** there's no usable public API.
- **Google reviews:** the API returns only a few per place, with attribution rules, so venues link out to Google Maps instead.
- **User-created groups and invites:** groups are seeded.
- **Notifications, payments, and chat.**
- **Gym passport and belay-partner matching:** climbing stays light, with just a session type and a level range.

**Known limits:**
- Venue coordinates aren't filled in yet. They're only needed for the map.
- Seeded prices are illustrative.
- In Create Event, the level-range and private-needs-a-group errors appear only after the basic fields are valid.
- A failed bucket-list delete or check-off shows the error page instead of a toast.
- The free Supabase plan may pause the project after a week without activity.

## Project layout

```
app/                  pages (feed, profile, login, signup) and server actions
components/           event card, RSVP button, Create Event dialog, bucket list, dock, …
lib/                  queries, validation, recommendations, formatting, Supabase clients
proxy.ts              refreshes the session and redirects signed-out visitors
supabase/migrations/  schema, row-level security, triggers, RSVP functions
supabase/seed.sql     groups and venues
scripts/seed.ts       demo people, events, RSVPs, and bucket items (a reset script)
```
