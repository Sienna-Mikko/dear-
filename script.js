const inputEl = document.getElementById('inputText');
const analyzeBtn = document.getElementById('analyzeBtn');
const demoBtn = document.getElementById('demoBtn');

const boldShortListEl = document.getElementById('boldShortList');   // 映射：deepPossessive
const boldLongListEl = document.getElementById('boldLongList');     // 映射：fragileNeedy
const italicShortListEl = document.getElementById('italicShortList'); // 映射：softWarm

const annotatedEl = document.getElementById('annotatedText');

const SOFT_WARM_WORDS = [
  '抱', '陪', '安稳', '温柔', '靠过来', '接住', '守着', '晚安', '别怕', '我在',
  '轻轻', '慢慢', '贴着', '顺着', '哄', '安静', '软', '暖', '躺下', '欢迎回家'
];

const DEEP_POSSESSIVE_WORDS = [
  '只准', '不准', '别松', '过来', '压', '圈住', '收进来', '认领', '盯着', '拽',
  '抱紧', '往怀里', '贴近', '掌控', '占有', '我的', '不让你', '收住', '扣住'
];

const FRAGILE_NEEDY_WORDS = [
  '想你', '缺', '空', '委屈', '害怕', '难受', '找不到', '崩', '不安', '睡不着',
  '一个人', '掉下去', '撑不住', '虚弱', '失去', '靠一下', '抱抱我', '碰不到'
];

const HIGH_TENSION_WORDS = [
  '呼吸', '脖子', '背', '心口', '怀里', '耳边', '体温', '肩膀', '脚踝', '贴',
  '埋', '圈', '压住', '收紧', '凑近', '盯', '看着', '抱着', '扭动', '蹭'
];

const splitSentences = (text) =>
  text
    .split(/(?<=[。！？!?；;\n])/)
    .map((s) => s.trim())
    .filter(Boolean);

const splitPhrases = (text) =>
  text
    .split(/[，,。！？!?；;\n、：:]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.length >= 2 && s.length <= 28);

const uniqueByText = (arr) => {
  const seen = new Set();
  return arr.filter((item) => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
};

const scoreByLexicon = (unit, lexicon, extraRegex = null) => {
  let score = 0;

  lexicon.forEach((word) => {
    if (unit.includes(word)) score += 3;
  });

  if (extraRegex && extraRegex.test(unit)) score += 2;

  const exclamations = (unit.match(/[!！]/g) || []).length;
  const questions = (unit.match(/[?？]/g) || []).length;
  score += exclamations * 1.5 + questions * 1;

  if (unit.length >= 8 && unit.length <= 28) score += 1;

  return score;
};

const pickTopByCategory = (items, scorer, minCount, maxCount) => {
  const scored = uniqueByText(items)
    .map((text) => ({ text, score: scorer(text) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);

  if (!scored.length) return [];
  const count = Math.min(maxCount, Math.max(minCount, scored.length >= 4 ? Math.ceil(scored.length / 2) : 1));
  return scored.slice(0, count).map((x) => x.text);
};

const extractLocalRules = (text) => {
  const sentences = splitSentences(text);
  const phrases = splitPhrases(text);
  const units = uniqueByText([...phrases, ...sentences]);

  const softWarm = pickTopByCategory(
    units,
    (t) => scoreByLexicon(t, SOFT_WARM_WORDS, /(抱|陪|我在|晚安|接住|温柔|轻轻|暖)/),
    1,
    6
  );

  const deepPossessive = pickTopByCategory(
    units,
    (t) => scoreByLexicon(t, DEEP_POSSESSIVE_WORDS, /(只准|不准|过来|抱紧|认领|收进|掌控|占有)/),
    1,
    6
  );

  const fragileNeedy = pickTopByCategory(
    units,
    (t) => scoreByLexicon(t, FRAGILE_NEEDY_WORDS, /(想你|委屈|害怕|难受|空|缺|一个人|找不到)/),
    1,
    6
  );

  const highTension = pickTopByCategory(
    units,
    (t) =>
      scoreByLexicon(t, HIGH_TENSION_WORDS, /(呼吸|脖子|背|心口|怀里|耳边|贴|埋|压住|收紧)/) +
      scoreByLexicon(t, DEEP_POSSESSIVE_WORDS) * 0.5,
    1,
    6
  );

  return { softWarm, deepPossessive, fragileNeedy, highTension };
};

const escapeHtml = (str) =>
  str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const findAllRanges = (text, items, type) => {
  const ranges = [];
  const dedup = uniqueByText(items).sort((a, b) => b.length - a.length);

  dedup.forEach((item) => {
    let start = 0;
    while (start < text.length) {
      const idx = text.indexOf(item, start);
      if (idx === -1) break;
      ranges.push({
        start: idx,
        end: idx + item.length,
        text: item,
        type,
      });
      start = idx + item.length;
    }
  });

  return ranges;
};

const TYPE_PRIORITY = {
  highTension: 4,
  deepPossessive: 3,
  fragileNeedy: 2,
  softWarm: 1,
};

const TYPE_CLASS = {
  softWarm: 'emphasis-italic',
  deepPossessive: 'emphasis-bold',
  fragileNeedy: 'emphasis-italic',
  highTension: 'emphasis-bold emphasis-italic',
};

const buildAnnotatedHtml = (text, payload) => {
  const allRanges = [
    ...findAllRanges(text, payload.softWarm || [], 'softWarm'),
    ...findAllRanges(text, payload.deepPossessive || [], 'deepPossessive'),
    ...findAllRanges(text, payload.fragileNeedy || [], 'fragileNeedy'),
    ...findAllRanges(text, payload.highTension || [], 'highTension'),
  ];

  const sorted = allRanges.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const pa = TYPE_PRIORITY[a.type] || 0;
    const pb = TYPE_PRIORITY[b.type] || 0;
    if (pa !== pb) return pb - pa;
    return (b.end - b.start) - (a.end - a.start);
  });

  const selected = [];
  let lastEnd = -1;

  sorted.forEach((range) => {
    if (range.start < lastEnd) return;
    selected.push(range);
    lastEnd = range.end;
  });

  let html = '';
  let cursor = 0;

  selected.forEach((range) => {
    html += escapeHtml(text.slice(cursor, range.start));
    html += `<span class="${TYPE_CLASS[range.type]}">${escapeHtml(text.slice(range.start, range.end))}</span>`;
    cursor = range.end;
  });

  html += escapeHtml(text.slice(cursor));
  return html;
};

const renderList = (el, items, emptyText = '—') => {
  el.innerHTML = '';
  const data = uniqueByText(items);

  if (!data.length) {
    const li = document.createElement('li');
    li.textContent = emptyText;
    li.className = 'empty';
    el.appendChild(li);
    return;
  }

  data.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    el.appendChild(li);
  });
};

