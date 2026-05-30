// POST /api/verify-otp
// OTPを検証してセッションクッキーを発行する

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { pendingToken, otp } = await request.json();
    if (!pendingToken || !otp) {
      return Response.json({ error: '無効なリクエストです' }, { status: 400 });
    }

    // pendingTokenからOTPと有効期限を取り出す
    const pending = await decodeJWT(pendingToken, env.JWT_SECRET);
    if (!pending) {
      return Response.json({ error: 'トークンが無効です。最初からやり直してください。' }, { status: 401 });
    }
    if (pending.exp < Math.floor(Date.now() / 1000)) {
      return Response.json({ error: 'コードの有効期限が切れました。再送信してください。' }, { status: 401 });
    }
    if (pending.otp !== String(otp).trim()) {
      return Response.json({ error: 'コードが正しくありません。' }, { status: 401 });
    }

    // 許可メールリストのチェック（KV優先、なければ env.ALLOWED_EMAILS にフォールバック）
    let allowedList = null;
    if (env.NAL_MEMBERS) {
      const kvData = await env.NAL_MEMBERS.get('allowed_emails');
      if (kvData) allowedList = JSON.parse(kvData);
    }
    if (!allowedList) {
      const envEmails = env.ALLOWED_EMAILS;
      if (envEmails) allowedList = envEmails.split(',').map(e => e.trim().toLowerCase());
    }
    if (allowedList && !allowedList.map(e => e.toLowerCase()).includes(pending.email.toLowerCase())) {
      return Response.json({ error: 'このメールアドレスはアクセスが許可されていません。運営にお問い合わせください。' }, { status: 403 });
    }

    // セッションJWT発行（24時間）
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const sessionToken = await signJWT({ email: pending.email, exp }, env.JWT_SECRET);

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append(
      'Set-Cookie',
      `nal_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
    );

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });

  } catch (e) {
    return Response.json({ error: 'サーバーエラー: ' + e.message }, { status: 500 });
  }
}

// ── JWT ユーティリティ ──────────────────────────────────────────────────────

async function signJWT(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = b64url(JSON.stringify(payload));
  const key = await importKey(secret, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}

async function decodeJWT(token, secret) {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;
  const key = await importKey(secret, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, dec(signature), enc(`${header}.${payload}`));
  if (!valid) return null;
  return JSON.parse(new TextDecoder().decode(dec(payload)));
}

function importKey(secret, usages) {
  return crypto.subtle.importKey('raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}

function enc(str) { return new TextEncoder().encode(str); }

function b64url(data) {
  let s;
  if (typeof data === 'string') s = btoa(unescape(encodeURIComponent(data)));
  else { const b = new Uint8Array(data); s = btoa(String.fromCharCode(...b)); }
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function dec(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
