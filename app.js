/* Quran Reels - app.js */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let W = canvas.width;
let H = canvas.height;

function updateCanvasSize() {
  const aspect = document.getElementById("aspect") ? document.getElementById("aspect").value : "9:16";
  let q = document.getElementById("quality") ? document.getElementById("quality").value : "1080";
  // 4K on phone exhausts the WebView heap (OOM crash) and produces broken
  // (tiny) files, so force 1080 there. Desktop keeps 4K.
  if (q === "2160" && window.AndroidBridge) q = "1080";
  const short = (q === "2160") ? 2160 : 1080;
  let w, h;
  if (aspect === "9:16") { w = short; h = Math.round(short * 16 / 9); }
  else if (aspect === "1:1") { w = short; h = short; }
  else if (aspect === "4:5") { w = short; h = Math.round(short * 5 / 4); }
  else if (aspect === "16:9") { w = Math.round(short * 16 / 9); h = short; }
  else { w = short; h = Math.round(short * 16 / 9); }
  canvas.width = w;
  canvas.height = h;
  W = canvas.width;
  H = canvas.height;
  const label = document.getElementById("aspectLabel");
  if (label) label.textContent = aspect;
  drawFrame();
}
const bgVideo = document.getElementById("bgVideo");

const surahSel = document.getElementById("surah");
const fromInput = document.getElementById("fromAyah");
const toInput = document.getElementById("toAyah");
const reciterSel = document.getElementById("reciter");
const fontSlider = document.getElementById("fontSize");
const fontVal = document.getElementById("fontSizeVal");
const transCb = document.getElementById("showTranslation");
if (transCb) { transCb.checked = true; transCb.disabled = true; }
const previewBtn = document.getElementById("previewBtn");
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const progressEl = document.getElementById("progress");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const downloadBtn = document.getElementById("downloadBtn");
const muteAudioCb = document.getElementById("muteAudio");
// Remember the user's choice across sessions. This only silences the room while
// recording; the exported file is never affected.
try {
  if (muteAudioCb) {
    muteAudioCb.checked = localStorage.getItem("ayat_mute_preview") === "1";
    muteAudioCb.addEventListener("change", () => {
      try { localStorage.setItem("ayat_mute_preview", muteAudioCb.checked ? "1" : "0"); } catch (e) {}
    });
  }
} catch (e) {}
let lastMime = "";
let stopRecordingCleanup = null;
let lastVideoUrl = null;
let lastBlob = null;
let activeSources = [];
let audioCtxRef = null;
// --- logo overlay state ---
let logoImg = null;
let logoEnabled = false;
let logoPos = "br";
let logoSize = 12;
let logoOpacity = 90;
let ayahStartTimes = [];
let ayahEndTime = 0;
let lastIdx = -1;

const pexelsKeyInput = document.getElementById("pexelsKey");
const pexelsQueryInput = document.getElementById("pexelsQuery");
const pexelsBtn = document.getElementById("pexelsBtn");
const pexelsVideoSel = document.getElementById("pexelsVideo");

function proxyUrl(url) {
  // Packaged Android app (file://): fetch directly.
  if (typeof location !== "undefined" && (location.protocol === "file:" || location.hostname === "")) {
    return url;
  }
  const enc = encodeURIComponent(url);
  // One portable path for every host we ship to:
  //   Netlify          → netlify.toml / _redirects → netlify/functions/proxy
  //   Cloudflare Pages → functions/proxy.js
  //   Local dev server → proxy.py
  // GitHub Pages has no serverless runtime; the direct CDN fetch above is
  // used instead (everyayah.com sends CORS headers).
  return "/proxy?url=" + enc;
}

function ensureAudioCtx() {
  if (!window.__ayatAudioCtx || window.__ayatAudioCtx.state === "closed") {
    const AC = window.AudioContext || window.webkitAudioContext;
    window.__ayatAudioCtx = new AC();
  }
  return window.__ayatAudioCtx;
}

let surahs = [];
let ayahs = [];
let currentIdx = 0;
let playing = false;
let fontSize = 46;
let bgVideoUrl = "";
let pexelsVideos = [];

const TEMPLATES = [
  { id:"sakina", name:"سكينة", accent:"#d4af37", text:"#f5f0e6", sub:"#bfe3c8", bg1:"#0b3d2e", bg2:"#052018", font:"'Amiri Quran',serif" },
  { id:"mushaf", name:"مصحف", accent:"#8b5a2b", text:"#1a1400", sub:"#5a3e1b", bg1:"#f5ebd2", bg2:"#e8d5b5", font:"'Amiri Quran',serif" },
  { id:"layli", name:"ليلي", accent:"#f1c40f", text:"#ffffff", sub:"#c9c9c9", bg1:"#0a0a14", bg2:"#000000", font:"'Amiri',serif" },
  { id:"talween", name:"تلوين", accent:"#22c55e", text:"#ffffff", sub:"#bbf7d0", bg1:"#052e16", bg2:"#022c22", font:"'Noto Naskh Arabic',sans-serif" },
  { id:"zakhrafa", name:"زخرفة", accent:"#e879f9", text:"#fdf4ff", sub:"#f5d0fe", bg1:"#3b0764", bg2:"#1e1b4b", font:"'Amiri',serif" },
  { id:"glass", name:"بطاقة زجاجية", accent:"#38bdf8", text:"#ffffff", sub:"#bae6fd", bg1:"#0c4a6e", bg2:"#082f49", font:"'Noto Naskh Arabic',sans-serif" },
  { id:"wide", name:"عريض 16:9", accent:"#f97316", text:"#ffffff", sub:"#fed7aa", bg1:"#7c2d12", bg2:"#431407", font:"'Amiri',serif" },
  { id:"kinetic", name:"كلمة كبيرة", accent:"#ef4444", text:"#ffffff", sub:"#fecaca", bg1:"#450a0a", bg2:"#1c0a0a", font:"'Amiri Quran',serif" },
  { id:"mihrab", name:"محراب", accent:"#10b981", text:"#ecfdf5", sub:"#a7f3d0", bg1:"#064e3b", bg2:"#022c22", font:"'Amiri',serif" },
  { id:"fajr", name:"فجر", accent:"#fbbf24", text:"#fff7ed", sub:"#fde68a", bg1:"#78350f", bg2:"#451a03", font:"'Noto Naskh Arabic',sans-serif" },
  { id:"montage", name:"مشهد متتابع", accent:"#a855f7", text:"#faf5ff", sub:"#e9d5ff", bg1:"#3b0764", bg2:"#1e1b4b", font:"'Amiri',serif" },
  { id:"minimal", name:"بسيط فاخر", accent:"#64748b", text:"#0f172a", sub:"#475569", bg1:"#f8fafc", bg2:"#e2e8f0", font:"'Noto Naskh Arabic',sans-serif" },
  { id:"mood", name:"مزاج سينمائي", accent:"#f43f5e", text:"#fff1f2", sub:"#fecdd3", bg1:"#4c0519", bg2:"#1f0a0a", font:"'Amiri',serif" },
  { id:"modern", name:"عصري بسيط", accent:"#06b6d4", text:"#ecfeff", sub:"#a5f3fc", bg1:"#083344", bg2:"#042f2e", font:"'Noto Naskh Arabic',sans-serif" },
  { id:"editorial", name:"حميمي تحريري", accent:"#d97706", text:"#fffbeb", sub:"#fde68a", bg1:"#451a03", bg2:"#1c0a00", font:"'Amiri',serif" },
  { id:"gold", name:"ذهبي تقليدي", accent:"#d4af37", text:"#1a1400", sub:"#8b6914", bg1:"#faf3dc", bg2:"#e8d5a0", font:"'Amiri Quran',serif" },
];

