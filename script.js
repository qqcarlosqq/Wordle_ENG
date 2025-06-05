
/* Wordle Solver — English (EntropiaExacta fixed) */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary = DICTIONARY.slice();
let history = [];
let patterns = [];
let candidates = dictionary.slice();

/* --------------------- UI --------------------- */
document.addEventListener('DOMContentLoaded', init);

function init() {
  buildColorSelectors();
  // buttons
  document.getElementById('saveGuess').onclick = saveGuess;
  document.getElementById('reset').onclick     = resetAll;
  document.getElementById('suggest').onclick   = suggestWords;
  document.getElementById('findBtn').onclick   = buscarPalabrasUsuario;
  // tabs
  document.getElementById('tabSolver').onclick = () => showTab('solver');
  document.getElementById('tabFinder').onclick = () => showTab('finder');
  showTab('solver');

  renderFreqTable();
  updateCandidates();
}

function showTab(which){
  const solver = document.getElementById('panelSolver');
  const finder = document.getElementById('panelFinder');
  const btnSol = document.getElementById('tabSolver');
  const btnFin = document.getElementById('tabFinder');
  if(which==='solver'){
    solver.hidden = false; finder.hidden = true;
    btnSol.classList.add('active'); btnFin.classList.remove('active');
  }else{
    solver.hidden = true;  finder.hidden = false;
    btnFin.classList.add('active'); btnSol.classList.remove('active');
  }
}

/* ---------------- Colour selectors ---------------- */
function buildColorSelectors(){
  const cont = document.getElementById('colorSelects');
  cont.innerHTML = '';
  for(let i=0;i<5;i++){
    const sel = document.createElement('select');
    ['Gray','Yellow','Green'].forEach((lbl,val)=>{
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = lbl;
      sel.appendChild(opt);
    });
    cont.appendChild(sel);
  }
}

/* ---------------- Guess handling ---------------- */
function saveGuess(){
  const input = document.getElementById('wordInput');
  const word  = input.value.trim().toUpperCase();
  if(!/^[A-Z]{5}$/.test(word)){
    alert('Enter a 5‑letter word (A‑Z)'); return;
  }
  const pattern = [...document.getElementById('colorSelects').children]
                  .map(sel => Number(sel.value));   // 0/1/2
  history.push(word);
  patterns.push(pattern);
  input.value = '';
  updateHistory();
  updateCandidates();
}

function resetAll(){
  history = []; patterns = []; candidates = dictionary.slice();
  updateHistory();
  updateCandidates();
}

function updateHistory(){
  document.getElementById('history').textContent = history.join('\n');
}

/* ---------------- Pattern helpers ---------------- */
function patternFromWords(secret, guess){
  const res = Array(5).fill(0);
  const sArr = secret.split('');
  const gArr = guess.split('');
  // greens
  for(let i=0;i<5;i++){
    if(gArr[i] === sArr[i]){
      res[i] = 2;
      sArr[i] = null; gArr[i] = null;
    }
  }
  // yellows
  for(let i=0;i<5;i++){
    if(gArr[i]){
      const idx = sArr.indexOf(gArr[i]);
      if(idx !== -1){
        res[i] = 1;
        sArr[idx] = null;
      }
    }
  }
  return res;
}
function patternKey(secret, guess){ return patternFromWords(secret, guess).join(''); }

/* ---------------- Candidates ---------------- */
function updateCandidates(){
  candidates = dictionary.filter(word=>{
    for(let g=0; g<history.length; g++){
      if(patternKey(word, history[g]) !== patterns[g].join('')) return false;
    }
    return true;
  });
  document.getElementById('candCount').textContent = String(candidates.length);
  renderCandidateTable();
  renderFreqTable();
}

