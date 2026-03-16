const inputEl = document.getElementById('inputText');
const analyzeBtn = document.getElementById('analyzeBtn');
const demoBtn = document.getElementById('demoBtn');
const statusEl = document.getElementById('status');
const boldShortListEl = document.getElementById('boldShortList');
const boldLongListEl = document.getElementById('boldLongList');
const italicShortListEl = document.getElementById('italicShortList');
const annotatedEl = document.getElementById('annotatedText');

const escapeHtml = (str) => str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderList = (el, items) => {
  el.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
};

const annotateText = (text, boldItems, italicItems) => {
  let html = escapeHtml(text);
  [...new Set(boldItems)].sort((a, b) => b.length - a.length).forEach((item) => {
    const e = escapeHtml(item);
    html = html.replace(new RegExp(escapeRegExp(e), 'g'), `<span class="emphasis-bold">${e}</span>`);
  });
  [...new Set(italicItems)].sort((a, b) => b.length - a.length).forEach((item) => {
    const e = escapeHtml(item);
    html = html.replace(new RegExp(escapeRegExp(e), 'g'), `<span class="emphasis-italic">${e}</span>`);
  });
  return html;
};

const analyze = async () => {
  const text = inputEl.value.trim();
  if (!text) {
    statusEl.textContent = '请先输入文本';
    return;
  }

  analyzeBtn.disabled = true;
  statusEl.textContent = 'AI 分析中...';

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');

    const boldShort = data.boldShort || [];
    const boldLong = data.boldLong || [];
    const italicShort = data.italicShort || [];

    renderList(boldShortListEl, boldShort);
    renderList(boldLongListEl, boldLong);
    renderList(italicShortListEl, italicShort);

    annotatedEl.innerHTML = annotateText(text, [...boldShort, ...boldLong], italicShort);
    statusEl.textContent = '分析完成';
  } catch (err) {
    statusEl.textContent = `失败：${err.message}`;
  } finally {
    analyzeBtn.disabled = false;
  }
};

analyzeBtn.addEventListener('click', analyze);

demoBtn.addEventListener('click', () => {
  inputEl.value = '你现在的进度其实已经很不错了，但接下来最重要的是把节奏稳定住。你必须每天留出30分钟做复盘，这会直接决定你能不能突破瓶颈！我知道你有点焦虑，不过这很正常，因为你正在成长。只要你坚持两周，你会非常明显地看到变化。';
});

annotatedEl.innerHTML = '<span class="empty">标注后的文本会显示在这里。</span>';
