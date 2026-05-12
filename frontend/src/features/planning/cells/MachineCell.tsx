import { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlanningData } from '@/context/PlanningDataContext';
import {
  isWeeklyMachineShiftClosed,
} from '@/lib/machineWeeklyClosures';
import {
  segmentIsTraining,
  workAssignmentSegments,
} from '@/lib/workAssignmentSegments';

const EMPTY_WEEK_CLOSED = new Map<number, Set<string>>();

type EmployeeRow = ReturnType<typeof usePlanningData>['EMPLOYEES'][number];

function placeMachineCellTip(clientX: number, clientY: number) {
  const pad = 12;
  const maxW = 280;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const left = Math.min(Math.max(pad, clientX + 14), vw - maxW - pad);
  const top = Math.max(pad, clientY + 12);
  return { left, top };
}

function EmpInitialsMachineRow({
  emp,
  training,
}: {
  emp: EmployeeRow;
  training: boolean;
}) {
  const [tip, setTip] = useState<{ left: number; top: number; text: string } | null>(
    null,
  );
  const fullName = `${emp.prenom ?? ''} ${emp.nom ?? ''}`.trim();
  const hoverText = training ? `${fullName} · Formation` : fullName;

  const tipPortal =
    tip &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        role="tooltip"
        style={{
          position: 'fixed',
          left: tip.left,
          top: tip.top,
          zIndex: 100050,
          padding: '7px 11px',
          borderRadius: 8,
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          fontSize: 12,
          fontWeight: 500,
          boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
          pointerEvents: 'none',
          maxWidth: 280,
          lineHeight: 1.35,
        }}
      >
        {tip.text}
      </div>,
      document.body,
    );

  return (
    <>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          cursor: 'help',
          fontSize: 7,
          fontWeight: 700,
          lineHeight: 1,
          padding: '1px 2px',
          borderRadius: 2,
          backgroundColor: emp.groupColor,
          color: emp.groupText,
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          borderBottom: training ? '1px solid #7C3AED' : undefined,
        }}
        onMouseEnter={(ev) => {
          setTip({ text: hoverText, ...placeMachineCellTip(ev.clientX, ev.clientY) });
        }}
        onMouseMove={(ev) => {
          setTip((prev) =>
            prev ? { text: prev.text, ...placeMachineCellTip(ev.clientX, ev.clientY) } : null,
          );
        }}
        onMouseLeave={() => setTip(null)}
      >
        <span>
          {emp.prenom[0]}
          {emp.nom[0]}
        </span>
        {training ? (
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: '#7C3AED',
              flexShrink: 0,
              boxShadow: '0 0 0 1px rgba(255,255,255,0.95)',
            }}
          />
        ) : null}
      </span>
      {tipPortal}
    </>
  );
}

