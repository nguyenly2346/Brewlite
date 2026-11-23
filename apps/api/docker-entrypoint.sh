#!/bin/sh
set -e

# Database tạo bằng "db push" trước đây chưa có lịch sử migration (lỗi P3005):
# đánh dấu migration khởi tạo là đã áp dụng rồi chạy migrate deploy như bình thường.
if ! output=$(npx prisma migrate deploy 2>&1); then
  echo "$output"
  echo "$output" | grep -q "P3005" || exit 1
  npx prisma migrate resolve --applied 20261020000000_init
  npx prisma migrate deploy
else
  echo "$output"
fi

main=dist/main.js
[ -f "$main" ] || main=dist/src/main.js
exec node "$main"
