/* Wordle Solver — English  v6.3-patch2  (24-Jun-2025)
   Minimal patch: invalidates candidate list after every new guess.
*/

/* ---------- constants ---------- */
const FAST_LIMIT = 2000;
const LETTERS    = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COLOR_NAMES= ["gray","Yellow","GREEN"];
const dictionary = DICTIONARY.slice();            // from diccionario_en.js

const palette = [
  "#ffcc00","#4da6ff","#66cc66","#ff6666","#c58aff","#ffa64d",
  "#4dd2ff","#99ff99","#ff80b3","#b3b3ff","#ffd24d","#3399ff",
  "#77dd77","#ff4d4d","#c299ff","#ffb84d","#00bfff","#99e699",
  "#ff99c2","#9999ff","#ffe066","#0080ff","#66ffb3","#ff4da6","#8080ff"
];

/* ---------- state ---------- */
let history=[], patterns=[], candidates=[], version=0;
let cacheH={}, rapidoMap=null, rapidoCalc=null;
let compareSelectMode=false;

/* ---------- DOM helpers ---------- */
const $  = id=>document.getElementById(id);
const on = (id,fn)=>$(id).addEventListener("click",fn);
const tbody = id=>$(id).tBodies[0] ?? $(id).appendChild(document.createElement("tbody"));

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  buildColorSelectors();
  on("saveGuess",saveGuess);
  on("reset",resetAll);
  on("suggest",onSuggest);
  on("findBtn",runFinder);
  on("runCompare",runCompare);
  on("tabSolver", ()=>showTab("solver"));
  on("tabFinder", ()=>showTab("finder"));
  on("tabCompare",()=>showTab("compare"));
  showTab("solver");
  clearAll(); renderFreq();
});

/* ---------- UI ---------- */
function showTab(t){
  ["Solver","Finder","Compare"].forEach(p=>{
    $(`panel${p}`).hidden = (p.toLowerCase()!==t);
    $(`tab${p}`).classList.toggle("active",p.toLowerCase()===t);
  });
}
function buildColorSelectors(){
  const box=$("colorSelects"); box.innerHTML="";
  for(let i=0;i<5;i++){
    const s=document.createElement("select");
    ["Gray","Yellow","Green"].forEach((txt,val)=>{
      const o=document.createElement("option");
      o.value=val; o.textContent=txt; s.appendChild(o);
    });
    box.appendChild(s);
  }
}
function updateHist(){
  $("history").textContent = history
    .map((w,i)=>`${w} → ${patterns[i].map(c=>COLOR_NAMES[c]).join(", ")}`)
    .join("\n");
}

/* ---------- pattern helpers ---------- */
function patternFromWords(sol,gu){
  const out=Array(5).fill(0), S=sol.split(""), G=gu.split("");
  for(let i=0;i<5;i++) if(G[i]===S[i]){ out[i]=2; S[i]=G[i]=null; }
  for(let i=0;i<5;i++) if(G[i]){
    const j=S.indexOf(G[i]); if(j!==-1){ out[i]=1; S[j]=null; }
  }
  return out;
}
const patternKey=(s,g)=>patternFromWords(s,g).join("");

/* ---------- heuristic (fast) ---------- */
function buildRapido(){
  const f=new Map(), pos=Array.from({length:5},()=>new Map());
  candidates.forEach(w=>{
    w.split("").forEach((ch,i)=>{
      f.set(ch,(f.get(ch)||0)+1);
      pos[i].set(ch,(pos[i].get(ch)||0)+1);
    });
  });
  const raw=w=>{
    let s1=0; new Set(w).forEach(ch=>s1+=(f.get(ch)||0));
    let s2=0; w.split("").forEach((ch,i)=>s2+=(pos[i].get(ch)||0));
    return 0.3*s1+0.7*s2;
  };
  let mx=0; candidates.forEach(w=>{const v=raw(w); if(v>mx) mx=v;});
  const k=(candidates.length-1)/mx;
  rapidoMap = new Map(); candidates.forEach(w=>rapidoMap.set(w, +(raw(w)*k).toFixed(2)));
  rapidoCalc = w=>+(raw(w)*k).toFixed(2);
  version++;
}
const scoreRapido = w => rapidoMap?.get(w) ?? (rapidoCalc ? rapidoCalc(w) : 0);

/* ---------- colour sets ---------- */
const greenSet = ()=>{const s=new Set();patterns.forEach((p,i)=>p.forEach((c,idx)=>{if(c===2)s.add(history[i][idx]);}));return s;};
const yellowSet= ()=>{const s=new Set();patterns.forEach((p,i)=>p.forEach((c,idx)=>{if(c===1)s.add(history[i][idx]);}));return s;};
const knownSet = ()=>new Set([...greenSet(),...yellowSet()]);

