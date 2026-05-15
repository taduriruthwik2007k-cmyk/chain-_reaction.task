var ROWS = 12;
var COLS = 6;
var board = [];
var owners = [];
var turn = 0;
var paused = false;
var gameOver = false;
var exploding = false;
var p1time = 0;
var p2time = 0;
var totaltime = 0;
var turnStart = Date.now();
var moveCount = [0, 0];
var timerInterval;
var actx = null;

function getAudioCtx(){
  if(!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}

function beep(freq, dur, type, vol){
  try{
    var ctx = getAudioCtx();
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start();
    o.stop(ctx.currentTime + dur);
  }catch(e){}
}

function soundPlace(){
  beep(520, 0.07, 'square', 0.08);
}

function soundExplode(){
  beep(180, 0.18, 'sawtooth', 0.13);
  setTimeout(function(){ beep(300, 0.1, 'square', 0.07); }, 40);
}

function soundWin(){
  beep(523, 0.3, 'sine', 0.14);
  setTimeout(function(){ beep(659, 0.3, 'sine', 0.14); }, 110);
  setTimeout(function(){ beep(784, 0.3, 'sine', 0.14); }, 220);
  setTimeout(function(){ beep(1047, 0.3, 'sine', 0.14); }, 330);
}

function findCapacity(r, c){
  var isEdgeRow = (r == 0 || r == ROWS-1);
  var isEdgeCol = (c == 0 || c == COLS-1);
  if(isEdgeRow && isEdgeCol){
    return 2;
  }else if(isEdgeRow || isEdgeCol){
    return 3;
  }else{
    return 4;
  }
}

function getNeighbors(r, c){
  var list = [];
  if(r > 0) list.push([r-1, c]);
  if(r < ROWS-1) list.push([r+1, c]);
  if(c > 0) list.push([r, c-1]);
  if(c < COLS-1) list.push([r, c+1]);
  return list;
}

function getIndex(r, c){
  return r * COLS + c;
}

function fmt(sec){
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  if(s < 10){
    return m + ':0' + s;
  }else{
    return m + ':' + s;
  }
}

function renderCell(r, c){
  var el = document.querySelector('[data-r="'+r+'"][data-c="'+c+'"]');
  if(!el) return;
  var i = getIndex(r, c);
  var orbs = board[i];
  var owner = owners[i];
  if(owner == 0){
    el.className = 'cell p1';
  }else if(owner == 1){
    el.className = 'cell p2';
  }else{
    el.className = 'cell';
  }
  el.setAttribute('data-orbs', orbs);
  el.innerHTML = '';
  var show = orbs;
  if(show > 4) show = 4;
  for(var k = 0; k < show; k++){
    var d = document.createElement('div');
    d.className = 'dot';
    el.appendChild(d);
  }
}

function updateScores(){
  var s1 = 0;
  var s2 = 0;
  for(var i = 0; i < board.length; i++){
    if(owners[i] == 0) s1 += board[i];
    if(owners[i] == 1) s2 += board[i];
  }
  document.getElementById('s1').textContent = s1;
  document.getElementById('s2').textContent = s2;
}

function updateTimerDisplay(){
  document.getElementById('t1').textContent = fmt(p1time);
  document.getElementById('t2').textContent = fmt(p2time);
  document.getElementById('tot').textContent = fmt(totaltime);
}

function checkWin(){
  if(moveCount[0] < 1 || moveCount[1] < 1) return -1;
  var p1cells = 0;
  var p2cells = 0;
  for(var i = 0; i < owners.length; i++){
    if(owners[i] == 0) p1cells++;
    if(owners[i] == 1) p2cells++;
  }
  if(p1cells == 0) return 1;
  if(p2cells == 0) return 0;
  return -1;
}

function showWin(winner){
  gameOver = true;
  clearInterval(timerInterval);
  soundWin();
  setTimeout(function(){
    window.alert('Player ' + (winner+1) + ' wins!\nP1 time: ' + fmt(p1time) + '   P2 time: ' + fmt(p2time));
    resetGame();
  }, 50);
}

function explodeCell(r, c, done){
  var i = getIndex(r, c);
  var cap = findCapacity(r, c);
  if(board[i] < cap){
    done();
    return;
  }
  var owner = owners[i];
  board[i] = board[i] - cap;
  if(board[i] <= 0){
    board[i] = 0;
    owners[i] = -1;
  }
  soundExplode();
  var nbs = getNeighbors(r, c);
  for(var n = 0; n < nbs.length; n++){
    var ni = getIndex(nbs[n][0], nbs[n][1]);
    board[ni]++;
    owners[ni] = owner;
  }
  renderCell(r, c);
  for(var n = 0; n < nbs.length; n++){
    renderCell(nbs[n][0], nbs[n][1]);
  }
  updateScores();
  setTimeout(function(){
    var w = checkWin();
    if(w != -1){
      showWin(w);
      return;
    }
    var needMore = [];
    for(var n = 0; n < nbs.length; n++){
      var ni = getIndex(nbs[n][0], nbs[n][1]);
      if(board[ni] >= findCapacity(nbs[n][0], nbs[n][1])){
        needMore.push(nbs[n]);
      }
    }
    if(needMore.length == 0){
      done();
      return;
    }
    var pending = needMore.length;
    for(var n = 0; n < needMore.length; n++){
      explodeCell(needMore[n][0], needMore[n][1], function(){
        pending--;
        if(pending == 0) done();
      });
    }
  }, 200);
}

function cellClicked(r, c){
  if(paused || gameOver || exploding) return;
  var i = getIndex(r, c);
  if(owners[i] != -1 && owners[i] != turn) return;
  var now = Date.now();
  var elapsed = Math.floor((now - turnStart) / 1000);
  if(turn == 0){
    p1time += elapsed;
  }else{
    p2time += elapsed;
  }
  turnStart = now;
  moveCount[turn]++;
  board[i]++;
  owners[i] = turn;
  renderCell(r, c);
  updateScores();
  soundPlace();
  var cap = findCapacity(r, c);
  if(board[i] >= cap){
    exploding = true;
    explodeCell(r, c, function(){
      exploding = false;
      if(!gameOver){
        turn = 1 - turn;
        setTurnUI();
      }
    });
  }else{
    turn = 1 - turn;
    setTurnUI();
  }
}

function setTurnUI(){
  var pp1 = document.getElementById('pp1');
  var pp2 = document.getElementById('pp2');
  pp1.className = 'player-panel p1';
  pp2.className = 'player-panel p2';
}

function buildGrid(){
  var grid = document.getElementById('grid');
  grid.innerHTML = '';
  for(var r = 0; r < ROWS; r++){
    for(var c = 0; c < COLS; c++){
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('data-r', r);
      cell.setAttribute('data-c', c);
      cell.setAttribute('data-orbs', 0);
      cell.addEventListener('click', (function(rr, cc){
        return function(){ cellClicked(rr, cc); };
      })(r, c));
      grid.appendChild(cell);
    }
  }
}

function togglePause(){
  if(gameOver) return;
  paused = !paused;
  if(paused){
    document.getElementById('btn-pause').textContent = '▶ Resume';
  }else{
    document.getElementById('btn-pause').textContent = '⏸ Pause';
    turnStart = Date.now();
  }
}

function startTimer(){
  clearInterval(timerInterval);
  timerInterval = setInterval(function(){
    if(!paused && !gameOver){
      totaltime++;
      updateTimerDisplay();
    }
  }, 1000);
}

function resetGame(){
  clearInterval(timerInterval);
  board = [];
  owners = [];
  for(var i = 0; i < ROWS * COLS; i++){
    board.push(0);
    owners.push(-1);
  }
  turn = 0;
  paused = false;
  gameOver = false;
  exploding = false;
  p1time = 0;
  p2time = 0;
  totaltime = 0;
  moveCount = [0, 0];
  turnStart = Date.now();
  buildGrid();
  updateScores();
  updateTimerDisplay();
  setTurnUI();
  document.getElementById('btn-pause').textContent = '⏸ Pause';
  startTimer();
}

resetGame();
