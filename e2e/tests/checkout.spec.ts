import { expect, test } from '@playwright/test';
import { addFirstProductToCart, CUSTOMER, login } from './helpers';

// E2E-T02: luồng chính Menu → Chi tiết/size → Giỏ → Đăng nhập → Thanh toán → Xác nhận PAID
// (FR menu, giỏ hàng, xác thực, đặt đơn, thanh toán; UC "Đặt và thanh toán đơn hàng")
test('E2E-T02: khách đặt và thanh toán đơn thành công', async ({ page }) => {
  await addFirstProductToCart(page, 'M');

  // Chưa đăng nhập → bấm Thanh toán sẽ bị chuyển sang trang login
  await page.getByRole('button', { name: 'Thanh toán', exact: true }).click();
  await page.waitForURL(/\/login\?redirect=\/checkout/);

  await login(page, CUSTOMER);
  await page.waitForURL('**/checkout');

  // Giỏ hàng được giữ lại sau khi đăng nhập
  await page.getByRole('button', { name: /Xác nhận thanh toán/ }).click();

  await page.waitForURL(/\/orders\/[^/?]+\?paid=1/);
  await expect(page.getByText('Thanh toán thành công!')).toBeVisible();
  await expect(page.getByText(/Đã thanh toán/).first()).toBeVisible();
});

// E2E-T03: thanh toán lỗi → PAYMENT_FAILED, đơn và giỏ được giữ lại (US-05)
test('E2E-T03: thanh toán lỗi giữ nguyên giỏ hàng và cho thử lại', async ({ page }) => {
  await addFirstProductToCart(page, 'S');
  await page.getByRole('button', { name: 'Thanh toán', exact: true }).click();
  await page.waitForURL(/\/login\?redirect=\/checkout/);
  await login(page, CUSTOMER);
  await page.waitForURL('**/checkout');

  // Bật công tắc giả lập lỗi thanh toán
  await page.locator('label:has(input[type="checkbox"]) div').first().click();
  await page.getByRole('button', { name: /Xác nhận thanh toán/ }).click();

  await expect(page.getByText(/PAYMENT_FAILED/).first()).toBeVisible();
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByRole('button', { name: /^Thử thanh toán lại/ })).toBeVisible();
});
