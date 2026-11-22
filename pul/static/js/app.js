import { getLanguages, getHealth, translate, speak } from './api.js';
import { Recorder } from './recorder.js';

const $ = (id) => document.getElementById(id);
const el = {
  src: $('src'), dst: $('dst'), swap: $('swap'), input: $('input'), output: $('output'),
  mic: $('mic'), micHint: $('micHint'), count: $('count'), clear: $('clear'),
  go: $('go'), play: $('play'), copy: $('copy'), engine: $('engine'), notice: $('notice'),
  autoSpeak: $('autoSpeak'), autoStop: $('autoStop'), gender: $('gender'), rate: $('rate'),
  player: $('player'), history: $('history'), emptyHistory: $('emptyHistory'),
  clearHistory: $('clearHistory'), status: $('status'), toast: $('toast'),
  inPanel: $('inPanel'), outPanel: $('outPanel'),
};

const state = { langs: {}, busy: false, lastAudio: null, lastText: '', lastLang: '', history: [] };
const HISTORY_KEY = 'pul.history.v2';

/* ---------- helpers ---------- */
function toast(msg) {
  el.toast.textContent = msg; el.toast.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.toast.classList.remove('show'), 4000);
}
const isRtl = (code) => !!state.langs[code]?.rtl;
function applyDirection() {
  el.input.classList.toggle('rtl', isRtl(el.src.value));
  el.output.classList.toggle('rtl', isRtl(el.dst.value));
  el.input.dir = isRtl(el.src.value) ? 'rtl' : 'ltr';
}
function setBusy(b) {
  state.busy = b;
  el.go.disabled = b; el.mic.disabled = b && !recorder.active;
  el.go.innerHTML = b ? '<span class="spin"></span>Translating…' : 'Translate';
}
function showNotice(list) {
  el.notice.hidden = !list?.length;
  el.notice.innerHTML = '';
  (list || []).forEach((w) => { const p = document.createElement('p'); p.textContent = w; el.notice.append(p); });
}
function showResult(text, lang) {
  el.output.textContent = text;
  el.output.classList.toggle('rtl', isRtl(lang));
  el.copy.disabled = !text;
  state.lastText = text; state.lastLang = lang;
}
function playUrl(url, remember = true) {
  if (remember) { state.lastAudio = url; el.play.disabled = false; }
  el.player.src = url;
  el.outPanel.classList.add('live');
  el.player.onended = el.player.onerror = () => el.outPanel.classList.remove('live');
  return el.player.play().catch(() => toast('Press "Play voice" to hear the translation.'));
}

