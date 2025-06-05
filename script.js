
/* Wordle Solver English version */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary = DICTIONARY.slice(); // from diccionario_en.js
let history = [];
let patterns = []; // store color patterns per guess
let candidates = dictionary.slice();

function init() {
  buildColorSelectors();
  document.getElementById('saveGuess').onclick = saveGuess;
  document.getElementById('reset').onclick = resetAll;
  document.getElementById('suggest').onclick = suggestWords;
  document.getElementById('findBtn').onclick = buscarPalabrasUsuario;
  // tab switching
  document.getElementById('tabSolver').onclick = () => showTab('solver');
  document.getElementById('tabFinder').onclick = () => showTab('finder');
  showTab('solver');
  renderFreqTable();
  updateCandidates();
}

function showTab(which){
  const solver = document.getElementById('panelSolver');
  const finder = document.getElementById('panelFinder');
  if(which==='solver'){
     solver.hidden=false; finder.hidden=true;
     document.getElementById('tabSolver').classList.add('active');
     document.getElementById('tabFinder').classList.remove('active');
  } else {
     solver.hidden=true; finder.hidden=false;
     document.getElementById('tabFinder').classList.add('active');
     document.getElementById('tabSolver').classList.remove('active');
  }
}

function buildColorSelectors(){
  const container = document.getElementById('colorSelects');
  container.innerHTML='';
  for(let i=0;i<5;i++){
    const sel=document.createElement('select');
    ['Gray','Yellow','Green'].forEach((c,idx)=>{
      const opt=document.createElement('option');
      opt.value=idx; opt.textContent=c;
      sel.appendChild(opt);
    });
    container.appendChild(sel);
  }
}

function saveGuess(){
  const word = document.getElementById('wordInput').value.trim().toUpperCase();
  if(word.length!==5 || !/^[A-Z]{5}$/.test(word)){ alert('Enter 5 letters'); return;}
  const selects = [...document.getElementById('colorSelects').children];
  const pattern = selects.map(s=>parseInt(s.value)); // 0 gray 1 yellow 2 green
  history.push(word);
  patterns.push(pattern);
  document.getElementById('wordInput').value='';
  updateHistory();
  updateCandidates();
}

function resetAll(){
  history=[]; patterns=[]; candidates=dictionary.slice();
  updateHistory();
  updateCandidates();
}

function updateHistory(){
  document.getElementById('history').textContent = history.join('\n');
}

function matchPattern(word, pattern, guess){
  let res=[0,0,0,0,0];
  let wordArr=word.split('');
  let guessArr=guess.split('');
  // First pass greens
  for(let i=0;i<5;i++){
    if(wordArr[i]===guessArr[i]){ res[i]=2; wordArr[i]=null; guessArr[i]=null;}
  }
  // Second pass yellows
  for(let i=0;i<5;i++){
    if(guessArr[i]){
      const idx = wordArr.indexOf(guessArr[i]);
      if(idx!==-1){ res[i]=1; wordArr[idx]=null;}
    }
  }
  // Compare with expected pattern
  for(let i=0;i<5;i++) if(res[i]!==pattern[i]) return false;
  return true;
}

function updateCandidates(){
  candidates = dictionary.filter(w=>{
    for(let g=0; g<history.length; g++){
      if(!matchPattern(w, patterns[g], history[g])) return false;
    }
    return true;
  });
  document.getElementById('candCount').textContent = candidates.length;
  renderCandidateTable();
  renderFreqTable();
}

function renderCandidateTable(){
  const tbody=document.querySelector('#tblCands tbody');
  tbody.innerHTML='';
  const list = candidates.slice(0,100); // safety
  list.forEach(w=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${w}</td><td></td>`;
    tbody.appendChild(tr);
  });
}

function renderFreqTable(){
  const freq = LETTERS.reduce((o,l)=>({ ...o, [l]:0 }),{});
  let wordCount = LETTERS.reduce((o,l)=>({ ...o, [l]:0 }),{});
  let repeated = LETTERS.reduce((o,l)=>({ ...o, [l]:0 }),{});
  candidates.forEach(w=>{
    const letters = w.split('');
    letters.forEach(l=>{ freq[l]+=1; });
    LETTERS.forEach(l=>{
      if(w.includes(l)){ wordCount[l]+=1; }
      if(w.split(l).length-1>1) repeated[l]+= (w.includes(l)?1:0);
    });
  });
  const tbody=document.querySelector('#tblFreq tbody');
  tbody.innerHTML='';
  LETTERS.forEach(l=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${l}</td><td>${freq[l]}</td><td>${wordCount[l]}</td><td>${repeated[l]}</td>`;
    tbody.appendChild(tr);
  });
}

function scoreRapido(word){
  // heuristic: sum of unique letter inverse frequency in candidates
  let letters = [...new Set(word)];
  let score=0;
  letters.forEach(l=>{
    let f = 0;
    candidates.forEach(w=>{ if(w.includes(l)) f++; });
    score += (f?1/f:0);
  });
  return score;
}

function suggestWords(){
  let list = candidates.slice();
  if(list.length>800){
    list.sort((a,b)=> scoreRapido(b)-scoreRapido(a));
  } else {
    list.sort();
  }
  const tbody=document.querySelector('#tblDiscard tbody');
  tbody.innerHTML='';
  list.slice(0,15).forEach(w=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${w}</td><td>${scoreRapido(w).toFixed(3)}</td>`;
    tbody.appendChild(tr);
  });
}

function buscarPalabrasUsuario(){
  const input = document.getElementById('lettersInput').value.toUpperCase().replace(/[^A-Z]/g,'');
  if(!input){ alert('Enter letters'); return;}
  const letters=[...new Set(input.split(''))]; // unique
  if(letters.length===0 || letters.length>5){ alert('Enter 1–5 letters'); return;}
  let results = {};
  for(let omit=0; omit<=letters.length; omit++){
    const combos = kCombinations(letters, letters.length - omit);
    for(const combo of combos){
      const hits = dictionary.filter(w=> combo.every(l=> w.includes(l)));
      if(hits.length){
         results[combo.join('')] = hits;
    }
   }
   if(Object.keys(results).length) break; // stop after first success level
  }
  displayFinderResults(results);
}

function kCombinations(set, k){
  const arr=[];
  const comb=(start,pick)=>{
     if(pick.length===k){ arr.push(pick.slice()); return;}
     for(let i=start;i<set.length;i++){
       pick.push(set[i]);
       comb(i+1,pick);
       pick.pop();
     }
  };
  comb(0,[]);
  return arr;
}

function displayFinderResults(res){
  const div = document.getElementById('finderResults');
  if(!Object.keys(res).length){ div.textContent='No words found'; return;}
  let html='';
  for(const combo in res){
    html += `<h4>Using letters ${combo} (${res[combo].length} words)</h4>`;
    html += '<pre>'+ res[combo].join(', ') +'</pre>';
  }
  div.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', init);
