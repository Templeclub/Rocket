import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as A from '../../db/actions';
import { db, exportData, importData } from '../../db/db';
import { backupFileName, makeBackup, parseBackup } from '../../engine/backup';
import { CONFIG } from '../../engine/config';
import { isLocalDate } from '../../engine/dates';
import { builtinTemplates } from '../../engine/library';
import { SPORT_KEYS, SPORT_META, sportKey } from '../../engine/sports';
import type { AppSettings, Goal, Profile } from '../../engine/types';
import { formatDuration, hrZones, powerZones } from '../../engine/zones';
import { Field, inputCls, NumberInput } from '../components/Form';
import { IconPlus, IconStar } from '../components/Icons';
import { useToast } from '../components/Toast';
import { useNav, useSettings } from '../hooks';
import { useInstallPrompt } from '../install';
import { AvailabilitySection, ProgramSection } from './ProgramSettings';

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface border border-line p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function SettingsView() {
  const settings = useSettings();
  const save = (s: AppSettings) => A.saveSettings(s);
  const setProfile = (p: Partial<Profile>) => save({ ...settings, profile: { ...settings.profile, ...p } });

  return (
    <div className="space-y-3">
      <ProgramSection />
      <AvailabilitySection />
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
      <GoalSection />
      <Library />
      <DataSection />
      <AppSection />
    </div>
  );
}

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
              {SPORT_META[k].emoji} {SPORT_META[k].label}
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
    <Section title="Données">
      <p className="text-sm text-muted">
        Stockées sur ce téléphone uniquement{counts ? ` · ${counts.s} séances, ${counts.a} activités` : ''}. Exporte régulièrement.
      </p>
      <div className="flex gap-2">
        <button className="flex-1 h-11 rounded-xl bg-accent text-accent-ink font-medium" onClick={doExport}>
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
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  return (
    <Section title="Application">
      {standalone ? (
        <p className="text-sm text-muted">Installée sur l’écran d’accueil. Fonctionne hors ligne.</p>
      ) : install ? (
        <button className="w-full h-11 rounded-xl bg-accent text-accent-ink font-medium" onClick={() => install.prompt()}>
          Installer sur l’écran d’accueil
        </button>
      ) : (
        <p className="text-sm text-muted">Pour installer : menu ⋮ de Chrome → « Ajouter à l’écran d’accueil ».</p>
      )}
      <p className="text-xs text-muted">{CONFIG.appName} · phase 1 · fuseau {CONFIG.timeZone}</p>
    </Section>
  );
}