/* ---------------- EntropiaExacta ---------------- */
function computeH(word){
  const n = candidates.length;
  if(n === 0) return 0;
  const counts = new Map();
  for(const secret of candidates){
    const key = patternKey(secret, word);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const sumSquares = [...counts.values()].reduce((sum, c) => sum + c*c, 0);
  return n - (sumSquares / n);         // Expected remaining words
}

/* quick heuristic when n>800 */
function scoreRapido(word){
  const uniq = [...new Set(word)];
  let score = 0;
  for(const l of uniq){
    let freq = 0;
    for(const w of candidates) if(w.includes(l)) freq++;
    score += freq ? 1 / freq : 0;
  }
  return score;
}

/* ---------------- Tables ---------------- */
function renderCandidateTable(){
  const tbody = document.querySelector('#tblCands tbody');
  tbody.innerHTML = '';
  const list = candidates.slice();
  if(list.length <= 800){
    list.sort((a,b) => computeH(b) - computeH(a));
  }
  list.slice(0, 500).forEach(w=>{
    const h = (list.length <= 800) ? computeH(w).toFixed(2) : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${w}</td><td>${h}</td>`;
    tbody.appendChild(tr);
  });
}

function suggestWords(){
  const base = dictionary.slice();
  let list;
  if(candidates.length > 800){
    list = base.sort((a,b) => scoreRapido(b) - scoreRapido(a));
  }else{
    list = base.sort((a,b) => computeH(b) - computeH(a));
  }
  renderDiscardTable(list.slice(0,20));
  renderGreenTable(getGreenRepetition(list));
}

function renderDiscardTable(words){
  const tbody = document.querySelector('#tblDiscard tbody');
  tbody.innerHTML = '';
  words.forEach(w=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${w}</td><td>${computeH(w).toFixed(3)}</td>`;
    tbody.appendChild(tr);
  });
}

/* -------- Green repetition -------- */
function getGreenPattern(){
  const greens = Array(5).fill(null);
  patterns.forEach((pat, idx)=>{
    for(let i=0;i<5;i++){
      if(pat[i] === 2) greens[i] = history[idx][i];
    }
  });
  return greens;
}
function wordMatchesGreens(word, greens){
  for(let i=0;i<5;i++){
    if(greens[i] && word[i] !== greens[i]) return false;
  }
  return true;
}
function getGreenRepetition(wordList){
  const greens = getGreenPattern();
  if(greens.every(g=>!g)) return [];
  return wordList.filter(w => wordMatchesGreens(w, greens))
                 .sort((a,b) => computeH(b) - computeH(a))
                 .slice(0, 20);
}
function renderGreenTable(words){
  const tbody = document.querySelector('#tblGreen tbody');
  tbody.innerHTML = '';
  words.forEach(w=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${w}</td><td>${computeH(w).toFixed(3)}</td>`;
    tbody.appendChild(tr);
  });
}

/* -------- Letter frequencies -------- */
function renderFreqTable(){
  const rows = LETTERS.map(l => ({l, app:0, words:0, rep:0}));
  for(const w of candidates){
    const seen = {};
    for(const ch of w){
      const r = rows[LETTERS.indexOf(ch)];
      r.app++;
      if(seen[ch]) r.rep++; else { r.words++; seen[ch] = true; }
    }
  }
  rows.sort((a,b) => b.words - a.words);
  const tbody = document.querySelector('#tblFreq tbody');
  tbody.innerHTML = '';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.l}</td><td>${r.app}</td><td>${r.words}</td><td>${r.rep}</td>`;
    tbody.appendChild(tr);
  });
}

/* -------- Word finder -------- */
function buscarPalabrasUsuario(){
  const raw = document.getElementById('lettersInput').value.toUpperCase().replace(/[^A-Z]/g,'');
  if(!raw){ alert('Enter letters'); return; }
  const letters = [...new Set(raw.split(''))];
  if(letters.length === 0 || letters.length > 5){
    alert('Enter 1–5 letters'); return;
  }
  let results = {};
  for(let omit=0; omit<=letters.length; omit++){
    const combos = kCombinations(letters, letters.length - omit);
    for(const combo of combos){
      const hits = dictionary.filter(w => combo.every(l => w.includes(l)));
      if(hits.length) results[combo.join('')] = hits;
    }
    if(Object.keys(results).length) break; // stop at first success
  }
  displayFinderResults(results);
}
function kCombinations(set, k){
  const out = [];
  const rec = (start, arr)=>{
    if(arr.length === k){ out.push(arr.slice()); return; }
    for(let i=start;i<set.length;i++){
      arr.push(set[i]); rec(i+1, arr); arr.pop();
    }
  };
  rec(0, []);
  return out;
}
function displayFinderResults(res){
  const div = document.getElementById('finderResults');
  if(!Object.keys(res).length){
    div.textContent = 'No words found'; return;
  }
  let html = '';
  for(const combo in res){
    html += `<h4>Using ${combo} (${res[combo].length})</h4><pre>${res[combo].join(', ')}</pre>`;
  }
  div.innerHTML = html;
}
