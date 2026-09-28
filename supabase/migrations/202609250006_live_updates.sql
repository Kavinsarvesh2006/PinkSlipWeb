alter publication supabase_realtime add table public.profiles,public.departments,public.calendar_events,public.call_records;
drop policy calendar_read on public.calendar_events;
create policy calendar_read on public.calendar_events for select to authenticated using(my_role() is not null and (manages(department_id) or department_id=(select department_id from profiles where id=auth.uid())));