/* ---------- flow ---------- */
function saveGuess(){                               /* ★ patched */
  document.activeElement.blur();                    /* ★ confirma último selector */

  const w=$("wordInput").value.trim().toUpperCase();
  if(!/^[A-Z]{5}$/.test(w)){ alert("Enter a 5-letter word"); return; }
  if(!dictionary.includes(w) &&
     !confirm(`"${w}" is not in the English dictionary.\nContinue anyway?`)) return;

  const pat=[...$("colorSelects").children].map(sel=>+sel.value);
  history.push(w); patterns.push(pat);

  candidates = [];  cacheH = {}; version++;         /* ★ invalida lista y cachés */

  $("wordInput").value=""; buildColorSelectors();
  updateHist(); toggleCompareBtn();
}
function resetAll(){
  history=[]; patterns=[]; candidates=[]; cacheH={}; version=0;
  clearAll(); buildColorSelectors(); toggleCompareBtn();
}
function onSuggest(){
  if(!candidates.length) updateCandidates();
  renderAll(); toggleCompareBtn();
}

/* ---------- candidates & entropy ---------- */
function updateCandidates(){
  candidates = dictionary.filter(w=>
    patterns.every((p,i)=>patternKey(w,history[i])===p.join("")));
  buildRapido(); cacheH={};
}
function computeH(w){
  const c=cacheH[w]; if(c&&c.v===version) return c.h;
  if(!candidates.length) return 0;
  const m=new Map(); candidates.forEach(s=>{
    const k=patternKey(s,w); m.set(k,(m.get(k)||0)+1);
  });
  const n=candidates.length;
  const ss=[...m.values()].reduce((a,x)=>a+x*x,0);
  const h=n - ss/n;
  cacheH[w]={v:version,h}; return h;
}
const scorePenalty = w => [...knownSet()].reduce((p,ch)=>p+(w.includes(ch)?5:0),0);

/* ---------- render helpers ---------- */
function clearAll(){
  $("candCount").textContent="0";
  ["tblCands","tblDiscard","tblGreen","tblFreq"].forEach(id=>tbody(id).innerHTML="");
  $("history").textContent=""; $("compareArea").innerHTML="";
}
function clearResults(){
  ["tblCands","tblDiscard","tblGreen"].forEach(id=>tbody(id).innerHTML="");
  $("candCount").textContent="0";
}

/* ---------- render main lists ---------- */
function renderAll(){
  $("candCount").textContent=candidates.length;
  renderCandidates(); renderDiscard(); renderGreen(); renderFreq();
}
function renderCandidates(){
  const big=candidates.length>FAST_LIMIT;
  const list=candidates.slice().sort((a,b)=>
        big ? scoreRapido(b)-scoreRapido(a)
            : computeH(b)-computeH(a));
  const tb=tbody("tblCands"); tb.innerHTML="";
  list.forEach(w=>{
    const s = big ? scoreRapido(w).toFixed(2) : computeH(w).toFixed(2);
    tb.insertAdjacentHTML("beforeend",`<tr><td>${w}</td><td>${s}</td></tr>`);
  });
}

/* ---------- Best discard ---------- */
function renderDiscard(){
  const kn = knownSet();
  const allGray = kn.size===0;
  const pool = allGray ? candidates.slice()
                       : dictionary.filter(w=>!containsAny(w,kn));

  const big = candidates.length>FAST_LIMIT;
  const scoreFast = w => scoreRapido(w) - scorePenalty(w);
  const scoreSlow = w => computeH(w)   - scorePenalty(w);

  const list = pool.slice().sort((a,b)=>
        big ? scoreFast(b)-scoreFast(a)
            : scoreSlow(b)-scoreSlow(a));

  const tb=tbody("tblDiscard"); tb.innerHTML="";
  list.slice(0,20).forEach(w=>{
    const s = big ? scoreFast(w).toFixed(2) : scoreSlow(w).toFixed(3);
    tb.insertAdjacentHTML("beforeend",`<tr><td>${w}</td><td>${s}</td></tr>`);
  });
}

/* ---------- Green repetition ---------- */
const greenPos=()=>{const g=Array(5).fill(null);patterns.forEach((p,i)=>p.forEach((c,idx)=>{if(c===2)g[idx]=history[i][idx];}));return g;};
const isGreenRep=(w,g)=>g.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch));
function containsAny(w,set){ for(const ch of set) if(w.includes(ch)) return true; return false; }

function renderGreen(){
  const g=greenPos(); if(g.every(x=>!x)){ tbody("tblGreen").innerHTML=""; return; }
  const ySet=yellowSet();
  const big=candidates.length>FAST_LIMIT;
  const pool = dictionary.filter(w=>isGreenRep(w,g)&&!containsAny(w,ySet));
  const list = pool.slice().sort((a,b)=>
        big ? scoreRapido(b)-scoreRapido(a)
            : computeH(b)-computeH(a))
        .slice(0,20);

  const tb=tbody("tblGreen"); tb.innerHTML="";
  list.forEach(w=>{
    const s = big ? scoreRapido(w).toFixed(2) : computeH(w).toFixed(3);
    tb.insertAdjacentHTML("beforeend",`<tr><td>${w}</td><td>${s}</td></tr>`);
  });
}