// Reciter id → everyayah.com folder (per-ayah MP3, CORS enabled)
const RECITER_FOLDERS = {
  "ar.alafasy": "Alafasy_128kbps",
  "ar.abdurrahmaansudais": "Abdurrahmaan_As-Sudais_192kbps",
  "ar.saud_ash_shuraim": "Saood_ash-Shuraym_128kbps",
  "ar.yasseradossari": "Yasser_Ad-Dussary_128kbps",
  "ar.abdulbasitmurattal": "Abdul_Basit_Murattal_192kbps",
  "ar.husary": "Husary_128kbps",
  "ar.minshawi": "Minshawy_Murattal_128kbps",
  "ar.mahermuaiqly": "MaherAlMuaiqly128kbps",
  "ar.ahmedajamy": "Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net",
  "ar.abdulsamad": "Abdul_Basit_Mujawwad_128kbps",
  "ar.ghamdi": "Ghamadi_40kbps",
};

fontSlider.addEventListener("input", () => {
  fontSize = +fontSlider.value;
  fontVal.textContent = fontSize;
  drawFrame();
});

// --- logo overlay wiring ---
const logoFileInput = document.getElementById("logoFile");
const logoEnabledCb = document.getElementById("logoEnabled");
const logoPosSel = document.getElementById("logoPos");
const logoSizeSlider = document.getElementById("logoSize");
const logoSizeVal = document.getElementById("logoSizeVal");
const logoOpacitySlider = document.getElementById("logoOpacity");
const logoOpacityVal = document.getElementById("logoOpacityVal");

if (logoFileInput) {
  logoFileInput.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => { logoImg = img; logoEnabled = true; if (logoEnabledCb) logoEnabledCb.checked = true; drawFrame(); };
      img.onerror = () => { setStatus("تعذّر تحميل الشعار."); };
      img.src = String(r.result);
    };
    r.readAsDataURL(f);
  });
}

// Java-side logo delivery (Android WebView): file picker returns a content URI
// that FileReader cannot read reliably, so MainActivity reads the file and
// hands us a base64 data URL through this callback.
window.onLogoPicked = (b64, mime) => {
  if (!b64) return;
  const img = new Image();
  img.onload = () => { logoImg = img; logoEnabled = true; if (logoEnabledCb) logoEnabledCb.checked = true; drawFrame(); setStatus("تم تحميل الشعار."); };
  img.onerror = () => { setStatus("تعذّر تحميل الشعار."); };
  img.src = "data:" + (mime || "image/png") + ";base64," + b64;
};

// In the Android app the native chooser is used; skip the (unreliable) FileReader
// path there to avoid double-loading.
if (window.AndroidBridge && logoFileInput) {
  logoFileInput.addEventListener("change", (e) => {
    // Native onLogoPicked will fire; if it doesn't within 2s, try FileReader.
    setTimeout(() => {
      const f = e.target.files && e.target.files[0];
      if (!f || logoImg) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => { logoImg = img; logoEnabled = true; if (logoEnabledCb) logoEnabledCb.checked = true; drawFrame(); };
        img.src = String(r.result);
      };
      r.readAsDataURL(f);
    }, 2000);
  });
}
const logoUrlInput = document.getElementById("logoUrl");
if (logoUrlInput) {
  const loadFromUrl = () => {
    const u = logoUrlInput.value.trim();
    if (!u) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { logoImg = img; logoEnabled = true; if (logoEnabledCb) logoEnabledCb.checked = true; drawFrame(); setStatus("تم تحميل الشعار."); };
    img.onerror = () => { setStatus("تعذّر تحميل الشعار من الرابط (CORS؟)."); };
    img.src = u;
  };
  logoUrlInput.addEventListener("change", loadFromUrl);
  logoUrlInput.addEventListener("blur", loadFromUrl);
}

if (logoEnabledCb) logoEnabledCb.addEventListener("change", () => { logoEnabled = logoEnabledCb.checked; drawFrame(); });
if (logoPosSel) logoPosSel.addEventListener("change", () => { logoPos = logoPosSel.value; drawFrame(); });
if (logoSizeSlider) logoSizeSlider.addEventListener("input", () => { logoSize = +logoSizeSlider.value; if (logoSizeVal) logoSizeVal.textContent = logoSize; drawFrame(); });
if (logoOpacitySlider) logoOpacitySlider.addEventListener("input", () => { logoOpacity = +logoOpacitySlider.value; if (logoOpacityVal) logoOpacityVal.textContent = logoOpacity; drawFrame(); });

pexelsVideoSel.addEventListener("change", () => {
  bgVideoUrl = pexelsVideoSel.value;
  bgLast.width = 0;
  bgLast.height = 0;
  if (bgVideoUrl) {
    // Pexels CDN sends CORS headers, so load directly: keeps the canvas untainted
    // and avoids serverless response-size limits for large videos.
    bgVideo.src = bgVideoUrl;
    bgVideo.preload = "auto";
    bgVideo.load();
    ensureBgReady().then((ok) => {
      if (!ok) setStatus("تعذّر تحميل فيديو Pexels — جرّب فيديو آخر أو خفّض الجودة.");
      else setStatus("خلفية الفيديو جاهزة.");
      drawFrame();
    });
  } else {
    bgVideo.pause();
    bgVideo.removeAttribute("src");
    bgVideo.load();
    setStatus("تم إلغاء خلفية الفيديو.");
  }
  drawFrame();
});

