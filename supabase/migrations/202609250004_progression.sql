-- Only the approval routine may advance or complete an existing class/student.
revoke update on public.classes from authenticated;
grant update(section,batch,advisor_id,promotion_due) on public.classes to authenticated;
revoke update on public.students from authenticated;
grant update(class_id,user_id,name,register_number,phone,parent_name,parent_phone,email,degree) on public.students to authenticated;
create function public.initial_student_state() returns trigger language plpgsql as $$begin
 new.active=true; new.completed_at=null; return new;
end$$;
create trigger initial_student_state before insert on public.students for each row execute function public.initial_student_state();
revoke all on function public.initial_student_state() from public,anon,authenticated;
-- Scheduler runs daily on Supabase; migration stays usable on PostgreSQL test engines.
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron;
  perform cron.schedule('pinkslip-annual-approvals','30 0 * * *','select public.queue_due_promotions()');
 end if;
end$$;
