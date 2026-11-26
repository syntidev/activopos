import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import type { Page } from '@playwright/test'
import { SignJWT } from 'jose'

/**
 * Ayudas compartidas de los tests de Alta rápida (servidor local en el puerto 3101).
 * Antes atadas al 87 / 86 (OnBike Margarita, cliente real); ahora al tenant propio 267 (admin 212): ver tests/d-tenant.ts.
 */
export const BASE = 'http://localhost:3101'
export const BUSINESS_ID = 267
export const USER_ID = 212

export function envValue(key: string): string {
  const line = readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).find(l => l.startsWith(`${key}=`))
  if (!line) throw new Error(`${key} no está en .env`)
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '')
}

export function sql(query: string): string {
  return execFileSync('mysql', ['-uroot', '-h127.0.0.1', '--default-character-set=utf8mb4', '-N', '-B', 'activopos', '-e', query], { encoding: 'utf8' }).trim()
}

/** Sesión admin del tenant propio: JWT firmado con el JWT_SECRET del .env (sin tocar la clave de ningún usuario). */
export async function login(page: Page): Promise<void> {
  const tenant = sql(`SELECT name FROM businesses WHERE id=${BUSINESS_ID}`)
  if (!tenant.startsWith('ZZ D')) throw new Error(`El negocio ${BUSINESS_ID} ("${tenant}") no es el tenant de pruebas ZZ D: no se inicia sesión`)
  const token = await new SignJWT({ userId: USER_ID, businessId: BUSINESS_ID, role: 'admin', name: 'ZZ D Admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(envValue('JWT_SECRET')))
  await page.context().addCookies([{ name: 'activopos_session', value: token, url: BASE }])
}
