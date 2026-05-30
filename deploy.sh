#!/usr/bin/env bash
# =============================================================================
# deploy.sh — nal.hinichi.com (Cloudflare Pages) デプロイスクリプト
#
# 前提:
#   - wrangler 認証済み（OAuth セッションが有効）
#   - Node.js がインストール済み
#   - カレントディレクトリ: ai_sns_school/nal_site/
#
# 実行方法:
#   cd /Users/shota/Claude母体/ai_sns_school/nal_site
#   bash deploy.sh
#
# 注意: このスクリプトはデプロイのみ行います。
#       カスタムドメイン (nal.hinichi.com) の割当はダッシュボードで別途手作業が必要です。
# =============================================================================

set -euo pipefail

# ── 変数（変更する場合はここだけ修正）──────────────────────────────────────
PROJECT_NAME="nal-hinichi"
DEPLOY_DIR="."
# wrangler の場所。デフォルトは隣の fortune_worker のものを参照（nal_site から実行する前提）。
# 別の場所のwranglerを使う場合: export WRANGLER_CMD="node /path/to/node_modules/.bin/wrangler"
WRANGLER_CMD="${WRANGLER_CMD:-node ../fortune_worker/node_modules/.bin/wrangler}"

# ── 実行前チェック ─────────────────────────────────────────────────────────
echo "[1/3] wrangler の認証状態を確認します..."
$WRANGLER_CMD whoami

echo "[2/3] Cloudflare Pages プロジェクト '${PROJECT_NAME}' を作成します（既存の場合はスキップ）..."
$WRANGLER_CMD pages project create "${PROJECT_NAME}" --production-branch main || true

echo "[3/3] '${DEPLOY_DIR}' を '${PROJECT_NAME}' にデプロイします..."
$WRANGLER_CMD pages deploy "${DEPLOY_DIR}" \
  --project-name="${PROJECT_NAME}" \
  --branch=main \
  --commit-dirty=true

echo ""
echo "デプロイ完了。"
echo "Pages URL: https://${PROJECT_NAME}.pages.dev"
echo ""
echo "次に必要な手動操作（ダッシュボード）:"
echo "  1. https://dash.cloudflare.com → Workers & Pages → ${PROJECT_NAME}"
echo "  2. 「Custom domains」タブ → 「Set up a custom domain」"
echo "  3. ドメイン: nal.hinichi.com を入力 → 「Continue」→「Activate domain」"
echo "  4. Cloudflare Access で認証を設定する場合は setup_access.sh を参照"
