#!/usr/bin/env bash
# =============================================================================
# setup_access.sh — Cloudflare Access でメール認証ゲートを設定するスクリプト
#
# 前提:
#   - 以下の環境変数を事前にセットしてから実行する:
#       export CLOUDFLARE_ACCOUNT_ID="<your-account-id>"
#       export CLOUDFLARE_API_TOKEN="<your-api-token>"
#       export ALLOWED_EMAILS="you@example.com,member1@example.com"
#   - API トークンに必要な権限:
#       Access: Apps and Policies (Edit)
#   - nal.hinichi.com がすでに Cloudflare Pages のカスタムドメインとして設定済みであること
#
# 実行方法:
#   export CLOUDFLARE_ACCOUNT_ID="..."
#   export CLOUDFLARE_API_TOKEN="..."
#   export ALLOWED_EMAILS="you@example.com,member1@example.com"
#   bash setup_access.sh
# =============================================================================

set -euo pipefail

# ── 変数（必要に応じて変更）────────────────────────────────────────────────
APP_NAME="NAL nal.hinichi.com"
APP_DOMAIN="nal.hinichi.com"
SESSION_DURATION="24h"

# ── 環境変数チェック ───────────────────────────────────────────────────────
: "${CLOUDFLARE_ACCOUNT_ID:?環境変数 CLOUDFLARE_ACCOUNT_ID をセットしてください}"
: "${CLOUDFLARE_API_TOKEN:?環境変数 CLOUDFLARE_API_TOKEN をセットしてください}"
: "${ALLOWED_EMAILS:?環境変数 ALLOWED_EMAILS をカンマ区切りでセットしてください}"

# ── ALLOWED_EMAILS を JSON 配列に変換 ──────────────────────────────────────
EMAIL_JSON=$(python3 -c "import json,sys; emails=[e.strip() for e in sys.argv[1].split(',') if e.strip()]; print(json.dumps([{'email':{'email':e}} for e in emails]))" "${ALLOWED_EMAILS}")

echo "許可メール一覧: ${ALLOWED_EMAILS}"
echo ""

# ── Step 1: Access Application を作成 ─────────────────────────────────────
echo "[1/2] Access Application を作成します: ${APP_DOMAIN}"

APP_RESPONSE=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/access/apps" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{
    \"name\": \"${APP_NAME}\",
    \"domain\": \"${APP_DOMAIN}\",
    \"type\": \"self_hosted\",
    \"session_duration\": \"${SESSION_DURATION}\",
    \"allowed_idps\": [],
    \"auto_redirect_to_identity\": false,
    \"enable_binding_cookie\": false,
    \"http_only_cookie_attribute\": true
  }")

APP_SUCCESS=$(echo "${APP_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','false'))")
if [ "${APP_SUCCESS}" != "True" ]; then
  echo "Access Application の作成に失敗しました。レスポンス:"
  echo "${APP_RESPONSE}" | python3 -m json.tool
  exit 1
fi

APP_ID=$(echo "${APP_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['id'])")
echo "Access Application 作成完了。App ID: ${APP_ID}"
echo ""

# ── Step 2: Access Policy（メール許可リスト）を作成 ─────────────────────────
echo "[2/2] Access Policy（メール許可リスト）を作成します..."

POLICY_RESPONSE=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/access/apps/${APP_ID}/policies" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{
    \"name\": \"Allow specific emails\",
    \"decision\": \"allow\",
    \"include\": ${EMAIL_JSON},
    \"exclude\": [],
    \"require\": [],
    \"precedence\": 1
  }")

POLICY_SUCCESS=$(echo "${POLICY_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','false'))")
if [ "${POLICY_SUCCESS}" != "True" ]; then
  echo "Access Policy の作成に失敗しました。レスポンス:"
  echo "${POLICY_RESPONSE}" | python3 -m json.tool
  exit 1
fi

POLICY_ID=$(echo "${POLICY_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['id'])")
echo "Access Policy 作成完了。Policy ID: ${POLICY_ID}"
echo ""
echo "====================================================================="
echo "Cloudflare Access 設定完了"
echo "  保護対象: https://${APP_DOMAIN}"
echo "  認証方式: メールアドレス確認（OTPコード）"
echo "  許可メール: ${ALLOWED_EMAILS}"
echo "  セッション: ${SESSION_DURATION}"
echo "====================================================================="
echo ""
echo "動作確認: ブラウザで https://${APP_DOMAIN} を開き、"
echo "          許可メールアドレスに届くワンタイムコードでログインできることを確認してください。"
