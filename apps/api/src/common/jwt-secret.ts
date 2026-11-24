import { randomBytes } from 'crypto';

let cachedSecret: string | undefined;

/**
 * Lấy JWT secret từ biến môi trường JWT_SECRET (không có giá trị mặc định trong mã nguồn).
 * - Production: bắt buộc phải có, thiếu thì dừng ứng dụng.
 * - Dev/test: nếu thiếu, sinh secret ngẫu nhiên cho mỗi lần chạy (token cũ mất hiệu lực khi restart).
 */
export function getJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Thiếu biến môi trường JWT_SECRET (bắt buộc ở production)');
  }

  if (!cachedSecret) {
    cachedSecret = randomBytes(32).toString('hex');
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.warn('[auth] JWT_SECRET chưa được đặt: dùng secret ngẫu nhiên cho phiên chạy này.');
    }
  }
  return cachedSecret;
}
