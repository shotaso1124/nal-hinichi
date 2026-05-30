# NAL サイト 引き継ぎプロンプト

対象プロジェクト: NEXT AI LAB 教材ライブラリ (nal.hinichi.com)
最終更新: 2026-05-31

---

## 1. サイト概要

- **サービス名**: NEXT AI LAB 教材ライブラリ
- **URL**: https://nal.hinichi.com
- **Pages デプロイ URL (直接)**: https://nal-hinichi.pages.dev
- **目的**: NEXT AI LAB（ひにち主宰）の受講生向けに、業務AI自動化の教材動画とクイズを会員制で提供する
- **対象ユーザー**: NEXT AI LAB の登録メンバー（ホワイトリスト制）

### コンテンツ一覧

| シリーズ | 回数 | ファイル |
|---------|------|---------|
| メール自動化 | 全5回 | `mail.html` |
| Excel業務の自動化 | 全5回 | `excel.html` |
| ドキュメント・書類業務の自動化 | 全4回 | `doc.html` |
| Claude Code完全解説 | 全6回 | `cc.html` |
| 復習クイズ（Claude Code完全解説用） | 第1〜4回公開済み | `review/p1.html` 〜 `review/p4.html` |

---

## 2. 技術スタック

| 項目 | 内容 |
|------|------|
| ホスティング | Cloudflare Pages (`nal-hinichi` プロジェクト) |
| 認証 (フロント) | Cloudflare Access（初回のみメールOTP、セッション24時間） |
| 認証 (サイト内) | 独自JWT認証 + Cloudflare Pages Functions |
| メール配信（OTP送信） | Resend API (`noreply@hinichi.com` から送信) |
| ストレージ（メンバー管理） | Cloudflare KV (`NAL_MEMBERS` binding、`allowed_emails` キー) |
| フロントエンド | 純粋なHTML/CSS/JS（フレームワーク不使用） |
| デプロイツール | wrangler（`ai_sns_school/fortune_worker/node_modules/.bin/wrangler` を参照） |

---

## 3. ファイル構成と各ファイルの役割

```
ai_sns_school/nal_site/
├── index.html          # ログイン後のトップ（シリーズ一覧ハブ）
├── login.html          # OTPログイン画面（公開パス）
├── admin.html          # メンバー管理画面（管理者 shotso1124@gmail.com のみ）
├── style.css           # 全ページ共通スタイル（ダーク・オレンジテーマ）
├── privacy.html        # プライバシーポリシー（公開パス）
├── mail.html           # メール自動化シリーズページ
├── excel.html          # Excel業務自動化シリーズページ
├── doc.html            # ドキュメント書類業務自動化シリーズページ
├── cc.html             # Claude Code完全解説シリーズページ
│
├── functions/
│   ├── _middleware.js              # 全リクエスト認証チェック（JWT検証・リダイレクト）
│   └── api/
│       ├── send-otp.js             # POST /api/send-otp（OTP生成・Resendでメール送信）
│       ├── verify-otp.js           # POST /api/verify-otp（OTP検証・セッションクッキー発行）
│       ├── logout.js               # GET /api/logout（クッキー削除→/loginへリダイレクト）
│       └── admin/
│           └── members.js          # GET/POST/DELETE /api/admin/members（KV上のホワイトリスト管理）
│
├── review/
│   ├── index.html      # 復習クイズ一覧ページ
│   ├── p1.html         # 第1回復習クイズ（公開中）
│   ├── p2.html         # 第2回復習クイズ（公開中）
│   ├── p3.html         # 第3回復習クイズ（公開中）
│   └── p4.html         # 第4回復習クイズ（公開中）
│
├── deploy.sh           # Cloudflare Pages デプロイスクリプト
├── setup_access.sh     # Cloudflare Access メール認証ゲート設定スクリプト
└── DEPLOY_NAL.md       # デプロイ手順書（詳細）
```

---

## 4. 認証フロー（OTP認証の step-by-step）

### Cloudflare Access 層（初回ゲート）

Cloudflare Accessが先に動き、許可メールリストに含まれるメールアドレスに限りサイト入口を通過させる（ワンタイムコードはCloudflareが送信）。

### サイト内JWT認証層（Pages Functions）