const setLoading = (loading) => {
  analyzeBtn.disabled = loading;
  analyzeBtn.textContent = loading ? '分析中...' : '提取';
};

const fetchAnalyze = async (text) => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || '分析失败');
  }
  return data;
};

const render = async () => {
  const text = inputEl.value.trim();

  if (!text) {
    boldShortListEl.innerHTML = '';
    boldLongListEl.innerHTML = '';
    italicShortListEl.innerHTML = '';
    annotatedEl.innerHTML = '<span class="empty">请输入文本后再提取。</span>';
    return;
  }

  setLoading(true);

  let payload;
  let usedFallback = false;

  try {
    payload = await fetchAnalyze(text);
  } catch (error) {
    console.warn('后端分析失败，回退到本地规则：', error);
    payload = extractLocalRules(text);
    usedFallback = true;
  } finally {
    setLoading(false);
  }

  const normalized = {
    softWarm: uniqueByText(payload.softWarm || payload.italicShort || []),
    deepPossessive: uniqueByText(payload.deepPossessive || payload.boldShort || []),
    fragileNeedy: uniqueByText(payload.fragileNeedy || payload.boldLong || []),
    highTension: uniqueByText(payload.highTension || []),
  };

  // 不改 HTML 的前提下，沿用旧槽位：
  // boldShortList -> deepPossessive
  // boldLongList  -> fragileNeedy
  // italicShortList -> softWarm
  renderList(boldShortListEl, normalized.deepPossessive);
  renderList(boldLongListEl, normalized.fragileNeedy);
  renderList(italicShortListEl, normalized.softWarm);

  const html = buildAnnotatedHtml(text, normalized);
  annotatedEl.innerHTML = usedFallback
    ? `<div class="empty" style="margin-bottom:8px;">后端不可用，当前为本地规则提取结果。</div>${html}`
    : html;
};

analyzeBtn.addEventListener('click', render);

demoBtn.addEventListener('click', () => {
  inputEl.value = '你现在不用再硬撑了，过来一点，让我把你收进怀里。你明明已经很累了，却还是在装作没事。我知道你在怕掉下去，也知道你想要被接住。别松手，今晚先让我守着你。';
  render();
});

annotatedEl.innerHTML = '<span class="empty">标注后的文本会显示在这里。</span>';