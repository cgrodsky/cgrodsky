/* Game engine: 11 games. Each builder fills a window body. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  function launch(app, createWindow) {
    const { body } = createWindow({ title: app.name, icon: Icon.mini(app.id, app.name), width: 460, height: 540, appId: app.id });
    const fn = games[app.game];
    if (fn) fn(body); else body.innerHTML = "<p style='padding:20px'>Coming soon.</p>";
  }

  const wrap = (body, title) => {
    body.innerHTML = `<div style="padding:16px;height:100%;display:flex;flex-direction:column;gap:10px">
      <h2 style="margin:0">${title}</h2><div class="game-host" style="flex:1"></div>
      <div class="game-status muted"></div></div>`;
    return { host: body.querySelector(".game-host"), status: body.querySelector(".game-status") };
  };

  const games = {};

  // ---- Tic-Tac-Toe (vs CPU) ----
  games.tictactoe = (body) => {
    const { host, status } = wrap(body, "Tic-Tac-Toe");
    let board, over;
    const grid = el(`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:300px"></div>`);
    host.appendChild(grid);
    const reset = el(`<button class="pill-btn">New game</button>`);
    host.appendChild(reset);
    reset.onclick = init;
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    function winner(b) { for (const [a,c,d] of wins) if (b[a] && b[a]===b[c] && b[a]===b[d]) return b[a]; return null; }
    function init() {
      board = Array(9).fill(""); over = false; status.textContent = "Your turn (X)";
      grid.innerHTML = "";
      board.forEach((_, i) => {
        const c = el(`<button style="aspect-ratio:1;font-size:2rem;border:1px solid var(--border);background:var(--bg-elev);color:var(--text);border-radius:8px;cursor:pointer"></button>`);
        c.onclick = () => move(i, c); grid.appendChild(c);
      });
    }
    function move(i) {
      if (over || board[i]) return;
      board[i] = "X"; render();
      if (check()) return;
      const empties = board.map((v,idx)=>v?-1:idx).filter(x=>x>=0);
      if (empties.length) { board[empties[Math.floor(Math.random()*empties.length)]] = "O"; render(); check(); }
    }
    function render() { [...grid.children].forEach((c,i)=>c.textContent=board[i]); }
    function check() {
      const w = winner(board);
      if (w) { status.textContent = w === "X" ? "You win!" : "CPU wins!"; over = true; return true; }
      if (board.every(Boolean)) { status.textContent = "Draw!"; over = true; return true; }
      return false;
    }
    init();
  };

  // ---- Snake ----
  games.snake = (body) => {
    const { host, status } = wrap(body, "Snake");
    const cv = el(`<canvas width="360" height="360" style="background:#111;border-radius:8px"></canvas>`);
    host.appendChild(cv);
    const ctx = cv.getContext("2d"), N = 18, sz = 20;
    let snake, dir, food, score, loop;
    function place() { food = { x: Math.floor(Math.random()*N), y: Math.floor(Math.random()*N) }; }
    function init() {
      snake = [{x:9,y:9}]; dir = {x:1,y:0}; score = 0; place();
      clearInterval(loop); loop = setInterval(tick, 110);
      status.textContent = "Score: 0  (arrow keys)";
    }
    function tick() {
      const h = { x: (snake[0].x+dir.x+N)%N, y: (snake[0].y+dir.y+N)%N };
      if (snake.some(s=>s.x===h.x&&s.y===h.y)) { clearInterval(loop); status.textContent = "Game over! Score "+score; return; }
      snake.unshift(h);
      if (h.x===food.x&&h.y===food.y) { score++; status.textContent="Score: "+score; place(); } else snake.pop();
      ctx.fillStyle="#111"; ctx.fillRect(0,0,360,360);
      ctx.fillStyle="#e53935"; ctx.fillRect(food.x*sz,food.y*sz,sz-2,sz-2);
      ctx.fillStyle="#43a047"; snake.forEach(s=>ctx.fillRect(s.x*sz,s.y*sz,sz-2,sz-2));
    }
    const onKey = (e) => {
      const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];
      if (m && (m[0]!==-dir.x||m[1]!==-dir.y)) { dir={x:m[0],y:m[1]}; e.preventDefault(); }
    };
    document.addEventListener("keydown", onKey);
    body.closest(".win").addEventListener("DOMNodeRemoved", () => { clearInterval(loop); document.removeEventListener("keydown", onKey); });
    const btn = el(`<button class="pill-btn">Restart</button>`); btn.onclick=init; host.appendChild(btn);
    init();
  };

  // ---- Pong ----
  games.pong = (body) => {
    const { host, status } = wrap(body, "Pong");
    const cv = el(`<canvas width="400" height="300" style="background:#000;border-radius:8px"></canvas>`); host.appendChild(cv);
    const ctx = cv.getContext("2d");
    let py=120, ay=120, bx=200, by=150, vx=3, vy=2, ps=0, as=0, loop;
    cv.onmousemove = (e) => { const r=cv.getBoundingClientRect(); py=Math.max(0,Math.min(240,e.clientY-r.top-30)); };
    function tick() {
      bx+=vx; by+=vy;
      if (by<0||by>300) vy=-vy;
      if (bx<20 && by>py && by<py+60) vx=Math.abs(vx);
      if (bx>380 && by>ay && by<ay+60) vx=-Math.abs(vx);
      ay += (by-ay-30)*0.08;
      if (bx<0){as++;reset();} if (bx>400){ps++;reset();}
      ctx.fillStyle="#000";ctx.fillRect(0,0,400,300);
      ctx.fillStyle="#fff";ctx.fillRect(10,py,8,60);ctx.fillRect(382,ay,8,60);ctx.fillRect(bx,by,8,8);
      status.textContent=`You ${ps} : ${as} CPU`;
    }
    function reset(){bx=200;by=150;vx=(Math.random()<.5?3:-3);vy=2;}
    loop=setInterval(tick,16);
    body.closest(".win").addEventListener("DOMNodeRemoved",()=>clearInterval(loop));
  };

  // ---- Memory match (letters) ----
  games.memory = (body) => {
    const { host, status } = wrap(body, "Memory Match");
    const grid = el(`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"></div>`); host.appendChild(grid);
    let first, lock=false, matched;
    function init() {
      const letters="ABCDEFGH".split("");
      const deck=[...letters,...letters].sort(()=>Math.random()-.5);
      matched=0; first=null; status.textContent="Find all pairs"; grid.innerHTML="";
      deck.forEach((ch)=>{
        const c=el(`<button data-v="${ch}" style="aspect-ratio:1;font-size:1.6rem;border-radius:8px;border:none;background:var(--accent);color:transparent;cursor:pointer">${ch}</button>`);
        c.onclick=()=>flip(c); grid.appendChild(c);
      });
    }
    function flip(c){
      if(lock||c.style.color==="var(--text)"||c.dataset.done)return;
      c.style.color="var(--text)";c.style.background="var(--bg-elev)";
      if(!first){first=c;return;}
      if(first.dataset.v===c.dataset.v){first.dataset.done=c.dataset.done="1";matched++;first=null;if(matched===8)status.textContent="You win!";}
      else{lock=true;const f=first;setTimeout(()=>{[f,c].forEach(x=>{x.style.color="transparent";x.style.background="var(--accent)";});lock=false;},700);first=null;}
    }
    const btn=el(`<button class="pill-btn">New game</button>`);btn.onclick=init;host.appendChild(btn);init();
  };

  // ---- 2048 ----
  games.g2048 = (body) => {
    const { host, status } = wrap(body, "2048");
    const grid = el(`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#bbada0;padding:8px;border-radius:8px;width:300px"></div>`); host.appendChild(grid);
    let b, score;
    const colors={2:"#eee4da",4:"#ede0c8",8:"#f2b179",16:"#f59563",32:"#f67c5f",64:"#f65e3b",128:"#edcf72",256:"#edcc61",512:"#edc850",1024:"#edc53f",2048:"#edc22e"};
    function init(){b=Array(16).fill(0);score=0;add();add();draw();status.textContent="Use arrow keys";}
    function add(){const e=b.map((v,i)=>v?-1:i).filter(i=>i>=0);if(e.length)b[e[Math.floor(Math.random()*e.length)]]=Math.random()<.9?2:4;}
    function draw(){grid.innerHTML="";b.forEach(v=>{const c=el(`<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:6px;font-weight:700;font-size:1.4rem;background:${v?colors[v]||"#3c3a32":"#cdc1b4"};color:${v>4?"#fff":"#776e65"}">${v||""}</div>`);grid.appendChild(c);});}
    function slide(row){let a=row.filter(x=>x);for(let i=0;i<a.length-1;i++)if(a[i]===a[i+1]){a[i]*=2;score+=a[i];a.splice(i+1,1);}while(a.length<4)a.push(0);return a;}
    function move(dir){
      const old=b.join();let rows=[];
      for(let r=0;r<4;r++){let row=[0,1,2,3].map(c=>{
        const idx=dir==="l"?r*4+c:dir==="r"?r*4+(3-c):dir==="u"?c*4+r:(3-c)*4+r;return b[idx];});
        row=slide(row);
        row.forEach((v,c)=>{const idx=dir==="l"?r*4+c:dir==="r"?r*4+(3-c):dir==="u"?c*4+r:(3-c)*4+r;b[idx]=v;});
      }
      if(b.join()!==old){add();draw();if(b.includes(2048))status.textContent="You made 2048!";}
    }
    const onKey=(e)=>{const m={ArrowLeft:"l",ArrowRight:"r",ArrowUp:"u",ArrowDown:"d"}[e.key];if(m){move(m);e.preventDefault();}};
    document.addEventListener("keydown",onKey);
    body.closest(".win").addEventListener("DOMNodeRemoved",()=>document.removeEventListener("keydown",onKey));
    init();
  };

  // ---- Minesweeper ----
  games.minesweeper = (body) => {
    const { host, status } = wrap(body, "Minesweeper");
    const N=9, M=10; let cells, revealed, over;
    const grid=el(`<div style="display:grid;grid-template-columns:repeat(9,30px);gap:2px"></div>`);host.appendChild(grid);
    function init(){
      cells=Array(N*N).fill(0);revealed=Array(N*N).fill(false);over=false;status.textContent=M+" mines";
      let placed=0;while(placed<M){const i=Math.floor(Math.random()*N*N);if(cells[i]!==-1){cells[i]=-1;placed++;}}
      for(let i=0;i<N*N;i++){if(cells[i]===-1)continue;let n=0;neighbors(i).forEach(j=>{if(cells[j]===-1)n++;});cells[i]=n;}
      grid.innerHTML="";
      for(let i=0;i<N*N;i++){const c=el(`<button style="width:30px;height:30px;border:1px solid var(--border);background:var(--bg-elev);cursor:pointer"></button>`);c.onclick=()=>reveal(i);grid.appendChild(c);}
    }
    function neighbors(i){const r=Math.floor(i/N),c=i%N,out=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const nr=r+dr,nc=c+dc;if(nr>=0&&nr<N&&nc>=0&&nc<N)out.push(nr*N+nc);}return out;}
    function reveal(i){
      if(over||revealed[i])return;revealed[i]=true;const c=grid.children[i];
      if(cells[i]===-1){c.textContent="*";c.style.background="#e53935";status.textContent="Boom! Game over";over=true;return;}
      c.style.background="var(--bg)";c.textContent=cells[i]||"";
      if(cells[i]===0)neighbors(i).forEach(reveal);
      if(revealed.filter(Boolean).length===N*N-M)status.textContent="You cleared it!";
    }
    const btn=el(`<button class="pill-btn">New game</button>`);btn.onclick=init;host.appendChild(btn);init();
  };

  // ---- Whack-a-mole ----
  games.whack = (body) => {
    const { host, status } = wrap(body, "Whack-a-Mole");
    const grid=el(`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px"></div>`);host.appendChild(grid);
    let score,loop,timeLeft;
    const holes=[];for(let i=0;i<9;i++){const h=el(`<button style="aspect-ratio:1;border-radius:50%;border:none;background:#5a3a22;font-size:2rem;cursor:pointer"></button>`);h.onclick=()=>{if(h.dataset.m){score++;h.textContent="";h.dataset.m="";status.textContent="Score: "+score;}};holes.push(h);grid.appendChild(h);}
    function init(){score=0;timeLeft=20;status.textContent="Score: 0";clearInterval(loop);
      loop=setInterval(()=>{holes.forEach(h=>{h.textContent="";h.dataset.m="";});const i=Math.floor(Math.random()*9);holes[i].dataset.m="1";holes[i].textContent="●";timeLeft-=0.7;if(timeLeft<=0){clearInterval(loop);holes.forEach(h=>{h.textContent="";h.dataset.m="";});status.textContent="Time! Final score "+score;}},700);}
    const btn=el(`<button class="pill-btn">Start</button>`);btn.onclick=init;host.appendChild(btn);
    body.closest(".win").addEventListener("DOMNodeRemoved",()=>clearInterval(loop));
  };

  // ---- Rock Paper Scissors ----
  games.rps = (body) => {
    const { host, status } = wrap(body, "Rock Paper Scissors");
    let ws=0,ls=0;
    const opts=["Rock","Paper","Scissors"];
    const row=el(`<div class="row"></div>`);
    opts.forEach((o)=>{const b=el(`<button class="pill-btn" style="flex:1">${o}</button>`);b.onclick=()=>play(o);row.appendChild(b);});
    host.appendChild(row);
    function play(p){const c=opts[Math.floor(Math.random()*3)];let r;if(p===c)r="Tie";else if((p==="Rock"&&c==="Scissors")||(p==="Paper"&&c==="Rock")||(p==="Scissors"&&c==="Paper")){r="You win!";ws++;}else{r="CPU wins";ls++;}status.textContent=`You: ${p} | CPU: ${c} — ${r}  (W${ws} L${ls})`;}
    status.textContent="Make your move";
  };

  // ---- Guess the number ----
  games.guess = (body) => {
    const { host, status } = wrap(body, "Guess the Number");
    let target,tries;
    const inp=el(`<input type="number" class="field" style="padding:10px;width:120px" placeholder="1-100">`);
    const btn=el(`<button class="pill-btn">Guess</button>`);
    host.appendChild(el(`<p>I'm thinking of a number from 1 to 100.</p>`));
    const r=el(`<div class="row"></div>`);r.append(inp,btn);host.appendChild(r);
    function init(){target=Math.floor(Math.random()*100)+1;tries=0;status.textContent="Make a guess";}
    btn.onclick=()=>{const g=+inp.value;tries++;if(g===target)status.textContent=`Correct! ${tries} tries.`;else status.textContent=g<target?"Higher!":"Lower!";};
    init();
  };

  // ---- Simon ----
  games.simon = (body) => {
    const { host, status } = wrap(body, "Simon Says");
    const cols=["#e53935","#43a047","#1e88e5","#fdd835"];let seq,pos,playing;
    const grid=el(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:280px"></div>`);host.appendChild(grid);
    const pads=cols.map((c,i)=>{const p=el(`<button style="aspect-ratio:1;border:none;border-radius:10px;background:${c};opacity:.6;cursor:pointer"></button>`);p.onclick=()=>click(i);grid.appendChild(p);return p;});
    function flash(i){return new Promise(r=>{pads[i].style.opacity=1;setTimeout(()=>{pads[i].style.opacity=.6;setTimeout(r,150);},350);});}
    async function show(){playing=false;for(const i of seq)await flash(i);playing=true;pos=0;status.textContent="Your turn";}
    function click(i){if(!playing)return;if(i===seq[pos]){pos++;if(pos===seq.length){status.textContent="Good! +1";seq.push(Math.floor(Math.random()*4));setTimeout(show,600);}}else{status.textContent="Wrong! Score "+(seq.length-1);init();}}
    function init(){seq=[Math.floor(Math.random()*4)];setTimeout(show,600);status.textContent="Watch...";}
    const btn=el(`<button class="pill-btn">Start</button>`);btn.onclick=init;host.appendChild(btn);
  };

  // ---- Breakout ----
  games.breakout = (body) => {
    const { host, status } = wrap(body, "Breakout");
    const cv=el(`<canvas width="400" height="320" style="background:#111;border-radius:8px"></canvas>`);host.appendChild(cv);
    const ctx=cv.getContext("2d");
    let px=160,bx=200,by=250,vx=3,vy=-3,bricks,loop,score;
    cv.onmousemove=(e)=>{const r=cv.getBoundingClientRect();px=Math.max(0,Math.min(320,e.clientX-r.left-40));};
    function init(){bricks=[];for(let r=0;r<4;r++)for(let c=0;c<8;c++)bricks.push({x:c*50+2,y:r*20+20,on:true});score=0;bx=200;by=250;vx=3;vy=-3;clearInterval(loop);loop=setInterval(tick,16);}
    function tick(){bx+=vx;by+=vy;if(bx<0||bx>396)vx=-vx;if(by<0)vy=-vy;
      if(by>300&&bx>px&&bx<px+80)vy=-Math.abs(vy);
      if(by>320){clearInterval(loop);status.textContent="Game over! Score "+score;return;}
      bricks.forEach(b=>{if(b.on&&bx>b.x&&bx<b.x+48&&by>b.y&&by<b.y+16){b.on=false;vy=-vy;score++;}});
      ctx.fillStyle="#111";ctx.fillRect(0,0,400,320);
      bricks.forEach(b=>{if(b.on){ctx.fillStyle="#1e88e5";ctx.fillRect(b.x,b.y,48,16);}});
      ctx.fillStyle="#fff";ctx.fillRect(px,308,80,8);ctx.beginPath();ctx.arc(bx,by,5,0,7);ctx.fill();
      status.textContent="Score: "+score;
      if(bricks.every(b=>!b.on)){clearInterval(loop);status.textContent="You win! Score "+score;}
    }
    const btn=el(`<button class="pill-btn">Start</button>`);btn.onclick=init;host.appendChild(btn);
    body.closest(".win").addEventListener("DOMNodeRemoved",()=>clearInterval(loop));
  };

  // ---- Microsoft Flight Simulator (tap to keep the plane flying through the gaps) ----
  games.flightsim = (body) => {
    const { host, status } = wrap(body, "Microsoft Flight Simulator");
    const W = 400, H = 360, cv = el(`<canvas width="${W}" height="${H}" style="background:linear-gradient(#79c6ef,#d6effb);border-radius:8px;touch-action:none;outline:none"></canvas>`); host.appendChild(cv);
    const ctx = cv.getContext("2d");
    let y, vy, obs, loop, score, alive, best = 0;
    function flap() { if (!alive) { init(); return; } vy = -5.4; }
    cv.addEventListener("pointerdown", flap);
    cv.tabIndex = 0; cv.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); flap(); } });
    function mk(x) { const gap = 120; return { x, top: 34 + Math.random() * (H - gap - 80), gap, passed: false }; }
    function init() { y = 150; vy = 0; score = 0; alive = true; obs = [mk(440), mk(640), mk(840)]; clearInterval(loop); loop = setInterval(tick, 16); setTimeout(() => cv.focus(), 30); }
    function die() { if (!alive) return; alive = false; clearInterval(loop); best = Math.max(best, score); status.textContent = `Crashed! Score ${score} · Best ${best} — tap to fly again`; }
    function tick() {
      if (!document.body.contains(cv)) { clearInterval(loop); return; }
      vy += 0.3; y += vy;
      obs.forEach((o) => o.x -= 2.6);
      if (obs[0].x < -50) { obs.shift(); obs.push(mk(obs[obs.length - 1].x + 200)); }
      const px = 88, pw = 30, ph = 14;
      obs.forEach((o) => { if (!o.passed && o.x + 40 < px) { o.passed = true; score++; } if (px + pw > o.x && px < o.x + 40 && (y < o.top || y + ph > o.top + o.gap)) die(); });
      if (y < 0 || y + ph > H) die();
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,.75)";
      for (let i = 0; i < 3; i++) { const cx = ((-score * 6 + i * 150) % 480 + 480) % 480 - 40; ctx.beginPath(); ctx.arc(cx, 50 + i * 26, 16, 0, 7); ctx.arc(cx + 18, 50 + i * 26, 20, 0, 7); ctx.arc(cx + 40, 50 + i * 26, 15, 0, 7); ctx.fill(); }
      obs.forEach((o) => { ctx.fillStyle = "#3f8a44"; ctx.fillRect(o.x, 0, 40, o.top); ctx.fillRect(o.x, o.top + o.gap, 40, H - o.top - o.gap); ctx.fillStyle = "#347038"; ctx.fillRect(o.x, o.top - 8, 40, 8); ctx.fillRect(o.x, o.top + o.gap, 40, 8); });
      ctx.save(); ctx.translate(88, y + 7); ctx.rotate(Math.max(-0.5, Math.min(0.7, vy * 0.06)));
      ctx.fillStyle = "#e53935"; ctx.beginPath(); ctx.moveTo(-16, -8); ctx.lineTo(22, 0); ctx.lineTo(-16, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fafafa"; ctx.fillRect(-14, -10, 12, 4); ctx.fillRect(-14, 6, 12, 4); ctx.fillStyle = "#90caf9"; ctx.fillRect(2, -3, 8, 6); ctx.restore();
      status.textContent = "Score: " + score;
    }
    const btn = el(`<button class="pill-btn">Start · tap / space to fly</button>`); btn.onclick = init; host.appendChild(btn);
    init();
  };

  // ---- Grand Theft Auto (top-down endless driver — dodge the traffic) ----
  games.gtadrive = (body) => {
    const { host, status } = wrap(body, "Grand Theft Auto");
    const W = 360, H = 420, cv = el(`<canvas width="${W}" height="${H}" style="background:#4b4b4b;border-radius:8px;touch-action:none;outline:none"></canvas>`); host.appendChild(cv);
    const ctx = cv.getContext("2d");
    const lanes = [80, 180, 280]; let lane, cars, loop, score, alive, best = 0, speed, dash, sp;
    function move(d) { if (!alive) { init(); return; } lane = Math.max(0, Math.min(2, lane + d)); }
    cv.addEventListener("pointerdown", (e) => { if (!alive) { init(); return; } const r = cv.getBoundingClientRect(); move((e.clientX - r.left) < W / 2 ? -1 : 1); });
    cv.tabIndex = 0; cv.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); } if (e.key === "ArrowRight") { e.preventDefault(); move(1); } });
    function init() { lane = 1; cars = []; score = 0; alive = true; speed = 4; dash = 0; sp = 0; clearInterval(loop); loop = setInterval(tick, 16); setTimeout(() => cv.focus(), 30); }
    function die() { if (!alive) return; alive = false; clearInterval(loop); best = Math.max(best, Math.floor(score / 60)); status.textContent = `Busted! ${Math.floor(score / 60)}m · Best ${best}m — tap to restart`; }
    function tick() {
      if (!document.body.contains(cv)) { clearInterval(loop); return; }
      dash = (dash + speed) % 40; score++; if (score % 600 === 0) speed += 0.6;
      sp++; if (sp > Math.max(28, 72 - speed * 4)) { sp = 0; cars.push({ lane: Math.floor(Math.random() * 3), y: -70, c: ["#d32f2f", "#1976d2", "#388e3c", "#f57c00", "#7b1fa2", "#00838f"][Math.floor(Math.random() * 6)] }); }
      cars.forEach((c) => c.y += speed);
      const py = H - 90;
      cars.forEach((c) => { if (c.lane === lane && c.y + 64 > py && c.y < py + 64) die(); });
      cars = cars.filter((c) => c.y < H + 70);
      draw();
    }
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function car(x, y, c) { ctx.fillStyle = c; rr(x - 18, y, 36, 64, 8); ctx.fill(); ctx.fillStyle = "rgba(10,10,20,.55)"; ctx.fillRect(x - 13, y + 8, 26, 16); ctx.fillRect(x - 13, y + 40, 26, 14); }
    function draw() {
      ctx.fillStyle = "#4b4b4b"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#eaeaea"; ctx.lineWidth = 4; ctx.setLineDash([20, 20]); ctx.lineDashOffset = -dash;
      [130, 230].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }); ctx.setLineDash([]);
      ctx.fillStyle = "#c9a227"; ctx.fillRect(28, 0, 5, H); ctx.fillRect(W - 33, 0, 5, H);
      cars.forEach((c) => car(lanes[c.lane], c.y, c.c));
      car(lanes[lane], H - 90, "#f4d000");
      status.textContent = "Distance: " + Math.floor(score / 60) + "m";
    }
    const btn = el(`<button class="pill-btn">Start · tap left / right to steer</button>`); btn.onclick = init; host.appendChild(btn);
    init();
  };

  window.Games = { launch };
})();
