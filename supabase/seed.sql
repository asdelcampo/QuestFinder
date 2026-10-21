-- Static seed: groups and venues. Safe to re-run (fixed ids, upserts).
-- People, events, RSVPs, and bucket items come from scripts/seed.ts (Phase 3).

insert into public.groups (id, name, description, auto_join) values
  ('a1000000-0000-4000-8000-000000000001', 'Climbers Friend Group',
   'The crew that climbs together, then eats together.', true),
  -- Never auto-joined, so its private events stay hidden from new signups
  ('a1000000-0000-4000-8000-000000000002', 'Food Crawl Crew',
   'Weekend food trips around Metro Manila.', false)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  auto_join = excluded.auto_join;

-- TODO(author): fill lat/lng from Google Maps (right-click the pin → copy coordinates).
-- Never guess coordinates, prices, or ratings. Venues without coordinates are skipped on the map.
-- TODO(author): add the other ~6 venues (a café, a park or free spot, a food spot for the
-- Food Crawl Crew, and a gym with roped climbing), each with a fixed id in the b1… range.
insert into public.venues (id, name, neighborhood, category, lat, lng) values
  ('b1000000-0000-4000-8000-000000000001', 'Po & Pilar', 'Makati', 'food', null, null),
  ('b1000000-0000-4000-8000-000000000002', 'Bouldering Hive', 'Greenhills', 'climbing', null, null)
on conflict (id) do update set
  name = excluded.name,
  neighborhood = excluded.neighborhood,
  category = excluded.category,
  lat = excluded.lat,
  lng = excluded.lng;

-- Anyone who signed up before the groups existed joins the auto_join groups now
insert into public.group_members (group_id, user_id)
select g.id, p.id
from public.groups g
cross join public.profiles p
where g.auto_join
on conflict do nothing;
