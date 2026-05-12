import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { THEMES, type ThemeTokens } from '@/data/themes';
import { useTweaks } from '@/hooks/useTweaks';
import { EmpCell } from '@/features/planning/cells/EmpCell';
import { MachineCell } from '@/features/planning/cells/MachineCell';
import {
  Ico,
  ImportanceDot,
  ShiftChip,
} from '@/features/planning/components/atoms';
import {
  EditModal,
  MachineCellDetail,
  SolverModal,
} from '@/features/planning/modals/planningModals';
import { usePlanningData, usePlanningFull } from '@/context/PlanningDataContext';
import {
  PageConges,
  PageCompetences,
  PageEmployes,
  PageFermetures,
  PageMachines,
} from '@/pages/admin/adminPages';
import { PageContraintes } from '@/pages/admin/contraintesPage';
import { planningStatusCellStyle, planningStatusShort } from '@/lib/planningStatusShort';
import { planningFetch, planningJson } from '@/lib/planningApi';
import {
  buildClosedMapFromApi,
  type ApiWeeklyMachineClosedShiftRow,
} from '@/lib/machineWeeklyClosures';
import { planningMonthRange } from '@/lib/mapApiToPlanningBundle';

const NAV: {
  id: string;
  label: string;
  icon: () => ReactNode;
}[] = [
  {
    id: 'planning',
    label: 'Planning',
    icon: () => (
      <Ico
        d={
          <>
            <rect x="1" y="1" width="14" height="14" rx="2" />
            <line x1="1" y1="5" x2="15" y2="5" />
            <line x1="5" y1="1" x2="5" y2="15" />
            <line x1="9" y1="5" x2="9" y2="15" />
          </>
        }
      />
    ),
  },
  {
    id: 'employes',
    label: 'Employés',
    icon: () => (
      <Ico
        d={
          <>
            <circle cx="6" cy="5" r="2.5" />
            <path d="M1 14c0-3 2-4.5 5-4.5s5 1.5 5 4.5" />
            <circle cx="12" cy="5" r="2" />
            <path d="M14.5 14c0-2.5-1.2-3.8-3-4.2" />
          </>
        }
      />
    ),
  },
  {
    id: 'machines',
    label: 'Machines',
    icon: () => (
      <Ico
        d={
          <>
            <circle cx="8" cy="8" r="2.5" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
          </>
        }
      />
    ),
  },
  {
    id: 'competences',
    label: 'Compétences',
    icon: () => (
      <Ico
        d={
          <>
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </>
        }
      />
    ),
  },
  {
    id: 'conges',
    label: 'Congés',
    icon: () => (
      <Ico
        d={
          <>
            <rect x="1" y="3" width="14" height="12" rx="2" />
            <line x1="1" y1="7" x2="15" y2="7" />
            <line x1="5" y1="1" x2="5" y2="5" />
            <line x1="11" y1="1" x2="11" y2="5" />
          </>
        }
      />
    ),
  },
  {
    id: 'fermetures',
    label: 'Fermetures',
    icon: () => (
      <Ico
        d={
          <>
            <rect x="3" y="7" width="10" height="8" rx="2" />
            <path d="M5 7V5a3 3 0 0 1 6 0v2" />
          </>
        }
      />
    ),
  },
  {
    id: 'contraintes',
    label: 'Contraintes',
    icon: () => (
      <Ico
        d={<path d="M8 1l2 4 5 .5-3.5 3.5L12.5 14 8 11.5 3.5 14l1-5L1 5.5 6 5z" />}
      />
    ),
  },
];

const NAV_BOTTOM: typeof NAV = [
  {
    id: 'creneaux',
    label: 'Créneaux',
    icon: () => (
      <Ico
        d={
          <>
            <circle cx="8" cy="8" r="7" />
            <polyline points="8 4 8 8 11 10" />
          </>
        }
      />
    ),
  },
  {
    id: 'statuts',
    label: 'Statuts',
    icon: () => (
      <Ico
        d={
          <>
            <path d="M1 1h6l7 7a2 2 0 0 1 0 2.83l-3.17 3.17a2 2 0 0 1-2.83 0L1 7V1z" />
            <circle cx="4.5" cy="4.5" r="1" />
          </>
        }
      />
    ),
  },
];

