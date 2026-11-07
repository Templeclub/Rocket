// Relais Strava (fonction Netlify). Il garde le secret de l'application Strava côté serveur :
// échange du code d'autorisation, rafraîchissement du jeton, lecture des activités, déconnexion.
// Il ne stocke rien : les jetons restent sur le téléphone.
//
// Variables d'environnement Netlify : STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.

const STRAVA = 'https://www.strava.com';
const FIELDS = [
  'id', 'name', 'sport_type', 'type', 'start_date', 'start_date_local', 'moving_time', 'elapsed_time', 'distance',
  'total_elevation_gain', 'average_heartrate', 'average_watts', 'device_watts', 'trainer', 'private',
];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function token(params, env) {
  const res = await fetch(`${STRAVA}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env.id, client_secret: env.secret, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: 'strava_token', status: res.status, message: data.message ?? 'Échec de l’échange avec Strava' }, 502);
  const a = data.athlete;
  return json({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteName: a ? [a.firstname, a.lastname].filter(Boolean).join(' ') : undefined,
  });
}

export async function handle(req, env) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const configured = Boolean(env.id && env.secret);
  if (action === 'config') return json({ configured, clientId: configured ? env.id : null });
  if (!configured) return json({ error: 'not_configured' }, 503);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const body = await req.json().catch(() => ({}));

  switch (action) {
    case 'exchange':
      if (!body.code) return json({ error: 'missing_code' }, 400);
      return token({ code: body.code, grant_type: 'authorization_code' }, env);
    case 'refresh':
      if (!body.refreshToken) return json({ error: 'missing_refresh_token' }, 400);
      return token({ refresh_token: body.refreshToken, grant_type: 'refresh_token' }, env);
    case 'activities': {
      if (!body.accessToken) return json({ error: 'missing_access_token' }, 401);
      const q = new URLSearchParams({ per_page: String(Math.min(Number(body.perPage) || 100, 200)), page: String(Number(body.page) || 1) });
      if (body.after) q.set('after', String(Math.floor(Number(body.after))));
      const res = await fetch(`${STRAVA}/api/v3/athlete/activities?${q}`, { headers: { authorization: `Bearer ${body.accessToken}` } });
      if (!res.ok) return json({ error: 'strava_activities', status: res.status }, res.status === 401 ? 401 : 502);
      const list = await res.json();
      return json({ activities: list.map((a) => Object.fromEntries(FIELDS.filter((f) => f in a).map((f) => [f, a[f]]))) });
    }
    case 'deauthorize': {
      if (!body.accessToken) return json({ ok: true });
      await fetch(`${STRAVA}/oauth/deauthorize`, { method: 'POST', headers: { authorization: `Bearer ${body.accessToken}` } }).catch(() => {});
      return json({ ok: true });
    }
    default:
      return json({ error: 'unknown_action' }, 400);
  }
}

export default (req) => handle(req, { id: process.env.STRAVA_CLIENT_ID, secret: process.env.STRAVA_CLIENT_SECRET });

export const config = { path: '/api/strava' };
