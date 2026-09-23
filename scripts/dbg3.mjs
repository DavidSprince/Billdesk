import fs from 'node:fs'
import path from 'node:path'
import { webcrypto } from 'node:crypto'
import { JSDOM } from 'jsdom'

const dist = '/home/user/billdesk/dist'
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const jsPath = html.match(/src="(\/assets\/index-[^"]+\.js)"/)[1]
const js = fs.readFileSync(path.join(dist, jsPath), 'utf8')

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

dom.window.localStorage.setItem('billdesk_session_v2', 'u3')
dom.window.location.hash = '#/bills'

const msgs = []
dom.window.addEventListener('error', (e) => msgs.push('WINDOW: ' + String(e.message)))
const origErr = console.error
console.error = (...a) => { const s = a.map(x => (x?.stack || String(x))).join(' '); const m = s.match(/Error: [^\n]{0,200}/); if (m) msgs.push('CERR: ' + m[0]) }

try {
  await import(path.join(dist, jsPath))
} catch (e) {
  msgs.push('IMPORT: ' + String(e.message).slice(0, 300))
}
await new Promise(r => setTimeout(r, 2000))
console.error = origErr
const root = dom.window.document.getElementById('root')
console.log('root len:', root.innerHTML.length)
console.log('errors:')
msgs.slice(0, 6).forEach(m => console.log('  -', m.replace(/\n/g, ' ').slice(0, 250)))
