-- Rule 2 (capacity and waitlist). RSVPs change only through these two functions.
-- Both lock the event row first, so two people taking the last spot at once queue up:
-- the second call counts "going" only after the first commits, and lands on the waitlist.
-- They run with their owner's rights (cancel promotes someone else's RSVP), so each one
-- checks the caller and the event's visibility itself.

create function public.rsvp(p_event uuid)
returns public.rsvp_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ev public.events;
  existing public.rsvp_status;
  going int;
  result public.rsvp_status;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into ev from public.events where id = p_event for update;
  -- Same message whether the event is missing or hidden, so it doesn't reveal private events
  if not found or not (ev.visibility = 'public' or ev.host_id = uid or private.is_member(ev.group_id)) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if ev.status <> 'open' or ev.starts_at <= now() then
    raise exception 'This event is closed' using errcode = '22023';
  end if;

  -- A second RSVP by the same person changes nothing
  select status into existing from public.rsvps where event_id = p_event and user_id = uid;
  if found then
    return existing;
  end if;

  select count(*) into going from public.rsvps where event_id = p_event and status = 'going';
  result := case
    when ev.capacity is null or going < ev.capacity then 'going'::public.rsvp_status
    else 'waitlist'::public.rsvp_status
  end;
  insert into public.rsvps (event_id, user_id, status) values (p_event, uid, result);
  return result;
end;
$$;

create function public.cancel_rsvp(p_event uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ev public.events;
  was public.rsvp_status;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into ev from public.events where id = p_event for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if ev.host_id = uid then
    raise exception 'Hosts cancel the event instead of leaving' using errcode = '22023';
  end if;

  delete from public.rsvps where event_id = p_event and user_id = uid returning status into was;

  -- A freed seat goes to whoever has waited longest
  if was = 'going' then
    update public.rsvps set status = 'going'
    where (event_id, user_id) = (
      select event_id, user_id from public.rsvps
      where event_id = p_event and status = 'waitlist'
      order by created_at, user_id
      limit 1
    );
  end if;
end;
$$;

revoke execute on function public.rsvp(uuid), public.cancel_rsvp(uuid) from public, anon;
grant execute on function public.rsvp(uuid), public.cancel_rsvp(uuid) to authenticated;
