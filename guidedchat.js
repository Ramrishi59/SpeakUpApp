// =========================================
// Let Us Speak (AI-Lite) — Separate Route
// =========================================

// ---- Query helpers ----
function getQP(name, fallback=null){
    const u = new URL(location.href);
    return u.searchParams.get(name) ?? fallback;
  }
  const unitId    = getQP('unitId','unit4');     // default for quick testing
  const autostart = getQP('autostart','1') === '1';
  
  // ---- Elements ----
  const els = {
    title:   document.getElementById('gcTitle'),
    back:    document.getElementById('gcBack'),
    display: document.getElementById('gcDisplay'),
    img:     document.getElementById('gcImage'),
    text:    document.getElementById('gcText'),
    start:   document.getElementById('gcStart'),
    repeat:  document.getElementById('gcRepeat'),
    next:    document.getElementById('gcNext'),
    mic:     document.getElementById('gcMic'),
    round:   document.getElementById('gcRoundInfo'),
    note:    document.getElementById('gcSupportNote'),
    audio:   document.getElementById('sharedAudio')
  };
  
  // ---- Audio helpers ----
  function stopAudio(){
    try { els.audio.pause(); els.audio.currentTime = 0; } catch {}
  }
  async function playAudio(src){
    stopAudio();
    els.audio.muted = false;
    els.audio.src = src;
    try { await els.audio.play(); } catch {}
    return new Promise(res => els.audio.onended = () => res());
  }
  
  // ---- SR setup ----
  const SR_SUPPORTED = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!SR_SUPPORTED){
    els.note.textContent = "Speech recognition not supported on this device. You can still listen and repeat.";
  }
  
  function initSR(){
    if (!SR_SUPPORTED) return null;
    const C = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new C();
    rec.lang = 'en-GB'; rec.interimResults = false; rec.continuous = false; rec.maxAlternatives = 3;
    return rec;
  }
  
  function normalise(t){
    return (t||"").toLowerCase().replace(/[^\w\s']/g," ").replace(/\s+/g," ").trim();
  }
  function listenN(seconds=3){
    return new Promise((resolve)=>{
      if (!SR_SUPPORTED) return resolve(null);
      const rec = initSR(); if (!rec) return resolve(null);
      let final = "";
      rec.onresult = (e)=>{
        try { const r = e.results[e.results.length-1]; if (r && r[0]) final = r[0].transcript || ""; } catch {}
      };
      rec.onerror = ()=>{ els.mic.classList.add('hidden'); resolve(final||null); };
      rec.onend   = ()=>{ els.mic.classList.add('hidden'); resolve(final||null); };
      els.mic.classList.remove('hidden');
      const to = setTimeout(()=>{ try{rec.stop();}catch{} }, Math.max(1200, seconds*1000));
      try { rec.start(); } catch { clearTimeout(to); els.mic.classList.add('hidden'); resolve(final||null); }
    });
  }
  
  // ---- Keyword matcher for your JSON shape ----
  // groups = [ ["this","it’s","its"], ["cat","kitty"] ] → every group must match one word
  function matchesAnyKeyword(transcript, groups){
    if (!transcript || !groups || !groups.length) return false;
    const t = normalise(transcript);
    return groups.every(set => set.some(w => t.includes(w)));
  }
  
  function flash(ok){
    els.display.classList.remove('gc-correct','gc-retry');
    els.display.classList.add(ok ? 'gc-correct' : 'gc-retry');
    setTimeout(()=>els.display.classList.remove('gc-correct','gc-retry'), 650);
  }
  
  // ---- State ----
  let unitData = null;
  let gc = null;
  let idx = 0;
  
  // ---- UI wiring ----
  els.start.onclick = async ()=>{ idx = 0; await runSequence(); };
  els.repeat.onclick = async ()=>{ await runRound(idx); };
  els.next.onclick = async ()=>{
    if (!gc?.rounds) return;
    idx = Math.min(idx+1, gc.rounds.length-1);
    await runRound(idx);
  };
  
  // ---- Core flow ----
  async function runSequence(){
    lock(true);
    if (gc.introAudio) await playAudio(gc.introAudio);
    await runRound(0);
    lock(false);
  }
  
  async function runRound(i){
    if (!gc?.rounds || !gc.rounds[i]) return;
    lock(true);
  
    const round = gc.rounds[i];
  
    // Optional visual: show picture matching the *words* section (if you want).
    // If you keep it generic, hide image:
    els.img.src = ""; els.img.alt = "";
  
    els.text.textContent = `Round ${i+1} — Listen, speak, and check.`;
    els.round.textContent = `Round ${i+1} of ${gc.rounds.length}`;
  
    // Prompt → Listen → Judge → Feedback
    await playAudio(round.prompt);
    const heard = await listenN(3);
    const ok = matchesAnyKeyword(heard, round.keywordsAny);
    flash(ok);
    await playAudio(ok ? round.correct : round.retry);
  
    // Enable controls
    els.repeat.disabled = false;
    els.next.disabled   = (i >= gc.rounds.length-1);
    lock(false);
  
    // Auto-advance on correct (optional; keep it snappy)
    if (ok && i < gc.rounds.length-1){
      idx = i+1;
      setTimeout(()=>runRound(idx), 350);
    }
  }
  
  function lock(on){
    els.start.disabled  = on;
    els.repeat.disabled = on || (idx===0 && !gc); // keep sensible
    els.next.disabled   = on;
  }
  
  // ---- Load JSON and init ----
  (async function init(){
    // Route back link: assumes unit page is 'unit.html?unitId=...'. Change if needed.
    const backUrl = `old-index.html?unitId=${encodeURIComponent(unitId)}`;
    els.back.href = backUrl;
  
    // Load the unit JSON
    const url = `units/${unitId}.json`;
    document.getElementById('unitJsonPreload').href = url;
  
    try{
      const res = await fetch(url);
      unitData = await res.json();
    }catch(e){
      console.error("Failed to load unit JSON", e);
    }
  
    gc = unitData?.guidedChat || null;
    if (!gc){
      els.text.textContent = "This unit has no Guided Chat configured.";
      els.start.disabled = true;
      return;
    }
  
    // Title
    els.title.textContent = gc.title || "Let Us Speak";
    // Autostart if requested
    if (autostart){
      setTimeout(()=> els.start.click(), 350);
    }
  })();
  