import type { CSSProperties, MouseEvent } from 'react';
import { usePlanningData } from '@/context/PlanningDataContext';
import { ShiftChip } from '@/features/planning/components/atoms';
import { planningStatusShort, planningStatusCellStyle } from '@/lib/planningStatusShort';
import {
  segmentIsTraining,
  workAssignmentSegments,
} from '@/lib/workAssignmentSegments';

export function EmpCell({
  empId,
  day,
  compact,
  onClick,
}: {
  empId: string;
  day: number;
  compact: boolean;
  onClick?: (empId: string, day: number) => void;
}) {
  const { assignments, SHIFTS, STATUSES, isWeekend, TODAY, MACHINES, EMPLOYEES } =
    usePlanningData();
  const empRow = EMPLOYEES.find((e) => e.id === empId);
  const key = `${empId}-${day}`;
  const asgn = assignments[key];
  const wknd = isWeekend(day);
  const isT = day === TODAY;

  const base: CSSProperties = {
    width: '100%',
    height: '100%',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: compact ? '1px 2px' : '2px 4px',
    borderRadius: 2,
    position: 'relative',
    transition: 'filter 0.08s',
    outline: isT ? '2px solid #F59E0B' : 'none',
    outlineOffset: -2,
  };
  const hover = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.filter = 'brightness(0.93)';
  };
  const leave = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.filter = '';
  };

  if (!asgn || asgn.type === 'weekend') {
    return (
      <div
        style={{
          ...base,
          cursor: 'default',
          backgroundColor: wknd ? 'var(--weekend-bg)' : 'var(--body-bg)',
        }}
      />
    );
  }
  if (asgn.type === 'status') {
    const st = STATUSES.find((x) => x.id === asgn.status);
    const cell = planningStatusCellStyle(st);
    return (
      <div
        style={{
          ...base,
          boxSizing: 'border-box',
          backgroundColor: cell.bg,
          border: cell.border,
        }}
        onClick={() => onClick?.(empId, day)}
        onMouseEnter={hover}
        onMouseLeave={leave}
      >
        <span
          style={{
            fontSize: compact ? 9 : 10,
            fontWeight: 700,
            color: cell.color,
          }}
        >
          {planningStatusShort(st)}
        </span>
      </div>
    );
  }
  const sh = SHIFTS.find((x) => x.id === asgn.shift);
  const mc = MACHINES.find((x) => x.id === asgn.machine);
  const shifts =
    asgn.shifts && asgn.shifts.length > 1 ? asgn.shifts : null;

  if (shifts) {
    return (
      <div
        style={{
          ...base,
          padding: 0,
          gap: 0,
          flexDirection: 'row',
          backgroundColor: 'transparent',
          overflow: 'hidden',
        }}
        onClick={() => onClick?.(empId, day)}
        onMouseEnter={hover}
        onMouseLeave={leave}
        title={shifts
          .map((s) => {
            const sm = SHIFTS.find((x) => x.id === s.shift);
            const m = MACHINES.find((x) => x.id === s.machine);
            const form = segmentIsTraining(s, empRow) ? ' · formation' : '';
            return `${sm?.label}: ${m?.short || '—'}${form}`;
          })
          .join(' + ')}
      >
        {shifts.map((s, i) => {
          const ss = SHIFTS.find((x) => x.id === s.shift);
          const sm = MACHINES.find((x) => x.id === s.machine);
          const form = segmentIsTraining(s, empRow);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                backgroundColor: ss?.cellBg || '#F9FAFB',
                borderRight:
                  i < shifts.length - 1 ? '1px dashed rgba(0,0,0,0.18)' : 'none',
                padding: compact ? '1px' : '2px',
                minWidth: 0,
                position: 'relative',
                boxSizing: 'border-box',
                boxShadow: form ? 'inset 0 0 0 1px #7C3AED' : undefined,
              }}
            >
              <span
                style={{
                  fontSize: compact ? 7 : 8,
                  fontWeight: 700,
                  color: ss?.cellText,
                  lineHeight: 1,
                }}
              >
                {sm?.short || '—'}
              </span>
              <span
                style={{
                  fontSize: 6,
                  fontWeight: 800,
                  padding: '0 3px',
                  borderRadius: 2,
                  backgroundColor: ss?.chipBg,
                  color: ss?.chipText,
                }}
              >
                {ss?.short}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  const segmentsOne = workAssignmentSegments(asgn);
  const singleTraining =
    segmentsOne.length === 1 && segmentIsTraining(segmentsOne[0]!, empRow);

  const workTitle = `${sh?.label ?? ''}: ${mc?.short || '—'}${singleTraining ? ' · formation' : ''}`;

  return (
    <div
      style={{
        ...base,
        backgroundColor: sh?.cellBg || '#F9FAFB',
        boxSizing: 'border-box',
        border: singleTraining ? '1px solid #7C3AED' : 'none',
      }}
      title={workTitle}
      onClick={() => onClick?.(empId, day)}
      onMouseEnter={hover}
      onMouseLeave={leave}
    >
      <span
        style={{
          fontSize: compact ? 9 : 10,
          fontWeight: 600,
          color: sh?.cellText,
          lineHeight: 1,
        }}
      >
        {mc?.short || '—'}
      </span>
      <ShiftChip shiftId={asgn.shift} />
    </div>
  );
}
