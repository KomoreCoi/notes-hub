# notes-hub

按主题组织的 Markdown 笔记，用 [Docsify](https://docsify.js.org/) + GitHub Pages 发布。

📖 **在线访问**：https://komorecoi.github.io/notes-hub/

## 本地预览

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。改完 md 保存、刷新页面即生效。

## 维护

- 写作约定、目录结构、部署流程都在 [docs/README.md](docs/README.md)
- 加新笔记：`npm run build:sidebar`（自动校验路径并更新侧边栏）

## 仓库结构

```text
notes-hub/
├── README.md            ← 你正在看的，仓库门面
├── package.json
├── scripts/
│   ├── check-links.mjs      校验图片和站内链接
│   └── build-sidebar.mjs    自动生成侧边栏
├── .github/workflows/pages.yml   推送到 main 自动部署
└── docs/                ← 整个网站
    ├── index.html
    ├── _sidebar.md      自动生成
    ├── README.md        站点首页
    ├── .nojekyll
    ├── a/   README.md + 笔记 + images/
    └── b/   README.md + 笔记 + images/
```