pexelsBtn.addEventListener("click", async () => {
  const key = pexelsKeyInput.value.trim();
  const q = pexelsQueryInput.value.trim() || "nature";
  if (!key) { setStatus("أدخل Pexels API Key."); return; }
  setStatus("جاري جلب فيديوهات Pexels...");
  try {
    const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=12&orientation=portrait`, {
      headers: { Authorization: key }
    });
    if (!res.ok) throw new Error("Pexels: " + res.status);
    const json = await res.json();
    const vids = json.videos || [];
    pexelsVideos = vids;
    // build options: for each video pick best mp4
    const opts = ['<option value="">— لا يوجد (استخدم التدرج) —</option>'];
    vids.forEach((v, idx) => {
      const file = pickVideoFile(v);
      if (file) {
        opts.push(`<option value="${file}">فيديو ${idx + 1} (${v.width}x${v.height})</option>`);
      }
    });
    pexelsVideoSel.innerHTML = opts.join("");
    setStatus(`تم جلب ${vids.length} فيديو. اختر واحداً.`);
  } catch (e) {
    setStatus("خطأ Pexels: " + e.message);
  }
});

function pickVideoFile(v) {
  const mp4s = (v.video_files || []).filter(f => f.file_type === "video/mp4" && f.link);
  if (!mp4s.length) return null;
  const portrait = mp4s.filter(f => (f.height || 0) >= (f.width || 0));
  const pool = (portrait.length ? portrait : mp4s)
    .slice()
    .sort((a, b) => (a.height || 0) - (b.height || 0));
  // The biggest source is usually 4K and tens of megabytes: it cannot be
  // buffered faster than it plays, so the background stalls. On phones 720p is
  // plenty (the canvas is 1080 wide and the clip is darkened anyway).
  const mobile = !!(window.AndroidBridge || (window.matchMedia && window.matchMedia("(max-width: 820px)").matches));
  const target = mobile ? 1280 : 1920;
  const pick = pool.find(f => (f.height || 0) >= target) || pool[pool.length - 1];
  return pick.link;
}

// Wait until the clip can play without an immediate stall (canplay = enough
// decoded data, not just metadata like "loadedmetadata").
function ensureBgReady() {
  if (!bgVideoUrl) return Promise.resolve(true);
  bgVideo.preload = "auto";
  if (bgVideo.readyState >= 3) return Promise.resolve(true);
  setStatus("جاري تحميل خلفية الفيديو...");
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      bgVideo.removeEventListener("canplay", onOk);
      bgVideo.removeEventListener("canplaythrough", onOk);
      bgVideo.removeEventListener("error", onErr);
      resolve(ok);
    };
    const onOk = () => finish(true);
    const onErr = () => finish(false);
    const timer = setTimeout(() => finish(bgVideo.readyState >= 2), 20000);
    bgVideo.addEventListener("canplay", onOk);
    bgVideo.addEventListener("canplaythrough", onOk);
    bgVideo.addEventListener("error", onErr);
    try { bgVideo.play().catch(() => {}); } catch (e) {}
  });
}

function setStatus(msg) { statusEl.textContent = msg; }

async function loadSurahs() {
  setStatus("جاري تحميل قائمة السور...");
  const res = await fetch("https://api.alquran.cloud/v1/surah");
  const json = await res.json();
  surahs = json.data;
  surahSel.innerHTML = surahs.map(s =>
    `<option value="${s.number}">${s.number}. ${s.name} — ${s.englishName}</option>`
  ).join("");
  surahSel.value = "1";
  updateAyahRange();
  setStatus("جاهز.");
}

surahSel.addEventListener("change", updateAyahRange);
function updateAyahRange() {
  const s = surahs.find(x => x.number == surahSel.value);
  if (!s) return;
  fromInput.max = s.numberOfAyahs;
  toInput.max = s.numberOfAyahs;
  toInput.value = Math.min(+toInput.value || 7, s.numberOfAyahs);
  fromInput.value = Math.min(+fromInput.value || 1, s.numberOfAyahs);
}

async function fetchAyahs(withAudio, audioCtxIn) {
  const surahNum = surahSel.value;
  const from = Math.max(1, +fromInput.value);
  const to = Math.min(+toInput.value, 9999);
  if (from > to) throw new Error("نطاق الآيات غير صحيح");
  setStatus("جاري تحميل الآيات...");
  const textUrl = `https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`;
  const trUrl = `https://api.alquran.cloud/v1/surah/${surahNum}/en.sahih`;
  const ress = await Promise.all([fetch(textUrl), fetch(trUrl)]);
  const tJson = await ress[0].json();
  const trJson = await ress[1].json();
  const tAyahs = tJson.data.ayahs;
  const trAyahs = trJson.data.ayahs;
  const folder = RECITER_FOLDERS[reciterSel.value] || "Alafasy_128kbps";
  const pad3 = (n) => String(n).padStart(3, "0");
  const slice = [];
  for (let i = from - 1; i < to && i < tAyahs.length; i++) {
    const ayahNo = tAyahs[i].numberInSurah;
    slice.push({
      number: ayahNo,
      text: tAyahs[i].text,
      // everyayah.com serves per-ayah MP3s with CORS enabled.
      audio: `https://everyayah.com/data/${folder}/${pad3(surahNum)}${pad3(ayahNo)}.mp3`,
      translation: trAyahs[i].text,
    });
  }
  if (slice.length === 0) throw new Error("لا توجد آيات");
  if (withAudio) {
    setStatus("جاري تحميل ملفات الصوت...");
    const audioCtx = audioCtxIn || new (window.AudioContext || window.webkitAudioContext)();
    const buffers = [];
    for (let i = 0; i < slice.length; i++) {
      setStatus(`تحميل صوت ${i + 1}/${slice.length}...`);
      const buf = await fetchAudioBuffer(audioCtx, slice[i].audio);
      buffers.push(buf);
    }
    return { slice, buffers, audioCtx };
  }
  return { slice };
}

async function fetchAudioBuffer(ctx, url) {
  let res = null;
  try {
    res = await fetch(url);
  } catch (e) {
    res = null;
  }
  if (!res || !res.ok) {
    // Fallback: some networks block the CDN directly; go through our proxy.
    try { res = await fetch(proxyUrl(url)); } catch (e) { res = null; }
  }
  if (!res || !res.ok) throw new Error("audio fetch " + (res ? res.status : "network"));
  const arr = await res.arrayBuffer();
  const buf = await ctx.decodeAudioData(arr);
  return trimSilence(buf, ctx);
}

function trimSilence(buffer, ctx, threshold = 0.012, pad = 0.04) {
  const ch = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  // find first/last sample above threshold (any channel)
  let start = 0;
  let end = len - 1;
  // scan from start
  outer: for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      if (Math.abs(buffer.getChannelData(c)[i]) > threshold) { start = i; break outer; }
    }
  }
  outer2: for (let i = len - 1; i >= 0; i--) {
    for (let c = 0; c < ch; c++) {
      if (Math.abs(buffer.getChannelData(c)[i]) > threshold) { end = i; break outer2; }
    }
  }
  // add padding
  const padSamples = Math.floor(pad * sr);
  start = Math.max(0, start - padSamples);
  end = Math.min(len - 1, end + padSamples);
  const newLen = end - start + 1;
  if (newLen <= 0 || newLen === len) return buffer;
  const newBuf = ctx.createBuffer(ch, newLen, sr);
  for (let c = 0; c < ch; c++) {
    const src = buffer.getChannelData(c);
    const dst = newBuf.getChannelData(c);
    for (let i = 0; i < newLen; i++) dst[i] = src[start + i];
  }
  return newBuf;
}

