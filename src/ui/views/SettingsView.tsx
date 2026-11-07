import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as A from '../../db/actions';
import { db, exportData, importData } from '../../db/db';
import { backupFileName, makeBackup, parseBackup } from '../../engine/backup';
import { CONFIG } from '../../engine/config';
import { isLocalDate, labelShort } from '../../engine/dates';
import { builtinTemplates } from '../../engine/library';
import { SPORT_KEYS, SPORT_META, sportKey } from '../../engine/sports';
import type { AppSettings, Goal, Profile } from '../../engine/types';
import { formatDuration, formatHours, hrZones, powerZones } from '../../engine/zones';
import { Field, inputCls, NumberInput, Segmented } from '../components/Form';
import { applyTheme } from '../theme';
import { CloudSection } from './CloudSection';
import { IconCalendarSpark, IconFlag, IconPin, IconPlus, IconPulse, IconRight, IconSave, IconSettings, IconStack, IconStar, IconLink } from '../components/Icons';
import { Sheet } from '../components/Sheet';
import { StravaSection } from './StravaSection';
import { useToast } from '../components/Toast';
import { useNav, useSettings } from '../hooks';
import { useInstallPrompt } from '../install';
import { AvailabilitySection, ProgramSection } from './ProgramSettings';
import { SportGlyph } from '../components/SportGlyph';

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-raised/60 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export type SettingsSection = 'program' | 'availability' | 'goal' | 'profile' | 'library' | 'strava' | 'data' | 'app';

const TITLES: Record<SettingsSection, string> = {
  program: 'Programme',
  availability: 'Disponibilités',
  goal: 'Objectif',
  profile: 'Profil et zones',
  library: 'Séances types',
  strava: 'Strava',
  data: 'Sauvegarde',
  app: 'Application',
};

