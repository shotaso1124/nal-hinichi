# NAL (nal.hinichi.com) デプロイ手順書

対象: NEXT AI LAB 代表
最終更新: 2026-05-27
担当: 自動化部（猛）

---

## 構成概要

```
静的HTML (/nal_site/)
  ↓ wrangler pages deploy
Cloudflare Pages (nal-hinichi.pages.dev)
  ↓ カスタムドメイン設定（ダッシュボード手動）
nal.hinichi.com
  ↓ Cloudflare Access（メール認証ゲート）
許可されたメールアドレスのみ閲覧可能
```

---

## 所要時間の目安

| フェーズ | 内容 | 時間 |
|---------|------|------|
| 事前準備 | APIトークン発行 | 5分 |
| スクリプト実行 | deploy.sh 実行 | 2〜3分 |
| ダッシュボード操作 | カスタムドメイン設定 | 5〜10分（DNS反映待ち含む） |
| スクリプト実行 | setup_access.sh 実行 | 2分 |
| 動作確認 | ブラウザ確認 | 5分 |
| **合計** | | **約20〜25分** |

---

## 手順一覧

### 【手動1】APIトークンを発行する（初回1回のみ）

1. https://dash.cloudflare.com/profile/api-tokens を開く
2. 「Create Token」をクリック
3. 「Custom token」→「Get started」を選択
4. 以下の権限を設定:

   | 項目 | 値 |
   |------|-----|
   | Token name | `nal-hinichi-deploy` |
   | Account > Cloudflare Pages | Edit |
   | Account > Access: Apps and Policies | Edit |
   | Zone > Zone | Read（hinichi.com のみ） |

5. 「Continue to summary」→「Create Token」
6. 表示されたトークン文字列を**安全な場所に保存**（画面を閉じると再表示されない）

> 注意: トークンはファイルに書かない。環境変数で都度セットする。

---

### 【手動2】アカウントIDを確認する

1. https://dash.cloudflare.com を開く
2. hinichi.com の「Overview」画面を表示
3. 右サイドバーの「Account ID」をコピー（32文字の英数字）

---

### 【コピペ1】静的サイトをデプロイする

ターミナルで以下を実行（YOUR_TOKEN を【手動1】のトークンに置き換え）:

```bash
export CLOUDFLARE_API_TOKEN="YOUR_TOKEN"

cd ai_sns_school/nal_site  # リポジトリルートから実行
bash deploy.sh
```

成功すると末尾に `https://nal-hinichi.pages.dev` の URL が表示される。

---

### 【手動3】カスタムドメイン `nal.hinichi.com` を割り当てる

wrangler ではカスタムドメインの設定ができないため、ダッシュボードで手作業が必要。

1. https://dash.cloudflare.com → 左メニュー「Workers & Pages」を開く
2. プロジェクト一覧から `nal-hinichi` をクリック
3. 上部タブ「**Custom domains**」をクリック
4. 「**Set up a custom domain**」ボタンをクリック
5. 入力欄に `nal.hinichi.com` と入力 → 「Continue」
6. 確認画面で「**Activate domain**」をクリック
7. ステータスが「Active」になるまで待つ（通常1〜5分、最大24時間）

> hinichi.com が同じ Cloudflare アカウント管理下のため、CNAME レコードは Cloudflare が自動追加する。手動の DNS 操作は不要。

---

### 【手動4】許可するメールアドレスを決める

`setup_access.sh` を実行する前に、アクセスを許可する人のメールアドレスを決める。
複数人の場合はカンマ区切りで列挙。

例（`you@example.com` の部分を自分のメールアドレスに置き換える）:
```
you@example.com,member1@example.com,member2@example.com
```

---

### 【コピペ2】Cloudflare Access でメール認証ゲートを設定する

ターミナルで以下を実行（各値を実際のものに置き換え）:

```bash
export CLOUDFLARE_ACCOUNT_ID="YOUR_ACCOUNT_ID"
export CLOUDFLARE_API_TOKEN="YOUR_TOKEN"
export ALLOWED_EMAILS="you@example.com,member1@example.com"  # you@example.com を自分のメールアドレスに置き換える

cd ai_sns_school/nal_site  # リポジトリルートから実行
bash setup_access.sh
```

