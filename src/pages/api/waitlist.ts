import type { APIRoute } from 'astro';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function checkRateLimit(kv: KVNamespace | undefined, ip: string): Promise<boolean> {
  if (!kv) return true; // KV not configured yet — allow
  const key = `rl:wl:${ip}`;
  const count = parseInt((await kv.get(key)) ?? '0');
  if (count >= 5) return false;
  await kv.put(key, String(count + 1), { expirationTtl: 3600 });
  return true;
}

function buildMime(from: string, to: string, subject: string, body: string): string {
  return [
    'MIME-Version: 1.0',
    `Date: ${new Date().toUTCString()}`,
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as any;
  const { DB, RATE_LIMIT, EMAIL } = env;

  let body: { email?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const source = String(body.source ?? 'unknown').slice(0, 32);

  if (!EMAIL_RE.test(email)) {
    return json({ error: 'Invalid email address' }, 422);
  }

  // Rate limiting (5 sign-ups per IP per hour)
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await checkRateLimit(RATE_LIMIT, ip))) {
    return json({ error: 'Too many requests. Try again later.' }, 429);
  }

  // Save to D1
  try {
    await DB.prepare('INSERT INTO waitlist (email, source) VALUES (?, ?)')
      .bind(email, source)
      .run();
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) {
      // Already on waitlist — silently succeed
      return json({ ok: true }, 200);
    }
    throw err;
  }

  // Notify admin via Email Workers (requires [[send_email]] binding in wrangler.toml)
  if (EMAIL) {
    try {
      const mime = buildMime(
        'Power Yield <noreply@power-yield.com>',
        'hi@power-yield.com',
        'New Waitlist Signup',
        `A new investor joined the waitlist.\n\nEmail:  ${email}\nSource: ${source}\nDate:   ${new Date().toISOString()}`,
      );
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(mime));
          controller.close();
        },
      });
      const msg = new (globalThis as any).EmailMessage(
        'noreply@power-yield.com',
        'hi@power-yield.com',
        stream,
      );
      await EMAIL.send(msg);
    } catch {
      // Email errors must not block the signup response
    }
  }

  return json({ ok: true }, 200);
};

function json(data: object, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
