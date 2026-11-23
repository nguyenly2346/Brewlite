import { expect, test } from '@playwright/test';
import { API_URL } from './helpers';

// E2E-T05: health check + request id được trả về ở mọi response
test('E2E-T05: /health ok và có header X-Request-Id', async ({ request }) => {
  const res = await request.get(`${API_URL}/health`, {
    headers: { 'X-Request-Id': 'e2e-health-0001' },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).status).toBe('ok');
  expect(res.headers()['x-request-id']).toBe('e2e-health-0001');
});
