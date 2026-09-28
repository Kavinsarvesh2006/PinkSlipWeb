-- Shared production workflow for both clients. No roster or department seed data.
alter table public.classes drop constraint classes_year_check;
alter table public.classes add column course_years integer not null default 4 check(course_years between 1 and 12);
alter table public.classes add constraint classes_year_range check(year between 1 and course_years);
alter table public.promotions drop constraint promotions_from_year_check;
alter table public.promotions add constraint promotion_year_range check(from_year between 1 and 12);
alter table public.departments add constraint department_name_required check(length(trim(name))>0);
alter table public.departments add constraint department_code_required check(length(trim(code))>0);
alter table public.classes add constraint section_required check(length(trim(section))>0);
alter table public.classes add constraint batch_range check(batch between 1900 and 2200);
alter table public.students add constraint student_name_required check(length(trim(name))>0);
alter table public.students add constraint register_required check(length(trim(register_number))>0);
create index students_class_idx on public.students(class_id);
create index classes_department_idx on public.classes(department_id);
create index leaves_pending_idx on public.leaves(status,student_id);
create index profiles_department_idx on public.profiles(department_id);
-- Remove the original single-college seed from fresh installations in migration 001.
-- Existing department records are deliberately retained to protect linked real data.
create or replace function public.guard_attendance() returns trigger language plpgsql security definer set search_path=public as $$begin
 if TG_OP='UPDATE' and (new.student_id<>old.student_id or new.day<>old.day) then raise exception 'Attendance identity cannot change'; end if;
 if new.day>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Future attendance cannot be recorded'; end if;
 if not student_staff(new.student_id) then raise exception 'Not authorized'; end if;
 if not student_manage(new.student_id) then
  if new.day<>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Advisors can mark only the current college date'; end if;
  if TG_OP='UPDATE' then raise exception 'Only HOD or Super Admin can correct saved attendance'; end if;
 end if;
 if exists(select 1 from leaves where student_id=new.student_id and status='approved' and new.day between start_date and end_date) then new.status='informed'; end if;
 new.marked_by=auth.uid(); new.updated_at=now(); return new;
end$$;
create or replace function public.mark_attendance(p_day date,p_marks jsonb) returns void language plpgsql security definer set search_path=public as $$
declare cid uuid; m jsonb; expected integer; supplied integer; begin
 if p_day is null or jsonb_typeof(p_marks) is distinct from 'array' then raise exception 'Select a date and a complete class roster'; end if;
 supplied=jsonb_array_length(p_marks);
 if supplied=0 then raise exception 'Select attendance statuses'; end if;
 select class_id into cid from students where id=(p_marks->0->>'student_id')::uuid;
 perform 1 from classes where id=cid and active for update;
 if not found or not class_access(cid) then raise exception 'Not authorized for this active class'; end if;
 perform 1 from students where class_id=cid for update;
 select count(*) into expected from students where class_id=cid and active;
 if supplied<>expected or (select count(distinct x->>'student_id') from jsonb_array_elements(p_marks) x)<>expected then raise exception 'Submit every active student exactly once'; end if;
 for m in select * from jsonb_array_elements(p_marks) loop
  if not exists(select 1 from students where id=(m->>'student_id')::uuid and class_id=cid and active) then raise exception 'All students must belong to the selected active class'; end if;
  if m->>'status' is null or m->>'status' not in ('present','informed','uninformed') then raise exception 'Invalid attendance status'; end if;
 end loop;
 for m in select * from jsonb_array_elements(p_marks) loop
  insert into attendance(student_id,day,status) values((m->>'student_id')::uuid,p_day,m->>'status') on conflict(student_id,day) do update set status=excluded.status;
 end loop;
end$$;
revoke insert,update,delete on public.attendance from authenticated;
revoke all on function public.mark_attendance(date,jsonb) from public,anon;
grant execute on function public.mark_attendance(date,jsonb) to authenticated;
create function public.reconcile_approved_leave() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.status='approved' and old.status<>'approved' then
  update attendance set status='informed' where student_id=new.student_id and day between new.start_date and new.end_date and status<>'informed';
 end if;return new;
end$$;
create trigger reconcile_approved_leave after update on public.leaves for each row execute function public.reconcile_approved_leave();
create function public.final_leave_identity() returns trigger language plpgsql as $$begin
 if old.status<>'pending' and (new.start_date<>old.start_date or new.end_date<>old.end_date or new.kind<>old.kind or new.status<>old.status or new.reason<>old.reason or new.call_id is distinct from old.call_id) then raise exception 'Reviewed leave is final. Create a new request for a different date or decision'; end if;
 if new.status='approved' and old.status<>'approved' then
  perform 1 from students where id=new.student_id for update;
  if exists(select 1 from leaves where id<>new.id and student_id=new.student_id and status='approved' and start_date<=new.end_date and end_date>=new.start_date) then raise exception 'An approved leave already covers these dates'; end if;
 end if;
 return new;
end$$;
create trigger final_leave_identity before update on public.leaves for each row execute function public.final_leave_identity();
-- Retain reviewed evidence and attendance history.
revoke delete on public.leaves,public.call_records from authenticated;
drop policy evidence_delete on storage.objects;
create policy evidence_delete on storage.objects for delete to authenticated using(
 bucket_id in ('leave-letters','call-recordings') and student_manage(path_student(name))
 and not exists(select 1 from public.leaves where letter_path=name)
 and not exists(select 1 from public.call_records where recording_path=name)
);
create or replace function public.review_promotion(p_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$declare p promotions; c classes; begin
 select * into p from promotions where id=p_id for update;
 select * into c from classes where id=p.class_id for update;
 if p.id is null or not manages(c.department_id) or p.status<>'pending' or p.from_year<>c.year then raise exception 'Not authorized or request already processed'; end if;
 if p_approve then
  if c.year=c.course_years then update students set active=false,completed_at=now() where class_id=c.id; update classes set active=false,advisor_id=null where id=c.id;
  else update classes set year=year+1,promotion_due=(promotion_due+interval '1 year')::date where id=c.id; end if;
 end if;
 update promotions set status=case when p_approve then 'approved' else 'declined' end,reviewed_by=auth.uid() where id=p_id;
 if c.advisor_id is not null then insert into notifications(recipient_id,message) values(c.advisor_id,format('Year %s / %s progression %s',c.year,c.section,case when p_approve then 'approved' else 'declined' end)); end if;
end$$;
-- Data export uses the same RLS as screens; no privileged export endpoint.
revoke all on function public.reconcile_approved_leave(),public.final_leave_identity() from public,anon,authenticated;
