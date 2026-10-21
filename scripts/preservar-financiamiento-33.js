// Deja el catálogo público del negocio 33 (OnBike) IDÉNTICO tras desplegar el financiamiento configurable.
//
// Antes: el sello Cashea salía solo en productos con financing_eligible = 1 (toggle del negocio catalog_financing_badge).
// Después: sale en TODO producto con financing_excluded = 0 (por defecto todos). Para que el catálogo no cambie, hay que
// marcar financing_excluded = 1 en los productos que hoy NO son elegibles (financing_eligible = 0). Este script lo hace.
//
// JS plano: `node scripts/preservar-financiamiento-33.js ...`. Correr DESDE la carpeta de la app (/var/www/activopos):
// lee DB_HOST, DB_USER, DB_PASSWORD y DB_NAME de su .env y usa `mariadb` de su node_modules. No usa tsx ni ts-node.
// No hace peticiones de red. No imprime secretos. SIEMPRE acotado a business_id = 33 (en cada consulta).
//
// PRERREQUISITO: la migración 20261020000003_add_product_financing_excluded ya aplicada (si no, el script aborta).
//
// SIMULACION por defecto: solo escribe con --aplicar, y --aplicar exige --host-esperado, --db-esperada y --respaldo.
//
//   node scripts/preservar-financiamiento-33.js                                   (simulación: lista lo que marcaría)
//   node scripts/preservar-financiamiento-33.js --aplicar --host-esperado <DB_HOST> --db-esperada <DB_NAME> --respaldo <carpeta>
//
// Respaldo: antes de escribir guarda <carpeta>/financiamiento33_<fecha>.json con los ids afectados, su estado anterior y el
// SQL EXACTO de reversa. Es idempotente: solo toca filas con financing_eligible = 0 Y financing_excluded = 0.
// El catálogo público cachea hasta 60 s: el cambio se ve solo en ≤ 1 minuto (o con el próximo cambio de config/producto).
//
// Solo para probar en LOCAL: --business-id 87 (se rechaza si DB_HOST no es 127.0.0.1/localhost).
'use strict'
const fs = require('fs')
const path = require('path')

const BUSINESS_ID_PROD = 33
const REQUIRED_NAME_PART = 'onbike'
const LOCAL_HOSTS = ['127.0.0.1', 'localhost']

const args = process.argv.slice(2)
const argOf = f => { const i = args.indexOf(f); return i >= 0 ? (args[i + 1] || '') : '' }
const APPLY = args.includes('--aplicar')

function loadEnv() {
  const file = path.join(process.cwd(), '.env')
  if (!fs.existsSync(file)) return false
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    const key = line.slice(0, i).trim()
    if (i > 0 && /^[A-Z_][A-Z0-9_]*$/.test(key) && process.env[key] === undefined) {
      process.env[key] = line.slice(i + 1).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '')
    }
  }
  return true
}

const num = v => Number(v)

