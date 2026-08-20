import { LAYERS, REGIONS, SIGNAL_META, Signal } from '../lib/types';

export function SignalBadge({ signal }: { signal: Signal }) {
  const m = SIGNAL_META[signal];
  return (
    <span className={`badge ${signal}`}>
      {m.icon} {m.label}
    </span>
  );
}

export function LayerBadge({ layer }: { layer: string }) {
  const l = LAYERS.find((x) => x.id === layer);
  return <span className="badge gray">第{l?.no ?? '?'}层 · {l?.short ?? layer}</span>;
}

export function RegionBadge({ region }: { region: string }) {
  const r = REGIONS.find((x) => x.id === region);
  return <span className="badge blue">{r?.name ?? region}</span>;
}

export function TypeBadge({ type }: { type: 'leading' | 'coincident' | 'lagging' }) {
  const map = { leading: '领先', coincident: '同步', lagging: '滞后' } as const;
  const color = type === 'leading' ? 'up' : type === 'coincident' ? 'flat' : 'down';
  return <span className={`badge ${color}`}>{map[type]}</span>;
}
