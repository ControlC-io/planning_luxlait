import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { planningJson } from '@/lib/planningApi';
import type { ThemeTokens } from '@/data/themes';
import { PageShell } from '@/pages/admin/adminPages';

type ConstraintCategory = 'hard' | 'soft' | 'pref';

type ConstraintRow = {
  id: string;
  cat: ConstraintCategory;
  group: string;
  title: string;
  desc: string;
  metric: string | null;
  impact: string | null;
  weight: number | null;
  active: boolean;
  editable: boolean;
};

const CAT_META: Record<
  ConstraintCategory,
  { label: string; bg: string; color: string; border: string; desc: string }
> = {
  hard: {
    label: 'Dures',
    bg: '#FEF2F2',
    color: '#991B1B',
    border: '#FECACA',
    desc: 'Règles non négociables : légales, sécurité, qualifications.',
  },
  soft: {
    label: 'Souples',
    bg: '#FFFBEB',
    color: '#92400E',
    border: '#FCD34D',
    desc: 'Pondérées : le solveur cherche à les satisfaire au mieux.',
  },
  pref: {
    label: 'Préférences',
    bg: '#F0F7FF',
    color: '#1E40AF',
    border: '#DBEAFE',
    desc: 'Faiblement pondérées : utilisées pour départager des solutions équivalentes.',
  },
};

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: ReactNode;
  sub: string;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: 10,
        border: '1px solid #E5E7EB',
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#94A3B8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color,
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

type PageProps = { t: ThemeTokens };

