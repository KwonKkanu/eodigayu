'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const QRCode=require('qrcode');
const routes=require('./public/data.js');
const port=Number(process.env.PORT||3080),host=process.env.HOST||'127.0.0.1';
const TTL=2*60*60*1000,sessions=new Map();
let publicBase='';
if(process.env.PUBLIC_BASE_URL){
  const url=new URL(process.env.PUBLIC_BASE_URL);
  if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('PUBLIC_BASE_URL must be a root HTTPS URL.');
  publicBase=url.origin;
}
const files={'/':'index.html','/index.html':'index.html','/mobile.html':'mobile.html','/control.html':'control.html','/styles.css':'styles.css','/app.js':'app.js','/data.js':'data.js','/favicon.svg':'favicon.svg'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let value='';for await(const chunk of req){value+=chunk;if(value.length>4096)fail(413,'Request too large');}try{return JSON.parse(value||'{}');}catch{fail(400,'Invalid JSON');}}
function getSession(id){const session=sessions.get(id);if(!session||Date.now()>session.expires){sessions.delete(id);fail(404,'Session expired or not found');}return session;}
function tick(s){if(!s.auto||s.phase!=='riding')return;const count=Math.floor((Date.now()-s.autoAt)/8000);if(count>0){s.stop=Math.min(routes.find(r=>r.id===s.route).stops.length-1,s.stop+count);s.autoAt+=count*8000;if(s.stop===routes.find(r=>r.id===s.route).stops.length-1){s.phase='arrived';s.auto=false;}s.version++;}}
function view(s){tick(s);return {id:s.id,lang:s.lang,route:s.route,phase:s.phase,stop:s.stop,auto:s.auto,version:s.version,expires:s.expires};}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/api/config')return json(res,200,{publicBase});
    if(req.method==='POST'&&url.pathname==='/api/sessions'){
      for(const [id,s]of sessions)if(Date.now()>s.expires)sessions.delete(id);
      if(sessions.size>=300)fail(429,'Demo capacity reached');
      const input=await body(req);if(!routes.some(r=>r.id===input.route)||!['ko','en'].includes(input.lang))fail(400,'Invalid route or language');
      const id=crypto.randomBytes(16).toString('hex'),key=crypto.randomBytes(24).toString('hex');
      const s={id,key,route:input.route,lang:input.lang,phase:'waiting',stop:0,auto:false,autoAt:0,version:1,expires:Date.now()+TTL};sessions.set(id,s);
      return json(res,201,{session:view(s),controlKey:key,publicBase});
    }
    const match=url.pathname.match(/^\/api\/sessions\/([a-f0-9]{32})(\/qr)?$/);
    if(match){
      const s=getSession(match[1]);
      if(req.method==='GET'&&match[2]){
        if(!publicBase)fail(409,'Public HTTPS URL not configured');
        const svg=await QRCode.toString(`${publicBase}/mobile.html#${s.id}`,{type:'svg',margin:3,width:256,errorCorrectionLevel:'M'});
        res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store'});return res.end(svg);
      }
      if(req.method==='GET')return json(res,200,view(s));
      if(req.method==='POST'&&!match[2]){
        const input=await body(req);tick(s);
        const admin=['next','auto','pause','reset'].includes(input.action);
        if(admin&&req.headers.authorization!==`Bearer ${s.key}`)fail(403,'Presenter key required');
        const last=routes.find(r=>r.id===s.route).stops.length-1;
        if(input.action==='board'){if(s.phase!=='waiting')fail(409,'Already boarded');s.phase='riding';}
        else if(input.action==='finish'){if(s.phase!=='arrived')fail(409,'Not arrived yet');s.phase='done';s.auto=false;}
        else if(input.action==='next'){if(s.phase!=='riding')fail(409,'Passenger must board first');s.stop=Math.min(last,s.stop+1);s.autoAt=Date.now();if(s.stop===last){s.phase='arrived';s.auto=false;}}
        else if(input.action==='auto'||input.action==='demo-play'){if(s.phase!=='riding')fail(409,'Passenger must board first');s.auto=true;s.autoAt=Date.now();}
        else if(input.action==='pause'||input.action==='demo-pause')s.auto=false;
        else if(input.action==='reset'){s.phase='waiting';s.stop=0;s.auto=false;}
        else fail(400,'Unknown action');
        s.version++;return json(res,200,view(s));
      }
    }
    if(req.method==='GET'&&files[url.pathname]){const f=files[url.pathname];res.writeHead(200,{'Content-Type':mime[path.extname(f)],'Cache-Control':'no-cache'});return res.end(await fs.readFile(path.join(__dirname,'public',f)));}
    fail(404,'Not found');
  }catch(e){json(res,e.status||500,{error:e.status?e.message:'Server error'});if(!e.status)console.error(e);}
});
server.listen(port,host,()=>console.log(`Bus demo: http://${host}:${port}\nPublic mobile address: ${publicBase||'not configured (PC preview only)'}`));
