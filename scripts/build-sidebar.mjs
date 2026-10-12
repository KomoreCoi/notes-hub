#!/usr/bin/env node
/**
 * 扫描 docs/ 的目录结构，自动生成 _sidebar.md 和 README.md 的主题列表。
 *
 * 加完 md 跑 `npm run build:sidebar` 即可。
 *
 * README.md 的「主题列表」会被替换。如果存在以下标记，只会更新标记之间的内容：
 *
 *   <!-- topics:start -->
 *   ... 主题列表 ...
 *   <!-- topics:end -->
 *
 * 标记外的内容完全保留。标记不存在时自动追加到 README.md 末尾。
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');

const SKIP_DIRS = new Set(['images']);
const SKIP_FILES = new Set([
  '_sidebar.md', '_navbar.md', '_coverpage.md', '_404.md',
  'index.html',
]);

const isSkippable = (name) => name.startsWith('.') && name !== '.nojekyll';

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (isSkippable(entry.name)) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

async function readTitle(file) {
  const text = await readFile(file, 'utf8');
  const m = text.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : path.basename(file, '.md');
}

/** 绝对文件路径 → Docsify 站点 URL（去掉 .md，README.md 视为目录首页） */
function sitePath(absFile) {
  const rel = path.relative(DOCS, absFile).replace(/\\/g, '/');
  if (rel.toLowerCase() === 'readme.md') return '/';
  if (rel.toLowerCase().endsWith('/readme.md')) {
    return '/' + rel.slice(0, -'README.md'.length);
  }
  return '/' + rel.replace(/\.md$/i, '');
}

/** 把目录名美化为主题标题：kebab-case → Title Case */
function dirTitle(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 收集 docs/ 下的一级子目录，每个目录作为一个主题 */
async function collectTopics() {
  const topics = [];
  for (const entry of await readdir(DOCS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (isSkippable(entry.name) || SKIP_DIRS.has(entry.name)) continue;

    const dir = path.join(DOCS, entry.name);
    const mds = await walk(dir);
    if (mds.length === 0) continue;

    // README.md 排第一；其他按文件名（中文按 Unicode 排）
    mds.sort((a, b) => {
      const aIs = path.basename(a).toLowerCase() === 'readme.md' ? -1 : 0;
      const bIs = path.basename(b).toLowerCase() === 'readme.md' ? -1 : 0;
      if (aIs !== bIs) return aIs - bIs;
      return a.localeCompare(b, 'zh');
    });

    const titles = new Map();
    for (const f of mds) titles.set(f, await readTitle(f));

    topics.push({ name: entry.name, dir, files: mds, titles });
  }
  topics.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return topics;
}

function buildSidebar(topics) {
  const lines = ['- [首页](/)'];
  if (topics.length === 0) {
    lines.push('');
    lines.push('- **示例主题**');
    lines.push('  - [还没有主题](/about)');
    return lines.join('\n') + '\n';
  }
  lines.push('');
  for (const t of topics) {
    lines.push(`- **${dirTitle(t.name)}**`);
    for (const f of t.files) {
      lines.push(`  - [${t.titles.get(f)}](${sitePath(f)})`);
    }
  }
  return lines.join('\n') + '\n';
}

function buildTopicsBlock(topics) {
  if (topics.length === 0) {
    return '_还没有主题目录。在 `docs/` 下新建一个文件夹，里面放 `README.md` 作为首页。_';
  }
  const out = [];
  for (const t of topics) {
    out.push(`## ${dirTitle(t.name)}`, '');
    for (const f of t.files) {
      out.push(`- [${t.titles.get(f)}](${sitePath(f)})`);
    }
    out.push('');
  }
  return out.join('\n').trimEnd();
}

const START = '<!-- topics:start -->';
const END = '<!-- topics:end -->';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function main() {
  const topics = await collectTopics();
  const total = topics.reduce((n, t) => n + t.files.length, 0);

  // 1) 写 _sidebar.md
  const sidebarPath = path.join(DOCS, '_sidebar.md');
  await writeFile(sidebarPath, buildSidebar(topics), 'utf8');

  // 2) 更新 README.md 的 topics 段
  const readmePath = path.join(DOCS, 'README.md');
  let readme = existsSync(readmePath)
    ? await readFile(readmePath, 'utf8')
    : '# 我的笔记\n\n> 按主题归档的 Markdown 笔记。\n\n';
  const block = buildTopicsBlock(topics);
  const replacement = `${START}\n\n${block}\n\n${END}`;

  if (readme.includes(START) && readme.includes(END)) {
    const re = new RegExp(`${escapeRe(START)}[\\s\\S]*?${escapeRe(END)}`);
    readme = readme.replace(re, replacement);
  } else {
    if (!readme.endsWith('\n')) readme += '\n';
    readme += `\n## 目录\n\n${replacement}\n`;
  }
  await writeFile(readmePath, readme, 'utf8');

  console.log(`生成完成：${total} 个文档，${topics.length} 个主题`);
  for (const t of topics) console.log(`  ${t.name}/  (${t.files.length} 篇)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
