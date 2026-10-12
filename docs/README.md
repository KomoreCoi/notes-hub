# 我的笔记

> 按主题归档的 Markdown 笔记，纯静态托管。

新加文档时不用手改这份文件，跑 `npm run build:sidebar` 自动同步侧边栏和下面的目录列表。

<!-- topics:start -->

## A

- [主题 A](/a/)
- [数据清洗实录](/a/cleaning)
- [SQL 片段备忘](/a/sql)

## B

- [主题 B](/b/)
- [可视化规范](/b/viz)

<!-- topics:end -->

## 目录结构

```text
docs/
├── index.html        站点配置，唯一需要维护的配置文件
├── _sidebar.md       自动生成，不要手改
├── README.md         站点根首页（对应 /）
├── .nojekyll         阻止 GitHub Pages 跑 Jekyll
│
├── a/                主题 A
│   ├── README.md     主题 A 首页（对应 /a/）—— 必须是这个名字
│   ├── images/       该主题专用的图片
│   └── *.md
└── b/                主题 B
    ├── README.md
    └── images/
```

## 写作约定

### 图片路径

```markdown
![描述文字](images/chart.png)
```

- **不要**以 `/` 开头。`/images/chart.png` 会被当成站点根目录，实际文件在 `/a/images/chart.png`，直接 404。
- **不要**用 `../`。虽然 Docsify 能解析，但笔记移动位置就全断。
- `index.html` 里开了 `relativePath: true`，Docsify 以当前文件目录为基准解析相对路径。`a/cleaning.md` 里的 `images/chart.png` 正确请求 `/a/images/chart.png`。

### 代码块

````markdown
```python
df = pd.read_csv(path)
```
````

第一行写语言名，不写 Prism 会猜，猜错就没有高亮。

### 文档内互链

同主题用相对路径，跨主题用根绝对路径：

```markdown
[SQL 片段备忘](sql)        同目录
[主题 B 概览](/b/)         跨主题
```

## 本地预览

```bash
npm install        # 第一次
npm run dev        # 启动 http://localhost:3000
```

Docsify 是纯前端渲染，没有构建步骤，改完 md 保存、刷新页面即生效。

## 加一篇笔记

1. 在 `docs/<主题>/` 下新建 `.md`，第一行写 `# 标题`
2. 图片放进该主题的 `images/` 文件夹
3. `npm run build:sidebar` —— 自动校验图片路径、更新侧边栏、更新本 README 的目录列表
4. `git add . && git commit -m "..." && git push` —— 等 1 分钟 Actions 自动部署

**只有第一条是手动的**。第二条起全是命令。
