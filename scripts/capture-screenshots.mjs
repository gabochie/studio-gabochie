// capture-screenshots.mjs
// Captures real screenshots of the LIVE studio.gabochie.com for the README.
// Usage: node scripts/capture-screenshots.mjs
// Env:   CAPTURE_BASE=https://studio.gabochie.com
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.CAPTURE_BASE || 'https://studio.gabochie.com'
const OUT = path.resolve('docs/screenshots')

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'membership', path: '/membership/' },
  { name: 'school', path: '/school/' },
  { name: 'books', path: '/books/' },
  { name: 'nationbuilding', path: '/nationbuilding/' },
]

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()

for (const p of PAGES) {
  const url = BASE + p.path
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2500)
    const file = path.join(OUT, `${p.name}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 82, fullPage: false })
    console.log(`ok  ${p.name}  ${url}`)
  } catch (e) {
    console.warn(`ERR ${p.name}  ${url}  ${e.message}`)
  }
}

await browser.close()
console.log(`\nSaved to ${OUT}`)
