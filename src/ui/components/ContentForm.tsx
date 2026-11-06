import { fromSportKey, hasNoContent, sportKey } from '../../engine/sports';
import { newId } from '../../engine/library';
import type { AppSettings, Block, SessionContent } from '../../engine/types';
import { blocksDistanceM, blocksDurationSec, describeBlock, formatDuration, hrZones, watts } from '../../engine/zones';
import { DurationInput, Field, inputCls, NumberInput, RpeSelect, Segmented, SportPicker } from './Form';
import { IconDown, IconPlus, IconStar, IconTrash, IconUp } from './Icons';

const TYPES: Record<string, string[]> = {
  gravel: ['endurance', 'tempo', 'sweet spot', 'sortie longue', 'enchaînement', 'récupération'],
  run: ['footing', 'fractionné', 'côtes'],
  swim: ['technique', 'endurance', 'vitesse'],
  football: ['match', 'entraînement'],
  enduro: ['enduro'],
};

/** Lecture seule : ce que j'affiche sur le vélo ou au bord du bassin. */
export function ContentView({ c, settings }: { c: SessionContent; settings: AppSettings }) {
  const dist = blocksDistanceM(c.blocks);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Chip>{formatDuration(c.targetDurationMin * 60)}</Chip>
        {c.targetDistanceKm ? <Chip>{c.targetDistanceKm} km</Chip> : null}
        {c.targetElevationM ? <Chip>{c.targetElevationM} m D+</Chip> : null}
        {dist > 0 && c.sport === 'swim' ? <Chip>{dist} m</Chip> : null}
        {c.rpe ? <Chip>RPE {c.rpe}</Chip> : null}
        <Chip>{c.type}</Chip>
        <Chip>{c.environment === 'indoor' ? 'intérieur' : 'extérieur'}</Chip>
        {c.priority === 'key' ? (
          <Chip accent>
            <IconStar /> clé
          </Chip>
        ) : (
          <Chip>optionnelle</Chip>
        )}
      </div>
      {c.blocks.length > 0 && (
        <ol className="space-y-1.5">
          {c.blocks.map((b) => (
            <li key={b.id} className="rounded-lg bg-raised px-3 py-2">
              <div className="font-medium text-sm">{b.label}</div>
              <div className="text-sm text-muted">{describeBlock(b, settings.profile, settings.hrZoneBoundsPct)}</div>
            </li>
          ))}
        </ol>
      )}
      {c.notes && <p className="text-sm whitespace-pre-wrap">{c.notes}</p>}
    </div>
  );
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${accent ? 'bg-accent/15 text-accent' : 'bg-raised'}`}>
      {children}
    </span>
  );
}

export function ContentForm<T extends SessionContent>({
  value,
  onChange,
  settings,
}: {
  value: T;
  onChange: (v: T) => void;
  settings: AppSettings;
}) {
  const set = (patch: Partial<SessionContent>) => onChange({ ...value, ...patch });
  const key = sportKey(value.sport, value.environment);
  const noContent = hasNoContent(value.sport);
  const blocksSec = blocksDurationSec(value.blocks);
  const showDistance = value.sport === 'run' || key === 'gravel-out';

  return (
    <div className="space-y-3">
      <Field label="Titre">
        <input className={inputCls} value={value.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="Sport" group>
        <SportPicker value={key} onChange={(k) => set(fromSportKey(k))} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type">
          <input className={inputCls} list={`types-${value.sport}`} value={value.type} onChange={(e) => set({ type: e.target.value })} />
          <datalist id={`types-${value.sport}`}>
            {(TYPES[value.sport] ?? []).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Priorité" group>
          <Segmented
            value={value.priority}
            onChange={(priority) => set({ priority })}
            options={[
              { value: 'key', label: 'Clé' },
              { value: 'optional', label: 'Optionnelle' },
            ]}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Durée cible">
          <DurationInput seconds={value.targetDurationMin * 60} onChange={(sec) => set({ targetDurationMin: Math.round((sec ?? 0) / 60) })} />
        </Field>
        <Field label="Intensité perçue (RPE)">
          <RpeSelect value={value.rpe} onChange={(rpe) => set({ rpe })} />
        </Field>
      </div>
      {blocksSec > 0 && Math.round(blocksSec / 60) !== value.targetDurationMin && (
        <button type="button" onClick={() => set({ targetDurationMin: Math.round(blocksSec / 60) })} className="text-sm text-accent">
          Durée = somme des blocs ({formatDuration(blocksSec)})
        </button>
      )}
      {showDistance && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Distance (km)">
            <NumberInput value={value.targetDistanceKm} onChange={(targetDistanceKm) => set({ targetDistanceKm })} />
          </Field>
          <Field label="D+ (m)">
            <NumberInput value={value.targetElevationM} onChange={(targetElevationM) => set({ targetElevationM })} />
          </Field>
        </div>
      )}
      {!noContent && <BlocksEditor blocks={value.blocks} onChange={(blocks) => set({ blocks })} content={value} settings={settings} />}
      <Field label="Notes">
        <textarea className={`${inputCls} h-20 py-2`} value={value.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} />
      </Field>
    </div>
  );
}

function BlocksEditor({
  blocks,
  onChange,
  content,
  settings,
}: {
  blocks: Block[];
  onChange: (b: Block[]) => void;
  content: SessionContent;
  settings: AppSettings;
}) {
  const indoorBike = content.sport === 'gravel' && content.environment === 'indoor';
  const useHr = (content.sport === 'gravel' && content.environment === 'outdoor') || content.sport === 'run';
  const swim = content.sport === 'swim';
  const zones = hrZones(settings.profile.hrMax, settings.hrZoneBoundsPct);
  const ftp = settings.profile.ftp;

  const update = (i: number, patch: Partial<Block>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <div className="text-xs text-muted mb-1">Blocs</div>
      <div className="space-y-2">
        {blocks.map((b, i) => (
          <div key={b.id} className="rounded-xl border border-line p-2.5 space-y-2">
            <div className="flex gap-1.5">
              <input className={`${inputCls} flex-1`} value={b.label} onChange={(e) => update(i, { label: e.target.value })} aria-label="Nom du bloc" />
              <button type="button" onClick={() => move(i, -1)} className="w-10 rounded-lg bg-raised grid place-items-center" aria-label="Monter">
                <IconUp />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="w-10 rounded-lg bg-raised grid place-items-center" aria-label="Descendre">
                <IconDown />
              </button>
              <button
                type="button"
                onClick={() => onChange(blocks.filter((_, j) => j !== i))}
                className="w-10 rounded-lg bg-raised grid place-items-center text-danger"
                aria-label="Supprimer le bloc"
              >
                <IconTrash />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Field label="Répét.">
                <NumberInput value={b.repeat} min={1} onChange={(v) => update(i, { repeat: Math.max(1, Math.round(v ?? 1)) })} />
              </Field>
              {swim ? (
                <Field label="Distance (m)">
                  <NumberInput value={b.distanceM} step={25} onChange={(distanceM) => update(i, { distanceM })} />
                </Field>
              ) : (
                <Field label="Durée">
                  <DurationInput seconds={b.durationSec} onChange={(durationSec) => update(i, { durationSec })} placeholder="10, 30s" />
                </Field>
              )}
              <Field label="Récup">
                <DurationInput seconds={b.recoverySec} onChange={(recoverySec) => update(i, { recoverySec })} placeholder="—" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {indoorBike && (
                <>
                  <Field label="% FTP bas">
                    <NumberInput
                      value={b.target.ftpPct?.[0]}
                      onChange={(v) => update(i, { target: { ...b.target, ftpPct: v === undefined ? undefined : [v, b.target.ftpPct?.[1] ?? v] } })}
                    />
                  </Field>
                  <Field label="% FTP haut">
                    <NumberInput
                      value={b.target.ftpPct?.[1]}
                      onChange={(v) => update(i, { target: { ...b.target, ftpPct: v === undefined ? undefined : [b.target.ftpPct?.[0] ?? v, v] } })}
                    />
                  </Field>
                </>
              )}
              {useHr && (
                <Field label="Zone FC" className="col-span-2">
                  <select
                    className={inputCls}
                    value={b.target.hrZone ?? ''}
                    onChange={(e) => update(i, { target: { ...b.target, hrZone: e.target.value ? Number(e.target.value) : undefined } })}
                  >
                    <option value="">—</option>
                    {zones.map((z) => (
                      <option key={z.index} value={z.index}>
                        Z{z.index} · {z.low}–{z.high} bpm
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {swim && <div className="col-span-2" />}
              <Field label="RPE">
                <RpeSelect value={b.target.rpe} onChange={(rpe) => update(i, { target: { ...b.target, rpe } })} />
              </Field>
            </div>
            <input
              className={inputCls}
              placeholder={swim ? 'Consigne : nage, respiration, matériel…' : 'Consigne (cadence, allure, terrain…)'}
              value={b.target.text ?? ''}
              onChange={(e) => update(i, { target: { ...b.target, text: e.target.value || undefined } })}
            />
            {indoorBike && b.target.ftpPct && (
              <div className="text-xs text-muted">
                {watts(ftp, b.target.ftpPct[0])}–{watts(ftp, b.target.ftpPct[1])} W (FTP {ftp} W)
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...blocks, { id: newId(), label: 'Bloc', repeat: 1, durationSec: swim ? undefined : 600, distanceM: swim ? 100 : undefined, target: {} }])}
        className="mt-2 w-full h-11 rounded-xl border border-dashed border-line text-accent flex items-center justify-center gap-1.5"
      >
        <IconPlus /> Ajouter un bloc
      </button>
    </div>
  );
}
