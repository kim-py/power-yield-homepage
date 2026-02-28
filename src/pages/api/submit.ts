import type { APIRoute } from 'astro';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function checkRateLimit(kv: KVNamespace | undefined, ip: string): Promise<boolean> {
  if (!kv) return true; // KV not configured yet — allow
  const key = `rl:sub:${ip}`;
  const count = parseInt((await kv.get(key)) ?? '0');
  if (count >= 2) return false;
  await kv.put(key, String(count + 1), { expirationTtl: 86400 });
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const get = (k: string) => String(body[k] ?? '').trim();

  const company_name   = get('company_name');
  const contact_name   = get('contact_name');
  const contact_email  = get('contact_email');
  const project_name   = get('project_name');
  const technology     = get('technology');
  const volume_raw     = get('volume_eur');
  const stage          = get('stage');
  const country        = get('country');
  const description    = get('description');

  // Validation
  if (!company_name || !contact_name || !contact_email || !project_name ||
      !technology || !stage || !country || !description) {
    return json({ error: 'Missing required fields' }, 422);
  }
  if (!EMAIL_RE.test(contact_email)) {
    return json({ error: 'Invalid email address' }, 422);
  }

  // Rate limiting (2 submissions per IP per day)
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await checkRateLimit(RATE_LIMIT, ip))) {
    return json({ error: 'Too many submissions. Please try again tomorrow.' }, 429);
  }

  // Save to D1
  await DB.prepare(`
    INSERT INTO project_submissions
      (company_name, contact_name, contact_email, project_name, technology,
       volume_eur, stage, country, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      company_name,
      contact_name,
      contact_email,
      project_name,
      technology,
      volume_raw ? Number(volume_raw) : null,
      stage,
      country,
      description,
    )
    .run();

  // Notify admin via Email Workers (requires [[send_email]] binding in wrangler.toml)
  if (EMAIL) {
    try {
      const volume_formatted = volume_raw
        ? `€ ${Number(volume_raw).toLocaleString('de-DE')}`
        : 'N/A';

      const emailBody = [
        'New project submission received on Power Yield.',
        '',
        `Company:     ${company_name}`,
        `Contact:     ${contact_name} <${contact_email}>`,
        `Project:     ${project_name}`,
        `Technology:  ${technology}`,
        `Volume:      ${volume_formatted}`,
        `Stage:       ${stage}`,
        `Country:     ${country}`,
        '',
        'Description:',
        description,
        '',
        'View in admin: https://power-yield.com/admin/submissions',
      ].join('\n');

      const mime = buildMime(
        'Power Yield <noreply@power-yield.com>',
        'hi@power-yield.com',
        `New Project Submission: ${project_name}`,
        emailBody,
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
      // Email errors must not block the submission response
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
