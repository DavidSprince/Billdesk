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
const origErr = console.error
console.error = (...a) => origErr('[console.error]', ...a)
dom.window.addEventListener('error', (e) => origErr('[window.error]', String(e.error?.stack || e.message).slice(0, 400)))

await import(path.join(dist, jsPath))
for (const ms of [300, 1000, 2500]) {
  await new Promise(r => setTimeout(r, ms))
  const root = dom.window.document.getElementById('root')
  console.log(`after +${ms}ms → children: ${root.children.length}, len: ${root.innerHTML.length}, snippet: ${root.innerHTML.slice(0, 120).replace(/\n/g, ' ')}`)
}
