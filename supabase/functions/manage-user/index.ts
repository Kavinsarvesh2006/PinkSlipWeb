import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({error: "Method not allowed"}, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!token) return json({error:"Authentication required"},401);
    const {data:{user},error:authError} = await admin.auth.getUser(token);
    if (authError || !user) return json({error:"Invalid session"},401);
    const {data:actor} = await admin.from("profiles").select().eq("id",user.id).single();
    if (!actor?.active || !["super_admin","hod"].includes(actor.role)) return json({error:"Not authorized"},403);
    const input = await req.json();
    if (!["super_admin","hod","advisor","student"].includes(input.role) || !input.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email || "")) return json({error:"Valid name, email and role required"},400);
    if (actor.role === "hod" && (input.department_id !== actor.department_id || !["advisor","student"].includes(input.role))) return json({error:"HOD can manage advisors and students only within their department"},403);
    if(input.role !== "super_admin" || input.department_id) {
      const {data:dept,error:deptError} = await admin.from("departments").select("id").eq("id",input.department_id).maybeSingle();
      if (deptError || !dept) return json({error:"Select a valid department"},400);
    }
    const profile = {name:input.name.trim(),email:input.email.trim().toLowerCase(),role:input.role,department_id:input.department_id || null,active:input.active !== false};
    if (input.id) {
      const {data:target} = await admin.from("profiles").select().eq("id",input.id).single();
      if (!target || actor.role === "hod" && (target.department_id !== actor.department_id || !["advisor","student"].includes(target.role))) return json({error:"Not authorized"},403);
      if (input.id === user.id && (!profile.active || profile.role !== actor.role)) return json({error:"You cannot disable or demote your own account"},400);
      const {data:assigned,error:assignmentError} = await admin.from("classes").select("id").eq("advisor_id",input.id).limit(1);
      const {data:linked,error:linkError} = await admin.from("students").select("id").eq("user_id",input.id).limit(1);
      if(assignmentError || linkError) throw assignmentError || linkError;
      if ((assigned?.length || linked?.length) && (profile.role !== target.role || profile.department_id !== target.department_id || !profile.active)) return json({error:"Remove assignments or student login links before changing role, department or disabling the account"},400);
      if (profile.email !== target.email) return json({error:"Existing account email changes require verified ownership through Supabase Auth"},400);
      const {error} = await admin.from("profiles").update(profile).eq("id",input.id);
      if (error) throw error;
      return json({id:input.id});
    }
    if (typeof input.password !== "string" || input.password.length < 12) return json({error:"Temporary password must contain at least 12 characters"},400);
    const {data:created,error} = await admin.auth.admin.createUser({email:profile.email,password:input.password,email_confirm:true});
    if (error || !created.user) return json({error:error?.message || "Account creation failed"},400);
    const {error:profileError} = await admin.from("profiles").insert({id:created.user.id,...profile});
    if (profileError) { await admin.auth.admin.deleteUser(created.user.id); throw profileError; }
    return json({id:created.user.id});
  } catch (error) { return json({error:error instanceof Error ? error.message : "Account operation failed"},400); }
});