function wrapText(text, maxWidth, font) {
  ctx.font = font;
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function getTpl() {
  const sel = document.getElementById("tplSelect");
  const id = sel ? sel.value : "sakina";
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}

let bgLast = document.createElement("canvas");
let bgLastCtx = bgLast.getContext("2d");

function drawVideoCover(v, target) {
  const vRatio = v.videoWidth / v.videoHeight;
  const cRatio = W / H;
  let dw, dh, dx, dy;
  if (vRatio > cRatio) {
    dh = H; dw = H * vRatio; dx = (W - dw) / 2; dy = 0;
  } else {
    dw = W; dh = W / vRatio; dx = 0; dy = (H - dh) / 2;
  }
  target.drawImage(v, dx, dy, dw, dh);
}

function drawBackground() {
  if (bgVideoUrl && bgVideo.readyState >= 2 && bgVideo.videoWidth > 0) {
    drawVideoCover(bgVideo, ctx);
    // Cache the last decoded frame, but only when a new frame actually arrived —
    // copying 1080x1920 every frame doubled the decode load and made the app
    // heavy. The cache is only needed to bridge buffering dips.
    if (bgLast.width !== W || bgLast.height !== H) { bgLast.width = W; bgLast.height = H; }
    if (bgLast.lastT !== bgVideo.currentTime) {
      bgLast.lastT = bgVideo.currentTime;
      bgLastCtx.setTransform(1, 0, 0, 1, 0, 0);
      bgLastCtx.clearRect(0, 0, W, H);
      drawVideoCover(bgVideo, bgLastCtx);
    }
  } else if (bgVideoUrl && bgLast.width === W && bgLast.height === H) {
    ctx.drawImage(bgLast, 0, 0);
  } else {
    const t = getTpl();
    const g = ctx.createLinearGradient(0, 0, H, 0);
    g.addColorStop(0, t.bg1);
    g.addColorStop(1, t.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, W, H);
}

function drawFrame() {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.direction = "rtl";

  if (playing && audioCtxRef && ayahStartTimes.length) {
    const now = audioCtxRef.currentTime;
    let i = 0;
    for (let k = 0; k < ayahStartTimes.length; k++) {
      if (now >= ayahStartTimes[k]) i = k; else break;
    }
    if (i !== currentIdx) {
      currentIdx = i;
      if (ayahs.length) {
        setStatus(`تسجيل... آية ${i + 1}/${ayahs.length}`);
        progressEl.style.width = `${((i + 1) / ayahs.length) * 100}%`;
      }
    }
  }
  drawBackground();
  drawTextLayer();
  drawLogo();
}

const textCanvas = document.createElement("canvas");
const textCtx = textCanvas.getContext("2d");
let textKey = "";

// Word currently being recited (word-by-word sync) or -1.
function currentHighlight() {
  if (!(playing && audioCtxRef && ayahStartTimes.length && ayahs.length)) return -1;
  const el = document.getElementById("wordSync");
  if (!el || !el.checked) return -1;
  const idx = Math.max(0, Math.min(currentIdx, ayahs.length - 1));
  const words = ayahs[idx].text.split(/\s+/).filter(Boolean);
  const st = ayahStartTimes[idx] || 0;
  const en = ayahStartTimes[idx + 1] || ayahEndTime;
  const dur = Math.max(0.1, en - st);
  const prog = Math.min(0.999, Math.max(0, (audioCtxRef.currentTime - st) / dur));
  return Math.floor(prog * words.length);
}

// The ayah text is identical on almost every frame, yet it was re-laid-out,
// re-measured and re-drawn (with a blur shadow) 60 times a second next to a
// decoding video. That alone caps the encoder on phones and shows up as a
// stuttering/stopped background. Paint it once, then blit the bitmap.
function drawTextLayer() {
  if (textCanvas.width !== W || textCanvas.height !== H) {
    textCanvas.width = W;
    textCanvas.height = H;
    textKey = "";
  }
  const tpl = getTpl();
  const hi = currentHighlight();
  const key = [currentIdx, hi, tpl.id, fontSize, transCb.checked ? 1 : 0,
               surahSel.value, ayahs.length, W, H].join("|");
  if (key !== textKey) {
    textCtx.setTransform(1, 0, 0, 1, 0, 0);
    textCtx.clearRect(0, 0, W, H);
    renderText(textCtx, tpl, hi);
    textKey = key;
  }
  ctx.drawImage(textCanvas, 0, 0);
}

function drawLogo() {
  if (!logoImg || !logoEnabled) return;
  const ratio = logoImg.height / logoImg.width || 1;
  const size = Math.max(40, Math.round(W * (logoSize / 100)));
  const pad = Math.round(W * 0.04);
  let x = pad, y = pad;
  switch (logoPos) {
    case "tr": x = W - size - pad; y = pad; break;
    case "bl": x = pad; y = H - size * ratio - pad; break;
    case "br": x = W - size - pad; y = H - size * ratio - pad; break;
    case "center": x = (W - size) / 2; y = (H - size * ratio) / 2; break;
    default: x = pad; y = pad; break;
  }
  ctx.globalAlpha = Math.max(0.1, Math.min(1, logoOpacity / 100));
  ctx.drawImage(logoImg, x, y, size, size * ratio);
  ctx.globalAlpha = 1;
}

function renderText(c, tpl, hiIndex) {
  c.direction = "rtl";
  const t = { bg1: tpl.bg1, bg2: tpl.bg2, accent: tpl.accent, text: tpl.text, sub: tpl.sub };
  // header surah name
  const s = surahs.find(x => x.number == surahSel.value);
  if (s) {
    c.fillStyle = t.accent;
    c.font = "bold 44px 'Amiri', serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(s.name, W / 2, 120);
    c.fillStyle = t.sub;
    c.font = "26px 'Tajawal', sans-serif";
    c.fillText(s.englishName, W / 2, 170);
  }

  const padX = 80;
  const maxW = W - padX * 2;
  let y = 300;
  const lineH = fontSize * 1.6;
  c.textAlign = "center";
  c.textBaseline = "top";

  if (ayahs.length) {
    const idx = Math.max(0, Math.min(currentIdx, ayahs.length - 1));
    const a = ayahs[idx];
    const words = a.text.split(/\s+/).filter(Boolean);
    // measure block height for vertical centering
    const font = `${fontSize}px 'Amiri Quran', 'Scheherazade New', 'Amiri', serif`;
    c.font = font;
    const lines = wrapText(a.text, maxW, font);
    let blockH = lines.length * lineH + 40;
    if (transCb.checked) {
      c.font = `26px 'Noto Naskh Arabic', 'Tajawal', sans-serif`;
      const trLines = wrapText(a.translation, maxW, `26px 'Noto Naskh Arabic', 'Tajawal', sans-serif`);
      blockH += trLines.length * 34 + 16;
    }
    y = Math.max(320, (H - blockH) / 2);

    // text shadow for readability
    c.shadowColor = "rgba(0,0,0,0.55)";
    c.shadowBlur = 12;
    c.shadowOffsetX = 0;
    c.shadowOffsetY = 4;

    // Word-by-word sync

    // Layout words into lines (logical order)
    c.font = `${fontSize}px ${tpl.font}`;
    const wordLines = [];
    let curLine = [];
    let curW = 0;
    for (const w of words) {
      const ww = c.measureText(w + " ").width;
      if (curW + ww > maxW && curLine.length) {
        wordLines.push(curLine);
        curLine = [w];
        curW = ww;
      } else {
        curLine.push(w);
        curW += ww;
      }
    }
    if (curLine.length) wordLines.push(curLine);

    c.textAlign = "left";
    c.direction = "ltr";
    c.shadowColor = "rgba(0,0,0,0.55)";
    c.shadowBlur = 12;
    c.shadowOffsetX = 0;
    c.shadowOffsetY = 4;

    let wi = 0;
    // global logical index counter per line
    for (const ln of wordLines) {
      // measure total width
      const widths = ln.map(w => c.measureText(w).width);
      const spaceW = c.measureText(" ").width;
      const total = widths.reduce((a, b) => a + b, 0) + (ln.length - 1) * spaceW;
      let x = (W - total) / 2;
      // draw in visual order (reverse for Arabic)
      const logicalIndices = ln.map((_, i) => wi + i);
      for (let i = ln.length - 1; i >= 0; i--) {
        const w = ln[i];
        const isHi = (logicalIndices[i] === hiIndex);
        c.fillStyle = isHi ? t.accent : t.text;
        c.font = isHi ? `bold ${fontSize}px ${tpl.font}` : `${fontSize}px ${tpl.font}`;
        c.fillText(w, x, y);
        x += widths[i] + spaceW;
      }
      wi += ln.length;
      y += lineH;
    }
    c.shadowBlur = 0;
    c.textAlign = "center";

    c.fillStyle = "#FFD700";
    c.font = `bold 34px 'Tajawal', sans-serif`;
    c.shadowColor = "rgba(0,0,0,0.6)";
    c.shadowBlur = 6;
    c.fillText(`-${a.number}-`, W / 2, y + 8);
    c.shadowBlur = 0;
    y += 46;

    if (transCb.checked) {
      c.fillStyle = t.sub;
      c.font = `26px 'Noto Naskh Arabic', 'Tajawal', sans-serif`;
      const trLines = wrapText(a.translation, maxW, `26px 'Noto Naskh Arabic', 'Tajawal', sans-serif`);
      for (const ln of trLines) {
        c.fillText(ln, W / 2, y);
        y += 34;
      }
    }
  }

}

prevBtn.addEventListener("click", () => {
  if (playing) return;
  if (currentIdx > 0) { currentIdx--; drawFrame(); }
});
nextBtn.addEventListener("click", () => {
  if (playing) return;
  if (currentIdx < ayahs.length - 1) { currentIdx++; drawFrame(); }
});

/* ---------- Listen to the recitation (no recording) ---------- */
const listenBtn = document.getElementById("listenBtn");
let listenTimer = null;

function stopListening() {
  playing = false;
  if (listenTimer) { clearTimeout(listenTimer); listenTimer = null; }
  activeSources.forEach((s) => { try { s.stop(); } catch (e) {} });
  activeSources = [];
  audioCtxRef = null;
  if (listenBtn) listenBtn.textContent = "استماع";
  drawFrame();
  prevBtn.disabled = ayahs.length <= 1;
  nextBtn.disabled = ayahs.length <= 1;
}

listenBtn.addEventListener("click", async () => {
  if (recording) { setStatus("أوقف التسجيل أولاً."); return; }
  if (playing) { stopListening(); return; }
  try {
    const ac = ensureAudioCtx();
    try { if (ac.state === "suspended") ac.resume(); } catch (e) {}
    const { slice, buffers } = await fetchAyahs(true, ac);
    ayahs = slice;
    currentIdx = 0;
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    playing = true;
    audioCtxRef = ac;
    ayahStartTimes = [];
    activeSources = [];
    let t = ac.currentTime + 0.1;
    buffers.forEach((buf) => {
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(ac.destination);
      src.start(t);
      activeSources.push(src);
      ayahStartTimes.push(t);
      t += buf.duration;
    });
    ayahEndTime = t;
    listenBtn.textContent = "إيقاف الاستماع";
    const tick = () => {
      if (!playing) return;
      drawFrame();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    listenTimer = setTimeout(stopListening, (ayahEndTime - ac.currentTime) * 1000 + 250);
    setStatus("يتم تشغيل التلاوة…");
  } catch (e) {
    setStatus("خطأ: " + e.message);
    playing = false;
  }
});

previewBtn.addEventListener("click", async () => {
  try {
    const { slice } = await fetchAyahs(false);
    ayahs = slice;
    currentIdx = 0;
    playing = false;
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    drawFrame();
    recordBtn.disabled = false;
    prevBtn.disabled = ayahs.length <= 1;
    nextBtn.disabled = ayahs.length <= 1;
    setStatus("معاينة جاهزة. اضغط «تسجيل ريل».");
  } catch (e) {
    setStatus("خطأ: " + e.message);
  }
});


/* ----------------------- encoder health / format picker --------------------- */

// MP4 (H.264/AAC) first — best for YouTube. WebM stays as the fallback because
// some Android WebView builds report MP4 support but then emit a broken file
// of a few kilobytes. Every candidate is probed before a real take, and the
// recorded file is measured afterwards, so a corrupt export is impossible to
// mistake for a good one.
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function badMimes() {
  if (!(window.__ayatBadMimes instanceof Set)) window.__ayatBadMimes = new Set();
  return window.__ayatBadMimes;
}

function nextFallbackMime(mime) {
  if (mime && mime.indexOf("mp4") !== -1) {
    for (const m of ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"]) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
  }
  return null;
}

// Records ~0.7s of a tiny animated canvas with the requested codec and checks
// that actual bytes came out. Engines that claim support but cannot encode fail
// here instead of after a 40-second take.
async function probeMime(mime) {
  let stream = null;
  let osc = null;
  try {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 284;
    const g = c.getContext("2d");
    stream = c.captureStream(15);

    const ac = ensureAudioCtx();
    const dest = ac.createMediaStreamDestination();
    osc = ac.createOscillator();
    const gain = ac.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    const track = dest.stream.getAudioTracks()[0];
    if (track) stream.addTrack(track);

    const chunks = [];
    const rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 400000,
      audioBitsPerSecond: 64000,
    });
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve) => { rec.onstop = resolve; });
    rec.start(120);
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const dt = performance.now() - t0;
        g.fillStyle = "hsl(" + ((dt * 0.4) % 360) + ", 80%, 50%)";
        g.fillRect(0, 0, c.width, c.height);
        if (dt < 700) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    try { rec.stop(); } catch (e) {}
    await stopped;
    const size = chunks.reduce((n, b) => n + b.size, 0);
    return size > 3000;
  } catch (e) {
    return false;
  } finally {
    try { if (osc) osc.stop(); } catch (e) {}
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
  }
}

