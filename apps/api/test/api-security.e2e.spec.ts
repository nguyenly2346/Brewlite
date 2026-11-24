/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test API qua HTTP thật. Cần backend đang chạy (docker compose up -d)
 * và đã seed dữ liệu mẫu.
 */
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function call(path: string, opts: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers ?? {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* body rỗng */ }
  return { status: res.status, data };
}

async function login(email: string) {
  const r = await call('/auth/login', { method: 'POST', body: { email, password: 'BrewLite@123' } });
  expect(r.status).toBe(200);
  return r.data.accessToken as string;
}

describe('API BrewLite', () => {
  let customer: string;
  let admin: string;
  let other: string;
  let productId: string;

  const newOrderBody = () => ({
    items: [{ productId, size: 'M', qty: 1, toppingIds: [] }],
    pickupMethod: 'PICKUP_COUNTER',
  });
  const createOrder = (token: string) => call('/orders', { method: 'POST', token, body: newOrderBody() });
  const uniqueKey = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    customer = await login('khachhang@brewlite.vn');
    admin = await login('admin@brewlite.vn');
    const reg = await call('/auth/register', {
      method: 'POST',
      body: { email: `other-${Date.now()}@brewlite.vn`, password: 'BrewLite@123', fullName: 'Khách khác' },
    });
    other = reg.data.accessToken;
    const menu = await call('/products');
    productId = menu.data.products[0].id;
  });

  /* ---------------- /products ---------------- */
  describe('GET /products', () => {
    it('công khai (không cần JWT) -> 200, danh sách không rỗng, có id và price', async () => {
      const r = await call('/products');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.data.products)).toBe(true);
      expect(r.data.products.length).toBeGreaterThan(0);
      expect(r.data.products[0]).toHaveProperty('id');
      expect(r.data.products[0]).toHaveProperty('price');
    });
    it('GET /products/:id đúng ID -> 200', async () => {
      const r = await call(`/products/${productId}`);
      expect(r.status).toBe(200);
    });
    it('GET /products/:id sai ID -> 404', async () => {
      const r = await call('/products/id-khong-ton-tai');
      expect(r.status).toBe(404);
    });
  });

  /* ---------------- /promotions/apply ---------------- */
  describe('POST /promotions/apply', () => {
    const apply = (code: string, subtotal: number) => call('/promotions/apply', { method: 'POST', body: { code, subtotal } });

    it('BREWLITE10, 100k -> giảm 10k', async () => {
      const r = await apply('BREWLITE10', 100000);
      expect(r.status).toBe(200);
      expect(r.data.discountAmount).toBe(10000);
      expect(r.data.finalTotal).toBe(90000);
    });
    it('BREWLITE10, 500k -> chạm trần 20k', async () => {
      expect((await apply('BREWLITE10', 500000)).data.discountAmount).toBe(20000);
    });
    it('BREWLITE10, 39.999 -> 400', async () => {
      expect((await apply('BREWLITE10', 39999)).status).toBe(400);
    });
    it('CHAOBANMOI, 100k -> giảm 20k; 200k -> chạm trần 30k', async () => {
      expect((await apply('CHAOBANMOI', 100000)).data.discountAmount).toBe(20000);
      expect((await apply('CHAOBANMOI', 200000)).data.discountAmount).toBe(30000);
    });
    it('mã sai -> 404; thiếu code -> 400', async () => {
      expect((await apply('SAIMA', 100000)).status).toBe(404);
      expect((await call('/promotions/apply', { method: 'POST', body: { subtotal: 100000 } })).status).toBe(400);
    });
  });

  /* ---------------- /orders ---------------- */
  describe('POST /orders', () => {
    it('không JWT -> 401', async () => {
      const r = await call('/orders', { method: 'POST', body: newOrderBody() });
      expect(r.status).toBe(401);
    });
    it('JWT sai -> 401', async () => {
      const r = await call('/orders', { method: 'POST', token: 'token.gia.mao', body: newOrderBody() });
      expect(r.status).toBe(401);
    });
    it('có JWT, body hợp lệ -> 201, PENDING, subtotal = giá món + 6.000 (size M)', async () => {
      const r = await createOrder(customer);
      expect(r.status).toBe(201);
      expect(r.data.status).toBe('PENDING');
      expect(r.data).toHaveProperty('orderCode');
      const price = (await call(`/products/${productId}`)).data;
      const base = (price.product ?? price).price;
      expect(r.data.subtotal).toBe(base + 6000);
    });
    it('body rỗng {} -> 400', async () => {
      expect((await call('/orders', { method: 'POST', token: customer, body: {} })).status).toBe(400);
    });
    it('items rỗng -> 400', async () => {
      expect((await call('/orders', { method: 'POST', token: customer, body: { items: [] } })).status).toBe(400);
    });
    it('qty = 0 -> 400', async () => {
      const body = { items: [{ productId, size: 'M', qty: 0 }] };
      expect((await call('/orders', { method: 'POST', token: customer, body })).status).toBe(400);
    });
    it('size sai (XL) -> 400', async () => {
      const body = { items: [{ productId, size: 'XL', qty: 1 }] };
      expect((await call('/orders', { method: 'POST', token: customer, body })).status).toBe(400);
    });
    it('productId không tồn tại -> 400', async () => {
      const body = { items: [{ productId: 'khong-co', size: 'M', qty: 1 }] };
      expect((await call('/orders', { method: 'POST', token: customer, body })).status).toBe(400);
    });
    it('mã khuyến mãi sai -> 404', async () => {
      const body = { ...newOrderBody(), promotionCode: 'SAIMA' };
      expect((await call('/orders', { method: 'POST', token: customer, body })).status).toBe(404);
    });
  });

  /* ---------------- /orders/me ---------------- */
  describe('GET /orders/me', () => {
    it('không JWT -> 401', async () => {
      expect((await call('/orders/me')).status).toBe(401);
    });
    it('có JWT -> 200, là mảng, chứa đơn vừa tạo', async () => {
      const created = await createOrder(customer);
      const r = await call('/orders/me', { token: customer });
      expect(r.status).toBe(200);
      expect(Array.isArray(r.data)).toBe(true);
      expect(r.data.some((o: any) => o.id === created.data.id)).toBe(true);
    });
    it('chỉ trả đơn của chính user (đơn của khách khác không lọt vào danh sách)', async () => {
      const adminOrder = await createOrder(other);
      const mine = await call('/orders/me', { token: customer });
      expect(mine.data.some((o: any) => o.id === adminOrder.data.id)).toBe(false);
    });
  });

  /* ---------------- /orders/:id ---------------- */
  describe('GET /orders/:id', () => {
    it('không JWT -> 401', async () => {
      expect((await call('/orders/bat-ky')).status).toBe(401);
    });
    it('chủ đơn xem -> 200; ID không có -> 404', async () => {
      const created = await createOrder(customer);
      expect((await call(`/orders/${created.data.id}`, { token: customer })).status).toBe(200);
      expect((await call('/orders/id-khong-co', { token: customer })).status).toBe(404);
    });
    it('admin không đặt hàng -> 403', async () => {
      expect((await createOrder(admin)).status).toBe(403);
    });
    it('khách xem đơn của người khác -> 403; admin xem được -> 200', async () => {
      const adminOrder = await createOrder(other);
      expect((await call(`/orders/${adminOrder.data.id}`, { token: customer })).status).toBe(403);
      expect((await call(`/orders/${adminOrder.data.id}`, { token: admin })).status).toBe(200);
    });
  });

  /* ---------------- 401 / 403 phân quyền ---------------- */
  describe('Phân quyền 401 / 403', () => {
    it('PATCH /orders/:id/status: không JWT -> 401, khách -> 403, admin -> 200', async () => {
      const created = await createOrder(customer);
      const url = `/orders/${created.data.id}/status`;
      const body = { status: 'CANCELLED' };
      expect((await call(url, { method: 'PATCH', body })).status).toBe(401);
      expect((await call(url, { method: 'PATCH', token: customer, body })).status).toBe(403);
      const ok = await call(url, { method: 'PATCH', token: admin, body });
      expect(ok.status).toBe(200);
      expect(ok.data.status).toBe('CANCELLED');
    });
    it('admin chuyển trạng thái sai (PENDING -> READY) -> 400', async () => {
      const created = await createOrder(customer);
      const r = await call(`/orders/${created.data.id}/status`, { method: 'PATCH', token: admin, body: { status: 'READY' } });
      expect(r.status).toBe(400);
    });
    it.each(['/admin/stats', '/admin/orders', '/admin/inventory'])('GET %s: không JWT -> 401, khách -> 403, admin -> 200', async (path) => {
      expect((await call(path)).status).toBe(401);
      expect((await call(path, { token: customer })).status).toBe(403);
      expect((await call(path, { token: admin })).status).toBe(200);
    });
  });

  /* ---------------- /payments ---------------- */
  describe('POST /payments', () => {
    const pay = (token: string | undefined, body: unknown, key?: string) =>
      call('/payments', { method: 'POST', ...(token ? { token } : {}), body, ...(key ? { headers: { 'idempotency-key': key } } : {}) });

    it('không JWT -> 401', async () => {
      expect((await pay(undefined, { orderId: 'x', method: 'WALLET' }, uniqueKey())).status).toBe(401);
    });
    it('thiếu Idempotency-Key -> 400', async () => {
      const o = await createOrder(customer);
      expect((await pay(customer, { orderId: o.data.id, method: 'WALLET' })).status).toBe(400);
    });
    it('method sai (CASH) -> 400', async () => {
      const o = await createOrder(customer);
      expect((await pay(customer, { orderId: o.data.id, method: 'CASH' }, uniqueKey())).status).toBe(400);
    });
    it('thiếu orderId -> 400', async () => {
      expect((await pay(customer, { method: 'WALLET' }, uniqueKey())).status).toBe(400);
    });
    it('đơn không tồn tại -> 404', async () => {
      expect((await pay(customer, { orderId: 'khong-co', method: 'WALLET' }, uniqueKey())).status).toBe(404);
    });
    it('khách thanh toán đơn của khách khác -> 403', async () => {
      const adminOrder = await createOrder(other);
      expect((await pay(customer, { orderId: adminOrder.data.id, method: 'WALLET' }, uniqueKey())).status).toBe(403);
    });
    it('thanh toán lỗi mô phỏng -> 200, FAILED, đơn PAYMENT_FAILED, không tích điểm', async () => {
      const o = await createOrder(customer);
      const r = await pay(customer, { orderId: o.data.id, method: 'CARD', simulateFailure: true }, uniqueKey());
      expect(r.status).toBe(200);
      expect(r.data.payment.status).toBe('FAILED');
      expect(r.data.order.status).toBe('PAYMENT_FAILED');
      expect(r.data.pointsEarned).toBe(0);
    });
    it('sau khi lỗi, thanh toán lại với key mới -> PAID, tích 5% điểm', async () => {
      const o = await createOrder(customer);
      await pay(customer, { orderId: o.data.id, method: 'CARD', simulateFailure: true }, uniqueKey());
      const r = await pay(customer, { orderId: o.data.id, method: 'CARD' }, uniqueKey());
      expect(r.status).toBe(200);
      expect(r.data.order.status).toBe('PAID');
      expect(r.data.pointsEarned).toBe(Math.floor(o.data.total * 0.05));
    });
    it('cùng Idempotency-Key gọi 2 lần -> lần 2 idempotentReplay=true, cùng payment id', async () => {
      const o = await createOrder(customer);
      const key = uniqueKey();
      const first = await pay(customer, { orderId: o.data.id, method: 'WALLET' }, key);
      const second = await pay(customer, { orderId: o.data.id, method: 'WALLET' }, key);
      expect(first.data.idempotentReplay).toBe(false);
      expect(second.data.idempotentReplay).toBe(true);
      expect(second.data.payment.id).toBe(first.data.payment.id);
    });
    it('đơn đã PAID, thanh toán lại với key mới -> 400', async () => {
      const o = await createOrder(customer);
      await pay(customer, { orderId: o.data.id, method: 'WALLET' }, uniqueKey());
      const again = await pay(customer, { orderId: o.data.id, method: 'WALLET' }, uniqueKey());
      expect(again.status).toBe(400);
    });
  });
});
