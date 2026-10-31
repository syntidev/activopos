import { test, expect } from '@playwright/test'
import { parseUserAgent, isBotUserAgent, requestGeo } from '../src/lib/pulso-ua'
import { isStorableSearch, normalizeSearchTerm } from '../src/lib/pulso-events'
import { parseUtm, externalReferrerHost, nextSession, mergeAttribution } from '../src/lib/pulso-attribution'

/** Unit (sin navegador, sin servidor): parseo de user-agent, UTM y sesión de Pulso. */

const UA = {
  iphoneSafari:  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  ipad:          'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  winChrome:     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  winEdge:       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  macFirefox:    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0',
  macSafari:     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  instagramApp:  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0',
  googlebot:     'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  lighthouse:    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
}

test.describe('parseUserAgent', () => {
  test('iPhone Safari: mobile / iOS / Safari', () => {
    expect(parseUserAgent(UA.iphoneSafari)).toMatchObject({ device: 'mobile', os: 'iOS', browser: 'Safari' })
  })
  test('Android Chrome: mobile / Android / Chrome', () => {
    expect(parseUserAgent(UA.androidChrome)).toMatchObject({ device: 'mobile', os: 'Android', browser: 'Chrome' })
  })
  test('iPad: tablet', () => {
    expect(parseUserAgent(UA.ipad).device).toBe('tablet')
  })
  test('Windows Chrome: desktop / Windows / Chrome', () => {
    expect(parseUserAgent(UA.winChrome)).toMatchObject({ device: 'desktop', os: 'Windows', browser: 'Chrome' })
  })
  test('Edge se detecta como Edge y no como Chrome', () => {
    expect(parseUserAgent(UA.winEdge).browser).toBe('Edge')
  })
  test('Firefox y Safari de escritorio', () => {
    expect(parseUserAgent(UA.macFirefox)).toMatchObject({ device: 'desktop', browser: 'Firefox' })
    expect(parseUserAgent(UA.macSafari)).toMatchObject({ device: 'desktop', browser: 'Safari' })
  })
  test('UA vacío o nulo no lanza y cae en desktop sin os/browser', () => {
    for (const ua of [null, '']) {
      const r = parseUserAgent(ua)
      expect(r.device).toBe('desktop')
      expect(r.os ?? null).toBeNull()
      expect(r.browser ?? null).toBeNull()
    }
  })
})

test.describe('isBotUserAgent', () => {
  test('bots y herramientas', () => {
    for (const ua of [UA.googlebot, UA.lighthouse, 'curl/8.4.0', 'python-requests/2.31', 'Wget/1.21', null, '']) {
      expect(isBotUserAgent(ua), String(ua)).toBe(true)
    }
  })
  test('personas, incluido el navegador interno de Instagram', () => {
    for (const ua of [UA.iphoneSafari, UA.androidChrome, UA.winChrome, UA.instagramApp]) {
      expect(isBotUserAgent(ua), ua).toBe(false)
    }
  })
})

test.describe('requestGeo (Cloudflare)', () => {
  test('país y ciudad válidos', () => {
    expect(requestGeo(new Headers({ 'cf-ipcountry': 'VE', 'cf-ipcity': 'Porlamar' }))).toEqual({ country: 'VE', city: 'Porlamar' })
  })
  test('XX, T1, minúsculas inválidas o largas se descartan', () => {
    for (const c of ['XX', 'T1', 'venezuela', 'V', '']) {
      expect(requestGeo(new Headers({ 'cf-ipcountry': c })).country, c).toBeNull()
    }
  })
  test('sin cabeceras: todo null', () => {
    expect(requestGeo(new Headers())).toEqual({ country: null, city: null })
  })
  test('ciudad percent-encoded y recortada a 80', () => {
    expect(requestGeo(new Headers({ 'cf-ipcountry': 'VE', 'cf-ipcity': 'Ciudad%20Guayana' })).city).toBe('Ciudad Guayana')
    expect(requestGeo(new Headers({ 'cf-ipcountry': 'VE', 'cf-ipcity': 'x'.repeat(200) })).city).toHaveLength(80)
  })
})

