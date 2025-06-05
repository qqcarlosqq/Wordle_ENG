/* Wordle Solver — English  (v4.1  • auto-tbody + compare toggle) */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary = DICTIONARY.slice();

/* ---------- estado ---------- */
let history=[], patterns=[], candidates=[];
let calcDone=false, cacheH={}, version=0;

/* === init === */
document.addEventListener('DOMContentLoaded', ()=>{
  buildColorSelectors();
  on('saveGuess', saveGuess); on('reset', resetAll);
  on('suggest',   onSuggest); on('findBtn', buscarPalabrasUsuario);
  on('runCompare', runCompare);
  on('tabSolver',  ()=>showTab('solver'));
  on('tabFinder',  ()=>showTab('finder'));
  on('tabCompare', ()=>showTab('compare'));
  showTab('solver'); clearTables(); renderFreqTable();
});

/* ---------- dom helpers ---------- */
const $ = id => document.getElementById(id);
const on = (id,f)=>$(id).addEventListener('click',f);
const getTBody = id => {
  const tbl=$(id); let tb=tbl.querySelector('tbody');
  if(!tb){ tb=document.createElement('tbody'); tbl.appendChild(tb);} return tb;
};

/* ---------- UI ---------- */
function showTab(t){
  ['Solver','Finder','Compare'].forEach(p=>{
    $(`panel${p}`).hidden = (p.toLowerCase()!==t);
    $(`tab${p}`).classList.toggle('active',p.toLowerCase()===t);
  });
}
function clearTables(){
  $('candCount').textContent='0';
  ['tblCands','tblDiscard','tblGreen','tblFreq']
    .forEach(id=>getTBody(id).innerHTML='');
  $('history').textContent=''; $('compareArea').innerHTML='';
}

/* selectors */
function buildColorSelectors(){
  const c=$('colorSelects'); c.innerHTML='';
  for(let i=0;i<5;i++){
    const s=document.createElement('select');
    ['Gray','Yellow','Green'].forEach((t,v)=>{
      const o=document.createElement('option'); o.value=v; o.textContent=t; s.appendChild(o);
    }); c.appendChild(s);
  }
}

/* ---------- flujo de juego ---------- */
function saveGuess(){
  const w=$('wordInput').value.trim().toUpperCase();
  if(!/^[A-Z]{5}$/.test(w)){ alert('Enter a 5-letter word'); return;}
  const p=[...$('colorSelects').children].map(sel=>+sel.value);
  history.push(w); patterns.push(p); $('wordInput').value='';
  updateHist(); calcDone=false; toggleCompareBtn();
}
function resetAll(){ history=[]; patterns=[]; candidates=[];
  calcDone=false; cacheH={}; version++; buildColorSelectors();
  clearTables(); renderFreqTable(); toggleCompareBtn(); }
function onSuggest(){
  if(!calcDone){ updateCandidates(); calcDone=true; }
  renderAll(); toggleCompareBtn();
}
function updateHist(){ const map=['gray','yellow','green'];
  $('history').textContent=history.map((w,i)=>`${w} → ${patterns[i].map(c=>map[c]).join(', ')}`).join('\n');}

/* ---------- lógica ---------- */
const patternKey=(s,g)=>patternFromWords(s,g).join('');
function patternFromWords(sec,gu){
  const r=Array(5).fill(0), S=sec.split(''), G=gu.split('');
  for(let i=0;i<5;i++) if(G[i]===S[i]){ r[i]=2; S[i]=G[i]=null; }
  for(let i=0;i<5;i++) if(G[i]){ const j=S.indexOf(G[i]); if(j!==-1){ r[i]=1; S[j]=null; } }
  return r;
}
function updateCandidates(){
  candidates=dictionary.filter(w=>patterns.every((p,i)=>patternKey(w,history[i])===p.join('')));
  version++; cacheH={};
}
function computeH(w){
  const c=cacheH[w]; if(c&&c.v===version) return c.h;
  const n=candidates.length; if(!n) return 0;
  const m=new Map(); candidates.forEach(s=>{
    const k=patternKey(s,w); m.set(k,(m.get(k)||0)+1);
  });
  const ss=[...m.values()].reduce((a,x)=>a+x*x,0), h=n-ss/n;
  cacheH[w]={v:version,h}; return h;
}
const scoreRapido=w=>[...new Set(w)].reduce((s,ch)=>{
  let f=0; for(const w2 of candidates) if(w2.includes(ch)) f++; return s+(f?1/f:0);
},0);

