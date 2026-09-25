// Firma de mensajes para QZ Tray (SOLO servidor).
//
// QZ Tray imprime sin diálogo únicamente si cada mensaje llega firmado con una
// clave cuyo certificado él confía. La clave privada vive en variables de
// entorno del servidor y NUNCA llega al navegador:
//   QZ_CERTIFICATE  certificado x509 público (PEM)
//   QZ_PRIVATE_KEY  clave privada PKCS#8 RSA 2048 (PEM)
// En un .env una línea no admite saltos: se aceptan los "\n" escapados.
//
// Algoritmo: RSA-SHA512, firma en base64 (el que declara el cliente con
// qz.security.setSignatureAlgorithm('SHA512')).

import { createSign } from 'node:crypto'

export interface QzCredentials {
  certificate: string
  privateKey:  string
}

const normalizePem = (value: string | undefined): string | null => {
  const pem = value?.replace(/\\n/g, '\n').trim()
  return pem ? pem : null
}

/** null = firma no configurada: el cliente sigue en modo sin firma. */
export function getQzCredentials(): QzCredentials | null {
  const certificate = normalizePem(process.env.QZ_CERTIFICATE)
  const privateKey  = normalizePem(process.env.QZ_PRIVATE_KEY)
  return certificate && privateKey ? { certificate, privateKey } : null
}

export function signQzMessage(message: string, privateKey: string): string {
  const signer = createSign('RSA-SHA512')
  signer.update(message)
  signer.end()
  return signer.sign(privateKey, 'base64')
}
