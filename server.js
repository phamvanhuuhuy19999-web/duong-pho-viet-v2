const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_, res) => res.json({ ok: true }));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
const rooms = new Map();
const players = new Map();

const CATALOG = {
  "Wave":    { price: 0, speed: 5.2, handling: 1.12, exhaust: 0 },
  "Exciter": { price: 8500, speed: 7.2, handling: 0.96, exhaust: 0 },
  "Vario":   { price: 10500, speed: 6.7, handling: 1.08, exhaust: 0 },
  "Winner":  { price: 12500, speed: 7.6, handling: 0.92, exhaust: 0 }
};
const WORLD = { width: 2200, height: 1500 };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const clean = (s, n=18) => String(s || "").replace(/[<>]/g, "").trim().slice(0, n) || "Tay đua";
const cleanRoom = s => String(s || "PHOVIET").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12) || "PHOVIET";

function publicPlayer(p) {
  return { id:p.id, name:p.name, x:p.x, y:p.y, angle:p.angle, bike:p.bike,
    color:p.color, money:p.money, exhaust:p.exhaust, wanted:p.wanted, lap:p.lap };
}
function snapshot(room) { return [...(rooms.get(room)?.values() || [])].map(publicPlayer); }
function send(ws, obj) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); }
function broadcast(room, obj) { for (const p of rooms.get(room)?.values() || []) send(p.ws, obj); }
function updateRoom(room) { broadcast(room, { type:"state", players:snapshot(room) }); }
function sendProfile(p) { send(p.ws, { type:"profile", money:p.money, owned:p.owned, bike:p.bike, exhaust:p.exhaust, catalog:CATALOG }); }

function remove(ws) {
  const p = ws.player;
  if (!p) return;
  const group = rooms.get(p.room);
  if (group) {
    group.delete(p.id);
    if (!group.size) rooms.delete(p.room);
    else {
      broadcast(p.room, { type:"notice", text:`${p.name} đã rời phòng.` });
      updateRoom(p.room);
    }
  }
  ws.player = null;
  players.delete(p.id);
}
function join(ws, msg) {
  remove(ws);
  const room = cleanRoom(msg.room);
  if (!rooms.has(room)) rooms.set(room, new Map());
  const group = rooms.get(room);
  const id = crypto.randomUUID();
  const palette = ["#f8c34f","#57c7f2","#fa7893","#a995ff","#69d89a","#ff956c"];
  const p = {
    id, ws, room, name:clean(msg.name), bike:"Wave", owned:["Wave"], money:5000,
    exhaust:0, wanted:0, x:850 + Math.random()*100, y:1080 + group.size*25,
    angle:-Math.PI/2, color:palette[group.size % palette.length], lap:0,
    lastReward:0, lastPos:Date.now()
  };
  group.set(id,p); players.set(id,p); ws.player=p;
  send(ws,{type:"joined",id,room,world:WORLD,players:snapshot(room)});
  sendProfile(p);
  broadcast(room,{type:"notice",text:`${p.name} đã vào phố!`});
  updateRoom(room);
}
function handle(ws, msg) {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "join") return join(ws,msg);
  const p = ws.player;
  if (!p) return;
  if (msg.type === "move") {
    const x=Number(msg.x), y=Number(msg.y), a=Number(msg.angle);
    if (!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(a)) return;
    const now=Date.now();
    // Basic speed sanity check to make casual position spoofing harder.
    const dt=Math.max(0.04,Math.min(0.5,(now-p.lastPos)/1000));
    const maxTravel=(CATALOG[p.bike].speed + p.exhaust*0.35)*100*dt + 45;
    const dx=x-p.x, dy=y-p.y, d=Math.hypot(dx,dy);
    if (d > maxTravel) {
      const k=maxTravel/d; p.x+=dx*k; p.y+=dy*k;
    } else { p.x=x; p.y=y; }
    p.x=clamp(p.x,35,WORLD.width-35); p.y=clamp(p.y,35,WORLD.height-35);
    p.angle=a; p.lastPos=now;
    if (Number.isInteger(msg.lap)) p.lap=clamp(msg.lap,0,99);
    updateRoom(p.room);
  } else if (msg.type === "chat") {
    const text=String(msg.text||"").replace(/[<>]/g,"").trim().slice(0,100);
    if (text) broadcast(p.room,{type:"chat",name:p.name,text});
  } else if (msg.type === "buy") {
    const bike=String(msg.bike||"");
    const item=CATALOG[bike];
    if (!item) return;
    if (p.owned.includes(bike)) { send(ws,{type:"notice",text:"Bạn đã sở hữu xe này."}); return; }
    if (p.money < item.price) { send(ws,{type:"notice",text:"Không đủ tiền. Hãy chạy vòng để nhận thưởng!"}); return; }
    p.money-=item.price; p.owned.push(bike);
    sendProfile(p); send(ws,{type:"notice",text:`Đã mua ${bike}!`});
  } else if (msg.type === "selectBike") {
    const bike=String(msg.bike||"");
    if (!p.owned.includes(bike)) return;
    p.bike=bike; sendProfile(p); updateRoom(p.room);
  } else if (msg.type === "upgradeExhaust") {
    const cost=2500;
    if (p.exhaust>=3) { send(ws,{type:"notice",text:"Pô đã ở cấp tối đa."}); return; }
    if (p.money<cost) { send(ws,{type:"notice",text:"Không đủ tiền nâng cấp pô."}); return; }
    p.money-=cost; p.exhaust++; sendProfile(p);
    send(ws,{type:"notice",text:`Đã nâng cấp pô cấp ${p.exhaust}. Tốc độ tối đa tăng nhẹ.`});
  } else if (msg.type === "reward") {
    const now=Date.now();
    if (now-p.lastReward<12000) return;
    p.lastReward=now; p.money+=300;
    sendProfile(p); send(ws,{type:"reward",amount:300,text:"Hoàn thành vòng chạy! +300 xu"});
  } else if (msg.type === "policeCaught") {
    const now=Date.now();
    if (now-p.lastCaught>8000) {
      p.lastCaught=now; p.money=Math.max(0,p.money-150); p.wanted=0;
      sendProfile(p); send(ws,{type:"notice",text:"Cảnh sát giao thông đã dừng xe kiểm tra. Bạn mất 150 xu phí phạt trong game."});
    }
  }
}
wss.on("connection",ws=>{
  ws.on("message",raw=>{try{handle(ws,JSON.parse(raw.toString()))}catch(e){console.error(e)}});
  ws.on("close",()=>remove(ws));
});
const port=process.env.PORT||3000;
server.listen(port,()=>console.log(`Đường Phố Việt v2 running on ${port}`));
