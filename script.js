
/* Wordle Solver English version – enhanced parity with ES */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let dictionary = DICTIONARY.slice();              // from diccionario_en.js
let history   = [];                               // guessed words
let patterns  = [];                               // colour pattern per guess (array of arrays of 0/1/2)
let candidates = dictionary.slice();              // words still possible

/* ---------- UI initialisation ---------- */
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

/* ---------- Build colour dropdowns ---------- */
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

/* ---------- Handle guesses ---------- */
function saveGuess(){
  const wordInput = document.getElementById('wordInput');
  const word = wordInput.value.trim().toUpperCase();
  if(word.length!==5 || !/^[A-Z]{5}$/.test(word)){ alert('Enter 5 letters (A‑Z)'); return;}

  const pattern = [...document.getElementById('colorSelects').children]
                  .map(sel=>parseInt(sel.value)); // 0 gray / 1 yellow / 2 green

  history.push(word);
  patterns.push(pattern);

  wordInput.value='';
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

/* ---------- Pattern helpers ---------- */
// return array[5] with numbers 0/1/2 (gray / yellow / green)
function patternFromWords(secret, guess){
  const res = Array(5).fill(0);
  const secretArr = secret.split('');
  const guessArr  = guess.split('');

  /* first pass – greens */
  for(let i=0;i<5;i++){
    if(guessArr[i]===secretArr[i]){
      res[i]=2;
      secretArr[i]=null;  // consume
      guessArr[i]=null;
    }
  }
  /* second pass – yellows */
  for(let i=0;i<5;i++){
    if(guessArr[i]){
      const idx = secretArr.indexOf(guessArr[i]);
      if(idx!==-1){
        res[i]=1;
        secretArr[idx]=null;
      }
    }
  }
  return res;
}

// pattern key serialised as string "02110" for map keys
function patternKey(secret, guess){
  return patternFromWords(secret, guess).join('');
}

/* ---------- Candidate filtering ---------- */
function updateCandidates(){
  candidates = dictionary.filter(word=>{
    for(let g=0; g<history.length; g++){
      if(patternKey(word, history[g]) !== patterns[g].join('')) return false;
    }
    return true;
  });

  document.getElementById('candCount').textContent = candidates.length.toString();
  renderCandidateTable();
  renderFreqTable();
}

/* ---------- Scoring (H) ---------- */
function computeH(word){
  const n = candidates.length;
  if(n===0) return 0;
  const counts = new Map();
  for(const secret of candidates){
    const key = patternKey(secret, word);
    counts.set(key, (counts.get(key)||0)+1);
  }
  let sumP2 = 0;
  counts.forEach(count=>{
    const p = count / n;
    sumP2 += p*p;
  });
  return 1 / sumP2;     // maximum == n when every pattern unique
}

// fast heuristic used only when >800 candidates
function scoreRapido(word){
  const seen = new Set(word);
  let score = 0;
  for(const l of seen){
    let freq = 0;
    for(const w of candidates) if(w.includes(l)) freq++;
    score += (freq?1/freq:0);
  }
  return score;
}

/* ---------- Render candidate & suggestion tables ---------- */
function renderCandidateTable(){
  const tbody=document.querySelector('#tblCands tbody');
  tbody.innerHTML='';
  const list = candidates.slice();
  const n = candidates.length;
  if(n<=800){
    list.sort((a,b)=> computeH(b)-computeH(a));
  }
  list.slice(0,500).forEach(w=>{
    const tr=document.createElement('tr');
    const hVal = (n<=800 ? computeH(w).toFixed(2) : '');
    tr.innerHTML = `<td>${w}</td><td>${hVal}</td>`;
    tbody.appendChild(tr);
  });
}

/* Suggest discard words (dictionary-wide) */
function suggestWords(){
  const baseList = dictionary.slice();
  const n = candidates.length;
  let list;

  if(n>800){
    list = baseList.sort((a,b)=> scoreRapido(b)-scoreRapido(a));
  }else{
    list = baseList.sort((a,b)=> computeH(b)-computeH(a));
  }

  renderDiscardTable(list.slice(0,20));
  renderGreenTable(n>0 ? getGreenRepetition(list) : []);
}

function renderDiscardTable(words){
  const tbody=document.querySelector('#tblDiscard tbody');
  tbody.innerHTML='';
  for(const w of words){
    const h = computeH(w).toFixed(3);
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${w}</td><td>${h}</td>`;
    tbody.appendChild(tr);
  }
}

/* ---------- Green repetition ---------- */
// discard words that keep confirmed green letters in place
function getGreenPattern(){
  const greens = Array(5).fill(null);
  for(const idx in patterns){
    for(let i=0;i<5;i++){
      if(patterns[idx][i]===2) greens[i] = history[idx][i];
    }
  }
  return greens; // array with letters or null
}

function wordMatchesGreens(word, greens){
  for(let i=0;i<5;i++){
    if(greens[i] && word[i]!==greens[i]) return false;
  }
  return true;
}

function getGreenRepetition(wordList){
  const greens = getGreenPattern();
  if(greens.every(g=>!g)) return []; // no greens yet
  return wordList.filter(w=> wordMatchesGreens(w, greens))
                 .sort((a,b)=> computeH(b)-computeH(a))
                 .slice(0,20);
}

function renderGreenTable(words){
  const tbody=document.querySelector('#tblGreen tbody');
  tbody.innerHTML='';
  for(const w of words){
    const h = computeH(w).toFixed(3);
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${w}</td><td>${h}</td>`;
    tbody.appendChild(tr);
  }
}

/* ---------- Letter frequencies ---------- */
function renderFreqTable(){
  const totals = LETTERS.map(l=>({letter:l, appearances:0, words:0, repeated:0}));
  const n = candidates.length;
  for(const w of candidates){
    const seen = {};
    for(const ch of w){
      const obj = totals[LETTERS.indexOf(ch)];
      obj.appearances++;
      if(!seen[ch]){
        obj.words++;
        seen[ch]=true;
      }else{
        obj.repeated++;
      }
    }
  }
  // order by #words descending
  totals.sort((a,b)=> b.words - a.words);

  const tbody=document.querySelector('#tblFreq tbody');
  tbody.innerHTML='';
  for(const t of totals){
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${t.letter}</td><td>${t.appearances}</td><td>${t.words}</td><td>${t.repeated}</td>`;
    tbody.appendChild(tr);
  }
}

/* ---------- Word finder (Buscar palabras) ---------- */
function buscarPalabrasUsuario(){
  const input = document.getElementById('lettersInput').value.toUpperCase().replace(/[^A-Z]/g,'');
  if(!input){ alert('Enter letters'); return;}
  const letters=[...new Set(input.split(''))]; // unique letters
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
    if(Object.keys(results).length) break; // stop at first success level
  }
  displayFinderResults(results);
}

function kCombinations(set, k){
  const out=[];
  const backtrack=(start,arr)=>{
    if(arr.length===k){ out.push(arr.slice()); return;}
    for(let i=start;i<set.length;i++){
      arr.push(set[i]);
      backtrack(i+1, arr);
      arr.pop();
    }
  };
  backtrack(0, []);
  return out;
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
