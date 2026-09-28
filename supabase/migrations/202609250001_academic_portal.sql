-- Academic portal. All timestamps use UTC; attendance days use Asia/Kolkata.
create extension if not exists pgcrypto;
create table public.departments (id uuid primary key default gen_random_uuid(), name text not null unique, code text not null unique);
create table public.profiles (id uuid primary key references auth.users on delete cascade, name text not null, email text not null, role text not null check(role in ('super_admin','hod','advisor','student')), department_id uuid references public.departments, active boolean not null default true, check(role='super_admin' or department_id is not null));
create table public.classes (id uuid primary key default gen_random_uuid(), department_id uuid not null references public.departments, year integer not null check(year between 1 and 4), section text not null, batch integer not null, advisor_id uuid unique references public.profiles, active boolean not null default true, promotion_due date not null, unique(department_id,batch,section));
create table public.students (id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes, user_id uuid unique references public.profiles, name text not null, register_number text not null unique, phone text not null default '', parent_name text not null default '', parent_phone text not null default '', email text not null default '', degree text not null default 'B.Tech', active boolean not null default true, completed_at timestamptz, created_at timestamptz not null default now());
create table public.attendance (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students, day date not null, status text not null check(status in ('present','informed','uninformed')), marked_by uuid not null default auth.uid() references public.profiles, updated_at timestamptz not null default now(), unique(student_id,day));
create table public.call_records (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students, advisor_id uuid not null default auth.uid() references public.profiles, recording_path text not null, parent_response text not null check(length(trim(parent_response))>0), consent_confirmed boolean not null check(consent_confirmed), created_at timestamptz not null default now());
create table public.leaves (id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students, start_date date not null, end_date date not null, kind text not null check(kind in ('informed','uninformed')), reason text not null, letter_path text, call_id uuid references public.call_records, status text not null default 'pending' check(status in ('pending','approved','declined')), decision_note text not null default '', created_by uuid not null default auth.uid() references public.profiles, reviewed_by uuid references public.profiles, reviewed_at timestamptz, created_at timestamptz not null default now(), check(end_date>=start_date));
create table public.promotions (id uuid primary key default gen_random_uuid(), class_id uuid not null references public.classes, from_year integer not null check(from_year between 1 and 4), status text not null default 'pending' check(status in ('pending','approved','declined')), requested_by uuid references public.profiles default auth.uid(), reviewed_by uuid references public.profiles, created_at timestamptz not null default now());
create unique index one_pending_promotion on public.promotions(class_id) where status='pending';
create table public.notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles on delete cascade, message text not null, student_id uuid references public.students, read_at timestamptz, created_at timestamptz not null default now());
create table public.audit_logs (id bigint generated always as identity primary key, actor uuid, entity text not null, record_id text, operation text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now());
create table public.calendar_events (id text primary key, department_id uuid not null references public.departments, title text not null, starts_at timestamptz not null, ends_at timestamptz not null, updated_at timestamptz not null default now());
create index attendance_student_day on public.attendance(student_id,day);
create index students_name_search on public.students(lower(name));
create index notifications_recipient on public.notifications(recipient_id,created_at desc);
create index leaves_student on public.leaves(student_id,start_date);
create function public.my_role() returns text language sql stable security definer set search_path=public as $$select role from profiles where id=auth.uid() and active$$;
create function public.manages(d uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and active and (role='super_admin' or (role='hod' and department_id=d)))$$;
create function public.class_access(c uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from classes where id=c and (manages(department_id) or (active and advisor_id=auth.uid() and my_role()='advisor')))$$;
create function public.student_access(s uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from students x join classes c on c.id=x.class_id where x.id=s and (manages(c.department_id) or (x.active and c.active and (c.advisor_id=auth.uid() and my_role()='advisor' or x.user_id=auth.uid()))))$$;
create function public.student_manage(s uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from students x join classes c on c.id=x.class_id where x.id=s and manages(c.department_id))$$;
create function public.student_staff(s uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from students where id=s and class_access(class_id) and (active or student_manage(s)))$$;
do $$declare t text; begin foreach t in array array['departments','profiles','classes','students','attendance','call_records','leaves','promotions','notifications','audit_logs','calendar_events'] loop execute format('alter table public.%I enable row level security',t); end loop; end$$;
create policy departments_read on public.departments for select to authenticated using (manages(id) or id=(select department_id from profiles where id=auth.uid()));
create policy departments_write on public.departments for all to authenticated using(my_role()='super_admin') with check(my_role()='super_admin');
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or manages(department_id));
-- User creation/role edits go through the validated Edge Function; clients cannot self-promote.
create policy classes_read on public.classes for select to authenticated using(class_access(id) or exists(select 1 from students where class_id=classes.id and user_id=auth.uid() and active));
create policy classes_write on public.classes for all to authenticated using(manages(department_id)) with check(manages(department_id));
create policy students_read on public.students for select to authenticated using(student_access(id));
create policy students_write on public.students for all to authenticated using(exists(select 1 from classes where id=class_id and manages(department_id))) with check(exists(select 1 from classes where id=class_id and manages(department_id)));
create policy attendance_read on public.attendance for select to authenticated using(student_access(student_id));
create policy attendance_insert on public.attendance for insert to authenticated with check(student_staff(student_id));
create policy attendance_update on public.attendance for update to authenticated using(student_staff(student_id)) with check(student_staff(student_id));
create policy attendance_delete on public.attendance for delete to authenticated using(student_manage(student_id));
create policy calls_read on public.call_records for select to authenticated using(student_manage(student_id));
create policy calls_delete on public.call_records for delete to authenticated using(student_manage(student_id));
create policy leaves_read on public.leaves for select to authenticated using(student_access(student_id));
create policy leaves_insert on public.leaves for insert to authenticated with check(student_access(student_id));
create policy leaves_update on public.leaves for update to authenticated using(student_access(student_id)) with check(student_access(student_id));
create policy leaves_delete on public.leaves for delete to authenticated using(student_manage(student_id));
create policy promotions_read on public.promotions for select to authenticated using(class_access(class_id));
create policy notifications_read on public.notifications for select to authenticated using(recipient_id=auth.uid());
create policy notifications_update on public.notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
create policy audit_read on public.audit_logs for select to authenticated using(my_role()='super_admin');
create policy calendar_read on public.calendar_events for select to authenticated using(manages(department_id) or department_id=(select department_id from profiles where id=auth.uid()));
create policy calendar_write on public.calendar_events for all to authenticated using(manages(department_id)) with check(manages(department_id));
create function public.validate_class() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.advisor_id is not null and not exists(select 1 from profiles where id=new.advisor_id and role='advisor' and active and department_id=new.department_id) then raise exception 'Advisor must be active and belong to this department'; end if;
 if TG_OP='UPDATE' and new.department_id<>old.department_id then raise exception 'Create a new class to change departments'; end if;
 return new; end$$;
