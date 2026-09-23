import fs from 'node:fs'
import path from 'node:path'
import { webcrypto } from 'node:crypto'
import { JSDOM } from 'jsdom'

process.on('uncaughtException', (e) => {
  console.log('UNCAUGHT MESSAGE:', String(e.message).slice(0, 400))
  console.log('STACK HEAD:', String(e.stack).split('\n').slice(0, 4).join(' | ').slice(0, 400))
})

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

await import(path.join(dist, jsPath))
await new Promise(r => setTimeout(r, 2000))
const root = dom.window.document.getElementById('root')
console.log('root len:', root.innerHTML.length)
