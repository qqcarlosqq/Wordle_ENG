/* Wordle Solver — English  (v5.3  •  yellow == gray in lists 2-3) */

const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary = DICTIONARY.slice();          // lista de 5-letras

/* ---------- state ---------- */
let history = [];        // words played
let patterns = [];       // their colour arrays (0 g,1 y,2 G)
let candidates = [];
let cacheH = {};
let version = 0;
let calcDone = false;

/* ---------- DOM helpers ---------- */
const $ = id => document.getElementById(id);
const on = (id,fn)=>$(id).addEventListener('click',fn);
function ensureBody(id){const t=$(id);let b=t.querySelector('tbody');
  if(!b){b=document.createElement('tbody');t.appendChild(b);}return b;}

/* ---------- UI init ---------- */
document.addEventListener('DOMContentLoaded',()=>{
  buildColorSelectors();
  on('saveGuess',saveGuess); on('reset',resetAll);
  on('suggest',onSuggest);   on('findBtn',buscarPalabrasUsuario);
  on('runCompare',runCompare);
  on('tabSolver',()=>showTab('solver'));
  on('tabFinder',()=>showTab('finder'));
  on('tabCompare',()=>showTab('compare'));
  showTab('solver'); clearTables(); renderFreqTable();
});
function showTab(t){['Solver','Finder','Compare'].forEach(p=>{
  $(`panel${p}`).hidden = (p.toLowerCase()!==t);
  $(`tab${p}`).classList.toggle('active',p.toLowerCase()===t);
});}
function buildColorSelectors(){
  const c=$('colorSelects'); c.innerHTML='';
  for(let i=0;i<5;i++){
    const s=document.createElement('select');
    ['Gray','Yellow','Green'].forEach((t,v)=>{
      const o=document.createElement('option');o.value=v;o.textContent=t;s.appendChild(o);});
    c.appendChild(s);
  }
}
function clearTables(){
  $('candCount').textContent='0';
  ['tblCands','tblDiscard','tblGreen','tblFreq'].forEach(id=>ensureBody(id).innerHTML='');
  $('history').textContent=''; $('compareArea').innerHTML='';
}

/* ---------- save / reset ---------- */
function saveGuess(){
  const w=$('wordInput').value.trim().toUpperCase();
  if(!/^[A-Z]{5}$/.test(w)){alert('Enter a 5-letter word');return;}
  const pat=[...$('colorSelects').children].map(sel=>+sel.value);
  history.push(w); patterns.push(pat); $('wordInput').value='';
  renderHistory(); calcDone=false; toggleCompareBtn();
}
function resetAll(){history=[];patterns=[];candidates=[];
  cacheH={};version++;calcDone=false;buildColorSelectors();
  clearTables();renderFreqTable();toggleCompareBtn();}
function renderHistory(){
  const map=['gray','yellow','green'];
  $('history').textContent = history.map((w,i)=>`${w} → ${patterns[i].map(c=>map[c]).join(', ')}`).join('\n');
}

/* ---------- pattern helpers ---------- */
const patternKey=(s,g)=>patternFromWords(s,g).join('');
function patternFromWords(sec,gu){
  const r=Array(5).fill(0),S=sec.split(''),G=gu.split('');
  for(let i=0;i<5;i++)if(G[i]===S[i]){r[i]=2;S[i]=G[i]=null;}
  for(let i=0;i<5;i++)if(G[i]){const j=S.indexOf(G[i]);if(j!==-1){r[i]=1;S[j]=null;}}
  return r;
}

/* ---------- candidate list ---------- */
function updateCandidates(){
  candidates = dictionary.filter(w=>patterns.every((p,i)=>patternKey(w,history[i])===p.join('')));
  version++; cacheH={};
}
const EXACT_LIMIT=800;

/* ---------- entropy ---------- */
function computeH(w){
  const c=cacheH[w]; if(c&&c.v===version) return c.h;
  const n=candidates.length; if(!n) return 0;
  const m=new Map(); candidates.forEach(s=>{
    const k=patternKey(s,w); m.set(k,(m.get(k)||0)+1);});
  const h=n - [...m.values()].reduce((a,x)=>a+x*x,0)/n;
  cacheH[w]={v:version,h}; return h;
}
const fastScore=w=>[...new Set(w)].reduce((s,ch)=>{
  let f=0; for(const w2 of candidates) if(w2.includes(ch)) f++;
  return s + (f?1/f:0);
},0);

