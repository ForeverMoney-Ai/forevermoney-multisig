const { test, expect } = require('@playwright/test')
const safe = 'finney:5HCiqveWdMteyv3jkPKAsuxm8wGokKSimNhwK7sY73JDPRnv'
test('production export renders account overview and assets without a connected wallet', async ({ page }) => {
  await page.goto('/home?safe=' + safe)
  await expect(page.getByText('Total balance', { exact: true })).toBeVisible({ timeout: 60000 })
  await page.goto('/balances?safe=' + safe)
  await expect(page.getByText('Total assets value', { exact: true })).toBeVisible({ timeout: 60000 })
})
test('embedded builder release contains its application and JavaScript', async ({ request }) => {
  const response = await request.get('/tx-builder/')
  expect(response.ok()).toBeTruthy()
  const html = await response.text()
  const script = html.match(/src="([^"]*static\/js\/[^\"]+)"/)
  expect(script).toBeTruthy()
  expect((await request.get(script[1])).ok()).toBeTruthy()
})
