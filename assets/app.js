
const APP_VERSION='9.0.7';const A='/api/';let deferredInstallPrompt=null;let token=localStorage.token||'', role=localStorage.role||'', state=null, selectedEmployeeId=null, employeeTabsScroll=0, managerTabsScroll=0, messengerState=null, currentChatId=null, messengerTimer=null, replyToMessage=null, uiText={}, uiReplacements=[], uiBlocks={}, uiRemovedElements=[];


function isStandaloneApp(){
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;
}

function homeNewsHtml(news){
  const items=news||[];
  return `<div class="home-news-feed">
    <div class=row style="align-items:center;margin:18px 0 10px">
      <h2 style="margin:0">Новости</h2>
      <span class=pill style="margin-left:auto">${items.length}</span>
    </div>
    ${items.length?items.map(newsCard).join(''):'<div class=card><p class=muted>Новостей пока нет.</p></div>'}
  </div>`;
}


async function loadTeamDirectory(){
 const root=$('#teamDirectory');if(!root)return;
 try{
   const people=await api('team');
   root.innerHTML=`<h2>Команда</h2><p class=muted>Фотографии и дни рождения коллег.</p><div class=team-grid>${people.map(x=>`<div class=team-profile>
     <img class=team-profile-photo src="${x.photo||'/assets/logo.png'}">
     <h3>${esc(x.name)}</h3>
     <div>${esc(x.position)}</div>
     ${x.birthday?`<div class=team-birthday>🎂 ${new Date(x.birthday).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</div>`:''}
   </div>`).join('')}</div>`;
 }catch(e){root.innerHTML=`<div class=card>${esc(e.message)}</div>`}
}

function installHintHtml(){
  if(isStandaloneApp())return '';
  return `<div id="installAppCard" class="card install-card">
    <h3>📱 Добавьте «Команда · Поехали!» на экран телефона</h3>
    <p class=muted>Так сайт будет открываться как обычное приложение — отдельной иконкой и без лишней строки браузера.</p>
    <div class=install-steps>
      <div class=install-step><b>iPhone / Safari</b>Нажмите «Поделиться» → «На экран Домой» → «Добавить».</div>
      <div class=install-step><b>Android / Chrome</b>Откройте меню браузера → «Добавить на главный экран» или «Установить приложение».</div>
    </div>
    <div class=row>
      <button id=installAppBtn class="btn red" onclick="installPwa()" style="display:none">Установить приложение</button>
      <button class="btn light" onclick="checkPwaInstalled()">Проверить установку</button>
    </div>
    <div id=installAppStatus class=muted style="margin-top:8px;font-size:12px">После запуска с иконки эта подсказка исчезнет автоматически.</div>
  </div>`
}
async function installPwa(){
  const st=$('#installAppStatus');
  if(!deferredInstallPrompt){
    if(st)st.textContent='Используйте меню браузера и выберите «Добавить на главный экран».';
    return;
  }
  try{
    deferredInstallPrompt.prompt();
    const choice=await deferredInstallPrompt.userChoice;
    if(choice?.outcome==='accepted'){
      if(st)st.textContent='Установка запущена. Откройте приложение с новой иконки на главном экране.';
    }
    deferredInstallPrompt=null;
    const b=$('#installAppBtn');if(b)b.style.display='none';
  }catch(e){
    if(st)st.textContent='Не удалось открыть системное окно установки.';
  }
}
function checkPwaInstalled(){
  const card=$('#installAppCard');
  const st=$('#installAppStatus');
  if(isStandaloneApp()){
    if(card)card.remove();
    return;
  }
  if(st)st.textContent='Если иконка уже создана, откройте сайт именно с неё — тогда подсказка исчезнет.';
}
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  deferredInstallPrompt=e;
  const b=$('#installAppBtn');
  if(b)b.style.display='';
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  localStorage.setItem('pwaInstalled','1');
  const card=$('#installAppCard');
  if(card)card.remove();
});



function goHomeFromLogo(){
  try{closeMobileMenu?.()}catch{}
  try{closeManageMenu?.()}catch{}

  const managerEmployee =
    state?.personal?.employee ||
    state?.employee ||
    null;

  const isUnifiedManager =
    managerEmployee?.position==='Управляющий' ||
    (typeof umtab!=='undefined' && state?.personal?.employee);

  if(isUnifiedManager && typeof renderUnifiedManager==='function'){
    if(typeof umtab!=='undefined')umtab='home';
    const app=$('#app');
    if(app){
      app.classList.remove('section-leaving','section-entering');
      transitionToSection(()=>renderUnifiedManager());
    }else{
      renderUnifiedManager();
    }
    return;
  }

  if(state?.employee && typeof renderEmp==='function'){
    if(typeof etab!=='undefined')etab='home';
    const app=$('#app');
    if(app){
      app.classList.remove('section-leaving','section-entering');
      transitionToSection(()=>renderEmp());
    }else{
      renderEmp();
    }
  }
}

function openMobileMenu(){
  renderMobileMenu();
  $('#mobileDrawer')?.classList.add('open');
  document.body.style.overflow='hidden';
}
function closeMobileMenu(){
  $('#mobileDrawer')?.classList.remove('open');
  document.body.style.overflow='';
}
function mobileNavigate(tab){
  closeMobileMenu();
  if((state?.personal?.employee?.position==='Управляющий'||state?.employee?.position==='Управляющий') && typeof umtab!=='undefined'){
    transitionToSection(()=>{umtab=tab;renderUnifiedManager()});return;
  }
  if(typeof etab!=='undefined'){
    transitionToSection(()=>{etab=tab;renderEmp()});
  }
}
function renderMobileMenu(){
  const box=$('#mobileMenuContent');if(!box)return;
  let html='';
  if((state?.personal?.employee?.position==='Управляющий'||state?.employee?.position==='Управляющий') && typeof umtab!=='undefined'){
    const p=state.personal||state;
    const e=p.employee||state.employee||state.personal?.employee;
    const main=[
      ['home','Главная'],['teamEmployee','Команда'],['newsEmployee','Новости'],['tasksEmployee','Задания'],['prizesEmployee','Призы'],
      ...(e?.messenger_access?[['messengerEmployee','Чаты']]:[]),
      ['competitionEmployee','Конкурс'],['ratingEmployee','Рейтинг'],['profileEmployee','Профиль']
    ];
    const admin=[
      ['employees','Сотрудники'],['tasksAdmin','Общие задания'],['individualAdmin','Индивидуальные задания'],
      ['prizesAdmin','Призы'],['achievementsAdmin','Достижения'],['newsAdmin','Новости'],
      ['competitionAdmin','Конкурс'],['messengerAdmin','Мессенджер'],['historyAdmin','История'],
      ['interfaceAdmin','Интерфейс'],['diagnosticsAdmin','Диагностика'],['auditAdmin','Журнал действий'],['safetyAdmin','Архив и резерв'],['settingsAdmin','Настройки']
    ];
    html+=`<div class=mobile-menu-section-title>Разделы</div>${main.map(x=>`<button class="mobile-menu-item ${umtab===x[0]?'active':''}" onclick="mobileNavigate('${x[0]}')">${x[1]}</button>`).join('')}`;
    html+=`<div class=mobile-menu-section-title>Управление</div>${admin.map(x=>`<button class="mobile-menu-item ${umtab===x[0]?'active':''}" onclick="mobileNavigate('${x[0]}')">${x[1]}</button>`).join('')}`;
  }else if(state?.employee){
    const e=state.employee;
    const main=[
      ['home',T('tab.home','Главная')],['team','Команда'],['news',T('tab.news','Новости')],['tasks',T('tab.tasks','Задания')],
      ['prizes',T('tab.prizes','Призы')],
      ...(e.messenger_access?[['messenger',T('tab.messenger','Чаты')]]:[]),
      ...(hasStaffRights?.(e)?[['staff','Управление']]:[]),
      ['competition',T('tab.competition','Конкурс')],['rating',T('tab.rating','Рейтинг')],['profile',T('tab.profile','Профиль')]
    ];
    html+=`<div class=mobile-menu-section-title>Разделы</div>${main.map(x=>`<button class="mobile-menu-item ${etab===x[0]?'active':''}" onclick="mobileNavigate('${x[0]}')">${x[1]}</button>`).join('')}`;
  }else{
    html='<p class=muted>Войдите в аккаунт, чтобы открыть меню.</p>';
  }
  box.innerHTML=html;
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeMobileMenu();
});


