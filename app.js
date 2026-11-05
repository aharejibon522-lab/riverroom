const socket = io();
const $ = id => document.getElementById(id);
let myId=null, currentRoom=null, myCards=[];
function toast(msg){const t=$("toast");t.textContent=msg;t.style.display="block";setTimeout(()=>t.style.display="none",2600)}
function nickname(){return $("nickname").value.trim()||"Player"}
function showLobby(){ $("lobby").classList.remove("hidden"); $("table").classList.add("hidden"); currentRoom=null; }
function showTable(room){ $("lobby").classList.add("hidden"); $("table").classList.remove("hidden"); renderRoom(room); }
function cardHTML(c){if(!c)return "";const rank=c[0]==="T"?"10":c[0];const suit={s:"♠",h:"♥",d:"♦",c:"♣"}[c[1]];return `<div class="card ${c[1]==="h"||c[1]==="d"?"red":""}">${rank}${suit}</div>`}
function renderRoom(r){
 currentRoom=r; $("tableName").textContent=r.name; $("tableCode").textContent=r.id;
 $("seats").innerHTML=(r.game?.players||r.players).map(p=>`<div class="seat ${r.game?.turn===p.id?"active":""}">${escapeHtml(p.name)}<small>${p.chips} chips${p.folded?" · folded":""}</small></div>`).join("");
 $("board").innerHTML=(r.game?.board||[]).map(cardHTML).join(""); $("pot").textContent=`Pot: ${r.game?.pot||0}`;
 const me=r.game?.players?.find(p=>p.id===myId);
 $("status").textContent=!r.game?"Waiting for players…":r.game.turn===myId?`Your turn · Current bet ${r.game.currentBet}`:`Waiting for ${r.game.players.find(p=>p.id===r.game.turn)?.name||"next player"}…`;
 if(me){$("status").textContent += ` · Your bet ${me.bet}`;}
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function refreshRooms(list){
 $("rooms").innerHTML=list.length?list.map(r=>`<div class="room"><div><b>${escapeHtml(r.name)}</b><small>Code ${r.id} · ${r.players.length}/8 players</small></div><button data-join="${r.id}">Join table</button></div>`).join(""):"No public tables yet. Create one!";
 document.querySelectorAll("[data-join]").forEach(b=>b.onclick=()=>socket.emit("room:join",{roomId:b.dataset.join,name:nickname()}));
}
socket.on("connect",()=>socket.emit("rooms:list"));
socket.on("rooms:list",refreshRooms);
socket.on("room:joined",data=>{myId=data.playerId;showTable(data.room);});
socket.on("room:update",renderRoom);
socket.on("cards:private",d=>{$("hole").innerHTML=d.cards.map(cardHTML).join("");});
socket.on("hand:result",r=>toast("Hand finished. "+r.winners.map(w=>w.name+" won "+w.amount).join(", ")));
socket.on("error:message",toast);
$("create").onclick=()=>socket.emit("room:create",{name:nickname(),roomName:$("roomname").value,private:false});
$("createPrivate").onclick=()=>{const pw=prompt("Choose a password for this private room:");if(pw)socket.emit("room:create",{name:nickname(),roomName:$("roomname").value,private:true,password:pw});};
$("join").onclick=()=>socket.emit("room:join",{roomId:$("roomid").value.trim().toUpperCase(),name:nickname(),password:$("password").value});
$("leave").onclick=()=>{toast("To leave, close this tab. Rejoin from the lobby in a new tab.");showLobby();socket.emit("rooms:list");};
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>socket.emit("game:action",{action:b.dataset.action,amount:Number($("raiseAmount").value)}));
