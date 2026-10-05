// Check del fix 2026-10-05 (bug real: slide de banner solo-imagen rechazado
// en silencio al guardar). Correr: node scripts/check-landing-slide-schema.mjs
// Falla si title/subtitle vuelven a exigir min(1), o si cta_text/cta_link/
// image_url dejan de ser obligatorios (un slide siempre necesita imagen y CTA).
import assert from 'node:assert/strict'
import { CONFIG_SCHEMAS } from '../src/lib/landing-sections.ts'

const slideBase = {
  cta_text: 'Ver catálogo', cta_link: '/catalogo-premium/onbike/productos',
  image_url: '/storage/tenants/87/landing/x.webp',
}
const config = (slide) => ({ slides: [{ ...slideBase, title: 'A', subtitle: 'B' }, slide] })

// Caso real del bug: slide solo-imagen, title y subtitle vacíos -> debe PASAR.
const onlyImage = CONFIG_SCHEMAS.event_slider.safeParse(config({ ...slideBase, title: '', subtitle: '' }))
assert.ok(onlyImage.success, 'un slide con title/subtitle vacíos debe guardarse (banner solo-imagen)')

// title/subtitle presentes siguen funcionando igual que antes.
const withText = CONFIG_SCHEMAS.event_slider.safeParse(config({ ...slideBase, title: 'Promo', subtitle: 'Hasta agotar stock' }))
assert.ok(withText.success, 'un slide con texto sigue siendo válido')

// Lo que SÍ debe seguir obligatorio: imagen y CTA -- un slide sin eso no es un slide.
for (const field of ['cta_text', 'cta_link', 'image_url']) {
  const bad = { ...slideBase, title: '', subtitle: '', [field]: '' }
  const r = CONFIG_SCHEMAS.event_slider.safeParse(config(bad))
  assert.ok(!r.success, `"${field}" vacío debe seguir rechazándose`)
}

// .strict(): un campo desconocido se rechaza igual que antes (sin relajar de más).
const extra = CONFIG_SCHEMAS.event_slider.safeParse(config({ ...slideBase, title: '', subtitle: '', bogus: 'x' }))
assert.ok(!extra.success, 'strict() debe seguir rechazando campos desconocidos')

console.log('OK — schema del slider (banner solo-imagen) intacto')
