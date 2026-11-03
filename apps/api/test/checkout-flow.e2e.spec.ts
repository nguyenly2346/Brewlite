/**
 * End-to-End (E2E) Test: Luồng nghiệp vụ chính của BrewLite
 * Luồng kiểm thử: Xem menu -> Đăng nhập lấy JWT -> Tạo đơn PENDING -> Thanh toán Idempotent -> Xác nhận đơn PAID
 */
describe('BrewLite End-to-End Business Flow', () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  it('thực hiện trọn vẹn luồng từ chọn món đến thanh toán thành công', async () => {
    // 1. Khách xem danh sách sản phẩm (menu)
    const menuRes = await fetch(`${API_URL}/products`);
    expect(menuRes.status).toBe(200);
    const menuData = await menuRes.json();
    expect(Array.isArray(menuData.products)).toBe(true);
    expect(menuData.products.length).toBeGreaterThan(0);

    const targetProduct = menuData.products[0];
    expect(targetProduct).toHaveProperty('id');
    expect(targetProduct).toHaveProperty('price');

    // 2. Đăng nhập tài khoản khách hàng để lấy JWT token
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'khachhang@brewlite.vn',
        password: 'BrewLite@123',
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData).toHaveProperty('accessToken');
    const token = loginData.accessToken;

    // 3. Tạo đơn hàng mới ở trạng thái PENDING
    const orderPayload = {
      items: [
        {
          productId: targetProduct.id,
          size: 'M',
          qty: 1,
          toppingIds: [],
          sugarLevel: '70% đường',
          iceLevel: 'Đá bình thường',
          itemNote: 'E2E Automated Test Order',
        },
      ],
      pickupMethod: 'PICKUP_COUNTER',
      customerNote: 'Đơn kiểm thử tự động E2E',
    };

    const orderRes = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });
    expect(orderRes.status).toBe(201);
    const orderData = await orderRes.json();
    expect(orderData.status).toBe('PENDING');
    expect(orderData).toHaveProperty('id');
    expect(orderData).toHaveProperty('orderCode');

    // 4. Thanh toán không tiền mặt với Idempotency-Key
    const idemKey = `e2e-pay-${orderData.id}-${Date.now()}`;
    const paymentRes = await fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'idempotency-key': idemKey,
      },
      body: JSON.stringify({
        orderId: orderData.id,
        method: 'WALLET',
        idempotencyKey: idemKey,
      }),
    });
    expect(paymentRes.status).toBe(200);
    const payResult = await paymentRes.json();
    expect(payResult.order.status).toBe('PAID');
    expect(payResult.payment.status).toBe('SUCCESS');

    // 5. Kiểm tra chi tiết đơn hàng sau thanh toán
    const checkRes = await fetch(`${API_URL}/orders/${orderData.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(checkRes.status).toBe(200);
    const verifiedOrder = await checkRes.json();
    expect(verifiedOrder.status).toBe('PAID');
    expect(verifiedOrder.orderCode).toBe(orderData.orderCode);
  });
});
