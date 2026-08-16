#!/usr/bin/env python3
import json, os, sqlite3, hashlib, hmac, secrets, time, base64, mimetypes
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from http.cookies import SimpleCookie
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get('APP_DB', ROOT / 'data' / 'gamification.db'))
HOST = os.environ.get('HOST', '0.0.0.0')
PORT = int(os.environ.get('PORT', '8080'))
SECRET_FILE = ROOT / 'data' / '.server_secret'


def server_secret():
    SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
    if SECRET_FILE.exists():
        return SECRET_FILE.read_bytes()
    s = secrets.token_bytes(32)
    SECRET_FILE.write_bytes(s)
    return s

SECRET = server_secret()


def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON')
    return con


def hash_pin(pin, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', pin.encode(), salt.encode(), 120_000).hex()
    return f'{salt}${digest}'


def verify_pin(pin, stored):
    try:
        salt, digest = stored.split('$', 1)
        check = hashlib.pbkdf2_hmac('sha256', pin.encode(), salt.encode(), 120_000).hex()
        return hmac.compare_digest(check, digest)
    except Exception:
        return False


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = db()
    con.executescript('''
    CREATE TABLE IF NOT EXISTS employees(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Сотрудник',
      points INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tasks(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      points INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS rewards(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cost INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS achievements(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '★',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS employee_achievements(
      employee_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(employee_id, achievement_id),
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY(achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS history(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      employee_name TEXT NOT NULL,
      delta INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'Другое',
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS settings(
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    ''')
    count = con.execute('SELECT COUNT(*) c FROM employees').fetchone()['c']
    if count == 0:
        employees=[('Анна','Официант',420),('Илья','Официант',365),('Мария','Бармен',510),('Сергей','Официант',295),('Ольга','Официант',455)]
        con.executemany('INSERT INTO employees(name,role,points) VALUES(?,?,?)', employees)
        tasks=[('Продать 5 позиций дня','Выполнить план по позиции дня в течение смены',40,1),('Получить положительный отзыв гостя','Отзыв должен содержать имя сотрудника',25,1),('Закрыть смену без замечаний','Нет нарушений по итогам чек-листа',30,1),('Средний чек выше цели','Выполнить установленную цель по среднему чеку',50,1)]
        con.executemany('INSERT INTO tasks(title,description,points,active) VALUES(?,?,?,?)', tasks)
        rewards=[('Кофе / десерт от заведения','Комплимент сотруднику',120,1),('Приоритет выбора смены','Первый выбор свободной смены',300,1),('Подарочный сертификат','Сертификат от заведения',500,1),('Дополнительный выходной','По согласованию с управляющим',750,1)]
        con.executemany('INSERT INTO rewards(title,description,cost,active) VALUES(?,?,?,?)', rewards)
        achievements=[('Первая сотня','Набрать первые 100 баллов','100',1),('Мастер продаж','Высокий результат по продажам','₽',1),('Любимец гостей','Получать положительные отзывы','♥',1),('Командный игрок','Помощь коллегам и командная работа','★',1),('Серия 5 смен','Пять сильных смен подряд','5',1)]
        con.executemany('INSERT INTO achievements(title,description,icon,active) VALUES(?,?,?,?)', achievements)
        em = {r['name']:r['id'] for r in con.execute('SELECT id,name FROM employees')}
        ach = {r['title']:r['id'] for r in con.execute('SELECT id,title FROM achievements')}
        for ename, titles in {'Анна':['Серия 5 смен','Мастер продаж'],'Илья':['Любимец гостей'],'Мария':['Мастер продаж','Командный игрок'],'Сергей':['Первая сотня'],'Ольга':['Серия 5 смен']}.items():
            for title in titles:
                con.execute('INSERT OR IGNORE INTO employee_achievements(employee_id,achievement_id) VALUES(?,?)',(em[ename],ach[title]))
        con.execute("INSERT INTO history(employee_id,employee_name,delta,category,reason) VALUES(?,?,?,?,?)",(em['Анна'],'Анна',25,'Сервис','Положительный отзыв гостя'))
        con.execute("INSERT INTO history(employee_id,employee_name,delta,category,reason) VALUES(?,?,?,?,?)",(em['Мария'],'Мария',50,'Продажи','Средний чек выше цели'))
        con.execute("INSERT INTO history(employee_id,employee_name,delta,category,reason) VALUES(?,?,?,?,?)",(em['Сергей'],'Сергей',-10,'Дисциплина','Опоздание на смену'))
    defaults = {
      'season_title':'Сезон команды',
      'tagline':'Геймификация и мотивация сотрудников',
      'level_step':'200',
      'manager_pin_hash': hash_pin('2026')
    }
    for k,v in defaults.items():
        if not con.execute('SELECT 1 FROM settings WHERE key=?',(k,)).fetchone():
            con.execute('INSERT INTO settings(key,value) VALUES(?,?)',(k,v))
    con.commit(); con.close()


def setting(con, key, default=''):
    row = con.execute('SELECT value FROM settings WHERE key=?',(key,)).fetchone()
    return row['value'] if row else default


def public_state():
    con=db()
    settings={r['key']:r['value'] for r in con.execute("SELECT key,value FROM settings WHERE key != 'manager_pin_hash'")}
    employees=[dict(r) for r in con.execute('SELECT id,name,role,points,active FROM employees WHERE active=1 ORDER BY points DESC,name')]
    tasks=[dict(r) for r in con.execute('SELECT id,title,description,points,active FROM tasks WHERE active=1 ORDER BY id DESC')]
    rewards=[dict(r) for r in con.execute('SELECT id,title,description,cost,active FROM rewards WHERE active=1 ORDER BY cost,id')]
    achievements=[dict(r) for r in con.execute('SELECT id,title,description,icon,active FROM achievements WHERE active=1 ORDER BY id')]
    ea={}
    for r in con.execute('''SELECT ea.employee_id,a.id,a.title,a.description,a.icon FROM employee_achievements ea JOIN achievements a ON a.id=ea.achievement_id WHERE a.active=1'''):
        ea.setdefault(str(r['employee_id']),[]).append({'id':r['id'],'title':r['title'],'description':r['description'],'icon':r['icon']})
    history=[dict(r) for r in con.execute('SELECT id,employee_id,employee_name,delta,category,reason,created_at FROM history ORDER BY id DESC LIMIT 150')]
    con.close()
    return {'settings':settings,'employees':employees,'tasks':tasks,'rewards':rewards,'achievementsByEmployee':ea,'history':history}


def admin_state():
    con=db()
    settings={r['key']:r['value'] for r in con.execute("SELECT key,value FROM settings WHERE key != 'manager_pin_hash'")}
    out={
      'settings':settings,
      'employees':[dict(r) for r in con.execute('SELECT id,name,role,points,active,created_at FROM employees ORDER BY active DESC,name')],
      'tasks':[dict(r) for r in con.execute('SELECT * FROM tasks ORDER BY id DESC')],
      'rewards':[dict(r) for r in con.execute('SELECT * FROM rewards ORDER BY id DESC')],
      'achievements':[dict(r) for r in con.execute('SELECT * FROM achievements ORDER BY id DESC')],
      'employeeAchievements':[dict(r) for r in con.execute('SELECT employee_id,achievement_id,awarded_at FROM employee_achievements')],
      'history':[dict(r) for r in con.execute('SELECT id,employee_id,employee_name,delta,category,reason,created_at FROM history ORDER BY id DESC LIMIT 500')]
    }
    con.close(); return out


def token_make():
    exp = int(time.time()) + 8*3600
    nonce=secrets.token_hex(8)
    payload=f'{exp}:{nonce}'.encode()
    sig=hmac.new(SECRET,payload,hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(payload).decode().rstrip('=')+'.'+sig


def token_valid(token):
    try:
        p,sig=token.split('.',1)
        payload=base64.urlsafe_b64decode(p+'='*(-len(p)%4))
        good=hmac.new(SECRET,payload,hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig,good): return False
        exp=int(payload.decode().split(':',1)[0])
        return exp>=int(time.time())
    except Exception: return False


class Handler(BaseHTTPRequestHandler):
    server_version='PoehaliGamification/1.0'
    def log_message(self, fmt, *args):
        print('[http]', fmt%args)
    def _json(self, obj, status=200, headers=None):
        data=json.dumps(obj,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(data)))
        self.send_header('Cache-Control','no-store')
        if headers:
            for k,v in headers.items(): self.send_header(k,v)
        self.end_headers(); self.wfile.write(data)
    def _body(self):
        n=int(self.headers.get('Content-Length','0') or 0)
        raw=self.rfile.read(n) if n else b'{}'
        try:return json.loads(raw.decode('utf-8'))
        except:return {}
    def _admin(self):
        c=SimpleCookie(self.headers.get('Cookie',''))
        return token_valid(c.get('manager_session').value if c.get('manager_session') else '')
    def _need_admin(self):
        if not self._admin():
            self._json({'error':'Требуется вход управляющего'},401); return False
        return True
    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/api/state': return self._json(public_state())
        if path=='/api/admin/state':
            if not self._need_admin(): return
            return self._json(admin_state())
        if path=='/api/admin/session': return self._json({'authenticated':self._admin()})
        if path=='/' or path=='/index.html': return self._file(ROOT/'index.html','text/html; charset=utf-8')
        if path=='/assets/logo.png': return self._file(ROOT/'assets'/'logo.png','image/png')
        if path=='/manifest.webmanifest': return self._file(ROOT/'manifest.webmanifest','application/manifest+json; charset=utf-8')
        if path=='/sw.js': return self._file(ROOT/'sw.js','application/javascript; charset=utf-8')
        self.send_error(404)
    def _file(self,p,ctype):
        if not p.exists(): return self.send_error(404)
        data=p.read_bytes(); self.send_response(200); self.send_header('Content-Type',ctype); self.send_header('Content-Length',str(len(data))); self.send_header('Cache-Control','no-cache'); self.end_headers(); self.wfile.write(data)
    def do_POST(self):
        path=urlparse(self.path).path; body=self._body()
        if path=='/api/admin/login':
            con=db(); stored=setting(con,'manager_pin_hash'); con.close()
            if verify_pin(str(body.get('pin','')),stored):
                t=token_make(); return self._json({'ok':True},200,{'Set-Cookie':f'manager_session={t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800'})
            return self._json({'error':'Неверный PIN-код'},403)
        if path=='/api/admin/logout':
            return self._json({'ok':True},200,{'Set-Cookie':'manager_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'})
        if path=='/api/redeem':
            try: eid=int(body['employee_id']); rid=int(body['reward_id'])
            except: return self._json({'error':'Некорректные данные'},400)
            con=db(); e=con.execute('SELECT * FROM employees WHERE id=? AND active=1',(eid,)).fetchone(); r=con.execute('SELECT * FROM rewards WHERE id=? AND active=1',(rid,)).fetchone()
            if not e or not r: con.close(); return self._json({'error':'Сотрудник или приз не найден'},404)
            if e['points']<r['cost']: con.close(); return self._json({'error':'Недостаточно баллов'},400)
            con.execute('UPDATE employees SET points=points-? WHERE id=?',(r['cost'],eid)); con.execute('INSERT INTO history(employee_id,employee_name,delta,category,reason) VALUES(?,?,?,?,?)',(eid,e['name'],-r['cost'],'Приз','Получен приз: '+r['title'])); con.commit(); con.close(); return self._json({'ok':True})
        if not path.startswith('/api/admin/') or not self._need_admin(): return
        con=db()
        try:
            if path=='/api/admin/points':
                eid=int(body['employee_id']); delta=int(body['delta']); cat=str(body.get('category','Другое'))[:80]; reason=str(body.get('reason','')).strip()[:500]
                if delta==0 or not reason: raise ValueError('Укажите баллы и причину')
                e=con.execute('SELECT * FROM employees WHERE id=?',(eid,)).fetchone()
                if not e: raise ValueError('Сотрудник не найден')
                new=max(0,e['points']+delta); applied=new-e['points']; con.execute('UPDATE employees SET points=? WHERE id=?',(new,eid)); con.execute('INSERT INTO history(employee_id,employee_name,delta,category,reason) VALUES(?,?,?,?,?)',(eid,e['name'],applied,cat,reason)); con.commit(); return self._json({'ok':True})
            if path=='/api/admin/employees':
                name=str(body.get('name','')).strip()[:80]; role=str(body.get('role','Сотрудник')).strip()[:80] or 'Сотрудник'; points=max(0,int(body.get('points',0)))
                if not name: raise ValueError('Введите имя')
                cur=con.execute('INSERT INTO employees(name,role,points) VALUES(?,?,?)',(name,role,points)); eid=cur.lastrowid
                if points: con.execute('INSERT INTO history(employee_id,employee_name,delta,category,reason) VALUES(?,?,?,?,?)',(eid,name,points,'Старт','Стартовые баллы'))
                con.commit(); return self._json({'ok':True,'id':eid})
            if path=='/api/admin/tasks':
                title=str(body.get('title','')).strip()[:160]; desc=str(body.get('description','')).strip()[:800]; points=max(0,int(body.get('points',0))); active=1 if body.get('active',True) else 0
                if not title: raise ValueError('Введите название задания')
                cur=con.execute('INSERT INTO tasks(title,description,points,active) VALUES(?,?,?,?)',(title,desc,points,active)); con.commit(); return self._json({'ok':True,'id':cur.lastrowid})
            if path=='/api/admin/rewards':
                title=str(body.get('title','')).strip()[:160]; desc=str(body.get('description','')).strip()[:800]; cost=max(0,int(body.get('cost',0))); active=1 if body.get('active',True) else 0
                if not title: raise ValueError('Введите название приза')
                cur=con.execute('INSERT INTO rewards(title,description,cost,active) VALUES(?,?,?,?)',(title,desc,cost,active)); con.commit(); return self._json({'ok':True,'id':cur.lastrowid})
            if path=='/api/admin/achievements':
                title=str(body.get('title','')).strip()[:160]; desc=str(body.get('description','')).strip()[:800]; icon=str(body.get('icon','★')).strip()[:8] or '★'; active=1 if body.get('active',True) else 0
                if not title: raise ValueError('Введите название достижения')
                cur=con.execute('INSERT INTO achievements(title,description,icon,active) VALUES(?,?,?,?)',(title,desc,icon,active)); con.commit(); return self._json({'ok':True,'id':cur.lastrowid})
            if path=='/api/admin/achievement/assign':
                eid=int(body['employee_id']); aid=int(body['achievement_id']); con.execute('INSERT OR IGNORE INTO employee_achievements(employee_id,achievement_id) VALUES(?,?)',(eid,aid)); con.commit(); return self._json({'ok':True})
            if path=='/api/admin/pin':
                old=str(body.get('old_pin','')); new=str(body.get('new_pin',''))
                stored=setting(con,'manager_pin_hash')
                if not verify_pin(old,stored): return self._json({'error':'Текущий PIN неверен'},403)
                if len(new)<4: raise ValueError('Новый PIN должен содержать минимум 4 символа')
                con.execute("INSERT INTO settings(key,value) VALUES('manager_pin_hash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",(hash_pin(new),)); con.commit(); return self._json({'ok':True})
            if path=='/api/admin/settings':
                for k in ('season_title','tagline','level_step'):
                    if k in body:
                        v=str(body[k]).strip()[:200]
                        if k=='level_step': v=str(max(10,int(v or 200)))
                        con.execute('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',(k,v))
                con.commit(); return self._json({'ok':True})
            return self._json({'error':'Неизвестный маршрут'},404)
        except (ValueError,KeyError) as e:
            con.rollback(); return self._json({'error':str(e)},400)
        finally:
            con.close()
    def do_PUT(self):
        path=urlparse(self.path).path
        if not path.startswith('/api/admin/') or not self._need_admin(): return
        body=self._body(); parts=path.strip('/').split('/')
        if len(parts)!=4: return self._json({'error':'Некорректный маршрут'},404)
        kind, sid=parts[2],parts[3]
        try: oid=int(sid)
        except: return self._json({'error':'Некорректный ID'},400)
        con=db()
        try:
            if kind=='employees':
                name=str(body.get('name','')).strip()[:80]; role=str(body.get('role','Сотрудник')).strip()[:80]; active=1 if body.get('active',True) else 0
                if not name: raise ValueError('Введите имя')
                con.execute('UPDATE employees SET name=?,role=?,active=? WHERE id=?',(name,role,active,oid))
            elif kind=='tasks':
                title=str(body.get('title','')).strip()[:160]; desc=str(body.get('description','')).strip()[:800]; points=max(0,int(body.get('points',0))); active=1 if body.get('active',True) else 0
                if not title: raise ValueError('Введите название')
                con.execute('UPDATE tasks SET title=?,description=?,points=?,active=? WHERE id=?',(title,desc,points,active,oid))
            elif kind=='rewards':
                title=str(body.get('title','')).strip()[:160]; desc=str(body.get('description','')).strip()[:800]; cost=max(0,int(body.get('cost',0))); active=1 if body.get('active',True) else 0
                if not title: raise ValueError('Введите название')
                con.execute('UPDATE rewards SET title=?,description=?,cost=?,active=? WHERE id=?',(title,desc,cost,active,oid))
            elif kind=='achievements':
                title=str(body.get('title','')).strip()[:160]; desc=str(body.get('description','')).strip()[:800]; icon=str(body.get('icon','★')).strip()[:8] or '★'; active=1 if body.get('active',True) else 0
                if not title: raise ValueError('Введите название')
                con.execute('UPDATE achievements SET title=?,description=?,icon=?,active=? WHERE id=?',(title,desc,icon,active,oid))
            else:return self._json({'error':'Неизвестный тип'},404)
            con.commit(); return self._json({'ok':True})
        except ValueError as e: con.rollback(); return self._json({'error':str(e)},400)
        finally: con.close()
    def do_DELETE(self):
        path=urlparse(self.path).path
        if not path.startswith('/api/admin/') or not self._need_admin(): return
        parts=path.strip('/').split('/'); con=db()
        try:
            if len(parts)==5 and parts[2]=='achievement' and parts[3]=='assign':
                # /api/admin/achievement/assign/<employee>-<achievement>
                e,a=parts[4].split('-',1); con.execute('DELETE FROM employee_achievements WHERE employee_id=? AND achievement_id=?',(int(e),int(a))); con.commit(); return self._json({'ok':True})
            if len(parts)!=4:return self._json({'error':'Некорректный маршрут'},404)
            kind, oid=parts[2],int(parts[3]); table={'employees':'employees','tasks':'tasks','rewards':'rewards','achievements':'achievements'}.get(kind)
            if not table:return self._json({'error':'Неизвестный тип'},404)
            if table=='employees':
                c=con.execute('SELECT COUNT(*) c FROM employees WHERE active=1').fetchone()['c']; row=con.execute('SELECT active FROM employees WHERE id=?',(oid,)).fetchone()
                if row and row['active'] and c<=1:return self._json({'error':'Нельзя удалить последнего активного сотрудника'},400)
            con.execute(f'DELETE FROM {table} WHERE id=?',(oid,)); con.commit(); return self._json({'ok':True})
        except Exception as e: con.rollback(); return self._json({'error':str(e)},400)
        finally: con.close()

if __name__=='__main__':
    init_db()
    print(f'Poehali server: http://{HOST}:{PORT}')
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
