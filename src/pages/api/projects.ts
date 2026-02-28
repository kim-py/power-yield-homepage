import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals, url }) => {
  const { DB } = locals.runtime.env;

  const tech = url.searchParams.get('tech');
  const status = url.searchParams.get('status');
  const featured = url.searchParams.get('featured');

  let query = 'SELECT * FROM projects WHERE is_visible = 1';
  const params: (string | number)[] = [];

  if (tech && tech !== 'all') {
    query += ' AND technology = ?';
    params.push(tech);
  }
  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (featured === '1') {
    query += ' AND is_featured = 1';
  }

  query += ' ORDER BY display_order ASC';

  const { results } = await DB.prepare(query).bind(...params).all();

  return new Response(JSON.stringify({ projects: results, total: results.length }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
};