```
[1] ユーザーが login.html を開く（/login は public path）

[2] メールアドレスを入力して「コードを送る」ボタン
    → POST /api/send-otp
        - 6桁OTPをランダム生成
        - OTP・メール・有効期限(10分)をJWTに埋め込み pendingToken を生成
        - Resend API でメール送信（件名:【NEXT AI LAB】ログインコード）
        - レスポンスに pendingToken を返す（KVへの書き込みは不要）

[3] ユーザーが届いた6桁コードを入力して「ログイン」ボタン
    → POST /api/verify-otp
        - pendingToken を検証（署名・有効期限・OTP一致を確認）
        - KV（NAL_MEMBERS）の allowed_emails リストと照合
          ※ KVになければ env.ALLOWED_EMAILS（環境変数）にフォールバック
        - 未登録メールは 403 エラー
        - 認証成功 → セッションJWT（24時間）を nal_session クッキーに Set-Cookie
        - / にリダイレクト（クライアント側で実行）

[4] 以後のリクエストはすべて _middleware.js が検査
    - nal_session クッキーのJWTを検証
    - 期限切れ or 署名不正 → /login にリダイレクト
    - /admin または /api/admin/ パス → JWT内のメールが shotso1124@gmail.com でなければ / にリダイレクト

[5] ログアウト
    → GET /api/logout
        - nal_session クッキーを Max-Age=0 で削除
        - /login にリダイレクト
```

### 公開パス（認証なしでアクセス可能）

```
/login, /login.html, /register, /register.html,
/privacy, /privacy.html, /api/send-otp, /api/verify-otp,
/api/register, /style.css, /favicon.ico
加えて .css/.js/.png/.jpg/.gif/.svg/.ico/.woff2 等の静的アセット
```

---

## 5. 環境変数一覧

Cloudflare Pages の環境変数（ダッシュボードまたは wrangler.toml で設定）。

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `JWT_SECRET` | OTP用pendingToken・セッションJWT の署名鍵。強力なランダム文字列を設定 | 必須 |
| `RESEND_API_KEY` | Resend API のAPIキー（OTPメール送信用） | 必須 |
| `ALLOWED_EMAILS` | カンマ区切りの許可メールアドレス（KVが空のときのフォールバック） | 任意 |

KV Binding:

| Binding名 | 用途 |
|-----------|------|
| `NAL_MEMBERS` | メンバーのホワイトリスト（`allowed_emails` キーにJSON配列で格納） |

---

## 6. 現在の登録メンバー管理方法

### 管理方法（2系統）

**方法A: 管理画面（推奨）**

1. https://nal.hinichi.com/admin に `shotso1124@gmail.com` でログイン
2. 「新規メンバーを追加」フォームにメールアドレスを入力して追加
3. 既存メンバーの「削除」ボタンで削除

→ 操作結果は即座に Cloudflare KV（`NAL_MEMBERS`）の `allowed_emails` キーに JSON 配列として保存される。

**方法B: Cloudflare API（スクリプト・CLI）**

```bash
# KVの現在の値を確認
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/storage/kv/namespaces/{NAMESPACE_ID}/values/allowed_emails" \
  -H "Authorization: Bearer {API_TOKEN}"
```

### 管理者アカウント

- 管理者メールアドレス: `shotso1124@gmail.com`（`_middleware.js` と `members.js` にハードコード）
- 管理者以外が `/admin` にアクセスするとトップページに強制リダイレクト

---

## 7. よくある作業パターン

### 動画URLを差し替える（教材ページに動画を追加）

各シリーズHTML（`mail.html` / `excel.html` / `doc.html` / `cc.html`）の各回に以下のコメントがある:

```html
<!-- VIDEO: 第N回 ここにYouTube埋め込みURL -->
<iframe src="" data-src-placeholder="YouTube埋め込みURLをここに差し替えてください" ...></iframe>
<div class="video-placeholder-overlay">...</div>  ← これが「準備中」表示
```

手順:
1. YouTubeに「限定公開」で動画をアップロードし、動画IDを取得
2. 該当回の `<iframe src="">` の `src` を以下に書き換える:
   ```html
   <iframe
     src="https://www.youtube-nocookie.com/embed/{動画ID}"
     sandbox="allow-scripts allow-same-origin allow-presentation"
     referrerpolicy="strict-origin"
     allow="picture-in-picture"
     allowfullscreen
     loading="lazy"
     title="第N回 タイトル">
   </iframe>
   ```
3. 同じ `episode-item` 内の `<div class="video-placeholder-overlay">...</div>` を**丸ごと削除**
4. `bash deploy.sh` で再デプロイ

### 新しいメンバーを追加する

- **管理画面**: https://nal.hinichi.com/admin → メールアドレスを入力して「追加」
- 即時反映される（再デプロイ不要）

### サイトのHTML/CSSを変更・再デプロイする

