import { EventEmitter } from 'events';
import { requestIdMiddleware, resolveRequestId } from './request-id.middleware';
import { getRequestId } from './request-context';

function makeRes() {
  const res: any = new EventEmitter();
  res.headers = {} as Record<string, string>;
  res.statusCode = 200;
  res.setHeader = (k: string, v: string) => {
    res.headers[k.toLowerCase()] = v;
  };
  return res;
}

describe('request id middleware', () => {
  it('tạo UUID khi client không gửi X-Request-Id', () => {
    const id = resolveRequestId(undefined);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('giữ nguyên id hợp lệ do client gửi', () => {
    expect(resolveRequestId('abc-12345678')).toBe('abc-12345678');
  });

  it('bỏ id không an toàn (ký tự lạ / quá dài)', () => {
    expect(resolveRequestId('bad id\nwith newline')).not.toBe('bad id\nwith newline');
    expect(resolveRequestId('x'.repeat(200))).toHaveLength(36);
  });

  it('gắn header phản hồi và truyền id vào context', (done) => {
    const req: any = {
      headers: { 'x-request-id': 'test-request-001' },
      method: 'GET',
      originalUrl: '/products?secret=1',
    };
    const res = makeRes();
    requestIdMiddleware(req, res, () => {
      expect(res.headers['x-request-id']).toBe('test-request-001');
      expect(getRequestId()).toBe('test-request-001');
      done();
    });
  });
});
