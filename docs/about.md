# 关于

## 这套笔记是怎么组织的

```text
docs/
├── index.html        站点配置，唯一需要维护的配置文件
├── _sidebar.md       侧边栏
├── README.md         站点根首页（对应 /）
├── .nojekyll         阻止 GitHub Pages 跑 Jekyll
│
├── a/                主题 A
│   ├── README.md     主题 A 首页（对应 /a/）—— 必须是这个名字
│   ├── images/       该主题专用的图片
│   └── ...
└── b/                主题 B
    ├── README.md
    └── images/
```

**一条规则：图片放主题目录下的 `images/` 子目录，文档里写相对路径 `images/xxx.png`。**

因为 `index.html` 里开了 `relativePath: true`，Docsify 会以当前文档所在目录为基准解析相对路径，所以 `a/cleaning.md` 里的 `images/chart.png` 会正确请求 `/a/images/chart.png`。

## 写作约定

### 图片

```markdown
![描述文字](images/chart.png)
```

- 路径**不要**以 `/` 开头。`/images/chart.png` 会被当成站点根目录，实际文件在 `/a/images/chart.png`，直接 404。
- 路径**不要**用 `../`。虽然 Docsify 能解析，但一旦笔记移动位置就全断。
- 描述文字写清楚，屏幕阅读器和图片加载失败时都用得上。

### 代码

```markdown
```python
df = pd.read_csv(path)
```
```

第一行写语言名，不写 Prism 会猜，猜错就没有高亮。

### 文档内互链

同主题内用相对路径，跨主题用绝对路径：

```markdown
[SQL 片段备忘](sql)        同目录
[主题 B 概览](/b/)         跨主题
```

`about` 这类关键词链接依赖 `_sidebar.md` 里登记的文件名，**不要随手改文件名**，改了要同步改侧边栏和首页。

## 本地预览

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。改完刷新即可，不需要重新构建——Docsify 是纯前端渲染，没有构建步骤。

## 新增一篇笔记

1. 在对应主题目录下建 `.md` 文件
2. 图片放进该主题的 `images/` 文件夹
3. 在 `_sidebar.md` 和 `README.md` 各加一行
4. `npm run check` 检查图片路径有没有写错
5. 提交推送，等 Actions 部署完成（约 1 分钟）

`npm run check` 会在提交前扫一遍所有 Markdown，列出找不到的图片文件和疑似失效的内部链接。这是最容易出错的地方，值得养成习惯。
