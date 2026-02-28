import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const form = await request.formData();
  const password = form.get('password') as string;
  const env = (locals as any).runtime?.env;
  const adminPassword: string | undefined = env?.ADMIN_PASSWORD;

  if (!password || !adminPassword || password !== adminPassword) {
    return redirect('/admin/login?error=1');
  }

  const token = await hashPassword(adminPassword);
  cookies.set('admin_token', token, {
    httpOnly: true,
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  });

  return redirect('/admin');
};

async function hashPassword(password: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