```bash
cd /Users/shota/Claude母体/ai_sns_school/nal_site
# wrangler認証が切れている場合は先に:
# node ../fortune_worker/node_modules/.bin/wrangler login
bash deploy.sh
```

Access設定（メール認証ゲート）は再設定不要。

### 新しいシリーズページを追加する

1. `mail.html` を参考に新しい `xxxx.html` を作成
2. `index.html` の `hub-grid` に新しいカードを追加:
   ```html
   <a href="xxxx.html" class="hub-card">
     <span class="hub-card-badge">全 N 回</span>
     <div class="hub-card-title">シリーズ名</div>
     <div class="hub-card-desc">説明文</div>
     <span class="hub-card-cta">シリーズを見る →</span>
   </a>
   ```
3. `bash deploy.sh` で再デプロイ（新ページは自動的に認証ゲート対象になる）

### 復習クイズを追加する（第5回・第6回）

1. `review/p4.html` を複製して `review/p5.html` として作成
2. クイズ問題・解説・確認プロンプトの内容を第5回用に書き換える
3. `review/index.html` の該当カード（第5回の `.lesson-card.inactive`）を以下のように変更:
   - `inactive` → `active`
   - `badge-soon` → `badge-ready`
   - `<span class="card-cta-disabled">準備中</span>` → `<a href="p5.html" class="card-cta">復習する</a>`
4. `cc.html` の第5回の `<span class="review-btn-soon">` を `<a href="review/p5.html" class="review-btn">` に書き換える
5. `bash deploy.sh` で再デプロイ

---

## 8. 注意事項・既知の制約

### セキュリティ設計

- **JWT署名**: `crypto.subtle`（Web Crypto API）で HMAC-SHA256。Cloudflare Workers ランタイムで動作。`JWT_SECRET` が漏れると全セッションが偽造可能になるため厳重管理すること。
- **OTPはKV不使用**: OTPをJWT（`pendingToken`）に埋め込む設計のため、Cloudflare KVへの書き込みが発生しない。KVは`allowed_emails`のみ保存。
- **管理者メールはハードコード**: `_middleware.js` と `functions/api/admin/members.js` の両方に `shotso1124@gmail.com` がハードコードされている。変更時は**両方**を修正してデプロイすること。

### デプロイ制約

- `wrangler` は `ai_sns_school/fortune_worker/node_modules/.bin/wrangler` を参照している（nal_site 自体には node_modules がない）
- カスタムドメイン（`nal.hinichi.com`）の割り当てはCloudflareダッシュボードでの手動操作が必要。wrangler から自動設定できない。
- KV binding の設定（`NAL_MEMBERS`）はCloudflareダッシュボードで行い、`wrangler.toml` には記載なし（Pages プロジェクトのBinding設定がダッシュボード上にある前提）

### 認証の二重構造に注意

現在のアーキテクチャは以下の**2層**で認証している:

```
Cloudflare Access（外側のゲート）
  ↓ 通過したリクエストのみ
Pages Functions _middleware.js（内側のJWT検証）
```

- Cloudflare Access の許可メールリストと、KV の `allowed_emails` は**別管理**。
- 両方に登録されていないとログインできない（KV側が空の場合のみ `env.ALLOWED_EMAILS` にフォールバック）。
- メンバー追加時は通常 `/admin` 管理画面からKVを更新するだけでよい（Access側は初期設定のまま運用可能）。

### style.css はログイン画面には適用されない

`login.html` はインラインスタイルのみで描画される（`style.css` の `--accent`, `--surface` 等のCSS変数を参照しているが、実際の変数は `login.html` 内のインラインCSSで定義されていない。ログイン画面は独自のCSS変数を参照するので、デザイン変更時はインラインスタイル側を修正すること）。

### 復習クイズ（review/以下）のCSS

`review/` 配下のHTMLはすべて `style.css` を読み込まず、各ファイル内のインライン `<style>` にCSS全量を持つ。修正時は各ファイルを個別に編集する必要がある。

### 動画はすべて「準備中」（2026-05-31時点）

`cc.html`, `mail.html`, `excel.html`, `doc.html` の各動画 iframe は `src=""` の空状態（「準備中」オーバーレイ表示中）。動画公開時に都度差し替えが必要。

---

## 関連ファイルパス（絶対パス）

```
/Users/shota/Claude母体/ai_sns_school/nal_site/   # サイトルート
/Users/shota/Claude母体/ai_sns_school/nal_site/deploy.sh
/Users/shota/Claude母体/ai_sns_school/nal_site/setup_access.sh
/Users/shota/Claude母体/ai_sns_school/nal_site/DEPLOY_NAL.md  # 詳細デプロイ手順書
```
