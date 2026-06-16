/**
 * Generate PWA icons for ActivoPOS
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/generate-icons.ts
 */
import sharp from 'sharp'
import * as path from 'path'
import * as fs from 'fs'

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2563EB"/>
  <text
    x="256"
    y="352"
    font-size="300"
    font-weight="700"
    font-family="Inter, Arial, sans-serif"
    fill="white"
    text-anchor="middle"
    dominant-baseline="auto"
  >A</text>
</svg>`

const outDir = path.resolve(__dirname, '../public/icons')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

async function main() {
  const svgBuf = Buffer.from(SVG)

  for (const size of SIZES) {
    const outPath = path.join(outDir, `icon-${size}.png`)
    await sharp(svgBuf)
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`✓ icon-${size}.png`)
  }

  console.log('\nAll icons generated in public/icons/')
}

main().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