/* ---------- Frequencies ---------- */
function renderFreq(){
  const rows=LETTERS.map(l=>({l,a:0,w:0,r:0}));
  for(const w of candidates){
    const seen={};
    for(const ch of w){
      const r=rows[LETTERS.indexOf(ch)]; r.a++;
      if(seen[ch]) r.r++; else { r.w++; seen[ch]=1; }
    }
  }
  rows.sort((x,y)=>y.w-x.w);
  const tb=tbody("tblFreq"); tb.innerHTML="";
  rows.forEach(r=>tb.insertAdjacentHTML("beforeend",
    `<tr><td>${r.l}</td><td>${r.a}</td><td>${r.w}</td><td>${r.r}</td></tr>`));
}

/* ---------- Compare (≤100) ---------- */
function toggleCompareBtn(){ $("tabCompare").disabled=candidates.length===0||candidates.length>100; }
function buildSelectionList(list, pre){
  let h='<p><strong>Select up to 25 words</strong> and press “Run comparison” again:</p>';
  h+='<div style="max-height:300px;overflow:auto;columns:140px auto;">';
  list.forEach(w=>h+=`<label style="display:block;"><input type="checkbox" class="selWord" value="${w}" ${pre?'checked':''}> ${w}</label>`);
  $("compareArea").innerHTML = h + "</div>";
}
function drawCompareTable(words){
  const n=words.length;if(!n){$("compareArea").textContent="No words";return;}
  const pat=words.map(g=>words.map(s=>patternKey(s,g)));
  const groupsCount=pat.map(row=>{const o={};row.forEach((p,i)=>(o[p]=o[p]||[]).push(i));return Object.keys(o).length;});
  const ord=words.map((w,i)=>({w,idx:i,opt:groupsCount[i]})).sort((a,b)=>b.opt-a.opt||a.w.localeCompare(b.w));
  const orderIdx=ord.map(o=>o.idx), maxOpt=ord[0].opt;
  let html='<table style="border-collapse:collapse;font-size:12px"><thead><tr><th></th>';
  ord.forEach(o=>{const isCand=candidates.includes(o.w);html+=`<th style="${isCand?'':'color:red;'}">${o.w}</th>`;});
  html+=`<th>options (${maxOpt})</th></tr></thead><tbody>`;
  ord.forEach(oRow=>{
    const extra=!candidates.includes(oRow.w);
    const style=extra?'color:red;':'';
    html+=`<tr><th style="${style}">${oRow.w}</th>`;
    const groups={};
    orderIdx.forEach((origIdx,visCol)=>{
      const p=pat[oRow.idx][origIdx]; (groups[p]=groups[p]||[]).push(visCol);
    });
    let c=0; Object.values(groups).forEach(g=>{if(g.length>1)g.clr=palette[c++%palette.length];});
    orderIdx.forEach((origIdx,visCol)=>{
      const p=pat[oRow.idx][origIdx], g=groups[p];
      const next=g.find(x=>x>visCol); const jump=next?next-visCol:0;
      const bg=g.clr||'#f2f2f2';
      html+=`<td style="text-align:center;background:${bg};${style}">${p}-${jump}</td>`;
    });
    html+=`<td style="text-align:center;font-weight:bold;${style}">${oRow.opt}</td></tr>`;
  });
  $("compareArea").innerHTML=html+'</tbody></table>';
}
function runCompare(){
  if(!compareSelectMode){
    if(candidates.length>100){alert("Too many candidates (max 100)");return;}
    buildSelectionList(candidates,candidates.length<=25);
    compareSelectMode=true; $("runCompare").textContent="Compare selected"; return;
  }
  const sel=[...document.querySelectorAll("#compareArea input.selWord:checked")].map(cb=>cb.value);
  if(!sel.length){alert("Select at least one word");return;}
  if(sel.length>25){alert("Max 25 words");return;}
  const extra=$("extraInput").value.toUpperCase().split(/[^A-Z]+/).filter(x=>x.length===5).slice(0,2);
  drawCompareTable([...sel,...extra]);
  compareSelectMode=false; $("runCompare").textContent="Run comparison";
}

/* ---------- Finder ---------- */
function runFinder(){
  const raw=$("lettersInput").value.toUpperCase().replace(/[^A-Z]/g,"");
  if(!raw){alert("Enter letters");return;}
  const letters=[...new Set(raw.split(""))]; if(letters.length>10){alert("Enter 1-10 letters");return;}
  const combos=(arr,k)=>{const out=[],rec=(s,a)=>{ if(a.length===k){out.push(a.slice());return;}
    for(let i=s;i<arr.length;i++){a.push(arr[i]);rec(i+1,a);a.pop();}};rec(0,[]);return out;};
  let results={};
  for(let k=letters.length;k>=1;k--){
    combos(letters,k).forEach(c=>{
      const hits=dictionary.filter(w=>c.every(l=>w.includes(l)));
      if(hits.length) results[c.join("")]=hits;});
    if(Object.keys(results).length) break;
  }
  const div=$("finderResults");
  div.innerHTML = Object.keys(results).length
    ? Object.entries(results).sort((a,b)=>b[0].length-a[0].length||a[0].localeCompare(b[0]))
        .map(([c,w])=>`<h4>Using ${c} (${w.length})</h4><pre style="white-space:pre-wrap">${w.join(", ")}</pre>`).join("")
    : "No words found";
}