create trigger validate_class before insert or update on public.classes for each row execute function public.validate_class();
create function public.guard_attendance() returns trigger language plpgsql security definer set search_path=public as $$begin
 if TG_OP='UPDATE' and (new.student_id<>old.student_id or new.day<>old.day) then raise exception 'Attendance identity cannot change'; end if;
 if not student_manage(new.student_id) then
  if not student_staff(new.student_id) or new.day<>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Advisors can mark only their assigned class on the current college date'; end if;
  if TG_OP='UPDATE' then raise exception 'Only HOD or Super Admin can correct saved attendance'; end if;
 end if;
 new.marked_by=auth.uid(); new.updated_at=now(); return new; end$$;
create trigger guard_attendance before insert or update on public.attendance for each row execute function public.guard_attendance();
create function public.alert_attendance() returns trigger language plpgsql security definer set search_path=public as $$declare rate numeric; info record; begin
 select 100.0*count(*) filter(where status='present')/nullif(count(*),0) into rate from attendance where student_id=new.student_id;
 if rate<75 then
 select s.name,s.register_number,c.year,c.section,c.department_id into info from students s join classes c on c.id=s.class_id where s.id=new.student_id;
 insert into notifications(recipient_id,student_id,message) select id,new.student_id,format('%s (%s), Year %s / %s: attendance %s%%, below 75%%.',info.name,info.register_number,info.year,info.section,round(rate,1)) from profiles p where active and (role='super_admin' or role='hod' and department_id=info.department_id) and not exists(select 1 from notifications n where n.recipient_id=p.id and n.student_id=new.student_id and n.created_at::date=now()::date and n.message like '%below 75%');
 end if; return new; end$$;
