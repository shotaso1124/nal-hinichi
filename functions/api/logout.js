// GET /api/logout
export async function onRequestGet(context) {
  const headers = new Headers();
  headers.append('Set-Cookie', 'nal_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  headers.append('Location', '/login');
  return new Response(null, { status: 302, headers });
}
