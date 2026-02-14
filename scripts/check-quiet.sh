#!/usr/bin/env zsh
# 只有失敗時才輸出完整 log；成功時只顯示一行成功訊息。
out=$(pnpm exec turbo run typecheck lint test 2>&1)
code=$?
if [ $code -ne 0 ]; then
  echo "$out"
  exit $code
fi
echo "✓ check passed"
exit 0
