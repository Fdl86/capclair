const LEVELS = [1000, 950, 925, 900, 850, 800, 750, 700];
const APPROX_HEIGHT_M = {
  1000: 110,
  950: 500,
  925: 800,
  900: 1000,
  850: 1500,
  800: 1900,
  750: 2500,
  700: 3000
};

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

function getRuntimeCache() {
  try {
    if (typeof caches !== 'undefined' && caches.default) return caches.default;
  } catch {
    // Cache API can be unavailable in some runtimes.
  }
  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundHourIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 13) + ':00:00.000Z';
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

function normalizeSample(sample) {
  const latitude = clamp(Number(sample.latitude), -90, 90);
  const longitude = clamp(Number(sample.longitude), -180, 180);
  const altitudeFt = clamp(Math.round(Number(sample.altitudeFt) / 500) * 500, 0, 12500);
  const timeIso = roundHourIso(sample.timeIso);
  const latCell = Math.round(latitude * 10) / 10;
  const lonCell = Math.round(longitude * 10) / 10;

  return {
    sampleId: String(sample.sampleId || ''),
    branchId: String(sample.branchId || ''),
    latitude: latCell,
    longitude: lonCell,
    altitudeFt,
    timeIso,
    normalizedKey: `${timeIso.slice(0, 13)}Z:${latCell.toFixed(1)}:${lonCell.toFixed(1)}:${altitudeFt}`
  };
}

function validSample(sample) {
  return sample.sampleId && sample.branchId && Number.isFinite(sample.latitude) && Number.isFinite(sample.longitude) && Number.isFinite(sample.altitudeFt);
}

function windToComponents(directionDeg, speedKt) {
  const rad = directionDeg * Math.PI / 180;
  return {
    u: -speedKt * Math.sin(rad),
    v: -speedKt * Math.cos(rad)
  };
}

