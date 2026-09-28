create function public.mark_attendance(p_day date,p_marks jsonb) returns void language plpgsql security invoker set search_path=public as $$declare m jsonb; begin
 if jsonb_typeof(p_marks)<>'array' or jsonb_array_length(p_marks)=0 then raise exception 'Select attendance statuses'; end if;
 for m in select * from jsonb_array_elements(p_marks) loop
 insert into attendance(student_id,day,status) values((m->>'student_id')::uuid,p_day,m->>'status') on conflict(student_id,day) do update set status=excluded.status;
 end loop;
end$$;
revoke all on function public.mark_attendance(date,jsonb) from public,anon;
grant execute on function public.mark_attendance(date,jsonb) to authenticated;
create function public.validate_student() returns trigger language plpgsql security definer set search_path=public as $$declare dept uuid; begin
 select department_id into dept from classes where id=new.class_id;
 if new.user_id is not null and not exists(select 1 from profiles where id=new.user_id and role='student' and department_id=dept) then raise exception 'Student login must belong to the same department'; end if;
 if TG_OP='UPDATE' and new.class_id<>old.class_id and not student_manage(old.id) then raise exception 'Not authorized to transfer student'; end if;
 return new;
end$$;
create trigger validate_student before insert or update on public.students for each row execute function public.validate_student();
revoke all on function public.validate_student() from public,anon,authenticated;
alter table public.calendar_events add constraint valid_event_dates check(ends_at>starts_at);
