/** Thin wrapper around the Pul backend. */
async function request(url, options) {
  let res;
  try { res = await fetch(url, options); }
  catch { throw new Error('Cannot reach the server. Is "python main.py" running?'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Server error (${res.status})`);
  return data;
}

export const getLanguages = () => request('/api/languages');
export const getHealth = () => request('/api/health');

export function translate({ src, dst, text, audio, speak, gender, rate }) {
  const fd = new FormData();
  Object.entries({ src, dst, speak, gender, rate }).forEach(([k, v]) => fd.append(k, v));
  if (audio) fd.append('audio', audio, 'recording.webm'); else fd.append('text', text);
  return request('/api/translate', { method: 'POST', body: fd });
}

export function speak({ text, lang, gender, rate }) {
  const fd = new FormData();
  Object.entries({ text, lang, gender, rate }).forEach(([k, v]) => fd.append(k, v));
  return request('/api/speak', { method: 'POST', body: fd });
}
