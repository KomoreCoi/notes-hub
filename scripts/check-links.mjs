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

/** 从 markdown 文本里抽出所有 ![](...) 和 [](...) 的目标 */
function extractTargets(md) {
  const targets = [];
  // 先剥掉围栏代码块，避免把示例代码里的路径误判为真实引用
  const text = md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const re = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) targets.push(m[1]);
  return targets;
}

/** Docsify 支持省略扩展名：/a/sql -> a/sql.md 或 a/sql/index.md */
function resolveDoc(baseDir, linkPath) {
  const abs = path.resolve(baseDir, linkPath);
  const candidates = [
    abs,
    abs + '.md',
    path.join(abs, 'README.md'),
    path.join(abs, 'index.md'),
    abs + '.html',
  ];
  return candidates.find((c) => existsSync(c) && !existsSync(path.dirname(c) + path.sep));
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

      // 大小写：Linux 服务器区分大小写，Windows 不区分
      if (isImage) {
        const dir = path.dirname(abs);
        const name = path.basename(abs);
        if (existsSync(dir)) {
          const entries = await readdir(dir);
          const ci = entries.find((e) => e.toLowerCase() === name.toLowerCase());
          if (ci && ci !== name) {
            warns.push(`${relFile}\n    大小写不一致：实际是 ${ci}，写的是 ${name}`);
          }
        }
        const st = await stat(abs);
        if (st.size > 1024 * 1024) {
          warns.push(`${relFile}\n    图片偏大（${(st.size / 1024 / 1024).toFixed(2)} MB）：${name}`);
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
