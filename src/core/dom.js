// DOM、文本转义与基础表单片段。
export const $ = (s) => document.querySelector(s);
export const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
export function toast(t) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = t;
  document.body.append(d);
  setTimeout(() => d.remove(), 2400);
}
export function field(name, label, type = 'text', value = '', full = false) {
  let input =
    type === 'textarea'
      ? `<textarea name="${name}">${esc(value)}</textarea>`
      : `<input name="${name}" type="${type}" value="${esc(value)}" ${name === 'title' ? 'required maxlength="100"' : ''} ${name === 'score' ? 'min="0" max="10" step="0.1"' : ''} ${name === 'lat' ? 'min="-90" max="90" step="any"' : ''} ${name === 'lng' ? 'min="-180" max="180" step="any"' : ''}>`;
  return `<label class="field ${full ? 'full' : ''}">${label}${input}</label>`;
}
export function select(name, label, options, value) {
  return `<label class="field">${label}<select name="${name}">${Object.entries(
    options,
  )
    .map(
      ([k, v]) =>
        `<option value="${esc(k)}" ${k === value ? 'selected' : ''}>${esc(v)}</option>`,
    )
    .join('')}</select></label>`;
}
export const cloudMessage = (text) => {
  $('#cloudMessage').textContent = text;
};