export function PageContraintes({ t }: PageProps) {
  const [items, setItems] = useState<ConstraintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ConstraintCategory>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ConstraintRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await planningJson<ConstraintRow[]>('/luxlait_solver_constraints');
        if (!cancelled) {
          setItems(data);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Load failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () =>
      items.filter((c) => {
        if (filter !== 'all' && c.cat !== filter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!`${c.title} ${c.desc} ${c.group}`.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [items, filter, search],
  );

  const counts = useMemo(
    () => ({
      all: items.length,
      hard: items.filter((c) => c.cat === 'hard').length,
      soft: items.filter((c) => c.cat === 'soft').length,
      pref: items.filter((c) => c.cat === 'pref').length,
    }),
    [items],
  );

  const tabs: { id: 'all' | ConstraintCategory; label: string }[] = [
    { id: 'all', label: 'Toutes' },
    { id: 'hard', label: 'Dures' },
    { id: 'soft', label: 'Souples' },
    { id: 'pref', label: 'Préférences' },
  ];

  if (loadError) {
    return (
      <PageShell t={t} title="Contraintes du solveur" subtitle="Visualisation des règles">
        <div style={{ padding: 24, color: '#991B1B', fontSize: 14 }}>{loadError}</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      t={t}
      title="Contraintes du solveur"
      subtitle="Visualisez les règles utilisées pour générer le planning (lecture seule)"
    >
      {loading ? (
        <div style={{ padding: 24, color: '#64748B', fontSize: 13 }}>Chargement…</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <StatCard
              color="#991B1B"
              label="Contraintes dures"
              value={counts.hard}
              sub="Toujours appliquées"
            />
            <StatCard
              color="#92400E"
              label="Contraintes souples"
              value={counts.soft}
              sub="Pondérées 0 à 100"
            />
            <StatCard
              color="#1E40AF"
              label="Préférences"
              value={counts.pref}
              sub="Départage des solutions"
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: 3,
                backgroundColor: '#F1F5F9',
                borderRadius: 8,
              }}
            >
              {tabs.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setFilter(tb.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: filter === tb.id ? '#fff' : 'transparent',
                    boxShadow: filter === tb.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    fontSize: 11,
                    fontWeight: filter === tb.id ? 600 : 500,
                    color: filter === tb.id ? '#0F172A' : '#64748B',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                  }}
                >
                  {tb.label}{' '}
                  <span style={{ opacity: 0.6, marginLeft: 4 }}>{counts[tb.id]}</span>
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une contrainte…"
              style={{
                flex: 1,
                maxWidth: 320,
                padding: '7px 10px',
                borderRadius: 7,
                border: '1px solid #E5E7EB',
                fontSize: 12,
                outline: 'none',
                fontFamily: 'IBM Plex Sans, sans-serif',
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 360px',
              gap: 14,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visible.map((c) => {
                const m = CAT_META[c.cat];
                const isSel = selected?.id === c.id;
                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(c)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setSelected(c);
                      }
                    }}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 10,
                      border: isSel ? `1.5px solid ${t.primaryBtn}` : '1px solid #E5E7EB',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      opacity: c.active ? 1 : 0.55,
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          backgroundColor: m.bg,
                          color: m.color,
                          border: `1px solid ${m.border}`,
                          flexShrink: 0,
                          marginTop: 2,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {m.label}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 3,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                            {c.title}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              color: '#94A3B8',
                              backgroundColor: '#F1F5F9',
                              padding: '1px 6px',
                              borderRadius: 3,
                            }}
                          >
                            {c.group}
                          </span>
                          {!c.active && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: '#64748B',
                                backgroundColor: '#F1F5F9',
                                padding: '1px 6px',
                                borderRadius: 3,
                              }}
                            >
                              Inactive
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.4 }}>
                          {c.desc}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#1E293B',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {c.metric ?? '—'}
                        </span>
                        {c.cat !== 'hard' && c.weight != null && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#475569',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {c.weight} / 100
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {visible.length === 0 && (
                <div
                  style={{
                    padding: 30,
                    textAlign: 'center',
                    color: '#94A3B8',
                    fontSize: 13,
                    backgroundColor: '#fff',
                    borderRadius: 10,
                    border: '1px solid #E5E7EB',
                  }}
                >
                  Aucune contrainte ne correspond.
                </div>
              )}
            </div>

            <div
              style={{
                position: 'sticky',
                top: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 10,
                  border: '1px solid #E5E7EB',
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#94A3B8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 10,
                  }}
                >
                  Comment le solveur les utilise
                </div>
                {(Object.keys(CAT_META) as ConstraintCategory[]).map((k) => {
                  const meta = CAT_META[k];
                  return (
                    <div key={k} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 4,
                          backgroundColor: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                          flexShrink: 0,
                          height: 'fit-content',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {meta.label}
                      </span>
                      <span style={{ fontSize: 11, color: '#475569', lineHeight: 1.45 }}>
                        {meta.desc}
                      </span>
                    </div>
                  );
                })}
              </div>

              {selected ? (
                <div
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 10,
                    border: '1px solid #E5E7EB',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 6,
                    }}
                  >
                    Détail
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                    {selected.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5, marginBottom: 10 }}>
                    {selected.desc}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: 4,
                    }}
                  >
                    Impact
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
                    {selected.impact ?? '—'}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#FAFBFC',
                    borderRadius: 10,
                    border: '1px dashed #CBD5E1',
                    padding: '18px 16px',
                    textAlign: 'center',
                    fontSize: 11,
                    color: '#94A3B8',
                  }}
                >
                  Cliquez sur une contrainte pour en voir le détail
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '10px 12px',
                  backgroundColor: '#F0F7FF',
                  borderRadius: 8,
                  border: '1px solid #DBEAFE',
                }}
              >
                <span style={{ fontSize: 14 }} role="img" aria-label="hint">
                  💡
                </span>
                <span style={{ fontSize: 11, color: '#1E40AF', lineHeight: 1.45 }}>
                  Les contraintes <strong>dures</strong> sont vérifiées en premier. Si elles ne peuvent
                  pas être satisfaites, le solveur signale une infaisabilité. Les{' '}
                  <strong>souples</strong> sont optimisées par poids.
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
