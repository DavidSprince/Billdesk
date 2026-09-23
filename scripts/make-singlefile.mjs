// Inlines the built JS + CSS into ONE self-contained HTML file (no server needed).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, '..', 'dist')
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

const jsFile = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1]
const cssFile = html.match(/href="(\/assets\/index-[^"]+\.css)"/)?.[1]
if (!jsFile || !cssFile) throw new Error('Built assets not found — run `npm run build` first.')

const js = fs.readFileSync(path.join(dist, jsFile), 'utf8').replace(/<\/script/gi, '<\\/script')
const css = fs.readFileSync(path.join(dist, cssFile), 'utf8')

html = html.replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/,
  () => `<script type="module">\n${js}\n</script>`)
html = html.replace(/<link rel="stylesheet"[^>]*href="[^"]+"[^>]*>/,
  () => `<style>\n${css}\n</style>`)
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '')

const out = process.argv[2] || path.join(here, '..', '..', 'billdesk-demo.html')
fs.writeFileSync(out, html)
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB')
