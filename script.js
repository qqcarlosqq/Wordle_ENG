/* Wordle Solver — English (v3 – memo-cache de entropía) */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary = DICTIONARY.slice();

/* Estado */
let history=[], patterns=[];
let candidates=[];          // se recalcula al pulsar Suggest
let calcDone=false;

/* —— cache de entropía —— */
let cacheH={}, versionStamp=0;

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', init);
function init(){
  buildColorSelectors();
  ['saveGuess','reset','suggest','findBtn'].forEach(id=>{
    document.getElementById(id).onclick = handlers[id];
  });
  document.getElementById('tabSolver').onclick=()=>showTab('solver');
  document.getElementById('tabFinder').onclick=()=>showTab('finder');
  showTab('solver'); clearTables(); renderFreqTable();
}

/* ========== UI helpers ========== */
function showTab(t){ ['panelSolver','panelFinder'].forEach(id=>{
  document.getElementById(id).hidden = (id!=='panel'+(t==='solver'?'Solver':'Finder'));
});
['tabSolver','tabFinder'].forEach(id=>{
  document.getElementById(id).classList.toggle('active', id==='tab'+(t==='solver'?'Solver':'Finder'));
});}

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

/* ========== HANDLERS ========== */
const handlers={
  saveGuess(){ const inp=document.getElementById('wordInput');
    const word=inp.value.trim().toUpperCase();
    if(!/^[A-Z]{5}$/.test(word)){ alert('Enter a 5-letter word'); return; }
    const pat=[...document.getElementById('colorSelects').children].map(sel=>+sel.value);
    history.push(word); patterns.push(pat); inp.value='';
    updateHistory(); calcDone=false; },
  reset(){ history=[]; patterns=[]; candidates=[]; calcDone=false;
    versionStamp++; buildColorSelectors(); clearTables(); renderFreqTable(); },
  suggest(){ if(!calcDone){ updateCandidates(); calcDone=true; }
    renderAll(); },
  findBtn(){ buscarPalabrasUsuario(); }
};

/* ========== HISTORIAL ========== */
function updateHistory(){
  const m=['gray','yellow','green'];
  document.getElementById('history').textContent=
    history.map((w,i)=>`${w} → ${patterns[i].map(c=>m[c]).join(', ')}`).join('\n');
}

/* ========== CÁLCULO DE PATRONES ========== */
function patternFromWords(sec,guess){
  const r=Array(5).fill(0), S=sec.split(''), G=guess.split('');
  for(let i=0;i<5;i++) if(G[i]===S[i]){ r[i]=2; S[i]=G[i]=null; }
  for(let i=0;i<5;i++) if(G[i]){ const j=S.indexOf(G[i]); if(j!==-1){ r[i]=1; S[j]=null; } }
  return r;
}
const patternKey=(s,g)=>patternFromWords(s,g).join('');
function updateCandidates(){
  candidates=dictionary.filter(w=>patterns.every((p,i)=>patternKey(w,history[i])===p.join('')));
  versionStamp++; cacheH={};                 // invalida cache
}

/* ========== ENTROPIA EXACTA MEMO-CACHÉ ========== */
function computeH(word){
  const cached=cacheH[word];
  if(cached && cached.v===versionStamp) return cached.h;

  const n=candidates.length; if(n===0) return 0;
  const cnt=new Map();
  for(const s of candidates){
    const k=patternKey(s,word); cnt.set(k,(cnt.get(k)||0)+1);
  }
  const sumSq=[...cnt.values()].reduce((a,c)=>a+c*c,0);
  const h=n - sumSq/n;
  cacheH[word]={v:versionStamp,h}; return h;
}

/* Heurística rápida: igual que antes */
const scoreRapido=w=>{
  let s=0; for(const ch of new Set(w)){
    let f=0; for(const w2 of candidates) if(w2.includes(ch)) f++; s+=f?1/f:0;
  } return s;
};

