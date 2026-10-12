#!/usr/bin/env node
/**
 * 校验 docs/ 下的 Markdown：
 *   1. 引用的图片文件是否存在（含大小写检查）
 *   2. 站内链接是否能指向真实文件
 *
 * 用法：node scripts/check-links.mjs
 * 退出码 0 = 全部通过，1 = 有问题（CI 会因此失败）
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.bmp']);

// 跳过：站点自身、锚点、协议链接
const isExternal = (u) => /^(https?:)?\/\//i.test(u) || /^(mailto|tel|data):/i.test(u);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    // GitHub Pages 默认会忽略下划线开头的文件，而 .nojekyll 是必须保留的例外
    if (entry.name.startsWith('.') && entry.name !== '.nojekyll') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/**
 * 从 markdown 文本里抽出所有 ![](...) 和 [](...) 的目标
 *
 * 围栏要按长度从长到短剥：README.md 用 ```` 包裹内含 ``` 的示例代码，
 * 若直接用 /```[\s\S]*?```/g 去剥，非贪婪匹配会在四反引号块内部错位配对，
 * 把示例里的内容当成正文（误报），也可能吞掉真正的引用（漏报）。
 */
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\1[^\n]*$|(`{3,}|~{3,})[\s\S]*?\3/gm;

function stripCode(md) {
  return md.replace(FENCE_RE, (m) => m.replace(/\S/g, ' ')).replace(/`[^`\n]*`/g, '');
}

function extractTargets(md) {
  const targets = [];
  const text = stripCode(md);
  const re = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) targets.push(m[1]);
  return targets;
}

/**
 * 找出磁盘上大小写不匹配的目标。
 * Windows 下 existsSync('A/Sql.md') 会命中 'a/sql.md' 并返回 true，
 * 但 GitHub Pages 跑 Linux，区分大小写 —— 本地过、线上 404。
 */
async function caseMismatchFor(abs) {
  const dir = path.dirname(abs);
  const name = path.basename(abs);
  if (!existsSync(dir)) return null;
  const entries = await readdir(dir);
  const ci = entries.find((e) => e.toLowerCase() === name.toLowerCase());
  return ci && ci !== name ? ci : null;
}

/** 从 docs/ 根往下逐级比对大小写，目录名写错也能查出来 */
async function caseMismatchChain(abs) {
  const rel = path.relative(DOCS, abs).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..')) return null;
  let cur = DOCS;
  for (const seg of rel.split('/')) {
    if (!seg) continue;
    const real = await caseMismatchFor(path.join(cur, seg));
    if (real) return { real, wrote: seg };
    cur = path.join(cur, seg);
  }
  return null;
}

async function main() {
  if (!existsSync(DOCS)) {
    console.error('找不到 docs/ 目录');
    process.exit(1);
  }

  const files = await walk(DOCS);
  const mds = files.filter((f) => /\.md$/i.test(f));

  const errors = [];
  const warns = [];
  let imageCount = 0;
  let linkCount = 0;

  for (const file of mds) {
    const relFile = path.relative(ROOT, file).replace(/\\/g, '/');
    const md = await readFile(file, 'utf8');

    // 本文件所在目录。a/index.md 对应站点上的 /a/，
    // 但由于开了 relativePath，链接是相对「文件目录」写的，
    // 所以 index.md 里也用 images/xxx.svg，不多写一层。
    const baseDir = path.dirname(file);

    for (const target of extractTargets(md)) {
      if (isExternal(target) || target.startsWith('#')) continue;
      const clean = decodeURIComponent(target.split('#')[0].split('?')[0]);
      if (!clean) continue;

      const isImage = IMAGE_EXT.has(path.extname(clean).toLowerCase());
      if (isImage) imageCount++;
      else linkCount++;

      // 站内绝对链接以 / 开头，相对 baseDir 的上级（站点根）
      const isRootAbs = clean.startsWith('/');
      const fromDir = isRootAbs ? DOCS : baseDir;
      const rel = isRootAbs ? clean.slice(1) : clean;
      const abs = path.resolve(fromDir, rel);

      const candidates = isImage
        ? [abs]
        : [abs, abs + '.md', path.join(abs, 'README.md'), path.join(abs, 'index.md')];

      const hit = candidates.find((c) => existsSync(c));

      if (!hit) {
        errors.push(`${relFile}\n    引用不存在：${target}\n    解析为：${path.relative(ROOT, abs).replace(/\\/g, '/')}`);
        continue;
      }

      // 大小和「大小写」两件事都要看：GitHub Pages 跑 Linux，区分大小写，
      // 本地 Windows 能打开不代表线上打得开。
      const mismatch = await caseMismatchChain(hit);
      if (mismatch) {
        warns.push(`${relFile}\n    大小写不一致：实际是 ${mismatch.real}，写的是 ${mismatch.wrote}`);
      }

      if (isImage) {
        const st = await stat(hit);
        if (st.size > 1024 * 1024) {
          warns.push(`${relFile}\n    图片偏大（${(st.size / 1024 / 1024).toFixed(2)} MB）：${path.basename(hit)}`);
        }
      }
    }
  }

  console.log(`扫描 ${mds.length} 个 Markdown，${imageCount} 处图片引用，${linkCount} 处站内链接`);

  if (warns.length) {
    console.log(`\n提示 ${warns.length} 条（不阻断）：`);
    warns.forEach((w) => console.log('  ! ' + w));
  }

  if (errors.length) {
    console.log(`\n错误 ${errors.length} 条：`);
    errors.forEach((e) => console.log('  x ' + e));
    console.log('\n修复后重新运行。GitHub 服务器区分大小写，且 Docsify 的相对路径以当前文件目录为基准。');
    process.exit(1);
  }

  console.log('\n全部通过。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
