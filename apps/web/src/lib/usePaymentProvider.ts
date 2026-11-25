'use client';

import { useEffect, useState } from 'react';
import { api, PaymentProvider } from './api';

/**
 * Hỏi backend đang dùng cổng nào (mock hay VNPay). Trả null trong lúc chờ để UI không đoán sai.
 * Nếu không hỏi được (backend cũ), coi như mock để giữ nguyên luồng cũ.
 */
export function usePaymentProvider(): PaymentProvider | null {
  const [provider, setProvider] = useState<PaymentProvider | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getPaymentConfig()
      .then((config) => {
        if (!cancelled) setProvider(config.provider);
      })
      .catch(() => {
        if (!cancelled) setProvider('mock');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return provider;
}
