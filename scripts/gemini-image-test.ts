/**
 * Verificación visual del motor Gemini de imagen (PASO 5).
 * Genera una imagen real y la escribe a disco para que la abras y compares con
 * el estilo documental de NVIDIA. Claude no puede ver imágenes ni ejecutar el
 * endpoint autenticado, así que esta comprobación la corres tú.
 *
 * Uso (con GEMINI_API_KEY en .env cargada):
 *   npx tsx scripts/gemini-image-test.ts
 * Salida: scripts/_out/gemini-test-<preset>.png
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { generateBackgroundGemini, type SlideRole } from '../src/lib/social/gemini-image'

async function main() {
  const outDir = join(process.cwd(), 'scripts', '_out')
  mkdirSync(outDir, { recursive: true })

  // Un caso por rol + uno simple (preset aleatorio), para ver la variedad.
  const cases: { label: string; slideRole?: SlideRole }[] = [
    { label: 'portada',   slideRole: 'portada' },
    { label: 'problema',  slideRole: 'problema' },
    { label: 'beneficio', slideRole: 'beneficio' },
    { label: 'simple' },
  ]

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    console.log(`Generando: ${c.label}…`)
    const buf = await generateBackgroundGemini({
      escena: 'mostrador de una bodega con productos en estantes',
      nicho:  'bodega',
      aspect: '4:5',
      slideRole: c.slideRole,
      slideIndex: i,
    })
    const path = join(outDir, `gemini-test-${c.label}.png`)
    writeFileSync(path, buf)
    console.log(`  -> ${path} (${(buf.length / 1024).toFixed(0)} KB)`)
  }

  console.log('\nListo. Abre las imágenes en scripts/_out/ y compara con el estilo NVIDIA.')
}

main().catch(err => { console.error('FALLÓ:', err); process.exit(1) })
