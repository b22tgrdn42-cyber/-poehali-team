self.addEventListener('push',event=>{
  let data={title:'Команда, поехали!',body:'У вас новое уведомление',url:'/'};
  try{data={...data,...event.data.json()}}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:'/assets/logo.png',
    badge:'/assets/logo.png',
    tag:data.tag||'poehali',
    renotify:true,
    data:{url:data.url||'/'},
    vibrate:[120,60,120]
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||'/';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c){c.navigate(target);return c.focus()}}
    if(clients.openWindow)return clients.openWindow(target);
  }));
});
