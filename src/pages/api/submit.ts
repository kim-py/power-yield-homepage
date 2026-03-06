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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const get = (k: string) => String(body[k] ?? '').trim();

  const company_name    = get('company_name');
  const contact_name    = get('contact_name');
  const contact_email   = get('contact_email');
  const project_name    = get('project_name');
  const technology_raw  = get('technology');       // e.g. "wind|Wind — Offshore"
  const volume_raw      = get('volume_eur');
  const stage           = get('stage');
  const description     = get('description');
  const location        = get('location');
  const region_code     = get('region_code');
  const target_irr_raw  = get('target_irr');
  const capacity_mw_raw = get('capacity_mw');
  const duration_raw    = get('duration_years');
  const revenue_type    = get('revenue_type');

  // Parse technology "solar|Solar PV" → technology + technology_label
  const [technology, technology_label] = technology_raw.includes('|')
    ? technology_raw.split('|', 2)
    : [technology_raw, technology_raw];

  // Validation
  if (!company_name || !contact_name || !contact_email || !project_name ||
      !technology || !stage || !description || !location || !region_code ||
      !target_irr_raw || !capacity_mw_raw || !duration_raw || !revenue_type) {
    return json({ error: 'Missing required fields' }, 422);
  }
  if (!EMAIL_RE.test(contact_email)) {
    return json({ error: 'Invalid email address' }, 422);
  }

  const volume_eur    = volume_raw ? Number(volume_raw) : 0;
  const target_irr    = Number(target_irr_raw);
  const capacity_mw   = Number(capacity_mw_raw);
  const duration_years = Number(duration_raw);

  if (isNaN(target_irr) || isNaN(capacity_mw) || isNaN(duration_years)) {
    return json({ error: 'Invalid numeric values' }, 422);
  }

  // Rate limiting (2 submissions per IP per day)
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await checkRateLimit(RATE_LIMIT, ip))) {
    return json({ error: 'Too many submissions. Please try again tomorrow.' }, 429);
  }

  // Save contact info to project_submissions
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
      volume_eur || null,
      stage,
      region_code,
      description,
    )
    .run();

  // Insert into projects table as invisible (pending review)
  await DB.prepare(`
    INSERT INTO projects
      (name, location, developer_name, technology, technology_label, status,
       volume_eur, target_irr, capacity_mw, duration_years, region_code,
       revenue_type, funding_progress_pct, opens_label, is_featured, display_order, is_visible)
    VALUES (?, ?, ?, ?, ?, 'coming', ?, ?, ?, ?, ?, ?, 0, NULL, 0, 0, 0)
  `)
    .bind(
      project_name,
      location,
      company_name,
      technology,
      technology_label,
      volume_eur,
      target_irr,
      capacity_mw,
      duration_years,
      region_code,
      revenue_type,
    )
    .run();

  // Notify admin via Resend
  if (RESEND_API_KEY) {
    try {
      const volume_formatted = volume_eur
        ? `€ ${volume_eur.toLocaleString('de-DE')}`
        : 'N/A';

      const emailBody = [
        'New project submission received on Power Yield.',
        '',
        `Company:     ${company_name}`,
        `Contact:     ${contact_name} <${contact_email}>`,
        `Project:     ${project_name}`,
        `Technology:  ${technology_label}`,
        `Location:    ${location} (${region_code})`,
        `Volume:      ${volume_formatted}`,
        `Target IRR:  ${target_irr}%`,
        `Capacity:    ${capacity_mw} MW`,
        `Duration:    ${duration_years} Years`,
        `Revenue:     ${revenue_type}`,
        `Stage:       ${stage}`,
        '',
        'Description:',
        description,
        '',
        'The project has been added to the database as invisible (pending review).',
        'View in admin: https://power-yield.com/admin/projects',
      ].join('\n');

      await sendResendEmail(
        RESEND_API_KEY,
        'Power Yield <kim@power-yield.com>',
        'kim@power-yield.com',
        `New Project Submission: ${project_name}`,
        emailBody,
      );
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
