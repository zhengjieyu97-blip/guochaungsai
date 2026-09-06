import { test, expect } from '@playwright/test'

test('老人未签到闭环可以从模拟台走到时间线', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /社区工作人员/ }).click()
  await expect(page).toHaveURL(/\/events$/)
  await page.getByRole('link', { name: '模拟事件台', exact: true }).click()
  await page.getByRole('button', { name: /老人 4 小时未签到/ }).click()
  await expect(page).toHaveURL(/\/events\/EVENT-/)
  await expect(page.getByRole('heading', { name: /照护时间线/ })).toBeVisible()
  await expect(page.getByText(/风险为什么是/)).toBeVisible()
})

test('儿童接送场景在事件中心可筛选', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /社区工作人员/ }).click()
  await page.getByPlaceholder('搜索姓名、编号或说明').fill('陈小雨')
  await expect(page.getByRole('table').getByText('儿童接送未确认')).toBeVisible()
})