function Row({ section, icon, detail }: { section: SettingsSection; icon: ReactNode; detail: ReactNode }) {
  const nav = useNav();
  return (
    <button onClick={() => nav.open({ kind: 'settings', section })} className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-raised">
      <span className="w-9 h-9 rounded-xl bg-raised grid place-items-center text-muted shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-medium">{TITLES[section]}</span>
        <span className="block text-xs text-muted truncate">{detail}</span>
      </span>
      <IconRight className="w-4 h-4 text-muted" />
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted px-2 mb-1.5">{title}</h2>
      <div className="rounded-2xl bg-surface card-shadow divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

/** Accueil des paramètres : rubriques regroupées, chacune s'ouvre dans son panneau. */
export function SettingsView() {
  const settings = useSettings();
  const weeks = useLiveQuery(() => db.weeks.count(), []) ?? 0;
  const goal = useLiveQuery(async () => (await db.goals.toArray()).find((g) => g.kind === 'main'), []);
  const templates = useLiveQuery(() => db.templates.count(), []) ?? 0;
  const strava = useLiveQuery(() => db.integrations.get('strava'), []);
  const cloud = useLiveQuery(() => db.cloud.get('cloud'), []);
  const p = settings.profile;
  const a = settings.availability;
  const days = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  const parisDays = Object.entries(a.template).filter(([, t]) => t.paris).map(([k]) => days[Number(k) - 1]);
  return (
    <div className="space-y-5">
      <Group title="Entraînement">
        <Row section="program" icon={<IconCalendarSpark />} detail={weeks ? `${weeks} semaines · ${formatHoursShort(settings.volume.startWeeklyHours)} → ${formatHoursShort(settings.volume.peakWeeklyHours)} d’endurance` : 'Pas encore généré'} />
        <Row section="availability" icon={<IconPin />} detail={`Paris ${parisDays.join('-') || 'aucun'} · foot ${a.footballDays.map((d) => days[d - 1]).join(' et ')} · ${a.exceptions.length} absence(s)`} />
        <Row section="goal" icon={<IconFlag />} detail={goal ? `${goal.name} · ${labelShort(goal.date)}` : '—'} />
      </Group>
      <Group title="Profil">
        <Row section="profile" icon={<IconPulse />} detail={`FTP ${p.ftp} W · FC max ${p.hrMax} · zones`} />
        <Row section="library" icon={<IconStack />} detail={`${templates} séances types`} />
      </Group>
      <Group title="Connexions">
        <Row
          section="strava"
          icon={<IconLink />}
          detail={strava ? `Connecté${strava.athleteName ? ` · ${strava.athleteName}` : ''}${strava.lastSyncAt ? ` · synchro ${timeAgo(strava.lastSyncAt)}` : ''}` : 'Non connecté'}
        />
      </Group>
      <Group title="Données et application">
        <Row section="data" icon={<IconSave />} detail={cloud ? `En ligne · ${cloud.lastBackupAt ? timeAgo(cloud.lastBackupAt) : 'pas encore envoyée'}` : 'Sauvegarde en ligne désactivée · export JSON'} />
        <Row section="app" icon={<IconSettings />} detail={`Thème ${({ auto: 'automatique', light: 'jour', dark: 'nuit' } as const)[settings.theme ?? 'auto']} · installation`} />
      </Group>
    </div>
  );
}

/** Une rubrique des paramètres, en panneau plein écran (le retour Android le ferme). */
export function SettingsSheet({ section }: { section: SettingsSection }) {
  const nav = useNav();
  const settings = useSettings();
  const save = (s: AppSettings) => A.saveSettings(s);
  const setProfile = (pr: Partial<Profile>) => save({ ...settings, profile: { ...settings.profile, ...pr } });
  let body: ReactNode;
  switch (section) {
    case 'program':
      body = <ProgramSection />;
      break;
    case 'availability':
      body = <AvailabilitySection />;
      break;
    case 'goal':
      body = <GoalSection />;
      break;
    case 'profile':
      body = (
        <>
          <Section title="Profil">
            <div className="grid grid-cols-2 gap-2">
              <Field label="FTP (W)">
                <NumberInput value={settings.profile.ftp} onChange={(v) => v && setProfile({ ftp: v })} />
              </Field>
              <Field label="FC max (bpm)">
                <NumberInput value={settings.profile.hrMax} onChange={(v) => v && setProfile({ hrMax: v })} />
              </Field>
              <Field label="FC repos (bpm)">
                <NumberInput value={settings.profile.hrRest} onChange={(v) => v && setProfile({ hrRest: v })} />
              </Field>
              <Field label="VO2max">
                <NumberInput value={settings.profile.vo2max} step={0.1} onChange={(v) => v && setProfile({ vo2max: v })} />
              </Field>
            </div>
          </Section>
          <PowerZones settings={settings} save={save} />
          <HrZonesSection settings={settings} save={save} />
        </>
      );
      break;
    case 'library':
      body = <Library />;
      break;
    case 'strava':
      body = <StravaSection />;
      break;
    case 'data':
      body = (
        <>
          <CloudSection />
          <DataSection />
        </>
      );
      break;
    case 'app':
      body = <AppSection />;
      break;
  }
  return (
    <Sheet title={TITLES[section]} onClose={nav.close} full>
      <div className="space-y-3 -mx-1">{body}</div>
    </Sheet>
  );
}

function timeAgo(t: number): string {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

const formatHoursShort = (h: number) => formatHours(h);

function PowerZones({ settings, save }: { settings: AppSettings; save: (s: AppSettings) => void }) {
  const zones = powerZones(settings.profile.ftp, settings.powerZoneUpperPct);
  return (
    <Section
      title="Zones de puissance (home-trainer)"
      aside={
        <button className="text-sm text-accent" onClick={() => save({ ...settings, powerZoneUpperPct: [...CONFIG.powerZoneUpperPct] })}>
          Réinitialiser
        </button>
      }
    >
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="text-left font-normal">Zone</th>
            <th className="text-right font-normal">jusqu’à % FTP</th>
            <th className="text-right font-normal">Watts</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z, i) => (
            <tr key={z.index} className="border-t border-line">
              <td className="py-1.5">
                Z{z.index} <span className="text-muted">{z.name}</span>
              </td>
              <td className="text-right">
                {z.highPct === null ? (
                  <span className="text-muted">&gt; {settings.powerZoneUpperPct.at(-1)}</span>
                ) : (
                  <input
                    type="number"
                    inputMode="numeric"
                    className="w-16 h-9 rounded-md bg-raised text-right px-2"
                    value={settings.powerZoneUpperPct[i]}
                    onChange={(e) => {
                      const next = [...settings.powerZoneUpperPct];
                      next[i] = Number(e.target.value);
                      save({ ...settings, powerZoneUpperPct: next });
                    }}
                  />
                )}
              </td>
              <td className="text-right tabular-nums text-muted">
                {z.low}–{z.high ?? '…'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function HrZonesSection({ settings, save }: { settings: AppSettings; save: (s: AppSettings) => void }) {
  const zones = hrZones(settings.profile.hrMax, settings.hrZoneBoundsPct);
  const setBound = (i: number, v: number) => {
    const next = [...settings.hrZoneBoundsPct];
    next[i] = v;
    save({ ...settings, hrZoneBoundsPct: next });
  };
  return (
    <Section
      title="Zones de FC"
      aside={
        <button className="text-sm text-accent" onClick={() => save({ ...settings, hrZoneBoundsPct: [...CONFIG.hrZoneBoundsPct] })}>
          Réinitialiser
        </button>
      }
    >
      <p className="text-xs text-muted">En % de la FC max. Recopie les bornes de l’app Suunto si elles diffèrent.</p>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="text-left font-normal">Zone</th>
            <th className="text-right font-normal">de %</th>
            <th className="text-right font-normal">à %</th>
            <th className="text-right font-normal">bpm</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z, i) => (
            <tr key={z.index} className="border-t border-line">
              <td className="py-1.5">
                Z{z.index} <span className="text-muted">{z.name}</span>
              </td>
              <td className="text-right">
                {i === 0 ? (
                  <input type="number" className="w-14 h-9 rounded-md bg-raised text-right px-2" value={settings.hrZoneBoundsPct[0]} onChange={(e) => setBound(0, Number(e.target.value))} />
                ) : (
                  <span className="text-muted">{z.lowPct}</span>
                )}
              </td>
              <td className="text-right">
                <input type="number" className="w-14 h-9 rounded-md bg-raised text-right px-2" value={settings.hrZoneBoundsPct[i + 1]} onChange={(e) => setBound(i + 1, Number(e.target.value))} />
              </td>
              <td className="text-right tabular-nums text-muted">
                {z.low}–{z.high}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function GoalSection() {
  const goal = useLiveQuery(async () => (await db.goals.toArray()).find((x) => x.kind === 'main'), []);
  const [g, setG] = useState<Goal | undefined>();
  useEffect(() => setG(goal), [goal]);
  if (!g) return null;
  const set = (p: Partial<Goal>) => {
    const next = { ...g, ...p };
    setG(next);
    if (isLocalDate(next.date)) A.saveGoal(next);
  };
  return (
    <Section title="Objectif principal">
      <Field label="Nom">
        <input className={inputCls} value={g.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date">
          <input type="date" className={inputCls} value={g.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Durée max (jours)">
          <NumberInput value={g.maxDays} onChange={(maxDays) => set({ maxDays })} />
        </Field>
        <Field label="Distance (km)">
          <NumberInput value={g.distanceKm} onChange={(distanceKm) => set({ distanceKm })} />
        </Field>
        <Field label="D+ (m)">
          <NumberInput value={g.elevationM} onChange={(elevationM) => set({ elevationM })} />
        </Field>
      </div>
      <p className="text-xs text-muted">Les jalons intermédiaires arrivent en phase 1.</p>
    </Section>
  );
}

function Library() {
  const nav = useNav();
  const toast = useToast();
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];
  return (
    <Section
      title="Bibliothèque de séances types"
      aside={
        <button className="text-sm text-accent flex items-center gap-1" onClick={() => nav.open({ kind: 'template' })}>
          <IconPlus className="w-4 h-4" /> Nouvelle
        </button>
      }
    >
      {SPORT_KEYS.map((k) => {
        const list = templates.filter((t) => sportKey(t.sport, t.environment) === k).sort((a, b) => a.title.localeCompare(b.title));
        if (!list.length) return null;
        return (
          <div key={k}>
            <div className="text-xs text-muted mb-1">
              <span className="flex items-center gap-1.5">
                <SportGlyph k={k} size={18} badge={false} /> {SPORT_META[k].label}
              </span>
            </div>
            <div className="divide-y divide-line rounded-xl bg-raised">
              {list.map((t) => (
                <button key={t.id} className="w-full text-left px-3 py-2.5 flex items-center gap-2" onClick={() => nav.open({ kind: 'template', id: t.id })}>
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.priority === 'key' && (
                    <span className="text-accent">
                      <IconStar />
                    </span>
                  )}
                  <span className="text-sm text-muted">{formatDuration(t.targetDurationMin * 60)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <button
        className="text-sm text-accent"
        onClick={async () => {
          const have = new Set(templates.map((t) => t.id));
          const missing = builtinTemplates().filter((t) => !have.has(t.id));
          await db.templates.bulkPut(missing);
          toast(missing.length ? `${missing.length} séance(s) type d’origine restaurée(s)` : 'Toutes les séances types d’origine sont présentes');
        }}
      >
        Restaurer les séances types d’origine manquantes
      </button>
    </Section>
  );
}

function DataSection() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const counts = useLiveQuery(async () => ({ s: await db.sessions.count(), a: await db.activities.count() }), []);

  const doExport = async () => {
    const backup = makeBackup(await exportData());
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Sauvegarde exportée');
  };

  const doImport = async (file: File) => {
    const r = parseBackup(await file.text());
    if (!r.ok) {
      toast(`Import refusé : ${r.errors[0]}`);
      return;
    }
    const d = r.backup.data;
    const ok = window.confirm(
      `Remplacer toutes les données actuelles par cette sauvegarde ?\n${d.sessions.length} séances, ${d.activities.length} activités, ${d.templates.length} séances types.`,
    );
    if (!ok) return;
    await importData(d);
    toast('Sauvegarde importée');
  };

  return (
    <Section title="Fichier de sauvegarde">
      <p className="text-sm text-muted">
        Copie sur ce téléphone{counts ? ` : ${counts.s} séances, ${counts.a} activités` : ''}. Export et import d’un fichier JSON (sans les connexions Strava ni la phrase secrète).
      </p>
      <div className="flex gap-2">
        <button className="flex-1 h-11 rounded-xl bg-sport font-medium" onClick={doExport}>
          Exporter (JSON)
        </button>
        <button className="flex-1 h-11 rounded-xl bg-raised font-medium" onClick={() => fileRef.current?.click()}>
          Importer
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) doImport(f);
          }}
        />
      </div>
    </Section>
  );
}

function AppSection() {
  const install = useInstallPrompt();
  const settings = useSettings();
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  return (
    <>
    <Section title="Affichage">
      <Segmented
        value={settings.theme ?? 'auto'}
        onChange={(theme) => {
          applyTheme(theme);
          A.saveSettings({ ...settings, theme });
        }}
        options={[
          { value: 'auto', label: 'Automatique' },
          { value: 'light', label: 'Jour' },
          { value: 'dark', label: 'Nuit' },
        ]}
      />
      <p className="text-xs text-muted">Automatique suit le réglage jour/nuit du téléphone.</p>
    </Section>
    <Section title="Application">
      {standalone ? (
        <p className="text-sm text-muted">Installée sur l’écran d’accueil. Fonctionne hors ligne.</p>
      ) : install ? (
        <button className="w-full h-11 rounded-xl bg-sport font-medium" onClick={() => install.prompt()}>
          Installer sur l’écran d’accueil
        </button>
      ) : (
        <p className="text-sm text-muted">Pour installer : menu ⋮ de Chrome → « Ajouter à l’écran d’accueil ».</p>
      )}
      <p className="text-xs text-muted">{CONFIG.appName} · version {__APP_VERSION__} · fuseau {CONFIG.timeZone}</p>
    </Section>
    </>
  );
}
