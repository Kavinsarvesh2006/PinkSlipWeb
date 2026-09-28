import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token=req.headers.get("Authorization")?.replace(/^Bearer /,"");
  if(!token)return json({error:"Authentication required"},401);
  const {data:{user},error}=await admin.auth.getUser(token);
  if(error||!user)return json({error:"Invalid session"},401);
  const {data:actor}=await admin.from("profiles").select().eq("id",user.id).single();
  const {department_id}=await req.json();
  if(!actor?.active||!["super_admin","hod"].includes(actor.role)||actor.role==="hod"&&actor.department_id!==department_id)return json({error:"Not authorized"},403);
  const calendars=JSON.parse(Deno.env.get("GOOGLE_CALENDAR_IDS")||"{}");
  const calendarId=calendars[department_id], key=Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if(!key||!calendarId)return json({error:"Configure GOOGLE_CALENDAR_API_KEY and GOOGLE_CALENDAR_IDS secrets first. API-key import supports public calendars."},409);
  let pageToken:string|undefined;const rows=[];
  do{
   const url=new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
   url.searchParams.set("key",key);url.searchParams.set("singleEvents","true");url.searchParams.set("maxResults","2500");
   url.searchParams.set("timeMin",new Date(Date.now()-30*86400000).toISOString());url.searchParams.set("timeMax",new Date(Date.now()+366*86400000).toISOString());
   if(pageToken)url.searchParams.set("pageToken",pageToken);
   const response=await fetch(url);if(!response.ok)return json({error:`Google Calendar returned ${response.status}. Verify calendar visibility and API key restrictions.`},502);
   const body=await response.json();
   for(const e of body.items||[]){if(e.status!=="cancelled")rows.push({id:`google:${department_id}:${e.id}`,department_id,title:e.summary||"College event",starts_at:e.start.dateTime||`${e.start.date}T00:00:00+05:30`,ends_at:e.end.dateTime||`${e.end.date}T00:00:00+05:30`,updated_at:new Date().toISOString()});}
   pageToken=body.nextPageToken;
  }while(pageToken);
  if(rows.length){const {error:saveError}=await admin.from("calendar_events").upsert(rows);if(saveError)throw saveError;}
  return json({imported:rows.length});
 }catch(error){return json({error:error instanceof Error?error.message:"Calendar import failed"},400);}
});