成功すると「Cloudflare Access 設定完了」と表示される。

---

### 動作確認

1. ブラウザのシークレットウィンドウで `https://nal.hinichi.com` を開く
2. Cloudflare の「メールアドレスを入力」画面が表示される
3. 許可リストのメールアドレスを入力 → 「Send me a code」
4. 届いたワンタイムコードを入力 → サイトが表示されれば成功

---

## つまずきポイントと対処

| 症状 | 原因 | 対処 |
|------|------|------|
| `wrangler: permission denied` | deploy.sh の実行権限なし | `chmod +x deploy.sh` を実行してから再度 `bash deploy.sh` |
| `You must be logged in` | wrangler 未認証 | `cd ai_sns_school/nal_site && node ../fortune_worker/node_modules/.bin/wrangler login` を実行（リポジトリルートから実行、ブラウザが開く） |
| `project already exists` | 同名プロジェクトが存在 | deploy.sh はエラーを無視して続行する設計のため問題なし |
| カスタムドメインが「Pending」のまま | DNS 反映中 | 最大 24 時間待つ。通常は 5 分以内に Active になる |
| Access 画面がでない | Access の設定が反映されていない | 設定後 5 分ほど待ってからシークレットウィンドウでアクセス |
| `401 Unauthorized`（API） | API トークンの権限不足 | 【手動1】の権限設定を確認。Access: Apps and Policies の Edit 権限が必要 |
| メールが届かない | 迷惑メール or 遅延 | 迷惑メールフォルダを確認。送信元は `no-reply@notify.cloudflare.com` |

---

## 代表が手動でやる必要がある操作（まとめ）

1. **APIトークン発行**（ダッシュボード、初回1回のみ）
   - 必要権限: Pages:Edit / Access: Apps and Policies:Edit / Zone:Read
2. **カスタムドメイン `nal.hinichi.com` 割当**（ダッシュボード）
   - Workers & Pages → nal-hinichi → Custom domains → Set up a custom domain
3. **許可メールアドレスの決定**（誰をアクセス許可するかの内容確認）

---

## 再デプロイ（サイト更新時）

静的ファイルを変更した後:

```bash
export CLOUDFLARE_API_TOKEN="YOUR_TOKEN"
cd ai_sns_school/nal_site  # リポジトリルートから実行
bash deploy.sh
```

Access 設定は維持される。再設定不要。

---

## 動画の差し替え手順

各シリーズページ（`mail.html` / `excel.html` / `doc.html` / `cc.html`）には、各回ごとに `<!-- VIDEO: 第N回 ここにYouTube埋め込みURL -->` というコメントと、空の `<iframe src="">` がある。動画が用意できたら次の手順で差し替える。

1. 動画をYouTubeに「限定公開」でアップロードする
2. 該当回の `<iframe>` を、以下の推奨設定に置き換える（`動画ID` はYouTubeのURL末尾の文字列）:

   ```html
   <iframe
     src="https://www.youtube-nocookie.com/embed/動画ID"
     sandbox="allow-scripts allow-same-origin allow-presentation"
     referrerpolicy="strict-origin"
     allow="picture-in-picture"
     allowfullscreen
     loading="lazy"
     title="第N回 タイトル"></iframe>
   ```

   - `youtube-nocookie.com` を使うとトラッキングCookieを最小化できる
   - `sandbox` と `referrerpolicy` でiframeの権限を最小化する
3. 同じ `episode-item` 内にある `<div class="video-placeholder-overlay">...</div>` を**削除**する（「準備中」表示が消え、動画が見えるようになる）
4. 保存して `bash deploy.sh` で再デプロイ

> CSP（Content-Security-Policy）を厳格にする場合は、Cloudflare Pages の `_headers` ファイルに `frame-src https://www.youtube-nocookie.com;` を追加するとよい（任意）。

---

## 関連ファイル

| ファイル | 用途 |
|---------|------|
| `deploy.sh` | Pages デプロイスクリプト |
| `setup_access.sh` | Access メール認証設定スクリプト |
| `DEPLOY_NAL.md` | 本手順書 |

参考: `ai_sns_school/fortune_worker/` — fortune.hinichi.com の Worker 構成（wrangler 認証済み実績）
