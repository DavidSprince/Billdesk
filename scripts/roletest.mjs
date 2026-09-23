// Per-role render test: boots the real bundle as Member / Master / Sub Admin
// and checks what the Bills page actually shows.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import { JSDOM } from 'jsdom'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, '..', 'dist')
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const jsPath = html.match(/src="(\/assets\/index-[^"]+\.js)"/)[1]
const js = fs.readFileSync(path.join(dist, jsPath), 'utf8')

process.on('uncaughtException', (e) => {
  console.log('UNCAUGHT:', String(e.message).slice(0, 200))
})

async function boot(id) {
  const dom = new JSDOM(html, { url: 'https://test.local/', pretendToBeVisual: true })
  dom.window.requestAnimationFrame = (cb) => setTimeout(cb, 0)
  dom.window.cancelAnimationFrame = clearTimeout
  try { Object.defineProperty(dom.window, 'crypto', { value: webcrypto }) } catch {}
  try { Object.defineProperty(globalThis, 'crypto', { value: webcrypto }) } catch {}
  global.window = dom.window
  global.document = dom.window.document
  global.navigator = dom.window.navigator
  global.localStorage = dom.window.localStorage
  global.HTMLElement = dom.window.HTMLElement
  global.SVGElement = dom.window.SVGElement
  global.Element = dom.window.Element
  global.Node = dom.window.Node
  global.MutationObserver = dom.window.MutationObserver
  global.getComputedStyle = dom.window.getComputedStyle

  const errs = []
  dom.window.addEventListener('error', (e) => errs.push(String(e.message).slice(0, 120)))
  const origErr = console.error
  console.error = (...a) => { const m = a.map(x => x?.stack || String(x)).join(' ').match(/Error: [^\n]{0,120}/); if (m) errs.push(m[0]) }

  dom.window.localStorage.setItem('billdesk_session_v2', id)
  dom.window.location.hash = '#/bills'

  try { await import(path.join(dist, jsPath) + '?r=' + id) } catch (e) { errs.push('IMPORT: ' + String(e.message).slice(0, 120)) }
  await new Promise(r => setTimeout(r, 2000))
  console.error = origErr

  const doc = dom.window.document
  const t = doc.getElementById('root').textContent
  const rows = doc.querySelectorAll('tbody tr').length
  return { t, rows, errs }
}

for (const [id, name] of [['u3', 'MEMBER (Sudha)'], ['u1', 'MASTER (Ramesh)'], ['u2', 'SUB ADMIN (Arun)']]) {
  const { t, rows, errs } = await boot(id)
  console.log(`\n===== ${name} =====`)
  console.log('Bills in sidebar     :', t.includes('Bills'))
  console.log('Total Bills card     :', t.includes('Total Bills'))
  console.log('Assigned-to-me card  :', t.includes('Assigned to me'))
  console.log('Add Record form      :', t.includes('Add Record'))
  console.log('Members tab          :', t.includes('Members'))
  console.log('Member note          :', t.includes('Member view'))
  console.log('Scope filter         :', t.includes('All my bills'))
  console.log('Statuses visible     :', ['Processing', 'Approved', 'Paid', 'Submitted to Admin', 'Rejected'].filter(s => t.includes(s)).join(', ') || 'none')
  console.log('Table rows           :', rows)
  console.log('Errors               :', errs.length ? errs.slice(0, 3).join(' | ') : 'none')
}
process.exit(0)
