/* Wordle Solver — English (alineado con versión ES) */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary = DICTIONARY.slice();
let history = [];
let patterns = [];
let candidates = [];               // vacío hasta pulsar Suggest
let calcDone = false;              // para no recalcular antes de tiempo

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', init);
function init() {
  buildColorSelectors();
  document.getElementById('saveGuess').onclick = saveGuess;
  document.getElementById('reset').onclick     = resetAll;
  document.getElementById('suggest').onclick   = onSuggestClick;
  document.getElementById('findBtn').onclick   = buscarPalabrasUsuario;
  document.getElementById('tabSolver').onclick = () => showTab('solver');
  document.getElementById('tabFinder').onclick = () => showTab('finder');
  showTab('solver');
  clearTables();
  renderFreqTable();
}

/* ---------- Utilidades de UI ---------- */
function showTab(which){
  const solver = document.getElementById('panelSolver');
  const finder = document.getElementById('panelFinder');
  const btnSol = document.getElementById('tabSolver');
  const btnFin = document.getElementById('tabFinder');
  if(which==='solver'){
    solver.hidden=false; finder.hidden=true;
    btnSol.classList.add('active'); btnFin.classList.remove('active');
  }else{
    solver.hidden=true; finder.hidden=false;
    btnFin.classList.add('active'); btnSol.classList.remove('active');
  }
}

function clearTables(){
  document.getElementById('candCount').textContent = '0';
  ['tblCands','tblDiscard','tblGreen','tblFreq'].forEach(id=>{
    const tb=document.querySelector(`#${id} tbody`);
    if(tb) tb.innerHTML='';
  });
  document.getElementById('history').textContent = '';
  document.getElementById('finderResults').textContent='';
}

/* ---------- Selectores de colores ---------- */
function buildColorSelectors(){
  const cont=document.getElementById('colorSelects');
  cont.innerHTML='';
  for(let i=0;i<5;i++){
    const sel=document.createElement('select');
    ['Gray','Yellow','Green'].forEach((txt,val)=>{
      const opt=document.createElement('option');
      opt.value=val; opt.textContent=txt;
      sel.appendChild(opt);
    });
    cont.appendChild(sel);
  }
}

/* ---------- Gestión de intentos ---------- */
function saveGuess(){
  const inp=document.getElementById('wordInput');
  const word=inp.value.trim().toUpperCase();
  if(!/^[A-Z]{5}$/.test(word)){ alert('Enter a 5-letter word'); return;}
  const pattern=[...document.getElementById('colorSelects').children].map(s=>+s.value);
  history.push(word); patterns.push(pattern);
  inp.value='';
  updateHistoryDisplay();
  updateCandidates();
  renderAllTables();
}

function resetAll(){
  history=[]; patterns=[]; candidates=[]; calcDone=false;
  buildColorSelectors();
  clearTables();
  renderFreqTable();
}

function updateHistoryDisplay(){
  const map=['gray','yellow','green'];
  const txt=history.map((w,idx)=>{
    const colours=patterns[idx].map(c=>map[c]).join(', ');
    return `${w} → ${colours}`;
  }).join('\\n');
  document.getElementById('history').textContent=txt;
}

/* ---------- Cálculo de patrones ---------- */
function patternFromWords(secret, guess){
  const res=Array(5).fill(0), s=secret.split(''), g=guess.split('');
  for(let i=0;i<5;i++){ if(g[i]===s[i]){ res[i]=2; s[i]=g[i]=null; } }
  for(let i=0;i<5;i++){ if(g[i]){ const j=s.indexOf(g[i]); if(j!==-1){ res[i]=1; s[j]=null; } } }
  return res;
}
const patternKey=(s,g)=>patternFromWords(s,g).join('');

function updateCandidates(){
  candidates=dictionary.filter(w=>{
    for(let k=0;k<history.length;k++)
      if(patternKey(w,history[k])!==patterns[k].join('')) return false;
    return true;
  });
}

/* ---------- EntropiaExacta ---------- */
function computeH(word){
  const n=candidates.length; if(n===0) return 0;
  const counts=new Map();
  for(const secret of candidates){
    const key=patternKey(secret,word);
    counts.set(key,(counts.get(key)||0)+1);
  }
  const sumSq=[...counts.values()].reduce((s,c)=>s+c*c,0);
  return n - sumSq/n;
}
function scoreRapido(word){
  const uniq=[...new Set(word)]; let s=0;
  for(const l of uniq){
    let f=0; for(const w of candidates) if(w.includes(l)) f++;
    s+=f?1/f:0;
  }
  return s;
}

