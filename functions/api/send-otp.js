// POST /api/send-otp
// メールアドレスにOTPを送信する

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email } = await request.json();
    if (!email || !email.includes('@')) {
      return Response.json({ error: 'メールアドレスを正しく入力してください' }, { status: 400 });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const exp = Math.floor(Date.now() / 1000) + 600; // 10分有効

    // OTPをJWTに埋め込む（KV不要）
    const pendingToken = await signJWT({ email, otp, exp }, env.JWT_SECRET);

    // Resendでメール送信
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NEXT AI LAB <noreply@hinichi.com>',
        to: [email],
        subject: '【NEXT AI LAB】ログインコード',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;">
            <h2 style="color:#ff6b35;">NEXT AI LAB</h2>
            <p>以下のコードを入力してログインしてください。</p>
            <div style="font-size:2.5rem;font-weight:700;letter-spacing:.5rem;color:#0a0a0a;background:#f3f4f6;padding:1.5rem;border-radius:8px;text-align:center;margin:1.5rem 0;">
              ${otp}
            </div>
            <p style="color:#666;font-size:.875rem;">このコードは10分間有効です。<br>身に覚えのない場合は無視してください。</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return Response.json({ error: 'メール送信に失敗しました' }, { status: 500 });
    }

    return Response.json({ success: true, pendingToken });

  } catch (e) {
    return Response.json({ error: 'サーバーエラー: ' + e.message }, { status: 500 });
  }
}

async function signJWT(payload, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = base64UrlEncode(JSON.stringify(payload));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${body}`)
  );

  return `${header}.${body}.${base64UrlEncode(sig)}`;
}

function base64UrlEncode(data) {
  let str;
  if (typeof data === 'string') {
    str = btoa(unescape(encodeURIComponent(data)));
  } else {
    const bytes = new Uint8Array(data);
    str = btoa(String.fromCharCode(...bytes));
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
