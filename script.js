/* Wordle Solver — English  (v4  •  comparison tab ≤25 candidates) */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary = DICTIONARY.slice();

/* ------------------- state ------------------- */
let history = [], patterns = [];
let candidates = [];        // refreshed on Suggest
let calcDone  = false;

let cacheH = {}, version = 0;        // memo-cache for entropy

/* ========== boot ========== */
document.addEventListener('DOMContentLoaded', () => {
  buildColorSelectors();

  on('saveGuess',  saveGuess);
  on('reset',      resetAll);
  on('suggest',    onSuggest);
  on('findBtn',    buscarPalabrasUsuario);
  on('runCompare', runCompare);

  // tabs
  on('tabSolver',  () => showTab('solver'));
  on('tabFinder',  () => showTab('finder'));
  on('tabCompare', () => showTab('compare'));

  showTab('solver');
  clearTables(); renderFreqTable();
});

/* ---------- tiny helpers ---------- */
const $ = id => document.getElementById(id);
const on = (id, fn) => $(id).addEventListener('click', fn);

/* ========== UI plumbing ========== */
function showTab(name){
  ['Solver','Finder','Compare'].forEach(t=>{
    $(`panel${t}`).hidden = (t.toLowerCase()!==name);
    $(`tab${t}`).classList.toggle('active', t.toLowerCase()===name);
  });
}

function clearTables(){
  $('candCount').textContent='0';
  ['tblCands','tblDiscard','tblGreen','tblFreq']
    .forEach(id=>{ const tb=$(`#${id} tbody`); if(tb) tb.innerHTML=''; });
  $('history').textContent='';
  $('compareArea').innerHTML='';
  $('finderResults').textContent='';
}

/* ---------- colour dropdowns ---------- */
function buildColorSelectors(){
  const wrap=$('colorSelects'); wrap.innerHTML='';
  for(let i=0;i<5;i++){
    const s=document.createElement('select');
    ['Gray','Yellow','Green'].forEach((lbl,v)=>{
      const o=document.createElement('option'); o.value=v; o.textContent=lbl; s.appendChild(o);
    });
    wrap.appendChild(s);
  }
}

/* ---------- guesses ---------- */
function saveGuess(){
  const w=$('wordInput').value.trim().toUpperCase();
  if(!/^[A-Z]{5}$/.test(w)){ alert('Enter a 5-letter word'); return; }
  const pat=[...$('colorSelects').children].map(sel=>+sel.value);
  history.push(w); patterns.push(pat); $('wordInput').value='';
  updateHist(); calcDone=false;        // no recalc yet
  toggleCompareBtn();
}
function resetAll(){
  history=[]; patterns=[]; candidates=[]; calcDone=false; version++;
  buildColorSelectors(); clearTables(); renderFreqTable();
  toggleCompareBtn();
}
function onSuggest(){
  if(!calcDone){ updateCandidates(); calcDone=true; }
  renderAll();  toggleCompareBtn();
}
function updateHist(){
  const map=['gray','yellow','green'];
  $('history').textContent = history
    .map((w,i)=>`${w} → ${patterns[i].map(c=>map[c]).join(', ')}`).join('\n');
}

/* ---------- pattern helpers ---------- */
const patternKey = (s,g)=>patternFromWords(s,g).join('');
function patternFromWords(sec,gu){
  const r=Array(5).fill(0), S=sec.split(''), G=gu.split('');
  for(let i=0;i<5;i++) if(G[i]===S[i]){ r[i]=2; S[i]=G[i]=null; }
  for(let i=0;i<5;i++) if(G[i]){ const j=S.indexOf(G[i]); if(j!==-1){ r[i]=1; S[j]=null;} }
  return r;
}

/* ---------- core lists ---------- */
function updateCandidates(){
  candidates = dictionary.filter(w=>
    patterns.every((p,i)=>patternKey(w,history[i])===p.join(''))
  );
  version++; cacheH={};
}
function computeH(word){                 // memo-cached
  const c=cacheH[word]; if(c&&c.v===version) return c.h;
  const n=candidates.length; if(!n) return 0;
  const m=new Map();
  candidates.forEach(sec=>{
    const k=patternKey(sec,word); m.set(k,(m.get(k)||0)+1);
  });
  const ss=[...m.values()].reduce((s,x)=>s+x*x,0);
  const h=n-ss/n; cacheH[word]={v:version,h}; return h;
}
const scoreRapido = w =>{
  let s=0; for(const ch of new Set(w)){ let f=0;
    for(const w2 of candidates) if(w2.includes(ch)) f++; s+=f?1/f:0; }
  return s;
};

/* ---------- render main tables ---------- */
function renderAll(){
  $('candCount').textContent=candidates.length;
  renderCandidates(); renderDiscard(); renderGreen(); renderFreqTable();
}

/* — Candidates — */
function renderCandidates(){
  const tb=$('#tblCands tbody'); tb.innerHTML='';
  const list=candidates.slice();
  if(list.length<=800) list.sort((a,b)=>computeH(b)-computeH(a));
  list.forEach(w=>tb.insertAdjacentHTML('beforeend',
    `<tr><td>${w}</td><td>${list.length<=800?computeH(w).toFixed(2):''}</td></tr>`));
}