function formatDateTyping(value){
  const digits=String(value||'').replace(/\D/g,'').slice(0,8);
  if(digits.length<=2)return digits;
  if(digits.length<=4)return digits.slice(0,2)+'.'+digits.slice(2);
  return digits.slice(0,2)+'.'+digits.slice(2,4)+'.'+digits.slice(4);
}
function isValidDisplayDate(value){
  const m=String(value||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(!m)return false;
  const d=+m[1],mo=+m[2],y=+m[3];
  const dt=new Date(Date.UTC(y,mo-1,d));
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d;
}
function toIsoDate(value){
  if(!value)return null;
  const v=String(value).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
  const m=v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(!m||!isValidDisplayDate(v))return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function fromIsoDate(value){
  if(!value)return '';
  const s=String(value).slice(0,10);
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${m[3]}.${m[2]}.${m[1]}`:s;
}
function initSmartDates(root=document){
  root.querySelectorAll?.('input.date-field').forEach(el=>{
    if(el.dataset.dateReady==='1')return;
    el.dataset.dateReady='1';
    el.addEventListener('input',()=>{
      el.value=formatDateTyping(el.value);
      el.classList.remove('invalid');
    });
    el.addEventListener('blur',()=>{
      if(el.value && !isValidDisplayDate(el.value))el.classList.add('invalid');
      else el.classList.remove('invalid');
    });
  });
}
function dateValue(selector){
  const el=typeof selector==='string'?$(selector):selector;
  if(!el||!el.value)return null;
  const iso=toIsoDate(el.value);
  if(!iso){
    el.classList.add('invalid');
    throw new Error('Введите дату в формате ДД.ММ.ГГГГ');
  }
  return iso;
}


async function checkAppVersion(){
  try{
    const r=await fetch('/api/public/version?ts='+Date.now(),{cache:'no-store'});
    const v=await r.json();
    if(v.version&&v.version!==APP_VERSION)showUpdateBanner(v.version);
  }catch{}
}
function showUpdateBanner(serverVersion){
  if($('#appUpdateBanner'))return;
  const d=document.createElement('div');d.id='appUpdateBanner';d.className='update-banner';
  d.innerHTML=`<div><b>Доступна новая версия</b><br><small>Текущая ${APP_VERSION} → новая ${esc(serverVersion)}</small></div><button class="btn red" onclick="forceAppUpdate()">Обновить приложение</button>`;
  document.body.appendChild(d);
}
async function forceAppUpdate(){
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      for(const r of regs)await r.update();
    }
  }catch{}
  location.reload(true);
}
window.addEventListener('error',e=>console.error('window error',e.error||e.message));
window.addEventListener('unhandledrejection',e=>console.error('unhandled rejection',e.reason));
setTimeout(checkAppVersion,1600);



function employeeGenderLabel(employee){
  if(employee?.gender==='female')return 'Женский';
  if(employee?.gender==='male')return 'Мужской';
  return '';
}

function genderWord(employee,male,female){
  return employee?.gender==='female'?female:male;
}
function acknowledgedWord(employee){
  return genderWord(employee,'Ознакомился','Ознакомилась');
}
function completedWord(employee){
  return genderWord(employee,'Выполнил','Выполнила');
}

function T(key,fallback){return (uiText&&Object.prototype.hasOwnProperty.call(uiText,key))?uiText[key]:fallback}
async function loadUiText(){
  try{uiText=await api('content')}catch{uiText={}}
  try{uiReplacements=await api('content/replacements')}catch{uiReplacements=[]}
  try{uiBlocks=await api('content/blocks')}catch{uiBlocks={}}
  try{uiRemovedElements=await api('content/removed-elements')}catch{uiRemovedElements=[]}
}

function normalizedUiText(el){return (el?.innerText||el?.textContent||'').replace(/\s+/g,' ').trim()}
function applyRemovedElements(root=document){
  if(!uiRemovedElements?.length)return;
  const scope=root.querySelectorAll?root:document;
  for(const rule of uiRemovedElements){
    if(rule.element_type==='button'){
      scope.querySelectorAll('button').forEach(btn=>{
        if(normalizedUiText(btn)===rule.match_text)btn.classList.add('ui-rule-hidden');
      });
    }else if(rule.element_type==='window'){
      scope.querySelectorAll('.card,.auth-panel,.auth-brand,.chat-sidebar,.chat-main').forEach(win=>{
        const heading=win.querySelector('h1,h2,h3,b,label');
        const target=normalizedUiText(heading||win);
        if(target===rule.match_text || target.startsWith(rule.match_text))win.classList.add('ui-rule-hidden');
      });
    }
  }
}
function blockVisible(key){return !uiBlocks?.[key]}
function blockWrap(key,html){return blockVisible(key)?html:''}
function applyBlockVisibility(root=document){
  document.querySelectorAll('[data-ui-block]').forEach(el=>{
    const key=el.getAttribute('data-ui-block');
    el.classList.toggle('ui-block-hidden',!!uiBlocks?.[key]);
  });
}
function applyGlobalTextReplacements(root=document.body){
  if(!root||!uiReplacements?.length)return;
  const map=new Map(uiReplacements.map(x=>[x.source_text,x.replacement_text]));
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
    acceptNode(node){
      if(!node.nodeValue||!node.nodeValue.trim())return NodeFilter.FILTER_REJECT;
      const p=node.parentElement;
      if(!p||['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION','CODE'].includes(p.tagName))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    const raw=node.nodeValue,trim=raw.trim();
    if(map.has(trim)){
      const before=raw.slice(0,raw.indexOf(trim)),after=raw.slice(raw.indexOf(trim)+trim.length);
      node.nodeValue=before+map.get(trim)+after;
    }
  }
  document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el=>{
    const p=el.getAttribute('placeholder');if(map.has(p))el.setAttribute('placeholder',map.get(p));
  });
  document.querySelectorAll('[title]').forEach(el=>{
    const t=el.getAttribute('title');if(map.has(t))el.setAttribute('title',map.get(t));
  });
}
let replacementObserver=null;
function startReplacementObserver(){
  if(replacementObserver)replacementObserver.disconnect();
  replacementObserver=new MutationObserver(muts=>{
    for(const m of muts)for(const n of m.addedNodes)if(n.nodeType===1){applyGlobalTextReplacements(n);applyBlockVisibility(n);applyRemovedElements(n)}
  });
  replacementObserver.observe(document.body,{childList:true,subtree:true});
  applyGlobalTextReplacements(document.body);applyBlockVisibility(document);applyRemovedElements(document);
}
function applyChromeText(){
  const b=document.querySelector('.brand b'),s=document.querySelector('.brand small');
  if(b)b.textContent=T('site.title','КОМАНДА · ПОЕХАЛИ!');
  if(s)s.textContent=T('site.subtitle','Новости, конкурсы и достижения');
  document.title=T('site.browser_title','Команда, поехали!');
  setTimeout(()=>applyGlobalTextReplacements(document.body),0);
}
function saveTabsScroll(kind){
  const t=document.querySelector('.tabs');
  if(!t)return;
  if(kind==='manager')managerTabsScroll=t.scrollLeft;
  else employeeTabsScroll=t.scrollLeft;
}
function restoreTabsScroll(kind){
  const value=kind==='manager'?managerTabsScroll:employeeTabsScroll;
  requestAnimationFrame(()=>{const t=document.querySelector('.tabs');if(t)t.scrollLeft=value});
}
function animateSection(){
  const app=$('#app');if(!app)return;
  app.classList.remove('section-entering','section-leaving');
  void app.offsetWidth;
  app.classList.add('section-entering');initSmartDates(app);
  const cards=[...app.querySelectorAll('.card,.emp-edit-card,.section-item,.home-task,.listitem')].slice(0,18);
  cards.forEach((el,i)=>{
    el.style.animation='none';
    el.offsetHeight;
    el.style.animation=`cardRise .38s ${Math.min(i*28,280)}ms var(--ease-spring) both`;
  });
}
function fireworks(kind='login',amount=42){
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const layer=document.createElement('div');layer.className='fireworks-layer';document.body.appendChild(layer);
  const colors=['#b91c1c','#edb861','#ffffff','#171717','#ffdf7e'];
  const bursts=kind==='points'?3:5;
  for(let b=0;b<bursts;b++){
    const cx=(20+Math.random()*60), cy=(18+Math.random()*40);
    setTimeout(()=>{
      for(let i=0;i<Math.ceil(amount/bursts);i++){
        const s=document.createElement('i');s.className='spark';
        const ang=Math.random()*Math.PI*2, dist=60+Math.random()*120;
        s.style.left=cx+'vw';s.style.top=cy+'vh';
        s.style.setProperty('--dx',Math.cos(ang)*dist+'px');
        s.style.setProperty('--dy',Math.sin(ang)*dist+'px');
        s.style.setProperty('--spark',colors[(Math.random()*colors.length)|0]);
        layer.appendChild(s);
      }
    },b*120)
  }
  if(kind==='login'){
    for(let i=0;i<24;i++){
      const c=document.createElement('i');c.className='confetti';
      c.style.left=(Math.random()*100)+'vw';c.style.top='-20px';
      c.style.setProperty('--x',(-80+Math.random()*160)+'px');
      c.style.setProperty('--c',colors[(Math.random()*colors.length)|0]);
      c.style.animationDelay=(Math.random()*220)+'ms';layer.appendChild(c);
    }
  }
  setTimeout(()=>layer.remove(),1500);
}
function pointCelebration(delta){
  if(Number(delta)<=0)return;
  fireworks('points',30);
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const p=document.createElement('div');p.className='points-pop';p.textContent='+'+delta+' баллов 🚀';document.body.appendChild(p);setTimeout(()=>p.remove(),1250);
}
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function api(path,opt={}){
  opt.headers={...(opt.headers||{}),'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};
  let r;
  try{r=await fetch(A+path,opt)}catch(e){throw Error('Нет соединения с сервером. Проверьте интернет и повторите.')}
  const j=await r.json().catch(()=>({}));
  if(!r.ok){
    const map={400:'Проверьте введённые данные.',401:'Сессия истекла. Войдите заново.',403:'У вас нет прав для этого действия.',404:'Функция временно недоступна.',409:'Данные уже были изменены.',413:'Файл слишком большой.',500:'Сервер временно не смог выполнить операцию.'};
    const err=new Error(j.error||map[r.status]||`Ошибка ${r.status}`);
    err.status=r.status;err.requestId=j.request_id||'';err.payload=j;
    console.error('API error',path,r.status,j);
    throw err;
  }
  return j
}function toast(t){let d=document.createElement('div');d.className='toast';d.textContent=t;document.body.append(d);setTimeout(()=>d.remove(),2200)}function logout(){document.body.classList.remove('authenticated');closeMobileMenu();localStorage.clear();token='';role='';login()}
function file64(inp,cb){let f=inp.files[0];if(!f)return cb(null);if(f.size>900000)return toast('Фото должно быть меньше 900 КБ');let r=new FileReader;r.onload=()=>cb(r.result);r.readAsDataURL(f)}
async function login(){document.body.classList.remove('authenticated');closeMobileMenu();
 role='';selectedEmployeeId=null;$('#who').innerHTML='';
 let em=await api('public/employees');
 $('#app').innerHTML=`<div class="auth-shell">
   <section class="auth-brand">
     <img class="auth-logo" src="/assets/logo.png">
     <div class="auth-kicker">${esc(T('login.kicker','Внутренняя платформа команды'))}</div>
     <h1 class="auth-title">${esc(T('login.title_line1','Команда.'))}<br>${esc(T('login.title_line2','Поехали!'))}</h1>
     <p class="auth-copy">${esc(T('login.description','Новости, конкурсы, индивидуальные задания, достижения и рейтинг команды — в одном месте.'))}</p>
     <div class="auth-points"><span>🚀 Задания</span><span>🏆 Рейтинг</span><span>🎁 Призы</span><span>📰 Новости</span></div>
   </section>
   <section class="auth-panel">
     <h2>${esc(T('login.welcome','Добро пожаловать'))}</h2>
     <p class="lead">${esc(T('login.instruction','Выберите профиль и введите персональный PIN-код.'))}</p>
     <div class="auth-single-note">Вход для сотрудников команды</div>
     <div id="employeeForm" class="employee-form">
       <div class="employee-grid">${em.map(e=>`<button class="employee-choice" data-id="${e.id}" onclick="selectEmployee(${e.id},this)"><img src="${e.photo||'/assets/logo.png'}"><span><b>${esc(e.name)}</b><small>${esc(e.position)}</small></span></button>`).join('')}</div>
       <div class="pin-wrap"><input id="pin" class="field" type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="PIN-код"><button class="pin-eye" onclick="togglePin('pin',this)" type="button">◉</button></div>
       <button class="btn red auth-submit" onclick="empLogin()">${esc(T('login.employee_button','Войти в личный кабинет'))}</button>
       <div class="auth-note">${esc(T('login.employee_note','PIN выдаёт управляющий. Не передавайте его другим сотрудникам.'))}</div>
     </div>
   </section>
 </div>`;animateSection()
}
function authMode(){return}

function selectEmployee(id,el){
 selectedEmployeeId=id;
 document.querySelectorAll('.employee-choice').forEach(x=>x.classList.remove('selected'));
 el.classList.add('selected');
 setTimeout(()=>$('#pin')?.focus(),100);
}
function togglePin(id,btn){
 const x=$('#'+id);if(!x)return;
 x.type=x.type==='password'?'text':'password';
 btn.textContent=x.type==='password'?'◉':'×';
}
function b64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64),out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}

function uint8ToB64Url(arr){
  if(!arr)return '';
  let s='';const a=new Uint8Array(arr);
  for(const b of a)s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function pushState(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return {supported:false};
  const reg=await navigator.serviceWorker.register('/sw.js');
  const sub=await reg.pushManager.getSubscription();
  return {supported:true,permission:Notification.permission,subscribed:!!sub};
}
async function refreshPushStatus(){
  const el=$('#pushStatus');if(!el)return;
  try{
    const browser=await pushState();
    if(!browser.supported){el.textContent='Этот браузер не поддерживает push-уведомления.';return}
    if(browser.permission==='denied'){el.textContent='Уведомления запрещены в настройках устройства/браузера.';return}
    const server=await api('push/status');
    if(!server.configured){el.textContent='Сервер push не настроен.';return}
    if(browser.subscribed&&server.subscriptions>0&&browser.permission==='granted'){
      const card=$('#pushHomeCard');if(card)card.remove();
      return;
    }else{
      el.textContent='Уведомления ещё не включены на этом устройстве.';
    }
  }catch(e){el.textContent='Не удалось проверить push: '+e.message}
}
async function resetPush(){
  try{
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(sub){
      try{await api('push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})})}catch{}
      await sub.unsubscribe();
    }
    toast('Старая push-подписка удалена. Сейчас создадим новую.');
    await enablePush();
  }catch(e){toast('Ошибка переподписки: '+e.message)}
}
async function testPush(){
  try{
    const r=await api('push/test',{method:'POST',body:'{}'});
    if(r.sent>0)toast('Тест отправлен. Уведомление должно появиться через несколько секунд.');
    else if(r.subscriptions===0)toast('Устройство не подписано. Сначала включите уведомления.');
    else toast('Push не доставлен: '+(r.errors?.[0]||'неизвестная ошибка'));
  }catch(e){toast('Ошибка теста: '+e.message)}
}
async function enablePush(){
  try{
    const key=await api('push/key');
    if(!key.publicKey)return toast('Push-уведомления не активированы: отсутствует VAPID public key');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')return toast('Разрешение на уведомления не предоставлено');
    await navigator.serviceWorker.register('/sw.js');
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();

    if(sub){
      const current=uint8ToB64Url(sub.options?.applicationServerKey);
      if(current && current!==key.publicKey){
        try{await api('push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})})}catch{}
        await sub.unsubscribe();
        sub=null;
      }
    }

    if(!sub){
      sub=await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:b64ToUint8Array(key.publicKey)
      });
    }
    await api('push/subscribe',{method:'POST',body:JSON.stringify({subscription:sub.toJSON()})});
    toast('Уведомления включены');
    const card=$('#pushHomeCard');if(card)card.remove();
  }catch(e){toast('Не удалось включить уведомления: '+e.message)}
}


async function ensurePushSubscription(){
  if(!token||!(role==='employee'||role==='supervisor'))return;
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  if(!('serviceWorker' in navigator)||!('PushManager' in window))return;
  try{
    const key=await api('push/key');
    if(!key.publicKey)return;
    await navigator.serviceWorker.register('/sw.js?v='+APP_VERSION);
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    let recreate=false;
    if(sub){
      const current=uint8ToB64Url(sub.options?.applicationServerKey);
      if(!current||current!==key.publicKey)recreate=true;
    }
    if(recreate&&sub){
      try{await api('push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})})}catch{}
      try{await sub.unsubscribe()}catch{}
      sub=null;
    }
    if(!sub){
      sub=await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:b64ToUint8Array(key.publicKey)
      });
    }
    await api('push/subscribe',{method:'POST',body:JSON.stringify({subscription:sub.toJSON()})});
    console.log('push subscription ensured',sub.endpoint.slice(0,36));
  }catch(e){
    console.warn('automatic push repair failed',e);
  }
}

async function showEmployeeWelcome(){
 let employeeName='команду';
 try{
   const me=await api('me'); employeeName=me.employee?.name||employeeName;
 }catch{}
 const layer=document.createElement('div');layer.className='welcome-stage';layer.id='welcomeStage';
 layer.innerHTML=`<div class=welcome-card>
   <img class=welcome-logo src="/assets/logo.png">
   <div class=auth-kicker>КОМАНДА · ПОЕХАЛИ!</div>
   <h1 class=welcome-title>Добро пожаловать<br>в команду!</h1>
   <p class=welcome-copy>${esc(employeeName)}, хорошей смены и отличных результатов 🚀</p>
 </div>`;
 document.body.appendChild(layer);
 initSmartDates(layer);
 fireworks('login',55);
 setTimeout(()=>{
   layer.classList.add('welcome-out');
   setTimeout(()=>{
     layer.remove();
     if(role==='supervisor')supervisor();else employee();
   },520);
 },1700);
}

async function empLogin(){try{if(!selectedEmployeeId)return toast('Сначала выберите сотрудника');let j=await api('login/employee',{method:'POST',body:JSON.stringify({id:+selectedEmployeeId,pin:$('#pin').value})});token=j.token;role=(j.access_role==='supervisor'?'supervisor':'employee');localStorage.token=token;localStorage.role=role;showEmployeeWelcome()}catch(e){toast(e.message)}}
let etab='home';async function employee(){document.body.classList.add('authenticated');try{const prev=Number(localStorage.getItem('lastPoints')||'NaN');state=await api('me');setTimeout(ensurePushSubscription,250);if(state.employee?.position==='Управляющий'){return unifiedManager()}if(Number.isFinite(prev)&&state.employee.points>prev)pointCelebration(state.employee.points-prev);localStorage.setItem('lastPoints',state.employee.points);$('#who').innerHTML=`<button class="btn light" onclick="logout()">Выйти</button>`;renderEmp()}catch{logout()}}function renderEmp(){let e=state.employee;let content={home:`<div class="card hero" data-ui-block="home.profile_summary"><div class="row"><img class="avatar" src="${e.photo||'/assets/logo.png'}"><div><h2>${esc(e.name)}</h2><div>${esc(e.position)}</div></div><div style="margin-left:auto"><div class="score">${e.points}</div><small>баллов</small></div></div></div>
${installHintHtml()}
${homeNewsHtml(state.news)}
<div class="card home-tasks" data-ui-block="home.personal_tasks"><div class="row"><div><h2 style="margin:0">${esc(T('home.personal_tasks_title','Мои индивидуальные задания'))}</h2><div class="muted">${esc(T('home.personal_tasks_subtitle','Новые задания появляются здесь сразу после входа'))}</div></div><button class="btn red" onclick="etab='tasks';renderEmp()">${esc(T('home.all_tasks_button','Все задания'))}</button></div>
${(state.individualTasks||[]).filter(x=>x.status!=='completed').length?(state.individualTasks||[]).filter(x=>x.status!=='completed').slice(0,4).map(x=>`<div class=section-item>${x.image?`<img class=section-item-image src="${x.image}">`:''}<div class="home-task"><div class="task-head"><b>${esc(x.title)}</b><span class="pill">+${x.points}</span></div><p>${esc(x.description)}</p>${x.due_date?`<small>Срок: ${new Date(x.due_date).toLocaleDateString('ru')}</small>`:''}<div><b>${x.status==='submitted'?'✓ На проверке':'● Нужно выполнить'}</b></div>${x.status==='assigned'?`<button class="btn red" style="margin-top:9px" onclick="etab='tasks';renderEmp()">Открыть задание</button>`:''}</div>`).join(''):`<p>${esc(T('home.no_personal_tasks','Активных индивидуальных заданий сейчас нет.'))}</p>`}
</div>
<div id="pushHomeCard" class="card notify-card" data-ui-block="home.notifications"><h3>🔔 Разрешить уведомления</h3><p class="muted">Включите уведомления, чтобы получать новости, новые задания, конкурсы и сообщения из внутреннего мессенджера.</p><div class="row"><button class="btn" onclick="enablePush()">Включить уведомления</button><button class="btn light" onclick="testPush()">Проверить доставку</button></div><div class="notify-status" id="pushStatus">Проверяем статус…</div></div>
<div class="grid" data-ui-block="home.news_achievements"><div class="card"><h3>${esc(T('home.latest_news','Последние новости'))}</h3>${state.news.slice(0,3).map(newsCard).join('')||'Новостей пока нет'}</div><div class="card"><h3>${esc(T('home.achievements','Мои достижения'))}</h3>${state.achievements.map(a=>`<div class=listitem>${esc(a.icon)} <b>${esc(a.title)}</b><br><small>${esc(a.description)}</small></div>`).join('')||'Пока нет достижений'}</div></div>`,team:`<div id="teamDirectory"></div>`,news:`<div data-ui-block="section.news"><h2>${esc(T('section.news_title','Новости'))}</h2>${state.news.map(newsCard).join('')||'<div class=card>Новостей пока нет</div>'}</div>`,tasks:`<div data-ui-block="section.tasks"><h2>${esc(T('section.tasks_title','Задания'))}</h2><div class=card><h3>${esc(T('home.personal_tasks_title','Мои индивидуальные задания'))}</h3>${(state.individualTasks||[]).length?(state.individualTasks||[]).map(x=>`<div class=section-item>${x.image?`<img class=section-item-image src="${x.image}">`:''}<div class="listitem task-personal"><b>${esc(x.title)}</b><p>${esc(x.description)}</p><span class=pill>+${x.points} баллов</span>${x.due_date?` <small>до ${new Date(x.due_date).toLocaleDateString('ru')}</small>`:''}<p><b>Статус:</b> ${x.status==='assigned'?'назначено':x.status==='submitted'?'на проверке':'выполнено'}</p>${x.status==='assigned'?`<textarea id="ic${x.id}" class=field placeholder="Комментарий к выполнению (необязательно)"></textarea><button class="btn red" onclick="submitIndividual(${x.id})">Отправить на проверку</button>`:''}</div>`).join(''):'Индивидуальных заданий пока нет.'}</div><h2>${esc(T('section.general_tasks','Общие задания'))}</h2>${state.tasks.map(x=>`<div class=section-item>${x.image?`<img class=section-item-image src="${x.image}">`:''}<div class=card><b>${esc(x.title)}</b><p>${esc(x.description)}</p><span class=pill>+${x.points} баллов</span></div></div>`).join('')}</div>`,prizes:`<div data-ui-block="section.prizes"><h2>${esc(T('section.prizes_title','Призы'))}</h2>${state.prizes.map(x=>`<div class=section-item>${x.image?`<img class=section-item-image src="${x.image}">`:''}<div class=card><b>${esc(x.title)}</b><p>${esc(x.description)}</p><span class=pill>${x.cost} баллов</span></div></div>`).join('')}</div>`,messenger:`<div data-ui-block="section.messenger"><div id="messengerRoot"></div></div>`,staff:`<div id="staffRoot"></div>`,competition:`<div data-ui-block="section.competition"><h2>Гонка экипажей</h2>${state.competition?`<div class="card hero"><h2>${esc(state.competition.title)}</h2><p>${esc(state.competition.description)}</p><div class="score">${state.competition.my_score}</div><b>Ваше место: ${state.competition.my_place||'—'}</b><p>${state.competition.starts_on||''}${state.competition.ends_on?' — '+state.competition.ends_on:''}</p></div><div class=grid><div class=card><h3>Задания</h3>${state.competition.tasks.map(t=>`<div class=listitem><b>${esc(t.title)}</b> <span class=pill>+${t.points}</span><br><small>${esc(t.description)}</small></div>`).join('')}</div><div class=card><h3>TOP команды</h3>${state.competition.board.map((x,i)=>`<div class="listitem row"><b>${i+1}</b><img class=avatar src="${x.photo||'/assets/logo.png'}"><span>${esc(x.name)}</span><b style="margin-left:auto">${x.score}</b></div>`).join('')}<hr><b>Уровни конкурса</b><p>🚀 На старте — 100<br>🛰 Первый космический — 250<br>🌟 На орбите — 500</p></div></div>`:'<div class=card>Активного конкурса сейчас нет.</div>'}</div>`,rating:`<div data-ui-block="section.rating"><h2>${esc(T('section.rating_title','Рейтинг команды'))}</h2><div class=card>${state.ranking.map((x,i)=>`<div class="listitem row"><b>${i+1}</b><img class=avatar src="${x.photo||'/assets/logo.png'}"><span>${esc(x.name)}</span><b style="margin-left:auto">${x.points}</b></div>`).join('')}</div></div>`,profile:`<div class=card data-ui-block="section.profile"><h2>${esc(T('section.profile_title','Мой профиль'))}</h2><img class=avatar src="${e.photo||'/assets/logo.png'}"><p><b>${esc(e.name)}</b><br>${esc(e.position)}</p><label>${esc(T('profile.upload_photo','Загрузить фотографию'))}</label><input id=pfile class=field type=file accept="image/*" onchange="startProfileCrop(this)"><div class=file-note>Фото можно выбрать размером до 12 МБ. Перед сохранением откроется обрезка.</div><button class="btn red" onclick="startProfileCrop($('#pfile'))">Обрезать и сохранить фото</button><h3>${esc(T('profile.points_history','История баллов'))}</h3>${state.history.map(h=>`<div class=listitem><b>${h.delta>0?'+':''}${h.delta}</b> — ${esc(h.reason)} <small>${new Date(h.created_at).toLocaleString('ru')}</small></div>`).join('')}</div>`};$('#app').innerHTML=`<div class=tabs>${[['home',T('tab.home','Главная')],['team','Команда'],['news',T('tab.news','Новости')],['tasks',T('tab.tasks','Задания')],['prizes',T('tab.prizes','Призы')],...(e.messenger_access?[['messenger',T('tab.messenger','Чаты')]]:[]),...(hasStaffRights(e)?[['staff','Управление']]:[]),['competition',T('tab.competition','Конкурс')],['rating',T('tab.rating','Рейтинг')],['profile',T('tab.profile','Профиль')]].map(x=>`<button class="${etab==x[0]?'active':''}" onclick="saveTabsScroll('employee');etab='${x[0]}';renderEmp();if('${x[0]}'==='competition')setTimeout(()=>document.querySelector('#app')?.classList.add('launchPulse'),20)">${x[1]}</button>`).join('')}</div>${content[etab]}`;animateSection();restoreTabsScroll('employee');applyBlockVisibility(document);applyRemovedElements(document);setTimeout(()=>{if(etab==='home')refreshPushStatus()},120);if(etab==='messenger')setTimeout(()=>loadMessenger(),30);else stopMessengerPolling();if(etab==='staff')setTimeout(()=>loadStaffPanel(),30);if(etab==='home'&&deferredInstallPrompt)setTimeout(()=>{const b=$('#installAppBtn');if(b)b.style.display=''},30);if(etab==='team')setTimeout(()=>loadTeamDirectory(),30)}


function hasStaffRights(e){return !!(e.can_manage_tasks||e.can_assign_individual||e.can_manage_news||e.can_manage_competition||e.can_manage_prizes||e.can_manage_achievements||e.can_manage_permissions)}
let staffState=null,staffTab='tasks';
async function loadStaffPanel(){const root=$('#staffRoot');if(!root)return;try{staffState=await api('staff/state');renderStaffPanel()}catch(e){root.innerHTML=`<div class=card>${esc(e.message)}</div>`}}
function staffTabs(){const p=staffState.permissions,r=[];if(p.can_manage_tasks)r.push(['tasks','Общие задания']);if(p.can_assign_individual)r.push(['individual','Индивидуальные']);if(p.can_manage_news)r.push(['news','Новости']);if(p.can_manage_competition)r.push(['competition','Конкурсы']);if(p.can_manage_prizes)r.push(['prizes','Призы']);if(p.can_manage_achievements)r.push(['achievements','Достижения']);if(p.can_manage_permissions)r.push(['permissions','Права сотрудников']);if(!r.some(x=>x[0]===staffTab))staffTab=r[0]?.[0]||'tasks';return r}
function renderStaffPanel(){const root=$('#staffRoot');if(!root)return;const tabs=staffTabs();root.innerHTML=`<div class="card hero"><h2>Панель управления</h2><p>Доступны только разрешённые функции.</p></div><div class=tabs>${tabs.map(x=>`<button class="${staffTab===x[0]?'active':''}" onclick="staffTab='${x[0]}';renderStaffPanel()">${x[1]}</button>`).join('')}</div>${staffSection()}`}
function staffSection(){
 const p=staffState.permissions;
 if(staffTab==='tasks'&&p.can_manage_tasks)return `<div class=card><h2>Новое общее задание</h2><input id=stTitle class=field placeholder="Название"><textarea id=stDesc class=field placeholder="Описание"></textarea><input id=stPts class=field type=number placeholder="Баллы"><label>Фото (необязательно)</label><input id=stImg class=field type=file accept="image/*"><button class="btn red" onclick="staffCreateTask()">Создать</button></div>`;
 if(staffTab==='individual'&&p.can_assign_individual)return `<div class=card><h2>Индивидуальное задание</h2><select id=siEmp class=field>${staffState.employees.filter(e=>e.active).map(e=>`<option value=${e.id}>${esc(e.name)} — ${esc(e.position)}</option>`).join('')}</select><input id=siTitle class=field placeholder="Название"><textarea id=siDesc class=field placeholder="Описание"></textarea><div class=grid><input id=siPts class=field type=number placeholder="Баллы"><input id=siDue class="field date-field" type=text inputmode=numeric maxlength=10 placeholder="ДД.ММ.ГГГГ"><small class=date-help>ДД.ММ.ГГГГ</small></div><label>Фото (необязательно)</label><input id=siImg class=field type=file accept="image/*"><button class="btn red" onclick="staffCreateIndividual()">Назначить</button></div>`;
 if(staffTab==='news'&&p.can_manage_news)return `<div class=card><h2>Новая новость</h2><input id=snTitle class=field placeholder="Заголовок"><textarea id=snBody class=field placeholder="Текст"></textarea><label>Фото (необязательно)</label><input id=snImg class=field type=file accept="image/*"><button class="btn red" onclick="staffCreateNews()">Опубликовать</button></div>`;
 if(staffTab==='competition'&&p.can_manage_competition)return `<div class=card><h2>Конкурс</h2><input id=scTitle class=field value="${esc(staffState.competition?.title||'')}" placeholder="Название"><textarea id=scDesc class=field>${esc(staffState.competition?.description||'')}</textarea><button class="btn red" onclick="staffSaveCompetition()">Сохранить конкурс</button></div><div class=card><h3>Задание конкурса</h3><input id=sctTitle class=field placeholder="Название"><textarea id=sctDesc class=field placeholder="Описание"></textarea><input id=sctPts class=field type=number placeholder="Баллы"><button class=btn onclick="staffAddCompetitionTask()">Добавить</button></div>`;
 if(staffTab==='prizes'&&p.can_manage_prizes)return `<div class=card><h2>Новый приз</h2><input id=spTitle class=field placeholder="Название"><textarea id=spDesc class=field placeholder="Описание"></textarea><input id=spCost class=field type=number placeholder="Стоимость"><label>Фото (необязательно)</label><input id=spImg class=field type=file accept="image/*"><button class="btn red" onclick="staffCreatePrize()">Добавить</button></div>`;
 if(staffTab==='achievements'&&p.can_manage_achievements)return `<div class=card><h2>Новое достижение</h2><input id=saIcon class=field placeholder="Значок"><input id=saTitle class=field placeholder="Название"><textarea id=saDesc class=field placeholder="Описание"></textarea><button class="btn red" onclick="staffCreateAchievement()">Добавить</button></div>`;
 if(staffTab==='permissions'&&p.can_manage_permissions)return `<div class=card><h2>Права сотрудников</h2>${staffState.employees.map(e=>`<div class=card><b>${esc(e.name)}</b><br><small>${esc(e.position)}</small><div class=grid style="margin-top:10px"><label><input id="pt${e.id}" type=checkbox ${e.can_manage_tasks?'checked':''}> Общие задания</label><label><input id="pi${e.id}" type=checkbox ${e.can_assign_individual?'checked':''}> Индивидуальные</label><label><input id="pn${e.id}" type=checkbox ${e.can_manage_news?'checked':''}> Новости</label><label><input id="pc${e.id}" type=checkbox ${e.can_manage_competition?'checked':''}> Конкурсы</label><label><input id="pp${e.id}" type=checkbox ${e.can_manage_prizes?'checked':''}> Призы</label><label><input id="pa${e.id}" type=checkbox ${e.can_manage_achievements?'checked':''}> Достижения</label><label><input id="pr${e.id}" type=checkbox ${e.can_manage_permissions?'checked':''}> Выдавать права</label></div><button class="btn red" onclick="staffSavePermissions(${e.id})">Сохранить права</button></div>`).join('')}</div>`;
 return '<div class=card>Нет доступных функций</div>'
}
async function staffCreateTask(){file64($('#stImg'),async image=>{await api('staff/tasks',{method:'POST',body:JSON.stringify({title:$('#stTitle').value,description:$('#stDesc').value,points:+$('#stPts').value,image:image||null})});toast('Задание создано');await loadStaffPanel()})}
async function staffCreateIndividual(){file64($('#siImg'),async image=>{await api('staff/individual-tasks',{method:'POST',body:JSON.stringify({employee_id:+$('#siEmp').value,title:$('#siTitle').value,description:$('#siDesc').value,points:+$('#siPts').value,due_date:dateValue('#siDue'),image:image||null})});toast('Задание назначено');await loadStaffPanel()})}
async function staffCreateNews(){file64($('#snImg'),async image=>{await api('staff/news',{method:'POST',body:JSON.stringify({title:$('#snTitle').value,body:$('#snBody').value,category:'Для команды',image:image||null})});toast('Новость опубликована');await loadStaffPanel()})}
async function staffSaveCompetition(){await api('staff/competition/settings',{method:'POST',body:JSON.stringify({title:$('#scTitle').value,description:$('#scDesc').value,active:true})});toast('Конкурс сохранён');await loadStaffPanel()}
async function staffAddCompetitionTask(){await api('staff/competition/tasks',{method:'POST',body:JSON.stringify({title:$('#sctTitle').value,description:$('#sctDesc').value,points:+$('#sctPts').value})});toast('Задание конкурса добавлено');await loadStaffPanel()}
async function staffCreatePrize(){file64($('#spImg'),async image=>{await api('staff/prizes',{method:'POST',body:JSON.stringify({title:$('#spTitle').value,description:$('#spDesc').value,cost:+$('#spCost').value,image:image||null})});toast('Приз добавлен');await loadStaffPanel()})}
async function staffCreateAchievement(){await api('staff/achievements',{method:'POST',body:JSON.stringify({icon:$('#saIcon').value,title:$('#saTitle').value,description:$('#saDesc').value})});toast('Достижение добавлено');await loadStaffPanel()}
async function staffSavePermissions(id){await api('staff/permissions',{method:'POST',body:JSON.stringify({employee_id:id,can_manage_tasks:$('#pt'+id).checked,can_assign_individual:$('#pi'+id).checked,can_manage_news:$('#pn'+id).checked,can_manage_competition:$('#pc'+id).checked,can_manage_prizes:$('#pp'+id).checked,can_manage_achievements:$('#pa'+id).checked,can_manage_permissions:$('#pr'+id).checked})});toast('Права сохранены');await loadStaffPanel()}

function stopMessengerPolling(){if(messengerTimer){clearInterval(messengerTimer);messengerTimer=null}}
function isOnline(ts){return ts&&(Date.now()-new Date(ts).getTime()<120000)}
async function loadMessenger(){
  try{
    messengerState=await api('messenger/state');
    renderMessenger();
    stopMessengerPolling();
    messengerTimer=setInterval(async()=>{
      if(etab!=='messenger')return stopMessengerPolling();
      try{messengerState=await api('messenger/state');renderChatList();if(currentChatId)await refreshMessages(false)}catch{}
    },3500);
    const q=new URLSearchParams(location.search),cid=Number(q.get('chat'));
    if(cid){currentChatId=cid;await openChat(cid)}
  }catch(e){$('#messengerRoot').innerHTML=`<div class=card>${esc(e.message)}</div>`}
}
function renderMessenger(){
 const root=$('#messengerRoot');if(!root)return;
 root.innerHTML=`<div class="chat-layout">
   <aside class="chat-sidebar">
    <div class="chat-tools">
      <div class=row><h2 style="margin:0;flex:1">${esc(T('messenger.title','Чаты'))}</h2><button class="btn red" onclick="togglePeople()">＋</button></div>
      <input id=chatSearch class=field placeholder="${esc(T('messenger.search_placeholder','Поиск'))}" oninput="renderChatList()">
    </div>
    <div id=peoplePop class=people-pop></div>
    <div id=chatList class=chat-list></div>
    <div id=groupMaker class=group-maker></div>
    <div id=chatMembersPanel class=group-maker></div>
   </aside>
   <section id=chatMain class=chat-main>
     <div class=card style="margin:auto;box-shadow:none;border:0;background:transparent;text-align:center"><h2>${esc(T('messenger.select_chat','Выберите чат'))}</h2><p class=muted>${esc(T('messenger.empty_text','Личные и групповые сообщения команды'))}</p></div>
   </section>
 </div>`;
 renderPeople();renderChatList()
}
function renderPeople(){
 const p=$('#peoplePop');if(!p)return;
 p.innerHTML=`<b>${esc(T('messenger.new_chat','Новый чат'))}</b>${messengerState.people.map(x=>`<div class=person-pick onclick="startDirect(${x.id})"><img class=avatar style="width:38px;height:38px" src="${x.photo||'/assets/logo.png'}"><span><b>${esc(x.name)}</b><br><small>${esc(x.position)}${isOnline(x.last_seen)?' · в сети':''}</small></span></div>`).join('')}<button class="btn light" style="width:100%;margin-top:8px" onclick="openGroupMaker()">${esc(T('messenger.create_group','Создать группу'))}</button>`
}
function togglePeople(){$('#peoplePop')?.classList.toggle('open')}
function renderChatList(){
 const box=$('#chatList');if(!box)return;
 const q=($('#chatSearch')?.value||'').toLowerCase();
 const list=(messengerState?.chats||[]).filter(c=>(c.display_title||'').toLowerCase().includes(q)||(c.last_message||'').toLowerCase().includes(q));
 box.innerHTML=list.map(c=>`<div class="chat-row ${currentChatId===c.id?'active':''}" onclick="openChat(${c.id})">
   <img class=avatar src="${c.photo||'/assets/logo.png'}">
   <div class=chat-row-main><b>${esc(c.display_title)}</b><span class=chat-preview>${esc(c.last_message||'Нет сообщений')}</span></div>
   ${c.unread?`<span class=unread>${c.unread}</span>`:''}
 </div>`).join('')||'<div class=muted style="padding:20px;text-align:center">Чатов пока нет</div>'
}
async function startDirect(id){
 const r=await api('messenger/direct',{method:'POST',body:JSON.stringify({employee_id:id})});
 currentChatId=r.id;$('#peoplePop')?.classList.remove('open');messengerState=await api('messenger/state');renderChatList();await openChat(r.id)
}
function openGroupMaker(){
 const g=$('#groupMaker');g.classList.add('open');
 g.innerHTML=`<b>Новая группа</b><input id=groupTitle class=field placeholder="Название группы">${messengerState.people.map(x=>`<label class=person-pick><input type=checkbox class=groupMember value="${x.id}"><span>${esc(x.name)}</span></label>`).join('')}<button class="btn red" style="width:100%" onclick="createGroup()">Создать</button>`;
 $('#peoplePop')?.classList.remove('open')
}

function openChatMembers(chatId){
 const c=messengerState.chats.find(x=>x.id===chatId);if(!c)return;
 const g=$('#chatMembersPanel');if(!g)return;
 const memberIds=new Set((c.members||[]).map(x=>x.id));
 const choices=(messengerState.people||[]).filter(x=>!memberIds.has(x.id));
 g.classList.add('open');
 g.innerHTML=`<div class=row><b style="flex:1">Участники чата</b><button class="btn light" onclick="$('#chatMembersPanel').classList.remove('open')">×</button></div>
 ${c.members.map(x=>`<div class=person-pick><img class=avatar style="width:34px;height:34px" src="${x.photo||'/assets/logo.png'}"><span>${esc(x.name)}</span></div>`).join('')}
 <hr>
 <b>Добавить сотрудника</b>
 ${choices.length?choices.map(x=>`<div class=person-pick onclick="addChatMember(${chatId},${x.id})"><img class=avatar style="width:34px;height:34px" src="${x.photo||'/assets/logo.png'}"><span>${esc(x.name)}</span></div>`).join(''):'<p class=muted>Все доступные сотрудники уже в чате.</p>'}`;
}
async function addChatMember(chatId,employeeId){
 await api('messenger/members/add',{method:'POST',body:JSON.stringify({chat_id:chatId,employee_id:employeeId})});
 toast('Сотрудник добавлен в чат');
 messengerState=await api('messenger/state');
 renderChatList();
 await openChat(chatId);
 openChatMembers(chatId);
}
async function leaveChat(chatId){
 if(!confirm('Покинуть этот чат?'))return;
 await api('messenger/leave',{method:'POST',body:JSON.stringify({chat_id:chatId})});
 toast('Вы покинули чат');
 currentChatId=null;
 messengerState=await api('messenger/state');
 renderMessenger();
}
async function renameChat(chatId,current){
 const title=prompt('Новое название чата:',current||'');
 if(title===null)return;
 const val=title.trim();if(!val)return toast('Введите название');
 await api('messenger/rename',{method:'POST',body:JSON.stringify({chat_id:chatId,title:val})});
 toast('Название изменено');
 messengerState=await api('messenger/state');
 renderMessenger();
 currentChatId=chatId;
 await openChat(chatId);
}

async function createGroup(){
 const ids=[...document.querySelectorAll('.groupMember:checked')].map(x=>+x.value);
 const r=await api('messenger/group',{method:'POST',body:JSON.stringify({title:$('#groupTitle').value||'Новая группа',member_ids:ids})});
 currentChatId=r.id;messengerState=await api('messenger/state');renderMessenger();await openChat(r.id)
}
async function openChat(id){
 currentChatId=id;replyToMessage=null;renderChatList();
 const c=messengerState.chats.find(x=>x.id===id);if(!c)return;
 const main=$('#chatMain');main.classList.add('mobile-open');
 main.innerHTML=`<div class=chat-head>
   <button class="btn light chat-back" onclick="closeMobileChat()">←</button>
   <img class=avatar src="${c.photo||'/assets/logo.png'}">
   <div style="flex:1"><b>${esc(c.display_title)}</b><div class=muted style="font-size:11px">${c.type==='group'?c.members.length+' участников':(isOnline(c.members.find(x=>x.id!==state.employee.id)?.last_seen)?'в сети':'')}</div></div>
   ${c.type==='group'?`<button class="btn light" onclick="openChatMembers(${c.id})">Участники</button><button class="btn light" onclick="renameChat(${c.id},'${esc((c.display_title||'').replace(/'/g,'&#39;'))}')">Переименовать</button>`:''}
   <button class="btn danger" onclick="leaveChat(${c.id})">Покинуть</button>
 </div>
 <div id=typingLine class=typing></div>
 <div id=chatMessages class=chat-messages></div>
 <div class=chat-compose>
   <div id=replyActive></div>
   <div class=compose-row>
     <input id=msgImage type=file accept="image/*" style="display:none" onchange="showFileSelected()">
     <button class="btn light compose-action" onclick="$('#msgImage').click()">📎</button>
     <textarea id=msgText class=field placeholder="${esc(T('messenger.message_placeholder','Сообщение'))}" oninput="typingPing()" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}"></textarea>
     <button class="btn red compose-action" onclick="sendMessage()">➤</button>
   </div>
 </div>`;
 await refreshMessages(true)
}
function closeMobileChat(){$('#chatMain')?.classList.remove('mobile-open');currentChatId=null;replyToMessage=null}
async function refreshMessages(scrollBottom=true){
 if(!currentChatId)return;
 const r=await api('messenger/messages?chat_id='+currentChatId);
 const box=$('#chatMessages');if(!box)return;
 const me=state.employee.id;
 box.innerHTML=r.messages.map(m=>{
   const mine=m.sender_id===me;
   if(m.deleted)return `<div class="msg ${mine?'mine':''}"><div class=bubble><i class=muted>Сообщение удалено</i></div></div>`;
   return `<div class="msg ${mine?'mine':''}">
    <img class=msg-avatar src="${m.sender_photo||'/assets/logo.png'}">
    <div class=bubble>
      ${!mine?`<div class=msg-name>${esc(m.sender_name||'')}</div>`:''}
      ${m.reply_to?`<div class=reply-box><b>${esc(m.reply_sender||'')}</b><br>${esc((m.reply_body||'').slice(0,90))}</div>`:''}
      ${m.image?`<img class=msg-img src="${m.image}">`:''}
      <div>${esc(m.body).replace(/\n/g,'<br>')}</div>
      <div class=reactions>${(m.reactions||[]).map(x=>`<button class=react onclick="reactMsg(${m.id},'${x.reaction}')">${x.reaction} ${x.count}</button>`).join('')}</div>
      <div class=msg-actions><button onclick="setReply(${m.id},'${esc((m.body||'').replace(/'/g,'&#39;').slice(0,80))}')">↩ Ответить</button><button onclick="reactMsg(${m.id},'👍')">👍</button><button onclick="reactMsg(${m.id},'❤️')">❤️</button><button onclick="reactMsg(${m.id},'🔥')">🔥</button>${mine?`<button onclick="editMsg(${m.id},'${esc((m.body||'').replace(/'/g,'&#39;'))}')">Изм.</button><button onclick="deleteMsg(${m.id})">Удалить</button>`:''}</div>
      <div class=msg-meta>${m.edited_at?'изменено · ':''}${new Date(m.created_at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}</div>
    </div>
   </div>`
 }).join('');
 const t=$('#typingLine');if(t)t.textContent=r.typers.length?r.typers.map(x=>x.name).join(', ')+' печатает…':'';
 if(scrollBottom)box.scrollTop=box.scrollHeight
}
let typingTimer=0;function typingPing(){clearTimeout(typingTimer);typingTimer=setTimeout(()=>api('messenger/typing',{method:'POST',body:JSON.stringify({chat_id:currentChatId})}).catch(()=>{}),250)}
function setReply(id,text){replyToMessage=id;const r=$('#replyActive');if(r)r.innerHTML=`<div class=reply-active>Ответ: ${text} <button onclick="replyToMessage=null;$('#replyActive').innerHTML=''">×</button></div>`}
function showFileSelected(){const f=$('#msgImage')?.files?.[0];if(f)toast('Фото выбрано: '+f.name)}
async function sendMessage(){
 const txt=$('#msgText')?.value||'',inp=$('#msgImage');
 const send=async image=>{
   await api('messenger/messages',{method:'POST',body:JSON.stringify({chat_id:currentChatId,body:txt,image,reply_to:replyToMessage})});
   $('#msgText').value='';if(inp)inp.value='';replyToMessage=null;$('#replyActive').innerHTML='';await refreshMessages(true);messengerState=await api('messenger/state');renderChatList()
 };
 if(inp?.files?.[0])file64(inp,p=>p&&send(p));else await send(null)
}
async function reactMsg(id,reaction){await api('messenger/reaction',{method:'POST',body:JSON.stringify({message_id:id,reaction})});await refreshMessages(false)}
async function editMsg(id,old){const text=prompt('Изменить сообщение:',old);if(text===null)return;await api('messenger/messages',{method:'PUT',body:JSON.stringify({id,body:text})});await refreshMessages(false)}
async function deleteMsg(id){if(!confirm('Удалить сообщение?'))return;await api('messenger/messages',{method:'DELETE',body:JSON.stringify({id})});await refreshMessages(false)}

async function submitIndividual(id){await api('individual-task/submit',{method:'POST',body:JSON.stringify({id,comment:$('#ic'+id)?.value||''})});toast('Задание отправлено на проверку');employee()}
function newsCard(n){return `<div class=listitem>${n.image?`<img class=newsimg src="${n.image}">`:''}<div class=news-title-row><span class=pill>${esc(n.category)}</span><h3>${esc(n.title)}</h3>${n.pinned?'<span class=news-pin>📌</span>':''}</div><p>${esc(n.body)}</p>${n.event_date?`<b>Дата: ${new Date(n.event_date).toLocaleDateString('ru')}</b>`:''}${n.requires_ack&&!n.acknowledged?`<p><button class="btn red" onclick="ack(${n.id})">${acknowledgedWord(state?.employee||state?.personal?.employee)}</button></p>`:n.requires_ack?`<p>✓ ${acknowledgedWord(state?.employee||state?.personal?.employee)}</p>`:''}</div>`}async function ack(id){await api('news/ack',{method:'POST',body:JSON.stringify({news_id:id})});await employee()}
let cropState={
  source:null,
  sourceW:0,
  sourceH:0,
  baseScale:1,
  scale:1,
  x:0,
  y:0,
  startX:0,
  startY:0,
  drag:false,
  fileInput:null,
  objectUrl:null
};

async function decodeProfileImage(file){
  if('createImageBitmap' in window){
    try{
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      return {source:bitmap,width:bitmap.width,height:bitmap.height,cleanup:()=>bitmap.close?.()};
    }catch(e){
      console.warn('createImageBitmap failed, falling back to Image',e);
    }
  }

  const url=URL.createObjectURL(file);
  const img=new Image();
  img.decoding='async';
  const loaded=new Promise((resolve,reject)=>{
    img.onload=()=>resolve();
    img.onerror=()=>reject(new Error('Браузер не смог открыть этот формат изображения'));
  });
  img.src=url;
  await loaded;
  return {
    source:img,
    width:img.naturalWidth,
    height:img.naturalHeight,
    cleanup:()=>URL.revokeObjectURL(url)
  };
}

async function startProfileCrop(input){
  const file=input?.files?.[0];
  if(!file)return toast('Выберите фотографию');
  if(!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name||'')){
    return toast('Выберите файл изображения');
  }
  if(file.size>12*1024*1024)return toast('Максимальный размер исходного фото — 12 МБ');

  const statusFileName=(file.name||'').toLowerCase();
  if(/\.(heic|heif)$/.test(statusFileName) || /heic|heif/.test(file.type||'')){
    // Safari support varies. We try decoding, but show a meaningful error if it cannot.
    console.info('Attempting HEIC/HEIF decode');
  }

  try{
    if(cropState.cleanup)cropState.cleanup();
    const decoded=await decodeProfileImage(file);

    cropState={
      ...cropState,
      source:decoded.source,
      sourceW:decoded.width,
      sourceH:decoded.height,
      cleanup:decoded.cleanup,
      x:0,y:0,scale:1,
      fileInput:input
    };

    const modal=$('#cropModal');
    modal.classList.add('open');
    document.body.style.overflow='hidden';

    // Wait until the modal has real dimensions.
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    const stage=$('#cropStage');
    const sw=stage.clientWidth,sh=stage.clientHeight;
    if(!sw||!sh)throw new Error('Не удалось определить размер окна обрезки');

    cropState.baseScale=Math.max(sw/cropState.sourceW,sh/cropState.sourceH);
    $('#cropZoom').value='1';
    updateCropTransform();
  }catch(e){
    console.error('profile image decode error',e);
    closeCropper();
    if(/heic|heif/i.test(file.type||'') || /\.(heic|heif)$/i.test(file.name||'')){
      toast('Этот HEIC/HEIF-файл браузер не смог открыть. Выберите фото в JPG/PNG или сделайте скриншот фотографии.');
    }else{
      toast(e.message||'Не удалось открыть фотографию');
    }
  }
}

function closeCropper(){
  $('#cropModal')?.classList.remove('open');
  document.body.style.overflow='';
}

function clampCropPosition(){
  const stage=$('#cropStage');
  if(!stage||!cropState.source)return;
  const totalScale=cropState.baseScale*cropState.scale;
  const w=cropState.sourceW*totalScale;
  const h=cropState.sourceH*totalScale;
  const maxX=Math.max(0,(w-stage.clientWidth)/2);
  const maxY=Math.max(0,(h-stage.clientHeight)/2);
  cropState.x=Math.max(-maxX,Math.min(maxX,cropState.x));
  cropState.y=Math.max(-maxY,Math.min(maxY,cropState.y));
}

function renderCropPreview(){
  const stage=$('#cropStage'),canvas=$('#cropCanvas');
  if(!stage||!canvas||!cropState.source)return;

  const cssW=stage.clientWidth,cssH=stage.clientHeight;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const pxW=Math.max(1,Math.round(cssW*dpr));
  const pxH=Math.max(1,Math.round(cssH*dpr));
  if(canvas.width!==pxW)canvas.width=pxW;
  if(canvas.height!==pxH)canvas.height=pxH;

  const ctx=canvas.getContext('2d',{alpha:false});
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#f3eadc';
  ctx.fillRect(0,0,cssW,cssH);

  const totalScale=cropState.baseScale*cropState.scale;
  const dw=cropState.sourceW*totalScale;
  const dh=cropState.sourceH*totalScale;
  const dx=(cssW-dw)/2+cropState.x;
  const dy=(cssH-dh)/2+cropState.y;

  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(cropState.source,dx,dy,dw,dh);
}

function updateCropTransform(){
  cropState.scale=Number($('#cropZoom')?.value)||1;
  clampCropPosition();
  renderCropPreview();
}

(function initCropDrag(){
  document.addEventListener('pointerdown',e=>{
    const stage=e.target.closest?.('#cropStage');
    if(!stage||!cropState.source)return;
    cropState.drag=true;
    cropState.startX=e.clientX-cropState.x;
    cropState.startY=e.clientY-cropState.y;
    stage.setPointerCapture?.(e.pointerId);
  });
  document.addEventListener('pointermove',e=>{
    if(!cropState.drag)return;
    cropState.x=e.clientX-cropState.startX;
    cropState.y=e.clientY-cropState.startY;
    clampCropPosition();
    renderCropPreview();
  });
  document.addEventListener('pointerup',()=>cropState.drag=false);
  window.addEventListener('resize',()=>{
    if($('#cropModal')?.classList.contains('open')&&cropState.source){
      const stage=$('#cropStage');
      cropState.baseScale=Math.max(stage.clientWidth/cropState.sourceW,stage.clientHeight/cropState.sourceH);
      updateCropTransform();
    }
  });
})();

async function applyCrop(){
  if(!cropState.source||!cropState.sourceW||!cropState.sourceH){
    return toast('Сначала выберите фотографию');
  }

  const stage=$('#cropStage');
  if(!stage)return;

  try{
    const stageW=stage.clientWidth;
    const stageH=stage.clientHeight;
    const totalScale=cropState.baseScale*cropState.scale;

    const displayedW=cropState.sourceW*totalScale;
    const displayedH=cropState.sourceH*totalScale;
    const left=(stageW-displayedW)/2+cropState.x;
    const top=(stageH-displayedH)/2+cropState.y;

    let sx=(-left)/totalScale;
    let sy=(-top)/totalScale;
    let sw=stageW/totalScale;
    let sh=stageH/totalScale;

    sw=Math.min(sw,cropState.sourceW);
    sh=Math.min(sh,cropState.sourceH);
    sx=Math.max(0,Math.min(cropState.sourceW-sw,sx));
    sy=Math.max(0,Math.min(cropState.sourceH-sh,sy));

    const output=768;
    const canvas=document.createElement('canvas');
    canvas.width=output;
    canvas.height=output;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Canvas недоступен');

    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,output,output);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(cropState.source,sx,sy,sw,sh,0,0,output,output);

    // Verify that the produced image is not blank/black by sampling pixels.
    const sample=ctx.getImageData(0,0,output,output).data;
    let luminance=0,samples=0;
    const step=4*4096;
    for(let i=0;i<sample.length;i+=step){
      luminance+=sample[i]+sample[i+1]+sample[i+2];
      samples++;
    }
    if(samples && luminance/samples<3){
      throw new Error('Предпросмотр получился пустым. Попробуйте выбрать другое фото или JPG/PNG.');
    }

    const blob=await new Promise((resolve,reject)=>{
      canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось подготовить JPEG')),'image/jpeg',0.88);
    });
    if(blob.size<5000)throw new Error('Получилось пустое изображение');

    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error('Не удалось прочитать обработанное фото'));
      reader.readAsDataURL(blob);
    });

    await saveCroppedProfilePhoto(data);
    closeCropper();
    if(cropState.fileInput)cropState.fileInput.value='';
  }catch(e){
    console.error('crop error',e);
    toast(e.message||'Не удалось обработать фото');
  }
}

async function saveCroppedProfilePhoto(data){
  try{
    const result=await api('me/photo',{method:'POST',body:JSON.stringify({photo:data})});
    if(result?.error)throw new Error(result.error);
    const fresh=await api('me');
    toast('Фото профиля сохранено');
    if(fresh?.employee?.position==='Управляющий'){
      state=fresh;
      await unifiedManager();
    }else if(role==='supervisor'){
      state=fresh;
      await supervisor();
    }else{
      state=fresh;
      renderEmp();
    }
  }catch(e){
    console.error('profile photo save error',e);
    toast(e.message||'Не удалось сохранить фото')
  }
}

function savePhoto(){startProfileCrop($('#pfile'))}

let umtab='home';
async function unifiedManager(){document.body.classList.add('authenticated');
  try{
    const personal=state&&state.employee?state:await api('me');
    const admin=await api('admin/state');
    state={...admin,personal};
    $('#who').innerHTML=`<span class=supervisor-badge>Управляющий</span> <button class="btn light" onclick="logout()">Выйти</button>`;
    renderUnifiedManager()
  }catch(e){toast(e.message);logout()}
}

function toggleManageMenu(ev){
  ev?.stopPropagation();
  const menu=document.querySelector('.manage-menu');
  if(!menu)return;
  const open=!menu.classList.contains('open');
  document.querySelectorAll('.manage-menu.open').forEach(x=>x.classList.remove('open'));
  menu.classList.toggle('open',open);
  const btn=menu.querySelector('.manage-trigger');
  if(btn)btn.setAttribute('aria-expanded',open?'true':'false');
}

function transitionToSection(callback){
  const app=$('#app');
  if(!app){callback();return}
  app.classList.remove('section-entering');
  app.classList.add('section-leaving');
  setTimeout(()=>{
    callback();
    requestAnimationFrame(()=>animateSection());
  },150);
}

function closeManageMenu(){
  document.querySelectorAll('.manage-menu.open').forEach(menu=>{
    menu.classList.remove('open');
    const btn=menu.querySelector('.manage-trigger');
    if(btn)btn.setAttribute('aria-expanded','false');
  });
}
document.addEventListener('click',ev=>{
  if(!ev.target.closest('.manage-menu'))closeManageMenu();
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape')closeManageMenu();
});

function renderUnifiedManager(){
  const p=state.personal, e=p.employee;
  const mainTabs=[
    ['home','Главная'],
    ['teamEmployee','Команда'],
    ['newsEmployee','Новости'],
    ['tasksEmployee','Задания'],
    ['prizesEmployee','Призы'],
    ...(e.messenger_access?[['messengerEmployee','Чаты']]:[]),
    ['competitionEmployee','Конкурс'],
    ['ratingEmployee','Рейтинг'],
    ['profileEmployee','Профиль']
  ];
  const adminTabs=[
    ['employees','Сотрудники'],
    ['tasksAdmin','Общие задания'],
    ['individualAdmin','Индивидуальные задания'],
    ['prizesAdmin','Призы'],
    ['achievementsAdmin','Достижения'],
    ['newsAdmin','Новости'],
    ['competitionAdmin','Конкурс'],
    ['messengerAdmin','Мессенджер'],
    ['historyAdmin','История'],
    ['interfaceAdmin','Интерфейс'],
    ['diagnosticsAdmin','Диагностика'],['auditAdmin','Журнал действий'],['safetyAdmin','Архив и резерв'],['settingsAdmin','Настройки']
  ];
  let content={
    home:`<div class="card hero"><div class=row><img class=avatar src="${e.photo||'/assets/logo.png'}"><div><h2>${esc(e.name)}</h2><div>${esc(e.position)}</div></div><div style="margin-left:auto"><div class=score>${e.points}</div><small>баллов</small></div></div><p>Личный кабинет и управление командой объединены.</p></div>
      ${installHintHtml()}
      ${homeNewsHtml(p.news)}
      <div class="card home-tasks"><h3>Мои индивидуальные задания</h3>${(p.individualTasks||[]).filter(x=>x.status!=='completed').map(x=>`<div class=section-item>${x.image?`<img class=section-item-image src="${x.image}">`:''}<div class=home-task><b>${esc(x.title)}</b><p>${esc(x.description)}</p><span class=pill>+${x.points}</span></div></div>`).join('')||'<p class=muted>Активных заданий нет.</p>'}</div>`,
    teamEmployee:`<div id="teamDirectory"></div>`,
    newsEmployee:`<h2>Новости</h2>${(p.news||[]).map(newsCard).join('')||'<div class=card>Новостей пока нет.</div>'}`,
    tasksEmployee:`<h2>Задания</h2><div class=card><h3>Мои индивидуальные задания</h3>${(p.individualTasks||[]).map(x=>`<div class=section-item>${x.image?`<img class=section-item-image src="${x.image}">`:''}<div class="listitem task-personal"><b>${esc(x.title)}</b><p>${esc(x.description)}</p><span class=pill>+${x.points}</span></div></div>`).join('')||'Индивидуальных заданий пока нет.'}</div><h2>Общие задания</h2>${(p.tasks||[]).map(x=>`<div class=section-item>${x.image?`<img class=section-item-image src="${x.image}">`:''}<div class=card><b>${esc(x.title)}</b><p>${esc(x.description)}</p><span class=pill>+${x.points}</span></div></div>`).join('')}`,
    prizesEmployee:`<h2>Призы</h2>${(p.prizes||[]).map(x=>`<div class=section-item>${x.image?`<img class=section-item-image src="${x.image}">`:''}<div class=card><b>${esc(x.title)}</b><p>${esc(x.description)}</p><span class=pill>${x.cost} баллов</span></div></div>`).join('')}`,
    messengerEmployee:`<div id="messengerRoot"></div>`,
    competitionEmployee:`<h2>Конкурс</h2>${p.competition?`<div class="card hero"><h2>${esc(p.competition.title)}</h2><p>${esc(p.competition.description)}</p><div class=score>${p.competition.my_score}</div><b>Ваше место: ${p.competition.my_place||'—'}</b></div>`:'<div class=card>Активного конкурса сейчас нет.</div>'}`,
    ratingEmployee:`<h2>Рейтинг команды</h2><div class=card>${(p.ranking||[]).map((x,i)=>`<div class="listitem row"><b>${i+1}</b><img class=avatar src="${x.photo||'/assets/logo.png'}"><span>${esc(x.name)}</span><b style="margin-left:auto">${x.points}</b></div>`).join('')}</div>`,
    profileEmployee:`<div class=card><h2>Мой профиль</h2><img class=avatar src="${e.photo||'/assets/logo.png'}"><p><b>${esc(e.name)}</b><br>${esc(e.position)}</p><label>Загрузить фотографию</label><input id=pfile class=field type=file accept="image/*" onchange="startProfileCrop(this)"><div class=file-note>Фото можно выбрать размером до 12 МБ. Перед сохранением откроется обрезка.</div><button class="btn red" onclick="startProfileCrop($('#pfile'))">Обрезать и сохранить фото</button></div>`,
    employees:empAdmin(),
    tasksAdmin:crudList('Задания',state.tasks,'task'),
    individualAdmin:individualAdmin(),
    prizesAdmin:crudList('Призы',state.prizes,'prize'),
    achievementsAdmin:achAdmin(),
    newsAdmin:newsAdmin(),
    competitionAdmin:competitionAdmin(),
    messengerAdmin:messengerAdmin(),
    historyAdmin:`<div class=card><h2>История баллов</h2>${state.history.map(h=>`<div class=listitem><b>${esc(h.employee_name||'')}</b>: ${h.delta>0?'+':''}${h.delta} — ${esc(h.reason)} <small>${new Date(h.created_at).toLocaleString('ru')}</small></div>`).join('')}</div>`,
    interfaceAdmin:interfaceAdmin(),diagnosticsAdmin:`<div id="diagnosticsRoot"></div>`,auditAdmin:`<div id="auditRoot"></div>`,safetyAdmin:`<div id="safetyRoot"></div>`,
    settingsAdmin:`<div class=card><h2>Настройки</h2><p class=muted>Версия приложения 9.0.0</p><label>Название сезона</label><input id=season class=field value="${esc(state.settings.season)}"><label>Баллов на уровень</label><input id=levelstep class=field type=number value="${state.settings.level_step}"><button class="btn red" onclick="saveUnifiedSettings()">Сохранить</button></div>`
  };
  if(!content[umtab])umtab='home';
  const isAdminTab=adminTabs.some(x=>x[0]===umtab);
  $('#app').innerHTML=`<div class=manager-nav-wrap>
    <div class=tabs>${mainTabs.map(x=>`<button class="${umtab===x[0]?'active':''}" onclick="closeManageMenu();transitionToSection(()=>{umtab='${x[0]}';renderUnifiedManager()})">${x[1]}</button>`).join('')}</div>
    <div class=manage-menu>
      <button class="manage-trigger ${isAdminTab?'active':''}" type=button aria-expanded="false" onclick="toggleManageMenu(event)">Управление ▾</button>
      <div class=manage-dropdown onclick="event.stopPropagation()">${adminTabs.map(x=>`<button class="${umtab===x[0]?'active':''}" onclick="closeManageMenu();transitionToSection(()=>{umtab='${x[0]}';renderUnifiedManager()})">${x[1]}</button>`).join('')}</div>
    </div>
  </div>${content[umtab]}`;
  animateSection();applyBlockVisibility(document);applyRemovedElements(document);
  if(umtab==='messengerEmployee')setTimeout(()=>loadMessenger(),30);
  if(umtab==='messengerAdmin')setTimeout(()=>loadMessengerAdmin(),30);
  if(umtab==='interfaceAdmin')setTimeout(()=>{renderReplacementList();renderRemovedElements()},30);if(umtab==='diagnosticsAdmin')setTimeout(()=>loadDiagnostics(),30);if(umtab==='auditAdmin')setTimeout(()=>loadAuditLog(),30);if(umtab==='safetyAdmin')setTimeout(()=>loadSafetyCenter(),30);if(umtab==='home'&&deferredInstallPrompt)setTimeout(()=>{const b=$('#installAppBtn');if(b)b.style.display=''},30);if(umtab==='teamEmployee')setTimeout(()=>loadTeamDirectory(),30);
}
async function saveUnifiedSettings(){
  await api('admin/settings',{method:'POST',body:JSON.stringify({season:$('#season').value,level_step:+$('#levelstep').value,manager_pin:null})});
  toast('Настройки сохранены');await unifiedManager()
}


async function loadDiagnostics(){
 const root=$('#diagnosticsRoot');if(!root)return;
 root.innerHTML='<div class=card>Проверяем систему…</div>';
 try{
   const d=await api('admin/diagnostics');
   const browserPush=('Notification' in window)?Notification.permission:'не поддерживается';
   const sw=await navigator.serviceWorker?.getRegistration?.();
   root.innerHTML=`<div class=card><h2>Диагностика системы</h2><p class=muted>Версия ${esc(d.version)} · ${esc(d.environment)}</p>
     <div class=status-grid>
       <div class=status-card><b>База данных</b><p class=status-ok>● Работает</p><small>Ответ: ${d.database.latency_ms} мс</small></div>
       <div class=status-card><b>Push-сервер</b><p class="${d.push.configured?'status-ok':'status-bad'}">● ${d.push.configured?'Настроен':'Не настроен'}</p><small>Подписок: ${d.push.subscriptions}</small></div>
       <div class=status-card><b>Service Worker</b><p class="${sw?'status-ok':'status-bad'}">● ${sw?'Активен':'Не найден'}</p><small>Разрешение браузера: ${esc(browserPush)}</small></div>
       <div class=status-card><b>Cron дней рождения</b><p class="${d.cron?.birthday_cron?'status-ok':'status-bad'}">● ${d.cron?.birthday_cron?'Есть последний запуск':'Запуск ещё не зафиксирован'}</p><small>${d.cron?.birthday_cron?.updated_at?new Date(d.cron.birthday_cron.updated_at).toLocaleString('ru'):'—'}</small></div>
       <div class=status-card><b>Резервные снимки</b><p class=status-ok>${d.counts.backups}</p><small>Хранятся в Neon</small></div>
       <div class=status-card><b>Журнал действий</b><p class=status-ok>${d.counts.audit}</p><small>Событий записано</small></div><div class=status-card><b>Последний push</b><p class="${d.last_push?.value?.sent>0?'status-ok':'status-bad'}">● ${d.last_push?.value?`${d.last_push.value.sent||0} доставлено / ${d.last_push.value.failed||0} ошибок`:'Нет данных'}</p><small>${d.last_push?.value?.context?esc(d.last_push.value.context):'—'}</small></div>
     </div>
     <div class=row style="margin-top:14px"><button class="btn red" onclick="loadDiagnostics()">Обновить диагностику</button><button class="btn light" onclick="testPush()">Тест push на это устройство</button></div>
   </div>`;
 }catch(e){root.innerHTML=`<div class=card><h2>Диагностика</h2><p class=status-bad>${esc(e.message)}</p></div>`}
}
async function loadAuditLog(){
 const root=$('#auditRoot');if(!root)return;
 try{
  const rows=await api('admin/audit');
  root.innerHTML=`<div class=card><h2>Журнал действий</h2><p class=muted>Кто и когда менял важные данные.</p>
  ${rows.map(x=>`<div class=audit-row><b>${esc(x.actor_name||'Система')}</b> · ${esc(x.action)}${x.entity_type?` · ${esc(x.entity_type)} #${esc(x.entity_id||'')}`:''}<br><small>${new Date(x.created_at).toLocaleString('ru')}</small></div>`).join('')||'<p>Записей пока нет.</p>'}</div>`;
 }catch(e){root.innerHTML=`<div class=card>${esc(e.message)}</div>`}
}
async function loadSafetyCenter(){
 const root=$('#safetyRoot');if(!root)return;
 try{
  const [archive,backups]=await Promise.all([api('admin/archive'),api('admin/backups')]);
  const groups=[['employees','Сотрудники'],['tasks','Задания'],['prizes','Призы'],['achievements','Достижения'],['news','Новости'],['individual','Индивидуальные задания'],['competitionTasks','Задания конкурса'],['chats','Чаты']];
  root.innerHTML=`<div class=card><h2>Архив и резервное копирование</h2>
    <p class=muted>Удаление важных объектов теперь отправляет их в архив. Их можно вернуть.</p>
    <div class=row><button class="btn red" onclick="createBackup()">Создать резервный снимок</button><button class="btn light" onclick="loadSafetyCenter()">Обновить</button></div>
  </div>
  <div class=card><h3>Резервные снимки Neon</h3>${backups.map(b=>`<div class="listitem row"><div style="flex:1"><b>#${b.id} ${esc(b.label||'Снимок')}</b><br><small>${new Date(b.created_at).toLocaleString('ru')} · ${Math.round((b.bytes||0)/1024)} КБ</small></div><button class="btn light" onclick="downloadBackup(${b.id})">Скачать JSON</button><button class="btn danger" onclick="deleteBackup(${b.id})">Удалить</button></div>`).join('')||'<p>Снимков пока нет.</p>'}</div>
  ${groups.map(([key,title])=>`<div class="card archive-group"><h3>${title}</h3>${(archive[key]||[]).map(x=>`<div class="listitem row"><div style="flex:1"><b>${esc(x.title||'Без названия')}</b><br><small>${esc(x.subtitle||'')} · ${new Date(x.archived_at).toLocaleString('ru')}</small></div><button class="btn ok" onclick="restoreArchive('${key}',${x.id})">Вернуть</button></div>`).join('')||'<p class=muted>Архив пуст.</p>'}</div>`).join('')}`;
 }catch(e){root.innerHTML=`<div class=card>${esc(e.message)}</div>`}
}
async function createBackup(){
 const r=await api('admin/backups',{method:'POST',body:JSON.stringify({label:'Ручной снимок '+new Date().toLocaleString('ru')})});
 toast('Резервный снимок создан');await loadSafetyCenter()
}
async function downloadBackup(id){
 const r=await api('admin/backups/export?id='+id);
 const blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`poehali-backup-${id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
async function deleteBackup(id){
 if(!confirm('Удалить этот резервный снимок?'))return;
 await api('admin/backups',{method:'DELETE',body:JSON.stringify({id})});await loadSafetyCenter()
}
async function restoreArchive(kind,id){
 if(!confirm('Вернуть объект из архива?'))return;
 await api('admin/archive/restore',{method:'POST',body:JSON.stringify({kind,id})});
 toast('Объект восстановлен');await unifiedManager();umtab='safetyAdmin';renderUnifiedManager();setTimeout(loadSafetyCenter,30)
}

let mtab='employees';async function manager(){document.body.classList.add('authenticated');try{state=await api('admin/state');$('#who').innerHTML=`<b>${esc(T('admin.role_label','Управляющий'))}</b> <button class="btn light" onclick="logout()">Выйти</button>`;renderMgr()}catch{logout()}}function renderMgr(){let c={employees:`<div data-ui-block="admin.employees">${empAdmin()}</div>`,tasks:`<div data-ui-block="admin.tasks">${crudList('Задания',state.tasks,'task')}</div>`,prizes:`<div data-ui-block="admin.prizes">${crudList('Призы',state.prizes,'prize')}</div>`,achievements:`<div data-ui-block="admin.achievements">${achAdmin()}</div>`,news:`<div data-ui-block="admin.news">${newsAdmin()}</div>`,competition:`<div data-ui-block="admin.competition">${competitionAdmin()}</div>`,individual:`<div data-ui-block="admin.individual">${individualAdmin()}</div>`,messengerAdmin:`<div data-ui-block="admin.messenger">${messengerAdmin()}</div>`,interface:interfaceAdmin(),history:`<div data-ui-block="admin.history"><div class=card><h2>${esc(T('profile.points_history','История баллов'))}</h2>${state.history.map(h=>`<div class=listitem><b>${esc(h.employee_name||'')}</b>: ${h.delta>0?'+':''}${h.delta} — ${esc(h.reason)} <small>${new Date(h.created_at).toLocaleString('ru')}</small></div>`).join('')}</div></div>`,settings:`<div class=card data-ui-block="admin.settings"><h2>Настройки</h2><label>Название сезона</label><input id=season class=field value="${esc(state.settings.season)}"><label>Баллов на уровень</label><input id=levelstep class=field type=number value="${state.settings.level_step}"><label>Новый PIN управляющего (необязательно)</label><input id=newmpin class=field type=password><button class="btn red" onclick="saveSettings()">Сохранить</button></div>`};$('#app').innerHTML=`<div class=tabs>${[['employees',T('admin.tab.employees','Сотрудники')],['tasks',T('admin.tab.tasks','Задания')],['prizes',T('admin.tab.prizes','Призы')],['achievements',T('admin.tab.achievements','Достижения')],['news',T('admin.tab.news','Новости')],['competition',T('admin.tab.competition','Конкурс')],['individual',T('admin.tab.individual','Индивидуальные задания')],['messengerAdmin',T('admin.tab.messenger','Мессенджер')],['history',T('admin.tab.history','История')],['interface',T('admin.tab.interface','Редактор интерфейса')],['settings',T('admin.tab.settings','Настройки')]].map(x=>`<button class="${mtab==x[0]?'active':''}" onclick="mtab='${x[0]}';renderMgr()">${x[1]}</button>`).join('')}</div>${c[mtab]}`;animateSection();restoreTabsScroll('manager');applyBlockVisibility(document);applyRemovedElements(document);if(mtab==='interface')setTimeout(()=>{renderReplacementList();renderRemovedElements()},30);if(mtab==='messengerAdmin')setTimeout(()=>loadMessengerAdmin(),30)}
function empAdmin(){return `<div class=card>
<h2 style="margin-bottom:6px">Сотрудники и управляющий персонал</h2>
<p class=muted style="margin-top:0">Создание, редактирование карточек, доступы, роли, PIN-коды и участие в рейтинге.</p>
<div class=grid3>
  <input id=en class=field placeholder="Имя сотрудника">
  <select id=ep class=field><option>Руководитель</option><option>Управляющий</option><option>Старший официант</option><option>Шеф-бармен</option><option>Официант</option><option>Бармен</option></select><label>Пол<select id=egender class=field><option value=male>Мужской</option><option value=female>Женский</option></select></label>
  <input id=epin class=field placeholder="Индивидуальный PIN">
  <label>Дата рождения<input id=ebday class="field date-field" type=text inputmode=numeric maxlength=10 placeholder="ДД.ММ.ГГГГ"><small class=date-help>Например: 25031990 → 25.03.1990</small></label>
</div>
<div class=grid>
  <label>Уровень доступа<select id=ear class=field><option value="employee">Сотрудник</option><option value="supervisor">Наблюдатель / руководитель</option></select></label>
  <div class=toggle-line><input id=etm type=checkbox checked><span>Показывать как участника команды</span></div>
  <div class=toggle-line><input id=ema type=checkbox><span>Доступ к внутреннему мессенджеру</span></div>
</div>
<button class="btn red" onclick="addEmp()">Добавить сотрудника</button>
</div>
${state.employees.map(e=>`<div class=emp-edit-card>
  <div class=emp-edit-head>
    <img class=avatar src="${e.photo||'/assets/logo.png'}">
    <div class=emp-edit-meta>
      <h3>${esc(e.name)}</h3>
      <small>${esc(e.position)} · ${e.active?'Активен':'Заблокирован'} · ${e.team_member?'Участник команды':'Не участвует в рейтинге'}</small>
    </div>
    <div class=score>${e.points}</div>
  </div>

  <div class=emp-edit-grid>
    <label>Имя<input id="name${e.id}" class=field value="${esc(e.name)}"></label>
    <label>Должность
      <select id="pos${e.id}" class=field>
        ${['Руководитель','Управляющий','Старший официант','Шеф-бармен','Официант','Бармен'].map(p=>`<option ${e.position===p?'selected':''}>${p}</option>`).join('')}
      </select>
    </label>
    <label>Уровень доступа
      <select id="ar${e.id}" class=field>
        <option value="employee" ${e.access_role!=='supervisor'?'selected':''}>Сотрудник</option>
        <option value="supervisor" ${e.access_role==='supervisor'?'selected':''}>Наблюдатель / руководитель</option>
      </select>
    </label>
    <label>Новый PIN<input id="p${e.id}" class=field placeholder="Оставьте пустым, если не меняете"></label>
    <label>Пол<select id="gender${e.id}" class=field><option value=male ${e.gender!=='female'?'selected':''}>Мужской</option><option value=female ${e.gender==='female'?'selected':''}>Женский</option></select></label><label>Дата рождения<input id="bday${e.id}" class="field date-field" type=text inputmode=numeric maxlength=10 placeholder="ДД.ММ.ГГГГ" value="${fromIsoDate(e.birthday)}"></label>
  </div>

  <div class=permission-panel>
    <h4>Доступы и отображение</h4>
    <div class=permission-grid>
      <label class=toggle-line><input id="tm${e.id}" type=checkbox ${e.team_member?'checked':''}><span>Участник команды</span></label>
      <label class=toggle-line><input id="ma${e.id}" type=checkbox ${e.messenger_access?'checked':''}><span>Доступ к мессенджеру</span></label>
    </div>
  </div>

  <div class=permission-panel>
    <h4>Служебные права</h4>
    <div class=permission-grid>
      <label class=toggle-line><input id="ptm${e.id}" type=checkbox ${e.can_manage_tasks?'checked':''}><span>Общие задания</span></label>
      <label class=toggle-line><input id="pim${e.id}" type=checkbox ${e.can_assign_individual?'checked':''}><span>Индивидуальные задания</span></label>
      <label class=toggle-line><input id="pnm${e.id}" type=checkbox ${e.can_manage_news?'checked':''}><span>Новости</span></label>
      <label class=toggle-line><input id="pcm${e.id}" type=checkbox ${e.can_manage_competition?'checked':''}><span>Конкурсы</span></label>
      <label class=toggle-line><input id="ppm${e.id}" type=checkbox ${e.can_manage_prizes?'checked':''}><span>Призы</span></label>
      <label class=toggle-line><input id="pam${e.id}" type=checkbox ${e.can_manage_achievements?'checked':''}><span>Достижения</span></label>
      <label class=toggle-line><input id="prm${e.id}" type=checkbox ${e.can_manage_permissions?'checked':''}><span>Выдавать права другим</span></label>
    </div>
  </div>

  <div class=emp-edit-grid style="margin-top:14px">
    <input id="d${e.id}" class=field type=number placeholder="Баллы (+/-)">
    <input id="r${e.id}" class=field placeholder="Причина изменения баллов">
  </div>

  <div class=emp-edit-actions>
    <button class="btn red" onclick="saveEmployeeCard(${e.id},${e.active})">Сохранить карточку</button>
    <button class=btn onclick="points(${e.id})">Изменить баллы</button>
    <button class="btn ${e.active?'danger':'ok'}" onclick="toggleEmployeeActive(${e.id},${!e.active})">${e.active?'Заблокировать':'Разблокировать'}</button>
    <button class="btn danger" onclick="del('employees',${e.id})">Удалить</button>
  </div>
</div>`).join('')}`}
async function addEmp(){await api('admin/employees',{method:'POST',body:JSON.stringify({name:$('#en').value,position:$('#ep').value,pin:$('#epin').value,access_role:$('#ear').value,team_member:$('#etm').checked,messenger_access:$('#ema').checked,birthday:$('#ebday').value?dateValue('#ebday'):null})});toast('Сотрудник добавлен');manager()}
async function points(id){let delta=+$('#d'+id).value;await api('admin/points',{method:'POST',body:JSON.stringify({employee_id:id,delta,reason:$('#r'+id).value})});pointCelebration(delta);manager()}
async function saveEmployeeCard(id,active){
 const payload={
   id,
   name:$('#name'+id).value.trim(),
   position:$('#pos'+id).value,
   birthday:$('#bday'+id).value?dateValue('#bday'+id):null,gender:$('#gender'+id)?.value||'male',
   active,
   access_role:$('#ar'+id).value,
   team_member:$('#tm'+id).checked,
   messenger_access:$('#ma'+id).checked,
   can_manage_tasks:$('#ptm'+id).checked,
   can_assign_individual:$('#pim'+id).checked,
   can_manage_news:$('#pnm'+id).checked,
   can_manage_competition:$('#pcm'+id).checked,
   can_manage_prizes:$('#ppm'+id).checked,
   can_manage_achievements:$('#pam'+id).checked,
   can_manage_permissions:$('#prm'+id).checked
 };
 const pin=$('#p'+id).value.trim();
 if(pin)payload.pin=pin;
 const genderSaved=await api('admin/employees/gender',{
   method:'POST',
   body:JSON.stringify({id,gender:payload.gender})
 });
 const saved=await api('admin/employees',{method:'PUT',body:JSON.stringify(payload)});
 const persistedGender=saved?.employee?.gender||genderSaved?.employee?.gender;
 if(persistedGender!==payload.gender){
   throw new Error('Сервер не подтвердил сохранение пола. Попробуйте ещё раз.');
 }
 if(saved?.employee){
   const idx=state.employees?.findIndex(x=>x.id===id);
   if(idx>=0)state.employees[idx]={...state.employees[idx],...saved.employee};
 }
 toast(`Карточка сохранена · пол: ${persistedGender==='female'?'Женский':'Мужской'}`);
 await manager();
}
async function toggleEmployeeActive(id,active){
 const e=state.employees.find(x=>x.id===id);if(!e)return;
 await api('admin/employees',{method:'PUT',body:JSON.stringify({
   id,name:e.name,position:e.position,birthday:e.birthday||null,gender:e.gender||'male',active,
   access_role:e.access_role,team_member:e.team_member,messenger_access:e.messenger_access,
   can_manage_tasks:e.can_manage_tasks,can_assign_individual:e.can_assign_individual,
   can_manage_news:e.can_manage_news,can_manage_competition:e.can_manage_competition,
   can_manage_prizes:e.can_manage_prizes,can_manage_achievements:e.can_manage_achievements,
   can_manage_permissions:e.can_manage_permissions
 })});
 await manager();
}
function crudList(title,arr,type){let isT=type==='task';return `<div class=card><h2>${title}</h2><input id=ct class=field placeholder="Название"><textarea id=cd class=field placeholder="Описание"></textarea><input id=cv class=field type=number placeholder="${isT?'Баллы':'Стоимость'}"><label>Фото (необязательно)</label><input id=cimg class=field type=file accept="image/*"><div class=file-note>Можно оставить пустым.</div><button class="btn red" onclick="createItem('${type}')">Добавить</button></div>${arr.map(x=>`<div class=section-item>${x.image?`<img class=section-item-image src="${x.image}">`:''}<div class=card><b>${esc(x.title)}</b><p>${esc(x.description)}</p><span class=pill>${isT?'+'+x.points:x.cost} баллов</span> <button class="btn danger" onclick="del('${isT?'tasks':'prizes'}',${x.id})">Удалить</button></div>`).join('')}`}
async function createItem(t){
 let b={title:$('#ct').value,description:$('#cd').value,active:true};
 b[t==='task'?'points':'cost']=+$('#cv').value;
 file64($('#cimg'),async image=>{
   b.image=image||null;
   let r=await api('admin/'+(t==='task'?'tasks':'prizes'),{method:'POST',body:JSON.stringify(b)});
   if(t==='task'&&r.push)toast(r.push.sent>0?`Задание создано · push доставлен на ${r.push.sent} устройств`:`Задание создано · push не доставлен${r.push.errors?.[0]?' · '+r.push.errors[0]:''}`);
   manager()
 })
}
function achAdmin(){return `<div class=card><h2>Достижения</h2><input id=ai class=field placeholder="Значок, например ★"><input id=at class=field placeholder="Название"><input id=ad class=field placeholder="Описание"><button class="btn red" onclick="addAch()">Добавить</button></div>${state.achievements.map(a=>`<div class=card>${esc(a.icon)} <b>${esc(a.title)}</b> — ${esc(a.description)}<div class=row><select id="ae${a.id}" class=field style="flex:1">${state.employees.map(e=>`<option value=${e.id}>${esc(e.name)}</option>`).join('')}</select><button class=btn onclick="assignAch(${a.id})">Назначить</button><button class="btn danger" onclick="del('achievements',${a.id})">Удалить</button></div></div>`).join('')}`}
async function addAch(){await api('admin/achievements',{method:'POST',body:JSON.stringify({icon:$('#ai').value,title:$('#at').value,description:$('#ad').value})});manager()}async function assignAch(a){await api('admin/achievement/assign',{method:'POST',body:JSON.stringify({achievement_id:a,employee_id:+$('#ae'+a).value})});toast('Достижение назначено')}


const UI_BLOCKS=[
 ['Общие','global.header','Верхняя шапка сайта'],
 ['Главная сотрудника','home.profile_summary','Карточка сотрудника и баллов'],
 ['Главная сотрудника','home.personal_tasks','Блок индивидуальных заданий'],
 ['Главная сотрудника','home.notifications','Блок push-уведомлений'],
 ['Главная сотрудника','home.news_achievements','Новости и достижения на главной'],
 ['Разделы сотрудника','section.news','Раздел «Новости»'],
 ['Разделы сотрудника','section.tasks','Раздел «Задания»'],
 ['Разделы сотрудника','section.prizes','Раздел «Призы»'],
 ['Разделы сотрудника','section.messenger','Раздел «Чаты»'],
 ['Разделы сотрудника','section.competition','Раздел «Конкурс»'],
 ['Разделы сотрудника','section.rating','Раздел «Рейтинг»'],
 ['Разделы сотрудника','section.profile','Раздел «Профиль»'],
 ['Кабинет управляющего','admin.employees','Окно сотрудников'],
 ['Кабинет управляющего','admin.tasks','Окно общих заданий'],
 ['Кабинет управляющего','admin.prizes','Окно призов'],
 ['Кабинет управляющего','admin.achievements','Окно достижений'],
 ['Кабинет управляющего','admin.news','Окно новостей'],
 ['Кабинет управляющего','admin.competition','Окно конкурса'],
 ['Кабинет управляющего','admin.individual','Окно индивидуальных заданий'],
 ['Кабинет управляющего','admin.messenger','Окно управления мессенджером'],
 ['Кабинет управляющего','admin.history','Окно истории'],
 ['Кабинет управляющего','admin.settings','Окно настроек']
];
const UI_FIELDS=[
 ['Бренд','site.title','Название в шапке','КОМАНДА · ПОЕХАЛИ!'],
 ['Бренд','site.subtitle','Подзаголовок в шапке','Новости, конкурсы и достижения'],
 ['Бренд','site.browser_title','Название вкладки браузера','Команда, поехали!'],
 ['Экран входа','login.kicker','Надпись над главным заголовком','Внутренняя платформа команды'],
 ['Экран входа','login.title_line1','Главный заголовок — строка 1','Команда.'],
 ['Экран входа','login.title_line2','Главный заголовок — строка 2','Поехали!'],
 ['Экран входа','login.description','Описание','Новости, конкурсы, индивидуальные задания, достижения и рейтинг команды — в одном месте.'],
 ['Экран входа','login.welcome','Заголовок формы','Добро пожаловать'],
 ['Экран входа','login.instruction','Инструкция','Выберите профиль и введите персональный PIN-код.'],
 ['Экран входа','login.employee_tab','Переключатель сотрудника','Сотрудник'],
  ['Экран входа','login.employee_button','Кнопка входа сотрудника','Войти в личный кабинет'],
  ['Экран входа','login.employee_note','Подсказка сотруднику','PIN выдаёт управляющий. Не передавайте его другим сотрудникам.'],
  ['Вкладки сотрудника','tab.home','Главная','Главная'],
 ['Вкладки сотрудника','tab.news','Новости','Новости'],
 ['Вкладки сотрудника','tab.tasks','Задания','Задания'],
 ['Вкладки сотрудника','tab.prizes','Призы','Призы'],
 ['Вкладки сотрудника','tab.messenger','Чаты','Чаты'],
 ['Вкладки сотрудника','tab.competition','Конкурс','Конкурс'],
 ['Вкладки сотрудника','tab.rating','Рейтинг','Рейтинг'],
 ['Вкладки сотрудника','tab.profile','Профиль','Профиль'],
 ['Главная сотрудника','home.personal_tasks_title','Заголовок личных заданий','Мои индивидуальные задания'],
 ['Главная сотрудника','home.personal_tasks_subtitle','Подпись личных заданий','Новые задания появляются здесь сразу после входа'],
 ['Главная сотрудника','home.all_tasks_button','Кнопка всех заданий','Все задания'],
 ['Главная сотрудника','home.no_personal_tasks','Нет заданий','Активных индивидуальных заданий сейчас нет.'],
 ['Главная сотрудника','home.notifications_title','Заголовок уведомлений','Уведомления о новых заданиях'],
 ['Главная сотрудника','home.notifications_text','Описание уведомлений','Разрешите уведомления — и новое индивидуальное задание появится на устройстве даже когда сайт закрыт.'],
 ['Главная сотрудника','home.notifications_enable','Кнопка включения','Включить уведомления'],
 ['Главная сотрудника','home.notifications_test','Кнопка теста','Проверить доставку'],
 ['Главная сотрудника','home.notifications_resubscribe','Кнопка переподписки','Переподписать устройство'],
 ['Главная сотрудника','home.latest_news','Заголовок новостей','Последние новости'],
 ['Главная сотрудника','home.achievements','Заголовок достижений','Мои достижения'],
 ['Разделы','section.news_title','Новости','Новости'],
 ['Разделы','section.tasks_title','Задания','Задания'],
 ['Разделы','section.general_tasks','Общие задания','Общие задания'],
 ['Разделы','section.prizes_title','Призы','Призы'],
 ['Разделы','section.rating_title','Рейтинг','Рейтинг команды'],
 ['Разделы','section.profile_title','Профиль','Мой профиль'],
 ['Профиль','profile.upload_photo','Загрузка фото','Загрузить фотографию'],
 ['Профиль','profile.save_photo','Кнопка фото','Сохранить фото'],
 ['Профиль','profile.points_history','История баллов','История баллов'],
 ['Мессенджер','messenger.title','Название раздела','Чаты'],
 ['Мессенджер','messenger.search_placeholder','Поиск','Поиск'],
 ['Мессенджер','messenger.new_chat','Новый чат','Новый чат'],
 ['Мессенджер','messenger.create_group','Создать группу','Создать группу'],
 ['Мессенджер','messenger.select_chat','Пустой чат — заголовок','Выберите чат'],
 ['Мессенджер','messenger.empty_text','Пустой чат — текст','Личные и групповые сообщения команды'],
 ['Мессенджер','messenger.message_placeholder','Поле сообщения','Сообщение'],
 ['Вкладки управляющего','admin.tab.employees','Сотрудники','Сотрудники'],
 ['Вкладки управляющего','admin.tab.tasks','Задания','Задания'],
 ['Вкладки управляющего','admin.tab.prizes','Призы','Призы'],
 ['Вкладки управляющего','admin.tab.achievements','Достижения','Достижения'],
 ['Вкладки управляющего','admin.tab.news','Новости','Новости'],
 ['Вкладки управляющего','admin.tab.competition','Конкурс','Конкурс'],
 ['Вкладки управляющего','admin.tab.individual','Индивидуальные задания','Индивидуальные задания'],
 ['Вкладки управляющего','admin.tab.messenger','Мессенджер','Мессенджер'],
 ['Вкладки управляющего','admin.tab.history','История','История'],
 ['Вкладки управляющего','admin.tab.interface','Редактор интерфейса','Редактор интерфейса'],
 ['Вкладки управляющего','admin.tab.settings','Настройки','Настройки']
];
function interfaceAdmin(){
 let last='';
 return `<div class=card>
   <h2>Управление окнами и блоками</h2>
   <p class=muted>Здесь можно полностью скрывать лишние окна сайта. Скрытие не удаляет данные — блок можно вернуть в любой момент.</p>
   <div class=block-manager-grid>${UI_BLOCKS.map(([section,key,label])=>`<div class="block-control ${uiBlocks[key]?'hidden-block':''}"><div class=meta><b>${esc(label)}</b><br><small>${esc(section)}</small><br><code>${esc(key)}</code><br><span class=status>${uiBlocks[key]?'СКРЫТО':'ПОКАЗАНО'}</span></div><button class="btn ${uiBlocks[key]?'ok':'danger'}" onclick="toggleUiBlock('${key}',${!uiBlocks[key]})">${uiBlocks[key]?'Вернуть':'Скрыть'}</button></div>`).join('')}</div><div style="margin-top:14px"><button class="btn light" onclick="resetAllBlocks()">Вернуть все окна</button></div>
 </div>
 <div class=card>
   <h2>Удаление отдельных окон и кнопок</h2>
   <p class=muted>Это точечное управление. Введите точный текст кнопки либо заголовок окна, которое нужно убрать. Данные при этом не удаляются — правило можно удалить и элемент вернётся.</p>
   <div class=element-editor-grid>
     <select id=removeType class=field><option value="button">Кнопка</option><option value="window">Окно / карточка</option></select>
     <input id=removeText class=field placeholder="Точный текст кнопки или заголовок окна">
     <button class="btn danger" onclick="addRemovedElement()">Удалить из интерфейса</button>
   </div>
   <div id=removedElementsList style="margin-top:14px"></div>
 </div>
 <div class=card>
   <h2>Редактор интерфейса</h2>
   <p class=muted>Здесь управляющий может менять стандартные тексты интерфейса и создавать глобальные замены для любых других фраз на сайте. Все изменения сохраняются в Neon.</p>
   <div class=fulltext-note><b>Универсальная замена текста</b><br>Если нужной надписи нет в списке ниже, скопируйте её с сайта в поле «Исходный текст» и укажите новый вариант. Замена применяется ко всем экранам, где встречается эта точная фраза.</div>
   <div class=fulltext-tools>
     <div><label>Исходный текст</label><textarea id=repSource class=field placeholder="Например: Проверить доставку"></textarea></div>
     <div><label>Новый текст</label><textarea id=repValue class=field placeholder="Например: Отправить тестовое уведомление"></textarea></div>
   </div>
   <button class="btn red" onclick="saveReplacement()">Добавить / обновить замену</button>
 </div>
 <div class=card>
   <h2>Глобальные замены</h2>
   <input id=repSearch class="field editor-search" placeholder="Поиск по заменам" oninput="renderReplacementList()">
   <div id=replacementList></div>
 </div>
 <div class=card>
   <h2>Стандартные поля интерфейса</h2>
   <input id=uiFieldSearch class="field editor-search" placeholder="Поиск по названиям и ключам" oninput="filterUiFields()">
   <div id=uiFieldsWrap class=ui-editor-grid>${UI_FIELDS.map(([section,key,label,def])=>{
     const head=section!==last?(last=section,`<h3 class="ui-section-title ui-section-node" data-search="${esc((section+' '+key+' '+label).toLowerCase())}">${esc(section)}</h3>`):'';
     return head+`<div class="ui-edit-card ui-field-node" data-search="${esc((section+' '+key+' '+label+' '+def).toLowerCase())}"><label>${esc(label)} · <code>${esc(key)}</code></label><textarea id="ui_${key.replace(/\./g,'_')}" class=field>${esc(T(key,def))}</textarea><div class=row><button class="btn red" onclick="saveUiField('${key}','ui_${key.replace(/\./g,'_')}')">Сохранить</button><button class="btn light" onclick="resetUiField('${key}')">Вернуть стандарт</button></div></div>`
   }).join('')}</div>
   <div style="margin-top:16px"><button class="btn red" onclick="saveAllUi()">Сохранить все изменения</button></div>
 </div>`
}

async function toggleUiBlock(key,hidden){
 await api('admin/content/blocks',{method:'POST',body:JSON.stringify({block_key:key,hidden})});
 uiBlocks[key]=hidden;
 toast(hidden?'Окно скрыто':'Окно возвращено');
 manager()
}
async function resetAllBlocks(){
 for(const [,key] of UI_BLOCKS){
   await api('admin/content/blocks',{method:'POST',body:JSON.stringify({block_key:key,hidden:false})});
   uiBlocks[key]=false;
 }
 toast('Все окна снова отображаются');manager()
}

function renderRemovedElements(){
 const box=$('#removedElementsList');if(!box)return;
 box.innerHTML=(uiRemovedElements||[]).length?uiRemovedElements.map(r=>`<div class=removed-rule><span class=pill>${r.element_type==='button'?'Кнопка':'Окно'}</span><code>${esc(r.match_text)}</code><button class="btn ok" onclick="restoreRemovedElement(${r.id})">Вернуть</button></div>`).join(''):'<p class=muted>Точечных удалений пока нет.</p>'
}
async function addRemovedElement(){
 const element_type=$('#removeType').value,match_text=$('#removeText').value.trim();
 if(!match_text)return toast('Введите точный текст элемента');
 const r=await api('admin/content/removed-elements',{method:'POST',body:JSON.stringify({element_type,match_text})});
 uiRemovedElements.push({id:r.id,element_type,match_text});
 $('#removeText').value='';renderRemovedElements();applyRemovedElements(document);toast('Элемент удалён из интерфейса')
}
async function restoreRemovedElement(id){
 await api('admin/content/removed-elements',{method:'DELETE',body:JSON.stringify({id})});
 uiRemovedElements=uiRemovedElements.filter(x=>x.id!==id);
 toast('Элемент возвращён');manager()
}
function filterUiFields(){
 const q=($('#uiFieldSearch')?.value||'').toLowerCase().trim();
 document.querySelectorAll('.ui-field-node').forEach(n=>n.style.display=!q||n.dataset.search.includes(q)?'':'none');
 document.querySelectorAll('.ui-section-node').forEach(n=>n.style.display=!q||n.dataset.search.includes(q)?'':'');
}
function renderReplacementList(){
 const box=$('#replacementList');if(!box)return;
 const q=($('#repSearch')?.value||'').toLowerCase();
 const rows=(uiReplacements||[]).filter(x=>(x.source_text+' '+x.replacement_text).toLowerCase().includes(q));
 box.innerHTML=rows.length?rows.map(x=>`<div class=fulltext-row><div><small>Исходный текст</small><code>${esc(x.source_text)}</code></div><div><small>Новый текст</small><code>${esc(x.replacement_text)}</code></div><button class="btn danger" onclick='deleteReplacement(${JSON.stringify(x.source_text)})'>Удалить</button></div>`).join(''):'<p class=muted>Глобальных замен пока нет.</p>'
}
async function saveReplacement(){
 const source=$('#repSource').value.trim(),value=$('#repValue').value;
 if(!source)return toast('Введите исходный текст');
 await api('admin/content/replacements',{method:'POST',body:JSON.stringify({source_text:source,replacement_text:value})});
 const i=uiReplacements.findIndex(x=>x.source_text===source);
 if(i>=0)uiReplacements[i].replacement_text=value;else uiReplacements.push({source_text:source,replacement_text:value});
 $('#repSource').value='';$('#repValue').value='';
 renderReplacementList();applyGlobalTextReplacements(document.body);toast('Глобальная замена сохранена')
}
async function deleteReplacement(source){
 await api('admin/content/replacements',{method:'DELETE',body:JSON.stringify({source_text:source})});
 uiReplacements=uiReplacements.filter(x=>x.source_text!==source);
 toast('Замена удалена. Исходный текст вернётся после обновления экрана.');
 manager()
}
async function saveUiField(key,id){
 const value=$('#'+id).value;
 await api('admin/content',{method:'POST',body:JSON.stringify({key,value})});
 uiText[key]=value;applyChromeText();toast('Текст сохранён')
}
async function resetUiField(key){
 await api('admin/content',{method:'DELETE',body:JSON.stringify({key})});
 delete uiText[key];toast('Возвращено стандартное значение');manager()
}
async function saveAllUi(){
 const items=UI_FIELDS.map(([,key,,def])=>({key,value:$('#ui_'+key.replace(/\./g,'_'))?.value??T(key,def)}));
 await api('admin/content/bulk',{method:'POST',body:JSON.stringify({items})});
 for(const x of items)uiText[x.key]=x.value;
 applyChromeText();toast('Все изменения сохранены');manager()
}


function messengerAdmin(){
 return `<div class=card>
   <h2>Управление мессенджером</h2>
   <p class=muted>Доступ к чатам имеет только тот сотрудник, которому управляющий явно включил разрешение.</p>
   <button class="btn red" onclick="loadMessengerAdmin()">Обновить данные</button>
   <div class=card style="margin-top:14px">
     <h3>Создать чат</h3>
     <select id=adminChatType class=field onchange="renderAdminChatCreator()"><option value="group">Общий чат</option><option value="direct">Личный чат</option></select>
     <input id=adminChatTitle class=field placeholder="Название общего чата">
     <div id=adminChatMembers></div>
     <button class="btn red" onclick="createAdminChat()">Создать чат</button>
   </div>
   <div id=messengerAdminBox style="margin-top:14px">Нажмите «Обновить данные».</div>
 </div>`
}

function renderAdminChatCreator(){
 const box=$('#adminChatMembers');if(!box||!window.adminMessengerState)return;
 const type=$('#adminChatType')?.value||'group';
 const users=(window.adminMessengerState.users||[]).filter(x=>x.active&&x.messenger_access);
 box.innerHTML=`<div class=permission-grid>${users.map(u=>`<label class=toggle-line><input class=admin-chat-member type=checkbox value="${u.id}"><span>${esc(u.name)} · ${esc(u.position)}</span></label>`).join('')}</div>`;
 const title=$('#adminChatTitle');if(title)title.style.display=type==='group'?'':'none';
}
async function createAdminChat(){
 const type=$('#adminChatType').value;
 const member_ids=[...document.querySelectorAll('.admin-chat-member:checked')].map(x=>+x.value);
 const title=$('#adminChatTitle').value.trim();
 await api('admin/messenger/chat',{method:'POST',body:JSON.stringify({type,title,member_ids})});
 toast('Чат создан');
 await loadMessengerAdmin()
}

async function loadMessengerAdmin(){
 const box=$('#messengerAdminBox');if(!box)return;
 try{
  const r=await api('admin/messenger');window.adminMessengerState=r;renderAdminChatCreator();
  box.innerHTML=`<h3>Доступ сотрудников</h3>${r.users.map(u=>`<div class="listitem row"><img class=avatar src="${u.photo||'/assets/logo.png'}"><div style="flex:1"><b>${esc(u.name)}</b><br><small>${esc(u.position)} · ${u.active?'активен':'заблокирован'}${u.last_seen?' · был(а) '+new Date(u.last_seen).toLocaleString('ru'):''}</small></div><label><input class=messenger-access-check type=checkbox data-employee-id="${u.id}" ${u.messenger_access?'checked':''}> Доступ к чатам</label></div>`).join('')}
  <div class="row" style="margin-top:14px">
    <button class="btn red" onclick="saveMessengerAccess()">Сохранить доступ сотрудников</button>
    <span id=messengerAccessSaveStatus class=muted></span>
  </div>
  <h3 style="margin-top:20px">Чаты</h3>${r.chats.length?r.chats.map(c=>`<div class="listitem row"><div style="flex:1"><b>${esc(c.type==='group'?(c.title||'Группа'):'Личный чат')}</b><br><small>${c.members_count} участников · ${c.messages_count} сообщений</small></div><button class="btn danger" onclick="deleteAdminChat(${c.id})">Удалить чат</button></div>`).join(''):'<p class=muted>Чатов пока нет.</p>'}`;
 }catch(e){box.innerHTML=`<div class=card>${esc(e.message)}</div>`}
}
async function saveMessengerAccess(){
 const checks=[...document.querySelectorAll('.messenger-access-check')];
 const status=$('#messengerAccessSaveStatus');
 if(status)status.textContent='Сохраняю…';
 try{
   for(const ch of checks){
     await api('admin/messenger/access',{
       method:'POST',
       body:JSON.stringify({employee_id:Number(ch.dataset.employeeId),enabled:ch.checked})
     });
   }
   if(status)status.textContent='Сохранено';
   toast('Доступ к мессенджеру сохранён');
   await loadMessengerAdmin();
 }catch(e){
   if(status)status.textContent='Ошибка сохранения';
   toast(e.message||'Не удалось сохранить доступ');
 }
}
async function deleteAdminChat(id){
 if(!confirm('Переместить чат в архив? Переписка сохранится.'))return;
 await api('admin/messenger/chat',{method:'DELETE',body:JSON.stringify({id})});
 toast('Чат удалён');await loadMessengerAdmin()
}

function individualAdmin(){return `<div class=card><h2 style="margin-bottom:6px">Назначить индивидуальное задание</h2><p class="muted" style="margin-top:0">Персональная задача с дедлайном и бонусными баллами.</p><select id=ie class=field>${state.employees.filter(e=>e.active).map(e=>`<option value=${e.id}>${esc(e.name)} — ${esc(e.position)}</option>`).join('')}</select><input id=it class=field placeholder="Название"><textarea id=idsc class=field placeholder="Описание"></textarea><div class=grid><input id=ipts class=field type=number placeholder="Баллы"><input id=idue class="field date-field" type=text inputmode=numeric maxlength=10 placeholder="ДД.ММ.ГГГГ"><small class=date-help>Можно ввести цифрами: 16081995 → 16.08.1995</small></div><label>Фото (необязательно)</label><input id=iimg class=field type=file accept="image/*"><div class=file-note>Можно оставить пустым.</div><button class="btn red" onclick="addIndividual()">Назначить</button></div>${(state.individualTasks||[]).map(t=>`<div class=section-item>${t.image?`<img class=section-item-image src="${t.image}">`:''}<div class="card task-personal"><b>${esc(t.employee_name)} — ${esc(t.title)}</b><p>${esc(t.description)}</p><span class=pill>+${t.points}</span> ${t.due_date?`<small>до ${new Date(t.due_date).toLocaleDateString('ru')}</small>`:''}<p><b>Статус:</b> ${t.status}${t.employee_comment?`<br><i>Комментарий сотрудника: ${esc(t.employee_comment)}</i>`:''}</p>${t.status==='submitted'?`<button class="btn red" onclick="approveIndividual(${t.id})">Подтвердить и начислить</button>`:''} <button class="btn danger" onclick="deleteIndividual(${t.id})">Удалить</button></div>`).join('')}`}
async function addIndividual(){
 file64($('#iimg'),async image=>{
   await api('admin/individual-tasks',{method:'POST',body:JSON.stringify({
     employee_id:+$('#ie').value,title:$('#it').value,description:$('#idsc').value,
     points:+$('#ipts').value,due_date:dateValue('#idue'),image:image||null
   })});
   toast('Индивидуальное задание назначено');manager()
 })
}
async function approveIndividual(id){let r=await api('admin/individual-tasks/approve',{method:'POST',body:JSON.stringify({id})});pointCelebration(r.points);toast('Задание подтверждено, баллы начислены');manager()}
async function deleteIndividual(id){if(!confirm('Переместить индивидуальное задание в архив?'))return;await api('admin/individual-tasks',{method:'DELETE',body:JSON.stringify({id})});manager()}
function competitionAdmin(){let c=state.competition;return `<div class=card><h2>Гонка экипажей</h2><label>Название</label><input id=coTitle class=field value="${esc(c?.title||'Гонка экипажей')}"><label>Правила / описание</label><textarea id=coDesc class=field>${esc(c?.description||'')}</textarea><div class=grid><div><label>Начало</label><input id=coStart class=field type=date value="${c?.starts_on?String(c.starts_on).slice(0,10):''}"></div><div><label>Окончание</label><input id=coEnd class=field type=date value="${c?.ends_on?String(c.ends_on).slice(0,10):''}"></div></div><label><input id=coActive type=checkbox ${c?.active!==false?'checked':''}> Конкурс активен</label><br><br><button class="btn red" onclick="saveCompetition()">Сохранить конкурс</button></div><div class=grid><div class=card><h3>Задания конкурса</h3><input id=cot class=field placeholder="Название задания"><textarea id=cod class=field placeholder="Описание"></textarea><input id=cop class=field type=number placeholder="Баллы"><button class=btn onclick="addCompetitionTask()">Добавить задание</button>${(c?.tasks||[]).map(t=>`<div class=listitem><b>${esc(t.title)}</b> +${t.points}<br><small>${esc(t.description)}</small><br><button class="btn danger" onclick="delCompetitionTask(${t.id})">Удалить</button></div>`).join('')}</div><div class=card><h3>Начислить бонус</h3><select id=coe class=field>${state.employees.filter(e=>e.active).map(e=>`<option value=${e.id}>${esc(e.name)}</option>`).join('')}</select><select id=cotask class=field><option value="">Произвольный бонус</option>${(c?.tasks||[]).map(t=>`<option value="${t.id}" data-p="${t.points}">${esc(t.title)} (+${t.points})</option>`).join('')}</select><input id=copts class=field type=number placeholder="Баллы"><input id=coreason class=field placeholder="Причина"><button class="btn red" onclick="awardCompetition()">Начислить</button><h3>Рейтинг конкурса</h3>${(c?.board||[]).map((x,i)=>`<div class=listitem>${i+1}. <b>${esc(x.name)}</b> — ${x.score}</div>`).join('')}</div></div>`}
async function saveCompetition(){let r=await api('admin/competition/settings',{method:'POST',body:JSON.stringify({title:$('#coTitle').value,description:$('#coDesc').value,starts_on:$('#coStart').value||null,ends_on:$('#coEnd').value||null,active:$('#coActive').checked})});toast(r.push&&r.push.sent>0?`Конкурс сохранён · уведомлений: ${r.push.sent}`:'Конкурс сохранён');manager()}
async function addCompetitionTask(){await api('admin/competition/tasks',{method:'POST',body:JSON.stringify({title:$('#cot').value,description:$('#cod').value,points:+$('#cop').value})});manager()}
async function delCompetitionTask(id){if(!confirm('Переместить задание в архив?'))return;await api('admin/competition/tasks',{method:'DELETE',body:JSON.stringify({id})});manager()}
async function awardCompetition(){let s=$('#cotask'),o=s.options[s.selectedIndex],pts=+$('#copts').value||+(o?.dataset?.p||0),reason=$('#coreason').value||(o&&o.value?o.textContent:'Бонус конкурса');if(!pts)return toast('Укажите баллы');await api('admin/competition/award',{method:'POST',body:JSON.stringify({employee_id:+$('#coe').value,task_id:+s.value||null,points:pts,reason})});pointCelebration(pts);toast('Баллы начислены');manager()}
function newsAdmin(){return `<div class=card><h2 style="margin-bottom:6px">Новая публикация</h2><p class="muted" style="margin-top:0">Новости, объявления и важная информация для команды.</p><input id=nt class=field placeholder="Заголовок"><select id=nc class=field><option>Важно</option><option>Мероприятие</option><option>Новинка</option><option>Обучение</option><option>Для команды</option></select><textarea id=nb class=field placeholder="Текст новости"></textarea><label>Дата мероприятия (необязательно)</label><input id=nd class=field type=date><label>Фото (необязательно)</label><input id=nimg class=field type=file accept="image/*"><div class=file-note>Можно оставить пустым.</div><div class=row><label><input id=np type=checkbox> Закрепить</label><label><input id=na type=checkbox> Требовать «Ознакомился»</label></div><br><button class="btn red" onclick="addNews()">Опубликовать</button></div>${state.news.map(n=>`<div class=card>${n.image?`<img class=newsimg src="${n.image}">`:''}<div class=news-title-row><span class=pill>${esc(n.category)}</span><h3>${esc(n.title)}</h3></div><p>${esc(n.body)}</p><small>Ознакомились: ${n.read_count}</small><br><button class="btn danger" onclick="del('news',${n.id})">Удалить</button></div>`).join('')}`}
function addNews(){file64($('#nimg'),async p=>{let r=await api('admin/news',{method:'POST',body:JSON.stringify({title:$('#nt').value,category:$('#nc').value,body:$('#nb').value,event_date:$('#nd').value||null,image:p,pinned:$('#np').checked,requires_ack:$('#na').checked,active:true})});toast(r.push&&r.push.sent>0?`Новость опубликована · уведомлений: ${r.push.sent}`:'Новость опубликована');manager()})}
async function del(kind,id){if(!confirm('Переместить в архив? Данные можно будет восстановить.'))return;await api('admin/'+kind,{method:'DELETE',body:JSON.stringify({id})});manager()}async function saveSettings(){await api('admin/settings',{method:'POST',body:JSON.stringify({season:$('#season').value,level_step:+$('#levelstep').value,manager_pin:$('#newmpin').value||null})});toast('Настройки сохранены');manager()}

async function supervisor(){document.body.classList.add('authenticated');try{state=await api('supervisor/state');$('#who').innerHTML=`<span class=supervisor-badge>Наблюдатель</span> <button class="btn light" onclick="logout()">Выйти</button>`;renderSupervisor()}catch{logout()}}
function renderSupervisor(){let team=state.employees.filter(e=>e.team_member),others=state.employees.filter(e=>!e.team_member);$('#app').innerHTML=`<div class="card hero"><h2>Панель руководителя</h2><p>Просмотр прогресса команды без доступа к начислению баллов и изменению настроек.</p></div><div class=grid><div class=card><h3>Команда</h3>${team.map((e,i)=>`<div class="listitem row"><b>${i+1}</b><img class=avatar src="${e.photo||'/assets/logo.png'}"><span>${esc(e.name)}<br><small>${esc(e.position)}</small></span><b style="margin-left:auto">${e.points}</b></div>`).join('')}</div><div class=card><h3>Текущие задания</h3>${state.pending.map(t=>`<div class=listitem><b>${esc(t.employee_name)}</b> — ${esc(t.title)}<br><small>${t.status==='submitted'?'На проверке':'Назначено'}${t.due_date?' · до '+new Date(t.due_date).toLocaleDateString('ru'):''}</small></div>`).join('')||'Нет активных заданий'}</div></div><div class=grid><div class=card><h3>Последние достижения</h3>${state.achievements.slice(0,30).map(a=>{let e=state.employees.find(x=>x.id===a.employee_id);return `<div class=listitem>${esc(a.icon)} <b>${esc(e?.name||'')}</b> — ${esc(a.title)}</div>`}).join('')||'Пока нет достижений'}</div><div class=card><h3>Конкурс</h3>${state.competition?state.competition.board.map((x,i)=>`<div class=listitem>${i+1}. <b>${esc(x.name)}</b> — ${x.score}</div>`).join(''):'Нет активного конкурса'}${others.length?`<hr><small>Не участвуют в рейтинге: ${others.map(x=>esc(x.name)).join(', ')}</small>`:''}</div></div>`;animateSection()}

(async()=>{await loadUiText();applyChromeText();startReplacementObserver();const q=new URLSearchParams(location.search),open=q.get('open');if(['tasks','news','competition','messenger'].includes(open))etab=open;if(token&&role==='manager'){logout();return}if(token&&role==='employee')employee();else if(token&&role==='supervisor')supervisor();else login()})();
