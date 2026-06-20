function jsonResponse(body, status = 200, cacheSeconds = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept'
    }
  });
}

function normalizeIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : [])
    .map((id) => String(id || '').trim().toUpperCase())
    .filter((id) => /^[A-Z0-9]{4}$/.test(id)))]
    .slice(0, 6);
}

function rawMetar(item) {
  return item?.rawOb || item?.raw_text || item?.raw || item?.metar || '';
}

function rawTaf(item) {
  return item?.rawTAF || item?.rawTaf || item?.raw_text || item?.raw || item?.taf || '';
}

async function fetchJsonProduct(product, ids) {
  const url = new URL(`https://aviationweather.gov/api/data/${product}`);
  url.searchParams.set('ids', ids.join(','));
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });

  if (response.status === 204 || response.status === 404) return [];
  if (!response.ok) throw new Error(`${product} ${response.status}`);

  try {
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'invalid json', reports: [] }, 400);
  }

  const ids = normalizeIds(body?.ids);
  if (!ids.length) return jsonResponse({ generatedAt: new Date().toISOString(), reports: [] });

  try {
    const [metars, tafs] = await Promise.all([
      fetchJsonProduct('metar', ids),
      fetchJsonProduct('taf', ids)
    ]);

    const byId = new Map(ids.map((id) => [id, {
      icao: id,
      metarRaw: '',
      tafRaw: '',
      updatedAtIso: new Date().toISOString(),
      source: 'aviationweather.gov',
      status: 'missing'
    }]));

    for (const item of metars) {
      const id = String(item?.icaoId || item?.station_id || item?.id || '').toUpperCase();
      if (!byId.has(id)) continue;
      const current = byId.get(id);
      current.metarRaw = rawMetar(item);
      current.status = current.metarRaw || current.tafRaw ? 'ok' : current.status;
    }

    for (const item of tafs) {
      const id = String(item?.icaoId || item?.station_id || item?.id || '').toUpperCase();
      if (!byId.has(id)) continue;
      const current = byId.get(id);
      current.tafRaw = rawTaf(item);
      current.status = current.metarRaw || current.tafRaw ? 'ok' : current.status;
    }

    return jsonResponse({
      generatedAt: new Date().toISOString(),
      reports: [...byId.values()]
    }, 200, 300);
  } catch (error) {
    return jsonResponse({
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'weather fetch failed',
      reports: ids.map((id) => ({ icao: id, status: 'error' }))
    }, 200);
  }
}