/* — Best discard (penaliza letras ya usadas) — */
const knownLetters = ()=>{const set=new Set();
  patterns.forEach((p,i)=>p.forEach((c,idx)=>{ if(c>0) set.add(history[i][idx]); })); return set;};
const scoreDiscard = w =>{
  let h=computeH(w); knownLetters().forEach(ch=>{ if(w.includes(ch)) h-=5; });
  return h;
};
function renderDiscard(){
  const tb=$('#tblDiscard tbody'); tb.innerHTML='';
  const ordered=(candidates.length>800)
      ? dictionary.slice().sort((a,b)=>scoreRapido(b)-scoreRapido(a))
      : dictionary.slice().sort((a,b)=>scoreDiscard(b)-scoreDiscard(a));
  ordered.slice(0,20).forEach(w=>tb.insertAdjacentHTML('beforeend',
    `<tr><td>${w}</td><td>${scoreDiscard(w).toFixed(3)}</td></tr>`));
}

/* — Green repetition — */
const greenPos = ()=>{const g=Array(5).fill(null);
  patterns.forEach((p,i)=>p.forEach((c,idx)=>{ if(c===2) g[idx]=history[i][idx]; })); return g;};
const isGreenRep = (w,g)=>g.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch));
function renderGreen(){
  const tb=$('#tblGreen tbody'); tb.innerHTML='';
  const g=greenPos(); if(g.every(x=>!x)) return;
  const base=(candidates.length>800)?dictionary.slice():dictionary.slice().sort((a,b)=>computeH(b)-computeH(a));
  base.filter(w=>isGreenRep(w,g)).slice(0,20)
      .forEach(w=>tb.insertAdjacentHTML('beforeend',
         `<tr><td>${w}</td><td>${computeH(w).toFixed(3)}</td></tr>`));
}

/* — Frequencies — */
function renderFreqTable(){
  const rows=LETTERS.map(l=>({l,a:0,w:0,r:0}));
  for(const w of candidates){
    const seen={};
    for(const ch of w){
      const row=rows[LETTERS.indexOf(ch)]; row.a++;
      if(seen[ch]) row.r++; else { row.w++; seen[ch]=1; }
    }
  }
  rows.sort((x,y)=>y.w-x.w);
  const tb=$('#tblFreq tbody'); tb.innerHTML='';
  rows.forEach(r=>tb.insertAdjacentHTML('beforeend',
    `<tr><td>${r.l}</td><td>${r.a}</td><td>${r.w}</td><td>${r.r}</td></tr>`));
}

/* ========== COMPARE TAB (≤25) ========== */
function toggleCompareBtn(){
  const btn=$('tabCompare');
  btn.disabled = candidates.length>25;
}

function runCompare(){
  /* reunir lista */
  const extra=$('extraInput').value.toUpperCase()
                .split(/[^A-Z]+/).filter(x=>x.length===5).slice(0,2);
  const words=[...candidates.slice(0,25-extra.length), ...extra];
  const n=words.length; if(n===0){ $('compareArea').textContent='No words'; return;}

  /* pre-calcula buckets para cada palabra */
  const buckets={};                      // word -> Map(patternKey -> count)
  words.forEach(g=>{
    const m=new Map();
    words.forEach(s=>{
      const k=patternKey(s,g); m.set(k,(m.get(k)||0)+1);
    });
    buckets[g]=m;
  });

  /* build HTML table */
  let html='<table style="border-collapse:collapse;font-size:12px"><thead><tr><th></th>';
  words.forEach(w=>html+=`<th>${w}</th>`); html+='</tr></thead><tbody>';

  for(let i=0;i<n;i++){
    const g=words[i]; html+=`<tr><th>${g}</th>`;
    for(let j=0;j<n;j++){
      const s=words[j];
      const left=candidates.length;
      const remain=buckets[g].get(patternKey(s,g));   // cuántas quedarían
      const elim=left-remain;                         // words eliminated
      html+=`<td style="text-align:center">${elim}</td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table>';
  $('compareArea').innerHTML=html;
}

/* ========== FIND WORDS (sin cambios) ========== */
function buscarPalabrasUsuario(){
  const raw=$('lettersInput').value.toUpperCase().replace(/[^A-Z]/g,'');
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
  const div=$('finderResults');
  if(!Object.keys(res).length){ div.textContent='No words found'; return;}
  div.innerHTML=Object.entries(res).map(([c,w])=>
     `<h4>Using ${c} (${w.length})</h4><pre style="white-space:pre-wrap">${w.join(', ')}</pre>`).join('');
}
function kComb(set,k){ const o=[],rec=(s,a)=>{ if(a.length===k){ o.push(a.slice()); return;}
  for(let i=s;i<set.length;i++){ a.push(set[i]); rec(i+1,a); a.pop(); }}; rec(0,[]); return o;}