/* ---------- Render de tablas ---------- */
function renderCandidateTable(){
  const tb=document.querySelector('#tblCands tbody'); tb.innerHTML='';
  let list=candidates.slice();
  if(list.length<=800) list.sort((a,b)=>computeH(b)-computeH(a));
  list.forEach(w=>{
    const h=list.length<=800?computeH(w).toFixed(2):'';
    tb.insertAdjacentHTML('beforeend',`<tr><td>${w}</td><td>${h}</td></tr>`);
  });
}
function renderDiscardTable(words){
  const tb=document.querySelector('#tblDiscard tbody'); tb.innerHTML='';
  words.forEach(w=>tb.insertAdjacentHTML('beforeend',
      `<tr><td>${w}</td><td>${computeH(w).toFixed(3)}</td></tr>`));
}
function renderGreenTable(words){
  const tb=document.querySelector('#tblGreen tbody'); tb.innerHTML='';
  words.forEach(w=>tb.insertAdjacentHTML('beforeend',
      `<tr><td>${w}</td><td>${computeH(w).toFixed(3)}</td></tr>`));
}
function renderFreqTable(){
  const rows=LETTERS.map(l=>({l,app:0,words:0,rep:0}));
  for(const w of candidates){
    const seen={};
    for(const ch of w){
      const r=rows[LETTERS.indexOf(ch)];
      r.app++; seen[ch]?r.rep++:r.words++; seen[ch]=1;
    }
  }
  rows.sort((a,b)=>b.words-a.words);
  const tb=document.querySelector('#tblFreq tbody'); tb.innerHTML='';
  rows.forEach(r=>tb.insertAdjacentHTML('beforeend',
     `<tr><td>${r.l}</td><td>${r.app}</td><td>${r.words}</td><td>${r.rep}</td></tr>`));
}

/* ---------- Green repetition ---------- */
function getGreenPositions(){
  const g=Array(5).fill(null);
  patterns.forEach((p,i)=>p.forEach((c,idx)=>{ if(c===2) g[idx]=history[i][idx]; }));
  return g;
}
function isGreenRepetition(word, greens){
  for(let i=0;i<5;i++){
    if(greens[i]){
      if(!word.includes(greens[i])||word[i]===greens[i]) return false;
    }
  }
  return true;
}
function getGreenRepetition(base){
  const greens=getGreenPositions();
  if(greens.every(x=>!x)) return [];
  return base.filter(w=>isGreenRepetition(w,greens))
             .sort((a,b)=>computeH(b)-computeH(a));
}

/* ---------- Dibujar todo ---------- */
function renderAllTables(){
  document.getElementById('candCount').textContent=candidates.length;
  renderCandidateTable();
  const base=(candidates.length>800)?
     dictionary.slice().sort((a,b)=>scoreRapido(b)-scoreRapido(a))
    :dictionary.slice().sort((a,b)=>computeH(b)-computeH(a));
  renderDiscardTable(base.slice(0,20));
  renderGreenTable(getGreenRepetition(base).slice(0,20));
  renderFreqTable();
}

/* ---------- Botón Suggest ---------- */
function onSuggestClick(){
  if(!calcDone){ updateCandidates(); calcDone=true; }
  renderAllTables();
}

/* ---------- Buscador de palabras ---------- */
function buscarPalabrasUsuario(){
  const raw=document.getElementById('lettersInput').value.toUpperCase().replace(/[^A-Z]/g,'');
  if(!raw){ alert('Enter letters'); return; }
  const letters=[...new Set(raw.split(''))];
  if(letters.length===0||letters.length>5){ alert('Enter 1–5 letters'); return; }
  let res={};
  for(let omit=0; omit<=letters.length; omit++){
    const combos=kComb(letters,letters.length-omit);
    combos.forEach(c=>{
      const hits=dictionary.filter(w=>c.every(l=>w.includes(l)));
      if(hits.length) res[c.join('')]=hits;
    });
    if(Object.keys(res).length) break;
  }
  displayFinderResults(res);
}
function kComb(set,k){
  const out=[]; const rec=(s,a)=>{ if(a.length===k){ out.push(a.slice()); return;}
    for(let i=s;i<set.length;i++){ a.push(set[i]); rec(i+1,a); a.pop(); } };
  rec(0,[]); return out;
}
function displayFinderResults(res){
  const div=document.getElementById('finderResults');
  if(!Object.keys(res).length){ div.textContent='No words found'; return;}
  let html='';
  for(const k in res){
    html+=`<h4>Using ${k} (${res[k].length})</h4><pre style="white-space:pre-wrap">${res[k].join(', ')}</pre>`;
  }
  div.innerHTML=html;
}
