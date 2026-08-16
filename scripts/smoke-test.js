
const fs=require('fs');
const cp=require('child_process');
function run(cmd){cp.execSync(cmd,{stdio:'inherit'})}
run('node --check api/index.js');
run('node --check assets/app.js');
const api=fs.readFileSync('api/index.js','utf8');
const app=fs.readFileSync('assets/app.js','utf8');
const required=["admin/diagnostics","push/key","tutorial/capabilities","tutorial/base-offered","tutorial/state","admin/audit","admin/backups","admin/archive","public/version","cron/maintenance","cron/birthdays","admin/push/subscriptions","admin/employees/gender"];
for(const x of required)if(!api.includes(x))throw new Error('Missing route '+x);
if(!app.includes('checkAppVersion'))throw new Error('Version update UI missing');

if(!api.includes("https://komanda-poehali.vercel.app"))throw new Error('Valid VAPID subject fallback missing');
if(api.includes("mailto:admin@komanda-poehali.local"))throw new Error('Invalid .local VAPID subject still present');

console.log('Smoke tests passed');