function componentsToWind(u, v) {
  const speedKt = Math.max(0, Math.round(Math.sqrt(u * u + v * v)));
  const directionDeg = Math.round((Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360);
  return { directionDeg, speedKt };
}

function pickHourIndex(times, targetIso) {
  const targetDate = new Date(targetIso);
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (let index = 0; index < times.length; index += 1) {
    const time = String(times[index]);
    const candidate = new Date(time.endsWith('Z') ? time : `${time}:00Z`);
    const delta = Math.abs(candidate.getTime() - targetDate.getTime());
    if (Number.isFinite(delta) && delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function interpolateWind(hourly, index, altitudeFt) {
  const altitudeM = altitudeFt * 0.3048;
  const values = LEVELS.map((level) => {
    const speed = hourly[`wind_speed_${level}hPa`]?.[index];
    const direction = hourly[`wind_direction_${level}hPa`]?.[index];
    const height = hourly[`geopotential_height_${level}hPa`]?.[index] ?? APPROX_HEIGHT_M[level];

    if (!Number.isFinite(speed) || !Number.isFinite(direction) || !Number.isFinite(height)) return null;
    const components = windToComponents(direction, speed);
    return { level, speed, direction, height, ...components };
  }).filter(Boolean).sort((a, b) => a.height - b.height);

  if (!values.length) return null;
  if (altitudeM <= values[0].height) return { directionDeg: Math.round(values[0].direction), speedKt: Math.round(values[0].speed) };
  if (altitudeM >= values[values.length - 1].height) {
    const last = values[values.length - 1];
    return { directionDeg: Math.round(last.direction), speedKt: Math.round(last.speed) };
  }

  for (let indexValue = 0; indexValue < values.length - 1; indexValue += 1) {
    const lower = values[indexValue];
    const upper = values[indexValue + 1];

    if (altitudeM >= lower.height && altitudeM <= upper.height) {
      const ratio = (altitudeM - lower.height) / Math.max(1, upper.height - lower.height);
      const u = lower.u + (upper.u - lower.u) * ratio;
      const v = lower.v + (upper.v - lower.v) * ratio;
      return componentsToWind(u, v);
    }
  }

  const nearest = values[0];
  return { directionDeg: Math.round(nearest.direction), speedKt: Math.round(nearest.speed) };
}

function createOpenMeteoUrl(baseUrl, sample) {
  const hourly = LEVELS.flatMap((level) => [
    `wind_speed_${level}hPa`,
    `wind_direction_${level}hPa`,
    `geopotential_height_${level}hPa`
  ]).join(',');

  const upstreamUrl = new URL(baseUrl);
  upstreamUrl.searchParams.set('latitude', String(sample.latitude));
  upstreamUrl.searchParams.set('longitude', String(sample.longitude));
  upstreamUrl.searchParams.set('hourly', hourly);
  upstreamUrl.searchParams.set('forecast_days', '3');
  upstreamUrl.searchParams.set('timezone', 'GMT');
  upstreamUrl.searchParams.set('wind_speed_unit', 'kn');
  upstreamUrl.searchParams.set('cell_selection', 'nearest');
  return upstreamUrl;
}

async function fetchFromOpenMeteo(baseUrl, providerName, sample) {
  const upstreamUrl = createOpenMeteoUrl(baseUrl, sample);
  const upstream = await fetch(upstreamUrl.toString(), {
    headers: { Accept: 'application/json' }
  });

  if (!upstream.ok) {
    let reason = `HTTP ${upstream.status}`;
    try {
      const errorBody = await upstream.json();
      reason = errorBody?.reason || reason;
    } catch {
      // Ignore body parse.
    }
    return { wind: null, error: `${providerName}: ${reason}` };
  }

  const data = await upstream.json();
  const times = data.hourly?.time ?? [];
  if (!times.length) {
    return { wind: null, error: `${providerName}: no hourly time array` };
  }

  const hourIndex = pickHourIndex(times, sample.timeIso);
  const wind = interpolateWind(data.hourly, hourIndex, sample.altitudeFt);
  if (!wind) {
    return { wind: null, error: `${providerName}: no pressure-level wind for sample` };
  }

  return {
    wind: {
      ...wind,
      sourceTimeIso: `${String(times[hourIndex])}:00Z`,
      provider: providerName,
      normalizedKey: sample.normalizedKey
    },
    error: null
  };
}

async function fetchOpenMeteo(sample, request, context) {
  const cache = getRuntimeCache();

  if (cache) {
    const cacheUrl = new URL(request.url);
    cacheUrl.pathname = `/api/weather/wind-cache/${encodeURIComponent(sample.normalizedKey)}`;
    const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) return { wind: await cached.json(), errors: [] };

    const attempts = [
      ['https://api.open-meteo.com/v1/meteofrance', 'open-meteo-meteofrance'],
      ['https://api.open-meteo.com/v1/forecast', 'open-meteo-forecast']
    ];
    const errors = [];

    for (const [baseUrl, providerName] of attempts) {
      const result = await fetchFromOpenMeteo(baseUrl, providerName, sample);
      if (result.wind) {
        const response = jsonResponse(result.wind, 200, 3600);
        context.waitUntil(cache.put(cacheKey, response.clone()));
        return { wind: result.wind, errors };
      }
      errors.push(result.error);
    }

    return { wind: null, errors };
  }

  const attempts = [
    ['https://api.open-meteo.com/v1/meteofrance', 'open-meteo-meteofrance'],
    ['https://api.open-meteo.com/v1/forecast', 'open-meteo-forecast']
  ];
  const errors = [];

  for (const [baseUrl, providerName] of attempts) {
    const result = await fetchFromOpenMeteo(baseUrl, providerName, sample);
    if (result.wind) return { wind: result.wind, errors };
    errors.push(result.error);
  }

  return { wind: null, errors };
}

export async function onRequestPost(context) {
  let body;

  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'invalid json', samples: [] }, 400);
  }

  const incoming = Array.isArray(body?.samples) ? body.samples.slice(0, 40) : [];
  const normalized = incoming.map(normalizeSample).filter(validSample);

  const uniqueByKey = new Map();
  for (const sample of normalized) {
    if (!uniqueByKey.has(sample.normalizedKey)) uniqueByKey.set(sample.normalizedKey, sample);
  }

  const fetchedByKey = new Map();
  const errors = [];

  await Promise.all([...uniqueByKey.values()].map(async (sample) => {
    try {
      const result = await fetchOpenMeteo(sample, context.request, context);
      if (result.wind) {
        fetchedByKey.set(sample.normalizedKey, result.wind);
      } else {
        errors.push({ key: sample.normalizedKey, reasons: result.errors });
      }
    } catch (error) {
      errors.push({ key: sample.normalizedKey, reasons: [error instanceof Error ? error.message : 'unknown error'] });
    }
  }));

  const samples = normalized
    .map((sample) => {
      const wind = fetchedByKey.get(sample.normalizedKey);
      if (!wind) return null;
      return {
        sampleId: sample.sampleId,
        branchId: sample.branchId,
        directionDeg: wind.directionDeg,
        speedKt: wind.speedKt,
        sourceTimeIso: wind.sourceTimeIso,
        provider: wind.provider,
        normalizedKey: sample.normalizedKey
      };
    })
    .filter(Boolean);

  return jsonResponse({
    source: 'open-meteo',
    generatedAt: new Date().toISOString(),
    samples,
    errors: errors.slice(0, 8),
    cacheRuntime: getRuntimeCache() ? 'available' : 'unavailable'
  });
}