/* ---------- colour sets ---------- */
function buildSets(){
  const setG=new Set(), setY=new Set();
  patterns.forEach((p,idx)=>p.forEach((c,i)=>{
    if(c===2) setG.add(history[idx][i]);
    else if(c===1) setY.add(history[idx][i]);
  }));
  return{setG,setY};
}
function greenPos(){
  const g=Array(5).fill(null);
  patterns.forEach((p,i)=>p.forEach((c,idx)=>{
    if(c===2) g[idx]=history[i][idx];
  })); return g;
}

/* ---------- render main ---------- */
function onSuggest(){ if(!calcDone){updateCandidates();calcDone=true;}
  renderAll(); toggleCompareBtn();}
function renderAll(){ $('candCount').textContent=candidates.length;
  renderCandidates(); renderDiscard(); renderGreen(); renderFreqTable();}

/* Candidates (col-1) */
function renderCandidates(){
  const tb=ensureBody('tblCands'); tb.innerHTML='';
  const list=candidates.slice();
  if(list.length<=EXACT_LIMIT) list.sort((a,b)=>computeH(b)-computeH(a));
  list.forEach(w=>tb.insertAdjacentHTML('beforeend',
     `<tr><td>${w}</td><td>${list.length<=EXACT_LIMIT?computeH(w).toFixed(2):''}</td></tr>`));
}

/* === Best discard (col-2)  — yellow letters are treated as gray === */
function renderDiscard(){
  const tb=ensureBody('tblDiscard'); tb.innerHTML='';
  const {setG,setY}=buildSets();
  const scoreDiscard = w=>{
    if([...setY].some(ch=>w.includes(ch))) return -1;          // descartar si contiene yellow
    let h = (candidates.length<=EXACT_LIMIT) ? computeH(w) : fastScore(w);
    setG.forEach(ch=>{ if(w.includes(ch)) h-=5; });
    return h;
  };
  const base=dictionary.slice().map(w=>({w,h:scoreDiscard(w)}))
              .filter(o=>o.h>=0)
              .sort((a,b)=>b.h-a.h)
              .slice(0,20);
  base.forEach(o=>tb.insertAdjacentHTML('beforeend',
     `<tr><td>${o.w}</td><td>${o.h.toFixed(3)}</td></tr>`));
}

/* === Green repetition (col-3)  — también excluye amarillas === */
function isGreenRep(w,g){return g.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch));}
function renderGreen(){
  const tb=ensureBody('tblGreen'); tb.innerHTML='';
  const g=greenPos(); if(g.every(x=>!x)) return;
  const {setY}=buildSets();
  const base=dictionary.filter(w=>![...setY].some(ch=>w.includes(ch)))
        .filter(w=>isGreenRep(w,g))
        .map(w=>({w,h:candidates.length<=EXACT_LIMIT?computeH(w):0}))
        .sort((a,b)=>b.h-a.h)
        .slice(0,20);
  base.forEach(o=>tb.insertAdjacentHTML('beforeend',
     `<tr><td>${o.w}</td><td>${o.h.toFixed(2)}</td></tr>`));
}

/* ---------- letter frequency ---------- */
function renderFreqTable(){
  const rows=LETTERS.map(l=>({l,a:0,w:0,r:0}));
  for(const w of candidates){
    const seen={};
    for(const ch of w){
      const r=rows[LETTERS.indexOf(ch)];
      r.a++; if(seen[ch]) r.r++; else {r.w++; seen[ch]=1;}
    }
  }
  rows.sort((x,y)=>y.w-x.w);
  const tb=ensureBody('tblFreq'); tb.innerHTML='';
  rows.forEach(r=>tb.insertAdjacentHTML('beforeend',
     `<tr><td>${r.l}</td><td>${r.a}</td><td>${r.w}</td><td>${r.r}</td></tr>`));
}

/* ---------- enable / disable compare ---------- */
function toggleCompareBtn(){ $('tabCompare').disabled=candidates.length>25; }

/* ---------- compare grid (unchanged) ---------- */
/* ...  (el resto del código compare y find words no cambia y se mantiene igual)  ... */
