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

async function sendResendEmail(apiKey: string, from: string, to: string, subject: string, text: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as any;
  const { DB, RATE_LIMIT, RESEND_API_KEY } = env;

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

  // Notify admin via Resend
  if (RESEND_API_KEY) {
    try {
      await sendResendEmail(
        RESEND_API_KEY,
        'Power Yield <kim@power-yield.com>',
        'kim@power-yield.com',
        'New Waitlist Signup',
        `A new investor joined the waitlist.\n\nEmail:  ${email}\nSource: ${source}\nDate:   ${new Date().toISOString()}`,
      );
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
