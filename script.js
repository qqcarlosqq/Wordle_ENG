/* Wordle Solver — English  (v5.2 • palette alta diferenciación) */

const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary=DICTIONARY.slice();

/* ---------- estado ---------- */
let history=[],patterns=[],candidates=[];
let calcDone=false, cacheH={}, version=0;

/* === INIT UI === */
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
/* helpers DOM */
const $=id=>document.getElementById(id);
const on=(id,fn)=>$(id).addEventListener('click',fn);
function ensureBody(id){const t=$(id);let b=t.querySelector('tbody');
  if(!b){b=document.createElement('tbody');t.appendChild(b);}return b;}

/* ---------- visual ---------- */
function showTab(t){['Solver','Finder','Compare'].forEach(p=>{
  $(`panel${p}`).hidden=(p.toLowerCase()!==t);
  $(`tab${p}`).classList.toggle('active',p.toLowerCase()===t);
});}
function clearTables(){
  $('candCount').textContent='0';
  ['tblCands','tblDiscard','tblGreen','tblFreq'].forEach(id=>ensureBody(id).innerHTML='');
  $('history').textContent=''; $('compareArea').innerHTML='';
}
function buildColorSelectors(){
  const c=$('colorSelects'); c.innerHTML='';
  for(let i=0;i<5;i++){
    const s=document.createElement('select');
    ['Gray','Yellow','Green'].forEach((t,v)=>{
      const o=document.createElement('option');o.value=v;o.textContent=t;s.appendChild(o);});
    c.appendChild(s);
  }
}

/* ---------- flujo ---------- */
function saveGuess(){
  const w=$('wordInput').value.trim().toUpperCase();
  if(!/^[A-Z]{5}$/.test(w)){alert('Enter a 5-letter word');return;}
  const pat=[...$('colorSelects').children].map(sel=>+sel.value);
  history.push(w); patterns.push(pat); $('wordInput').value='';
  updateHist(); calcDone=false; toggleCompareBtn();
}
function resetAll(){history=[];patterns=[];candidates=[];calcDone=false;
  cacheH={};version++;buildColorSelectors();clearTables();renderFreqTable();toggleCompareBtn();}
function onSuggest(){if(!calcDone){updateCandidates();calcDone=true;}
  renderAll();toggleCompareBtn();}
function updateHist(){const map=['gray','yellow','green'];
  $('history').textContent=history.map((w,i)=>`${w} → ${patterns[i].map(c=>map[c]).join(', ')}`).join('\n');}

/* ---------- patrones ---------- */
const patternKey=(s,g)=>patternFromWords(s,g).join('');
function patternFromWords(sec,gu){
  const r=Array(5).fill(0),S=sec.split(''),G=gu.split('');
  for(let i=0;i<5;i++)if(G[i]===S[i]){r[i]=2;S[i]=G[i]=null;}
  for(let i=0;i<5;i++)if(G[i]){const j=S.indexOf(G[i]);if(j!==-1){r[i]=1;S[j]=null;}}
  return r;
}

/* ---------- candidatos & H ---------- */
function updateCandidates(){
  candidates=dictionary.filter(w=>patterns.every((p,i)=>patternKey(w,history[i])===p.join('')));
  version++; cacheH={};
}
function computeH(w){const c=cacheH[w];if(c&&c.v===version)return c.h;
  const n=candidates.length;if(!n)return 0;
  const m=new Map();candidates.forEach(s=>{
    const k=patternKey(s,w);m.set(k,(m.get(k)||0)+1);});
  const ss=[...m.values()].reduce((a,x)=>a+x*x,0),h=n-ss/n;
  cacheH[w]={v:version,h};return h;}
const scoreRapido=w=>[...new Set(w)].reduce((s,ch)=>{
  let f=0;for(const w2 of candidates)if(w2.includes(ch))f++;return s+(f?1/f:0);},0);

/* ---------- render principal ---------- */
function renderAll(){ $('candCount').textContent=candidates.length;
  renderCandidates();renderDiscard();renderGreen();renderFreqTable();}
function renderCandidates(){
  const tb=ensureBody('tblCands');tb.innerHTML='';
  const list=candidates.slice();
  if(list.length<=800)list.sort((a,b)=>computeH(b)-computeH(a));
  list.forEach(w=>tb.insertAdjacentHTML('beforeend',
   `<tr><td>${w}</td><td>${list.length<=800?computeH(w).toFixed(2):''}</td></tr>`));
}
const knownLetters=()=>{const s=new Set();
  patterns.forEach((p,i)=>p.forEach((c,idx)=>{if(c>0)s.add(history[i][idx]);}));return s;};
const scoreDiscard=w=>computeH(w)-[...knownLetters()].reduce((p,ch)=>p+(w.includes(ch)?5:0),0);
function renderDiscard(){
  const tb=ensureBody('tblDiscard');tb.innerHTML='';
  const base=(candidates.length>800)
     ?dictionary.slice().sort((a,b)=>scoreRapido(b)-scoreRapido(a))
     :dictionary.slice().sort((a,b)=>scoreDiscard(b)-scoreDiscard(a));
  base.slice(0,20).forEach(w=>tb.insertAdjacentHTML('beforeend',
   `<tr><td>${w}</td><td>${scoreDiscard(w).toFixed(3)}</td></tr>`));
}
const greenPos=()=>{const g=Array(5).fill(null);
  patterns.forEach((p,i)=>p.forEach((c,idx)=>{if(c===2)g[idx]=history[i][idx];}));return g;};
