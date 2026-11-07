import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error module JavaScript de la fonction Netlify
import { handle } from './strava.mjs';

const env = { id: '12345', secret: 's3cr3t' };
const req = (action: string, body?: unknown) =>
  new Request(`https://ascese.netlify.app/api/strava?action=${action}`, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });

afterEach(() => vi.unstubAllGlobals());

describe('relais Strava', () => {
  it('config : indique si l’application Strava est configurée, sans jamais renvoyer le secret', async () => {
    const r = await (await handle(req('config'), env)).json();
    expect(r).toEqual({ configured: true, clientId: '12345' });
    expect(JSON.stringify(r)).not.toContain('s3cr3t');
    expect(await (await handle(req('config'), {})).json()).toEqual({ configured: false, clientId: null });
  });

  it('échange du code : envoie le secret à Strava et renvoie les jetons', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: 99, athlete: { firstname: 'Yoann', lastname: 'Q' } })));
    vi.stubGlobal('fetch', fetch);
    const r = await (await handle(req('exchange', { code: 'abc' }), env)).json();
    expect(r).toEqual({ accessToken: 'a', refreshToken: 'r', expiresAt: 99, athleteName: 'Yoann Q' });
    const sent = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent).toMatchObject({ client_id: '12345', client_secret: 's3cr3t', code: 'abc', grant_type: 'authorization_code' });
  });

  it('activités : relaie le jeton, filtre les champs', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify([{ id: 1, name: 'Football', sport_type: 'Workout', start_date_local: '2026-11-09T19:00:00Z', moving_time: 5400, map: { polyline: 'xx' } }])));
    vi.stubGlobal('fetch', fetch);
    const r = await (await handle(req('activities', { accessToken: 'tok', after: 1700000000, page: 2 }), env)).json();
    expect(r.activities[0]).toEqual({ id: 1, name: 'Football', sport_type: 'Workout', start_date_local: '2026-11-09T19:00:00Z', moving_time: 5400 });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('after=1700000000');
    expect(url).toContain('page=2');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('non configurée : 503', async () => {
    expect((await handle(req('exchange', { code: 'x' }), {})).status).toBe(503);
  });
});
