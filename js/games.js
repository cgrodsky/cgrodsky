/* Game engine: 11 games. Each builder fills a window body. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  function launch(app, createWindow) {
    const big = app.game === "flightsim";
    const { body } = createWindow({ title: app.name, icon: Icon.mini(app.id, app.name), width: big ? 900 : 460, height: big ? 600 : 540, appId: app.id });
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

  // ---- Microsoft Flight Simulator (real 3D — fly a Boeing 707-300) ----
  games.flightsim = (body) => {
    if (typeof THREE === "undefined") { body.innerHTML = `<div style="padding:24px;color:#334">3D engine (Three.js) failed to load. Check your connection and refresh.</div>`; return; }
    const T = THREE;
    body.innerHTML = `<div class="fsim">
      <div class="fsim-hud">
        <div class="fsim-gauge"><span class="fsim-val" id="fs-spd">120</span><span class="fsim-lbl">KTS</span></div>
        <div class="fsim-gauge"><span class="fsim-val" id="fs-alt">1500</span><span class="fsim-lbl">ALT ft</span></div>
        <div class="fsim-gauge"><span class="fsim-val" id="fs-hdg">000</span><span class="fsim-lbl">HDG</span></div>
        <div class="fsim-gauge"><span class="fsim-val" id="fs-thr">70</span><span class="fsim-lbl">THR %</span></div>
        <div class="fsim-gauge fsim-score"><span class="fsim-val" id="fs-rings">0</span><span class="fsim-lbl">RINGS</span></div>
      </div>
      <div class="fsim-title">Boeing 707-300</div>
      <div class="fsim-help">Drag to steer (up/down = pitch, left/right = bank) · <b>+ / −</b> throttle · fly through the rings</div>
      <div class="fsim-thr"><button class="fsim-tbtn" data-t="up">▲</button><button class="fsim-tbtn" data-t="dn">▼</button></div>
      <div class="fsim-msg" style="display:none"></div>
    </div>`;
    const host = body.querySelector(".fsim");
    const scene = new T.Scene();
    scene.background = new T.Color(0x8fc7f0);
    scene.fog = new T.Fog(0xbfe0f5, 200, 1400);
    const camera = new T.PerspectiveCamera(60, 1, 0.5, 4000);
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
    host.insertBefore(renderer.domElement, host.firstChild);
    scene.add(new T.HemisphereLight(0xffffff, 0x6a7a55, 1.05));
    const sun = new T.DirectionalLight(0xfff3d6, 0.8); sun.position.set(300, 500, 200); scene.add(sun);

    // Ground + scenery
    const ground = new T.Mesh(new T.PlaneGeometry(8000, 8000, 1, 1), new T.MeshLambertMaterial({ color: 0x5f9a4c }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const grid = new T.GridHelper(8000, 160, 0x4a7d3a, 0x4a7d3a); grid.position.y = 0.2; scene.add(grid);
    // runway
    const rw = new T.Mesh(new T.PlaneGeometry(60, 900), new T.MeshLambertMaterial({ color: 0x3a3a3a })); rw.rotation.x = -Math.PI / 2; rw.position.set(0, 0.4, -200); scene.add(rw);
    // mountains
    for (let i = 0; i < 40; i++) { const h = 120 + Math.random() * 380; const m = new T.Mesh(new T.ConeGeometry(80 + Math.random() * 160, h, 5), new T.MeshLambertMaterial({ color: 0x6b8f5a })); m.position.set((Math.random() - 0.5) * 6000, h / 2, (Math.random() - 0.5) * 6000); scene.add(m); }

    // Procedural Boeing 707-300
    function buildPlane() {
      const g = new T.Group();
      const white = new T.MeshStandardMaterial({ color: 0xf3f5f8, metalness: 0.3, roughness: 0.5 });
      const blue = new T.MeshStandardMaterial({ color: 0x1e5fa8, metalness: 0.3, roughness: 0.5 });
      const dark = new T.MeshStandardMaterial({ color: 0x2b2b30, metalness: 0.5, roughness: 0.4 });
      const fus = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 46, 20), white); fus.rotation.x = Math.PI / 2; g.add(fus);
      const nose = new T.Mesh(new T.SphereGeometry(2.2, 16, 12), white); nose.position.z = 23; nose.scale.z = 1.8; g.add(nose);
      const tailcone = new T.Mesh(new T.ConeGeometry(2.2, 6, 16), white); tailcone.rotation.x = -Math.PI / 2; tailcone.position.z = -25; g.add(tailcone);
      const stripe = new T.Mesh(new T.CylinderGeometry(2.22, 2.22, 40, 20, 1, true), blue); stripe.rotation.x = Math.PI / 2; stripe.scale.y = 0.18; stripe.position.y = 0.7; g.add(stripe);
      // swept wings
      const wingGeo = new T.BoxGeometry(34, 0.7, 7);
      const wingL = new T.Mesh(wingGeo, white); wingL.position.set(-15, -0.5, -2); wingL.rotation.y = 0.32; g.add(wingL);
      const wingR = new T.Mesh(wingGeo, white); wingR.position.set(15, -0.5, -2); wingR.rotation.y = -0.32; g.add(wingR);
      // tail fin + horizontal stabs
      const fin = new T.Mesh(new T.BoxGeometry(0.7, 9, 7), blue); fin.position.set(0, 5, -22); fin.rotation.x = 0.3; g.add(fin);
      const hs = new T.Mesh(new T.BoxGeometry(16, 0.6, 4), white); hs.position.set(0, 1.5, -23); g.add(hs);
      // 4 engines under wings
      [[-9, -3], [-16, -1], [9, -3], [16, -1]].forEach(([x, z]) => { const e = new T.Mesh(new T.CylinderGeometry(1.5, 1.4, 6, 14), dark); e.rotation.x = Math.PI / 2; e.position.set(x, -2.4, z + 3); g.add(e); });
      g.scale.setScalar(0.9);
      return g;
    }
    const plane = buildPlane(); scene.add(plane);

    // Rings to fly through
    const rings = [];
    function spawnRing(z) { const r = new T.Mesh(new T.TorusGeometry(22, 2.4, 10, 28), new T.MeshStandardMaterial({ color: 0xffc21e, emissive: 0x6b4b00, metalness: 0.3, roughness: 0.4 })); r.position.set((Math.random() - 0.5) * 500, 120 + Math.random() * 320, z); scene.add(r); rings.push(r); }
    for (let i = 0; i < 6; i++) spawnRing(-500 - i * 500);

    // State
    let pos = new T.Vector3(0, 460, 0), heading = 0, pitch = 0, roll = 0, speed = 120, thr = 0.7, ringScore = 0, alive = true, raf = 0;
    const spdEl = body.querySelector("#fs-spd"), altEl = body.querySelector("#fs-alt"), hdgEl = body.querySelector("#fs-hdg"), thrEl = body.querySelector("#fs-thr"), ringEl = body.querySelector("#fs-rings"), msg = body.querySelector(".fsim-msg");
    // input
    let drag = false, lx = 0, ly = 0, pRoll = 0, pPitch = 0;
    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", (e) => { drag = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener("pointermove", (e) => { if (!drag) return; pRoll = Math.max(-1, Math.min(1, (e.clientX - lx) / 120)); pPitch = Math.max(-1, Math.min(1, (e.clientY - ly) / 120)); });
    dom.addEventListener("pointerup", () => { drag = false; pRoll = 0; pPitch = 0; });
    const keys = {};
    const keyh = (e) => { keys[e.key] = e.type === "keydown"; if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "+", "-", "=", "w", "s"].includes(e.key)) e.preventDefault(); };
    dom.tabIndex = 0; dom.addEventListener("keydown", keyh); dom.addEventListener("keyup", keyh);
    body.querySelectorAll(".fsim-tbtn").forEach((b) => b.onpointerdown = () => { thr = Math.max(0, Math.min(1, thr + (b.dataset.t === "up" ? 0.08 : -0.08))); });

    function resize() { const w = host.clientWidth || 1, h = host.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    function reset() { pos.set(0, 460, 0); heading = 0; pitch = 0; roll = 0; speed = 120; thr = 0.7; alive = true; msg.style.display = "none"; }
    function crash() { if (!alive) return; alive = false; msg.innerHTML = `<b>Crashed.</b><br>Rings cleared: ${ringScore}<br><button class="fsim-restart">Fly again</button>`; msg.style.display = "flex"; msg.querySelector(".fsim-restart").onclick = () => { ringScore = 0; ringEl.textContent = 0; reset(); }; }

    function loop() {
      if (!document.body.contains(host)) { renderer.dispose && renderer.dispose(); return; }
      raf = requestAnimationFrame(loop);
      resize();
      if (alive) {
        // controls: keyboard overrides/augments drag
        let cRoll = pRoll + (keys.ArrowLeft ? -1 : 0) + (keys.ArrowRight ? 1 : 0);
        let cPitch = pPitch + (keys.ArrowUp ? -1 : 0) + (keys.ArrowDown ? 1 : 0);
        if (keys["+"] || keys["="] || keys.w) thr = Math.min(1, thr + 0.01);
        if (keys["-"] || keys.s) thr = Math.max(0, thr - 0.01);
        roll += (cRoll * 0.6 - roll) * 0.1;
        pitch += (cPitch * 0.5 - pitch) * 0.08;
        heading += -roll * 0.012 * (speed / 120);
        const targetSpeed = 60 + thr * 320;
        speed += (targetSpeed - speed) * 0.02 - pitch * 6; // climbing bleeds speed
        speed = Math.max(30, speed);
        const fwd = new T.Vector3(Math.sin(heading), -Math.sin(pitch) * 0.9, -Math.cos(heading));
        pos.addScaledVector(fwd, speed * 0.02);
        if (pos.y < 6) crash();
        // orient plane
        plane.position.copy(pos);
        plane.rotation.set(0, 0, 0);
        plane.rotateY(heading);
        plane.rotateX(pitch);
        plane.rotateZ(-roll);
        // chase camera
        const camOff = new T.Vector3(0, 9, 34).applyEuler(new T.Euler(0, heading, 0));
        camera.position.copy(pos).add(camOff);
        camera.lookAt(pos.x, pos.y + 3, pos.z);
        // rings
        rings.forEach((r) => {
          const d = r.position.distanceTo(pos);
          if (d < 22 && Math.abs(r.position.z - pos.z) < 12) { ringScore++; ringEl.textContent = ringScore; r.position.z = pos.z - 3000 - Math.random() * 500; r.position.x = pos.x + (Math.random() - 0.5) * 500; r.position.y = 120 + Math.random() * 340; }
          else if (r.position.z > pos.z + 200) { r.position.z = pos.z - 2500 - Math.random() * 800; r.position.x = pos.x + (Math.random() - 0.5) * 500; }
          r.rotation.z += 0.01;
        });
        spdEl.textContent = Math.round(speed);
        altEl.textContent = Math.round(pos.y * 3.3);
        hdgEl.textContent = String(Math.round((((heading * 180 / Math.PI) % 360) + 360) % 360)).padStart(3, "0");
        thrEl.textContent = Math.round(thr * 100);
      }
      renderer.render(scene, camera);
    }
    reset(); requestAnimationFrame(loop);
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