function Sidebar({
  t,
  activePage,
  setPage,
}: {
  t: ThemeTokens;
  activePage: string;
  setPage: (id: string) => void;
}) {
  const item = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 7,
    cursor: 'pointer',
    marginBottom: 2,
    color: active ? t.sidebarActive : t.sidebarText,
    backgroundColor: active ? t.sidebarActiveBg : 'transparent',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    transition: 'all 0.12s',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
  });

  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        backgroundColor: t.sidebarBg,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}
    >
      <div
        style={{
          padding: '18px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: '#0069B4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          LX
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.sidebarActive }}>
            Luxlait
          </div>
          <div style={{ fontSize: 10, color: t.sidebarText, marginTop: 1 }}>
            Planification
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: t.sidebarText,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '12px 10px 4px',
          }}
        >
          Production
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            style={item(activePage === n.id)}
            onClick={() => setPage(n.id)}
            onMouseEnter={(e) => {
              if (activePage !== n.id)
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              if (activePage !== n.id)
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <n.icon />
            {n.label}
          </button>
        ))}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: t.sidebarText,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '12px 10px 4px',
          }}
        >
          Configuration
        </div>
        {NAV_BOTTOM.map((n) => (
          <button
            key={n.id}
            type="button"
            style={item(activePage === n.id)}
            onClick={() => setPage(n.id)}
            onMouseEnter={(e) => {
              if (activePage !== n.id)
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              if (activePage !== n.id)
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <n.icon />
            {n.label}
          </button>
        ))}
      </div>
      <div
        style={{
          padding: '8px 8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 7,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              backgroundColor: '#0069B4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            MK
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.sidebarActive }}>
              M. Kremer
            </div>
            <div style={{ fontSize: 10, color: t.sidebarText }}>Manager</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toolbar({
  t,
  vue,
  setVue,
  onSolver,
  machineCoverageMode,
  setMachineCoverageMode,
}: {
  t: ThemeTokens;
  vue: string;
  setVue: (v: 'employe' | 'machine') => void;
  onSolver: () => void;
  machineCoverageMode: boolean;
  setMachineCoverageMode: (v: boolean) => void;
}) {
  const {
    MONTH_LABEL,
    SHIFTS,
    planningYear,
    planningMonthOneBased,
    setPlanningMonth,
    refetchPlanning,
  } = usePlanningFull();
  const [clearingMonth, setClearingMonth] = useState(false);
  const btnTab = (active: boolean) => ({
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: active ? t.primaryBtn : '#fff',
    color: active ? t.primaryBtnText : '#64748B',
    transition: 'all 0.12s',
  });
  const iconBtn = {
    padding: '6px 10px',
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    backgroundColor: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#374151',
    fontWeight: 500,
  };

  return (
    <div
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 20px',
        borderBottom: `1px solid ${t.border}`,
        backgroundColor: t.headerBg,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          style={{ ...iconBtn, padding: '6px 8px' }}
          onClick={() => {
            if (planningMonthOneBased <= 1) {
              setPlanningMonth(planningYear - 1, 12);
            } else {
              setPlanningMonth(planningYear, planningMonthOneBased - 1);
            }
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <polyline points="10 12 5 8 10 4" />
          </svg>
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1E293B',
            minWidth: 88,
            textAlign: 'center',
          }}
        >
          {MONTH_LABEL}
        </span>
        <button
          type="button"
          style={{ ...iconBtn, padding: '6px 8px' }}
          onClick={() => {
            if (planningMonthOneBased >= 12) {
              setPlanningMonth(planningYear + 1, 1);
            } else {
              setPlanningMonth(planningYear, planningMonthOneBased + 1);
            }
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <polyline points="6 4 11 8 6 12" />
          </svg>
        </button>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {SHIFTS.map((sh) => (
          <span
            key={sh.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: '#64748B',
            }}
          >
            <ShiftChip shiftId={sh.id} />
            <span>{sh.label}</span>
          </span>
        ))}
      </div>
      <div style={{ width: 1, height: 24, backgroundColor: t.border }} />
      <div
        style={{
          display: 'flex',
          borderRadius: 8,
          overflow: 'hidden',
          border: `1px solid ${t.border}`,
        }}
      >
        <button type="button" style={btnTab(vue === 'employe')} onClick={() => setVue('employe')}>
          Par employé
        </button>
        <button type="button" style={btnTab(vue === 'machine')} onClick={() => setVue('machine')}>
          Par machine
        </button>
      </div>
      {vue === 'machine' && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            cursor: 'pointer',
            backgroundColor: machineCoverageMode ? `${t.primaryBtn}15` : t.cardBg,
            fontSize: 12,
            fontWeight: 500,
            color: machineCoverageMode ? t.primaryBtn : '#64748B',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={machineCoverageMode}
            onChange={(e) => setMachineCoverageMode(e.target.checked)}
            style={{ margin: 0, accentColor: t.primaryBtn }}
          />
          Vue couverture
        </label>
      )}
      <button
        type="button"
        disabled={clearingMonth}
        onClick={async () => {
          const { fromDate, toDate } = planningMonthRange(
            planningYear,
            planningMonthOneBased,
          );
          const ok = window.confirm(
            `Supprimer toutes les affectations travail (machines et créneaux) du ${fromDate} au ${toDate} ? Les congés et statuts jour restent inchangés.`,
          );
          if (!ok) return;
          setClearingMonth(true);
          try {
            const res = await planningFetch('/luxlait_clear_work_assignments_range', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fromDate, toDate }),
            });
            if (!res.ok) {
              const msg = await res.text();
              window.alert(msg || `Erreur ${res.status}`);
              return;
            }
            await refetchPlanning();
          } catch (e) {
            window.alert(e instanceof Error ? e.message : String(e));
          } finally {
            setClearingMonth(false);
          }
        }}
        style={{
          padding: '7px 14px',
          borderRadius: 8,
          border: `1px solid ${t.border}`,
          cursor: clearingMonth ? 'wait' : 'pointer',
          backgroundColor: '#fff',
          color: '#64748B',
          fontSize: 13,
          fontWeight: 500,
          opacity: clearingMonth ? 0.7 : 1,
        }}
        title="Retire uniquement les affectations machine pour ce mois. Ne modifie pas les congés ni les absences."
      >
        {clearingMonth ? 'Vidage…' : 'Vider affectations'}
      </button>
      <button
        type="button"
        onClick={onSolver}
        style={{
          padding: '7px 16px',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          backgroundColor: t.primaryBtn,
          color: t.primaryBtnText,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 15 }}>✦</span> Générer un planning
      </button>
    </div>
  );
}

