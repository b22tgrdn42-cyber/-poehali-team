
const fs=require('fs');
const cp=require('child_process');
function run(cmd){cp.execSync(cmd,{stdio:'inherit'})}
run('node --check api/index.js');
run('node --check assets/app.js');
const api=fs.readFileSync('api/index.js','utf8');
const app=fs.readFileSync('assets/app.js','utf8');
const required=["admin/diagnostics","admin/audit","admin/backups","admin/archive","public/version","cron/maintenance","cron/birthdays"];
for(const x of required)if(!api.includes(x))throw new Error('Missing route '+x);
if(!app.includes('checkAppVersion'))throw new Error('Version update UI missing');
console.log('Smoke tests passed');