/* ---------- render ---------- */
function renderAll(){
  $('candCount').textContent=candidates.length;
  renderCandidates(); renderDiscard(); renderGreen(); renderFreqTable();
}
function renderCandidates(){
  const tb=getTBody('tblCands'); tb.innerHTML='';
  const list=candidates.slice();
  if(list.length<=800) list.sort((a,b)=>computeH(b)-computeH(a));
  list.forEach(w=>tb.insertAdjacentHTML('beforeend',
    `<tr><td>${w}</td><td>${list.length<=800?computeH(w).toFixed(2):''}</td></tr>`));
}
const knownLetters=()=>{const s=new Set();
  patterns.forEach((p,i)=>p.forEach((c,idx)=>{ if(c>0) s.add(history[i][idx]); })); return s;};
const scoreDiscard=w=>computeH(w)-[...knownLetters()].reduce((pen,ch)=>pen+(w.includes(ch)?5:0),0);
function renderDiscard(){
  const tb=getTBody('tblDiscard'); tb.innerHTML='';
  const base=(candidates.length>800)
    ? dictionary.slice().sort((a,b)=>scoreRapido(b)-scoreRapido(a))
    : dictionary.slice().sort((a,b)=>scoreDiscard(b)-scoreDiscard(a));
  base.slice(0,20).forEach(w=>tb.insertAdjacentHTML('beforeend',
    `<tr><td>${w}</td><td>${scoreDiscard(w).toFixed(3)}</td></tr>`));
}
const greens=()=>{const g=Array(5).fill(null);
  patterns.forEach((p,i)=>p.forEach((c,idx)=>{ if(c===2) g[idx]=history[i][idx]; })); return g;};
const isGreenRep=(w,g)=>g.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch));
function renderGreen(){
  const tb=getTBody('tblGreen'); tb.innerHTML='';
  const g=greens(); if(g.every(x=>!x)) return;
  const base=(candidates.length>800)?dictionary.slice():dictionary.slice().sort((a,b)=>computeH(b)-computeH(a));
  base.filter(w=>isGreenRep(w,g)).slice(0,20)
      .forEach(w=>tb.insertAdjacentHTML('beforeend',
        `<tr><td>${w}</td><td>${computeH(w).toFixed(3)}</td></tr>`));
}
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
  const tb=getTBody('tblFreq'); tb.innerHTML='';
  rows.forEach(r=>tb.insertAdjacentHTML('beforeend',
    `<tr><td>${r.l}</td><td>${r.a}</td><td>${r.w}</td><td>${r.r}</td></tr>`));
}

/* ---------- compare button toggle ---------- */
function toggleCompareBtn(){ $('tabCompare').disabled = candidates.length>25; }

/* ---------- compare ≤25 ---------- */
function runCompare(){
  if(candidates.length>25){ alert('Need ≤25 candidates'); return;}
  const extra=$('extraInput').value.toUpperCase().split(/[^A-Z]+/)
                .filter(x=>x.length===5).slice(0,2);
  const words=[...candidates.slice(0,25-extra.length), ...extra];
  const n=words.length; if(!n){ $('compareArea').textContent='No words'; return;}
  /* buckets */
  const buckets=Object.fromEntries(words.map(g=>{
    const m=new Map(); words.forEach(s=>{
      const k=patternKey(s,g); m.set(k,(m.get(k)||0)+1);
    }); return [g,m];
  }));
  /* table */
  let html='<table style="border-collapse:collapse;font-size:11px"><thead><tr><th></th>';
  words.forEach(w=>html+=`<th>${w}</th>`); html+='</tr></thead><tbody>';
  for(const g of words){
    html+=`<tr><th>${g}</th>`;
    for(const s of words){
      const rem=buckets[g].get(patternKey(s,g));
      html+=`<td style="text-align:center">${n-rem}</td>`;
    } html+='</tr>';
  } html+='</tbody></table>';
  $('compareArea').innerHTML=html;
}

/* ---------- find words (sin cambios) ---------- */
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
    }); if(Object.keys(res).length) break;
  }
  const div=$('finderResults');
  if(!Object.keys(res).length){ div.textContent='No words found'; return;}
  div.innerHTML=Object.entries(res).map(([c,w])=>
    `<h4>Using ${c} (${w.length})</h4><pre style="white-space:pre-wrap">${w.join(', ')}</pre>`).join('');
}
function kComb(set,k){ const out=[],rec=(s,a)=>{ if(a.length===k){ out.push(a.slice()); return;}
  for(let i=s;i<set.length;i++){ a.push(set[i]); rec(i+1,a); a.pop(); } }; rec(0,[]); return out;}
