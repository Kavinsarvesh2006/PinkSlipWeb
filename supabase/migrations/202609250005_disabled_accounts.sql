create or replace function public.student_access(s uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from students x join classes c on c.id=x.class_id where x.id=s and (manages(c.department_id) or (x.active and c.active and ((c.advisor_id=auth.uid() and my_role()='advisor') or (x.user_id=auth.uid() and my_role()='student')))))
$$;
drop policy notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using(recipient_id=auth.uid() and my_role() is not null);
drop policy notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated using(recipient_id=auth.uid() and my_role() is not null) with check(recipient_id=auth.uid() and my_role() is not null);
