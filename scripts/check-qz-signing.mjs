// Check de la firma de mensajes de QZ Tray (src/lib/qz-signing.ts).
// Correr: node scripts/check-qz-signing.mjs   (Node >= 22.18: importa el .ts directo)
// Genera un par RSA 2048 EFÍMERO en memoria: no usa ni toca claves reales.
// Falla si la firma deja de ser RSA-SHA512 en base64 verificable con la clave
// pública, o si cambia cómo se leen QZ_CERTIFICATE / QZ_PRIVATE_KEY del entorno.
import assert from 'node:assert/strict'
import { generateKeyPairSync, createVerify } from 'node:crypto'
import { getQzCredentials, signQzMessage } from '../src/lib/qz-signing.ts'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },   // PKCS#8, el formato que exige QZ
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
})
const verify = (message, signature) => {
  const v = createVerify('RSA-SHA512')
  v.update(message)
  return v.verify(publicKey, signature, 'base64')
}

const message = '{"call":"printers.find","params":{"query":"XP-58"},"timestamp":1727200000000}'
const signature = signQzMessage(message, privateKey)

assert.match(signature, /^[A-Za-z0-9+/]+=*$/, 'la firma debe ser base64')
assert.ok(verify(message, signature), 'la clave pública debe verificar la firma (RSA-SHA512)')
assert.ok(!verify(message + ' ', signature), 'un mensaje alterado no debe verificar')
assert.equal(signQzMessage(message, privateKey), signature, 'RSA PKCS#1 v1.5 es determinista')

// Lectura del entorno: los saltos de línea llegan escapados como \n en un .env.
const cert = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----'
process.env.QZ_CERTIFICATE = cert.replace(/\n/g, '\\n')
process.env.QZ_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
const creds = getQzCredentials()
assert.ok(creds, 'con ambas variables hay credenciales')
assert.equal(creds.certificate, cert)
assert.equal(creds.privateKey, privateKey.trim())
assert.equal(signQzMessage(message, creds.privateKey), signature, 'la clave leída del entorno firma igual')

delete process.env.QZ_PRIVATE_KEY
assert.equal(getQzCredentials(), null, 'sin clave privada, la firma queda desactivada (modo sin firma)')
delete process.env.QZ_CERTIFICATE
assert.equal(getQzCredentials(), null, 'sin ninguna variable, modo sin firma')

// Un PEM roto debe lanzar (la ruta /api/qz/sign lo captura y responde 500 sin filtrar detalle).
assert.throws(() => signQzMessage(message, 'no-es-un-pem'))

console.log('OK — firma de QZ Tray intacta (RSA-SHA512, base64, PKCS#8)')
