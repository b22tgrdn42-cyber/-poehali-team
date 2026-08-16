const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.APP_SECRET || 'CHANGE_ME_IN_VERCEL';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
if(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY){
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://komanda-poehali.vercel.app',VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
}
async function sendPushToEmployee(employeeId,payload){
  const result={configured:!!(VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY),subscriptions:0,sent:0,failed:0,errors:[]};
  if(!result.configured)return result;
  const subs=await sql`SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE employee_id=${employeeId}`;
  result.subscriptions=subs.length;
  for(const s of subs){
    try{
      await webpush.sendNotification(
        {endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
        JSON.stringify(payload),
        {TTL:3600,urgency:'high'}
      );
      result.sent++;
    }catch(e){
      result.failed++;
      result.errors.push(String(e.statusCode||'')+': '+String(e.body||e.message||'push error').slice(0,240));
      if(e.statusCode===404||e.statusCode===410){
        await sql`DELETE FROM push_subscriptions WHERE endpoint=${s.endpoint}`;
      }
      console.error('push error',e.statusCode,e.body||e.message);
    }
  }
  return result;
}
async function broadcastPush(payload){
  const users=await sql`SELECT id FROM employees WHERE active=true`;
  const summary={
    configured:!!(VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY),
    recipients:users.length,
    subscriptions:0,
    sent:0,
    failed:0,
    errors:[]
  };
  for(const u of users){
    const r=await sendPushToEmployee(u.id,payload);
    summary.subscriptions+=r.subscriptions||0;
    summary.sent+=r.sent||0;
    summary.failed+=r.failed||0;
    if(r.errors?.length)summary.errors.push(...r.errors.slice(0,2));
  }
  return summary;
}


async function init(){
 await sql`CREATE TABLE IF NOT EXISTS settings (id int primary key default 1, manager_pin_hash text not null, season text default 'Сезон команды', level_step int default 100)`;
 await sql`CREATE TABLE IF NOT EXISTS employees (id serial primary key, name text not null, position text default '', pin_hash text not null, points int default 0, active boolean default true, photo text, created_at timestamptz default now())`;
 await sql`CREATE TABLE IF NOT EXISTS tasks (id serial primary key, title text not null, description text default '', points int default 10, active boolean default true, created_at timestamptz default now())`;
 await sql`CREATE TABLE IF NOT EXISTS prizes (id serial primary key, title text not null, description text default '', cost int default 100, active boolean default true, created_at timestamptz default now())`;
 await sql`CREATE TABLE IF NOT EXISTS achievements (id serial primary key, title text not null, description text default '', icon text default '★')`;
 await sql`CREATE TABLE IF NOT EXISTS employee_achievements (employee_id int references employees(id) on delete cascade, achievement_id int references achievements(id) on delete cascade, created_at timestamptz default now(), primary key(employee_id,achievement_id))`;
 await sql`CREATE TABLE IF NOT EXISTS history (id serial primary key, employee_id int references employees(id) on delete cascade, delta int not null, reason text default '', created_at timestamptz default now())`;
 await sql`CREATE TABLE IF NOT EXISTS news (id serial primary key, title text not null, body text default '', category text default 'Важно', image text, event_date date, pinned boolean default false, requires_ack boolean default false, active boolean default true, created_at timestamptz default now())`;
 await sql`CREATE TABLE IF NOT EXISTS news_reads (news_id int references news(id) on delete cascade, employee_id int references employees(id) on delete cascade, read_at timestamptz default now(), primary key(news_id,employee_id))`;
 await sql`CREATE TABLE IF NOT EXISTS competitions (id serial primary key, title text not null, description text default '', starts_on date, ends_on date, active boolean default true, created_at timestamptz default now())`;
 await sql`CREATE TABLE IF NOT EXISTS competition_tasks (id serial primary key, competition_id int references competitions(id) on delete cascade, title text not null, description text default '', points int default 10, active boolean default true)`;
 await sql`CREATE TABLE IF NOT EXISTS competition_scores (id serial primary key, competition_id int references competitions(id) on delete cascade, employee_id int references employees(id) on delete cascade, task_id int references competition_tasks(id) on delete set null, points int not null, reason text default '', created_at timestamptz default now())`;

 await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS access_role text DEFAULT 'employee'`;
 await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_member boolean DEFAULT true`;
 await sql`CREATE TABLE IF NOT EXISTS individual_tasks (
   id serial primary key,
   employee_id int references employees(id) on delete cascade,
   title text not null,
   description text default '',
   points int default 10,
   due_date date,
   status text default 'assigned',
   employee_comment text default '',
   created_at timestamptz default now(),
   submitted_at timestamptz,
   completed_at timestamptz
 )`;
 await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
   id serial primary key,
   employee_id int references employees(id) on delete cascade,
   endpoint text unique not null,
   p256dh text not null,
   auth text not null,
   created_at timestamptz default now()
 )`;

 await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS messenger_access boolean DEFAULT false`;
 await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_seen timestamptz`;
 await sql`CREATE TABLE IF NOT EXISTS chats (
   id serial primary key,
   type text not null default 'direct',
   title text default '',
   created_by int references employees(id) on delete set null,
   created_at timestamptz default now()
 )`;
 await sql`CREATE TABLE IF NOT EXISTS chat_members (
   chat_id int references chats(id) on delete cascade,
   employee_id int references employees(id) on delete cascade,
   joined_at timestamptz default now(),
   last_read_at timestamptz default now(),
   primary key(chat_id,employee_id)
 )`;
 await sql`CREATE TABLE IF NOT EXISTS messages (
   id serial primary key,
   chat_id int references chats(id) on delete cascade,
   sender_id int references employees(id) on delete set null,
   body text default '',
   image text,
   reply_to int references messages(id) on delete set null,
   edited_at timestamptz,
   deleted boolean default false,
   created_at timestamptz default now()
 )`;
 await sql`CREATE TABLE IF NOT EXISTS message_reactions (
   message_id int references messages(id) on delete cascade,
   employee_id int references employees(id) on delete cascade,
   reaction text not null,
   created_at timestamptz default now(),
   primary key(message_id,employee_id,reaction)
 )`;
 await sql`CREATE TABLE IF NOT EXISTS chat_typing (
   chat_id int references chats(id) on delete cascade,
   employee_id int references employees(id) on delete cascade,
   touched_at timestamptz default now(),
   primary key(chat_id,employee_id)
 )`;

 await sql`CREATE TABLE IF NOT EXISTS ui_texts (
   key text primary key,
   value text not null,
   updated_at timestamptz default now()
 )`;

 await sql`CREATE TABLE IF NOT EXISTS ui_replacements (
   source_text text primary key,
   replacement_text text not null,
   updated_at timestamptz default now()
 )`;

 await sql`CREATE TABLE IF NOT EXISTS ui_blocks (
   block_key text primary key,
   hidden boolean default false,
   updated_at timestamptz default now()
 )`;

 await sql`CREATE TABLE IF NOT EXISTS ui_removed_elements (
   id serial primary key,
   element_type text not null,
   match_text text not null,
   active boolean default true,
   created_at timestamptz default now()
 )`;
 const cc=await sql`SELECT id FROM competitions LIMIT 1`;
 if(!cc.length){const c=await sql`INSERT INTO competitions(title,description,active) VALUES('Гонка экипажей','Выполняйте задания, зарабатывайте баллы и поднимайтесь в рейтинге команды.',true) RETURNING id`; const cid=c[0].id;
 await sql`INSERT INTO competition_tasks(competition_id,title,description,points) VALUES
 (${cid},'Допродажа дня','Продайте позицию, выбранную управляющим для задания дня.',5),
 (${cid},'Отзыв гостя','Получите положительный отзыв гостя с упоминанием сотрудника.',20),
 (${cid},'Знание меню','Пройдите мини-проверку меню без ошибок.',15),
 (${cid},'Командная помощь','Помогите коллеге в сложной ситуации; подтверждает управляющий.',10),
 (${cid},'Идеальная смена','Смена без замечаний управляющего.',15),
 (${cid},'Идея в дело','Предложение сотрудника было внедрено.',30)`; }
 const s=await sql`SELECT id FROM settings WHERE id=1`;
 if(!s.length){ const h=await bcrypt.hash('2026',10); await sql`INSERT INTO settings(id,manager_pin_hash) VALUES(1,${h})`; }
}
function token(payload){return jwt.sign(payload,SECRET,{expiresIn:'30d'});} 
function auth(req){try{const h=req.headers.authorization||'';return jwt.verify(h.replace('Bearer ',''),SECRET)}catch{return null}}
function ok(res,data,status=200){res.status(status).json(data)}
async function body(req){return req.body||{}}

async function messengerAllowed(employeeId){
  const r=await sql`SELECT active,messenger_access FROM employees WHERE id=${employeeId}`;
  return !!(r.length&&r[0].active&&r[0].messenger_access);
}
async function isChatMember(chatId,employeeId){
  const r=await sql`SELECT 1 FROM chat_members WHERE chat_id=${chatId} AND employee_id=${employeeId}`;
  return !!r.length;
}
async function messagePush(chatId,senderId,messageId,body){
  const sender=(await sql`SELECT name FROM employees WHERE id=${senderId}`)[0];
  const members=await sql`SELECT employee_id FROM chat_members WHERE chat_id=${chatId} AND employee_id<>${senderId}`;
  for(const m of members){
    if(await messengerAllowed(m.employee_id)){
      await sendPushToEmployee(m.employee_id,{
        title:'💬 '+(sender?.name||'Новое сообщение'),
        body:(body||'Фото').slice(0,120),
        url:'/?open=messenger&chat='+chatId,
        tag:'message-'+messageId
      });
    }
  }
}
module.exports=async(req,res)=>{
 try{
  await init(); const path=(req.query.path||'').toString(); const u=auth(req);
  if(req.method==='GET'&&path==='public/employees'){return ok(res,await sql`SELECT id,name,position,photo,access_role,team_member,messenger_access,last_seen FROM employees WHERE active=true ORDER BY name`)}
  if(req.method==='POST'&&path==='login/employee'){const b=await body(req); const rows=await sql`SELECT * FROM employees WHERE id=${b.id} AND active=true`; if(!rows.length||!(await bcrypt.compare(String(b.pin||''),rows[0].pin_hash))) return ok(res,{error:'Неверный PIN'},401); return ok(res,{token:token({role:(rows[0].access_role==='supervisor'?'supervisor':'employee'),id:rows[0].id}),access_role:rows[0].access_role||'employee'})}
  if(req.method==='POST'&&path==='login/manager'){const b=await body(req); const s=(await sql`SELECT manager_pin_hash FROM settings WHERE id=1`)[0]; if(!(await bcrypt.compare(String(b.pin||''),s.manager_pin_hash))) return ok(res,{error:'Неверный PIN'},401); return ok(res,{token:token({role:'manager'})})}
  if(req.method==='GET'&&path==='push/key'){return ok(res,{publicKey:VAPID_PUBLIC_KEY})}
  if(req.method==='GET'&&path==='content'){
    const rows=await sql`SELECT key,value FROM ui_texts ORDER BY key`;
    return ok(res,Object.fromEntries(rows.map(x=>[x.key,x.value])))
  }
  if(req.method==='GET'&&path==='content/replacements'){
    const rows=await sql`SELECT source_text,replacement_text FROM ui_replacements ORDER BY source_text`;
    return ok(res,rows)
  }
  if(req.method==='GET'&&path==='content/blocks'){
    const rows=await sql`SELECT block_key,hidden FROM ui_blocks ORDER BY block_key`;
    return ok(res,Object.fromEntries(rows.map(x=>[x.block_key,x.hidden])))
  }
  if(req.method==='GET'&&path==='content/removed-elements'){
    return ok(res,await sql`SELECT id,element_type,match_text FROM ui_removed_elements WHERE active=true ORDER BY id`)
  }
  if(!u) return ok(res,{error:'Требуется вход'},401);
  const b=await body(req);

  if(req.method==='POST'&&path==='push/subscribe'&&(u.role==='employee'||u.role==='supervisor')){
    const b=await body(req),s=b.subscription||{};
    if(!s.endpoint||!s.keys?.p256dh||!s.keys?.auth)return ok(res,{error:'Некорректная подписка'},400);
    await sql`INSERT INTO push_subscriptions(employee_id,endpoint,p256dh,auth)
      VALUES(${u.id},${s.endpoint},${s.keys.p256dh},${s.keys.auth})
      ON CONFLICT(endpoint) DO UPDATE SET employee_id=${u.id},p256dh=${s.keys.p256dh},auth=${s.keys.auth}`;
    return ok(res,{ok:true})
  }
  if(req.method==='POST'&&path==='push/unsubscribe'&&(u.role==='employee'||u.role==='supervisor')){
    const b=await body(req); if(b.endpoint)await sql`DELETE FROM push_subscriptions WHERE endpoint=${b.endpoint}`; return ok(res,{ok:true})
  }

  if(req.method==='GET'&&path==='push/status'&&(u.role==='employee'||u.role==='supervisor')){
    const rows=await sql`SELECT count(*)::int count FROM push_subscriptions WHERE employee_id=${u.id}`;
    return ok(res,{configured:!!(VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY),subscriptions:rows[0]?.count||0})
  }
  if(req.method==='POST'&&path==='push/test'&&(u.role==='employee'||u.role==='supervisor')){
    const result=await sendPushToEmployee(u.id,{
      title:'Тест уведомлений 🚀',
      body:'Если вы видите это сообщение — push-уведомления работают.',
      url:'/',
      tag:'push-test'
    });
    return ok(res,result)
  }


  if(req.method==='POST'&&path==='individual-task/submit'&&(u.role==='employee'||u.role==='supervisor')){
    const b=await body(req);
    await sql`UPDATE individual_tasks SET status='submitted',employee_comment=${b.comment||''},submitted_at=now() WHERE id=${b.id} AND employee_id=${u.id} AND status='assigned'`;
    return ok(res,{ok:true})
  }


  if((u.role==='employee'||u.role==='supervisor') && u.id){
    await sql`UPDATE employees SET last_seen=now() WHERE id=${u.id}`;
  }

  if(req.method==='GET'&&path==='messenger/state'&&(u.role==='employee'||u.role==='supervisor')){
    if(!(await messengerAllowed(u.id)))return ok(res,{error:'Доступ к мессенджеру не предоставлен'},403);
    const people=await sql`SELECT id,name,position,photo,last_seen FROM employees WHERE active=true AND messenger_access=true AND id<>${u.id} ORDER BY name`;
    const chats=await sql`
      SELECT c.id,c.type,c.title,c.created_at,
        COALESCE((SELECT m.body FROM messages m WHERE m.chat_id=c.id AND m.deleted=false ORDER BY m.id DESC LIMIT 1),'') last_message,
        (SELECT m.created_at FROM messages m WHERE m.chat_id=c.id ORDER BY m.id DESC LIMIT 1) last_message_at,
        (SELECT count(*)::int FROM messages m WHERE m.chat_id=c.id AND m.created_at>cm.last_read_at AND m.sender_id<>${u.id}) unread
      FROM chats c JOIN chat_members cm ON cm.chat_id=c.id
      WHERE cm.employee_id=${u.id}
      ORDER BY COALESCE((SELECT max(m.created_at) FROM messages m WHERE m.chat_id=c.id),c.created_at) DESC`;
    for(const c of chats){
      const members=await sql`SELECT e.id,e.name,e.position,e.photo,e.last_seen FROM employees e JOIN chat_members cm ON cm.employee_id=e.id WHERE cm.chat_id=${c.id} ORDER BY e.name`;
      c.members=members;
      if(c.type==='direct'){
        const other=members.find(x=>x.id!==u.id);
        c.display_title=other?.name||'Личный чат'; c.photo=other?.photo||null;
      }else c.display_title=c.title||'Группа';
    }
    return ok(res,{people,chats})
  }

  if(req.method==='POST'&&path==='messenger/direct'&&(u.role==='employee'||u.role==='supervisor')){
    if(!(await messengerAllowed(u.id)) || !(await messengerAllowed(b.employee_id)))return ok(res,{error:'Нет доступа к мессенджеру'},403);
    const existing=await sql`
      SELECT c.id FROM chats c
      WHERE c.type='direct'
      AND EXISTS(SELECT 1 FROM chat_members a WHERE a.chat_id=c.id AND a.employee_id=${u.id})
      AND EXISTS(SELECT 1 FROM chat_members z WHERE z.chat_id=c.id AND z.employee_id=${b.employee_id})
      AND (SELECT count(*) FROM chat_members cm WHERE cm.chat_id=c.id)=2
      LIMIT 1`;
    if(existing.length)return ok(res,{id:existing[0].id});
    const c=await sql`INSERT INTO chats(type,created_by) VALUES('direct',${u.id}) RETURNING id`;
    await sql`INSERT INTO chat_members(chat_id,employee_id) VALUES(${c[0].id},${u.id}),(${c[0].id},${b.employee_id})`;
    return ok(res,{id:c[0].id})
  }

  if(req.method==='POST'&&path==='messenger/group'&&(u.role==='employee'||u.role==='supervisor')){
    if(!(await messengerAllowed(u.id)))return ok(res,{error:'Нет доступа к мессенджеру'},403);
    const ids=[...new Set([u.id,...(Array.isArray(b.member_ids)?b.member_ids.map(Number):[])])];
    if(ids.length<2)return ok(res,{error:'Добавьте хотя бы одного участника'},400);
    for(const id of ids)if(!(await messengerAllowed(id)))return ok(res,{error:'У одного из участников нет доступа к мессенджеру'},400);
    const c=await sql`INSERT INTO chats(type,title,created_by) VALUES('group',${b.title||'Новая группа'},${u.id}) RETURNING id`;
    for(const id of ids)await sql`INSERT INTO chat_members(chat_id,employee_id) VALUES(${c[0].id},${id})`;
    return ok(res,{id:c[0].id})
  }

  if(req.method==='GET'&&path==='messenger/messages'&&(u.role==='employee'||u.role==='supervisor')){
    const chatId=Number(req.query.chat_id);
    if(!(await messengerAllowed(u.id))||!(await isChatMember(chatId,u.id)))return ok(res,{error:'Нет доступа'},403);
    const messages=await sql`
      SELECT m.id,m.chat_id,m.sender_id,m.body,m.image,m.reply_to,m.edited_at,m.deleted,m.created_at,
             e.name sender_name,e.photo sender_photo,
             rm.body reply_body,re.name reply_sender
      FROM messages m
      LEFT JOIN employees e ON e.id=m.sender_id
      LEFT JOIN messages rm ON rm.id=m.reply_to
      LEFT JOIN employees re ON re.id=rm.sender_id
      WHERE m.chat_id=${chatId}
      ORDER BY m.id DESC LIMIT 120`;
    messages.reverse();
    for(const msg of messages){
      msg.reactions=await sql`SELECT reaction,count(*)::int count,array_agg(employee_id) employee_ids FROM message_reactions WHERE message_id=${msg.id} GROUP BY reaction ORDER BY reaction`;
    }
    const typers=await sql`SELECT e.id,e.name FROM chat_typing t JOIN employees e ON e.id=t.employee_id WHERE t.chat_id=${chatId} AND t.employee_id<>${u.id} AND t.touched_at>now()-interval '6 seconds'`;
    await sql`UPDATE chat_members SET last_read_at=now() WHERE chat_id=${chatId} AND employee_id=${u.id}`;
    const members=await sql`SELECT e.id,e.name,e.position,e.photo,e.last_seen FROM employees e JOIN chat_members cm ON cm.employee_id=e.id WHERE cm.chat_id=${chatId} ORDER BY e.name`;
    return ok(res,{messages,typers,members})
  }

  if(req.method==='POST'&&path==='messenger/messages'&&(u.role==='employee'||u.role==='supervisor')){
    const chatId=Number(b.chat_id);
    if(!(await messengerAllowed(u.id))||!(await isChatMember(chatId,u.id)))return ok(res,{error:'Нет доступа'},403);
    if((b.image||'').length>1400000)return ok(res,{error:'Изображение слишком большое'},400);
    if(!(b.body||'').trim()&&!b.image)return ok(res,{error:'Сообщение пустое'},400);
    const r=await sql`INSERT INTO messages(chat_id,sender_id,body,image,reply_to) VALUES(${chatId},${u.id},${(b.body||'').trim()},${b.image||null},${b.reply_to||null}) RETURNING id`;
    await sql`UPDATE chat_members SET last_read_at=now() WHERE chat_id=${chatId} AND employee_id=${u.id}`;
    await messagePush(chatId,u.id,r[0].id,(b.body||'').trim());
    return ok(res,{ok:true,id:r[0].id})
  }

  if(req.method==='PUT'&&path==='messenger/messages'&&(u.role==='employee'||u.role==='supervisor')){
    const msg=(await sql`SELECT * FROM messages WHERE id=${b.id}`)[0];
    if(!msg||msg.sender_id!==u.id)return ok(res,{error:'Нельзя редактировать это сообщение'},403);
    await sql`UPDATE messages SET body=${(b.body||'').trim()},edited_at=now() WHERE id=${b.id}`;
    return ok(res,{ok:true})
  }

  if(req.method==='DELETE'&&path==='messenger/messages'&&(u.role==='employee'||u.role==='supervisor')){
    const msg=(await sql`SELECT * FROM messages WHERE id=${b.id}`)[0];
    if(!msg||msg.sender_id!==u.id)return ok(res,{error:'Нельзя удалить это сообщение'},403);
    await sql`UPDATE messages SET body='',image=null,deleted=true,edited_at=now() WHERE id=${b.id}`;
    return ok(res,{ok:true})
  }

  if(req.method==='POST'&&path==='messenger/reaction'&&(u.role==='employee'||u.role==='supervisor')){
    const msg=(await sql`SELECT chat_id FROM messages WHERE id=${b.message_id}`)[0];
    if(!msg||!(await isChatMember(msg.chat_id,u.id)))return ok(res,{error:'Нет доступа'},403);
    const ex=await sql`SELECT 1 FROM message_reactions WHERE message_id=${b.message_id} AND employee_id=${u.id} AND reaction=${b.reaction}`;
    if(ex.length)await sql`DELETE FROM message_reactions WHERE message_id=${b.message_id} AND employee_id=${u.id} AND reaction=${b.reaction}`;
    else await sql`INSERT INTO message_reactions(message_id,employee_id,reaction) VALUES(${b.message_id},${u.id},${b.reaction})`;
    return ok(res,{ok:true})
  }

  if(req.method==='POST'&&path==='messenger/typing'&&(u.role==='employee'||u.role==='supervisor')){
    const chatId=Number(b.chat_id);
    if(!(await isChatMember(chatId,u.id)))return ok(res,{error:'Нет доступа'},403);
    await sql`INSERT INTO chat_typing(chat_id,employee_id,touched_at) VALUES(${chatId},${u.id},now()) ON CONFLICT(chat_id,employee_id) DO UPDATE SET touched_at=now()`;
    return ok(res,{ok:true})
  }
  if(req.method==='GET'&&path==='me'&&((u.role==='employee'||u.role==='supervisor')||u.role==='supervisor')){const e=(await sql`SELECT id,name,position,points,photo,active,access_role,team_member,messenger_access,last_seen FROM employees WHERE id=${u.id}`)[0]; const news=await sql`SELECT n.*, (r.employee_id IS NOT NULL) acknowledged FROM news n LEFT JOIN news_reads r ON r.news_id=n.id AND r.employee_id=${u.id} WHERE n.active=true ORDER BY n.pinned DESC,n.created_at DESC`; const tasks=await sql`SELECT * FROM tasks WHERE active=true ORDER BY id DESC`; const prizes=await sql`SELECT * FROM prizes WHERE active=true ORDER BY cost`; const ranking=await sql`SELECT id,name,position,points,photo FROM employees WHERE active=true AND team_member=true ORDER BY points DESC,name LIMIT 50`; const ach=await sql`SELECT a.* FROM achievements a JOIN employee_achievements ea ON ea.achievement_id=a.id WHERE ea.employee_id=${u.id}`; const hist=await sql`SELECT * FROM history WHERE employee_id=${u.id} ORDER BY created_at DESC LIMIT 100`;
 const individualTasks=await sql`SELECT * FROM individual_tasks WHERE employee_id=${u.id} ORDER BY CASE status WHEN 'assigned' THEN 1 WHEN 'submitted' THEN 2 ELSE 3 END, due_date NULLS LAST, created_at DESC`;
 const comp=(await sql`SELECT * FROM competitions WHERE active=true ORDER BY id DESC LIMIT 1`)[0]||null; let competition=null;
 if(comp){const ct=await sql`SELECT * FROM competition_tasks WHERE competition_id=${comp.id} AND active=true ORDER BY points,title`; const board=await sql`SELECT e.id,e.name,e.photo,COALESCE(sum(cs.points),0)::int score FROM employees e LEFT JOIN competition_scores cs ON cs.employee_id=e.id AND cs.competition_id=${comp.id} WHERE e.active=true AND e.team_member=true GROUP BY e.id ORDER BY score DESC,e.name`; const mine=board.find(x=>x.id===u.id); competition={...comp,tasks:ct,board,my_score:mine?mine.score:0,my_place:board.findIndex(x=>x.id===u.id)+1};}
 return ok(res,{employee:e,news,tasks,individualTasks,prizes,ranking,achievements:ach,history:hist,competition})}
  if(req.method==='POST'&&path==='me/photo'&&(u.role==='employee'||u.role==='supervisor')){const b=await body(req); if((b.photo||'').length>1400000)return ok(res,{error:'Фото слишком большое'},400); await sql`UPDATE employees SET photo=${b.photo||null} WHERE id=${u.id}`; return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='news/ack'&&u.role==='employee'){const b=await body(req); await sql`INSERT INTO news_reads(news_id,employee_id) VALUES(${b.news_id},${u.id}) ON CONFLICT DO NOTHING`; return ok(res,{ok:true})}

  if(req.method==='GET'&&path==='supervisor/state'&&(u.role==='supervisor'||u.role==='manager')){
    const employees=await sql`SELECT id,name,position,points,photo,active,team_member,access_role,messenger_access,last_seen FROM employees WHERE active=true ORDER BY team_member DESC,points DESC,name`;
    const achievements=await sql`SELECT ea.employee_id,a.title,a.icon,a.description,ea.created_at FROM employee_achievements ea JOIN achievements a ON a.id=ea.achievement_id ORDER BY ea.created_at DESC`;
    const pending=await sql`SELECT it.*,e.name employee_name FROM individual_tasks it JOIN employees e ON e.id=it.employee_id WHERE it.status IN ('assigned','submitted') ORDER BY it.status DESC,it.due_date NULLS LAST`;
    const comp=(await sql`SELECT * FROM competitions WHERE active=true ORDER BY id DESC LIMIT 1`)[0]||null;
    let competition=null;
    if(comp){const board=await sql`SELECT e.id,e.name,e.photo,COALESCE(sum(cs.points),0)::int score FROM employees e LEFT JOIN competition_scores cs ON cs.employee_id=e.id AND cs.competition_id=${comp.id} WHERE e.active=true AND e.team_member=true GROUP BY e.id ORDER BY score DESC,e.name`;competition={...comp,board};}
    return ok(res,{employees,achievements,pending,competition})
  }

  if(u.role!=='manager') return ok(res,{error:'Нет доступа'},403);

  if(req.method==='GET'&&path==='admin/messenger'){
    const users=await sql`SELECT id,name,position,photo,messenger_access,active,last_seen FROM employees ORDER BY name`;
    const chats=await sql`SELECT c.*, (SELECT count(*)::int FROM chat_members cm WHERE cm.chat_id=c.id) members_count, (SELECT count(*)::int FROM messages m WHERE m.chat_id=c.id) messages_count FROM chats c ORDER BY c.created_at DESC`;
    return ok(res,{users,chats})
  }
  if(req.method==='DELETE'&&path==='admin/messenger/chat'){
    await sql`DELETE FROM chats WHERE id=${b.id}`; return ok(res,{ok:true})
  }


  if(req.method==='GET'&&path==='admin/content/replacements'){
    return ok(res,await sql`SELECT source_text,replacement_text,updated_at FROM ui_replacements ORDER BY source_text`)
  }
  if(req.method==='POST'&&path==='admin/content/replacements'){
    const source=String(b.source_text||'').trim();
    if(!source)return ok(res,{error:'Укажите исходный текст'},400);
    await sql`INSERT INTO ui_replacements(source_text,replacement_text,updated_at)
      VALUES(${source},${String(b.replacement_text??'')},now())
      ON CONFLICT(source_text) DO UPDATE SET replacement_text=${String(b.replacement_text??'')},updated_at=now()`;
    return ok(res,{ok:true})
  }
  if(req.method==='DELETE'&&path==='admin/content/replacements'){
    if(b.source_text)await sql`DELETE FROM ui_replacements WHERE source_text=${b.source_text}`;
    return ok(res,{ok:true})
  }

  if(req.method==='GET'&&path==='admin/content/blocks'){
    return ok(res,await sql`SELECT block_key,hidden,updated_at FROM ui_blocks ORDER BY block_key`)
  }
  if(req.method==='POST'&&path==='admin/content/blocks'){
    if(!b.block_key)return ok(res,{error:'Не указан блок'},400);
    await sql`INSERT INTO ui_blocks(block_key,hidden,updated_at)
      VALUES(${b.block_key},${!!b.hidden},now())
      ON CONFLICT(block_key) DO UPDATE SET hidden=${!!b.hidden},updated_at=now()`;
    return ok(res,{ok:true})
  }
  if(req.method==='DELETE'&&path==='admin/content/blocks'){
    if(b.block_key)await sql`DELETE FROM ui_blocks WHERE block_key=${b.block_key}`;
    return ok(res,{ok:true})
  }

  if(req.method==='GET'&&path==='admin/content/removed-elements'){
    return ok(res,await sql`SELECT * FROM ui_removed_elements ORDER BY id DESC`)
  }
  if(req.method==='POST'&&path==='admin/content/removed-elements'){
    const type=String(b.element_type||'').trim(),txt=String(b.match_text||'').trim();
    if(!['button','window'].includes(type)||!txt)return ok(res,{error:'Укажите тип элемента и текст'},400);
    const r=await sql`INSERT INTO ui_removed_elements(element_type,match_text,active) VALUES(${type},${txt},true) RETURNING id`;
    return ok(res,{ok:true,id:r[0].id})
  }
  if(req.method==='DELETE'&&path==='admin/content/removed-elements'){
    await sql`DELETE FROM ui_removed_elements WHERE id=${b.id}`; return ok(res,{ok:true})
  }
  if(req.method==='GET'&&path==='admin/content'){
    const rows=await sql`SELECT key,value,updated_at FROM ui_texts ORDER BY key`;
    return ok(res,rows)
  }
  if(req.method==='POST'&&path==='admin/content'){
    if(!b.key)return ok(res,{error:'Не указан ключ'},400);
    await sql`INSERT INTO ui_texts(key,value,updated_at) VALUES(${b.key},${String(b.value??'')},now())
      ON CONFLICT(key) DO UPDATE SET value=${String(b.value??'')},updated_at=now()`;
    return ok(res,{ok:true})
  }
  if(req.method==='POST'&&path==='admin/content/bulk'){
    if(!Array.isArray(b.items))return ok(res,{error:'Некорректные данные'},400);
    for(const item of b.items){
      if(!item?.key)continue;
      await sql`INSERT INTO ui_texts(key,value,updated_at) VALUES(${item.key},${String(item.value??'')},now())
        ON CONFLICT(key) DO UPDATE SET value=${String(item.value??'')},updated_at=now()`;
    }
    return ok(res,{ok:true})
  }
  if(req.method==='DELETE'&&path==='admin/content'){
    if(b.key)await sql`DELETE FROM ui_texts WHERE key=${b.key}`;
    return ok(res,{ok:true})
  }
  if(req.method==='GET'&&path==='admin/state'){const [employees,tasks,prizes,achievements,news,history,settings]=await Promise.all([sql`SELECT id,name,position,points,active,photo,created_at,access_role,team_member,messenger_access,last_seen FROM employees ORDER BY name`,sql`SELECT * FROM tasks ORDER BY id DESC`,sql`SELECT * FROM prizes ORDER BY id DESC`,sql`SELECT * FROM achievements ORDER BY id DESC`,sql`SELECT n.*, (SELECT count(*)::int FROM news_reads r WHERE r.news_id=n.id) read_count FROM news n ORDER BY pinned DESC,created_at DESC`,sql`SELECT h.*,e.name employee_name FROM history h LEFT JOIN employees e ON e.id=h.employee_id ORDER BY h.created_at DESC LIMIT 200`,sql`SELECT season,level_step FROM settings WHERE id=1`]);const comp=(await sql`SELECT * FROM competitions ORDER BY id DESC LIMIT 1`)[0]||null; let competition=null;
 if(comp){const ct=await sql`SELECT * FROM competition_tasks WHERE competition_id=${comp.id} ORDER BY id`; const board=await sql`SELECT e.id,e.name,e.photo,COALESCE(sum(cs.points),0)::int score FROM employees e LEFT JOIN competition_scores cs ON cs.employee_id=e.id AND cs.competition_id=${comp.id} WHERE e.active=true AND e.team_member=true GROUP BY e.id ORDER BY score DESC,e.name`; competition={...comp,tasks:ct,board};}
 const individualTasks=await sql`SELECT it.*,e.name employee_name FROM individual_tasks it JOIN employees e ON e.id=it.employee_id ORDER BY CASE it.status WHEN 'submitted' THEN 1 WHEN 'assigned' THEN 2 ELSE 3 END,it.created_at DESC`;
 return ok(res,{employees,tasks,prizes,achievements,news,history,settings:settings[0],competition,individualTasks})}
  if(req.method==='POST'&&path==='admin/employees'){const h=await bcrypt.hash(String(b.pin),10); const r=await sql`INSERT INTO employees(name,position,pin_hash,access_role,team_member,messenger_access) VALUES(${b.name},${b.position||''},${h},${b.access_role||'employee'},${b.team_member!==false},${!!b.messenger_access}) RETURNING id`;return ok(res,r[0])}
  if(req.method==='PUT'&&path==='admin/employees'){if(b.pin){const h=await bcrypt.hash(String(b.pin),10);await sql`UPDATE employees SET name=${b.name},position=${b.position||''},active=${b.active!==false},access_role=${b.access_role||'employee'},team_member=${b.team_member!==false},messenger_access=${!!b.messenger_access},pin_hash=${h} WHERE id=${b.id}`}else await sql`UPDATE employees SET name=${b.name},position=${b.position||''},active=${b.active!==false},access_role=${b.access_role||'employee'},team_member=${b.team_member!==false},messenger_access=${!!b.messenger_access} WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/employees'){await sql`DELETE FROM employees WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/points'){await sql`UPDATE employees SET points=points+${Number(b.delta)||0} WHERE id=${b.employee_id}`;await sql`INSERT INTO history(employee_id,delta,reason) VALUES(${b.employee_id},${Number(b.delta)||0},${b.reason||''})`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/tasks'){
    const r=await sql`INSERT INTO tasks(title,description,points,active) VALUES(${b.title},${b.description||''},${Number(b.points)||0},${b.active!==false}) RETURNING id`;
    let push=null;
    if(b.active!==false){
      push=await broadcastPush({
        title:'Новое общее задание 🚀',
        body:(b.title||'Новое задание')+(Number(b.points)?` · +${Number(b.points)} баллов`:''),
        url:'/?open=tasks',
        tag:'general-task-'+r[0].id
      });
      console.log('general task push',JSON.stringify(push));
    }
    return ok(res,{ok:true,id:r[0].id,push})
  }
  if(req.method==='PUT'&&path==='admin/tasks'){await sql`UPDATE tasks SET title=${b.title},description=${b.description||''},points=${Number(b.points)||0},active=${b.active!==false} WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/tasks'){await sql`DELETE FROM tasks WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/prizes'){await sql`INSERT INTO prizes(title,description,cost,active) VALUES(${b.title},${b.description||''},${Number(b.cost)||0},${b.active!==false})`;return ok(res,{ok:true})}
  if(req.method==='PUT'&&path==='admin/prizes'){await sql`UPDATE prizes SET title=${b.title},description=${b.description||''},cost=${Number(b.cost)||0},active=${b.active!==false} WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/prizes'){await sql`DELETE FROM prizes WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/achievements'){await sql`INSERT INTO achievements(title,description,icon) VALUES(${b.title},${b.description||''},${b.icon||'★'})`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/achievements'){await sql`DELETE FROM achievements WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/achievement/assign'){await sql`INSERT INTO employee_achievements(employee_id,achievement_id) VALUES(${b.employee_id},${b.achievement_id}) ON CONFLICT DO NOTHING`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/news'){
    if((b.image||'').length>1400000)return ok(res,{error:'Фото слишком большое'},400);
    const r=await sql`INSERT INTO news(title,body,category,image,event_date,pinned,requires_ack,active) VALUES(${b.title},${b.body||''},${b.category||'Важно'},${b.image||null},${b.event_date||null},${!!b.pinned},${!!b.requires_ack},${b.active!==false}) RETURNING id`;
    let push=null;
    if(b.active!==false){
      push=await broadcastPush({
        title:b.category==='Мероприятие'?'Новое мероприятие 📅':'Новая новость 📰',
        body:b.title||'В ленте появилась новая публикация',
        url:'/?open=news',
        tag:'news-'+r[0].id
      });
      console.log('news push',JSON.stringify(push));
    }
    return ok(res,{ok:true,id:r[0].id,push})
  }
  if(req.method==='PUT'&&path==='admin/news'){await sql`UPDATE news SET title=${b.title},body=${b.body||''},category=${b.category||'Важно'},event_date=${b.event_date||null},pinned=${!!b.pinned},requires_ack=${!!b.requires_ack},active=${b.active!==false},image=COALESCE(${b.image||null},image) WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/news'){await sql`DELETE FROM news WHERE id=${b.id}`;return ok(res,{ok:true})}

  if(req.method==='POST'&&path==='admin/individual-tasks'){
    const r=await sql`INSERT INTO individual_tasks(employee_id,title,description,points,due_date) VALUES(${b.employee_id},${b.title},${b.description||''},${Number(b.points)||0},${b.due_date||null}) RETURNING id`;
    const push=await sendPushToEmployee(b.employee_id,{
      title:'Новое индивидуальное задание 🚀',
      body:(b.title||'Новое задание')+(Number(b.points)?` · +${Number(b.points)} баллов`:''),
      url:'/?open=tasks',
      tag:'individual-task-'+r[0].id
    });
    console.log('individual task push',JSON.stringify(push));
    return ok(res,{ok:true,id:r[0].id,push})
  }
  if(req.method==='PUT'&&path==='admin/individual-tasks'){
    await sql`UPDATE individual_tasks SET title=${b.title},description=${b.description||''},points=${Number(b.points)||0},due_date=${b.due_date||null},status=${b.status||'assigned'} WHERE id=${b.id}`;
    return ok(res,{ok:true})
  }
  if(req.method==='POST'&&path==='admin/individual-tasks/approve'){
    const t=(await sql`SELECT * FROM individual_tasks WHERE id=${b.id}`)[0];
    if(!t)return ok(res,{error:'Задание не найдено'},404);
    if(t.status!=='completed'){
      await sql`UPDATE individual_tasks SET status='completed',completed_at=now() WHERE id=${b.id}`;
      await sql`UPDATE employees SET points=points+${t.points} WHERE id=${t.employee_id}`;
      await sql`INSERT INTO history(employee_id,delta,reason) VALUES(${t.employee_id},${t.points},${'Индивидуальное задание: '+t.title})`;
    }
    return ok(res,{ok:true,points:t.points})
  }
  if(req.method==='DELETE'&&path==='admin/individual-tasks'){
    await sql`DELETE FROM individual_tasks WHERE id=${b.id}`; return ok(res,{ok:true})
  }
  if(req.method==='POST'&&path==='admin/competition/settings'){
    let c=(await sql`SELECT id,active,title,description,starts_on,ends_on FROM competitions ORDER BY id DESC LIMIT 1`)[0];
    const oldSignature=c?JSON.stringify([c.title,c.description,c.starts_on,c.ends_on,c.active]):'';
    let id=null;
    if(c){
      id=c.id;
      await sql`UPDATE competitions SET title=${b.title},description=${b.description||''},starts_on=${b.starts_on||null},ends_on=${b.ends_on||null},active=${b.active!==false} WHERE id=${c.id}`;
    }else{
      const r=await sql`INSERT INTO competitions(title,description,starts_on,ends_on,active) VALUES(${b.title},${b.description||''},${b.starts_on||null},${b.ends_on||null},${b.active!==false}) RETURNING id`;
      id=r[0].id;
    }
    let push=null;
    const newSignature=JSON.stringify([b.title,b.description||'',b.starts_on||null,b.ends_on||null,b.active!==false]);
    if(b.active!==false && oldSignature!==newSignature){
      push=await broadcastPush({
        title:c?.active?'Конкурс обновлён 🏆':'Старт нового конкурса 🏆',
        body:b.title||'Откройте раздел конкурса и посмотрите условия',
        url:'/?open=competition',
        tag:'competition-'+id
      });
      console.log('competition push',JSON.stringify(push));
    }
    return ok(res,{ok:true,id,push})
  }
  if(req.method==='POST'&&path==='admin/competition/tasks'){const c=(await sql`SELECT id FROM competitions ORDER BY id DESC LIMIT 1`)[0]; await sql`INSERT INTO competition_tasks(competition_id,title,description,points,active) VALUES(${c.id},${b.title},${b.description||''},${Number(b.points)||0},true)`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/competition/tasks'){await sql`DELETE FROM competition_tasks WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/competition/award'){const c=(await sql`SELECT id FROM competitions ORDER BY id DESC LIMIT 1`)[0]; const pts=Number(b.points)||0; await sql`INSERT INTO competition_scores(competition_id,employee_id,task_id,points,reason) VALUES(${c.id},${b.employee_id},${b.task_id||null},${pts},${b.reason||''})`; await sql`UPDATE employees SET points=points+${pts} WHERE id=${b.employee_id}`; await sql`INSERT INTO history(employee_id,delta,reason) VALUES(${b.employee_id},${pts},${'Конкурс: '+(b.reason||'бонус')})`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/settings'){if(b.manager_pin){const h=await bcrypt.hash(String(b.manager_pin),10);await sql`UPDATE settings SET manager_pin_hash=${h},season=${b.season||'Сезон команды'},level_step=${Number(b.level_step)||100} WHERE id=1`}else await sql`UPDATE settings SET season=${b.season||'Сезон команды'},level_step=${Number(b.level_step)||100} WHERE id=1`;return ok(res,{ok:true})}
  return ok(res,{error:'Маршрут не найден'},404);
 }catch(e){console.error(e);return ok(res,{error:'Ошибка сервера',detail:String(e.message||e)},500)}
}