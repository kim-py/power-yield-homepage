import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { DB } = locals.runtime.env;
  const form = await request.formData();

  await DB.prepare(`
    INSERT INTO projects
      (name, location, developer_name, technology, technology_label, status,
       volume_eur, target_irr, capacity_mw, duration_years, region_code, revenue_type,
       funding_progress_pct, opens_label, is_featured, display_order, is_visible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    form.get('name'),
    form.get('location'),
    form.get('developer_name'),
    form.get('technology'),
    form.get('technology_label'),
    form.get('status'),
    Number(form.get('volume_eur')),
    Number(form.get('target_irr')),
    Number(form.get('capacity_mw')),
    Number(form.get('duration_years')),
    form.get('region_code'),
    form.get('revenue_type'),
    Number(form.get('funding_progress_pct') ?? 0),
    form.get('opens_label') || null,
    form.get('is_featured') === '1' ? 1 : 0,
    Number(form.get('display_order') ?? 0),
    form.get('is_visible') === '1' ? 1 : 0,
  ).run();

  return redirect('/admin/projects');
};