const isGreenRep=(w,g)=>g.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch));
function renderGreen(){
  const tb=ensureBody('tblGreen');tb.innerHTML='';
  const g=greenPos();if(g.every(x=>!x))return;
  const base=(candidates.length>800)?dictionary.slice():dictionary.slice().sort((a,b)=>computeH(b)-computeH(a));
  base.filter(w=>isGreenRep(w,g)).slice(0,20)
      .forEach(w=>tb.insertAdjacentHTML('beforeend',
        `<tr><td>${w}</td><td>${computeH(w).toFixed(3)}</td></tr>`));}
function renderFreqTable(){
  const rows=LETTERS.map(l=>({l,a:0,w:0,r:0}));
  for(const w of candidates){const seen={};
    for(const ch of w){const r=rows[LETTERS.indexOf(ch)];r.a++;
      if(seen[ch])r.r++;else{r.w++;seen[ch]=1;}}}
  rows.sort((x,y)=>y.w-x.w);
  const tb=ensureBody('tblFreq');tb.innerHTML='';
  rows.forEach(r=>tb.insertAdjacentHTML('beforeend',
     `<tr><td>${r.l}</td><td>${r.a}</td><td>${r.w}</td><td>${r.r}</td></tr>`));
}
function toggleCompareBtn(){ $('tabCompare').disabled=candidates.length>25; }

/* ---------- compare grid (<25) ---------- */
function runCompare(){
  if(candidates.length>25){alert('Need ≤25 candidates'); return;}
  const extra=$('extraInput').value.toUpperCase().split(/[^A-Z]+/)
               .filter(x=>x.length===5).slice(0,2);
  const words=[...candidates.slice(0,25-extra.length),...extra];
  const n=words.length;if(!n){$('compareArea').textContent='No words';return;}

  /* patrón matrix */
  const pat=words.map(g=>words.map(s=>patternKey(s,g)));

  /* paleta contrastada (25 colores) */
  const palette=[
    '#ffcc00','#4da6ff','#66cc66','#ff6666','#c58aff','#ffa64d',
    '#4dd2ff','#99ff99','#ff80b3','#b3b3ff','#ffd24d','#3399ff',
    '#77dd77','#ff4d4d','#c299ff','#ffb84d','#00bfff','#99e699',
    '#ff99c2','#9999ff','#ffe066','#0080ff','#66ffb3','#ff4da6','#8080ff'
  ];

  let html='<table style="border-collapse:collapse;font-size:11px"><thead><tr><th></th>';
  words.forEach(w=>html+=`<th>${w}</th>`); html+='<th>options</th></tr></thead><tbody>';

  for(let i=0;i<n;i++){
    const row=pat[i], groups={};
    row.forEach((p,idx)=>{(groups[p]=groups[p]||[]).push(idx);});
    let idx=0; Object.values(groups).forEach(g=>{if(g.length>1){g.clr=palette[idx++];}});
    let zeros=0;
    html+=`<tr><th>${words[i]}</th>`;
    for(let j=0;j<n;j++){
      const p=row[j], g=groups[p], jump=g.find(c=>c>j)?g.find(c=>c>j)-j:0;
      if(jump===0) zeros++;
      const bg=g.clr||'#f2f2f2';
      html+=`<td style="text-align:center;background:${bg}">${p}-${jump}</td>`;
    }
    html+=`<td style="text-align:center;font-weight:bold">${zeros}</td></tr>`;
  }
  html+='</tbody></table>';
  $('compareArea').innerHTML=html;
}

/* ---------- find words ---------- */
function buscarPalabrasUsuario(){
  const raw=$('lettersInput').value.toUpperCase().replace(/[^A-Z]/g,'');
  if(!raw){alert('Enter letters');return;}
  const letters=[...new Set(raw.split(''))];
  if(!letters.length||letters.length>5){alert('Enter 1–5 letters');return;}
  let res={};
  for(let omit=0;omit<=letters.length;omit++){
    kComb(letters,letters.length-omit).forEach(c=>{
      const hits=dictionary.filter(w=>c.every(l=>w.includes(l)));
      if(hits.length)res[c.join('')]=hits;
    }); if(Object.keys(res).length)break;}
  const div=$('finderResults');
  if(!Object.keys(res).length){div.textContent='No words found';return;}
  div.innerHTML=Object.entries(res).map(([c,w])=>
    `<h4>Using ${c} (${w.length})</h4><pre style="white-space:pre-wrap">${w.join(', ')}</pre>`).join('');
}
function kComb(set,k){const out=[],rec=(s,a)=>{if(a.length===k){out.push(a.slice());return;}
  for(let i=s;i<set.length;i++){a.push(set[i]);rec(i+1,a);a.pop();}};rec(0,[]);return out;}