async function pickMimeType() {
  const skipped = badMimes();
  const order = [];
  const push = (m) => {
    if (m && order.indexOf(m) === -1 && !skipped.has(m) && MediaRecorder.isTypeSupported(m)) {
      order.push(m);
    }
  };
  push(window.__ayatPreferredMime);
  let cached = null;
  try { cached = localStorage.getItem("ayat_mime_v2"); } catch (e) {}
  push(cached);
  MIME_CANDIDATES.forEach(push);

  if (!order.length) throw new Error("لا يوجد مُرمِّز فيديو مدعوم على هذا الجهاز");
  if (cached && order[0] === cached) return cached; // already proven on a past take

  for (const m of order) {
    setStatus("فحص مُرمِّز الفيديو…");
    if (await probeMime(m)) {
      try { localStorage.setItem("ayat_mime_v2", m); } catch (e) {}
      return m;
    }
    skipped.add(m);
  }
  throw new Error("فشل فحص كل مُرمِّزات الفيديو على هذا الجهاز");
}

function handleBrokenExport(mime, size, durSec) {
  const next = nextFallbackMime(mime);
  if (next && !window.__ayatAutoRetry) {
    window.__ayatAutoRetry = true;
    window.__ayatPreferredMime = next;
    badMimes().add(mime);
    try { localStorage.removeItem("ayat_mime_v2"); } catch (e) {}
    setStatus("فشل الترميز (" + Math.max(1, Math.round(size / 1024)) + " KB) — إعادة المحاولة تلقائياً بصيغة WebM…");
    setTimeout(async () => {
      try {
        const ac = ensureAudioCtx();
        try { if (ac.state === "suspended") ac.resume(); } catch (e) {}
        await startRecording(ac);
      } catch (e) {
        setStatus("تعذّر التصدير: " + e.message);
      }
    }, 900);
    return;
  }
  window.__ayatAutoRetry = false;
  setStatus("⚠️ تعذّر تصدير فيديو صالح على هذا الجهاز (" + Math.round(size / 1024) + " KB). "
    + "جرّب جودة 1080p أو مدة أقصر أو تحديث Android WebView.");
}

