// Headless smoke test: loads the production bundle in jsdom and checks the app renders.
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

const dom = new JSDOM(html, { url: 'https://test.local/', pretendToBeVisual: true })

// minimal browser globals for the bundle
global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator
global.localStorage = dom.window.localStorage
global.HTMLElement = dom.window.HTMLElement
global.SVGElement = dom.window.SVGElement
global.Element = dom.window.Element
global.Node = dom.window.Node
global.CustomEvent = dom.window.CustomEvent
global.MouseEvent = dom.window.MouseEvent
global.getComputedStyle = dom.window.getComputedStyle
global.MutationObserver = dom.window.MutationObserver
global.IntersectionObserver = dom.window.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} }
dom.window.requestAnimationFrame = (cb) => setTimeout(cb, 0)
dom.window.cancelAnimationFrame = clearTimeout
try { Object.defineProperty(dom.window, 'crypto', { value: webcrypto }) } catch {}
try { Object.defineProperty(globalThis, 'crypto', { value: webcrypto }) } catch {}

const errors = []
dom.window.addEventListener('error', (e) => errors.push(e.error?.stack || e.message))
const origErr = console.error
console.error = (...a) => { errors.push(a.map(String).join(' ')) }

await import(path.join(dist, jsPath))
await new Promise(r => setTimeout(r, 1000))

const root = dom.window.document.getElementById('root')
const text = root.innerHTML
console.error = origErr
console.log('root has content :', root.children.length > 0)
console.log('login rendered   :', text.includes('Sign in securely') && text.includes('BillDesk') && text.includes('Official email'))
console.log('errors           :', errors.length ? errors.slice(0, 4) : 'none')
process.exit(errors.length && root.children.length === 0 ? 1 : 0)