test.describe('parseUtm', () => {
  test('lee los cinco UTM, en minúsculas source y medium', () => {
    expect(parseUtm('?utm_source=Instagram&utm_medium=Social&utm_campaign=Gran-Fondo&utm_content=reel1&utm_term=garmin')).toEqual({
      utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'Gran-Fondo', utm_content: 'reel1', utm_term: 'garmin',
    })
  })
  test('sin UTM, vacíos o sin "?" devuelve lo que corresponda', () => {
    expect(parseUtm('')).toEqual({})
    expect(parseUtm('?foo=bar&utm_source=')).toEqual({})
    expect(parseUtm('utm_source=wa')).toEqual({ utm_source: 'wa' })
  })
  test('recorta valores largos (80/100)', () => {
    const r = parseUtm(`?utm_campaign=${'a'.repeat(200)}&utm_term=${'b'.repeat(200)}`)
    expect(r.utm_campaign).toHaveLength(80)
    expect(r.utm_term).toHaveLength(100)
  })
})

test.describe('externalReferrerHost', () => {
  test('host externo sin www', () => {
    expect(externalReferrerHost('https://www.instagram.com/p/abc', 'activopos.com')).toBe('instagram.com')
  })
  test('mismo host, vacío o inválido: undefined', () => {
    expect(externalReferrerHost('https://activopos.com/catalogo-premium/onbike', 'activopos.com')).toBeUndefined()
    expect(externalReferrerHost('', 'activopos.com')).toBeUndefined()
    expect(externalReferrerHost('no-es-url', 'activopos.com')).toBeUndefined()
  })
})

test.describe('nextSession (30 min de inactividad)', () => {
  const MIN = 60_000
  const newId = (): string => 'nuevo-id'
  const NOW = 1_800_000_000_000
  test('sin sesión previa crea una', () => {
    expect(nextSession(null, NOW, newId)).toEqual({ id: 'nuevo-id', lastSeen: NOW, renewed: true })
  })
  test('dentro de 30 min conserva el id y actualiza lastSeen', () => {
    expect(nextSession({ id: 'viejo', lastSeen: NOW - 29 * MIN }, NOW, newId)).toEqual({ id: 'viejo', lastSeen: NOW, renewed: false })
  })
  test('pasados 30 min renueva', () => {
    expect(nextSession({ id: 'viejo', lastSeen: NOW - 31 * MIN }, NOW, newId)).toEqual({ id: 'nuevo-id', lastSeen: NOW, renewed: true })
  })
})

test.describe('mergeAttribution', () => {
  test('sesión nueva: solo lo entrante', () => {
    expect(mergeAttribution({ utm_source: 'viejo' }, { utm_source: 'nuevo' }, true)).toEqual({ utm_source: 'nuevo' })
  })
  test('misma sesión sin UTM entrante: conserva la atribución original', () => {
    expect(mergeAttribution({ utm_source: 'ig', utm_campaign: 'c1', referrer_host: 'instagram.com' }, {}, false)).toEqual({
      utm_source: 'ig', utm_campaign: 'c1', referrer_host: 'instagram.com',
    })
  })
  test('misma sesión con UTM entrante nuevo: lo reemplaza', () => {
    const r = mergeAttribution({ utm_source: 'ig', referrer_host: 'instagram.com' }, { utm_source: 'wa' }, false)
    expect(r.utm_source).toBe('wa')
  })
})

test.describe('búsquedas: filtro del servidor y agrupación del panel', () => {
  test('guarda búsquedas normales', () => {
    for (const q of ['garmin', 'ab', 'Cámara 360', 'forerunner 255', 'x'.repeat(60)]) expect(isStorableSearch(q), q).toBe(true)
  })
  test('descarta markup, control, muy corta/larga, sin letras ni números y datos personales', () => {
    const malas = ['<s', '<scrip>ale', '<script>alert(1)</script>', 'a>b', 'a', ' a ', '', '  ', '!!', '--', 'x'.repeat(61), 'hola\u0007', 'li\nne', 'a@b.com', '04141234567', '０４１４５５５１２３４', '＜script＞', 'za​patos']
    for (const q of malas) expect(isStorableSearch(q), JSON.stringify(q)).toBe(false)
  })
  test('normalizeSearchTerm: minúsculas, sin tildes, espacios colapsados', () => {
    expect(normalizeSearchTerm('  CAMIÓN   Grúa ')).toBe('camion grua')
    expect(normalizeSearchTerm('Camión')).toBe(normalizeSearchTerm('camion'))
  })
})