let recorder = null;
let recording = false;

recordBtn.addEventListener("click", async () => {
  if (recording) return;
  window.__ayatAutoRetry = false;
  // Unlock audio synchronously, while the click still counts as a user gesture.
  // Awaiting the network first loses that activation and leaves the AudioContext
  // suspended — the exported video then plays but is completely silent.
  const ac = ensureAudioCtx();
  try { if (ac.state === "suspended") ac.resume(); } catch (e) {}
  try {
    const silent = ac.createBuffer(1, 1, ac.sampleRate);
    const s = ac.createBufferSource();
    s.buffer = silent;
    s.connect(ac.destination);
    s.start(0);
  } catch (e) {}
  try {
    await startRecording(ac);
  } catch (e) {
    setStatus("خطأ: " + e.message);
    console.error(e);
    activeSources.forEach((src) => { try { src.stop(); } catch (x) {} });
    activeSources = [];
    try { ac.close(); } catch (x) {}
    if (window.__ayatAudioCtx === ac) window.__ayatAudioCtx = null;
    recording = false;
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  }
});

stopBtn.addEventListener("click", () => {
  if (stopRecordingCleanup) {
    stopRecordingCleanup();
  } else if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }
});

// The download button is the single place the file is saved. In the Android
// WebView a blob: URL cannot be downloaded, so hand the bytes to the bridge.
downloadBtn.addEventListener("click", () => {
  if (!lastBlob) { setStatus("لا يوجد فيديو للحفظ."); return; }
  if (lastBlob.size < 30000) {
    setStatus("الملف تالف (أقل من 30 KB) — أعد التسجيل.");
    return;
  }
  const ext = lastMime.indexOf("mp4") !== -1 ? "mp4" : "webm";
  const name = `ayat-reel-${Date.now()}.${ext}`;
  const bridge = window.AndroidBridge;
  if (bridge && (typeof bridge.beginDownload === "function" || typeof bridge.download === "function")) {
    setStatus("جاري حفظ الفيديو...");
    downloadBlob(lastBlob, name);
  } else {
    // Browser path
    const url = URL.createObjectURL(lastBlob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus("تم التحميل.");
  }
});

async function startRecording(audioCtxIn) {
  // capability check
  if (!canvas.captureStream) { throw new Error("المتصفح لا يدعم captureStream"); }
  if (typeof MediaRecorder === "undefined") { throw new Error("MediaRecorder غير مدعوم. استخدم Chrome/Edge."); }

  recording = true;
  recordBtn.disabled = true;
  stopBtn.disabled = false;
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  downloadBtn.style.display = "none";
  lastBlob = null;
  if (lastVideoUrl) { try { URL.revokeObjectURL(lastVideoUrl); } catch (e) {} lastVideoUrl = null; }
  setStatus("جاري التحضير...");

  // Make sure the Arabic webfonts are ready, otherwise canvas falls back to a
  // system face and the exported video looks different from the preview.
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) {}
  }

  // Start buffering the Pexels clip in parallel with the recitation download,
  // then wait for it: starting the encoder against an unbuffered stream is what
  // makes the background freeze a few seconds into the reel.
  const bgReady = ensureBgReady();
  const { slice, buffers } = await fetchAyahs(true, audioCtxIn || ensureAudioCtx());
  const audioCtx = audioCtxIn || ensureAudioCtx();
  ayahs = slice;
  await bgReady;

  // 30fps is enough for reels and halves the encoder/GPU load, which is what
  // keeps the moving background smooth instead of dropping frames.
  const videoStream = canvas.captureStream(30);
  const dest = audioCtx.createMediaStreamDestination();
  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  // «كتم أثناء التسجيل»: you stop hearing the recitation in the room, but the
  // recitation is still routed into the recording graph — the exported file
  // always keeps its full audio.
  const previewMuted = !!(muteAudioCb && muteAudioCb.checked);
  if (muteAudioCb) muteAudioCb.disabled = true;

  const mimeType = await pickMimeType();
  window.__ayatPreferredMime = mimeType;

  const is4K = (document.getElementById("quality")?.value === "2160");
  const vBitrate = window.AndroidBridge ? 5_000_000 : (is4K ? 16_000_000 : 8_000_000);
  recorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: vBitrate,
    audioBitsPerSecond: 128_000,
  });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.onerror = (e) => { setStatus("خطأ recorder: " + (e.error?.message || e)); };
  let recStartTs = 0;
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType });
    if (lastVideoUrl) URL.revokeObjectURL(lastVideoUrl);
    lastBlob = blob;
    lastMime = mimeType;
    lastVideoUrl = URL.createObjectURL(blob);
    const fmt = mimeType.indexOf("mp4") !== -1 ? "MP4" : "WebM";
    const durSec = recStartTs ? (performance.now() - recStartTs) / 1000 : 0;
    // Anything below ~6 KB per second is a header with no frames — exactly the
    // "12 KB MP4" failure that YouTube refuses to process.
    const broken = blob.size < Math.max(30000, durSec * 6000);
    downloadBtn.style.display = broken ? "none" : "inline-block";
    downloadBtn.setAttribute("download", "ayat-reel-" + Date.now() + (fmt === "MP4" ? ".mp4" : ".webm"));
    const mmss = " · " + Math.floor(durSec / 60) + ":" + String(Math.round(durSec % 60)).padStart(2, "0");
    downloadBtn.textContent = "تحميل الفيديو " + fmt + " (" + (blob.size/1024/1024).toFixed(2) + " MB" + mmss + ")";
    recording = false;
    stopRecordingCleanup = null;
    activeSources = [];
    // Release the encoder tracks and the audio graph so the next take starts
    // from a clean, low-memory state.
    try { combined.getTracks().forEach((t) => t.stop()); } catch (e) {}
    try { audioCtx.close(); } catch (e) {}
    if (window.__ayatAudioCtx === audioCtx) window.__ayatAudioCtx = null;
    audioCtxRef = null;
    try { bgVideo.pause(); } catch (e) {}
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    if (muteAudioCb) muteAudioCb.disabled = false;
    playing = false;
    drawFrame();
    prevBtn.disabled = ayahs.length <= 1;
    nextBtn.disabled = ayahs.length <= 1;
    if (broken) {
      handleBrokenExport(mimeType, blob.size, durSec);
      return;
    }
    window.__ayatAutoRetry = false;
    // save clip metadata
    try {
      const clips = JSON.parse(localStorage.getItem("ayat_clips") || "[]");
      clips.unshift({
        id: Date.now(),
        surah: surahSel.value,
        from: fromInput.value,
        to: toInput.value,
        reciter: reciterSel.value,
        template: (document.getElementById("tplSelect") || {}).value || "sakina",
        aspect: (document.getElementById("aspect") || {}).value || "9:16",
        quality: (document.getElementById("quality") || {}).value || "1080",
        date: new Date().toISOString().slice(0, 10),
        size: (blob.size / 1024 / 1024).toFixed(2),
      });
      localStorage.setItem("ayat_clips", JSON.stringify(clips.slice(0, 50)));
    } catch (e) {}
    renderClips();
    setStatus(`تم حفظ الريل (${(blob.size/1024/1024).toFixed(2)} MB). ✓`);
  };

  recorder.start(1000);
  recStartTs = performance.now();
  setStatus(previewMuted ? "بدأ التسجيل — الصوت مكتوم لديك فقط (الفيديو سيُصدَّر بالصوت)..." : "بدأ التسجيل...");

  // play bg video
  if (bgVideoUrl) {
    try { bgVideo.play(); } catch (e) {}
  }

  let rafId = null;
  let lastDraw = 0;
  function loop(ts) {
    // Draw at ~30fps: the encoder only samples 30fps anyway, and every extra
    // redraw of a 1080x1920 canvas steals time from video decoding.
    if (!lastDraw || ts - lastDraw >= 32) {
      lastDraw = ts;
      drawFrame();
    }
    if (recording) rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  // Allows «إيقاف» to end a take early: stop the recorder and every scheduled
  // audio source so nothing keeps playing after the user aborts.
  stopRecordingCleanup = () => {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    activeSources.forEach((s) => { try { s.stop(); } catch (e) {} });
    activeSources = [];
    if (rafId) cancelAnimationFrame(rafId);
  };

  playing = true;
  currentIdx = 0;
  if (audioCtx.state === "suspended") await audioCtx.resume();

  audioCtxRef = audioCtx;
  ayahStartTimes = [];
  let t = audioCtx.currentTime + 0.1;
  for (let i = 0; i < buffers.length; i++) {
    const src = audioCtx.createBufferSource();
    src.buffer = buffers[i];
    src.connect(dest);                     // always recorded (file has audio)
    if (!previewMuted) src.connect(audioCtx.destination); // speakers
    const st = t;
    src.start(st);
    activeSources.push(src);
    ayahStartTimes.push(st);
    t += buffers[i].duration;
  }
  ayahEndTime = t;

  // schedule stop when finished
  let totalMs = (ayahEndTime - audioCtx.currentTime) * 1000 + 400;
  if (!isFinite(totalMs) || totalMs < 2000) totalMs = 2000;
  setTimeout(() => {
    if (recording && recorder && recorder.state !== "inactive") recorder.stop();
    if (rafId) cancelAnimationFrame(rafId);
  }, totalMs);
}

