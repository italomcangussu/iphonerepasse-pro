-- Housekeeping for push_subscriptions (PRD US-012).
--
-- Cascade-on-user-delete is already covered by the user_id FK
-- (`references auth.users(id) on delete cascade` in 20260512090000).
-- This migration adds the missing piece: a routine that prunes rows the
-- fan-out never uses again, so the table does not grow without bound:
--   * is_active=false rows (expired endpoints, 404/410 from push-send) older
--     than the retention window, and
--   * active rows that have not been seen in a long time (stale devices) get
--     deactivated so they stop being targeted, then pruned on a later run.

create or replace function public.cleanup_stale_push_subscriptions(
  p_inactive_retention_days integer default 30,
  p_active_stale_days integer default 120
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  -- Retire active devices that have gone silent past the stale window so the
  -- next send stops paying for them; they become eligible for deletion below.
  update public.push_subscriptions
     set is_active = false,
         last_error_at = now(),
         last_error_message = 'auto-deactivated: stale device'
   where is_active = true
     and last_seen_at < now() - make_interval(days => p_active_stale_days);

  -- Delete long-inactive rows. Use the most recent activity signal available.
  delete from public.push_subscriptions
   where is_active = false
     and coalesce(last_error_at, last_seen_at, created_at)
         < now() - make_interval(days => p_inactive_retention_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.cleanup_stale_push_subscriptions(integer, integer) is
  'Deactivates stale push devices and deletes long-inactive subscriptions. Returns rows deleted. See PRD US-012.';

-- Only the service role / cron should run housekeeping, never end users.
revoke all on function public.cleanup_stale_push_subscriptions(integer, integer) from public;
revoke all on function public.cleanup_stale_push_subscriptions(integer, integer) from anon, authenticated;

-- Schedule a daily run when pg_cron is available. Guarded so the migration is a
-- no-op (not a failure) on environments where the extension cannot be enabled.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- Replace any prior schedule with the same name to stay idempotent.
    if exists (select 1 from cron.job where jobname = 'cleanup_stale_push_subscriptions') then
      perform cron.unschedule('cleanup_stale_push_subscriptions');
    end if;

    perform cron.schedule(
      'cleanup_stale_push_subscriptions',
      '17 4 * * *', -- daily at 04:17 UTC, off-peak
      $cron$ select public.cleanup_stale_push_subscriptions(); $cron$
    );
  end if;
exception
  when others then
    -- Never block the migration on scheduling; the function can be run manually.
    raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
