const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.APP_SECRET || 'CHANGE_ME_IN_VERCEL';

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
module.exports=async(req,res)=>{
 try{
  await init(); const path=(req.query.path||'').toString(); const u=auth(req);
  if(req.method==='GET'&&path==='public/employees'){return ok(res,await sql`SELECT id,name,position,photo FROM employees WHERE active=true ORDER BY name`)}
  if(req.method==='POST'&&path==='login/employee'){const b=await body(req); const rows=await sql`SELECT * FROM employees WHERE id=${b.id} AND active=true`; if(!rows.length||!(await bcrypt.compare(String(b.pin||''),rows[0].pin_hash))) return ok(res,{error:'Неверный PIN'},401); return ok(res,{token:token({role:'employee',id:rows[0].id})})}
  if(req.method==='POST'&&path==='login/manager'){const b=await body(req); const s=(await sql`SELECT manager_pin_hash FROM settings WHERE id=1`)[0]; if(!(await bcrypt.compare(String(b.pin||''),s.manager_pin_hash))) return ok(res,{error:'Неверный PIN'},401); return ok(res,{token:token({role:'manager'})})}
  if(!u) return ok(res,{error:'Требуется вход'},401);
  if(req.method==='GET'&&path==='me'&&u.role==='employee'){const e=(await sql`SELECT id,name,position,points,photo,active FROM employees WHERE id=${u.id}`)[0]; const news=await sql`SELECT n.*, (r.employee_id IS NOT NULL) acknowledged FROM news n LEFT JOIN news_reads r ON r.news_id=n.id AND r.employee_id=${u.id} WHERE n.active=true ORDER BY n.pinned DESC,n.created_at DESC`; const tasks=await sql`SELECT * FROM tasks WHERE active=true ORDER BY id DESC`; const prizes=await sql`SELECT * FROM prizes WHERE active=true ORDER BY cost`; const ranking=await sql`SELECT id,name,position,points,photo FROM employees WHERE active=true ORDER BY points DESC,name LIMIT 50`; const ach=await sql`SELECT a.* FROM achievements a JOIN employee_achievements ea ON ea.achievement_id=a.id WHERE ea.employee_id=${u.id}`; const hist=await sql`SELECT * FROM history WHERE employee_id=${u.id} ORDER BY created_at DESC LIMIT 100`;
 const comp=(await sql`SELECT * FROM competitions WHERE active=true ORDER BY id DESC LIMIT 1`)[0]||null; let competition=null;
 if(comp){const ct=await sql`SELECT * FROM competition_tasks WHERE competition_id=${comp.id} AND active=true ORDER BY points,title`; const board=await sql`SELECT e.id,e.name,e.photo,COALESCE(sum(cs.points),0)::int score FROM employees e LEFT JOIN competition_scores cs ON cs.employee_id=e.id AND cs.competition_id=${comp.id} WHERE e.active=true GROUP BY e.id ORDER BY score DESC,e.name`; const mine=board.find(x=>x.id===u.id); competition={...comp,tasks:ct,board,my_score:mine?mine.score:0,my_place:board.findIndex(x=>x.id===u.id)+1};}
 return ok(res,{employee:e,news,tasks,prizes,ranking,achievements:ach,history:hist,competition})}
  if(req.method==='POST'&&path==='me/photo'&&u.role==='employee'){const b=await body(req); if((b.photo||'').length>1400000)return ok(res,{error:'Фото слишком большое'},400); await sql`UPDATE employees SET photo=${b.photo||null} WHERE id=${u.id}`; return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='news/ack'&&u.role==='employee'){const b=await body(req); await sql`INSERT INTO news_reads(news_id,employee_id) VALUES(${b.news_id},${u.id}) ON CONFLICT DO NOTHING`; return ok(res,{ok:true})}
  if(u.role!=='manager') return ok(res,{error:'Нет доступа'},403);
  if(req.method==='GET'&&path==='admin/state'){const [employees,tasks,prizes,achievements,news,history,settings]=await Promise.all([sql`SELECT id,name,position,points,active,photo,created_at FROM employees ORDER BY name`,sql`SELECT * FROM tasks ORDER BY id DESC`,sql`SELECT * FROM prizes ORDER BY id DESC`,sql`SELECT * FROM achievements ORDER BY id DESC`,sql`SELECT n.*, (SELECT count(*)::int FROM news_reads r WHERE r.news_id=n.id) read_count FROM news n ORDER BY pinned DESC,created_at DESC`,sql`SELECT h.*,e.name employee_name FROM history h LEFT JOIN employees e ON e.id=h.employee_id ORDER BY h.created_at DESC LIMIT 200`,sql`SELECT season,level_step FROM settings WHERE id=1`]);const comp=(await sql`SELECT * FROM competitions ORDER BY id DESC LIMIT 1`)[0]||null; let competition=null;
 if(comp){const ct=await sql`SELECT * FROM competition_tasks WHERE competition_id=${comp.id} ORDER BY id`; const board=await sql`SELECT e.id,e.name,e.photo,COALESCE(sum(cs.points),0)::int score FROM employees e LEFT JOIN competition_scores cs ON cs.employee_id=e.id AND cs.competition_id=${comp.id} WHERE e.active=true GROUP BY e.id ORDER BY score DESC,e.name`; competition={...comp,tasks:ct,board};}
 return ok(res,{employees,tasks,prizes,achievements,news,history,settings:settings[0],competition})}
  const b=await body(req);
  if(req.method==='POST'&&path==='admin/employees'){const h=await bcrypt.hash(String(b.pin),10); const r=await sql`INSERT INTO employees(name,position,pin_hash) VALUES(${b.name},${b.position||''},${h}) RETURNING id`;return ok(res,r[0])}
  if(req.method==='PUT'&&path==='admin/employees'){if(b.pin){const h=await bcrypt.hash(String(b.pin),10);await sql`UPDATE employees SET name=${b.name},position=${b.position||''},active=${b.active!==false},pin_hash=${h} WHERE id=${b.id}`}else await sql`UPDATE employees SET name=${b.name},position=${b.position||''},active=${b.active!==false} WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/employees'){await sql`DELETE FROM employees WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/points'){await sql`UPDATE employees SET points=points+${Number(b.delta)||0} WHERE id=${b.employee_id}`;await sql`INSERT INTO history(employee_id,delta,reason) VALUES(${b.employee_id},${Number(b.delta)||0},${b.reason||''})`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/tasks'){await sql`INSERT INTO tasks(title,description,points,active) VALUES(${b.title},${b.description||''},${Number(b.points)||0},${b.active!==false})`;return ok(res,{ok:true})}
  if(req.method==='PUT'&&path==='admin/tasks'){await sql`UPDATE tasks SET title=${b.title},description=${b.description||''},points=${Number(b.points)||0},active=${b.active!==false} WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/tasks'){await sql`DELETE FROM tasks WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/prizes'){await sql`INSERT INTO prizes(title,description,cost,active) VALUES(${b.title},${b.description||''},${Number(b.cost)||0},${b.active!==false})`;return ok(res,{ok:true})}
  if(req.method==='PUT'&&path==='admin/prizes'){await sql`UPDATE prizes SET title=${b.title},description=${b.description||''},cost=${Number(b.cost)||0},active=${b.active!==false} WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/prizes'){await sql`DELETE FROM prizes WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/achievements'){await sql`INSERT INTO achievements(title,description,icon) VALUES(${b.title},${b.description||''},${b.icon||'★'})`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/achievements'){await sql`DELETE FROM achievements WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/achievement/assign'){await sql`INSERT INTO employee_achievements(employee_id,achievement_id) VALUES(${b.employee_id},${b.achievement_id}) ON CONFLICT DO NOTHING`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/news'){if((b.image||'').length>1400000)return ok(res,{error:'Фото слишком большое'},400);await sql`INSERT INTO news(title,body,category,image,event_date,pinned,requires_ack,active) VALUES(${b.title},${b.body||''},${b.category||'Важно'},${b.image||null},${b.event_date||null},${!!b.pinned},${!!b.requires_ack},${b.active!==false})`;return ok(res,{ok:true})}
  if(req.method==='PUT'&&path==='admin/news'){await sql`UPDATE news SET title=${b.title},body=${b.body||''},category=${b.category||'Важно'},event_date=${b.event_date||null},pinned=${!!b.pinned},requires_ack=${!!b.requires_ack},active=${b.active!==false},image=COALESCE(${b.image||null},image) WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/news'){await sql`DELETE FROM news WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/competition/settings'){let c=(await sql`SELECT id FROM competitions ORDER BY id DESC LIMIT 1`)[0]; if(c) await sql`UPDATE competitions SET title=${b.title},description=${b.description||''},starts_on=${b.starts_on||null},ends_on=${b.ends_on||null},active=${b.active!==false} WHERE id=${c.id}`; else await sql`INSERT INTO competitions(title,description,starts_on,ends_on,active) VALUES(${b.title},${b.description||''},${b.starts_on||null},${b.ends_on||null},${b.active!==false})`; return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/competition/tasks'){const c=(await sql`SELECT id FROM competitions ORDER BY id DESC LIMIT 1`)[0]; await sql`INSERT INTO competition_tasks(competition_id,title,description,points,active) VALUES(${c.id},${b.title},${b.description||''},${Number(b.points)||0},true)`;return ok(res,{ok:true})}
  if(req.method==='DELETE'&&path==='admin/competition/tasks'){await sql`DELETE FROM competition_tasks WHERE id=${b.id}`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/competition/award'){const c=(await sql`SELECT id FROM competitions ORDER BY id DESC LIMIT 1`)[0]; const pts=Number(b.points)||0; await sql`INSERT INTO competition_scores(competition_id,employee_id,task_id,points,reason) VALUES(${c.id},${b.employee_id},${b.task_id||null},${pts},${b.reason||''})`; await sql`UPDATE employees SET points=points+${pts} WHERE id=${b.employee_id}`; await sql`INSERT INTO history(employee_id,delta,reason) VALUES(${b.employee_id},${pts},${'Конкурс: '+(b.reason||'бонус')})`;return ok(res,{ok:true})}
  if(req.method==='POST'&&path==='admin/settings'){if(b.manager_pin){const h=await bcrypt.hash(String(b.manager_pin),10);await sql`UPDATE settings SET manager_pin_hash=${h},season=${b.season||'Сезон команды'},level_step=${Number(b.level_step)||100} WHERE id=1`}else await sql`UPDATE settings SET season=${b.season||'Сезон команды'},level_step=${Number(b.level_step)||100} WHERE id=1`;return ok(res,{ok:true})}
  return ok(res,{error:'Маршрут не найден'},404);
 }catch(e){console.error(e);return ok(res,{error:'Ошибка сервера',detail:String(e.message||e)},500)}
}