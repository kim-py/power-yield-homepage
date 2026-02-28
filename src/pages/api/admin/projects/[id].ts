import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, params, redirect }) => {
  const { DB } = locals.runtime.env;
  const { id } = params;
  const form = await request.formData();
  const method = form.get('_method');

  if (method === 'DELETE') {
    await DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
    return redirect('/admin/projects');
  }

  if (method === 'PATCH') {
    // Quick visibility toggle (from project list)
    if (form.get('_toggle_visible') === '1') {
      await DB.prepare('UPDATE projects SET is_visible = ? WHERE id = ?')
        .bind(form.get('is_visible') === '1' ? 1 : 0, id)
        .run();
      return redirect('/admin/projects');
    }

    // Full update (from edit form)
    await DB.prepare(`
      UPDATE projects SET
        name = ?, location = ?, developer_name = ?, technology = ?, technology_label = ?,
        status = ?, volume_eur = ?, target_irr = ?, capacity_mw = ?, duration_years = ?,
        region_code = ?, revenue_type = ?, funding_progress_pct = ?, opens_label = ?,
        is_featured = ?, display_order = ?, is_visible = ?
      WHERE id = ?
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
      id,
    ).run();

    return redirect('/admin/projects');
  }

  return new Response('Method not allowed', { status: 405 });
};
