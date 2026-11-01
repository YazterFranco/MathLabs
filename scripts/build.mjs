// Compilación sin dependencias: quita los tipos de TypeScript con Node y copia los archivos estáticos a dist/.
import { stripTypeScriptTypes } from 'node:module';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'js'), { recursive: true });

for (const file of await walk(src)) {
  if (!file.endsWith('.ts')) continue;
  const code = await readFile(file, 'utf8');
  const js = stripTypeScriptTypes(code, { mode: 'strip' }).replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.js$2');
  const target = join(dist, 'js', relative(src, file).replace(/\.ts$/, '.js'));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, js);
}

await cp(join(src, 'styles.css'), join(dist, 'styles.css'));
await cp(join(root, 'index.html'), join(dist, 'index.html'));
await cp(join(root, 'public'), dist, { recursive: true });

// El service worker precarga todo lo que se publica (la lista se escribe aquí).
const files = (await walk(dist)).map((f) => relative(dist, f).split('\\').join('/')).filter((f) => f !== 'sw.js' && f !== '_headers');
const precache = ['./', ...files.map((f) => `./${f}`)];
const swPath = join(dist, 'sw.js');
const version = Date.now().toString(36);
const sw = (await readFile(swPath, 'utf8')).replace('__PRECACHE__', JSON.stringify(precache)).replace('__VERSION__', version);
await writeFile(swPath, sw);

const total = (await Promise.all(files.map((f) => stat(join(dist, f))))).reduce((n, s) => n + s.size, 0);
console.log(`dist listo: ${files.length} archivos, ${(total / 1024).toFixed(1)} KB`);
