function jsonResponse(body, cacheSeconds = 300) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`,
      'Access-Control-Allow-Origin': '*',
      'X-Cap-Clair-Proxy': 'ign-elevation'
    }
  });
}

function numericElevation(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= -9000) return null;
  return parsed;
}

function extractElevations(payload) {
  if (!payload || typeof payload !== 'object') return [];

  const root = Array.isArray(payload) ? payload : payload.elevations;
  if (!Array.isArray(root)) return [];

  return root
    .map((entry) => {
      if (typeof entry === 'number' || typeof entry === 'string') return numericElevation(entry);
      if (!entry || typeof entry !== 'object') return null;
      return numericElevation(entry.z ?? entry.elevation ?? entry.alti ?? entry.altitude ?? entry.value);
    })
    .filter((value) => value !== null);
}

export async function onRequestGet(context) {
  const { request } = context;

  try {
    const url = new URL(request.url);
    const lon = url.searchParams.get('lon');
    const lat = url.searchParams.get('lat');

    if (!lon || !lat || lon.length > 5000 || lat.length > 5000) {
      return jsonResponse({ elevations: [] }, 300);
    }

    const upstreamUrl = new URL('https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json');
    upstreamUrl.searchParams.set('lon', lon);
    upstreamUrl.searchParams.set('lat', lat);
    upstreamUrl.searchParams.set('resource', 'IGN_RGE_ALTI_WLD');
    upstreamUrl.searchParams.set('delimiter', '|');
    upstreamUrl.searchParams.set('zonly', 'true');

    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const upstream = await fetch(upstreamUrl.toString(), {
      headers: { Accept: 'application/json' }
    });

    if (!upstream.ok) {
      return jsonResponse({ elevations: [] }, 300);
    }

    const payload = await upstream.json();
    const response = jsonResponse({ elevations: extractElevations(payload) }, 604800);
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return jsonResponse({ elevations: [] }, 300);
  }
}