export function MachineCell({
  machineId,
  day,
  compact,
  onClick,
  showNames = false,
  closedByWeek,
}: {
  machineId: string;
  day: number;
  compact: boolean;
  onClick?: () => void;
  showNames?: boolean;
  closedByWeek?: Map<number, Set<string>>;
}) {
  const { assignments, SHIFTS, MACHINES, EMPLOYEES, isWeekend, TODAY, YEAR, MONTH_IDX } =
    usePlanningData();
  const closedMap = closedByWeek ?? EMPTY_WEEK_CLOSED;
  const wknd = isWeekend(day);
  const isT = day === TODAY;

  if (wknd)
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--weekend-bg)',
          borderRadius: 2,
        }}
      />
    );

  type Slot = { emp: (typeof EMPLOYEES)[0]; training: boolean };
  const byShift: Record<string, Slot[]> = {};
  SHIFTS.forEach((sh) => {
    byShift[sh.id] = [];
  });
  EMPLOYEES.forEach((emp) => {
    const a = assignments[`${emp.id}-${day}`];
    if (a?.type !== 'work') return;
    workAssignmentSegments(a).forEach((s) => {
      if (s.machine !== machineId) return;
      const bucket = byShift[s.shift];
      if (bucket)
        bucket.push({ emp, training: segmentIsTraining(s, emp) });
    });
  });

  const machine = MACHINES.find((m) => m.id === machineId);
  const maxEmp = machine?.maxEmp || 2;

  if (showNames) {
    return (
      <div
        onClick={onClick}
        style={{
          width: '100%',
          height: '100%',
          padding: '2px',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          backgroundColor: 'var(--card-bg)',
          outline: isT ? '2px solid #F59E0B' : 'none',
          outlineOffset: -2,
          borderRadius: 2,
          overflow: 'hidden',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        {SHIFTS.map((sh) => {
          const slots = byShift[sh.id] || [];
          const count = slots.length;
          const over = count > maxEmp;
          const rowClosed = isWeeklyMachineShiftClosed(
            closedMap,
            YEAR,
            MONTH_IDX,
            day,
            machineId,
            sh.id,
          );
          const titleClosed = rowClosed ? '(Fermé) ' : '';
          return (
            <div
              key={sh.id}
              title={
                titleClosed +
                (count > 0
                  ? `${sh.label} : ${slots
                      .map(({ emp: e, training }) =>
                        training
                          ? `${e.prenom} ${e.nom} (formation)`
                          : `${e.prenom} ${e.nom}`,
                      )
                      .join(', ')}`
                  : `${sh.label} : aucun`)
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flex: 1,
                padding: '1px 2px',
                borderRadius: 2,
                backgroundColor: rowClosed
                  ? '#E4E4E7'
                  : count === 0
                    ? 'transparent'
                    : sh.cellBg + '88',
                backgroundImage: rowClosed
                  ? 'repeating-linear-gradient(-45deg, rgba(148,163,184,0.28) 0px, rgba(148,163,184,0.28) 3px, transparent 3px, transparent 7px)'
                  : undefined,
                border: over ? '1px solid #FCA5A5' : '1px solid transparent',
                borderLeft: rowClosed ? '3px solid #52525B' : undefined,
                boxSizing: 'border-box',
                minHeight: 0,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 1.5,
                  flexShrink: 0,
                  backgroundColor: sh.chipBg,
                  color: sh.chipText,
                  fontSize: 6,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: rowClosed ? 0.55 : 1,
                }}
              >
                {sh.short}
              </span>
              {count === 0 ? (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: rowClosed ? 700 : 400,
                    color: rowClosed ? '#52525B' : '#CBD5E1',
                    fontStyle: rowClosed ? 'normal' : 'italic',
                  }}
                >
                  {rowClosed ? 'Fermé' : '—'}
                </span>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {slots.slice(0, 3).map(({ emp: e, training }) => (
                    <EmpInitialsMachineRow key={e.id} emp={e} training={training} />
                  ))}
                  {slots.length > 3 && (
                    <span style={{ fontSize: 7, fontWeight: 700, color: '#64748B' }}>
                      +{slots.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const rowH = compact ? 19 : 23;

  return (
    <div
      onClick={onClick}
      style={{
        width: '100%',
        height: '100%',
        padding: '2px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        backgroundColor: 'var(--card-bg)',
        outline: isT ? '2px solid #F59E0B' : 'none',
        outlineOffset: -2,
        borderRadius: 2,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {SHIFTS.map((sh) => {
        const slots = byShift[sh.id] || [];
        const count = slots.length;
        const ratio = Math.min(count / maxEmp, 1);
        const over = count > maxEmp;
        const rowClosed = isWeeklyMachineShiftClosed(
          closedMap,
          YEAR,
          MONTH_IDX,
          day,
          machineId,
          sh.id,
        );
        const barColor =
          over ? '#EF4444' : count === 0 ? '#E5E7EB' : count >= maxEmp ? '#22C55E' : '#F59E0B';
        const names = slots
          .map(({ emp: e, training }) =>
            training ? `${e.prenom} ${e.nom} (formation)` : `${e.prenom} ${e.nom}`,
          )
          .join(', ');

        return (
          <div
            key={sh.id}
            title={
              (rowClosed ? '(Fermé) ' : '') +
              (count > 0 ? `${sh.label} : ${names}` : `${sh.label} : aucun opérateur`)
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              height: rowH,
              minHeight: rowH,
              padding: '0 3px',
              borderRadius: 2,
              backgroundColor: rowClosed
                ? '#E4E4E7'
                : count === 0
                  ? 'transparent'
                  : sh.cellBg + '88',
              backgroundImage: rowClosed
                ? 'repeating-linear-gradient(-45deg, rgba(148,163,184,0.28) 0px, rgba(148,163,184,0.28) 3px, transparent 3px, transparent 7px)'
                : undefined,
              borderLeft: rowClosed ? '3px solid #52525B' : undefined,
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                flexShrink: 0,
                backgroundColor: sh.chipBg,
                color: sh.chipText,
                fontSize: 7,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: rowClosed ? 0.55 : 1,
              }}
            >
              {sh.short}
            </span>

            <span
              style={{
                fontSize: compact ? 11 : 13,
                fontWeight: 800,
                lineHeight: 1,
                color: rowClosed
                  ? '#52525B'
                  : count === 0
                    ? '#CBD5E1'
                    : over
                      ? '#EF4444'
                      : sh.cellText,
                minWidth: 14,
                textAlign: 'center',
              }}
            >
              {rowClosed ? '—' : count}
            </span>

            <div
              style={{
                flex: 1,
                backgroundColor: rowClosed ? '#CBD5E1' : '#E5E7EB',
                borderRadius: 2,
                height: rowClosed ? 5 : 3,
                overflow: 'hidden',
                backgroundImage: rowClosed
                  ? 'repeating-linear-gradient(45deg, #64748b 0px, #64748b 2px, #e2e8f0 2px, #e2e8f0 4px)'
                  : undefined,
              }}
            >
              {!rowClosed && (
                <div
                  style={{
                    height: '100%',
                    borderRadius: 2,
                    backgroundColor: barColor,
                    width: `${ratio * 100}%`,
                    transition: 'width 0.2s',
                  }}
                />
              )}
            </div>

            {over && !rowClosed && (
              <span style={{ fontSize: 7, fontWeight: 700, color: '#EF4444', flexShrink: 0 }}>
                !
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
