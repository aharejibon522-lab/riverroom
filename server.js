const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Hand } = require("pokersolver");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
app.use(express.static(__dirname));
app.get("/health", (_req, res) => res.json({ ok: true, service: "riverroom" }));

const PORT = process.env.PORT || 3000;
const STARTING_CHIPS = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const rooms = new Map();
const socketPlayers = new Map();

const SUITS = ["s", "h", "d", "c"];
const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
function deck() {
  const cards = [];
  for (const s of SUITS) for (const r of RANKS) cards.push(r + s);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
function id() { return crypto.randomBytes(3).toString("hex").toUpperCase(); }
function cleanName(s) { return String(s || "Player").trim().replace(/[<>]/g, "").slice(0, 18) || "Player"; }
function publicRoom(room) {
  return {
    id: room.id, name: room.name, private: room.private,
    players: room.players.map(p => ({ id: p.id, name: p.name, chips: p.chips, seated: true })),
    game: room.game ? {
      phase: room.game.phase, pot: room.game.pot, board: room.game.board,
      currentBet: room.game.currentBet, turn: room.game.players[room.game.turn]?.id || null,
      dealer: room.game.players[room.game.dealer]?.id || null,
      players: room.game.players.map(p => ({
        id:p.id, name:p.name, chips:p.chips, bet:p.bet,
        folded:p.folded, allIn:p.allIn, acted:p.acted
      }))
    } : null
  };
}
function emitRoom(room) { io.to(room.id).emit("room:update", publicRoom(room)); }
function notifyPlayer(p, event, data) { io.to(p.socketId).emit(event, data); }
function current(room) { return room.game?.players[room.game.turn]; }
function nextActive(g, from) {
  for (let n = 1; n <= g.players.length; n++) {
    const i = (from + n) % g.players.length;
    const p = g.players[i];
    if (!p.folded && !p.allIn && p.chips > 0) return i;
  }
  return from;
}
function activePlayers(g) { return g.players.filter(p => !p.folded); }
function roundComplete(g) {
  const able = g.players.filter(p => !p.folded && !p.allIn);
  return able.every(p => p.acted && p.bet === g.currentBet);
}
function startRound(room) {
  const seated = room.players.filter(p => p.chips > 0);
  if (seated.length < 2) return;
  const dealer = room.game ? (room.game.dealer + 1) % seated.length : 0;
  const g = {
    phase:"preflop", deck:deck(), board:[], pot:0, currentBet:BIG_BLIND,
    dealer, turn:0, players:seated.map(p => ({
      id:p.id, name:p.name, socketId:p.socketId, chips:p.chips,
      hole:[], bet:0, folded:false, allIn:false, acted:false
    }))
  };
  room.game = g;
  for (const p of g.players) p.hole = [g.deck.pop(), g.deck.pop()];
  const sb = g.players[(dealer + 1) % g.players.length];
  const bb = g.players[(dealer + 2) % g.players.length];
  const post = (p, amount) => {
    const paid = Math.min(p.chips, amount);
    p.chips -= paid; p.bet += paid; g.pot += paid;
    if (p.chips === 0) p.allIn = true;
  };
  post(sb, SMALL_BLIND); post(bb, BIG_BLIND);
  g.turn = nextActive(g, (dealer + 2) % g.players.length);
  for (const p of g.players) notifyPlayer(p, "cards:private", { cards:p.hole });
  emitRoom(room);
  if (g.players.filter(p => !p.folded).length === 1) finishHand(room);
}
function advanceStreet(room) {
  const g = room.game;
  g.players.forEach(p => { p.bet = 0; p.acted = false; });
  g.currentBet = 0;
  if (g.phase === "preflop") { g.phase="flop"; g.board.push(g.deck.pop(),g.deck.pop(),g.deck.pop()); }
  else if (g.phase === "flop") { g.phase="turn"; g.board.push(g.deck.pop()); }
  else if (g.phase === "turn") { g.phase="river"; g.board.push(g.deck.pop()); }
  else { finishHand(room); return; }
  const first = g.dealer;
  g.turn = nextActive(g, first);
  if (g.players.filter(p => !p.folded && !p.allIn).length <= 1) {
    while (g.board.length < 5) g.board.push(g.deck.pop());
    finishHand(room); return;
  }
  emitRoom(room);
}
function finishHand(room) {
  const g = room.game;
  if (!g) return;
  let winners = [];
  const contenders = activePlayers(g);
  if (contenders.length === 1) winners = contenders;
  else {
    const solved = contenders.map(p => ({p, hand:Hand.solve([...p.hole, ...g.board])}));
    const best = Hand.winners(solved.map(x => x.hand));
    winners = solved.filter(x => best.includes(x.hand)).map(x => x.p);
  }
  const share = Math.floor(g.pot / winners.length);
  let remainder = g.pot - share * winners.length;
  winners.forEach(p => { p.chips += share + (remainder-- > 0 ? 1 : 0); });
  const result = { winners:winners.map(p=>({id:p.id,name:p.name,amount:share})), pot:g.pot,
    handNames: contenders.map(p => ({name:p.name, hand: p.hole && g.board.length===5 ? Hand.solve([...p.hole,...g.board]).descr : (p.folded ? "Folded" : "Winner")})) };
  room.players.forEach(p => {
    const gp = g.players.find(x=>x.id===p.id);
    if (gp) p.chips = gp.chips;
    notifyPlayer(p, "hand:result", result);
  });
  emitRoom(room);
  room.game = null;
  setTimeout(() => { if (rooms.has(room.id) && room.players.length >= 2 && !room.game) startRound(room); }, 7000);
}
function act(room, player, action, amount) {
  const g = room.game;
  if (!g || current(room)?.id !== player.id) return;
  const p = current(room);
  const toCall = Math.max(0, g.currentBet - p.bet);
  if (action === "fold") { p.folded = true; p.acted = true; }
  else if (action === "check" && toCall === 0) { p.acted = true; }
  else if (action === "call") {
    const paid = Math.min(p.chips, toCall);
    p.chips -= paid; p.bet += paid; g.pot += paid; p.acted = true;
    if (p.chips === 0) p.allIn = true;
  } else if (action === "raise" || action === "bet") {
    const target = Number(amount);
    if (!Number.isFinite(target) || target <= g.currentBet || target > p.bet + p.chips) return;
    const paid = target - p.bet;
    p.chips -= paid; p.bet = target; g.pot += paid; g.currentBet = target;
    p.acted = true;
    if (p.chips === 0) p.allIn = true;
    g.players.forEach(x => { if (x.id !== p.id && !x.folded && !x.allIn) x.acted = false; });
  } else if (action === "allin") {
    const target = p.bet + p.chips;
    const paid = p.chips; p.chips = 0; p.bet = target; g.pot += paid; p.allIn = true; p.acted = true;
    if (target > g.currentBet) {
      g.currentBet = target;
      g.players.forEach(x => { if (x.id !== p.id && !x.folded && !x.allIn) x.acted = false; });
    }
  } else return;
  if (activePlayers(g).length === 1) { finishHand(room); return; }
  if (roundComplete(g)) { advanceStreet(room); return; }
  g.turn = nextActive(g, g.turn);
  emitRoom(room);
}

io.on("connection", socket => {
  socket.on("rooms:list", () => socket.emit("rooms:list", [...rooms.values()].filter(r=>!r.private).map(publicRoom)));
  socket.on("room:create", ({name, roomName, private:priv, password}) => {
    const player = {id:socket.id, socketId:socket.id, name:cleanName(name), chips:STARTING_CHIPS};
    const room = {id:id(), name:String(roomName||"RiverRoom Table").slice(0,28), private:!!priv,
      password:priv ? String(password||"").slice(0,30) : "", players:[player], game:null};
    rooms.set(room.id, room); socket.join(room.id); socketPlayers.set(socket.id, room.id);
    socket.emit("room:joined", {room:publicRoom(room), playerId:player.id});
    emitRoom(room); io.emit("rooms:list", [...rooms.values()].filter(r=>!r.private).map(publicRoom));
  });
  socket.on("room:join", ({roomId, name, password}) => {
    const room = rooms.get(String(roomId||"").toUpperCase());
    if (!room) return socket.emit("error:message","Room not found.");
    if (room.private && room.password !== String(password||"")) return socket.emit("error:message","Incorrect room password.");
    if (room.players.length >= 8) return socket.emit("error:message","This table is full (8 players).");
    if (room.players.some(p=>p.id===socket.id)) return;
    const player = {id:socket.id,socketId:socket.id,name:cleanName(name),chips:STARTING_CHIPS};
    room.players.push(player); socket.join(room.id); socketPlayers.set(socket.id,room.id);
    socket.emit("room:joined",{room:publicRoom(room),playerId:player.id});
    emitRoom(room); io.emit("rooms:list",[...rooms.values()].filter(r=>!r.private).map(publicRoom));
    if (room.players.length >= 2 && !room.game) startRound(room);
  });
  socket.on("game:action", ({action, amount}) => {
    const rid = socketPlayers.get(socket.id), room = rooms.get(rid);
    if (!room) return;
    const p = room.players.find(x=>x.id===socket.id);
    if (p) act(room,p,action,amount);
  });
  socket.on("game:start", () => {
    const rid=socketPlayers.get(socket.id), room=rooms.get(rid);
    if (room && room.players.length>=2 && !room.game) startRound(room);
  });
  socket.on("disconnect", () => {
    const rid=socketPlayers.get(socket.id), room=rooms.get(rid);
    socketPlayers.delete(socket.id);
    if (!room) return;
    room.players=room.players.filter(p=>p.id!==socket.id);
    if (room.game) {
      const gp=room.game.players.find(p=>p.id===socket.id);
      if (gp) gp.folded=true;
      if (activePlayers(room.game).length===1) finishHand(room);
      else if (current(room)?.id===socket.id) room.game.turn=nextActive(room.game,room.game.turn);
    }
    if (!room.players.length) rooms.delete(rid);
    else emitRoom(room);
    io.emit("rooms:list",[...rooms.values()].filter(r=>!r.private).map(publicRoom));
  });
});

server.listen(PORT, () => console.log(`RiverRoom running on port ${PORT}`));
