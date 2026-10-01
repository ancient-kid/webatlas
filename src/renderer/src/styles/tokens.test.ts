// The stylesheets must match DESIGN.md exactly: every token value in both themes, and
// wa.css as Appendix A (minus the Google Fonts import). DESIGN.md is read live, so a
// change on either side fails here.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string): string => readFileSync(resolve(p), 'utf8').replace(/\r\n/g, '\n')
const design = read('DESIGN.md')
const tokensCss = read('src/renderer/src/styles/tokens.css').replace(/'/g, '"')

function section(from: string, to: string): string {
  return design.slice(design.indexOf(from), design.indexOf(to))
}

/** Table rows whose first cell is a `token` name, as arrays of cell text. */
function rows(markdown: string): string[][] {
  return markdown
    .split('\n')
    .filter((l) => /^\| `[a-z0-9-]+` \|/.test(l))
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim().replace(/`/g, ''))
    )
}

/** Custom properties declared in the CSS block whose selector is exactly `selector`. */
function block(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(tokensCss)
  if (!match) throw new Error(`No CSS block for ${selector}`)
  return Object.fromEntries(
    [...match[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  )
}

const shared = block(':root')
const light = block(':root,\n[data-theme="light"]')
const dark = block('[data-theme="dark"]')

describe('tokens.css matches DESIGN.md §2', () => {
  const colours = rows(section('### 2.1 Colour', '### 2.2 Type'))
  const shadows = rows(section('### 2.5 Shadow', '## 3. Components'))

  it('finds all 31 colour tokens and 3 shadows in DESIGN.md', () => {
    expect(colours).toHaveLength(31)
    expect(shadows).toHaveLength(3)
  })

  it.each(colours)('colour %s is %s (light) and %s (dark)', (name, lightHex, darkHex) => {
    expect(light[name]).toBe(lightHex)
    expect(dark[name]).toBe(darkHex)
  })

  it.each(shadows)('shadow %s matches in both themes', (name, l, d) => {
    expect(light[name]).toBe(l)
    expect(dark[name]).toBe(d)
  })

  it('spacing and radius tokens match', () => {
    const fixed = [
      ...rows(section('### 2.3 Spacing', '### 2.4 Radius')),
      ...rows(section('### 2.4 Radius', '### 2.5 Shadow'))
    ]
    expect(fixed).toHaveLength(11)
    for (const [name, value] of fixed) expect(shared[name], name).toBe(value)
  })

  it('declares the three font families with the DESIGN.md faces first', () => {
    expect(shared['font-display']).toMatch(/^"Fraunces Variable", "Fraunces"/)
    expect(shared['font-sans']).toMatch(/^"IBM Plex Sans"/)
    expect(shared['font-mono']).toMatch(/^"IBM Plex Mono"/)
  })

  it('declares nothing in a theme that DESIGN.md does not list', () => {
    const names = new Set([...colours, ...shadows].map((r) => r[0]))
    expect(Object.keys(light).filter((n) => !names.has(n))).toEqual([])
    expect(Object.keys(dark).filter((n) => !names.has(n))).toEqual([])
  })
})

describe('wa.css', () => {
  it('is DESIGN.md Appendix A without the Google Fonts import', () => {
    const appendix = section('## Appendix A', '## Appendix B')
    const css = appendix.slice(appendix.indexOf('```css') + 6, appendix.lastIndexOf('```'))
    const expected = css.split('\n').filter((l) => l.trim() && !l.startsWith('@import'))
    const actual = read('src/renderer/src/styles/wa.css')
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('/*') && !l.startsWith('   '))
    expect(actual).toEqual(expected)
  })
})