create trigger alert_attendance after insert or update on public.attendance for each row execute function public.alert_attendance();
create function public.save_call(p_student uuid,p_path text,p_response text,p_consent boolean) returns uuid language plpgsql security definer set search_path=public as $$declare result uuid; begin
 if not student_staff(p_student) then raise exception 'Not authorized'; end if;
 if split_part(p_path,'/',1)<>p_student::text or not exists(select 1 from storage.objects where bucket_id='call-recordings' and name=p_path and (owner_id=auth.uid()::text or student_manage(p_student))) then raise exception 'Upload the recording first'; end if;
 insert into call_records(student_id,recording_path,parent_response,consent_confirmed) values(p_student,p_path,p_response,p_consent) returning id into result; return result; end$$;
create function public.guard_leave() returns trigger language plpgsql security definer set search_path=public as $$declare response text; begin
 if not student_access(new.student_id) then raise exception 'Not authorized'; end if;
 if TG_OP='INSERT' then
 new.created_by=auth.uid(); new.status='pending'; new.reviewed_by=null; new.reviewed_at=null; new.decision_note='';
 elsif new.student_id<>old.student_id or new.created_by<>old.created_by then raise exception 'Leave identity cannot change';
 elsif not student_manage(new.student_id) and (old.status<>'pending' or new.status<>old.status or new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at or new.decision_note<>old.decision_note or not (student_staff(new.student_id) or old.created_by=auth.uid())) then raise exception 'Only HOD or Super Admin can review this slip';
 end if;
 if new.kind='informed' and new.letter_path is null then raise exception 'Informed leave requires an approval letter'; end if;
 if new.letter_path is not null and (split_part(new.letter_path,'/',1)<>new.student_id::text or not exists(select 1 from storage.objects where bucket_id='leave-letters' and name=new.letter_path)) then raise exception 'Invalid letter upload'; end if;
 if new.kind='uninformed' then
 select parent_response into response from call_records where id=new.call_id and student_id=new.student_id;
 if response is null then raise exception 'Uninformed leave requires a recorded parent conversation'; end if;
 new.reason=response;
 end if;
 if length(trim(new.reason))=0 then raise exception 'Reason is required'; end if;
 if TG_OP='UPDATE' and new.status<>old.status then
 if not student_manage(new.student_id) then raise exception 'Not authorized'; end if;
 new.reviewed_by=auth.uid(); new.reviewed_at=now();
 insert into notifications(recipient_id,student_id,message) select distinct recipient,new.student_id,format('Pink slip %s for %s. %s',new.status,s.name,new.decision_note) from students s join classes c on c.id=s.class_id cross join lateral (values(c.advisor_id),(s.user_id),(new.created_by)) x(recipient) where s.id=new.student_id and recipient is not null;
 end if; return new; end$$;
create trigger guard_leave before insert or update on public.leaves for each row execute function public.guard_leave();
create function public.notify_leave() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into notifications(recipient_id,student_id,message) select p.id,new.student_id,'Pink slip awaiting review: '||s.name||' ('||s.register_number||')' from students s join classes c on c.id=s.class_id join profiles p on p.active and (p.role='super_admin' or p.role='hod' and p.department_id=c.department_id) where s.id=new.student_id; return new; end$$;
create trigger notify_leave after insert on public.leaves for each row execute function public.notify_leave();
create function public.request_promotion(p_class uuid) returns uuid language plpgsql security definer set search_path=public as $$declare c classes; result uuid; begin
 select * into c from classes where id=p_class and active for update;
 if c.id is null or not class_access(c.id) then raise exception 'Not authorized'; end if;
 if c.promotion_due>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Promotion is not due yet'; end if;
 insert into promotions(class_id,from_year) values(c.id,c.year) returning id into result;
 insert into notifications(recipient_id,message) select id,format('Approval required: batch %s, Year %s / %s %s',c.batch,c.year,c.section,case when c.year=4 then 'course completion' else 'annual promotion' end) from profiles where active and (role='super_admin' or role='hod' and department_id=c.department_id); return result; end$$;
