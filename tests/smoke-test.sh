#!/usr/bin/env bash
set -e

API_BASE="${1:-http://localhost:4000}"
echo "Running smoke tests against $API_BASE..."

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health" || echo "000")
if [ "$HEALTH_STATUS" -ne 200 ]; then
  echo "❌ Smoke test failed: /health returned HTTP $HEALTH_STATUS"
  exit 1
fi
echo "✅ /health endpoint responded HTTP 200"

PRODUCTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/products" || echo "000")
if [ "$PRODUCTS_STATUS" -ne 200 ]; then
  echo "❌ Smoke test failed: /products returned HTTP $PRODUCTS_STATUS"
  exit 1
fi
echo "✅ /products endpoint responded HTTP 200"

echo "🎉 All smoke tests passed successfully!"
