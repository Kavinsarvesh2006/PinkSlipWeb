-- Enforce account/class relationships and evidence rules independently of client UI.
create or replace function public.validate_student() returns trigger language plpgsql security definer set search_path=public as $$declare dept uuid; begin
 select department_id into dept from classes where id=new.class_id and active;
 if dept is null and (TG_OP='INSERT' or new.class_id<>old.class_id) then raise exception 'Choose an active class'; end if;
 if new.user_id is not null and not exists(select 1 from profiles where id=new.user_id and role='student' and active and department_id=(select department_id from classes where id=new.class_id)) then raise exception 'Student login must be active and belong to the same department'; end if;
 if TG_OP='UPDATE' and new.class_id<>old.class_id and not student_manage(old.id) then raise exception 'Not authorized to transfer student'; end if;
 return new;
end$$;
create function public.guard_profile_links() returns trigger language plpgsql security definer set search_path=public as $$begin
 if (new.role<>old.role or new.department_id is distinct from old.department_id or not new.active) and
 (exists(select 1 from classes where advisor_id=old.id) or exists(select 1 from students where user_id=old.id)) then
 raise exception 'Remove assignments before changing role, department or disabling this account'; end if;
 return new;
end$$;
create trigger guard_profile_links before update on public.profiles for each row execute function public.guard_profile_links();
create function public.guard_call_leave() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.kind='uninformed' and (TG_OP='INSERT' or new.call_id is distinct from old.call_id) and not student_staff(new.student_id) then raise exception 'Only assigned staff can create an uninformed parent-call slip'; end if;
 return new;
end$$;
create trigger guard_call_leave before insert or update on public.leaves for each row execute function public.guard_call_leave();
revoke all on function public.guard_profile_links(),public.guard_call_leave() from public,anon,authenticated;
