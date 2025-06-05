
/* Wordle Solver English version – EntropiaExacta */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary = DICTIONARY.slice();
let history = [];
let patterns = [];
let candidates = dictionary.slice();

/* ------------ UI Setup ------------ */
function init() {
  buildColorSelectors();
  document.getElementById('saveGuess').onclick = saveGuess;
  document.getElementById('reset').onclick = resetAll;
  document.getElementById('suggest').onclick = suggestWords;
  document.getElementById('findBtn').onclick = buscarPalabrasUsuario;
  document.getElementById('tabSolver').onclick = () => showTab('solver');
  document.getElementById('tabFinder').onclick = () => showTab('finder');
  showTab('solver');
  renderFreqTable();
  updateCandidates();
}

function showTab(which){
  const solver=document.getElementById('panelSolver');
  const finder=document.getElementById('panelFinder');
  if(which==='solver'){
    solver.hidden=false; finder.hidden=true;
    document.getElementById('tabSolver').classList.add('active');
    document.getElementById('tabFinder').classList.remove('active');
  }else{
    solver.hidden=true; finder.hidden=false;
    document.getElementById('tabFinder').classList.add('active');
    document.getElementById('tabSolver').classList.remove('active');
  }
}

/* ------------ Colour selectors ------------ */
function buildColorSelectors(){
  const cont=document.getElementById('colorSelects');
  cont.innerHTML='';
  for(let i=0;i<5;i++){
    const sel=document.createElement('select');
    ['Gray','Yellow','Green'].forEach((txt,val)=>{
       const opt=document.createElement('option');
       opt.value=val; opt.textContent=txt; sel.appendChild(opt);
    });
    cont.appendChild(sel);
  }
}

/* ------------ Guess handling ------------ */
function saveGuess(){
  const inp=document.getElementById('wordInput');
  const word=inp.value.trim().toUpperCase();
  if(!/^[A-Z]{5}$/.test(word)){ alert('Enter 5 letters (A‑Z)'); return;}
  const pattern=[...document.getElementById('colorSelects').children].map(s=>+s.value);
  history.push(word); patterns.push(pattern);
  inp.value='';
  updateHistory();
  updateCandidates();
}
function resetAll(){ history=[]; patterns=[]; candidates=dictionary.slice(); updateHistory(); updateCandidates(); }
function updateHistory(){ document.getElementById('history').textContent=history.join('\n'); }

/* ------------ Pattern helpers ------------ */
function patternFromWords(secret, guess){
  const res=Array(5).fill(0);
  const sArr=secret.split(''); const gArr=guess.split('');
  for(let i=0;i<5;i++){
    if(gArr[i]===sArr[i]){ res[i]=2; sArr[i]=null; gArr[i]=null;}
  }
  for(let i=0;i<5;i++){
    if(gArr[i]){
      const idx=sArr.indexOf(gArr[i]);
      if(idx!==-1){ res[i]=1; sArr[idx]=null; }
    }
  }
  return res;
}
function patternKey(secret, guess){ return patternFromWords(secret,guess).join(''); }

/* ------------ Candidate update ------------ */
function updateCandidates(){
  candidates=dictionary.filter(w=>{
    for(let g=0;g<history.length;g++){
      if(patternKey(w,history[g])!==patterns[g].join('')) return false;
    }
    return true;
  });
  document.getElementById('candCount').textContent=candidates.length;
  renderCandidateTable();
  renderFreqTable();
}

/* ------------ EntropiaExacta ------------ */
function computeH(word){
  const n=candidates.length;
  if(n===0) return 0;
  const counts=new Map();
  for(const secret of candidates){
    const k=patternKey(secret,word);
    counts.set(k,(counts.get(k)||0)+1);
  }
  const sumSq=[...counts.values()].reduce((s,c)=>s+c*c,0);
  return n - sumSq/n;   // Exact entropy (expected remaining words)
}

/* Fast heuristic for >800 candidates */
function scoreRapido(word){
  const uniq=[...new Set(word)];
  let score=0;
  for(const l of uniq){
    let freq=0;
    for(const w of candidates) if(w.includes(l)) freq++;
    score+= (freq?1/freq:0);
  }
  return score;
}

