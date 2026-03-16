
# Kimi API 版重点提取网站

你现在已经拿到 API Key，这一版就是给你直接接 Kimi 的：
- 前端输入文本；
- 后端调用 Kimi；
- 返回三类结果并在原文标注（加粗短句/词语、加粗长句、倾斜短句）。

## 1. 安装依赖

```bash
npm install
```

## 2. 配置 API Key

复制模板并填写你的 key：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
KIMI_API_KEY=你的apikey
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=moonshot-v1-8k
PORT=4173
```

## 3. 启动

```bash
npm start
```

打开浏览器访问：`http://localhost:4173`

## 4. 使用

1. 粘贴文本
2. 点击 `AI 分析`
3. 查看三类提取结果和标注后的文本

## 5. 目录说明

- `server.js`：后端（接收文本，调用 Kimi API，清洗并返回结果）
- `public/index.html`：页面结构
- `public/script.js`：前端交互与渲染
- `public/styles.css`：样式
- `.env.example`：环境变量模板

## 6. 注意事项

- **不要把 `.env` 提交到仓库**（里面有密钥）。
- 如果报错 `后端未配置 KIMI_API_KEY`，说明 `.env` 还没配好。
- 如果提示 `Kimi API 调用失败`，先检查 key、额度、模型名。