async function main() {
  const hadEnv = loadEnv()
  for (const k of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
    if (!process.env[k]) throw new Error(`Falta ${k} (.env en ${process.cwd()}: ${hadEnv ? 'existe' : 'NO existe'})`)
  }
  const host = process.env.DB_HOST
  const dbName = process.env.DB_NAME
  const local = LOCAL_HOSTS.includes(host)
  const bidArg = argOf('--business-id')
  const businessId = bidArg ? Number(bidArg) : BUSINESS_ID_PROD
  if (!Number.isInteger(businessId) || businessId <= 0) throw new Error('--business-id inválido')
  if (businessId !== BUSINESS_ID_PROD && !local) throw new Error('--business-id distinto de 33 solo se permite contra una DB local')

  const backupDir = argOf('--respaldo')
  if (APPLY) {
    if (!argOf('--host-esperado') || !argOf('--db-esperada')) throw new Error('--aplicar exige --host-esperado <host> y --db-esperada <nombre>')
    if (host !== argOf('--host-esperado')) throw new Error(`DB_HOST es "${host}" y se esperaba "${argOf('--host-esperado')}"; se aborta sin escribir`)
    if (dbName !== argOf('--db-esperada')) throw new Error(`DB_NAME es "${dbName}" y se esperaba "${argOf('--db-esperada')}"; se aborta sin escribir`)
    if (!backupDir || !fs.existsSync(backupDir) || !fs.statSync(backupDir).isDirectory()) throw new Error('--aplicar exige --respaldo <carpeta existente> donde guardar el respaldo')
  }

  const mariadb = require(require.resolve('mariadb', { paths: [process.cwd()] }))
  const conn = await mariadb.createConnection({
    host, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD || '', database: dbName,
    ...(local ? { allowPublicKeyRetrieval: true } : {}),
  })
  try {
    console.log(`MODO: ${APPLY ? 'APLICAR (escribe en la DB)' : 'SIMULACIÓN (no escribe nada)'} · negocio ${businessId} · DB ${dbName} @ ${host}`)

    const biz = (await conn.query('SELECT id, name, settings FROM businesses WHERE id = ?', [businessId]))[0]
    if (!biz) throw new Error(`No existe el negocio ${businessId}`)
    if (!String(biz.name).toLowerCase().includes(REQUIRED_NAME_PART)) throw new Error(`El negocio ${businessId} se llama "${biz.name}", no contiene "OnBike"; se aborta`)
    console.log(`Negocio verificado: ${num(biz.id)} = "${biz.name}"`)

    const col = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'financing_excluded'")
    if (num(col[0].n) !== 1) throw new Error('Falta la columna products.financing_excluded: aplica primero la migración 20261020000003_add_product_financing_excluded')

    const settings = typeof biz.settings === 'string' ? JSON.parse(biz.settings) : (biz.settings || {})
    const legacyBadge = settings.catalog_financing_badge ?? null
    const cfg = settings.financing ?? null
    console.log(`Financiamiento del negocio: catalog_financing_badge=${JSON.stringify(legacyBadge)} · settings.financing=${cfg ? JSON.stringify({ enabled: cfg.enabled, mode: cfg.mode }) : 'no existe'}`)
    const active = cfg ? cfg.enabled === true : legacyBadge === 'cashea'
    if (!active) console.log('AVISO: el financiamiento está APAGADO en este negocio: el catálogo no muestra sello y este script no cambia lo visible.')

    const all = await conn.query('SELECT id, name, active, financing_eligible, financing_excluded FROM products WHERE business_id = ? ORDER BY id', [businessId])
    const eligible = all.filter(p => num(p.financing_eligible) === 1)
    const notEligible = all.filter(p => num(p.financing_eligible) === 0)
    const alreadyExcluded = all.filter(p => num(p.financing_excluded) === 1)
    const toMark = all.filter(p => num(p.financing_eligible) === 0 && num(p.financing_excluded) === 0)
    const conflict = all.filter(p => num(p.financing_eligible) === 1 && num(p.financing_excluded) === 1)

    console.log(`\nProductos del negocio: ${all.length} · financing_eligible=1: ${eligible.length} · financing_eligible=0: ${notEligible.length} · ya excluidos: ${alreadyExcluded.length}`)
    if (conflict.length > 0) console.log(`AVISO: ${conflict.length} producto(s) elegibles (1) y excluidos a la vez: se respetan, el script no los toca (ids ${conflict.map(p => num(p.id)).join(',')}).`)
    console.log(`\nSe marcarían financing_excluded = 1 (hoy NO muestran el sello): ${toMark.length}`)
    for (const p of toMark) console.log(`  ${String(num(p.id)).padStart(6)} | ${num(p.active) === 1 ? 'activo  ' : 'inactivo'} | ${p.name}`)

    const ids = toMark.map(p => num(p.id))
    const updateSql = 'UPDATE products SET financing_excluded = 1 WHERE business_id = ' + businessId + ' AND financing_eligible = 0 AND financing_excluded = 0'
    const rollbackSql = ids.length > 0
      ? `UPDATE products SET financing_excluded = 0 WHERE business_id = ${businessId} AND id IN (${ids.join(',')});`
      : '-- nada que revertir'
    console.log(`\nSQL que se ejecutaría:\n  ${updateSql};\nReversa:\n  ${rollbackSql}`)

    if (!APPLY) {
      console.log('\nSIMULACIÓN: no se escribió nada. Para aplicar: --aplicar --host-esperado <DB_HOST> --db-esperada <DB_NAME> --respaldo <carpeta>')
      return
    }
    if (ids.length === 0) { console.log('\nNada que marcar (ya está preservado).'); return }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = path.join(backupDir, `financiamiento33_${stamp}.json`)
    fs.writeFileSync(backupFile, JSON.stringify({
      negocio: businessId, db: dbName, fecha: new Date().toISOString(),
      antes: toMark.map(p => ({ id: num(p.id), name: p.name, financing_eligible: 0, financing_excluded: 0 })),
      reversa_sql: rollbackSql,
    }, null, 2))
    console.log(`\nRespaldo escrito: ${backupFile}`)

    await conn.beginTransaction()
    try {
      const res = await conn.query(updateSql)
      if (num(res.affectedRows) !== ids.length) throw new Error(`Se esperaba tocar ${ids.length} fila(s) y se tocaron ${num(res.affectedRows)}; se revierte`)
      const check = await conn.query(
        'SELECT SUM(financing_eligible = 1 AND financing_excluded = 0) AS visibles, SUM(financing_eligible = 0 AND financing_excluded = 0) AS sin_preservar FROM products WHERE business_id = ?', [businessId])
      if (num(check[0].sin_preservar) !== 0) throw new Error('Quedaron productos sin preservar; se revierte')
      await conn.commit()
      console.log(`APLICADO: ${ids.length} producto(s) marcados. Con sello: ${num(check[0].visibles)} (= financing_eligible=1 de antes). Sin preservar: 0.`)
    } catch (e) {
      await conn.rollback()
      throw e
    }
  } finally {
    await conn.end()
  }
}

main().catch(e => { console.error('ERROR:', e && e.message ? e.message : String(e)); process.exit(1) })
