// NAL認証ミドルウェア
// 全リクエストを検査し、認証済みセッションがなければ /login にリダイレクト

const PUBLIC_PATHS = [
  '/login',
  '/login.html',
  '/register',
  '/register.html',
  '/privacy',
  '/privacy.html',
  '/api/send-otp',
  '/api/verify-otp',
  '/api/register',
  '/style.css',
  '/favicon.ico',
];

const ADMIN_EMAIL = 'shotso1124@gmail.com';
const ADMIN_PATHS = ['/admin', '/api/admin/'];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 公開パスはそのまま通す
  if (PUBLIC_PATHS.some(p => path === p || path.startsWith(p))) {
    return next();
  }

  // 静的アセット（CSS等）はそのまま通す
  if (path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$/)) {
    return next();
  }

  // セッションクッキーを確認
  const cookie = request.headers.get('Cookie') || '';
  const sessionToken = getCookie(cookie, 'nal_session');

  if (!sessionToken) {
    return redirectToLogin(url);
  }

  // JWTを検証
  try {
    const payload = await verifyJWT(sessionToken, env.JWT_SECRET);
    if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
      return redirectToLogin(url);
    }
    // 管理者パスへのアクセスは管理者メールのみ許可
    const isAdminPath = ADMIN_PATHS.some(p => path === p || path.startsWith(p));
    if (isAdminPath && payload.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return Response.redirect(new URL('/', url.origin).toString(), 302);
    }
    return next();
  } catch {
    return redirectToLogin(url);
  }
}

function redirectToLogin(url) {
  const loginUrl = new URL('/login', url.origin);
  return Response.redirect(loginUrl.toString(), 302);
}

function getCookie(cookieStr, name) {
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// HMAC-SHA256 JWT (軽量実装)
async function verifyJWT(token, secret) {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
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
