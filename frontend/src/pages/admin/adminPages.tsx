// @ts-nocheck
// planning-admin — Pages Employés, Machines, Compétences (port handoff)

import type { ReactNode } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { usePlanningData, usePlanningFull } from '@/context/PlanningDataContext';
import type { ThemeTokens } from '@/data/themes';
import { ImportanceDot, ShiftChip } from '@/features/planning/components/atoms';
import { skillIdsForEmp, useEmployeeSkillsStore } from '@/stores/employeeSkillsStore';
import { planningFetch, planningJson } from '@/lib/planningApi';
import {
  buildClosedMapFromApi,
  closedKey,
  isoWeekNumberForDate,
  uiIndexToJsWeekday,
  type ApiWeeklyMachineClosedShiftRow,
} from '@/lib/machineWeeklyClosures';
import { bundleDayFromIso, isoDateFromBundleDay } from '@/lib/planningDates';
import { planningStatusCellStyle, planningStatusShort } from '@/lib/planningStatusShort';

type PageProps = { t: ThemeTokens };

// ── Shared page shell ──────────────────────────────────────────────────────
export const PageShell = ({
  t,
  title,
  subtitle,
  action,
  children,
}: {
  t: ThemeTokens;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden',
    backgroundColor:t.bodyBg, fontFamily:'IBM Plex Sans, sans-serif' }}>
    {/* Page header */}
    <div style={{ padding:'20px 28px 16px', backgroundColor:t.headerBg,
      borderBottom:`1px solid ${t.border}`, flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#0F172A', margin:0, lineHeight:1 }}>{title}</h1>
          {subtitle && <p style={{ fontSize:13, color:'#64748B', margin:'4px 0 0' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
    {/* Scrollable body */}
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>{children}</div>
  </div>
);

export const PrimaryBtn = ({
  t,
  children,
  onClick,
}: {
  t: ThemeTokens;
  children: ReactNode;
  onClick?: () => void;
}) => (
  <button onClick={onClick} style={{ padding:'8px 18px', borderRadius:8, border:'none',
    cursor:'pointer', backgroundColor:t.primaryBtn, color:t.primaryBtnText,
    fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
    {children}
  </button>
);

export const SecondaryBtn = ({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) => (
  <button onClick={onClick} style={{ padding:'7px 14px', borderRadius:8,
    border:'1px solid #E5E7EB', cursor:'pointer', backgroundColor:'#fff',
    fontSize:12, fontWeight:500, color:'#374151' }}>
    {children}
  </button>
);

// ── Avatar ─────────────────────────────────────────────────────────────────
const Av = ({
  emp,
  size = 32,
  backup = false,
}: {
  emp: { prenom: string; nom: string };
  size?: number;
  backup?: boolean;
}) => (
  <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0,
    backgroundColor: backup ? '#FEF3C7' : '#DBEAFE',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize: Math.floor(size*0.36), fontWeight:700,
    color: backup ? '#92400E' : '#1E40AF' }}>
    {emp.prenom[0]}{emp.nom[0]}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// PAGE EMPLOYÉS
// ═══════════════════════════════════════════════════════════════════════════
export function PageEmployes({ t }: PageProps) {
  const PLANNING_DATA = usePlanningData();
  const { EMPLOYEES, MACHINES, GROUPS, assignments, DAYS, isWeekend, MONTH_LABEL } = PLANNING_DATA;
  const [search,   setSearch]  = useState('');
  const [group,    setGroup]   = useState('');
  const [page,     setPage]    = useState(0);
  const [selected, setSelected]= useState(null);
  const skillsByEmpId = useEmployeeSkillsStore((s) => s.skillsByEmpId);
  const toggleEmpMachine = useEmployeeSkillsStore((s) => s.toggleEmpMachine);
  const [editSkills, setEditSkills] = useState(false);
  const PER_PAGE = 20;

  const skillIdsForEmpLocal = (empId) => skillIdsForEmp(skillsByEmpId, empId);
  const skillCount = (empId) => skillIdsForEmpLocal(empId).size;

  const filtered = EMPLOYEES.filter(e => {
    if (group && e.group !== group) return false;
    if (search && !`${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  useEffect(() => {
    setEditSkills(false);
  }, [selected]);

  // Count shifts for each employee in the month
  const shiftCount = emp => {
    let n = 0;
    for (let d=1; d<=DAYS; d++) {
      if (isWeekend(d)) continue;
      const a = assignments[`${emp.id}-${d}`];
      if (a?.type === 'work') n++;
    }
    return n;
  };

  const workdays = Array.from({length:DAYS},(_,i)=>i+1).filter(d=>!isWeekend(d)).length;

  const sel = selected ? EMPLOYEES.find(e=>e.id===selected) : null;

  return (
    <PageShell t={t} title="Employés"
      subtitle={`${filtered.length} / ${EMPLOYEES.length} employés · ${MONTH_LABEL}`}
      action={<PrimaryBtn t={t}>+ Ajouter un employé</PrimaryBtn>}>

      <div
        style={{
          display: 'flex',
          gap: 20,
          alignItems: 'stretch',
          minHeight: 0,
          maxHeight: 'calc(100dvh - 168px)',
        }}
      >

        {/* Left: list */}
        <div
          style={{
            flex: '0 0 440px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
              fontSize:14, color:'#94A3B8', pointerEvents:'none' }}>⌕</span>
            <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(0); }}
              placeholder="Rechercher un employé…"
              style={{ width:'100%', padding:'7px 12px 7px 30px', border:'1px solid #E5E7EB',
                borderRadius:8, fontSize:13, outline:'none', fontFamily:'IBM Plex Sans, sans-serif',
                color:'#1E293B', backgroundColor:'#fff' }} />
          </div>

          {/* Group filter chips */}
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', flexShrink:0 }}>
            <button onClick={()=>{setGroup('');setPage(0);}} style={{
              padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500,
              cursor:'pointer', border:`1.5px solid ${!group?'#64748B':'#E5E7EB'}`,
              backgroundColor:!group?'#F1F5F9':'#fff', color:!group?'#1E293B':'#64748B' }}>
              Tous ({EMPLOYEES.length})
            </button>
            {GROUPS.map(g => {
              const cnt = EMPLOYEES.filter(e=>e.group===g.id).length;
              const act = group===g.id;
              return (
                <button key={g.id} onClick={()=>{setGroup(act?'':g.id);setPage(0);}} style={{
                  padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500,
                  cursor:'pointer', border:`1.5px solid ${act?g.textColor:'#E5E7EB'}`,
                  backgroundColor:act?g.color:'#fff', color:act?g.textColor:'#64748B' }}>
                  {g.label} ({cnt})
                </button>
              );
            })}
          </div>

          {/* Employee cards — paginated (scroll interne) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              paddingRight: 4,
            }}
          >
            {paginated.map(emp => {
              const sc   = shiftCount(emp);
              const pct  = Math.round(sc/workdays*100);
              const isS  = selected === emp.id;
              return (
                <div key={emp.id} onClick={() => setSelected(isS ? null : emp.id)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                    borderRadius:10, cursor:'pointer',
                    border:`2px solid ${isS ? t.primaryBtn : '#E5E7EB'}`,
                    backgroundColor: isS ? '#F0F7FF' : '#fff',
                    transition:'all 0.1s' }}>
                  <Av emp={emp} backup={emp.backup} size={36} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:14, fontWeight:600, color:'#1E293B' }}>
                        {emp.prenom} {emp.nom}
                      </span>
                      {emp.backup && <span style={{ fontSize:9, fontWeight:700, color:'#92400E',
                        backgroundColor:'#FEF3C7', padding:'1px 5px', borderRadius:4 }}>BACKUP</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                      <div style={{ flex:1, backgroundColor:'#F1F5F9', borderRadius:3, height:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:3, backgroundColor: pct>=90?'#22C55E':pct>=70?'#F59E0B':'#94A3B8',
                          width:`${pct}%` }} />
                      </div>
                      <span style={{ fontSize:11, color:'#64748B', flexShrink:0 }}>{sc}/{workdays} j</span>
                    </div>
                  </div>
                  {/* Skills pills */}
                  <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                    {MACHINES.filter((mm) => skillIdsForEmpLocal(emp.id).has(mm.id))
                      .slice(0, 3)
                      .map((mm) => (
                        <span
                          key={mm.id}
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#64748B',
                            backgroundColor: '#F1F5F9',
                            padding: '2px 5px',
                            borderRadius: 4,
                          }}
                        >
                          {mm.short}
                        </span>
                      ))}
                    {skillCount(emp.id) > 3 && (
                      <span style={{ fontSize: 9, color: '#94A3B8' }}>
                        +{skillCount(emp.id) - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'8px 0', borderTop:'1px solid #F1F5F9', marginTop:4, flexShrink:0 }}>
              <span style={{ fontSize:11, color:'#94A3B8' }}>
                {page*PER_PAGE+1}–{Math.min((page+1)*PER_PAGE,filtered.length)} sur {filtered.length}
              </span>
              <div style={{ display:'flex', gap:4 }}>
                <button disabled={page===0} onClick={()=>setPage(p=>p-1)} style={{
                  padding:'4px 10px', borderRadius:6, border:'1px solid #E5E7EB',
                  cursor:page===0?'default':'pointer', backgroundColor:'#fff',
                  fontSize:12, color:page===0?'#CBD5E1':'#374151' }}>←</button>
                {Array.from({length:totalPages},(_,i)=>i).map(i => (
                  <button key={i} onClick={()=>setPage(i)} style={{
                    padding:'4px 9px', borderRadius:6, border:'1px solid',
                    borderColor: i===page ? t.primaryBtn : '#E5E7EB',
                    cursor:'pointer', fontSize:12, fontWeight: i===page?700:400,
                    backgroundColor: i===page ? t.primaryBtn : '#fff',
                    color: i===page ? '#fff' : '#374151' }}>{i+1}</button>
                ))}
                <button disabled={page===totalPages-1} onClick={()=>setPage(p=>p+1)} style={{
                  padding:'4px 10px', borderRadius:6, border:'1px solid #E5E7EB',
                  cursor:page===totalPages-1?'default':'pointer', backgroundColor:'#fff',
                  fontSize:12, color:page===totalPages-1?'#CBD5E1':'#374151' }}>→</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        {sel ? (
          <div style={{ flex:1, minHeight:0, overflowY:'auto', backgroundColor:'#fff', borderRadius:12,
            border:'1px solid #E5E7EB', padding:24, display:'flex',
            flexDirection:'column', gap:20 }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <Av emp={sel} backup={sel.backup} size={52} />
              <div>
                <div style={{ fontSize:20, fontWeight:700, color:'#0F172A' }}>
                  {sel.prenom} {sel.nom}
                </div>
                <div style={{ display:'flex', gap:6, marginTop:4 }}>
                  {sel.backup && <span style={{ fontSize:10, fontWeight:700, color:'#92400E',
                    backgroundColor:'#FEF3C7', padding:'2px 7px', borderRadius:5 }}>BACKUP</span>}
                  <span style={{ fontSize:11, color:'#64748B' }}>
                    {skillCount(sel.id)} compétence{skillCount(sel.id) > 1 ? 's' : ''} · {shiftCount(sel)} shifts ce mois
                  </span>
                </div>
              </div>
              <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
                {editSkills && (
                  <span style={{ fontSize:11, color:'#64748B', maxWidth:220, textAlign:'right' }}>
                    Cliquez une ligne pour activer ou retirer une machine
                  </span>
                )}
                <SecondaryBtn
                  onClick={() => {
                    setEditSkills((v) => !v);
                  }}
                >
                  {editSkills ? 'Terminer' : 'Modifier'}
                </SecondaryBtn>
              </div>
            </div>

            <div style={{ width:'100%', height:1, backgroundColor:'#F1F5F9' }} />

            {/* Compétences */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#94A3B8',
                textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
                Machines qualifiées
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {PLANNING_DATA.MACHINES.map((m) => {
                  const has = skillIdsForEmpLocal(sel.id).has(m.id);
                  const interactive = editSkills;
                  return (
                    <div
                      key={m.id}
                      role={interactive ? 'button' : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      onClick={() => {
                        if (interactive) toggleEmpMachine(sel.id, m.id);
                      }}
                      onKeyDown={(e) => {
                        if (!interactive) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleEmpMachine(sel.id, m.id);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        backgroundColor: has ? '#F0F7FF' : '#F8FAFC',
                        border: `1px solid ${has ? '#BFDBFE' : '#F1F5F9'}`,
                        cursor: interactive ? 'pointer' : 'default',
                        opacity: interactive ? 1 : 0.92,
                        outline: interactive && has ? '1px solid #93C5FD' : 'none',
                      }}
                      title={
                        interactive
                          ? (has ? 'Retirer cette qualification' : 'Ajouter cette qualification')
                          : 'Cliquez sur Modifier pour éditer les qualifications'
                      }
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: has ? '#1D4ED8' : '#94A3B8',
                          backgroundColor: has ? '#DBEAFE' : '#F1F5F9',
                          padding: '2px 6px',
                          borderRadius: 4,
                          width: 34,
                          textAlign: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {m.short}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          flex: 1,
                          color: has ? '#1E293B' : '#94A3B8',
                        }}
                      >
                        {m.name}
                      </span>
                      <ImportanceDot importance={m.importance} />
                      <span
                        style={{
                          fontSize: 14,
                          color: has ? '#22C55E' : '#E5E7EB',
                          fontWeight: 700,
                        }}
                      >
                        {has ? '✓' : '○'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shift distribution this month */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#94A3B8',
                textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                Répartition shifts – {MONTH_LABEL}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                {PLANNING_DATA.SHIFTS.map(sh => {
                  const n = Array.from({length:PLANNING_DATA.DAYS},(_,i)=>i+1)
                    .filter(d => !isWeekend(d) && assignments[`${sel.id}-${d}`]?.shift === sh.id).length;
                  return (
                    <div key={sh.id} style={{ flex:1, padding:'12px', borderRadius:8,
                      backgroundColor:sh.cellBg, textAlign:'center',
                      border:`1px solid ${sh.chipBg}33` }}>
                      <div style={{ fontSize:22, fontWeight:800, color:sh.cellText }}>{n}</div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginTop:4 }}>
                        <ShiftChip shiftId={sh.id} />
                        <span style={{ fontSize:11, color:sh.cellText }}>{sh.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center',
            color:'#CBD5E1', fontSize:13, fontStyle:'italic' }}>
            Sélectionnez un employé pour voir les détails
          </div>
        )}
      </div>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE MACHINES
// ═══════════════════════════════════════════════════════════════════════════
const IMPORTANCE_LABEL = { MANDATORY:'Obligatoire', PRIORITY:'Prioritaire', OPTIONAL:'Optionnel' };
const IMPORTANCE_COLOR = { MANDATORY:'#EF4444', PRIORITY:'#F59E0B', OPTIONAL:'#94A3B8' };
const IMPORTANCE_BG    = { MANDATORY:'#FEF2F2', PRIORITY:'#FFFBEB', OPTIONAL:'#F8FAFC' };

export function PageMachines({ t }: PageProps) {
  const PLANNING_DATA = usePlanningData();
  const { refetchPlanning } = usePlanningFull();
  const { MACHINES, EMPLOYEES } = PLANNING_DATA;
  const [selected, setSelected] = useState(null);
  const [editQualifiers, setEditQualifiers] = useState(false);
  const [showEditMachine, setShowEditMachine] = useState(false);
  const [machineForm, setMachineForm] = useState({
    name: '',
    short_name: '',
    machine_group: '',
    max_employees: 1,
    importance: 'OPTIONAL',
  });
  const [savingMachine, setSavingMachine] = useState(false);

  const skillsByEmpId = useEmployeeSkillsStore((s) => s.skillsByEmpId);
  const toggleEmpMachine = useEmployeeSkillsStore((s) => s.toggleEmpMachine);

  useEffect(() => {
    setEditQualifiers(false);
  }, [selected]);

  useEffect(() => {
    if (!showEditMachine || !selected) return;
    const m = MACHINES.find((x) => x.id === selected);
    if (!m) return;
    setMachineForm({
      name: m.name,
      short_name: m.short,
      machine_group: m.group,
      max_employees: m.maxEmp,
      importance: m.importance,
    });
  }, [showEditMachine, selected, MACHINES]);

  const saveMachineMeta = async () => {
    if (!selected) return;
    setSavingMachine(true);
    try {
      const res = await planningFetch(`/luxlait_machines/${selected}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: machineForm.name.trim(),
          short_name: machineForm.short_name.trim() || null,
          machine_group: machineForm.machine_group.trim() || null,
          max_employees: Math.max(1, Number(machineForm.max_employees) || 1),
          importance: machineForm.importance,
        }),
      });
      if (!res.ok) {
        const tx = await res.text();
        throw new Error(tx || `HTTP ${res.status}`);
      }
      await refetchPlanning();
      setShowEditMachine(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Échec enregistrement');
    } finally {
      setSavingMachine(false);
    }
  };

  const groups = [...new Set(MACHINES.map((m) => m.group))];

  const qualified = (machineId) =>
    EMPLOYEES.filter((e) => skillsByEmpId[e.id]?.has(machineId));

  const unqualifiedForMachine = (machineId) =>
    EMPLOYEES.filter((e) => !skillsByEmpId[e.id]?.has(machineId))
      .slice()
      .sort((a, b) =>
        `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'),
      );

  const sel = selected ? MACHINES.find((m) => m.id === selected) : null;
  const selQual = sel ? qualified(sel.id) : [];
  const selUnqual = sel ? unqualifiedForMachine(sel.id) : [];

  const empSkillCount = (empId) => skillIdsForEmp(skillsByEmpId, empId).size;

  return (
    <PageShell t={t} title="Machines" subtitle={`${MACHINES.length} machines · ${groups.length} groupes`}
      action={<PrimaryBtn t={t}>+ Ajouter une machine</PrimaryBtn>}>

      <div
        style={{
          display: 'flex',
          gap: 20,
          alignItems: 'stretch',
          minHeight: 0,
          maxHeight: 'calc(100dvh - 168px)',
        }}
      >

        {/* Left: machine list by group */}
        <div style={{ flex:'0 0 480px', display:'flex', flexDirection:'column', gap:20, minHeight:0, overflowY:'auto', overflowX:'hidden', paddingRight:4 }}>
          {groups.map(group => (
            <div key={group}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94A3B8',
                textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>
                {group}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {MACHINES.filter(m=>m.group===group).map(m => {
                  const qual = qualified(m.id);
                  const isS  = selected === m.id;
                  return (
                    <div key={m.id} onClick={() => setSelected(isS?null:m.id)}
                      style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                        borderRadius:10, cursor:'pointer',
                        border:`2px solid ${isS ? t.primaryBtn : '#E5E7EB'}`,
                        backgroundColor: isS ? '#F0F7FF' : '#fff', transition:'all 0.1s' }}>

                      {/* Code badge */}
                      <div style={{ width:44, height:44, borderRadius:10, flexShrink:0,
                        backgroundColor: IMPORTANCE_BG[m.importance],
                        border:`1.5px solid ${IMPORTANCE_COLOR[m.importance]}44`,
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
                        <span style={{ fontSize:11, fontWeight:800, color:IMPORTANCE_COLOR[m.importance] }}>
                          {m.short}
                        </span>
                      </div>

                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:14, fontWeight:600, color:'#1E293B' }}>{m.name}</span>
                          <span style={{ fontSize:10, fontWeight:600,
                            color: IMPORTANCE_COLOR[m.importance],
                            backgroundColor: IMPORTANCE_BG[m.importance],
                            padding:'1px 6px', borderRadius:5 }}>
                            {IMPORTANCE_LABEL[m.importance]}
                          </span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:5 }}>
                          <span style={{ fontSize:11, color:'#64748B' }}>
                            Max {m.maxEmp} opérateur{m.maxEmp>1?'s':''}
                          </span>
                          <span style={{ fontSize:11, color:'#64748B' }}>·</span>
                          {/* Qualified avatars */}
                          <div style={{ display:'flex', alignItems:'center' }}>
                            {qual.slice(0,5).map((e,i) => (
                              <div key={e.id} title={`${e.prenom} ${e.nom}`}
                                style={{ width:20, height:20, borderRadius:'50%',
                                  backgroundColor: e.backup?'#FEF3C7':'#DBEAFE',
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  fontSize:8, fontWeight:700,
                                  color: e.backup?'#92400E':'#1E40AF',
                                  marginLeft: i>0 ? -5 : 0,
                                  border:'1.5px solid #fff', flexShrink:0 }}>
                                {e.prenom[0]}{e.nom[0]}
                              </div>
                            ))}
                            {qual.length > 5 && (
                              <span style={{ fontSize:10, color:'#94A3B8', marginLeft:6 }}>
                                +{qual.length-5}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize:11, color:'#94A3B8' }}>
                            {qual.length} qualifié{qual.length>1?'s':''}
                          </span>
                        </div>
                      </div>

                      <span style={{ color:'#CBD5E1', fontSize:16 }}>›</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right: machine detail */}
        {sel ? (
          <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', gap:16, overflow:'hidden' }}>

            {/* Header card */}
            <div style={{ backgroundColor:'#fff', borderRadius:12, border:'1px solid #E5E7EB', padding:24, flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                <div style={{ width:52, height:52, borderRadius:12,
                  backgroundColor:IMPORTANCE_BG[sel.importance],
                  border:`2px solid ${IMPORTANCE_COLOR[sel.importance]}55`,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:16, fontWeight:800, color:IMPORTANCE_COLOR[sel.importance] }}>
                    {sel.short}
                  </span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'#0F172A' }}>{sel.name}</div>
                  <div style={{ display:'flex', gap:8, marginTop:4, alignItems:'center' }}>
                    <span style={{ fontSize:11, fontWeight:600,
                      color:IMPORTANCE_COLOR[sel.importance],
                      backgroundColor:IMPORTANCE_BG[sel.importance],
                      padding:'2px 8px', borderRadius:6 }}>
                      {IMPORTANCE_LABEL[sel.importance]}
                    </span>
                    <span style={{ fontSize:12, color:'#64748B' }}>
                      {sel.group} · Max {sel.maxEmp} opérateur{sel.maxEmp>1?'s':''}
                    </span>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                  {editQualifiers && (
                    <span style={{ fontSize:11, color:'#64748B', maxWidth:260, textAlign:'right' }}>
                      Cliquez une ligne pour retirer ; utilisez la liste ci dessous pour ajouter
                    </span>
                  )}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'flex-end' }}>
                    <SecondaryBtn onClick={() => setShowEditMachine(true)}>
                      Modifier la fiche
                    </SecondaryBtn>
                    <SecondaryBtn onClick={() => setEditQualifiers((v) => !v)}>
                      {editQualifiers ? 'Terminer qualifications' : 'Qualifications'}
                    </SecondaryBtn>
                  </div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { label:'Opérateurs qualifiés', value:selQual.length },
                  { label:'Capacité max / shift',  value:sel.maxEmp    },
                  { label:'Groupe',                value:sel.group     },
                  { label:'Code',                  value:sel.short     },
                ].map(s => (
                  <div key={s.label} style={{ padding:'10px 14px', backgroundColor:'#F8FAFC',
                    borderRadius:8, border:'1px solid #F1F5F9' }}>
                    <div style={{ fontSize:18, fontWeight:700, color:'#1E293B' }}>{s.value}</div>
                    <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Qualified operators */}
            <div style={{
              flex:1,
              minHeight:0,
              backgroundColor:'#fff',
              borderRadius:12,
              border:'1px solid #E5E7EB',
              padding:24,
              display:'flex',
              flexDirection:'column',
              overflow:'hidden',
            }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94A3B8',
                textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14, flexShrink:0 }}>
                Opérateurs qualifiés ({selQual.length})
              </div>
              <div style={{
                flex:1,
                minHeight:0,
                overflowY:'auto',
                overflowX:'hidden',
                display:'flex',
                flexDirection:'column',
                gap:6,
                paddingRight:4,
              }}>
                {selQual.map((emp) => (
                  <div
                    key={emp.id}
                    role={editQualifiers ? 'button' : undefined}
                    tabIndex={editQualifiers ? 0 : undefined}
                    onClick={() => {
                      if (editQualifiers) toggleEmpMachine(emp.id, sel.id);
                    }}
                    onKeyDown={(e) => {
                      if (!editQualifiers) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleEmpMachine(emp.id, sel.id);
                      }
                    }}
                    style={{
                      display:'flex',
                      alignItems:'center',
                      gap:10,
                      padding:'8px 12px',
                      borderRadius:8,
                      backgroundColor:'#F8FAFC',
                      border:`1px solid ${editQualifiers ? '#BFDBFE' : '#F1F5F9'}`,
                      cursor: editQualifiers ? 'pointer' : 'default',
                    }}
                    title={editQualifiers ? 'Cliquer pour retirer cette qualification' : undefined}
                  >
                    <Av emp={emp} backup={emp.backup} size={28} />
                    <span style={{ fontSize:13, fontWeight:500, color:'#1E293B', flex:1 }}>
                      {emp.prenom} {emp.nom}
                    </span>
                    {emp.backup && <span style={{ fontSize:9, fontWeight:700, color:'#92400E',
                      backgroundColor:'#FEF3C7', padding:'1px 5px', borderRadius:4 }}>BACKUP</span>}
                    <span style={{ fontSize:11, color:'#94A3B8' }}>
                      {empSkillCount(emp.id)} compét.
                    </span>
                    {editQualifiers && (
                      <span style={{ fontSize:11, fontWeight:600, color:'#DC2626' }}>Retirer</span>
                    )}
                  </div>
                ))}
                {selQual.length === 0 && (
                  <p style={{ fontSize:13, color:'#94A3B8', fontStyle:'italic' }}>
                    Aucun opérateur qualifié sur cette machine.
                  </p>
                )}
              </div>

              {editQualifiers && selUnqual.length === 0 && selQual.length > 0 && (
                <p style={{ fontSize:12, color:'#94A3B8', marginTop:12, flexShrink:0 }}>
                  Tous les employés sont qualifiés pour cette machine.
                </p>
              )}
              {editQualifiers && selUnqual.length > 0 && (
                <>
                  <div style={{
                    fontSize:11,
                    fontWeight:700,
                    color:'#94A3B8',
                    textTransform:'uppercase',
                    letterSpacing:'0.06em',
                    marginTop:16,
                    marginBottom:10,
                    flexShrink:0,
                  }}>
                    Ajouter un opérateur ({selUnqual.length})
                  </div>
                  <div style={{
                    maxHeight:220,
                    minHeight:0,
                    overflowY:'auto',
                    overflowX:'hidden',
                    display:'flex',
                    flexDirection:'column',
                    gap:6,
                    paddingRight:4,
                    flexShrink:0,
                  }}>
                    {selUnqual.map((emp) => (
                      <div
                        key={emp.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleEmpMachine(emp.id, sel.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleEmpMachine(emp.id, sel.id);
                          }
                        }}
                        style={{
                          display:'flex',
                          alignItems:'center',
                          gap:10,
                          padding:'8px 12px',
                          borderRadius:8,
                          backgroundColor:'#fff',
                          border:'1px dashed #CBD5E1',
                          cursor:'pointer',
                        }}
                      >
                        <Av emp={emp} backup={emp.backup} size={28} />
                        <span style={{ fontSize:13, fontWeight:500, color:'#1E293B', flex:1 }}>
                          {emp.prenom} {emp.nom}
                        </span>
                        <span style={{ fontSize:11, fontWeight:600, color:t.primaryBtn }}>Ajouter</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center',
            color:'#CBD5E1', fontSize:13, fontStyle:'italic' }}>
            Sélectionnez une machine pour voir les détails
          </div>
        )}
      </div>

      {showEditMachine && sel && (
        <div
          onClick={(e) => e.target === e.currentTarget && !savingMachine && setShowEditMachine(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15,23,42,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 440,
              maxWidth: '92vw',
              boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Modifier la machine
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 11, color: '#94A3B8' }}>Nom</label>
              <input
                value={machineForm.name}
                onChange={(e) => setMachineForm((f) => ({ ...f, name: e.target.value }))}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  fontSize: 13,
                }}
              />
              <label style={{ fontSize: 11, color: '#94A3B8' }}>Code court</label>
              <input
                value={machineForm.short_name}
                onChange={(e) =>
                  setMachineForm((f) => ({ ...f, short_name: e.target.value }))
                }
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  fontSize: 13,
                }}
              />
              <label style={{ fontSize: 11, color: '#94A3B8' }}>Groupe</label>
              <input
                value={machineForm.machine_group}
                onChange={(e) =>
                  setMachineForm((f) => ({ ...f, machine_group: e.target.value }))
                }
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  fontSize: 13,
                }}
              />
              <label style={{ fontSize: 11, color: '#94A3B8' }}>
                Opérateurs max par shift
              </label>
              <input
                type="number"
                min={1}
                value={machineForm.max_employees}
                onChange={(e) =>
                  setMachineForm((f) => ({
                    ...f,
                    max_employees: Number(e.target.value),
                  }))
                }
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  fontSize: 13,
                }}
              />
              <label style={{ fontSize: 11, color: '#94A3B8' }}>Importance</label>
              <select
                value={machineForm.importance}
                onChange={(e) =>
                  setMachineForm((f) => ({ ...f, importance: e.target.value }))
                }
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  fontSize: 13,
                }}
              >
                <option value="MANDATORY">{IMPORTANCE_LABEL.MANDATORY}</option>
                <option value="PRIORITY">{IMPORTANCE_LABEL.PRIORITY}</option>
                <option value="OPTIONAL">{IMPORTANCE_LABEL.OPTIONAL}</option>
              </select>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 20,
              }}
            >
              <SecondaryBtn
                onClick={() => !savingMachine && setShowEditMachine(false)}
                disabled={savingMachine}
              >
                Annuler
              </SecondaryBtn>
              <PrimaryBtn t={t} onClick={saveMachineMeta} disabled={savingMachine || !machineForm.name.trim()}>
                {savingMachine ? '…' : 'Enregistrer'}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE COMPÉTENCES — Matrice employés × machines
// ═══════════════════════════════════════════════════════════════════════════
export function PageCompetences({ t }: PageProps) {
  const PLANNING_DATA = usePlanningData();
  const { EMPLOYEES, MACHINES, GROUPS } = PLANNING_DATA;
  const [groupFilter, setGroupFilter] = useState('');

  const skillsByEmpId = useEmployeeSkillsStore((s) => s.skillsByEmpId);
  const toggleEmpMachine = useEmployeeSkillsStore((s) => s.toggleEmpMachine);
  const resetSkills = useEmployeeSkillsStore((s) => s.resetSkills);

  const visibleEmps = groupFilter
    ? EMPLOYEES.filter(e => e.group === groupFilter)
    : EMPLOYEES;

  const [changed, setChanged] = useState(false);

  const toggle = (empId, machineId) => {
    toggleEmpMachine(empId, machineId);
    setChanged(true);
  };

  const has = (empId, machineId) => skillsByEmpId[empId]?.has(machineId);

  const groups = [...new Set(MACHINES.map(m=>m.group))];

  // Totals
  const empTotal  = emp => skillsByEmpId[emp.id]?.size || 0;
  const machTotal = mid => EMPLOYEES.filter(e => skillsByEmpId[e.id]?.has(mid)).length;

  const colW  = 62;
  const nameW = 160;

  return (
    <PageShell t={t} title="Matrice des compétences"
      subtitle="Cliquez sur une cellule pour activer / désactiver une qualification"
      action={
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {changed && <span style={{ fontSize:11, color:'#F59E0B', fontWeight:600 }}>
            Modifications non sauvegardées
          </span>}
          {changed && <SecondaryBtn onClick={() => { resetSkills(); setChanged(false); }}>Annuler</SecondaryBtn>}
          <PrimaryBtn t={t} onClick={()=>setChanged(false)}>
            {changed ? 'Enregistrer' : 'Exporter CSV'}
          </PrimaryBtn>
        </div>
      }>

      {/* Group filter chips */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase',
          letterSpacing:'0.05em', marginRight:4 }}>Groupe :</span>
        <button onClick={()=>setGroupFilter('')} style={{
          padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer',
          border:`1.5px solid ${!groupFilter?'#64748B':'#E5E7EB'}`,
          backgroundColor:!groupFilter?'#F1F5F9':'#fff', color:!groupFilter?'#1E293B':'#64748B' }}>
          Tous ({EMPLOYEES.length})
        </button>
        {GROUPS.map(g => {
          const cnt = EMPLOYEES.filter(e=>e.group===g.id).length;
          const act = groupFilter===g.id;
          return (
            <button key={g.id} onClick={()=>setGroupFilter(act?'':g.id)} style={{
              padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer',
              border:`1.5px solid ${act?g.textColor:'#E5E7EB'}`,
              backgroundColor:act?g.color:'#fff', color:act?g.textColor:'#64748B' }}>
              {g.label} ({cnt})
            </button>
          );
        })}
        <span style={{ marginLeft:'auto', fontSize:11, color:'#94A3B8' }}>
          {visibleEmps.length} employé{visibleEmps.length>1?'s':''} affichés
        </span>
      </div>

      <div style={{ overflowX:'auto', backgroundColor:'#fff', borderRadius:12,
        border:'1px solid #E5E7EB', display:'inline-block', minWidth:'100%' }}>

        <table style={{ borderCollapse:'collapse', fontSize:12, fontFamily:'IBM Plex Sans, sans-serif' }}>
          <thead>
            {/* Group row */}
            <tr>
              <th style={{ width:nameW, minWidth:nameW, padding:'10px 14px',
                borderRight:'2px solid #E5E7EB', borderBottom:'1px solid #E5E7EB',
                backgroundColor:'#F8FAFC', position:'sticky', left:0, zIndex:3,
                fontSize:11, fontWeight:700, color:'#94A3B8', textAlign:'left',
                textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Employé
              </th>
              {groups.map(group => {
                const cols = MACHINES.filter(m=>m.group===group).length;
                return (
                  <th key={group} colSpan={cols} style={{
                    padding:'8px 0', textAlign:'center', fontSize:10, fontWeight:700,
                    color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em',
                    borderRight:'2px solid #E5E7EB', borderBottom:'1px solid #F1F5F9',
                    backgroundColor:'#F8FAFC',
                  }}>{group}</th>
                );
              })}
              <th style={{ padding:'8px 14px', borderBottom:'1px solid #E5E7EB',
                backgroundColor:'#F8FAFC', fontSize:11, fontWeight:700, color:'#94A3B8',
                whiteSpace:'nowrap' }}>Total</th>
            </tr>
            {/* Machine header */}
            <tr>
              <th style={{ width:nameW, minWidth:nameW, padding:'8px 14px',
                borderRight:'2px solid #E5E7EB', borderBottom:'2px solid #E5E7EB',
                backgroundColor:'#fff', position:'sticky', left:0, zIndex:3 }} />
              {MACHINES.map((m, i) => {
                const isLastInGroup = i===MACHINES.length-1 ||
                  MACHINES[i+1].group !== m.group;
                return (
                  <th key={m.id} style={{ width:colW, minWidth:colW, padding:'8px 4px',
                    textAlign:'center', borderBottom:'2px solid #E5E7EB',
                    borderRight: isLastInGroup ? '2px solid #E5E7EB' : '1px solid #F1F5F9',
                    backgroundColor:'#fff' }}>
                    <div title={m.name} style={{ display:'flex', flexDirection:'column',
                      alignItems:'center', gap:3 }}>
                      <span style={{ fontSize:10, fontWeight:800, color:IMPORTANCE_COLOR[m.importance],
                        backgroundColor:IMPORTANCE_BG[m.importance], padding:'2px 6px',
                        borderRadius:4 }}>{m.short}</span>
                      <span style={{ fontSize:9, color:'#94A3B8', fontWeight:500,
                        maxWidth:colW-8, overflow:'hidden', textOverflow:'ellipsis',
                        whiteSpace:'nowrap', display:'block' }}>
                        {m.name.split(' ')[0]}
                      </span>
                      <ImportanceDot importance={m.importance} />
                    </div>
                  </th>
                );
              })}
              <th style={{ padding:'8px 14px', borderBottom:'2px solid #E5E7EB',
                backgroundColor:'#fff', fontSize:11, color:'#94A3B8' }} />
            </tr>
          </thead>

          <tbody>
            {visibleEmps.map((emp, ei) => (
              <tr key={emp.id} style={{ backgroundColor: ei%2===0 ? '#fff' : '#FAFAFA' }}>
                {/* Employee name */}
                <td style={{ padding:'8px 14px', borderRight:'2px solid #E5E7EB',
                  borderBottom:'1px solid #F1F5F9', position:'sticky', left:0, zIndex:2,
                  backgroundColor: ei%2===0 ? '#fff' : '#FAFAFA' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Av emp={emp} backup={emp.backup} size={24} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#1E293B',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                        maxWidth:nameW-60 }}>
                        {emp.prenom} {emp.nom}
                      </div>
                      {emp.backup && <div style={{ fontSize:8, fontWeight:700, color:'#92400E' }}>BACKUP</div>}
                    </div>
                  </div>
                </td>

                {/* Skill cells */}
                {MACHINES.map((m, mi) => {
                  const active = has(emp.id, m.id);
                  const isLastInGroup = mi===MACHINES.length-1 ||
                    MACHINES[mi+1].group !== m.group;
                  return (
                    <td key={m.id} onClick={() => toggle(emp.id, m.id)}
                      style={{ width:colW, padding:'6px 4px', textAlign:'center',
                        cursor:'pointer', borderBottom:'1px solid #F1F5F9',
                        borderRight: isLastInGroup ? '2px solid #E5E7EB' : '1px solid #F5F5F5',
                        transition:'background 0.1s',
                        backgroundColor: active
                          ? (m.importance==='MANDATORY' ? '#FEF2F2' : m.importance==='PRIORITY' ? '#FFFBEB' : '#F0FDF4')
                          : 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = active ? '' : '#F8FAFC'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = active
                        ? (m.importance==='MANDATORY' ? '#FEF2F2' : m.importance==='PRIORITY' ? '#FFFBEB' : '#F0FDF4')
                        : 'transparent'; }}>
                      {active ? (
                        <div style={{ width:24, height:24, borderRadius:6, margin:'0 auto',
                          backgroundColor: IMPORTANCE_COLOR[m.importance]+'22',
                          border:`1.5px solid ${IMPORTANCE_COLOR[m.importance]}88`,
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ fontSize:13, fontWeight:700,
                            color:IMPORTANCE_COLOR[m.importance] }}>✓</span>
                        </div>
                      ) : (
                        <div style={{ width:24, height:24, borderRadius:6, margin:'0 auto',
                          border:'1.5px solid #E5E7EB',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ fontSize:12, color:'#E5E7EB' }}>·</span>
                        </div>
                      )}
                    </td>
                  );
                })}

                {/* Row total */}
                <td style={{ padding:'6px 14px', textAlign:'center', borderBottom:'1px solid #F1F5F9',
                  fontSize:13, fontWeight:700,
                  color: empTotal(emp)>=4 ? '#166534' : empTotal(emp)>=2 ? '#0369A1' : '#94A3B8' }}>
                  {empTotal(emp)}
                </td>
              </tr>
            ))}

            {/* Column totals */}
            <tr style={{ backgroundColor:'#F8FAFC', borderTop:'2px solid #E5E7EB' }}>
              <td style={{ padding:'8px 14px', borderRight:'2px solid #E5E7EB',
                fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase',
                letterSpacing:'0.05em', position:'sticky', left:0, backgroundColor:'#F8FAFC', zIndex:2 }}>
                Qualifiés
              </td>
              {MACHINES.map((m, mi) => {
              const tot = visibleEmps.filter(e => skillsByEmpId[e.id]?.has(m.id)).length;
                const isLastInGroup = mi===MACHINES.length-1 || MACHINES[mi+1].group !== m.group;
                return (
                  <td key={m.id} style={{ textAlign:'center', padding:'8px 4px', fontSize:13, fontWeight:700,
                    borderRight: isLastInGroup ? '2px solid #E5E7EB' : '1px solid #F1F5F9',
                    color: tot>=3 ? '#166534' : tot>=2 ? '#0369A1' : '#DC2626' }}>
                    {tot}
                  </td>
                );
              })}
              <td />
            </tr>
          </tbody>
        </table>

        {/* Legend */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid #E5E7EB',
          display:'flex', gap:20, alignItems:'center' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase',
            letterSpacing:'0.05em' }}>Légende :</span>
          {[
            { color:IMPORTANCE_COLOR.MANDATORY, bg:IMPORTANCE_BG.MANDATORY, label:'Obligatoire' },
            { color:IMPORTANCE_COLOR.PRIORITY,  bg:IMPORTANCE_BG.PRIORITY,  label:'Prioritaire' },
            { color:IMPORTANCE_COLOR.OPTIONAL,  bg:IMPORTANCE_BG.OPTIONAL,  label:'Optionnel'   },
          ].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:16, height:16, borderRadius:4, backgroundColor:l.bg,
                border:`1.5px solid ${l.color}55`, display:'flex', alignItems:'center',
                justifyContent:'center' }}>
                <span style={{ fontSize:9, fontWeight:700, color:l.color }}>✓</span>
              </div>
              <span style={{ fontSize:11, color:'#64748B' }}>{l.label}</span>
            </div>
          ))}
          <span style={{ marginLeft:'auto', fontSize:11, color:'#94A3B8' }}>
            Cliquez sur une cellule pour modifier
          </span>
        </div>
      </div>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE CONGÉS — grille mensuelle (même mois que le planning)
// ═══════════════════════════════════════════════════════════════════════════

function congesMapsEqual(
  a: Map<string, string | null>,
  b: Map<string, string | null>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

function cloneCongesMap(m: Map<string, string | null>) {
  return new Map(m);
}

function pickDefaultCongesStatusId(
  statuses: { id: string; label: string }[],
): string {
  if (!statuses.length) return '';
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  const by = statuses.find((st) =>
    /conge|vacation|absence|rtt|maladie|formation/i.test(norm(st.label)),
  );
  return by?.id ?? statuses[0].id;
}

export function PageConges({ t }: PageProps) {
  const bundle = usePlanningData();
  const { refetchPlanning } = usePlanningFull();
  const {
    EMPLOYEES,
    STATUSES,
    MONTH_LABEL,
    DAYS,
    statusEntries,
    isWeekend,
    dowLabel,
    TODAY,
  } = bundle;

  const serverMap = useMemo(() => {
    const m = new Map();
    for (const e of EMPLOYEES) {
      for (let d = 1; d <= DAYS; d++) {
        m.set(`${e.id}|${d}`, null);
      }
    }
    for (const row of statusEntries) {
      const d = bundleDayFromIso(bundle, row.dayDate);
      if (d !== null) m.set(`${row.employeeId}|${d}`, row.statusId);
    }
    return m;
  }, [EMPLOYEES, DAYS, statusEntries, bundle.YEAR, bundle.MONTH_IDX]);

  const [baseline, setBaseline] = useState(() => cloneCongesMap(serverMap));
  const [working, setWorking] = useState(() => cloneCongesMap(serverMap));
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBaseline(cloneCongesMap(serverMap));
    setWorking(cloneCongesMap(serverMap));
  }, [serverMap]);

  useEffect(() => {
    if (!STATUSES.length) return;
    setSelectedStatusId((prev) =>
      prev && STATUSES.some((s) => s.id === prev) ? prev : pickDefaultCongesStatusId(STATUSES),
    );
  }, [STATUSES]);

  const hasChanges = useMemo(() => !congesMapsEqual(baseline, working), [baseline, working]);

  const pendingCount = useMemo(() => {
    let n = 0;
    for (const [k, w] of working) {
      if (w !== (baseline.get(k) ?? null)) n += 1;
    }
    return n;
  }, [baseline, working]);

  const handleCellClick = (employeeId: string, day: number) => {
    if (!selectedStatusId || isWeekend(day)) return;
    const key = `${employeeId}|${day}`;
    setWorking((prev) => {
      const next = cloneCongesMap(prev);
      const cur = next.get(key) ?? null;
      if (cur === null) next.set(key, selectedStatusId);
      else if (cur === selectedStatusId) next.set(key, null);
      else next.set(key, selectedStatusId);
      return next;
    });
  };

  const handleDiscard = () => {
    setWorking(cloneCongesMap(baseline));
  };

  const handleSave = async () => {
    const rows = [];
    for (const [k, w] of working) {
      const b = baseline.get(k) ?? null;
      if (w === b) continue;
      const pipe = k.indexOf('|');
      const employee_id = k.slice(0, pipe);
      const dayNum = Number(k.slice(pipe + 1));
      const day_date = isoDateFromBundleDay(bundle, dayNum);
      rows.push({ employee_id, day_date, status_id: w });
    }
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const res = await planningFetch('/luxlait_weekly_employee_statuses/bulk_sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const tx = await res.text();
        throw new Error(tx || `HTTP ${res.status}`);
      }
      await refetchPlanning();
      setBaseline(cloneCongesMap(working));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Échec');
    } finally {
      setSaving(false);
    }
  };

  const dayNumbers = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => i + 1),
    [DAYS],
  );

  return (
    <PageShell
      t={t}
      title="Congés & Absences"
      subtitle={`${MONTH_LABEL} · grille par employé et par jour`}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Statut appliqué au clic
          </label>
          <select
            value={selectedStatusId}
            onChange={(e) => setSelectedStatusId(e.target.value)}
            disabled={STATUSES.length === 0}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              fontSize: 13,
              maxWidth: 320,
              fontFamily: 'IBM Plex Sans, sans-serif',
              backgroundColor: t.headerBg,
            }}
          >
            {STATUSES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, maxWidth: 480, lineHeight: 1.45 }}>
            Clic : pose le statut. Même statut : efface. Autre statut : remplace.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!hasChanges || saving}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              cursor: !hasChanges || saving ? 'default' : 'pointer',
              backgroundColor: '#fff',
              fontSize: 12,
              fontWeight: 500,
              color: '#374151',
              opacity: !hasChanges || saving ? 0.5 : 1,
            }}
          >
            Annuler les changements
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              cursor: !hasChanges || saving ? 'default' : 'pointer',
              backgroundColor: t.primaryBtn,
              color: t.primaryBtnText,
              fontSize: 13,
              fontWeight: 600,
              opacity: !hasChanges || saving ? 0.55 : 1,
            }}
          >
            {saving ? '…' : `Enregistrer (${pendingCount})`}
          </button>
        </div>
      </div>

      <div
        style={{
          overflow: 'auto',
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          backgroundColor: t.headerBg,
        }}
      >
        <table
          style={{
            borderCollapse: 'collapse',
            fontSize: 11,
            minWidth: '100%',
          }}
        >
          <thead>
            <tr style={{ borderBottom: `2px solid ${t.border}` }}>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  backgroundColor: '#F8FAFC',
                  borderRight: `1px solid ${t.border}`,
                  padding: '8px 10px',
                  textAlign: 'left',
                  fontWeight: 700,
                  color: '#64748B',
                  whiteSpace: 'nowrap',
                  minWidth: 160,
                }}
              >
                Employé
              </th>
              {dayNumbers.map((d) => {
                const wknd = isWeekend(d);
                const isT = d === TODAY;
                return (
                  <th
                    key={d}
                    style={{
                      padding: '6px 4px',
                      textAlign: 'center',
                      fontWeight: 600,
                      color: isT ? '#92400E' : wknd ? '#94A3B8' : '#64748B',
                      backgroundColor: isT ? '#FFFBEB' : wknd ? '#F8FAFC' : '#F8FAFC',
                      borderLeft: d > 1 ? `1px solid ${t.border}` : 'none',
                      minWidth: 36,
                    }}
                    title={isoDateFromBundleDay(bundle, d)}
                  >
                    <div style={{ fontSize: 9, lineHeight: 1 }}>{dowLabel(d)}</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{d}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {EMPLOYEES.map((emp, ri) => (
              <tr
                key={emp.id}
                style={{
                  borderBottom: `1px solid ${t.border}`,
                  backgroundColor: ri % 2 === 0 ? '#fff' : '#FAFBFC',
                }}
              >
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    borderRight: `1px solid ${t.border}`,
                    padding: 0,
                    verticalAlign: 'middle',
                    backgroundColor: ri % 2 === 0 ? '#fff' : '#FAFBFC',
                    minWidth: 160,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
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
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>
                        {emp.prenom} {emp.nom}
                      </div>
                      <div style={{ fontSize: 9, color: '#94A3B8' }}>{emp.groupLabel}</div>
                    </div>
                  </div>
                </td>
                {dayNumbers.map((d) => {
                  const wknd = isWeekend(d);
                  const key = `${emp.id}|${d}`;
                  const sid = working.get(key) ?? null;
                  const st = sid ? STATUSES.find((s) => s.id === sid) : undefined;
                  const cell = planningStatusCellStyle(st);
                  const short = planningStatusShort(st);
                  const isT = d === TODAY;
                  return (
                    <td
                      key={d}
                      style={{
                        padding: 2,
                        borderLeft: d > 1 ? `1px solid ${t.border}` : 'none',
                        backgroundColor: isT && !wknd ? '#FFFBEB' : wknd ? '#F1F5F9' : 'transparent',
                      }}
                    >
                      <button
                        type="button"
                        disabled={wknd}
                        onClick={() => handleCellClick(emp.id, d)}
                        title={
                          wknd
                            ? 'Week-end'
                            : st
                              ? `${st.label} · clic pour modifier`
                              : 'Disponible · clic pour poser'
                        }
                        style={{
                          width: '100%',
                          minHeight: 32,
                          borderRadius: 4,
                          border: sid
                            ? cell.border
                            : '1px dashed rgba(148, 163, 184, 0.55)',
                          boxSizing: 'border-box',
                          cursor: wknd ? 'default' : 'pointer',
                          backgroundColor: sid ? cell.bg : 'transparent',
                          color: sid ? cell.color : '#CBD5E1',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2px 4px',
                        }}
                      >
                        {sid ? short : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {EMPLOYEES.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            Aucun employé.
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, textAlign: 'right', fontSize: 11, color: '#94A3B8' }}>
        {hasChanges ? `${pendingCount} modification${pendingCount > 1 ? 's' : ''} en attente` : 'Aucune modification en attente'}
      </div>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE FERMETURES — Hebdomadaire récurrent par shift
// ═══════════════════════════════════════════════════════════════════════════
//
// Modèle : pour chaque semaine ISO de l'année, on définit pour chaque jour
// (Lun→Dim) et chaque shift (M/A/N) si l'usine est OUVERTE ou FERMÉE.
// On peut dupliquer la config d'une semaine vers une ou plusieurs autres.

const DOW_FR_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const isoWeekStart = (year: number, week: number) => {
  const jan4 = new Date(year, 0, 4);
  const jan4Dow = (jan4.getDay() + 6) % 7;
  const week1Start = new Date(jan4);
  week1Start.setDate(jan4.getDate() - jan4Dow);
  const start = new Date(week1Start);
  start.setDate(week1Start.getDate() + (week - 1) * 7);
  return start;
};
const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const weekRange = (year: number, week: number) => {
  const s = isoWeekStart(year, week);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return `${fmtDate(s)} – ${fmtDate(e)}`;
};

export function PageFermetures({ t }: PageProps) {
  const PLANNING_DATA = usePlanningData();
  const { planningYear } = usePlanningFull();
  const year = planningYear;
  const { MACHINES, SHIFTS } = PLANNING_DATA;

  const SHIFTS_LIST = SHIFTS.map((sh) => ({
    id: sh.id,
    label: sh.label,
    bg: sh.cellBg,
    color: sh.chipBg,
    activeBg: sh.chipBg,
    activeBorder: sh.chipBg,
  }));

  const slotCountPerWeek = Math.max(1, MACHINES.length * 7 * SHIFTS.length);

  const [closedByWeek, setClosedByWeek] = useState(() => new Map<number, Set<string>>());
  const [activeWeek, setActiveWeek] = useState(1);
  const [loadingRemote, setLoadingRemote] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [dupTargets, setDupTargets] = useState(new Set<number>());
  const [groupFilter, setGroupFilter] = useState('all');

  const reloadFromApi = async () => {
    const rows = await planningJson<ApiWeeklyMachineClosedShiftRow[]>(
      `/luxlait_weekly_machine_closed_shifts?year=${year}`,
    );
    setClosedByWeek(buildClosedMapFromApi(rows));
    setDirty(false);
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingRemote(true);
    planningJson<ApiWeeklyMachineClosedShiftRow[]>(`/luxlait_weekly_machine_closed_shifts?year=${year}`)
      .then((rows) => {
        if (cancelled) return;
        setClosedByWeek(buildClosedMapFromApi(rows));
      })
      .catch(() => {
        if (!cancelled) setClosedByWeek(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoadingRemote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  useEffect(() => {
    const now = new Date();
    if (year === now.getFullYear()) {
      setActiveWeek(
        Math.min(53, Math.max(1, isoWeekNumberForDate(now.getFullYear(), now.getMonth(), now.getDate()))),
      );
    } else {
      setActiveWeek(1);
    }
  }, [year]);

  const activeClosed = closedByWeek.get(activeWeek) ?? new Set<string>();

  const isClosed = (machineId: string, uiDay: number, shiftId: string) =>
    activeClosed.has(closedKey(machineId, uiDay, shiftId));

  let openSlots = 0;
  MACHINES.forEach((mc) => {
    for (let d = 0; d < 7; d++) {
      SHIFTS.forEach((sh) => {
        if (!isClosed(mc.id, d, sh.id)) openSlots++;
      });
    }
  });
  const closedSlots = slotCountPerWeek - openSlots;

  const groups = ['all', ...new Set(MACHINES.map((m) => m.group))];
  const visibleMachines =
    groupFilter === 'all' ? MACHINES : MACHINES.filter((m) => m.group === groupFilter);

  const toggle = (machineId: string, dayIdx: number, shiftId: string) => {
    setClosedByWeek((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(activeWeek) ?? []);
      const k = closedKey(machineId, dayIdx, shiftId);
      if (set.has(k)) set.delete(k);
      else set.add(k);
      next.set(activeWeek, set);
      return next;
    });
    setDirty(true);
  };

  const toggleMachineDay = (machineId: string, dayIdx: number) => {
    const anyOpen = SHIFTS.some((sh) => !isClosed(machineId, dayIdx, sh.id));
    setClosedByWeek((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(activeWeek) ?? []);
      SHIFTS.forEach((sh) => {
        const k = closedKey(machineId, dayIdx, sh.id);
        if (anyOpen) set.add(k);
        else set.delete(k);
      });
      next.set(activeWeek, set);
      return next;
    });
    setDirty(true);
  };

  const toggleAllMachinesShift = (dayIdx: number, shiftId: string) => {
    const anyOpen = visibleMachines.some((mc) => !isClosed(mc.id, dayIdx, shiftId));
    setClosedByWeek((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(activeWeek) ?? []);
      visibleMachines.forEach((mc) => {
        const k = closedKey(mc.id, dayIdx, shiftId);
        if (anyOpen) set.add(k);
        else set.delete(k);
      });
      next.set(activeWeek, set);
      return next;
    });
    setDirty(true);
  };

  const saveWeek = async () => {
    const set = closedByWeek.get(activeWeek) ?? new Set<string>();
    const rows = [...set].map((key) => {
      const [machine_id, ui, time_slot_id] = key.split('|');
      return {
        machine_id,
        weekday: uiIndexToJsWeekday(Number(ui)),
        time_slot_id,
      };
    });
    setSaving(true);
    try {
      const res = await planningFetch(
        `/luxlait_weekly_machine_closed_shifts/${year}/${activeWeek}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      await reloadFromApi();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Échec enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const applyDuplicate = async () => {
    if (dupTargets.size === 0) return;
    setSaving(true);
    try {
      await planningFetch('/luxlait_weekly_machine_closed_shifts/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          sourceWeek: activeWeek,
          targetWeeks: [...dupTargets],
        }),
      });
      await reloadFromApi();
      setDupTargets(new Set());
      setShowDuplicate(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Échec duplication');
    } finally {
      setSaving(false);
    }
  };

  const resetWeek = () => {
    setClosedByWeek((prev) => {
      const next = new Map(prev);
      next.set(activeWeek, new Set());
      return next;
    });
    setDirty(true);
  };

  const closeAllWeek = () => {
    setClosedByWeek((prev) => {
      const next = new Map(prev);
      const set = new Set<string>();
      MACHINES.forEach((mc) => {
        for (let d = 0; d < 7; d++) {
          SHIFTS.forEach((sh) => set.add(closedKey(mc.id, d, sh.id)));
        }
      });
      next.set(activeWeek, set);
      return next;
    });
    setDirty(true);
  };

  const allWeeks: number[] = [];
  for (let i = activeWeek - 6; i <= activeWeek + 8; i++) {
    if (i > 0 && i <= 53 && i !== activeWeek) allWeeks.push(i);
  }

  const weekStatus = (wk: number) => {
    const c = closedByWeek.get(wk)?.size ?? 0;
    if (c === 0) return 'standard';
    if (c >= slotCountPerWeek * 0.98) return 'closed';
    if (c >= slotCountPerWeek * 0.35) return 'reduced';
    return 'modified';
  };

  const statusColors = {
    standard: { bg: '#F0FDF4', color: '#166534', label: 'Standard' },
    modified: { bg: '#FFFBEB', color: '#92400E', label: 'Modifiée' },
    reduced: { bg: '#FEF2F2', color: '#991B1B', label: 'Réduite' },
    closed: { bg: '#F1F5F9', color: '#64748B', label: 'Fermée' },
    default: { bg: '#F8FAFC', color: '#94A3B8', label: 'Par défaut' },
  };

  if (loadingRemote) {
    return (
      <PageShell t={t} title="Fermetures hebdomadaires" subtitle="Chargement…">
        <div style={{ padding: 40, color: '#94A3B8' }}>Chargement des fermetures…</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      t={t}
      title="Fermetures hebdomadaires"
      subtitle={`Année ${year} · shifts depuis le planning`}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <SecondaryBtn onClick={resetWeek} disabled={saving}>
            Réinitialiser
          </SecondaryBtn>
          <SecondaryBtn onClick={saveWeek} disabled={!dirty || saving}>
            {saving ? '…' : 'Enregistrer'}
          </SecondaryBtn>
          <PrimaryBtn t={t} onClick={() => setShowDuplicate(true)} disabled={saving}>
            ⎘ Dupliquer cette semaine…
          </PrimaryBtn>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0 4px 6px',
            }}
          >
            Semaines
          </div>
          {allWeeks.map((wk) => {
            const status = weekStatus(wk);
            const sm = statusColors[status];
            const isActive = wk === activeWeek;
            return (
              <button
                key={wk}
                onClick={() => setActiveWeek(wk)}
                style={{
                  padding: '9px 11px',
                  borderRadius: 8,
                  border: isActive ? `1.5px solid ${t.primaryBtn}` : '1px solid #E5E7EB',
                  backgroundColor: isActive ? `${t.primaryBtn}11` : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontFamily: 'IBM Plex Sans, sans-serif',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    flexShrink: 0,
                    backgroundColor: isActive ? t.primaryBtn : '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                    color: isActive ? '#fff' : '#64748B',
                  }}
                >
                  W{wk}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isActive ? '#0F172A' : '#1E293B',
                    }}
                  >
                    Sem. {wk}
                  </div>
                  <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>
                    {weekRange(year, wk)}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    padding: '2px 5px',
                    borderRadius: 3,
                    backgroundColor: sm.bg,
                    color: sm.color,
                    flexShrink: 0,
                  }}
                >
                  {sm.label}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              border: '1px solid #E5E7EB',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Semaine active
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                Semaine {activeWeek} · {year}
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                {weekRange(year, activeWeek)}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 18 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#22C55E' }}>{openSlots}</div>
                <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase' }}>
                  ouverts
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>{closedSlots}</div>
                <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase' }}>
                  fermés
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1E293B' }}>{MACHINES.length}</div>
                <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase' }}>
                  machines
                </div>
              </div>
            </div>
            <button
              onClick={closeAllWeek}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid #FECACA',
                backgroundColor: '#FEF2F2',
                cursor: 'pointer',
                fontSize: 11,
                color: '#991B1B',
                fontWeight: 600,
              }}
            >
              Tout fermer
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                color: '#94A3B8',
                fontWeight: 600,
                textTransform: 'uppercase',
                marginRight: 4,
              }}
            >
              Filtrer :
            </span>
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setGroupFilter(g)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid #E5E7EB',
                  backgroundColor: groupFilter === g ? t.primaryBtn : '#fff',
                  color: groupFilter === g ? '#fff' : '#64748B',
                }}
              >
                {g === 'all' ? `Tous (${MACHINES.length})` : g}
              </button>
            ))}
          </div>

          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              border: '1px solid #E5E7EB',
              overflow: 'auto',
            }}
          >
            <div style={{ minWidth: 200 + 7 * SHIFTS.length * 30 }}>
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid #E5E7EB',
                  backgroundColor: '#F8FAFC',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: 200,
                    flexShrink: 0,
                    padding: '8px 12px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#94A3B8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderRight: '1px solid #E5E7EB',
                  }}
                >
                  Machine
                </div>
                {DOW_FR_SHORT.map((dow, di) => (
                  <div
                    key={di}
                    style={{
                      flex: '1 1 0',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRight: di < 6 ? '1px solid #E5E7EB' : 'none',
                      minWidth: SHIFTS.length * 30,
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 4px',
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#1E293B',
                        borderBottom: '1px solid #F1F5F9',
                      }}
                    >
                      {dow}
                    </div>
                    <div style={{ display: 'flex' }}>
                      {SHIFTS_LIST.map((sh) => (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => toggleAllMachinesShift(di, sh.id)}
                          title={`Basculer ${sh.label} pour toutes les machines visibles`}
                          style={{
                            flex: 1,
                            padding: '4px 0',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: sh.bg,
                            fontSize: 9,
                            fontWeight: 800,
                            color: sh.color,
                          }}
                        >
                          {sh.label.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {visibleMachines.map((mc, mi) => (
                <div
                  key={mc.id}
                  style={{
                    display: 'flex',
                    borderBottom: mi < visibleMachines.length - 1 ? '1px solid #F1F5F9' : 'none',
                    backgroundColor: mi % 2 === 0 ? '#fff' : '#FAFBFC',
                  }}
                >
                  <div
                    style={{
                      width: 200,
                      flexShrink: 0,
                      padding: '8px 12px',
                      borderRight: '1px solid #E5E7EB',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#64748B',
                        backgroundColor: '#F1F5F9',
                        padding: '1px 6px',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      {mc.short}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#1E293B',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {mc.name}
                      </div>
                      <div style={{ fontSize: 9, color: '#94A3B8' }}>{mc.group}</div>
                    </div>
                  </div>

                  {Array.from({ length: 7 }, (_, di) => (
                    <div
                      key={di}
                      style={{
                        flex: '1 1 0',
                        display: 'flex',
                        borderRight: di < 6 ? '1px solid #E5E7EB' : 'none',
                        minWidth: SHIFTS.length * 30,
                      }}
                    >
                      {SHIFTS_LIST.map((sh) => {
                        const open = !isClosed(mc.id, di, sh.id);
                        return (
                          <button
                            key={sh.id}
                            type="button"
                            onClick={() => toggle(mc.id, di, sh.id)}
                            title={`${mc.short} · ${DOW_FR_SHORT[di]} · ${sh.label} : ${open ? 'OUVERT' : 'FERMÉ'}`}
                            style={{
                              flex: 1,
                              height: 36,
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: open ? sh.bg : '#FAFBFC',
                              borderLeft: '1px solid #F1F5F9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.08s',
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: open ? sh.activeBg : '#E5E7EB',
                                border: open ? `1px solid ${sh.activeBorder}` : '1px solid #CBD5E1',
                                fontSize: 9,
                                fontWeight: 800,
                                color: open ? sh.color : '#94A3B8',
                              }}
                            >
                              {open ? '✓' : '✕'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              backgroundColor: '#F0F7FF',
              borderRadius: 8,
              border: '1px solid #DBEAFE',
            }}
          >
            <span style={{ fontSize: 14 }}>💡</span>
            <span style={{ fontSize: 11, color: '#1E40AF' }}>
              Une cellule fermée envoie une ligne fermée au serveur. Les créneaux ouverts sont l&apos;absence
              d&apos;enregistrement. Enregistrez pour appliquer la semaine active.
            </span>
          </div>
        </div>
      </div>

      {showDuplicate && (
        <div
          onClick={(e) => e.target === e.currentTarget && !saving && setShowDuplicate(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15,23,42,0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              width: 520,
              maxHeight: '80vh',
              boxShadow: '0 20px 56px rgba(0,0,0,0.18)',
              overflow: 'hidden',
              fontFamily: 'IBM Plex Sans, sans-serif',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18 }}>⎘</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                  Dupliquer la semaine {activeWeek}
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  Copie serveur vers les semaines cibles
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDuplicate(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  color: '#94A3B8',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '14px 20px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                  ['4 prochaines', 4],
                  ['Trimestre (12)', 12],
                  ["Reste de l'année", 53 - activeWeek],
                ].map(([lbl, n]) => (
                  <button
                    key={String(lbl)}
                    type="button"
                    onClick={() => {
                      const set = new Set<number>();
                      for (let i = 1; i <= Number(n); i++) if (activeWeek + i <= 53) set.add(activeWeek + i);
                      setDupTargets(set);
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #E5E7EB',
                      backgroundColor: '#fff',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#374151',
                    }}
                  >
                    {lbl}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDupTargets(new Set())}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: '#64748B',
                  }}
                >
                  Effacer
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
                {Array.from({ length: 53 - activeWeek }, (_, i) => activeWeek + 1 + i).map((wk) => {
                  const sel = dupTargets.has(wk);
                  const status = weekStatus(wk);
                  const sm = statusColors[status];
                  return (
                    <button
                      key={wk}
                      type="button"
                      onClick={() => {
                        const next = new Set(dupTargets);
                        if (next.has(wk)) next.delete(wk);
                        else next.add(wk);
                        setDupTargets(next);
                      }}
                      style={{
                        padding: '8px 6px',
                        borderRadius: 7,
                        border: sel ? `1.5px solid ${t.primaryBtn}` : '1px solid #E5E7EB',
                        backgroundColor: sel ? `${t.primaryBtn}15` : '#fff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontFamily: 'IBM Plex Sans, sans-serif',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: sel ? t.primaryBtn : '#1E293B',
                        }}
                      >
                        Sem. {wk}
                      </div>
                      <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>
                        {weekRange(year, wk)}
                      </div>
                      {(closedByWeek.get(wk)?.size ?? 0) > 0 && (
                        <div
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            marginTop: 3,
                            color: sm.color,
                            padding: '1px 4px',
                            borderRadius: 3,
                            backgroundColor: sm.bg,
                            display: 'inline-block',
                          }}
                        >
                          {sm.label}
                        </div>
                      )}
                      {sel && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 3,
                            right: 4,
                            fontSize: 11,
                            color: t.primaryBtn,
                            fontWeight: 800,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#FAFBFC',
              }}
            >
              <span style={{ fontSize: 11, color: '#64748B' }}>
                <strong style={{ color: dupTargets.size > 0 ? t.primaryBtn : '#94A3B8' }}>
                  {dupTargets.size}
                </strong>{' '}
                semaine{dupTargets.size > 1 ? 's' : ''} sélectionnée{dupTargets.size > 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <SecondaryBtn onClick={() => setShowDuplicate(false)}>Annuler</SecondaryBtn>
                <button
                  type="button"
                  onClick={applyDuplicate}
                  disabled={dupTargets.size === 0 || saving}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: dupTargets.size === 0 ? 'default' : 'pointer',
                    backgroundColor: dupTargets.size === 0 ? '#CBD5E1' : t.primaryBtn,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'IBM Plex Sans, sans-serif',
                  }}
                >
                  Dupliquer vers {dupTargets.size} sem.
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
