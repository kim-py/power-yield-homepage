import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isPublic =
    pathname === '/admin/login' ||
    pathname === '/api/admin/auth' ||
    pathname === '/api/admin/logout';

  if (!isProtected || isPublic) {
    return next();
  }

  const token = context.cookies.get('admin_token')?.value;
  if (!token) {
    return context.redirect('/admin/login');
  }

  const env = (context.locals as any).runtime?.env;
  const adminPassword: string | undefined = env?.ADMIN_PASSWORD;

  if (!adminPassword) {
    return new Response('ADMIN_PASSWORD secret is not configured.', { status: 503 });
  }

  const expected = await hashPassword(adminPassword);
  if (token !== expected) {
    return context.redirect('/admin/login');
  }

  return next();
});

async function hashPassword(password: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