function playBuffer(ctx, buffer, dest) {
  return new Promise((resolve) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(dest);
    src.connect(ctx.destination);
    src.onended = () => resolve();
    src.start();
  });
}

function downloadBlob(blob, name) {
  const bridge = window.AndroidBridge;

  // Android WebView: blob URLs are not downloadable. Send the file to the
  // native bridge in small chunks so peak memory stays tiny.
  if (bridge && typeof bridge.beginDownload === "function"
      && typeof bridge.writeChunk === "function"
      && typeof bridge.finishDownload === "function") {
    const CHUNK = 256 * 1024;
    let offset = 0;
    let failed = false;
    let started = false;
    setStatus("جاري حفظ الفيديو...");
    try {
      started = bridge.beginDownload(name, blob.type || "video/mp4");
    } catch (e) {
      started = false;
      setStatus("خطأ beginDownload: " + e);
    }
    if (!started) {
      // Fallback: legacy single-shot download (only for small files — a huge
      // base64 string would crash the WebView).
      if (blob.size <= 8 * 1024 * 1024 && bridge && typeof bridge.download === "function") {
        setStatus("جاري حفظ (طريقة بديلة)...");
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const base64 = String(reader.result).split(",")[1] || "";
            bridge.download(base64, name, blob.type || "video/mp4");
            setStatus("تم إرسال الفيديو للحفظ.");
          } catch (e) {
            setStatus("خطأ: " + e);
          }
        };
        reader.readAsDataURL(blob);
        return;
      }
      setStatus("تعذّر بدء الحفظ على الجهاز.");
      return;
    }
    const pump = () => {
      if (failed) return;
      if (offset >= blob.size) {
        try { bridge.finishDownload(); } catch (e) { setStatus("خطأ finishDownload: " + e); }
        setStatus("تم حفظ الفيديو ✓");
        return;
      }
      const slice = blob.slice(offset, Math.min(offset + CHUNK, blob.size));
      offset += CHUNK;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const b64 = String(fr.result).split(",")[1] || "";
          if (b64) {
            const ok = bridge.writeChunk(b64);
            if (ok === false) throw new Error("فشل حفظ الجزء");
          }
          pump();
        } catch (e) {
          failed = true;
          try { bridge.abortDownload(); } catch (x) {}
          setStatus("خطأ أثناء الحفظ: " + e);
        }
      };
      fr.onerror = () => {
        failed = true;
        try { bridge.abortDownload(); } catch (x) {}
        setStatus("خطأ في قراءة الملف.");
      };
      fr.readAsDataURL(slice);
    };
    pump();
    return;
  }

  if (bridge && typeof bridge.download === "function") {
    setStatus("جاري حفظ الفيديو...");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const base64 = String(reader.result).split(",")[1] || "";
        bridge.download(base64, name, blob.type || "video/webm");
        setStatus("تم إرسال الفيديو للحفظ.");
      } catch (e) {
        setStatus("خطأ: " + e);
      }
    };
    reader.readAsDataURL(blob);
    return;
  }

  // Browser path
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus("تم التحميل.");
}

