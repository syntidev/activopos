import { test as setup } from '@playwright/test'
import path from 'path'

export const AUTH_FILE = path.join(__dirname, '.auth-state.json')

setup('create admin auth state', async ({ page }) => {
  await page.goto('http://localhost:3000/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[type="email"]').fill('admin@activopos.com')
  await page.locator('input[type="password"]').fill('admin123')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/escritorio', { timeout: 15_000 })
  await page.context().storageState({ path: AUTH_FILE })
})
