import { useEffect, useState, type ReactNode } from 'react';
import { SPORT_KEYS, SPORT_META } from '../../engine/sports';
import type { SportKey } from '../../engine/types';
import { formatDuration, parseDuration } from '../../engine/zones';

export const inputCls = 'w-full h-11 rounded-lg bg-raised px-3 outline-none focus:ring-2 focus:ring-accent';

export function Field({ label, children, className = '', group = false }: { label: string; children: ReactNode; className?: string; group?: boolean }) {
  // Un groupe de boutons ne doit pas être dans un <label> : un tap sur le libellé activerait le premier bouton.
  if (group) {
    return (
      <div className={`block ${className}`} role="group" aria-label={label}>
        <span className="block text-xs text-muted mb-1">{label}</span>
        {children}
      </div>
    );
  }
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
  className = '',
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={`${inputCls} ${className}`}
      value={value ?? ''}
      placeholder={placeholder}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.');
        onChange(raw === '' ? undefined : Number(raw));
      }}
    />
  );
}

/** Saisie libre d'une durée : « 45 », « 1h30 », « 30s », « 1:30 ». */
export function DurationInput({
  seconds,
  onChange,
  placeholder = 'ex. 1h30, 45, 30s',
}: {
  seconds: number | undefined;
  onChange: (sec: number | undefined) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(seconds ? formatDuration(seconds) : '');
  useEffect(() => setText(seconds ? formatDuration(seconds) : ''), [seconds]);
  const commit = () => {
    const v = parseDuration(text);
    if (text.trim() === '') onChange(undefined);
    else if (v !== null) onChange(v);
    setText(v !== null ? formatDuration(v) : seconds ? formatDuration(seconds) : '');
  };
  return (
    <input
      className={inputCls}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-raised p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 h-9 rounded-md text-sm ${value === o.value ? 'bg-surface shadow font-medium' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SportPicker({ value, onChange }: { value: SportKey; onChange: (k: SportKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {SPORT_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`h-11 rounded-lg text-sm flex items-center justify-center gap-1 ${
            value === k ? 'ring-2 ring-accent bg-surface font-medium' : 'bg-raised'
          }`}
        >
          <span>{SPORT_META[k].emoji}</span>
          {SPORT_META[k].short}
        </button>
      ))}
    </div>
  );
}

export function RpeSelect({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <select className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}>
      <option value="">—</option>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}