create function public.review_promotion(p_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$declare p promotions; c classes; begin
 select * into p from promotions where id=p_id for update;
 select * into c from classes where id=p.class_id for update;
 if p.id is null or not manages(c.department_id) or p.status<>'pending' or p.from_year<>c.year then raise exception 'Not authorized or request already processed'; end if;
 if p_approve then
  if c.year=4 then update students set active=false,completed_at=now() where class_id=c.id; update classes set active=false,advisor_id=null where id=c.id;
  else update classes set year=year+1,promotion_due=(promotion_due+interval '1 year')::date where id=c.id; end if;
 end if;
 update promotions set status=case when p_approve then 'approved' else 'declined' end,reviewed_by=auth.uid() where id=p_id;
 if c.advisor_id is not null then insert into notifications(recipient_id,message) values(c.advisor_id,format('Year %s / %s promotion or completion %s',c.year,c.section,case when p_approve then 'approved' else 'declined' end)); end if;
 end$$;
create function public.queue_due_promotions() returns void language plpgsql security definer set search_path=public as $$declare c classes; begin
 for c in select * from classes where active and promotion_due<=(now() at time zone 'Asia/Kolkata')::date and not exists(select 1 from promotions where class_id=classes.id and (status='pending' or from_year=classes.year and status='declined' and created_at>now()-interval '30 days')) loop
 insert into promotions(class_id,from_year,requested_by) values(c.id,c.year,null) on conflict do nothing;
 insert into notifications(recipient_id,message) select id,format('Annual approval due: batch %s, Year %s / %s',c.batch,c.year,c.section) from profiles where active and (role='super_admin' or role='hod' and department_id=c.department_id);
 end loop; end$$;
create function public.audit_change() returns trigger language plpgsql security definer set search_path=public as $$begin insert into audit_logs(actor,entity,record_id,operation,before_data,after_data) values(auth.uid(),TG_TABLE_NAME,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id'),TG_OP,to_jsonb(old),to_jsonb(new)); return coalesce(new,old); end$$;
do $$declare t text; begin foreach t in array array['departments','profiles','classes','students','attendance','leaves','promotions','call_records','calendar_events'] loop execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function public.audit_change()',t); end loop; end$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('leave-letters','leave-letters',false,10485760,array['application/pdf','image/jpeg','image/png']),('call-recordings','call-recordings',false,52428800,array['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/webm','audio/ogg','audio/aac']);
create function public.path_student(path text) returns uuid language plpgsql immutable as $$begin return split_part(path,'/',1)::uuid; exception when invalid_text_representation then return null; end$$;
create policy letters_read on storage.objects for select to authenticated using(bucket_id='leave-letters' and student_access(path_student(name)));
create policy letters_upload on storage.objects for insert to authenticated with check(bucket_id='leave-letters' and student_access(path_student(name)));
create policy recordings_read on storage.objects for select to authenticated using(bucket_id='call-recordings' and student_manage(path_student(name)));
create policy recordings_upload on storage.objects for insert to authenticated with check(bucket_id='call-recordings' and student_staff(path_student(name)));
create policy evidence_delete on storage.objects for delete to authenticated using(bucket_id in ('leave-letters','call-recordings') and student_manage(path_student(name)));
-- Limit exposed functions; queue_due_promotions is scheduler/service-role only.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_role(),public.manages(uuid),public.class_access(uuid),public.student_access(uuid),public.student_manage(uuid),public.student_staff(uuid),public.path_student(text),public.save_call(uuid,text,text,boolean),public.request_promotion(uuid),public.review_promotion(uuid,boolean) to authenticated;
revoke execute on function public.queue_due_promotions() from authenticated;
grant execute on function public.queue_due_promotions() to service_role;
grant select,insert,update,delete on public.departments,public.classes,public.students,public.attendance,public.leaves,public.calendar_events to authenticated;
grant select on public.profiles,public.call_records,public.promotions,public.notifications,public.audit_logs to authenticated;
revoke update on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;
grant delete on public.call_records to authenticated;
alter publication supabase_realtime add table public.attendance,public.leaves,public.notifications,public.students,public.classes,public.promotions;
-- Departments are created by the Super Admin.

