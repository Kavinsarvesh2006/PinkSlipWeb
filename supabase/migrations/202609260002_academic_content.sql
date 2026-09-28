create table public.timetable_entries (
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.classes,
 weekday integer not null check(weekday between 1 and 7),period integer not null check(period between 1 and 20),
 subject text not null check(length(trim(subject))>0),teacher text not null default '',room text not null default '',
 starts_at time not null,ends_at time not null check(ends_at>starts_at),unique(class_id,weekday,period)
);
create table public.notices (
 id uuid primary key default gen_random_uuid(),department_id uuid not null references public.departments,
 title text not null check(length(trim(title))>0),body text not null check(length(trim(body))>0),
 created_at timestamptz not null default now()
);
alter table public.timetable_entries enable row level security;
alter table public.notices enable row level security;
create policy timetable_read on public.timetable_entries for select to authenticated using(class_visible(class_id));
create policy timetable_write on public.timetable_entries for all to authenticated using(class_manage(class_id)) with check(class_manage(class_id));
create policy notices_read on public.notices for select to authenticated using(my_role() is not null and (manages(department_id) or department_id=(select department_id from profiles where id=auth.uid())));
create policy notices_write on public.notices for all to authenticated using(manages(department_id)) with check(manages(department_id));
grant select,insert,update,delete on public.timetable_entries,public.notices to authenticated;
create trigger audit_change after insert or update or delete on public.timetable_entries for each row execute function public.audit_change();
create trigger audit_change after insert or update or delete on public.notices for each row execute function public.audit_change();
alter publication supabase_realtime add table public.timetable_entries,public.notices;