/* ---------- history ---------- */
function loadHistory() {
  try { state.history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { state.history = []; }
  renderHistory();
}
function saveHistory() { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, 30))); } catch { /* ignore */ } }
function renderHistory() {
  el.history.innerHTML = '';
  el.emptyHistory.hidden = state.history.length > 0;
  state.history.forEach((h) => {
    const li = document.createElement('li');
    const body = document.createElement('div');
    const o = Object.assign(document.createElement('div'), { className: 'o' + (isRtl(h.src) ? ' rtl' : ''), textContent: h.transcript });
    const t = Object.assign(document.createElement('div'), { className: 't' + (isRtl(h.dst) ? ' rtl' : ''), textContent: h.translation });
    const m = Object.assign(document.createElement('div'), { className: 'meta', textContent: `${state.langs[h.src]?.name} → ${state.langs[h.dst]?.name} · ${h.time}` });
    body.append(o, t, m);
    const b = Object.assign(document.createElement('button'), { className: 'ghost', textContent: '▶' });
    b.title = 'Play voice'; b.onclick = () => replay(h.translation, h.dst, false);
    li.append(body, b); el.history.append(li);
  });
}
function addHistory(r) {
  state.history.unshift({ src: r.src, dst: r.dst, transcript: r.transcript, translation: r.translation,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  saveHistory(); renderHistory();
}

/* ---------- actions ---------- */
async function run({ text, audio }) {
  if (state.busy) return;
  setBusy(true); showNotice([]);
  el.output.innerHTML = '<span class="placeholder"><span class="spin"></span>Working…</span>';
  try {
    const r = await translate({ src: el.src.value, dst: el.dst.value, text, audio,
      speak: el.autoSpeak.checked, gender: el.gender.value, rate: el.rate.value });
    if (audio) { el.input.value = r.transcript; updateCount(); }
    showResult(r.translation, r.dst);
    el.engine.textContent = `via ${r.engine}` + (r.ms.translate ? ` · ${r.ms.translate} ms` : '');
    showNotice(r.warnings); addHistory(r);
    if (r.audio) playUrl(r.audio);
  } catch (e) {
    el.output.innerHTML = '<span class="placeholder">Translation appears here</span>';
    showResult('', el.dst.value); toast(e.message);
  } finally { setBusy(false); }
}

async function replay(text, lang, remember = true) {
  try { const { audio } = await speak({ text, lang, gender: el.gender.value, rate: el.rate.value }); playUrl(audio, remember); }
  catch (e) { toast(e.message); }
}

const recorder = new Recorder({
  onLevel: (v) => el.mic.style.setProperty('--lv', v),
  autoStop: () => el.autoStop.checked,
});

async function toggleMic() {
  if (recorder.active) return recorder.stop();
  if (state.busy) return;
  el.player.pause();
  el.mic.classList.add('recording'); el.micHint.textContent = 'Listening… tap to stop';
  el.inPanel.classList.add('live');
  let blob = null;
  try { blob = await recorder.start(); }
  catch { toast('Microphone blocked. Allow mic access (works on localhost or https only).'); }
  el.mic.classList.remove('recording'); el.micHint.textContent = 'Tap to speak';
  el.inPanel.classList.remove('live');
  if (blob) run({ audio: blob }); else toast('No speech detected. Please try again.');
}

function updateCount() { el.count.textContent = `${el.input.value.length} / ${el.input.maxLength}`; }

function fillLanguages(list) {
  list.forEach((l) => {
    state.langs[l.code] = l;
    [el.src, el.dst].forEach((s) => s.add(new Option(`${l.name} — ${l.native}`, l.code)));
  });
  el.src.value = 'en'; el.dst.value = 'ur';
}
function ensureDifferent(changed) {
  if (el.src.value !== el.dst.value) return;
  const other = changed === el.src ? el.dst : el.src;
  other.value = Object.keys(state.langs).find((c) => c !== changed.value);
}

/* ---------- wiring ---------- */
el.src.onchange = () => { ensureDifferent(el.src); applyDirection(); };
el.dst.onchange = () => { ensureDifferent(el.dst); applyDirection(); };
el.swap.onclick = () => {
  [el.src.value, el.dst.value] = [el.dst.value, el.src.value];
  if (state.lastText) { el.input.value = state.lastText; showResult('', el.dst.value); updateCount(); }
  applyDirection();
};
el.go.onclick = () => { const t = el.input.value.trim(); t ? run({ text: t }) : toast('Please type something or use the microphone.'); };
el.input.addEventListener('input', updateCount);
el.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) el.go.click(); });
el.mic.onclick = toggleMic;
el.clear.onclick = () => { el.input.value = ''; updateCount(); el.input.focus(); };
el.copy.onclick = () => navigator.clipboard.writeText(state.lastText).then(() => toast('Copied'));
el.clearHistory.onclick = () => { state.history = []; saveHistory(); renderHistory(); };
el.play.onclick = () => state.lastText && (state.lastAudio ? playUrl(state.lastAudio) : replay(state.lastText, state.lastLang));

(async function init() {
  try {
    fillLanguages(await getLanguages());
    applyDirection(); updateCount(); loadHistory();
    const h = await getHealth();
    el.status.textContent = h.translator === 'llm' ? 'Claude translation' : 'Offline translation';
  } catch (e) { el.status.textContent = 'server offline'; el.status.classList.add('bad'); toast(e.message); }
})();