/* ========== RENDER ========== */
function renderAll(){
  document.getElementById('candCount').textContent=candidates.length;
  renderCandidates(); renderDiscard(); renderGreen(); renderFreqTable();
}
function renderCandidates(){
  const tb=document.querySelector('#tblCands tbody'); tb.innerHTML='';
  const list=candidates.slice();
  if(list.length<=800) list.sort((a,b)=>computeH(b)-computeH(a));
  list.forEach(w=>{
    tb.insertAdjacentHTML('beforeend',
      `<tr><td>${w}</td><td>${list.length<=800?computeH(w).toFixed(2):''}</td></tr>`);
  });
}

/* Penalización −5 por letra ya revelada */
const letrasConocidas=()=>{ const s=new Set();
  patterns.forEach((p,i)=>p.forEach((c,idx)=>{ if(c>0) s.add(history[i][idx]); })); return s; };
function scoreDescartable(w){
  let h=computeH(w); const known=letrasConocidas();
  for(const ch of known) if(w.includes(ch)) h-=5;
  return h;
}
function renderDiscard(){
  const tb=document.querySelector('#tblDiscard tbody'); tb.innerHTML='';
  const base=(candidates.length>800)
      ? dictionary.slice().sort((a,b)=>scoreRapido(b)-scoreRapido(a))
      : dictionary.slice().sort((a,b)=>scoreDescartable(b)-scoreDescartable(a));
  base.slice(0,20).forEach(w=>{
    tb.insertAdjacentHTML('beforeend',`<tr><td>${w}</td><td>${scoreDescartable(w).toFixed(3)}</td></tr>`);
  });
}

/* Green repetition */
const greensPos=()=>{ const g=Array(5).fill(null);
  patterns.forEach((p,i)=>p.forEach((c,idx)=>{ if(c===2) g[idx]=history[i][idx]; })); return g; };
const isGreenRep=(w,g)=>g.every((ch,i)=>!ch || (w.includes(ch)&&w[i]!==ch));
function renderGreen(){
  const tb=document.querySelector('#tblGreen tbody'); tb.innerHTML='';
  const g=greensPos(); if(g.every(x=>!x)) return;
  const base=(candidates.length>800)?dictionary.slice():dictionary.slice().sort((a,b)=>computeH(b)-computeH(a));
  base.filter(w=>isGreenRep(w,g)).slice(0,20)
      .forEach(w=>tb.insertAdjacentHTML('beforeend',
        `<tr><td>${w}</td><td>${computeH(w).toFixed(3)}</td></tr>`));
}

/* Frecuencias */
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

/* ========== FIND WORDS ========== */
function buscarPalabrasUsuario(){
  const raw=document.getElementById('lettersInput').value.toUpperCase().replace(/[^A-Z]/g,'');
  if(!raw){ alert('Enter letters'); return;}
  const letters=[...new Set(raw.split(''))];
  if(!letters.length||letters.length>5){ alert('Enter 1–5 letters'); return;}
  let res={};
  for(let omit=0; omit<=letters.length; omit++){
    kComb(letters,letters.length-omit).forEach(c=>{
      const hits=dictionary.filter(w=>c.every(l=>w.includes(l)));
      if(hits.length) res[c.join('')]=hits;
    });
    if(Object.keys(res).length) break;
  }
  const div=document.getElementById('finderResults');
  if(!Object.keys(res).length){ div.textContent='No words found'; return;}
  div.innerHTML=Object.entries(res).map(([c,w])=>
    `<h4>Using ${c} (${w.length})</h4><pre style="white-space:pre-wrap">${w.join(', ')}</pre>`).join('');
}
function kComb(set,k){ const out=[],rec=(s,a)=>{ if(a.length===k){ out.push(a.slice()); return;}
  for(let i=s;i<set.length;i++){ a.push(set[i]); rec(i+1,a); a.pop(); } }; rec(0,[]); return out;}
