/* Wordle Solver — English (v2 – paridad con ES) */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary = DICTIONARY.slice();

/* Estado */
let history   = [];
let patterns  = [];
let candidates = [];        // se calcula solo al pulsar “Suggest”
let calcDone  = false;

/* ========== INIT UI ========== */
document.addEventListener('DOMContentLoaded', init);

function init(){
  buildColorSelectors();
  document.getElementById('saveGuess').onclick = saveGuess;
  document.getElementById('reset').onclick     = resetAll;
  document.getElementById('suggest').onclick   = onSuggest;
  document.getElementById('findBtn').onclick   = buscarPalabrasUsuario;
  document.getElementById('tabSolver').onclick = () => showTab('solver');
  document.getElementById('tabFinder').onclick = () => showTab('finder');
  showTab('solver');
  clearTables();
  renderFreqTable();          // vacía
}

/* ---------- UI Helpers ---------- */
function showTab(which){
  const s=document.getElementById('panelSolver');
  const f=document.getElementById('panelFinder');
  (which==='solver') ? (s.hidden=false, f.hidden=true)
                     : (s.hidden=true , f.hidden=false);
  document.getElementById('tabSolver').classList.toggle('active', which==='solver');
  document.getElementById('tabFinder').classList.toggle('active', which!=='solver');
}
function clearTables(){
  document.getElementById('candCount').textContent='0';
  ['tblCands','tblDiscard','tblGreen','tblFreq'].forEach(id=>{
    const tb=document.querySelector(`#${id} tbody`); if(tb) tb.innerHTML='';
  });
  document.getElementById('history').textContent='';
  document.getElementById('finderResults').textContent='';
}
/* ---------- Colour selectors ---------- */
function buildColorSelectors(){
  const c=document.getElementById('colorSelects'); c.innerHTML='';
  for(let i=0;i<5;i++){
    const s=document.createElement('select');
    ['Gray','Yellow','Green'].forEach((t,v)=>{
      const o=document.createElement('option'); o.value=v; o.textContent=t; s.appendChild(o);
    });
    c.appendChild(s);
  }
}

/* ========== GESTIÓN DE INTENTOS ========== */
function saveGuess(){
  const inp=document.getElementById('wordInput');
  const word=inp.value.trim().toUpperCase();
  if(!/^[A-Z]{5}$/.test(word)){ alert('Enter a 5-letter word'); return; }
  const pat=[...document.getElementById('colorSelects').children].map(sel=>+sel.value);

  history.push(word); patterns.push(pat);
  inp.value='';
  updateHistoryDisplay();

  /* No se recalculan las listas todavía ⇒ comportamiento ES */
  calcDone=false;
}

function resetAll(){
  history=[]; patterns=[]; candidates=[]; calcDone=false;
  buildColorSelectors();
  clearTables(); renderFreqTable();
}
function updateHistoryDisplay(){
  const map=['gray','yellow','green'];
  const txt=history.map((w,i)=>`${w} → ${patterns[i].map(c=>map[c]).join(', ')}`).join('\n');
  document.getElementById('history').textContent=txt;
}

/* ========== CÁLCULO PATRONES / CANDIDATOS ========== */
const patternKey=(s,g)=>patternFromWords(s,g).join('');
function patternFromWords(secret, guess){
  const res=Array(5).fill(0), S=secret.split(''), G=guess.split('');
  for(let i=0;i<5;i++) if(G[i]===S[i]){ res[i]=2; S[i]=G[i]=null; }
  for(let i=0;i<5;i++) if(G[i]){ const j=S.indexOf(G[i]); if(j!==-1){ res[i]=1; S[j]=null;} }
  return res;
}
function updateCandidates(){
  candidates=dictionary.filter(w=>patterns.every((p,idx)=>patternKey(w,history[idx])===p.join('')));
}

/* ========== ENTROPIA EXACTA & HEURÍSTICA ========== */
function computeH(word){
  const n=candidates.length; if(n===0) return 0;
  const counts=new Map();
  for(const secret of candidates){
    const k=patternKey(secret,word);
    counts.set(k,(counts.get(k)||0)+1);
  }
  const sumSq=[...counts.values()].reduce((s,c)=>s+c*c,0);
  return n - sumSq/n;
}
function scoreRapido(word){
  const uniq=[...new Set(word)]; let s=0;
  for(const l of uniq){ let f=0; for(const w of candidates) if(w.includes(l)) f++; s+=f?1/f:0; }
  return s;
}

/* ========== BOTÓN SUGGEST ========== */
function onSuggest(){
  if(!calcDone){ updateCandidates(); calcDone=true; }
  renderAll();
}

/* ========== RENDER TABLAS ========== */
function renderAll(){
  document.getElementById('candCount').textContent=candidates.length;
  renderCandidates();
  renderDiscard();
  renderGreen();
  renderFreqTable();
}