/* ------------ Rendering tables ------------ */
function renderCandidateTable(){
  const tbody=document.querySelector('#tblCands tbody');
  tbody.innerHTML='';
  const list=candidates.slice();
  if(list.length<=800) list.sort((a,b)=>computeH(b)-computeH(a));
  else list.sort();
  list.slice(0,500).forEach(w=>{
     const h=list.length<=800 ? computeH(w).toFixed(2) : '';
     const tr=document.createElement('tr');
     tr.innerHTML=`<td>${w}</td><td>${h}</td>`;
     tbody.appendChild(tr);
  });
}

function suggestWords(){
  const base=dictionary.slice();
  const list = (candidates.length>800)
      ? base.sort((a,b)=>scoreRapido(b)-scoreRapido(a))
      : base.sort((a,b)=>computeH(b)-computeH(a));
  renderDiscardTable(list.slice(0,20));
  renderGreenTable(getGreenRepetition(list));
}

function renderDiscardTable(words){
  const tbody=document.querySelector('#tblDiscard tbody');
  tbody.innerHTML='';
  words.forEach(w=>{
    const h=computeH(w).toFixed(3);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${w}</td><td>${h}</td>`;
    tbody.appendChild(tr);
  });
}

/* Green repetition */
function getGreenPattern(){
  const greens=Array(5).fill(null);
  patterns.forEach((p,idx)=>{
    for(let i=0;i<5;i++) if(p[i]===2) greens[i]=history[idx][i];
  });
  return greens;
}
function wordMatchesGreens(w,g){ for(let i=0;i<5;i++) if(g[i]&&w[i]!==g[i]) return false; return true; }
function getGreenRepetition(list){
  const g=getGreenPattern();
  if(g.every(x=>!x)) return [];
  return list.filter(w=>wordMatchesGreens(w,g))
             .sort((a,b)=>computeH(b)-computeH(a))
             .slice(0,20);
}
function renderGreenTable(words){
  const tbody=document.querySelector('#tblGreen tbody'); tbody.innerHTML='';
  words.forEach(w=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${w}</td><td>${computeH(w).toFixed(3)}</td>`;
    tbody.appendChild(tr);
  });
}

/* ------------ Letter frequencies ------------ */
function renderFreqTable(){
  const rows=LETTERS.map(l=>({l,app:0,words:0,rep:0}));
  candidates.forEach(w=>{
     const seen={};
     for(const ch of w){
       const r=rows[LETTERS.indexOf(ch)];
       r.app++;
       if(seen[ch]) r.rep++; else { seen[ch]=1; r.words++; }
     }
  });
  rows.sort((a,b)=>b.words-a.words);
  const tbody=document.querySelector('#tblFreq tbody'); tbody.innerHTML='';
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${r.l}</td><td>${r.app}</td><td>${r.words}</td><td>${r.rep}</td>`;
    tbody.appendChild(tr);
  });
}

/* ------------ Word finder ------------ */
function buscarPalabrasUsuario(){
  const txt=document.getElementById('lettersInput').value.toUpperCase().replace(/[^A-Z]/g,'');
  if(!txt){ alert('Enter letters'); return;}
  const letters=[...new Set(txt.split(''))];
  if(letters.length===0||letters.length>5){ alert('Enter 1–5 letters'); return;}
  let res={};
  for(let omit=0; omit<=letters.length; omit++){
    const combos=kComb(letters,letters.length-omit);
    for(const c of combos){
      const hits=dictionary.filter(w=>c.every(l=>w.includes(l)));
      if(hits.length) res[c.join('')]=hits;
    }
    if(Object.keys(res).length) break;
  }
  displayFinderResults(res);
}
function kComb(set,k){
  const out=[]; const bt=(s,acc)=>{
    if(acc.length===k){ out.push(acc.slice()); return;}
    for(let i=s;i<set.length;i++){ acc.push(set[i]); bt(i+1,acc); acc.pop();}
  }; bt(0,[]); return out;
}
function displayFinderResults(res){
  const div=document.getElementById('finderResults');
  if(!Object.keys(res).length){ div.textContent='No words found'; return;}
  let html=''; for(const c in res){ html+=`<h4>Using ${c} (${res[c].length})</h4><pre>${res[c].join(', ')}</pre>`;}
  div.innerHTML=html;
}

document.addEventListener('DOMContentLoaded',init);
