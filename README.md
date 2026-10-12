# your-notes

按主题组织的 Markdown 笔记，用 Docsify 发布到 GitHub Pages。你的 `.md` 文件不需要任何改动。

## 目录结构

```text
your-notes/
├── package.json              只装 docsify-cli，用于本地预览
├── .gitignore
├── .github/workflows/pages.yml   自动部署
├── scripts/check-links.mjs       校验图片路径和站内链接
└── docs/                     ← 这个目录就是整个网站
    ├── .nojekyll             空文件，阻止 Pages 跑 Jekyll
    ├── index.html            站点配置
    ├── _sidebar.md           侧边栏
    ├── README.md             首页
    ├── about.md
    ├── a/
    │   ├── index.md
    │   ├── cleaning.md
    │   ├── sql.md
    │   └── images/
    │       ├── missing-dist.svg
    │       └── explain.svg
    └── b/
        ├── index.md
        ├── viz.md
        └── images/
            └── palette.svg
```

## 本地预览

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。Docsify 是纯前端渲染，没有构建步骤，改完刷新就生效。

## 校验

```bash
npm run check
```

扫描所有 Markdown，找出：

- 引用了但不存在的图片文件
- 图片文件名大小写与实际不一致（Windows 能显示，Linux 服务器会 404）
- 指向不存在页面的站内链接
- 超过 1MB 的大图（会影响仓库体积和加载速度）

推送前跑一下，能省掉在浏览器里逐个点图找 404 的时间。GitHub Actions 里也会自动跑一遍，失败会阻止部署。

## 部署到 GitHub Pages

### 1. 创建仓库并推送

GitHub 上新建一个仓库（名字随意，会作为网址的子路径），然后：

```bash
git init
git add .
git commit -m "init"
git remote add origin git@github.com:<你的用户名>/<仓库名>.git
git push -u origin main
```

仓库设为 **public**，否则免费账号无法用 Pages。

### 2. 开启 Pages

仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**，保存。

不需要 `Deploy from a branch`，也不需要手动提交 `docs` 之外的任何东西。

### 3. 完事

每次 push 到 `main`，Actions 约 1 分钟部署完成。

网址是：

```text
https://<你的用户名>.github.io/<仓库名>/
```

想要独立域名（`notes.yoursite.com`），在域名服务商加一条 CNAME：

| 类型 | 主机 | 值 |
|------|------|-----|
| CNAME | notes | `<你的用户名>.github.io` |

然后在仓库里新建 `docs/CNAME` 文件，内容只写域名（一行，无 http 前缀）。Pages 会自动签发免费 HTTPS 证书，DNS 生效通常几分钟，最长 48 小时。

## 往里加笔记

1. 在对应主题目录下建 `.md`
2. 图片放进该主题的 `images/`
3. 在 `_sidebar.md` 和 `README.md` 各加一行
4. `npm run check`
5. 提交推送

只有一条规则：**图片引用用相对路径 `images/xxx.png`，不要以 `/` 开头**。`index.html` 里开了 `relativePath: true`，Docsify 会以当前文件所在目录为基准解析，所以 `a/cleaning.md` 里的 `images/chart.png` 会正确请求 `/a/images/chart.png`。

详细约定见 [写作约定](docs/about.md)。

## 常见问题

**图片不显示**

先跑 `npm run check`。九成是路径写成了 `/a/images/x.png`（站点根），实际文件在 `/a/images/x.png` 看起来对，但 Docsify 开了 `relativePath` 后应该写 `images/x.png`。剩下的一成是文件名大小写不一致。

**侧边栏不显示**

`docs/.nojekyll` 是否存在。没有它，GitHub Pages 会启动 Jekyll，把下划线开头的文件（`_sidebar.md`、`_coverpage.md`、`_navbar.md`）全部忽略。

**改了配置但线上没变**

Docsify 的搜索索引和部分配置有缓存。强制刷新（Ctrl+Shift+R），或者在网址后加 `?v=2`。

**部署一直失败**

Actions 页面点开失败的步骤看日志。本地先跑一遍 `npm run check` 复现——路径问题在 CI 里也会报。

**搜索搜不到中文**

Docsify 内置搜索按空格分词，中文连续文本分不开。凑合用，或者加一个第三方搜索插件。
