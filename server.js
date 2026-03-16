import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import JSON5 from 'json5';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const dedupeStrings = (arr, max = 6) => {
  const safe = Array.isArray(arr)
    ? arr.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
    : [];
  return [...new Set(safe)].slice(0, max);
};

const extractJson = (text) => {
  if (!text) return null;

  // 替换中文引号
  let cleaned = String(text)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  // 去掉 markdown 代码块标记
  cleaned = cleaned
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  console.log('🔍 清洗后的字符串:', JSON.stringify(cleaned));

  // 用 JSON5.parse 替换 JSON.parse
  try {
    return JSON5.parse(cleaned);          // ← 这里改
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON5.parse(match[0]);       // ← 这里改
    } catch {
      return null;
    }
  }
};

const normalizeOutput = (parsed) => {
  const softWarm = dedupeStrings(parsed?.softWarm, 6);
  const deepPossessive = dedupeStrings(parsed?.deepPossessive, 6);
  const fragileNeedy = dedupeStrings(parsed?.fragileNeedy, 6);
  const highTension = dedupeStrings(parsed?.highTension, 6);

  return {
    softWarm,
    deepPossessive,
    fragileNeedy,
    highTension,
    // 保留旧字段，方便前端或旧 UI 兼容
    boldShort: deepPossessive,
    boldLong: fragileNeedy,
    italicShort: softWarm,
  };
};

app.post('/api/analyze', async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'text 不能为空' });
  }

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '后端未配置 KIMI_API_KEY，请先配置 .env' });
  }

  const baseUrl = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
  const model = process.env.KIMI_MODEL || 'moonshot-v1-8k';

  const systemPrompt = `
你是一个中文文本风格标注助手。
你的任务不是只提取“温暖句子”，而是识别文本中最有情绪抓力和关系张力的原句片段。

你需要优先抓取以下类型：
1. 温柔、安抚、被照顾感；
2. 更沉、更深、带一点压迫感、占有欲、认领感、控制感的亲密表达；
3. 委屈、脆弱、依赖、害怕失去、想被接住的句子；
4. 让人心口发紧、想反复看、张力很高的句子。

注意：
- 不要把“负面情绪”整体过滤掉。失落、痛感、害怕、委屈，只要服务于亲密和关系张力，也应保留。
- 不要只选空泛夸赞或普通鼓励句。
- 优先选择有具体动作感、身体感、关系感、呼吸感、靠近感、认领感的原文片段。
- 不能改写原文，只能返回原文中的连续片段。
- 严格输出合法 JSON，不要输出解释。
`.trim();

  const userPrompt = `
请分析下面文本，并返回 JSON：
{
  "softWarm": ["..."],
  "deepPossessive": ["..."],
  "fragileNeedy": ["..."],
  "highTension": ["..."]
}

规则：
1. softWarm：1-6 条。偏温柔、安抚、陪伴、抱住、被照顾感。
2. deepPossessive：1-6 条。偏沉、偏深、带一点占有欲、压迫感、控制感、认领感、贴近感。
3. fragileNeedy：1-6 条。偏委屈、脆弱、依赖、害怕失去、渴望被接住。
4. highTension：1-6 条。优先提取让人心里一紧、想反复看、张力很高的句子。可以包含身体感、动作感、呼吸感、靠近感，但不要露骨色情。
5. 同一句可以出现在多个类别中，如果它确实同时满足。
6. 必须是原文中的连续片段，不要改写。
7. 如果某类确实没有，返回空数组。
8. 额外加权偏好：
   - 优先提取包含“抱、贴、压、靠、埋、圈、收、拽、盯、看、守、认领、只给你、不准、别松、过来”等关系动作或控制感词汇的句子；
   - 优先提取包含“呼吸、脖子、背、心口、怀里、耳边、体温、肩膀、脚踝”等身体锚点的句子；
   - 优先提取“表面温柔但底下有力”的句子，而不是纯甜口水话。

待分析文本：
${text}
`.trim();

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({
        error: 'Kimi API 调用失败',
        detail: errText.slice(0, 1000),
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    console.log('Kimi 原始返回：', content);

    const parsed = extractJson(content);
    if (!parsed) {
      return res.status(502).json({
        error: 'Kimi 返回内容无法解析为 JSON',
        raw: content,
      });
    }

    return res.json(normalizeOutput(parsed));
  } catch (error) {
    return res.status(500).json({
      error: '服务端异常',
      detail: String(error),
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = Number(process.env.PORT || 4173);
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});