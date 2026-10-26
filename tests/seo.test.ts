import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url))
const readText = (path: string) => read(path).toString('utf8')

const { homepage } = JSON.parse(readText('package.json')) as { homepage: string }
const indexHtml = readText('index.html')

const metaContent = (attribute: 'property' | 'name', key: string) =>
  new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="([^"]*)"`).exec(indexHtml)?.[1]

describe('SEO assets', () => {
  it('keeps the production URL in the homepage field with a trailing slash', () => {
    expect(homepage).toMatch(/^https:\/\/.+\/$/)
  })

  it('points robots.txt at the sitemap of the production site', () => {
    const robots = readText('public/robots.txt')

    expect(robots).toMatch(/^User-agent: \*$/m)
    expect(robots).toContain(`Sitemap: ${homepage}sitemap.xml`)
  })

  it('lists the production URL in the sitemap', () => {
    const sitemap = readText('public/sitemap.xml')

    expect(sitemap).toContain(`<loc>${homepage}</loc>`)
  })

  it('uses the production URL for the canonical link and og:url', () => {
    expect(indexHtml).toContain(`<link rel="canonical" href="${homepage}" />`)
    expect(metaContent('property', 'og:url')).toBe(homepage)
  })

  it('points og:image at an absolute URL of a file in public/', () => {
    expect(metaContent('property', 'og:image')).toBe(`${homepage}og-image.png`)
    expect(metaContent('name', 'twitter:card')).toBe('summary_large_image')
  })

  it('ships a PNG for og:image whose size matches the declared dimensions', () => {
    const png = read('public/og-image.png')

    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(Number(metaContent('property', 'og:image:width')))
    expect(png.readUInt32BE(20)).toBe(Number(metaContent('property', 'og:image:height')))
  })
})
