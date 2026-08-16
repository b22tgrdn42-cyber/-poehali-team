const SW_VERSION='9.2.3';
const CACHE_NAME='poehali-'+SW_VERSION;
self.addEventListener('install',event=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('poehali-')&&k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener('push',event=>{
  let data={title:'Команда, поехали!',body:'У вас новое уведомление',url:'/'};
  try{data={...data,...event.data.json()}}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:'/assets/push-icon-192.png',
    badge:'/assets/push-badge-96.png',
    image:data.image||undefined,
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