function renderCandidates(){
  const tb=document.querySelector('#tblCands tbody'); tb.innerHTML='';
  let list=candidates.slice();
  if(list.length<=800) list.sort((a,b)=>computeH(b)-computeH(a));
  list.forEach(w=>{
    const h=list.length<=800?computeH(w).toFixed(2):'';
    tb.insertAdjacentHTML('beforeend',`<tr><td>${w}</td><td>${h}</td></tr>`);
  });
}

/* -- 1) Penalización por letras ya conocidas en “Best discard” -- */
function letrasConocidas(){
  const set=new Set();
  patterns.forEach((p,idx)=>{
    for(let i=0;i<5;i++) if(p[i]>0) set.add(history[idx][i]);
  });
  return set;
}
function scoreDescartable(word){
  const base=computeH(word);
  const known=letrasConocidas();
  let penal=0;
  for(const ch of known) if(word.includes(ch)) penal+=5;   // −5 por cada letra revelada
  return base-penal;
}
function renderDiscard(){
  const tb=document.querySelector('#tblDiscard tbody'); tb.innerHTML='';
  const list=(candidates.length>800)
      ? dictionary.slice().sort((a,b)=>scoreRapido(b)-scoreRapido(a))
      : dictionary.slice().sort((a,b)=>scoreDescartable(b)-scoreDescartable(a));
  list.slice(0,20).forEach(w=>{
    tb.insertAdjacentHTML('beforeend',`<tr><td>${w}</td><td>${scoreDescartable(w).toFixed(3)}</td></tr>`);
  });
}

/* -- 3) Green repetition: mismas letras verdes en otras posiciones -- */
function greenPositions(){
  const g=Array(5).fill(null);
  patterns.forEach((p,idx)=>p.forEach((c,i)=>{ if(c===2) g[i]=history[idx][i]; }));
  return g;
}
function isGreenRep(w,greens){
  for(let i=0;i<5;i++){
    if(greens[i]){
      if(!w.includes(greens[i])||w[i]===greens[i]) return false;
    }
  }
  return true;
}
function renderGreen(){
  const tb=document.querySelector('#tblGreen tbody'); tb.innerHTML='';
  const greens=greenPositions();
  if(greens.every(x=>!x)) return;
  const base=(candidates.length>800)
      ? dictionary.slice()
      : dictionary.slice().sort((a,b)=>computeH(b)-computeH(a));
  base.filter(w=>isGreenRep(w,greens))
      .slice(0,20)
      .forEach(w=>tb.insertAdjacentHTML('beforeend',
        `<tr><td>${w}</td><td>${computeH(w).toFixed(3)}</td></tr>`));
}

/* ---------- Frecuencias ---------- */
function renderFreqTable(){
  const rows=LETTERS.map(l=>({l,app:0,words:0,rep:0}));
  for(const w of candidates){
    const seen={};
    for(const ch of w){
      const r=rows[LETTERS.indexOf(ch)]; r.app++;
      if(seen[ch]) r.rep++; else { r.words++; seen[ch]=1; }
    }
  }
  rows.sort((a,b)=>b.words-a.words);
  const tb=document.querySelector('#tblFreq tbody'); tb.innerHTML='';
  rows.forEach(r=>tb.insertAdjacentHTML('beforeend',
    `<tr><td>${r.l}</td><td>${r.app}</td><td>${r.words}</td><td>${r.rep}</td></tr>`));
}

/* ========== FIND WORDS (wrap largo) ========== */
function buscarPalabrasUsuario(){
  const raw=document.getElementById('lettersInput').value.toUpperCase().replace(/[^A-Z]/g,'');
  if(!raw){ alert('Enter letters'); return; }
  const letters=[...new Set(raw.split(''))];
  if(letters.length===0||letters.length>5){ alert('Enter 1–5 letters'); return;}
  let res={};
  for(let omit=0; omit<=letters.length; omit++){
    const combos=kComb(letters,letters.length-omit);
    combos.forEach(c=>{
      const hits=dictionary.filter(w=>c.every(l=>w.includes(l)));
      if(hits.length) res[c.join('')]=hits;
    });
    if(Object.keys(res).length) break;
  }
  mostrarResultados(res);
}
function kComb(set,k){ const out=[],rec=(s,a)=>{ if(a.length===k){ out.push(a.slice()); return;}
  for(let i=s;i<set.length;i++){ a.push(set[i]); rec(i+1,a); a.pop(); } }; rec(0,[]); return out;}
function mostrarResultados(r){
  const div=document.getElementById('finderResults');
  if(!Object.keys(r).length){ div.textContent='No words found'; return;}
  div.innerHTML=Object.entries(r).map(([c,w])=>
    `<h4>Using ${c} (${w.length})</h4><pre style="white-space:pre-wrap">${w.join(', ')}</pre>`
  ).join('');
}
