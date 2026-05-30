// GET/POST/DELETE /api/admin/members
// 管理者専用：許可メールアドレスのホワイトリスト管理API

const ADMIN_EMAIL = 'shotso1124@gmail.com';

export async function onRequestGet(context) {
  const { request, env } = context;
  const adminCheck = await verifyAdmin(request, env);
  if (!adminCheck.ok) return adminCheck.response;

  const raw = await env.NAL_MEMBERS.get('allowed_emails');
  const list = raw ? JSON.parse(raw) : [];
  return Response.json({ emails: list });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const adminCheck = await verifyAdmin(request, env);
  if (!adminCheck.ok) return adminCheck.response;

  const { email } = await request.json();
  if (!email || !email.includes('@')) {
    return Response.json({ error: 'メールアドレスが無効です' }, { status: 400 });
  }

  const raw = await env.NAL_MEMBERS.get('allowed_emails');
  const list = raw ? JSON.parse(raw) : [];
  const normalized = email.trim().toLowerCase();
  if (!list.includes(normalized)) {
    list.push(normalized);
    await env.NAL_MEMBERS.put('allowed_emails', JSON.stringify(list));
  }
  return Response.json({ success: true, emails: list });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const adminCheck = await verifyAdmin(request, env);
  if (!adminCheck.ok) return adminCheck.response;

  const { email } = await request.json();
  const raw = await env.NAL_MEMBERS.get('allowed_emails');
  let list = raw ? JSON.parse(raw) : [];
  list = list.filter(e => e !== email.trim().toLowerCase());
  await env.NAL_MEMBERS.put('allowed_emails', JSON.stringify(list));
  return Response.json({ success: true, emails: list });
}

// ── 管理者検証 ────────────────────────────────────────────────

async function verifyAdmin(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const token = getCookie(cookie, 'nal_session');
  if (!token) {
    return { ok: false, response: Response.json({ error: '認証が必要です' }, { status: 401 }) };
  }

  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, response: Response.json({ error: 'セッションが切れています' }, { status: 401 }) };
    }
    if (payload.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return { ok: false, response: Response.json({ error: '管理者権限がありません' }, { status: 403 }) };
    }
    return { ok: true, email: payload.email };
  } catch {
    return { ok: false, response: Response.json({ error: '認証エラー' }, { status: 401 }) };
  }
}

function getCookie(cookieStr, name) {
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function verifyJWT(token, secret) {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig = base64UrlDecode(signature);
  const valid = await crypto.subtle.verify('HMAC', key, sig, data);
  if (!valid) return null;
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
