import { expect, Page } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';

export const CUSTOMER = {
  email: 'khachhang@brewlite.vn',
  password: 'BrewLite@123',
};

export const ADMIN = {
  email: 'admin@brewlite.vn',
  password: 'BrewLite@123',
};

export async function login(
  page: Page,
  account: { email: string; password: string },
) {
  await page.getByPlaceholder('Nhập email của bạn').fill(account.email);
  await page.getByPlaceholder('••••••••').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập ngay' }).click();
}

/** Từ /menu mở sản phẩm đầu tiên, chọn size, thêm vào giỏ → dừng ở /cart. */
export async function addFirstProductToCart(page: Page, size: 'S' | 'M' | 'L' = 'M') {
  await page.goto('/menu');
  const firstProduct = page.locator('a[href^="/products/"]').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();
  await page.waitForURL(/\/products\/[^/]+$/);

  await page.getByRole('button', { name: new RegExp(`Size ${size}`) }).click();
  await page.getByRole('button', { name: /Thêm vào giỏ hàng/ }).click();
  await page.waitForURL('**/cart');
}