function FilterBar({
  t,
  filter,
  setFilter,
  total,
  visible,
}: {
  t: ThemeTokens;
  filter: { search: string; group: string };
  setFilter: React.Dispatch<React.SetStateAction<{ search: string; group: string }>>;
  total: number;
  visible: number;
}) {
  const { GROUPS } = usePlanningData();
  const chipBase = (active: boolean, color: string) => ({
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    border: `1.5px solid ${active ? color : '#E5E7EB'}`,
    backgroundColor: active ? color + '22' : '#fff',
    color: active ? color : '#64748B',
    transition: 'all 0.1s',
  });

  return (
    <div
      style={{
        padding: '8px 20px',
        borderBottom: `1px solid ${t.border}`,
        backgroundColor: t.headerBg,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ position: 'relative', flex: '0 0 220px' }}>
        <span
          style={{
            position: 'absolute',
            left: 9,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 13,
            color: '#CBD5E1',
            pointerEvents: 'none',
          }}
        >
          ⌕
        </span>
        <input
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          placeholder="Rechercher un employé…"
          style={{
            width: '100%',
            padding: '6px 10px 6px 28px',
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            fontSize: 12,
            outline: 'none',
            fontFamily: 'IBM Plex Sans, sans-serif',
            color: '#1E293B',
          }}
        />
        {filter.search && (
          <button
            type="button"
            onClick={() => setFilter((f) => ({ ...f, search: '' }))}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          style={chipBase(!filter.group, '#64748B')}
          onClick={() => setFilter((f) => ({ ...f, group: '' }))}
        >
          Tous
        </button>
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            style={chipBase(filter.group === g.id, g.textColor)}
            onClick={() =>
              setFilter((f) => ({ ...f, group: f.group === g.id ? '' : g.id }))
            }
          >
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: g.textColor,
                marginRight: 4,
                verticalAlign: 'middle',
                opacity: 0.7,
              }}
            />
            {g.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#94A3B8', flexShrink: 0, marginLeft: 8 }}>
        <span
          style={{
            fontWeight: 600,
            color: visible < total ? t.primaryBtn : '#94A3B8',
          }}
        >
          {visible}
        </span>
        /{total} emp.
      </div>
    </div>
  );
}

function DayHeader({
  t,
  compact,
  nameW,
  cellW,
}: {
  t: ThemeTokens;
  compact: boolean;
  nameW: number;
  cellW: number;
}) {
  const { DAYS, dowLabel, isWeekend, TODAY } = usePlanningData();
  return (
    <div
      style={{
        display: 'flex',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: t.headerBg,
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      <div
        style={{
          width: nameW,
          minWidth: nameW,
          flexShrink: 0,
          padding: '8px 12px',
          fontSize: 11,
          fontWeight: 700,
          color: '#94A3B8',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          borderRight: `1px solid ${t.border}`,
          position: 'sticky',
          left: 0,
          backgroundColor: t.headerBg,
          zIndex: 11,
        }}
      >
        Employé
      </div>
      {Array.from({ length: DAYS }, (_, i) => i + 1).map((day) => {
        const wknd = isWeekend(day);
        const isT = day === TODAY;
        return (
          <div
            key={day}
            style={{
              width: cellW,
              minWidth: cellW,
              flexShrink: 0,
              padding: compact ? '4px 2px' : '6px 4px',
              textAlign: 'center',
              borderRight: `1px solid ${t.border}`,
              backgroundColor: isT ? '#FFFBEB' : wknd ? t.weekendBg : t.headerBg,
              position: 'relative',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: isT ? 700 : 500,
                color: isT ? '#92400E' : wknd ? '#94A3B8' : '#64748B',
              }}
            >
              {dowLabel(day)}
            </div>
            <div
              style={{
                fontSize: compact ? 12 : 13,
                fontWeight: isT ? 800 : 600,
                color: isT ? '#92400E' : wknd ? '#94A3B8' : '#1E293B',
                lineHeight: 1.2,
              }}
            >
              {day}
            </div>
            {isT && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: '#F59E0B',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function VirtualEmpGrid({
  t,
  compact,
  onCellClick,
  filter,
}: {
  t: ThemeTokens;
  compact: boolean;
  onCellClick?: (empId: string, day: number) => void;
  filter: { search: string; group: string };
}) {
  const { EMPLOYEES, DAYS } = usePlanningData();

  const cellH = compact ? 38 : 48;
  const cellW = compact ? 58 : 68;
  const nameW = compact ? 148 : 164;
  const OVERSCAN = 6;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerH, setContainerH] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setScrollTop(el.scrollTop);
      setContainerH(el.clientHeight);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  const filtered = useMemo(() => {
    const search = filter.search.toLowerCase();
    return EMPLOYEES.filter((emp) => {
      if (search && !`${emp.prenom} ${emp.nom}`.toLowerCase().includes(search))
        return false;
      if (filter.group && emp.group !== filter.group) return false;
      return true;
    });
  }, [filter, EMPLOYEES]);

  const startIdx = Math.max(0, Math.floor(scrollTop / cellH) - OVERSCAN);
  const endIdx = Math.min(
    filtered.length,
    Math.ceil((scrollTop + containerH) / cellH) + OVERSCAN,
  );
  const topPad = startIdx * cellH;
  const botPad = (filtered.length - endIdx) * cellH;

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      <div style={{ minWidth: nameW + cellW * DAYS }}>
        <DayHeader t={t} compact={compact} nameW={nameW} cellW={cellW} />

        <div style={{ paddingTop: topPad, paddingBottom: botPad }}>
          {filtered.slice(startIdx, endIdx).map((emp, localIdx) => {
            const ei = startIdx + localIdx;
            return (
              <div
                key={emp.id}
                style={{
                  display: 'flex',
                  borderBottom: `1px solid ${t.border}`,
                  backgroundColor: ei % 2 === 0 ? t.cardBg : t.bodyBg + 'aa',
                }}
              >
                <div
                  style={{
                    width: nameW,
                    minWidth: nameW,
                    flexShrink: 0,
                    height: cellH,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 10px 0 0',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    backgroundColor: ei % 2 === 0 ? t.cardBg : t.bodyBg + 'cc',
                    borderRight: `1px solid ${t.border}`,
                  }}
                >
                  <div
                    style={{
                      width: 3,
                      height: '100%',
                      flexShrink: 0,
                      backgroundColor: emp.groupText,
                      opacity: 0.5,
                    }}
                  />
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      flexShrink: 0,
                      backgroundColor: emp.groupColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: emp.groupText,
                    }}
                  >
                    {emp.prenom[0]}
                    {emp.nom[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: compact ? 11 : 12,
                        fontWeight: 600,
                        color: '#1E293B',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: nameW - 72,
                      }}
                    >
                      {emp.prenom} {emp.nom}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: emp.groupText,
                        fontWeight: 600,
                        marginTop: 1,
                      }}
                    >
                      {emp.groupLabel}
                      {emp.backup ? ' · BACKUP' : ''}
                    </div>
                  </div>
                </div>

                {Array.from({ length: DAYS }, (_, i) => i + 1).map((day) => (
                  <div
                    key={day}
                    style={{
                      width: cellW,
                      minWidth: cellW,
                      height: cellH,
                      flexShrink: 0,
                      padding: 2,
                      borderRight: `1px solid ${t.border}`,
                    }}
                  >
                    <EmpCell
                      empId={emp.id}
                      day={day}
                      compact={compact}
                      onClick={onCellClick}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: '#94A3B8',
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Aucun employé trouvé</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Modifiez les filtres pour élargir la recherche
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MachineGroupHeader({
  label,
  t,
  nameW,
}: {
  label: string;
  t: ThemeTokens;
  nameW: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: t.bodyBg,
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      <div
        style={{
          width: nameW,
          minWidth: nameW,
          flexShrink: 0,
          padding: '4px 12px',
          fontSize: 10,
          fontWeight: 700,
          color: '#94A3B8',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          position: 'sticky',
          left: 0,
          backgroundColor: t.bodyBg,
          borderRight: `1px solid ${t.border}`,
          zIndex: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function MachineGrid({
  t,
  compact,
  onCellClick,
  machineCoverageMode,
}: {
  t: ThemeTokens;
  compact: boolean;
  onCellClick?: (machineId: string, day: number) => void;
  machineCoverageMode: boolean;
}) {
  const { MACHINES, DAYS, YEAR } = usePlanningData();
  const [closedByWeek, setClosedByWeek] = useState(() => new Map<number, Set<string>>());

  useEffect(() => {
    let cancelled = false;
    planningJson<ApiWeeklyMachineClosedShiftRow[]>(
      `/luxlait_weekly_machine_closed_shifts?year=${YEAR}`,
    )
      .then((rows) => {
        if (!cancelled) setClosedByWeek(buildClosedMapFromApi(rows));
      })
      .catch(() => {
        if (!cancelled) setClosedByWeek(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [YEAR]);

  const cellW = compact ? 58 : 68;
  const cellH = compact ? 60 : 74;
  const nameW = compact ? 148 : 164;
  const groups = [...new Set(MACHINES.map((m) => m.group))];

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ minWidth: nameW + cellW * DAYS }}>
        <DayHeader t={t} compact={compact} nameW={nameW} cellW={cellW} />
        {groups.map((group) => (
          <Fragment key={group}>
            <MachineGroupHeader label={group} t={t} nameW={nameW} />
            {MACHINES.filter((m) => m.group === group).map((machine, mi) => (
              <div
                key={machine.id}
                style={{
                  display: 'flex',
                  borderBottom: `1px solid ${t.border}`,
                  backgroundColor: mi % 2 === 0 ? t.cardBg : t.bodyBg + 'aa',
                }}
              >
                <div
                  style={{
                    width: nameW,
                    minWidth: nameW,
                    flexShrink: 0,
                    height: cellH,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 10px 0 12px',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    backgroundColor: mi % 2 === 0 ? t.cardBg : t.bodyBg + 'cc',
                    borderRight: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#64748B',
                          backgroundColor: '#F1F5F9',
                          padding: '1px 5px',
                          borderRadius: 4,
                        }}
                      >
                        {machine.short}
                      </span>
                      <ImportanceDot importance={machine.importance} />
                    </div>
                    <div
                      style={{
                        fontSize: compact ? 10 : 11,
                        fontWeight: 600,
                        color: '#1E293B',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {machine.name}
                    </div>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>
                      max {machine.maxEmp} op.
                    </div>
                  </div>
                </div>
                {Array.from({ length: DAYS }, (_, i) => i + 1).map((day) => (
                  <div
                    key={day}
                    style={{
                      width: cellW,
                      minWidth: cellW,
                      height: cellH,
                      flexShrink: 0,
                      padding: 2,
                      borderRight: `1px solid ${t.border}`,
                    }}
                  >
                    <MachineCell
                      machineId={machine.id}
                      day={day}
                      compact={compact}
                      showNames={!machineCoverageMode}
                      closedByWeek={closedByWeek}
                      onClick={() => onCellClick?.(machine.id, day)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function PlaceholderPage() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        color: '#CBD5E1',
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
    >
      <div style={{ fontSize: 32 }}>🚧</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#94A3B8' }}>
        Page en construction
      </div>
    </div>
  );
}

export default function LuxlaitApp() {
  const PLANNING_DATA = usePlanningData();
  const [tweaks, setTweak] = useTweaks();
  const t = THEMES[tweaks.theme] || THEMES.industriel;
  const compact = tweaks.density === 'compact';

  const [page, setPage] = useState('planning');
  const [vue, setVue] = useState<'employe' | 'machine'>(tweaks.vue || 'employe');
  const [editCell, setEditCell] = useState<{ empId: string; day: number } | null>(
    null,
  );
  const [machineCell, setMachineCell] = useState<{
    machineId: string;
    day: number;
  } | null>(null);
  const [machineCoverageMode, setMachineCoverageMode] = useState(false);
  const [showSolver, setShowSolver] = useState(false);
  const [filter, setFilter] = useState({ search: '', group: '' });

  useEffect(() => {
    setVue(tweaks.vue || 'employe');
  }, [tweaks.vue]);

  useEffect(() => {
    document.documentElement.style.setProperty('--weekend-bg', t.weekendBg);
    document.documentElement.style.setProperty('--body-bg', t.bodyBg);
    document.documentElement.style.setProperty('--card-bg', t.cardBg);
  }, [t]);

  const visibleCount = useMemo(() => {
    const search = filter.search.toLowerCase();
    return PLANNING_DATA.EMPLOYEES.filter((emp) => {
      if (search && !`${emp.prenom} ${emp.nom}`.toLowerCase().includes(search))
        return false;
      if (filter.group && emp.group !== filter.group) return false;
      return true;
    }).length;
  }, [filter]);

  const implementedPages = [
    'planning',
    'employes',
    'machines',
    'competences',
    'conges',
    'fermetures',
    'contraintes',
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'IBM Plex Sans, sans-serif',
        backgroundColor: t.bodyBg,
      }}
    >
      <Sidebar t={t} activePage={page} setPage={setPage} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {page === 'planning' && (
          <>
            <Toolbar
              t={t}
              vue={vue}
              setVue={(v) => {
                setVue(v);
                setTweak('vue', v);
              }}
              onSolver={() => setShowSolver(true)}
              machineCoverageMode={machineCoverageMode}
              setMachineCoverageMode={setMachineCoverageMode}
            />

            {vue === 'employe' && (
              <FilterBar
                t={t}
                filter={filter}
                setFilter={setFilter}
                total={PLANNING_DATA.EMPLOYEES.length}
                visible={visibleCount}
              />
            )}

            {vue === 'employe' ? (
              <VirtualEmpGrid
                t={t}
                compact={compact}
                onCellClick={(empId, day) => setEditCell({ empId, day })}
                filter={filter}
              />
            ) : (
              <MachineGrid
                t={t}
                compact={compact}
                machineCoverageMode={machineCoverageMode}
                onCellClick={(machineId, day) => setMachineCell({ machineId, day })}
              />
            )}

            <div
              style={{
                minHeight: 36,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                rowGap: 4,
                gap: 16,
                padding: '0 20px',
                borderTop: `1px solid ${t.border}`,
                backgroundColor: t.headerBg,
                fontSize: 11,
                color: '#64748B',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color: '#94A3B8',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontSize: 10,
                }}
              >
                Légende :
              </span>
              {PLANNING_DATA.STATUSES.slice(0, 4).map((st) => {
                const cell = planningStatusCellStyle(st);
                return (
                  <span
                    key={st.id}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: 3,
                        backgroundColor: cell.bg,
                        color: cell.color,
                        border: cell.border,
                        boxSizing: 'border-box',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {planningStatusShort(st)}
                    </span>
                    <span>{st.label}</span>
                  </span>
                );
              })}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12,
                  paddingLeft: 12,
                  marginLeft: 4,
                  borderLeft: `1px solid ${t.border}`,
                }}
              >
                {vue === 'employe' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 14,
                        height: 11,
                        borderRadius: 2,
                        border: '1px solid #7C3AED',
                        boxSizing: 'border-box',
                        flexShrink: 0,
                        backgroundColor: '#FAF5FF',
                      }}
                    />
                    <span>Training</span>
                  </span>
                )}
                {vue === 'machine' && !machineCoverageMode && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1,
                        padding: '1px 4px',
                        borderRadius: 2,
                        backgroundColor: '#DBEAFE',
                        color: '#1E40AF',
                        borderBottom: '1px solid #7C3AED',
                        boxSizing: 'border-box',
                      }}
                    >
                      AB
                    </span>
                    <span>Training</span>
                  </span>
                )}
              </span>
              <span style={{ marginLeft: 'auto', color: '#94A3B8' }}>
                {PLANNING_DATA.EMPLOYEES.length} employés · Thème :{' '}
                <strong style={{ color: '#64748B' }}>{t.label}</strong>
              </span>
            </div>
          </>
        )}

        {page === 'employes' && <PageEmployes t={t} />}
        {page === 'machines' && <PageMachines t={t} />}
        {page === 'competences' && <PageCompetences t={t} />}
        {page === 'conges' && <PageConges t={t} />}
        {page === 'fermetures' && <PageFermetures t={t} />}
        {page === 'contraintes' && <PageContraintes t={t} />}

        {!implementedPages.includes(page) && <PlaceholderPage />}
      </div>

      {machineCell && (
        <MachineCellDetail
          machineId={machineCell.machineId}
          day={machineCell.day}
          onClose={() => setMachineCell(null)}
          theme={t}
        />
      )}
      {editCell && (
        <EditModal
          key={`${editCell.empId}-${editCell.day}`}
          empId={editCell.empId}
          day={editCell.day}
          onClose={() => setEditCell(null)}
          theme={t}
        />
      )}
      {showSolver && <SolverModal onClose={() => setShowSolver(false)} theme={t} />}
    </div>
  );
}
