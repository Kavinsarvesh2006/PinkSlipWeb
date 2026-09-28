-- Use definer helpers for relationships to avoid recursive RLS expansion.
create function public.class_visible(c uuid) returns boolean language sql stable security definer set search_path=public as $$
 select class_access(c) or exists(select 1 from students where class_id=c and user_id=auth.uid() and active and my_role()='student')
$$;
create function public.class_manage(c uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from classes where id=c and manages(department_id))$$;
drop policy classes_read on public.classes;
create policy classes_read on public.classes for select to authenticated using(class_visible(id));
drop policy students_write on public.students;
create policy students_write on public.students for all to authenticated using(class_manage(class_id)) with check(class_manage(class_id));
revoke execute on function public.class_visible(uuid),public.class_manage(uuid) from public,anon;
grant execute on function public.class_visible(uuid),public.class_manage(uuid) to authenticated;
revoke insert,update,delete on public.profiles from authenticated;
revoke insert,update,delete on public.audit_logs from authenticated;
revoke insert,update,delete on public.promotions from authenticated;
revoke insert,update on public.call_records from authenticated;
revoke insert,delete on public.notifications from authenticated;
