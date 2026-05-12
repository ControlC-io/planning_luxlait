// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Assignment, PlanningDataBundle } from '@/data/planningData';
import type { ThemeTokens } from '@/data/themes';
import { usePlanningFull } from '@/context/PlanningDataContext';
import { AvatarChip, ImportanceDot, ShiftChip } from '@/features/planning/components/atoms';
import {
  hasEmpSkill,
  skillIdsForEmp,
  useEmployeeSkillsStore,
} from '@/stores/employeeSkillsStore';
import { planningFetch, planningJson } from '@/lib/planningApi';
import {
  buildClosedMapFromApi,
  isWeeklyMachineShiftClosed,
  type ApiWeeklyMachineClosedShiftRow,
} from '@/lib/machineWeeklyClosures';
import { bundleDayFromIso, isoDateFromBundleDay } from '@/lib/planningDates';
import { planningMonthRange } from '@/lib/mapApiToPlanningBundle';
import { planningStatusCellStyle, planningStatusShort } from '@/lib/planningStatusShort';
import {
  employeeWorksMachineShift,
  segmentIsTraining,
  workAssignmentFingerprint,
  workAssignmentSegments,
} from '@/lib/workAssignmentSegments';

export function EditModal({ empId, day, onClose, theme }: { empId: string; day: number; onClose: () => void; theme: ThemeTokens }) {
  const {
    planningYear: _py,
    planningMonthOneBased: _pm,
    setPlanningMonth: _sm,
    refetchPlanning,
    workAssignmentByCell,
    weeklyStatusRowByCell,
    ...PLANNING_DATA
  } = usePlanningFull();
  const { EMPLOYEES, MACHINES, SHIFTS, STATUSES, assignments } = PLANNING_DATA;
  const skillsByEmpId = useEmployeeSkillsStore((s) => s.skillsByEmpId);
  const emp  = EMPLOYEES.find(e => e.id === empId);
  const empSkillSet = emp ? skillIdsForEmp(skillsByEmpId, emp.id) : new Set();
  const key  = `${empId}-${day}`;
  const asgn = assignments[key] || {};

  const defaultMachine =
    asgn.machine ||
    MACHINES.find((m) => empSkillSet.has(m.id))?.id ||
    '';

  const [tab,      setTab]    = useState(asgn.type === 'status' ? 'status' : 'affectation');
  const [shift,    setShift]  = useState(asgn.shift   || SHIFTS[0]?.id || '');
  const [machine,  setMachine]= useState(defaultMachine);
  const [status,   setStatus] = useState(asgn.status  || STATUSES[0]?.id || '');
  const [addOpen,  setAddOpen]= useState(false);

  const DOW_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const dow = DOW_FR[(PLANNING_DATA.MAY_1_DOW + day - 1) % 7];

  // ── Compute current team: same machine + shift + day ──────────────────
  const currentTeam = useMemo(() =>
    EMPLOYEES.filter(e => {
      if (e.id === empId) return false;
      const a = assignments[`${e.id}-${day}`];
      return employeeWorksMachineShift(a, machine, shift);
    }), [machine, shift, day, assignments, EMPLOYEES, empId]);

  // ── Available to add: qualified, not absent, not already on team ──────
  const mc = MACHINES.find(m => m.id === machine);
  const available = useMemo(() =>
    EMPLOYEES.filter(e => {
      if (e.id === empId) return false;
      if (currentTeam.find(t => t.id === e.id)) return false;
      if (!hasEmpSkill(skillsByEmpId, e.id, machine)) return false;
      const a = assignments[`${e.id}-${day}`];
      return !a || a.type === 'weekend' || a.type === 'work';
    }), [machine, currentTeam, day, skillsByEmpId, empId]);

  const [addedIds, setAddedIds] = useState([]);
  const toggleAdd = id => setAddedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  const [saving, setSaving] = useState(false);
  const dayDate = isoDateFromBundleDay(PLANNING_DATA, day);

  const removeTeamMember = async (otherEmpId) => {
    const meta = workAssignmentByCell[`${otherEmpId}-${day}`];
    if (!meta?.id) return;
    try {
      await planningFetch(`/luxlait_daily_assignments/${meta.id}`, { method: 'DELETE' });
      await refetchPlanning();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Échec suppression');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cellKey = `${empId}-${day}`;
      const workMeta = workAssignmentByCell[cellKey];
      const statusMeta = weeklyStatusRowByCell[cellKey];

      if (tab === 'affectation') {
        const idsToClear = new Set([empId, ...addedIds]);
        for (const eid of idsToClear) {
          const st = weeklyStatusRowByCell[`${eid}-${day}`];
          if (st?.id) {
            await planningFetch(`/luxlait_weekly_employee_statuses/${st.id}`, {
              method: 'DELETE',
            });
          }
        }
        const rows = [
          {
            day_date: dayDate,
            employee_id: empId,
            machine_id: machine,
            time_slot_id: shift,
          },
          ...addedIds.map((id) => ({
            day_date: dayDate,
            employee_id: id,
            machine_id: machine,
            time_slot_id: shift,
          })),
        ];
        await planningFetch('/luxlait_daily_assignments/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        });
      } else {
        if (workMeta?.id) {
          await planningFetch(`/luxlait_daily_assignments/${workMeta.id}`, {
            method: 'DELETE',
          });
        }
        if (statusMeta?.id) {
          await planningFetch(`/luxlait_weekly_employee_statuses/${statusMeta.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_id: status }),
          });
        } else {
          await planningFetch('/luxlait_weekly_employee_statuses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              day_date: dayDate,
              employee_id: empId,
              status_id: status,
            }),
          });
        }
      }
      await refetchPlanning();
      onClose();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const overlay = { position:'fixed', inset:0, backgroundColor:'rgba(15,23,42,0.48)', zIndex:1000,
    display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' };
  const modal   = { background:'#fff', borderRadius:12, width:580, maxHeight:'90vh',
    boxShadow:'0 24px 64px rgba(0,0,0,0.2)', overflow:'hidden',
    display:'flex', flexDirection:'column', fontFamily:'IBM Plex Sans, sans-serif' };

  const btnP = { padding:'8px 20px', borderRadius:6, border:'none', cursor:'pointer',
    backgroundColor:theme.primaryBtn, color:theme.primaryBtnText, fontSize:13, fontWeight:600 };
  const btnS = { padding:'8px 16px', borderRadius:6, border:'1px solid #E5E7EB',
    cursor:'pointer', backgroundColor:'#fff', fontSize:13, fontWeight:500, color:'#374151' };
  const label = { fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase',
    letterSpacing:'0.06em', display:'block', marginBottom:8 };

  return (
    <div style={overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={modal}>

        {/* Header */}
        <div style={{ padding:'18px 24px 0', borderBottom:'1px solid #E5E7EB', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:14 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'#0F172A' }}>
                {emp?.prenom} {emp?.nom}
                {emp?.backup && <span style={{ marginLeft:8, fontSize:10, fontWeight:700, color:'#92400E',
                  backgroundColor:'#FEF3C7', padding:'1px 6px', borderRadius:4, verticalAlign:'middle' }}>BACKUP</span>}
              </div>
              <div style={{ fontSize:13, color:'#64748B', marginTop:2 }}>
                {dow} {day} {PLANNING_DATA.MONTH_LABEL}
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
              fontSize:20, color:'#94A3B8', lineHeight:1, padding:4 }}>✕</button>
          </div>
          <div style={{ display:'flex', gap:0 }}>
            {[['affectation','Affectation'],['status','Absence / Statut']].map(([id,label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding:'7px 16px', border:'none', cursor:'pointer', background:'none', fontSize:13,
                fontWeight:500, color: tab===id ? theme.primaryBtn : '#64748B',
                borderBottom: tab===id ? `2px solid ${theme.primaryBtn}` : '2px solid transparent',
                marginBottom:-1,
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:24, overflowY:'auto', flex:1 }}>
          {tab === 'affectation' ? (
            <div style={{ display:'flex', gap:20 }}>

              {/* Left: shift + machine */}
              <div style={{ flex:'0 0 260px', display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <span style={label}>Créneau</span>
                  <div style={{ display:'flex', gap:8 }}>
                    {SHIFTS.map(sh => (
                      <button key={sh.id} onClick={() => { setShift(sh.id); setAddedIds([]); }} style={{
                        flex:1, padding:'9px 0', borderRadius:8, cursor:'pointer',
                        border:`2px solid ${shift===sh.id ? sh.chipBg : '#E5E7EB'}`,
                        backgroundColor: shift===sh.id ? sh.cellBg : '#fff',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                      }}>
                        <ShiftChip shiftId={sh.id} size="lg" />
                        <span style={{ fontSize:10, fontWeight:500, color:sh.cellText }}>{sh.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span style={label}>Machine</span>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {MACHINES.filter(m => empSkillSet.has(m.id)).map(m => (
                      <button key={m.id} onClick={() => { setMachine(m.id); setAddedIds([]); }} style={{
                        display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                        borderRadius:8, cursor:'pointer', textAlign:'left',
                        border:`2px solid ${machine===m.id ? theme.primaryBtn : '#E5E7EB'}`,
                        backgroundColor: machine===m.id ? '#F0F7FF' : '#fff',
                      }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#64748B', width:30,
                          textAlign:'center', padding:'2px 4px', backgroundColor:'#F1F5F9',
                          borderRadius:4, flexShrink:0 }}>{m.short}</span>
                        <span style={{ fontSize:12, fontWeight:500, color:'#1E293B', flex:1 }}>{m.name}</span>
                        <ImportanceDot importance={m.importance} />
                      </button>
                    ))}
                    {!empSkillSet.size && <p style={{ fontSize:13, color:'#94A3B8', fontStyle:'italic' }}>Aucune compétence configurée.</p>}
                  </div>
                </div>
              </div>

              {/* Right: team composition */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={label}>Équipe — {mc?.short || '?'} · {SHIFTS.find(s=>s.id===shift)?.label}</span>
                  <span style={{ fontSize:11, color:'#94A3B8' }}>
                    {currentTeam.length + addedIds.length + 1}/{mc?.maxEmp || '?'} op.
                  </span>
                </div>

                {/* Current employee (self) */}
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
                  backgroundColor:'#F0F7FF', borderRadius:8, marginBottom:6,
                  border:`1px solid ${theme.primaryBtn}33` }}>
                  <AvatarChip emp={emp} color='#DBEAFE' textColor='#1E40AF' />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1E293B' }}>
                      {emp?.prenom} {emp?.nom}
                    </div>
                    <div style={{ fontSize:10, color:'#64748B' }}>En cours d'édition</div>
                  </div>
                  <ShiftChip shiftId={shift} />
                </div>

                {/* Existing team members */}
                {currentTeam.map(e => (
                  <div key={e.id} style={{ display:'flex', alignItems:'center', gap:8,
                    padding:'7px 10px', backgroundColor:'#F8FAFC', borderRadius:8, marginBottom:5,
                    border:'1px solid #E5E7EB' }}>
                    <AvatarChip emp={e} color='#E0F2FE' textColor='#0369A1' />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'#1E293B' }}>
                        {e.prenom} {e.nom}
                      </div>
                      {e.backup && <div style={{ fontSize:9, fontWeight:600, color:'#92400E' }}>BACKUP</div>}
                    </div>
                    <ShiftChip shiftId={shift} />
                    <button title="Retirer de l'équipe" onClick={() => removeTeamMember(e.id)} style={{ background:'none', border:'none',
                      cursor:'pointer', color:'#CBD5E1', fontSize:14, lineHeight:1, padding:'0 2px' }}>✕</button>
                  </div>
                ))}

                {/* Added members */}
                {addedIds.map(id => {
                  const e = EMPLOYEES.find(x=>x.id===id);
                  return (
                    <div key={id} style={{ display:'flex', alignItems:'center', gap:8,
                      padding:'7px 10px', backgroundColor:'#F0FDF4', borderRadius:8, marginBottom:5,
                      border:'1px solid #86EFAC' }}>
                      <AvatarChip emp={e} color='#DCFCE7' textColor='#166534' />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:500, color:'#1E293B' }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize:9, color:'#16A34A', fontWeight:600 }}>Ajouté</div>
                      </div>
                      <ShiftChip shiftId={shift} />
                      <button onClick={() => toggleAdd(id)} style={{ background:'none', border:'none',
                        cursor:'pointer', color:'#86EFAC', fontSize:14, lineHeight:1, padding:'0 2px' }}>✕</button>
                    </div>
                  );
                })}

                {/* Capacity indicator */}
                {(() => {
                  const total = currentTeam.length + addedIds.length + 1;
                  const max   = mc?.maxEmp || 3;
                  const pct   = Math.min(total/max, 1);
                  const over  = total > max;
                  return (
                    <div style={{ marginTop:8, marginBottom:10 }}>
                      <div style={{ backgroundColor:'#F1F5F9', borderRadius:4, height:5, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:4, transition:'width 0.2s',
                          backgroundColor: over ? '#EF4444' : '#22C55E',
                          width:`${pct*100}%` }} />
                      </div>
                      {over && <div style={{ fontSize:10, color:'#EF4444', marginTop:3, fontWeight:500 }}>
                        Capacité maximale dépassée
                      </div>}
                    </div>
                  );
                })()}

                {/* Add member toggle */}
                {machine && (
                  <button onClick={() => setAddOpen(!addOpen)} style={{
                    width:'100%', padding:'7px 10px', borderRadius:8, cursor:'pointer',
                    border:`1px dashed ${addOpen ? theme.primaryBtn : '#CBD5E1'}`,
                    backgroundColor: addOpen ? '#F0F7FF' : '#F8FAFC',
                    fontSize:12, fontWeight:500, color: addOpen ? theme.primaryBtn : '#64748B',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  }}>
                    <span style={{ fontSize:16, lineHeight:1 }}>{addOpen ? '−' : '+'}</span>
                    Ajouter un équipier
                    {available.length > 0 && <span style={{ fontSize:10, backgroundColor:theme.primaryBtn,
                      color:'#fff', borderRadius:10, padding:'0 5px' }}>{available.length}</span>}
                  </button>
                )}

                {addOpen && (
                  <div style={{ marginTop:8, border:'1px solid #E5E7EB', borderRadius:8, overflow:'hidden' }}>
                    {available.length === 0 ? (
                      <div style={{ padding:'12px 14px', fontSize:12, color:'#94A3B8', fontStyle:'italic' }}>
                        Aucun employé disponible avec cette compétence.
                      </div>
                    ) : available.map((e, i) => {
                      const selected = addedIds.includes(e.id);
                      const curAsgn  = assignments[`${e.id}-${day}`];
                      const conflict = curAsgn?.type === 'work' && (curAsgn.shift !== shift || curAsgn.machine !== machine);
                      return (
                        <div key={e.id} onClick={() => toggleAdd(e.id)} style={{
                          display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                          cursor:'pointer', borderBottom: i<available.length-1 ? '1px solid #F1F5F9' : 'none',
                          backgroundColor: selected ? '#F0FDF4' : '#fff',
                        }}>
                          <AvatarChip emp={e} color={selected ? '#DCFCE7' : '#F1F5F9'}
                            textColor={selected ? '#166534' : '#64748B'} size={24} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:500, color:'#1E293B' }}>{e.prenom} {e.nom}</div>
                            {conflict && <div style={{ fontSize:9, color:'#F59E0B', fontWeight:600 }}>
                              ⚠ Déjà affecté ce jour (sera déplacé)
                            </div>}
                          </div>
                          <div style={{ width:18, height:18, borderRadius:4,
                            border:`2px solid ${selected ? '#22C55E' : '#CBD5E1'}`,
                            backgroundColor: selected ? '#22C55E' : '#fff',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            flexShrink:0 }}>
                            {selected && <span style={{ color:'#fff', fontSize:11, fontWeight:700 }}>✓</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          ) : (
            /* Absence tab */
            <div>
              <span style={label}>Type d'absence</span>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {STATUSES.map(st => (
                  <button key={st.id} onClick={() => setStatus(st.id)} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                    borderRadius:8, cursor:'pointer', textAlign:'left',
                    border:`2px solid ${status===st.id ? st.color : '#E5E7EB'}`,
                    backgroundColor: status===st.id ? st.bg : '#fff',
                  }}>
                    <span style={{ width:36, fontSize:10, fontWeight:700, color:st.color,
                      backgroundColor:st.bg, padding:'2px 5px', borderRadius:4, textAlign:'center' }}>
                      {planningStatusShort(st)}
                    </span>
                    <span style={{ fontSize:13, fontWeight:500, color:'#1E293B' }}>{st.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid #E5E7EB', flexShrink:0,
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:11, color:'#94A3B8' }}>
            {addedIds.length > 0 && `${addedIds.length} ajout${addedIds.length>1?'s':''} en attente`}
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <button style={btnS} onClick={onClose} disabled={saving}>Annuler</button>
            <button style={{ ...btnP, opacity: saving ? 0.7 : 1 }} disabled={saving} onClick={handleSave}>
              {saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Overlay solver assignment rows onto bundle assignments for preview cells */
function proposedAssignmentsFromAuto(
  solverAssignments: unknown[] | undefined,
  bundle: PlanningDataBundle,
): Record<string, Assignment> {
  const base = { ...bundle.assignments };
  const list = Array.isArray(solverAssignments) ? solverAssignments : [];
  for (const raw of list) {
    const a = raw as Record<string, unknown>;
    const dayDate = String(a.day_date ?? a.dayDate ?? '');
    const empId = String(a.employee_id ?? a.employeeId ?? '');
    const machineId = String(a.machine_id ?? a.machineId ?? '');
    const tsId = (a.time_slot_id ?? a.timeSlotId ?? null) as string | null;
    const d = bundleDayFromIso(bundle, dayDate);
    if (d === null || !empId || !machineId) continue;
    const key = `${empId}-${d}`;
    const empRow = bundle.EMPLOYEES.find((e) => e.id === empId);
    const training = empRow?.skillLevels?.[machineId] === 'IN_TRAINING';
    base[key] = {
      type: 'work',
      shift: tsId ?? '',
      machine: machineId,
      shifts: [{ shift: tsId ?? '', machine: machineId, training }],
    };
  }
  return base;
}

/** True if planning cell content differs (work machine or shift, or status id, or type). */
function assignmentDiffers(
  cur: Assignment | undefined,
  prp: Assignment | undefined,
): boolean {
  if (!cur && !prp) return false;
  if (!cur || !prp) return true;
  if (cur.type !== prp.type) return true;
  if (cur.type === 'weekend' && prp.type === 'weekend') return false;
  if (cur.type === 'status' && prp.type === 'status') return cur.status !== prp.status;
  if (cur.type === 'work' && prp.type === 'work') {
    return workAssignmentFingerprint(cur) !== workAssignmentFingerprint(prp);
  }
  return true;
}

function formatAssignmentSummary(a: Assignment | undefined, bundle: PlanningDataBundle): string {
  if (!a) return '—';
  if (a.type === 'weekend') return 'Week-end';
  if (a.type === 'status') {
    const st = bundle.STATUSES.find((x) => x.id === a.status);
    return planningStatusShort(st);
  }
  if (a.type === 'work') {
    const segs = workAssignmentSegments(a);
    if (segs.length === 0) return '—';
    return segs
      .map((s) => {
        const m = bundle.MACHINES.find((x) => x.id === s.machine);
        const sh = bundle.SHIFTS.find((x) => x.id === s.shift);
        return `${m?.short ?? '—'} ${sh?.short ?? ''}`.trim();
      })
      .join(' · ');
  }
  return '—';
}

function assignmentFormationLabel(
  a: Assignment | undefined,
  emp: PlanningDataBundle['EMPLOYEES'][0] | undefined,
): string {
  if (!a || a.type !== 'work' || !emp) return '—';
  const segs = workAssignmentSegments(a);
  if (segs.length === 0) return '—';
  const anyTraining = segs.some((s) => segmentIsTraining(s, emp));
  return anyTraining ? 'Oui' : 'Non';
}

// ── Solver Modal — form → loading → detailed preview ───────────────────────
export function SolverModal({ onClose, theme }: { onClose: () => void; theme: ThemeTokens }) {
  const { refetchPlanning, ...PLANNING_DATA } = usePlanningFull();
  const [step, setStep] = useState('form');
  const [progress, setProg] = useState(0);
  const [previewTab, setPTab] = useState('planning');
  const [mode, setMode] = useState('full');
  const [autoResult, setAutoResult] = useState(null);
  const [solverError, setSolverError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [closedByWeek, setClosedByWeek] = useState(() => new Map<number, Set<string>>());
  /** Native title breaks inside overflow:auto scroll areas; portal tooltip to document.body */
  const [solverEmpHoverTip, setSolverEmpHoverTip] = useState(null);

  useEffect(() => {
    let cancelled = false;
    planningJson<ApiWeeklyMachineClosedShiftRow[]>(
      `/luxlait_weekly_machine_closed_shifts?year=${PLANNING_DATA.YEAR}`,
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
  }, [PLANNING_DATA.YEAR]);

  useEffect(() => {
    if (step !== 'preview') setSolverEmpHoverTip(null);
  }, [step]);

  useEffect(() => {
    setSolverEmpHoverTip(null);
  }, [previewTab]);

  const range = useMemo(
    () => planningMonthRange(PLANNING_DATA.YEAR, PLANNING_DATA.MONTH_IDX + 1),
    [PLANNING_DATA.YEAR, PLANNING_DATA.MONTH_IDX],
  );

  const proposed = useMemo(() => {
    if (autoResult?.assignments && Array.isArray(autoResult.assignments)) {
      return proposedAssignmentsFromAuto(autoResult.assignments, PLANNING_DATA);
    }
    return PLANNING_DATA.assignments;
  }, [autoResult, PLANNING_DATA]);

  const shiftGenCount = useMemo(() => {
    const list = autoResult?.assignments;
    return Array.isArray(list) ? list.length : 0;
  }, [autoResult]);

  const { changes, warnings } = useMemo(() => {
    const { EMPLOYEES, assignments, isWeekend } = PLANNING_DATA;
    let ch = 0;
    EMPLOYEES.forEach((emp) => {
      for (let day = 1; day <= PLANNING_DATA.DAYS; day++) {
        if (isWeekend(day)) continue;
        const key = `${emp.id}-${day}`;
        const cur = assignments[key];
        const prp = proposed[key];
        if (assignmentDiffers(cur, prp)) ch++;
      }
    });
    const raw = autoResult?.warnings ?? autoResult?.solver_warnings;
    const warns = [];
    if (Array.isArray(raw)) {
      for (const w of raw) {
        if (typeof w === 'string') warns.push({ type: 'warn', msg: w });
        else if (w && typeof w === 'object')
          warns.push({
            type: w.type === 'info' ? 'info' : 'warn',
            msg: w.msg ?? w.message ?? JSON.stringify(w),
            day: w.day,
          });
      }
    }
    return { changes: ch, warnings: warns };
  }, [proposed, PLANNING_DATA, autoResult]);

  const changeRows = useMemo(() => {
    const { EMPLOYEES, assignments, isWeekend, DAYS, dowLabel } = PLANNING_DATA;
    const rows = [];
    for (const emp of EMPLOYEES) {
      for (let day = 1; day <= DAYS; day++) {
        if (isWeekend(day)) continue;
        const key = `${emp.id}-${day}`;
        const cur = assignments[key];
        const prp = proposed[key];
        if (!assignmentDiffers(cur, prp)) continue;
        rows.push({
          key,
          empLabel: `${emp.prenom} ${emp.nom}`.trim(),
          day,
          dow: dowLabel(day),
          iso: isoDateFromBundleDay(PLANNING_DATA, day),
          before: formatAssignmentSummary(cur, PLANNING_DATA),
          after: formatAssignmentSummary(prp, PLANNING_DATA),
          formationBefore: assignmentFormationLabel(cur, emp),
          formationAfter: assignmentFormationLabel(prp, emp),
        });
      }
    }
    rows.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.empLabel.localeCompare(b.empLabel, 'fr');
    });
    return rows;
  }, [proposed, PLANNING_DATA]);

  const startSolver = async () => {
    setSolverError(null);
    setStep('loading');
    setProg(4);
    let iv = null;
    try {
      iv = setInterval(() => setProg((x) => (x >= 92 ? x : x + 5)), 160);

      let body;
      if (mode === 'partial') {
        const now = new Date();
        const y = PLANNING_DATA.YEAR;
        const m0 = PLANNING_DATA.MONTH_IDX;
        const inMonth = now.getFullYear() === y && now.getMonth() === m0;
        const d = inMonth ? Math.min(now.getDate(), PLANNING_DATA.DAYS) : 1;
        const pad = (n) => String(n).padStart(2, '0');
        body = {
          replanFromDate: `${y}-${pad(m0 + 1)}-${pad(d)}`,
        };
      } else {
        body = {
          fromDate: range.fromDate,
          toDate: range.toDate,
          lockExisting: false,
        };
      }

      const res = await planningFetch('/auto_plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`);
      if (!json?.ok) {
        setSolverError(json?.error ? String(json.error) : 'Réponse solveur invalide');
        setStep('form');
        return;
      }
      setAutoResult(json);
      setProg(100);
      setStep('preview');
    } catch (e) {
      setSolverError(e instanceof Error ? e.message : String(e));
      setStep('form');
    } finally {
      if (iv) clearInterval(iv);
    }
  };

  const approvePlanning = async () => {
    setSaving(true);
    try {
      const list = autoResult?.assignments;
      const rows = (Array.isArray(list) ? list : []).map((raw) => {
        const a = raw;
        return {
          day_date: String(a.day_date ?? a.dayDate ?? ''),
          employee_id: String(a.employee_id ?? a.employeeId ?? ''),
          machine_id: String(a.machine_id ?? a.machineId ?? ''),
          time_slot_id: (a.time_slot_id ?? a.timeSlotId ?? null) as string | null,
        };
      }).filter((r) => r.day_date && r.employee_id && r.machine_id);
      if (rows.length > 0) {
        await planningFetch('/luxlait_daily_assignments/bulk_upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        });
      }
      await refetchPlanning();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Échec enregistrement');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (warnings.length === 0 && previewTab === 'warnings') setPTab('planning');
  }, [warnings.length, previewTab]);

  const overlay = { position:'fixed', inset:0, backgroundColor:'rgba(15,23,42,0.55)', zIndex:1000,
    display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' };

  const btnP = { padding:'10px 24px', borderRadius:8, border:'none', cursor:'pointer',
    backgroundColor:theme.primaryBtn, color:'#fff', fontSize:14, fontWeight:600 };
  const labelSt = { fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase',
    letterSpacing:'0.06em', display:'block', marginBottom:6 };
  const inputSt = { width:'100%', padding:'8px 12px', border:'1px solid #E5E7EB',
    borderRadius:8, fontSize:13, color:'#1E293B', fontFamily:'IBM Plex Sans, sans-serif', outline:'none' };

  // ── Modal widths per step ──────────────────────────────────────────────
  const modalW = step === 'preview' ? 'min(1200px, 98vw)' : 560;

  const placeSolverEmpTip = (clientX, clientY) => {
    const pad = 12;
    const maxW = 280;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const left = Math.min(Math.max(pad, clientX + 14), vw - maxW - pad);
    const top = Math.max(pad, clientY + 12);
    return { left, top };
  };

  const solverEmpTipPortal =
    solverEmpHoverTip &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        role="tooltip"
        style={{
          position: 'fixed',
          left: solverEmpHoverTip.left,
          top: solverEmpHoverTip.top,
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
        {solverEmpHoverTip.text}
      </div>,
      document.body,
    );

  return (
    <>
    <div style={overlay} onClick={e => e.target===e.currentTarget && step==='form' && onClose()}>
      <div style={{ background:'#fff', borderRadius:12, width:modalW, maxHeight:'92vh',
        boxShadow:'0 24px 64px rgba(0,0,0,0.22)', overflow:'hidden',
        display:'flex', flexDirection:'column', fontFamily:'IBM Plex Sans, sans-serif',
        transition:'width 0.3s ease' }}>

        {/* Header */}
        <div style={{ padding:'22px 28px', borderBottom:'1px solid #E5E7EB', flexShrink:0,
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#0F172A', lineHeight:1.2 }}>
              Générer un planning
            </div>
            <div style={{ fontSize:15, color:'#64748B', marginTop:6, lineHeight:1.35 }}>
              Solveur automatique OR-Tools CP-SAT
            </div>
          </div>
          {step !== 'loading' && (
            <button onClick={onClose} type="button" style={{ background:'none', border:'none', cursor:'pointer',
              fontSize:24, color:'#94A3B8', padding:6, lineHeight:1 }} aria-label="Fermer">✕</button>
          )}
        </div>

        {/* FORM STEP */}
        {step === 'form' && (
          <>
            <div style={{ padding:24, flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:20 }}>
              <div>
                <span style={labelSt}>Période</span>
                <div style={{ display:'flex', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:11, color:'#94A3B8', display:'block', marginBottom:4 }}>Du</label>
                    <input type="text" readOnly value={range.fromDate} style={inputSt} />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:11, color:'#94A3B8', display:'block', marginBottom:4 }}>Au</label>
                    <input type="text" readOnly value={range.toDate} style={inputSt} />
                  </div>
                </div>
              </div>

              <div>
                <span style={labelSt}>Mode</span>
                <div style={{ display:'flex', gap:10 }}>
                  {[
                    { id:'full',    label:'Mois complet',   desc:'Replanifier toute la période'      },
                    { id:'partial', label:'À partir d\'aujourd\'hui', desc:'Garder les affectations passées' },
                  ].map(opt => (
                    <div key={opt.id} onClick={() => setMode(opt.id)} style={{
                      flex:1, padding:'12px 14px', borderRadius:8, cursor:'pointer',
                      border:`2px solid ${mode===opt.id ? theme.primaryBtn : '#E5E7EB'}`,
                      backgroundColor: mode===opt.id ? '#F0F7FF' : '#fff',
                    }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1E293B' }}>{opt.label}</div>
                      <div style={{ fontSize:11, color:'#64748B', marginTop:3 }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <p style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.45, margin: 0 }}>
                Pondérations du solveur (équité, machines prioritaires, temps max, stabilité en replan)
                : réglages système côté serveur, pas modifiables depuis cette fenêtre.
              </p>
              {solverError && (
                <div style={{ padding:'0 24px 12px', fontSize:12, color:'#b91c1c' }}>{solverError}</div>
              )}
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid #E5E7EB', flexShrink:0,
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, color:'#94A3B8' }}>
                {PLANNING_DATA.EMPLOYEES.length} employés · {PLANNING_DATA.MACHINES.length} machines · {PLANNING_DATA.DAYS} jours
              </span>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={onClose} style={{ padding:'10px 16px', borderRadius:8,
                  border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer',
                  fontSize:13, fontWeight:500, color:'#374151' }}>Annuler</button>
                <button style={btnP} onClick={startSolver}>Lancer la génération</button>
              </div>
            </div>
          </>
        )}

        {/* LOADING STEP */}
        {step === 'loading' && (
          <div style={{ padding:'56px 48px', textAlign:'center' }}>
            <div style={{ width:48, height:48, margin:'0 auto 20px', borderRadius:'50%',
              border:`4px solid ${theme.primaryBtn}22`, borderTopColor:theme.primaryBtn,
              animation:'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ fontSize:15, fontWeight:600, color:'#1E293B', marginBottom:6 }}>Calcul en cours…</div>
            <div style={{ fontSize:13, color:'#64748B', marginBottom:28 }}>
              Résolution des contraintes · {PLANNING_DATA.EMPLOYEES.length} employés · {PLANNING_DATA.DAYS} jours
            </div>
            <div style={{ backgroundColor:'#F1F5F9', borderRadius:8, height:8, overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', borderRadius:8, backgroundColor:theme.primaryBtn,
                width:`${progress}%`, transition:'width 0.25s ease' }} />
            </div>
            <div style={{ fontSize:12, color:'#94A3B8' }}>{progress}%</div>
          </div>
        )}

        {/* PREVIEW STEP */}
        {step === 'preview' && (
          <>
            {/* Sub-header: stats bar */}
            <div style={{ padding:'14px 28px', backgroundColor:'#F8FAFC',
              borderBottom:'1px solid #E5E7EB', flexShrink:0,
              display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
                backgroundColor:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:8 }}>
                <span style={{ fontSize:18 }}>✓</span>
                <span style={{ fontSize:14, fontWeight:600, color:'#166534' }}>Proposition générée</span>
              </div>
              {[
                { val: String(shiftGenCount), label:'Lignes solveur', color:'#1E293B' },
                { val: `${changes}`, label:'Cellules différentes (mois)', color:'#0369A1' },
                { val: `${warnings.filter(w=>w.type==='warn').length}`, label:'Avertissements', color:'#92400E' },
              ].map(s => (
                <div key={s.label} style={{ display:'flex', flexDirection:'column', minWidth:72 }}>
                  <span style={{ fontSize:26, fontWeight:700, color:s.color, lineHeight:1 }}>{s.val}</span>
                  <span style={{ fontSize:12, color:'#94A3B8', marginTop:4, maxWidth:140 }}>{s.label}</span>
                </div>
              ))}
              <div style={{ flex:1 }} />
              {/* Legend */}
              <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#64748B' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', backgroundColor:'#3B82F6',
                    display:'inline-block', flexShrink:0 }} />
                  Modifié
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#64748B' }}>
                  <span style={{ width:10, height:10, borderRadius:2, backgroundColor:'#FEF3C7',
                    border:'1px solid #FCD34D', display:'inline-block' }} />
                  Aujourd'hui
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#64748B' }}>
                  {previewTab === 'machine_grid' ? (
                    <span style={{
                      fontSize:10, fontWeight:700, lineHeight:1,
                      padding:'1px 4px', borderRadius:2,
                      backgroundColor:'#DBEAFE', color:'#1E40AF',
                      borderBottom:'1px solid #7C3AED', boxSizing:'border-box',
                    }}>AB</span>
                  ) : (
                    <span style={{
                      width:12, height:9, borderRadius:2,
                      border:'1px solid #7C3AED', backgroundColor:'#FAF5FF',
                      display:'inline-block', flexShrink:0, boxSizing:'border-box',
                    }} />
                  )}
                  Formation
                </span>
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ display:'flex', gap:0, borderBottom:'1px solid #E5E7EB', flexShrink:0,
              padding:'0 24px', backgroundColor:'#fff' }}>
              {[
                ['planning','Vue planning'],
                ['machine_grid','Vue machine'],
                ['machines','Couverture machines'],
                ['changements', `Changements (${changes})`],
                ...(warnings.length > 0 ? [['warnings',`Avertissements (${warnings.length})`]] : []),
              ].map(([id,lbl]) => (
                <button key={id} onClick={() => setPTab(id)} style={{
                  padding:'9px 16px', border:'none', cursor:'pointer', background:'none',
                  fontSize:13, fontWeight:500,
                  color: previewTab===id ? theme.primaryBtn : '#64748B',
                  borderBottom: previewTab===id ? `2px solid ${theme.primaryBtn}` : '2px solid transparent',
                  marginBottom:-1,
                }}>{lbl}</button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>

              {/* ── TAB: Planning grid ─────────────────────────────────── */}
              {previewTab === 'planning' && (() => {
                const { EMPLOYEES, SHIFTS, MACHINES, DAYS, isWeekend, TODAY, dowLabel, assignments } = PLANNING_DATA;
                const nameW = 140, cellW = 52;
                return (
                  <div style={{ flex:1, overflow:'auto', fontSize:10 }}>
                    <div style={{ minWidth: nameW + cellW * DAYS }}>
                      {/* Day header */}
                      <div style={{ display:'flex', position:'sticky', top:0, zIndex:5, backgroundColor:'#fff',
                        borderBottom:'1px solid #E5E7EB' }}>
                        <div style={{ width:nameW, minWidth:nameW, flexShrink:0, padding:'6px 12px',
                          fontSize:10, fontWeight:700, color:'#94A3B8', position:'sticky',
                          left:0, backgroundColor:'#fff', zIndex:6, borderRight:'1px solid #E5E7EB' }}>
                          EMPLOYÉ
                        </div>
                        {Array.from({length:DAYS},(_,i)=>i+1).map(day => {
                          const wknd = isWeekend(day), isT = day===TODAY;
                          return (
                            <div key={day} style={{ width:cellW, minWidth:cellW, flexShrink:0, textAlign:'center',
                              padding:'4px 2px', borderRight:'1px solid #F1F5F9',
                              backgroundColor: isT ? '#FFFBEB' : wknd ? '#F8FAFC' : '#fff' }}>
                              <div style={{ fontSize:9, color: isT?'#92400E':wknd?'#CBD5E1':'#94A3B8' }}>{dowLabel(day)}</div>
                              <div style={{ fontSize:11, fontWeight: isT?800:600, color: isT?'#92400E':wknd?'#CBD5E1':'#1E293B' }}>{day}</div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Employee rows */}
                      {EMPLOYEES.map((emp, ei) => (
                        <div key={emp.id} style={{ display:'flex', borderBottom:'1px solid #F1F5F9',
                          backgroundColor: ei%2===0 ? '#fff' : '#FAFAFA' }}>
                          <div style={{ width:nameW, minWidth:nameW, flexShrink:0, height:32,
                            display:'flex', alignItems:'center', gap:6, padding:'0 10px',
                            position:'sticky', left:0, zIndex:2, borderRight:'1px solid #E5E7EB',
                            backgroundColor: ei%2===0 ? '#fff' : '#FAFAFA' }}>
                            <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0,
                              backgroundColor: emp.backup?'#FEF3C7':'#DBEAFE',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:8, fontWeight:700, color: emp.backup?'#92400E':'#1E40AF' }}>
                              {emp.prenom[0]}{emp.nom[0]}
                            </div>
                            <span style={{ fontSize:11, fontWeight:500, color:'#1E293B',
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {emp.prenom} {emp.nom}
                            </span>
                          </div>
                          {Array.from({length:DAYS},(_,i)=>i+1).map(day => {
                            const key  = `${emp.id}-${day}`;
                            const prp  = proposed[key];
                            const cur  = assignments[key];
                            const wknd = isWeekend(day);
                            const isT  = day===TODAY;
                            const stForPrp = prp?.type==='status'
                              ? PLANNING_DATA.STATUSES.find(x=>x.id===prp.status)
                              : undefined;
                            const statusSty = stForPrp ? planningStatusCellStyle(stForPrp) : null;
                            const changed = !wknd && assignmentDiffers(cur, prp);
                            const isFormation =
                              !wknd &&
                              prp?.type === 'work' &&
                              workAssignmentSegments(prp).some((s) =>
                                segmentIsTraining(s, emp),
                              );
                            const sh   = SHIFTS.find(s=>s.id===prp?.shift);
                            const mc   = MACHINES.find(m=>m.id===prp?.machine);
                            return (
                              <div key={day} style={{ width:cellW, minWidth:cellW, height:32,
                                flexShrink:0, padding:2, borderRight:'1px solid #F1F5F9' }}>
                                <div style={{ width:'100%', height:'100%', borderRadius:2, boxSizing:'border-box',
                                  display:'flex', flexDirection:'column', alignItems:'center',
                                  justifyContent:'center', gap:1, position:'relative',
                                  backgroundColor: wknd ? '#F8FAFC'
                                    : prp?.type==='status' && statusSty ? statusSty.bg
                                    : prp?.type==='work' ? (sh?.cellBg||'#F9FAFB')
                                    : '#F9FAFB',
                                  border: prp?.type==='status' && statusSty
                                    ? statusSty.border
                                    : isFormation
                                      ? '1px solid #7C3AED'
                                      : 'none',
                                  outline: isT ? '2px solid #F59E0B' : 'none', outlineOffset:-2 }}>
                                  {prp?.type==='work' && <>
                                    <span style={{ fontSize:9, fontWeight:600, color:sh?.cellText, lineHeight:1 }}>
                                      {mc?.short||'—'}
                                    </span>
                                    <span style={{ fontSize:8, fontWeight:700, padding:'0 3px', borderRadius:2,
                                      backgroundColor:sh?.chipBg, color:sh?.chipText }}>
                                      {sh?.short}
                                    </span>
                                  </>}
                                  {prp?.type==='status' && stForPrp && (
                                    <span style={{ fontSize:10, fontWeight:700, color: statusSty?.color }}>
                                      {planningStatusShort(stForPrp)}
                                    </span>
                                  )}
                                  {changed && (
                                    <div style={{
                                      position:'absolute', top:2, right:2, width:4, height:4,
                                      borderRadius:'50%', backgroundColor:'#3B82F6',
                                      boxShadow:'0 0 0 1px rgba(255,255,255,0.95)',
                                    }} />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── TAB: Machine grid (machines × days) ───────────────── */}
              {previewTab === 'machine_grid' && (() => {
                const { EMPLOYEES, SHIFTS, MACHINES, DAYS, isWeekend, TODAY, dowLabel, assignments } =
                  PLANNING_DATA;
                const y = PLANNING_DATA.YEAR;
                const m0 = PLANNING_DATA.MONTH_IDX;
                const nameW = 140;
                const cellW = 58;
                return (
                  <div style={{ flex:1, overflow:'auto', fontSize:10 }}>
                    <div style={{ minWidth: nameW + cellW * DAYS }}>
                      <div style={{ display:'flex', position:'sticky', top:0, zIndex:5, backgroundColor:'#fff',
                        borderBottom:'1px solid #E5E7EB' }}>
                        <div style={{ width:nameW, minWidth:nameW, flexShrink:0, padding:'6px 12px',
                          fontSize:10, fontWeight:700, color:'#94A3B8', position:'sticky',
                          left:0, backgroundColor:'#fff', zIndex:6, borderRight:'1px solid #E5E7EB' }}>
                          MACHINE
                        </div>
                        {Array.from({ length: DAYS }, (_, i) => i + 1).map((day) => {
                          const wknd = isWeekend(day);
                          const isT = day === TODAY;
                          return (
                            <div key={day} style={{ width:cellW, minWidth:cellW, flexShrink:0, textAlign:'center',
                              padding:'4px 2px', borderRight:'1px solid #F1F5F9',
                              backgroundColor: isT ? '#FFFBEB' : wknd ? '#F8FAFC' : '#fff' }}>
                              <div style={{ fontSize:9, color: isT ? '#92400E' : wknd ? '#CBD5E1' : '#94A3B8' }}>
                                {dowLabel(day)}
                              </div>
                              <div style={{
                                fontSize:11, fontWeight: isT ? 800 : 600,
                                color: isT ? '#92400E' : wknd ? '#CBD5E1' : '#1E293B',
                              }}>{day}</div>
                            </div>
                          );
                        })}
                      </div>
                      {MACHINES.map((machine, mi) => (
                        <div key={machine.id} style={{ display:'flex', borderBottom:'1px solid #F1F5F9',
                          backgroundColor: mi % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                          <div style={{ width:nameW, minWidth:nameW, flexShrink:0, minHeight:40,
                            display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
                            position:'sticky', left:0, zIndex:2, borderRight:'1px solid #E5E7EB',
                            backgroundColor: mi % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                            <span style={{ fontSize:9, fontWeight:800, color:'#64748B', backgroundColor:'#F1F5F9',
                              padding:'2px 5px', borderRadius:4, flexShrink:0 }}>{machine.short}</span>
                            <span style={{ fontSize:11, fontWeight:500, color:'#1E293B',
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {machine.name}
                            </span>
                            <ImportanceDot importance={machine.importance} />
                          </div>
                          {Array.from({ length: DAYS }, (_, i) => i + 1).map((day) => {
                            const wknd = isWeekend(day);
                            const isT = day === TODAY;
                            const machineDayChanged =
                              !wknd &&
                              EMPLOYEES.some((emp) => {
                                const key = `${emp.id}-${day}`;
                                const cur = assignments[key];
                                const prp = proposed[key];
                                if (!assignmentDiffers(cur, prp)) return false;
                                const onMachine = (a) =>
                                  a?.type === 'work' &&
                                  workAssignmentSegments(a).some((s) => s.machine === machine.id);
                                return onMachine(cur) || onMachine(prp);
                              });
                            const shiftLines = SHIFTS.filter(
                              (sh) =>
                                !isWeeklyMachineShiftClosed(closedByWeek, y, m0, day, machine.id, sh.id),
                            ).map((sh) => {
                              const emps = EMPLOYEES.filter((emp) => {
                                const a = proposed[`${emp.id}-${day}`];
                                return employeeWorksMachineShift(a, machine.id, sh.id);
                              });
                              const initialsBlocks = emps.map((e) => {
                                const a = proposed[`${e.id}-${day}`];
                                const seg = workAssignmentSegments(a).find(
                                  (s) => s.machine === machine.id && s.shift === sh.id,
                                );
                                const tr = segmentIsTraining(
                                  seg ?? { shift: sh.id, machine: machine.id },
                                  e,
                                );
                                const fullName = `${e.prenom ?? ''} ${e.nom ?? ''}`.trim();
                                const hoverTitle = tr
                                  ? `${fullName} · Formation`
                                  : fullName;
                                return (
                                  <span
                                    key={e.id}
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
                                      backgroundColor: e.groupColor,
                                      color: e.groupText,
                                      whiteSpace: 'nowrap',
                                      boxSizing: 'border-box',
                                      borderBottom: tr ? '1px solid #7C3AED' : undefined,
                                    }}
                                    onMouseEnter={(ev) => {
                                      if (!hoverTitle) return;
                                      setSolverEmpHoverTip({
                                        text: hoverTitle,
                                        ...placeSolverEmpTip(ev.clientX, ev.clientY),
                                      });
                                    }}
                                    onMouseMove={(ev) => {
                                      setSolverEmpHoverTip((prev) => {
                                        if (!prev) return null;
                                        return {
                                          text: prev.text,
                                          ...placeSolverEmpTip(ev.clientX, ev.clientY),
                                        };
                                      });
                                    }}
                                    onMouseLeave={() => setSolverEmpHoverTip(null)}
                                  >
                                    <span>
                                      {e.prenom[0] ?? ''}{e.nom[0] ?? ''}
                                    </span>
                                  </span>
                                );
                              });
                              return { sh, initialsBlocks };
                            });
                            return (
                              <div key={day} style={{ width:cellW, minWidth:cellW, minHeight:40,
                                flexShrink:0, padding:2, borderRight:'1px solid #F1F5F9',
                                verticalAlign:'top' }}>
                                <div style={{
                                  width:'100%', minHeight:'100%', borderRadius:2, boxSizing:'border-box',
                                  display:'flex', flexDirection:'column', justifyContent:'center', gap:2,
                                  padding:'3px 2px', position:'relative',
                                  backgroundColor: wknd ? '#F8FAFC' : '#fff',
                                  outline: isT ? '2px solid #F59E0B' : 'none', outlineOffset:-2,
                                }}>
                                  {wknd ? (
                                    <span style={{ fontSize:8, color:'#CBD5E1', alignSelf:'center' }}>—</span>
                                  ) : shiftLines.length === 0 ? (
                                    <span style={{ fontSize:8, color:'#CBD5E1', alignSelf:'center' }}>—</span>
                                  ) : (
                                    shiftLines.map(({ sh, initialsBlocks }) => (
                                      <div key={sh.id} style={{
                                        display:'flex', alignItems:'center', gap:3, flexWrap:'wrap',
                                        lineHeight:1.15,
                                      }}>
                                        <span style={{
                                          fontSize:7, fontWeight:800, padding:'0 3px', borderRadius:2,
                                          backgroundColor: sh.chipBg, color: sh.chipText, flexShrink:0,
                                        }}>{sh.short}</span>
                                        <span style={{
                                          fontSize:8, fontWeight:600, color: initialsBlocks.length ? '#334155' : '#94A3B8',
                                          display:'flex', flexWrap:'wrap', gap:4, alignItems:'baseline',
                                        }}>{initialsBlocks.length ? initialsBlocks : '—'}</span>
                                      </div>
                                    ))
                                  )}
                                  {machineDayChanged && (
                                    <div style={{
                                      position:'absolute', top:2, right:2, width:4, height:4,
                                      borderRadius:'50%', backgroundColor:'#3B82F6',
                                      boxShadow:'0 0 0 1px rgba(255,255,255,0.95)',
                                    }} />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── TAB: Machine coverage ──────────────────────────────── */}
              {previewTab === 'machines' && (() => {
                const { MACHINES, EMPLOYEES, SHIFTS, DAYS, isWeekend } = PLANNING_DATA;
                const y = PLANNING_DATA.YEAR;
                const m0 = PLANNING_DATA.MONTH_IDX;
                return (
                  <div style={{ flex:1, overflowY:'auto', padding:20 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      {MACHINES.map(machine => {
                        let covered = 0;
                        let total = 0;
                        for (let day = 1; day <= DAYS; day++) {
                          if (isWeekend(day)) continue;
                          SHIFTS.forEach((sh) => {
                            if (isWeeklyMachineShiftClosed(closedByWeek, y, m0, day, machine.id, sh.id)) {
                              return;
                            }
                            total += 1;
                            const emps = EMPLOYEES.filter((emp) => {
                              const a = proposed[`${emp.id}-${day}`];
                              return employeeWorksMachineShift(a, machine.id, sh.id);
                            });
                            if (emps.length > 0) covered += 1;
                          });
                        }
                        const pct = total === 0 ? 100 : Math.round((covered / total) * 100);
                        const statusColor = pct>=90?'#16A34A':pct>=70?'#D97706':'#DC2626';
                        return (
                          <div key={machine.id} style={{ padding:'14px 16px', border:'1px solid #E5E7EB',
                            borderRadius:10, backgroundColor:'#fff' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                              <span style={{ fontSize:10, fontWeight:700, color:'#64748B', backgroundColor:'#F1F5F9',
                                padding:'2px 6px', borderRadius:4 }}>{machine.short}</span>
                              <span style={{ fontSize:13, fontWeight:600, color:'#1E293B', flex:1 }}>{machine.name}</span>
                              <ImportanceDot importance={machine.importance} />
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ flex:1, backgroundColor:'#F1F5F9', borderRadius:4, height:6, overflow:'hidden' }}>
                                <div style={{ height:'100%', borderRadius:4, backgroundColor:statusColor,
                                  width:`${pct}%`, transition:'width 0.3s' }} />
                              </div>
                              <span style={{ fontSize:13, fontWeight:700, color:statusColor, minWidth:36, textAlign:'right' }}>
                                {pct}%
                              </span>
                            </div>
                            <div style={{ marginTop:8, display:'flex', gap:6 }}>
                              {SHIFTS.map(sh => {
                                const openDays = Array.from({ length: DAYS }, (_, i) => i + 1).filter(
                                  (day) =>
                                    !isWeekend(day) &&
                                    !isWeeklyMachineShiftClosed(closedByWeek, y, m0, day, machine.id, sh.id),
                                ).length;
                                const daysCovered = Array.from({ length: DAYS }, (_, i) => i + 1).filter(
                                  (day) =>
                                    !isWeekend(day) &&
                                    !isWeeklyMachineShiftClosed(closedByWeek, y, m0, day, machine.id, sh.id) &&
                                    EMPLOYEES.some((emp) => {
                                      const a = proposed[`${emp.id}-${day}`];
                                      return employeeWorksMachineShift(a, machine.id, sh.id);
                                    }),
                                ).length;
                                return (
                                  <div key={sh.id} style={{ flex:1, padding:'5px 8px', borderRadius:6,
                                    backgroundColor:sh.cellBg, textAlign:'center' }}>
                                    <div style={{ fontSize:9, fontWeight:700, color:sh.chipBg }}>{sh.short}</div>
                                    <div style={{ fontSize:12, fontWeight:700, color:sh.cellText }}>{daysCovered}</div>
                                    <div style={{ fontSize:9, color:sh.cellText+'99' }}>/{openDays}j</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── TAB: Changements (diff table) ─────────────────────── */}
              {previewTab === 'changements' && (
                <div style={{ flex:1, overflow:'auto', padding:'16px 20px 20px', minHeight:0 }}>
                  {changeRows.length === 0 ? (
                    <div style={{ textAlign:'center', padding:48, color:'#94A3B8', fontSize:13 }}>
                      Aucune différence entre le planning actuel et la proposition.
                    </div>
                  ) : (
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 12,
                        backgroundColor: '#fff',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                            backgroundColor: '#F8FAFC',
                            borderBottom: '2px solid #E5E7EB',
                          }}
                        >
                          <th
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              fontWeight: 700,
                              color: '#64748B',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Jour
                          </th>
                          <th
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              fontWeight: 700,
                              color: '#64748B',
                            }}
                          >
                            Employé
                          </th>
                          <th
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              fontWeight: 700,
                              color: '#64748B',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Avant
                          </th>
                          <th
                            title="Au moins un poste en formation (polyvalence)"
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              fontWeight: 700,
                              color: '#64748B',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Form. avant
                          </th>
                          <th
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              fontWeight: 700,
                              color: '#64748B',
                            }}
                          >
                            Après
                          </th>
                          <th
                            title="Au moins un poste en formation (polyvalence)"
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              fontWeight: 700,
                              color: '#64748B',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Form. après
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {changeRows.map((row, i) => (
                          <tr
                            key={row.key}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: i % 2 === 0 ? '#fff' : '#FAFBFC',
                            }}
                          >
                            <td
                              title={row.iso}
                              style={{
                                padding: '9px 12px',
                                verticalAlign: 'top',
                                whiteSpace: 'nowrap',
                                color: '#334155',
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>{row.day}</span>
                              <span style={{ color: '#94A3B8', marginLeft: 6 }}>{row.dow}</span>
                              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                                {row.iso}
                              </div>
                            </td>
                            <td
                              style={{
                                padding: '9px 12px',
                                verticalAlign: 'top',
                                color: '#0F172A',
                                fontWeight: 500,
                              }}
                            >
                              {row.empLabel}
                            </td>
                            <td style={{ padding: '9px 12px', verticalAlign: 'top', color: '#64748B' }}>
                              {row.before}
                            </td>
                            <td
                              style={{
                                padding: '9px 12px',
                                verticalAlign: 'top',
                                color: row.formationBefore === '—' ? '#94A3B8' : '#7C3AED',
                                fontWeight: row.formationBefore === '—' ? 500 : 600,
                              }}
                            >
                              {row.formationBefore}
                            </td>
                            <td
                              style={{
                                padding: '9px 12px',
                                verticalAlign: 'top',
                                color: '#059669',
                                fontWeight: 600,
                              }}
                            >
                              {row.after}
                            </td>
                            <td
                              style={{
                                padding: '9px 12px',
                                verticalAlign: 'top',
                                color: row.formationAfter === '—' ? '#94A3B8' : '#7C3AED',
                                fontWeight: row.formationAfter === '—' ? 500 : 600,
                              }}
                            >
                              {row.formationAfter}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── TAB: Warnings ─────────────────────────────────────── */}
              {previewTab === 'warnings' && (
                <div style={{ flex:1, overflowY:'auto', padding:20,
                  display:'flex', flexDirection:'column', gap:8 }}>
                  {warnings.map((w,i) => (
                    <div key={i} style={{ display:'flex', gap:12, padding:'12px 16px',
                      borderRadius:10, border:'1px solid',
                      borderColor: w.type==='warn' ? '#FCD34D' : '#BAE6FD',
                      backgroundColor: w.type==='warn' ? '#FFFBEB' : '#F0F9FF' }}>
                      <span style={{ fontSize:18, flexShrink:0, lineHeight:1.3 }}>
                        {w.type==='warn' ? '⚠' : 'ℹ'}
                      </span>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500,
                          color: w.type==='warn' ? '#92400E' : '#075985' }}>{w.msg}</div>
                        {w.day && <div style={{ fontSize:11, color:'#94A3B8', marginTop:3 }}>
                          Jour {w.day} · {PLANNING_DATA.MONTH_LABEL}
                        </div>}
                      </div>
                    </div>
                  ))}
                  {warnings.length === 0 && (
                    <div style={{ textAlign:'center', padding:48, color:'#94A3B8', fontSize:13 }}>
                      Aucun avertissement — planning optimal.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'14px 24px', borderTop:'1px solid #E5E7EB', flexShrink:0,
              display:'flex', justifyContent:'space-between', alignItems:'center',
              backgroundColor:'#fff' }}>
              <button onClick={() => { setStep('form'); setProg(0); setAutoResult(null); }} style={{
                padding:'10px 16px', borderRadius:8, border:'1px solid #E5E7EB',
                background:'#fff', cursor:'pointer', fontSize:13, fontWeight:500, color:'#374151' }}>
                ← Relancer
              </button>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:11, color:'#94A3B8' }}>
                  {changes} modifications · {warnings.filter(w=>w.type==='warn').length} avertissements
                </span>
                <button onClick={onClose} style={{ padding:'10px 16px', borderRadius:8,
                  border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer',
                  fontSize:13, color:'#374151' }}>Annuler</button>
                <button style={{ ...btnP, opacity: saving ? 0.75 : 1 }} disabled={saving} onClick={approvePlanning}>
                  {saving ? '…' : 'Approuver et enregistrer'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    {solverEmpTipPortal}
    </>
  );
}

// ── Machine cell detail modal (éditable) ──────────────────────────────────
export function MachineCellDetail({ machineId, day, onClose, theme }: { machineId: string; day: number; onClose: () => void; theme: ThemeTokens }) {
  const {
    refetchPlanning,
    workAssignmentByCell,
    weeklyStatusRowByCell,
    ...PLANNING_DATA
  } = usePlanningFull();
  const { MACHINES, EMPLOYEES, SHIFTS, assignments } = PLANNING_DATA;
  const skillsByEmpId = useEmployeeSkillsStore((s) => s.skillsByEmpId);
  const machine = MACHINES.find(m => m.id === machineId);
  const DOW_FR  = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const dow     = DOW_FR[(PLANNING_DATA.MAY_1_DOW + day - 1) % 7];

  const buildShiftMap = () => {
    const s = {};
    SHIFTS.forEach(sh => { s[sh.id] = []; });
    EMPLOYEES.forEach(emp => {
      const a = assignments[`${emp.id}-${day}`];
      if (a?.type !== 'work') return;
      workAssignmentSegments(a).forEach((seg) => {
        if (seg.machine !== machineId) return;
        s[seg.shift]?.push(emp);
      });
    });
    return s;
  };

  const snapshotRef = useRef(null);
  const [byShift, setByShift] = useState(() => {
    const initial = buildShiftMap();
    snapshotRef.current = initial;
    return initial;
  });
  const [addingShift, setAddingShift] = useState(null);
  const [addSearch,   setAddSearch]   = useState('');
  const [changed,     setChanged]     = useState(false);
  const [saving, setSaving] = useState(false);

  const snapShiftFor = (map, empId) => {
    for (const sh of SHIFTS) {
      if (map[sh.id]?.some(e => e.id === empId)) return sh.id;
    }
    return null;
  };

  const handleSave = async () => {
    const snap = snapshotRef.current;
    const empIds = new Set();
    SHIFTS.forEach(sh => {
      snap[sh.id]?.forEach(e => empIds.add(e.id));
      byShift[sh.id]?.forEach(e => empIds.add(e.id));
    });
    setSaving(true);
    try {
      const dd = isoDateFromBundleDay(PLANNING_DATA, day);
      for (const eid of empIds) {
        const ss = snapShiftFor(snap, eid);
        const es = snapShiftFor(byShift, eid);
        const meta = workAssignmentByCell[`${eid}-${day}`];
        const stMeta = weeklyStatusRowByCell[`${eid}-${day}`];

        if (es && stMeta?.id) {
          await planningFetch(`/luxlait_weekly_employee_statuses/${stMeta.id}`, { method: 'DELETE' });
        }

        if (!ss && es) {
          await planningFetch('/luxlait_daily_assignments/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rows: [
                {
                  day_date: dd,
                  employee_id: eid,
                  machine_id: machineId,
                  time_slot_id: es,
                },
              ],
            }),
          });
        } else if (ss && !es) {
          if (meta?.id) {
            await planningFetch(`/luxlait_daily_assignments/${meta.id}`, { method: 'DELETE' });
          }
        } else if (ss && es && ss !== es) {
          if (meta?.id) {
            await planningFetch(`/luxlait_daily_assignments/${meta.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                machine_id: machineId,
                time_slot_id: es,
              }),
            });
          } else {
            await planningFetch('/luxlait_daily_assignments/upsert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rows: [
                  {
                    day_date: dd,
                    employee_id: eid,
                    machine_id: machineId,
                    time_slot_id: es,
                  },
                ],
              }),
            });
          }
        }
      }
      await refetchPlanning();
      onClose();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const totalOps = Object.values(byShift).reduce((s,arr)=>s+arr.length, 0);

  // Remove an employee from a shift
  const remove = (shiftId, empId) => {
    setByShift(prev => ({ ...prev, [shiftId]: prev[shiftId].filter(e=>e.id!==empId) }));
    setChanged(true);
  };

  // Add an employee to a shift
  const add = (shiftId, emp) => {
    setByShift(prev => {
      // Remove from other shifts on same machine first
      const next = {};
      SHIFTS.forEach(sh => { next[sh.id] = prev[sh.id].filter(e=>e.id!==emp.id); });
      next[shiftId] = [...next[shiftId], emp];
      return next;
    });
    setChanged(true);
    setAddingShift(null);
    setAddSearch('');
  };

  // Available to add: qualified + not already on this machine this day
  const available = (shiftId) => {
    const alreadyOnMachine = Object.values(byShift).flat().map(e=>e.id);
    return EMPLOYEES.filter(e => {
      if (alreadyOnMachine.includes(e.id)) return false;
      if (!hasEmpSkill(skillsByEmpId, e.id, machineId)) return false;
      const name = `${e.prenom} ${e.nom}`.toLowerCase();
      if (addSearch && !name.includes(addSearch.toLowerCase())) return false;
      return true;
    });
  };

  const overlay = { position:'fixed', inset:0, backgroundColor:'rgba(15,23,42,0.4)', zIndex:1000,
    display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' };
  const modal   = { background:'#fff', borderRadius:12, width:460, maxHeight:'86vh',
    boxShadow:'0 20px 56px rgba(0,0,0,0.2)', overflow:'hidden',
    fontFamily:'IBM Plex Sans, sans-serif', display:'flex', flexDirection:'column' };
  const btnP = { padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer',
    backgroundColor:theme.primaryBtn, color:'#fff', fontSize:13, fontWeight:600 };
  const btnS = { padding:'7px 14px', borderRadius:8, border:'1px solid #E5E7EB',
    cursor:'pointer', background:'#fff', fontSize:12, color:'#374151' };

  return (
    <div style={overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={modal}>

        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E5E7EB',
          display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ width:40, height:40, borderRadius:10, flexShrink:0,
            backgroundColor: machine?.importance==='MANDATORY'?'#FEF2F2':machine?.importance==='PRIORITY'?'#FFFBEB':'#F8FAFC',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:13, fontWeight:800,
              color: machine?.importance==='MANDATORY'?'#EF4444':machine?.importance==='PRIORITY'?'#F59E0B':'#94A3B8' }}>
              {machine?.short}
            </span>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#0F172A' }}>{machine?.name}</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>
              {dow} {day} {PLANNING_DATA.MONTH_LABEL} · {totalOps} opérateur{totalOps!==1?'s':''} · max {machine?.maxEmp}/shift
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
            fontSize:18, color:'#94A3B8', padding:4, lineHeight:1 }}>✕</button>
        </div>

        {/* Shift sections */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 16px',
          display:'flex', flexDirection:'column', gap:10 }}>
          {SHIFTS.map(sh => {
            const emps  = byShift[sh.id] || [];
            const over  = emps.length > (machine?.maxEmp || 2);
            const avail = available(sh.id);
            const isAdding = addingShift === sh.id;

            return (
              <div key={sh.id} style={{ border:`1px solid ${over?'#FECACA':'#F1F5F9'}`,
                borderRadius:10, overflow:'hidden' }}>

                {/* Shift header */}
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                  backgroundColor: over ? '#FEF2F2' : sh.cellBg }}>
                  <ShiftChip shiftId={sh.id} size="lg" />
                  <span style={{ fontSize:13, fontWeight:600, color:'#1E293B', flex:1 }}>{sh.label}</span>
                  <span style={{ fontSize:11, fontWeight:700, padding:'1px 8px', borderRadius:10,
                    backgroundColor: emps.length===0?'#F1F5F9': over?'#FEE2E2': emps.length>=machine?.maxEmp?'#DCFCE7':'#FFFBEB',
                    color: emps.length===0?'#94A3B8': over?'#991B1B': emps.length>=machine?.maxEmp?'#166534':'#92400E' }}>
                    {emps.length}/{machine?.maxEmp}
                  </span>
                  {over && <span style={{ fontSize:10, fontWeight:700, color:'#EF4444' }}>⚠ Surcharge</span>}
                </div>

                {/* Employee rows */}
                <div style={{ maxHeight:140, overflowY:'auto' }}>
                  {emps.length === 0 ? (
                    <div style={{ padding:'8px 12px', fontSize:12, color:'#94A3B8', fontStyle:'italic' }}>
                      Aucun opérateur affecté
                    </div>
                  ) : emps.map((emp, i) => (
                    <div key={emp.id} style={{ display:'flex', alignItems:'center', gap:8,
                      padding:'5px 12px', borderTop: i>0?'1px solid #F8FAFC':'none', backgroundColor:'#fff' }}>
                      <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0,
                        backgroundColor:emp.groupColor, display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:8, fontWeight:700, color:emp.groupText }}>
                        {emp.prenom[0]}{emp.nom[0]}
                      </div>
                      <span style={{ fontSize:12, fontWeight:500, color:'#1E293B', flex:1 }}>
                        {emp.prenom} {emp.nom}
                      </span>
                      {emp.skillLevels?.[machineId] === 'IN_TRAINING' && (
                        <span
                          title="Affectation en formation sur cette machine"
                          style={{
                            fontSize:9,
                            fontWeight:800,
                            color:'#7C3AED',
                            backgroundColor:'#F5F3FF',
                            padding:'1px 5px',
                            borderRadius:4,
                          }}
                        >
                          F
                        </span>
                      )}
                      <span style={{ fontSize:10, color:emp.groupText, fontWeight:600 }}>{emp.groupLabel}</span>
                      {emp.backup && <span style={{ fontSize:8, fontWeight:700, color:'#92400E',
                        backgroundColor:'#FEF3C7', padding:'1px 4px', borderRadius:3 }}>BACKUP</span>}
                      {/* Remove button */}
                      <button onClick={() => remove(sh.id, emp.id)} title="Retirer ce shift"
                        style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 4px',
                          color:'#CBD5E1', fontSize:13, lineHeight:1, borderRadius:4 }}
                        onMouseEnter={e=>e.currentTarget.style.color='#EF4444'}
                        onMouseLeave={e=>e.currentTarget.style.color='#CBD5E1'}>✕</button>
                    </div>
                  ))}
                </div>

                {/* Add section */}
                {!isAdding ? (
                  <button onClick={() => { setAddingShift(sh.id); setAddSearch(''); }}
                    style={{ width:'100%', padding:'6px 12px', border:'none', cursor:'pointer',
                      backgroundColor:'#F8FAFC', borderTop:'1px solid #F1F5F9',
                      fontSize:11, fontWeight:600, color:theme.primaryBtn,
                      display:'flex', alignItems:'center', gap:5, justifyContent:'center' }}>
                    <span style={{ fontSize:14, lineHeight:1 }}>+</span>
                    Ajouter un opérateur
                    {avail.length > 0 && <span style={{ fontSize:9, backgroundColor:theme.primaryBtn,
                      color:'#fff', borderRadius:8, padding:'0 4px' }}>{avail.length}</span>}
                  </button>
                ) : (
                  <div style={{ borderTop:'1px solid #F1F5F9', backgroundColor:'#F8FAFC', padding:10 }}>
                    <div style={{ position:'relative', marginBottom:6 }}>
                      <input autoFocus value={addSearch}
                        onChange={e=>setAddSearch(e.target.value)}
                        placeholder="Filtrer par nom…"
                        style={{ width:'100%', padding:'5px 10px', border:'1px solid #E5E7EB',
                          borderRadius:7, fontSize:12, outline:'none',
                          fontFamily:'IBM Plex Sans, sans-serif' }} />
                    </div>
                    <div style={{ maxHeight:120, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
                      {avail.length === 0 ? (
                        <div style={{ fontSize:11, color:'#94A3B8', fontStyle:'italic', padding:'4px 2px' }}>
                          Aucun employé qualifié disponible
                        </div>
                      ) : avail.map(emp => (
                        <div key={emp.id} onClick={() => add(sh.id, emp)}
                          style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px',
                            borderRadius:7, cursor:'pointer', backgroundColor:'#fff',
                            border:'1px solid #E5E7EB' }}
                          onMouseEnter={e=>e.currentTarget.style.backgroundColor='#F0F7FF'}
                          onMouseLeave={e=>e.currentTarget.style.backgroundColor='#fff'}>
                          <div style={{ width:20, height:20, borderRadius:'50%', flexShrink:0,
                            backgroundColor:emp.groupColor, display:'flex', alignItems:'center',
                            justifyContent:'center', fontSize:7, fontWeight:700, color:emp.groupText }}>
                            {emp.prenom[0]}{emp.nom[0]}
                          </div>
                          <span style={{ fontSize:12, fontWeight:500, color:'#1E293B', flex:1 }}>
                            {emp.prenom} {emp.nom}
                          </span>
                          <span style={{ fontSize:10, color:emp.groupText }}>{emp.groupLabel}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setAddingShift(null)}
                      style={{ marginTop:6, background:'none', border:'none', cursor:'pointer',
                        fontSize:11, color:'#94A3B8', padding:0 }}>Annuler</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid #E5E7EB', flexShrink:0,
          display:'flex', justifyContent:'space-between', alignItems:'center',
          backgroundColor:'#fff' }}>
          <span style={{ fontSize:11, color: changed?'#F59E0B':'#94A3B8', fontWeight:500 }}>
            {changed ? 'Modifications non enregistrées' : `${totalOps} opérateur${totalOps!==1?'s':''} au total`}
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <button style={btnS} onClick={onClose} disabled={saving}>Fermer</button>
            {changed && (
              <button style={{ ...btnP, opacity: saving ? 0.7 : 1 }} disabled={saving} onClick={handleSave}>
                {saving ? '…' : 'Enregistrer'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