// Populate templates
const tplSel = document.getElementById("tplSelect");
if (tplSel) {
  tplSel.innerHTML = TEMPLATES.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
  tplSel.value = "sakina";
}
const tplGrid = document.getElementById("tplGrid");
if (tplGrid) {
  tplGrid.innerHTML = TEMPLATES.map(t => `<button class="tpl-chip" data-tpl="${t.id}" style="background:${t.bg1}; color:${t.text}; border-color:${t.accent}">${t.name}</button>`).join("");
  tplGrid.querySelectorAll(".tpl-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      if (tplSel) tplSel.value = btn.dataset.tpl;
      drawFrame();
      tplGrid.querySelectorAll(".tpl-chip").forEach(b => b.classList.toggle("active", b === btn));
    });
  });
  const first = tplGrid.querySelector(".tpl-chip");
  if (first) first.classList.add("active");
}
// Listeners
const aspectEl = document.getElementById("aspect");
const qualityEl = document.getElementById("quality");
const wordSyncEl = document.getElementById("wordSync");
if (aspectEl) aspectEl.addEventListener("change", updateCanvasSize);
if (qualityEl) qualityEl.addEventListener("change", updateCanvasSize);
if (tplSel) tplSel.addEventListener("change", () => {
  const grid = document.getElementById("tplGrid");
  if (grid) grid.querySelectorAll(".tpl-chip").forEach(b => b.classList.toggle("active", b.dataset.tpl === tplSel.value));
  drawFrame();
});
if (wordSyncEl) wordSyncEl.addEventListener("change", drawFrame);

function renderClips() {
  const el = document.getElementById("clipsList");
  if (!el) return;
  let clips = [];
  try { clips = JSON.parse(localStorage.getItem("ayat_clips") || "[]"); } catch (e) {}
  if (!clips.length) { el.innerHTML = '<p class="muted">لا توجد مقاطع بعد.</p>'; return; }
  el.innerHTML = "";
  clips.forEach(c => {
    const s = surahs.find(x => x.number == c.surah);
    const card = document.createElement("div");
    card.className = "invoice-card";
    card.innerHTML = `
      <div class="head"><span>سورة ${s ? s.name : c.surah} (${c.from}-${c.to})</span><span>${c.size} MB</span></div>
      <div class="meta">${c.reciter} • ${c.template} • ${c.aspect} • ${c.date}</div>
      <div class="acts">
        <button class="btn danger small" data-action="del">حذف</button>
      </div>
    `;
    card.querySelector('[data-action="del"]').addEventListener("click", () => {
      const list = JSON.parse(localStorage.getItem("ayat_clips") || "[]").filter(x => x.id !== c.id);
      localStorage.setItem("ayat_clips", JSON.stringify(list));
      renderClips();
    });
    el.appendChild(card);
  });
}

loadSurahs().catch(e => setStatus("خطأ: " + e.message));
// Disable 4K option on phone (OOM risk) but keep it visible.
if (window.AndroidBridge) {
  const qEl = document.getElementById("quality");
  if (qEl) {
    const opt = qEl.querySelector('option[value="2160"]');
    if (opt) { opt.disabled = true; opt.textContent = "4K (سطح المكتب فقط)"; }
    qEl.value = "1080";
  }
}
updateCanvasSize();
setTimeout(() => drawFrame(), 500);
renderClips();
// keep bg video drawing
bgVideo.addEventListener("play", () => { if (!recording) requestAnimationFrame(function tick(){ if (bgVideoUrl && !bgVideo.paused) { drawFrame(); requestAnimationFrame(tick); } }); });
