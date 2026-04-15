import { useState, useEffect, useMemo } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Copy, Trash2, Users, Factory, ArrowRightLeft } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format, startOfMonth, endOfMonth, getDaysInMonth, addMonths, subMonths, eachDayOfInterval, parseISO, startOfWeek, addWeeks, subWeeks, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

type Machine = { id: string; name: string; short_name: string | null; sort_order: number; machine_group: string | null; max_employees: number };
type Employee = { id: string; first_name: string; last_name: string; is_backup: boolean };
type Status = { id: string; name: string; color: string };
type DailyAssignment = { id: string; day_date: string; employee_id: string; machine_id: string; time_slot_id: string | null };
type EmployeeStatus = { id: string; day_date: string; employee_id: string; status_id: string };
type Skill = { employee_id: string; machine_id: string };
type TimeSlot = { id: string; name: string; short_name: string | null; color: string; sort_order: number };
type MachineDowntimeRow = { machine_id: string; day_date: string };
type MachineClosedWeekdayRow = { machine_id: string; weekday: number };
type DisplayShift = { id: string; name: string; short_name: string | null; color: string };

const DAY_ABBR = ["D", "L", "M", "M", "J", "V", "S"];
const JWT_STORAGE_KEY = "myrtest_jwt_token";

export default function Planning() {
  const { isAdmin, isManager } = useAuth();
  const { toast } = useToast();
  const canEditPlanning = isAdmin || isManager;
  const canUseAutoPlan = isAdmin || isManager;
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [machines, setMachines] = useState<Machine[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [dailyAssignments, setDailyAssignments] = useState<DailyAssignment[]>([]);
  const [empStatuses, setEmpStatuses] = useState<EmployeeStatus[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [machineDowntimes, setMachineDowntimes] = useState<MachineDowntimeRow[]>([]);
  const [machineClosedWeekdays, setMachineClosedWeekdays] = useState<MachineClosedWeekdayRow[]>([]);

  const monthStart = format(currentMonth, "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  const daysInMonth = getDaysInMonth(currentMonth);

  const [autoPlanFormOpen, setAutoPlanFormOpen] = useState(false);
  const [autoPlanPreviewOpen, setAutoPlanPreviewOpen] = useState(false);
  const [autoPlanFromDate, setAutoPlanFromDate] = useState(monthStart);
  const [autoPlanToDate, setAutoPlanToDate] = useState(monthEnd);
  const [autoPlanLoading, setAutoPlanLoading] = useState(false);
  const [autoPlanApproveLoading, setAutoPlanApproveLoading] = useState(false);
  const [autoPlanProposedAssignments, setAutoPlanProposedAssignments] = useState<DailyAssignment[]>([]);
  const [autoPlanRowsToSave, setAutoPlanRowsToSave] = useState<DailyAssignment[]>([]);
  const [autoPlanStats, setAutoPlanStats] = useState<Record<string, unknown> | null>(null);
  const [replanFormOpen, setReplanFormOpen] = useState(false);
  const [replanFromDate, setReplanFromDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [replanLoading, setReplanLoading] = useState(false);
  const [isReplanPreview, setIsReplanPreview] = useState(false);
  const [showChangesTable, setShowChangesTable] = useState(false);
  const [clearMonthDialogOpen, setClearMonthDialogOpen] = useState(false);
  const [clearMonthLoading, setClearMonthLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"employee" | "machine">("employee");
  const [previewViewMode, setPreviewViewMode] = useState<"employee" | "machine">("employee");
  const [mainViewRangeMode, setMainViewRangeMode] = useState<"month" | "week">("month");
  const [previewRangeMode, setPreviewRangeMode] = useState<"fullRange" | "week">("fullRange");
  const [mainWeekStart, setMainWeekStart] = useState<string | null>(null);
  const [previewWeekStart, setPreviewWeekStart] = useState<string | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeFilterTouched, setEmployeeFilterTouched] = useState(false);
  const [shiftRowVisible, setShiftRowVisible] = useState<Record<string, boolean>>({});
  const monthDays = useMemo(() =>
    eachDayOfInterval({ start: currentMonth, end: endOfMonth(currentMonth) }).map(d => format(d, "yyyy-MM-dd")),
    [currentMonth]
  );

  const previewDays = useMemo(() => {
    const start = parseISO(autoPlanFromDate);
    const end = parseISO(autoPlanToDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
    return eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"));
  }, [autoPlanFromDate, autoPlanToDate]);

  const fetchAll = async () => {
    const [m, e, s, sk, ts] = await Promise.all([
      supabase.from("luxlait_machines" as any).select("*").order("sort_order"),
      supabase.from("luxlait_employees" as any).select("*").eq("active", true),
      supabase.from("luxlait_statuses" as any).select("*").order("sort_order"),
      supabase.from("luxlait_employee_machine_skills" as any).select("employee_id, machine_id"),
      supabase.from("luxlait_time_slots" as any).select("*").order("sort_order"),
    ]);
    setMachines((m.data as any) ?? []);
    setEmployees((e.data as any) ?? []);
    setStatuses((s.data as any) ?? []);
    setSkills((sk.data as any) ?? []);
    setTimeSlots((ts.data as any) ?? []);

  };

  const fetchMonthData = async () => {
    const [a, es, dt, cw] = await Promise.all([
      supabase.from("luxlait_daily_assignments" as any).select("*").gte("day_date", monthStart).lte("day_date", monthEnd),
      supabase.from("luxlait_weekly_employee_statuses" as any).select("*").gte("day_date", monthStart).lte("day_date", monthEnd),
      supabase.from("luxlait_machine_downtimes" as any).select("machine_id, day_date").gte("day_date", monthStart).lte("day_date", monthEnd),
      supabase.from("luxlait_machine_closed_weekdays" as any).select("machine_id, weekday"),
    ]);
    setDailyAssignments((a.data as any) ?? []);
    setEmpStatuses((es.data as any) ?? []);
    setMachineDowntimes((dt.data as MachineDowntimeRow[]) ?? []);
    setMachineClosedWeekdays((cw.data as MachineClosedWeekdayRow[]) ?? []);
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchMonthData(); }, [monthStart]);
  useEffect(() => {
    setAutoPlanFromDate(monthStart);
    setAutoPlanToDate(monthEnd);
    const today = new Date();
    const isCurrentDisplayedMonth =
      today.getFullYear() === currentMonth.getFullYear() &&
      today.getMonth() === currentMonth.getMonth();
    setReplanFromDate(isCurrentDisplayedMonth ? format(today, "yyyy-MM-dd") : monthStart);
  }, [monthStart, monthEnd]);
  useEffect(() => {
    const today = new Date();
    const isCurrentDisplayedMonth =
      today.getFullYear() === currentMonth.getFullYear() &&
      today.getMonth() === currentMonth.getMonth();
    const defaultWeekRef = isCurrentDisplayedMonth ? format(today, "yyyy-MM-dd") : (monthDays[0] ?? null);
    setMainWeekStart(clampWeekStart(defaultWeekRef, monthDays));
  }, [monthDays, currentMonth]);
  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const hasTodayInPreviewRange = previewDays.includes(today);
    const defaultWeekRef = hasTodayInPreviewRange ? today : (previewDays[0] ?? null);
    setPreviewWeekStart(clampWeekStart(defaultWeekRef, previewDays));
  }, [previewDays]);
  useEffect(() => {
    if (!employees.length) {
      setSelectedEmployeeIds([]);
      return;
    }
    const allIds = employees.map((e) => e.id);
    if (!employeeFilterTouched) {
      setSelectedEmployeeIds(allIds);
      return;
    }
    const available = new Set(allIds);
    setSelectedEmployeeIds((prev) => prev.filter((id) => available.has(id)));
  }, [employees, employeeFilterTouched]);

  // Maps
  const assignmentMap = useMemo(() => {
    const m = new Map<string, DailyAssignment>();
    dailyAssignments.forEach((a) => m.set(`${a.employee_id}_${a.day_date}`, a));
    return m;
  }, [dailyAssignments]);

  const proposedAssignmentMap = useMemo(() => {
    const m = new Map<string, DailyAssignment>();
    autoPlanProposedAssignments.forEach((a) => m.set(`${a.employee_id}_${a.day_date}`, a));
    return m;
  }, [autoPlanProposedAssignments]);

  const empStatusMap = useMemo(() => {
    const m = new Map<string, string>();
    empStatuses.forEach((es) => m.set(`${es.employee_id}_${es.day_date}`, es.status_id));
    return m;
  }, [empStatuses]);
  const absentEmployeeDaySet = useMemo(() => {
    const s = new Set<string>();
    empStatuses.forEach((es) => {
      s.add(`${es.employee_id}_${es.day_date}`);
    });
    return s;
  }, [empStatuses]);

  const statusMap = useMemo(() => {
    const m = new Map<string, Status>();
    statuses.forEach((s) => m.set(s.id, s));
    return m;
  }, [statuses]);

  const machineMap = useMemo(() => {
    const m = new Map<string, Machine>();
    machines.forEach((mc) => m.set(mc.id, mc));
    return m;
  }, [machines]);

  const timeSlotMap = useMemo(() => {
    const m = new Map<string, TimeSlot>();
    timeSlots.forEach((ts) => m.set(ts.id, ts));
    return m;
  }, [timeSlots]);

  const displayShifts = useMemo<DisplayShift[]>(() => {
    const shifts = [...timeSlots]
      .filter((ts) => !`${ts.name} ${ts.short_name ?? ""}`.toLowerCase().includes("repos"))
      .sort((a, b) => a.sort_order - b.sort_order)
      .slice(0, 3)
      .map((ts) => ({ id: ts.id, name: ts.name, short_name: ts.short_name, color: ts.color }));
    while (shifts.length < 3) {
      shifts.push({
        id: `__empty_${shifts.length}`,
        name: `Shift ${shifts.length + 1}`,
        short_name: `S${shifts.length + 1}`,
        color: "#E5E7EB",
      });
    }
    return shifts;
  }, [timeSlots]);

  useEffect(() => {
    setShiftRowVisible((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const s of displayShifts) {
        if (next[s.id] === undefined) {
          next[s.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [displayShifts]);

  const visibleDisplayShifts = useMemo(
    () => displayShifts.filter((s) => shiftRowVisible[s.id] !== false),
    [displayShifts, shiftRowVisible]
  );

  const toggleShiftRowVisibility = (shiftId: string) => {
    setShiftRowVisible((prev) => {
      const cur = prev[shiftId] !== false;
      return { ...prev, [shiftId]: !cur };
    });
  };

  const machineDowntimeKeySet = useMemo(() => {
    const s = new Set<string>();
    machineDowntimes.forEach((d) => s.add(`${d.machine_id}_${d.day_date}`));
    for (const cw of machineClosedWeekdays) {
      for (const day of monthDays) {
        const weekday = new Date(`${day}T12:00:00.000Z`).getUTCDay();
        if (weekday === cw.weekday) s.add(`${cw.machine_id}_${day}`);
      }
    }
    return s;
  }, [machineDowntimes, machineClosedWeekdays, monthDays]);

  const skillSet = useMemo(() => {
    const s = new Set<string>();
    skills.forEach((sk) => s.add(`${sk.employee_id}_${sk.machine_id}`));
    return s;
  }, [skills]);

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [employees]
  );
  const selectedEmployeeIdSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);
  const filteredEmployees = useMemo(
    () => sortedEmployees.filter((emp) => selectedEmployeeIdSet.has(emp.id)),
    [sortedEmployees, selectedEmployeeIdSet]
  );

  const clampWeekStart = (candidate: string | null, days: string[]): string | null => {
    if (!days.length) return null;
    const firstDay = parseISO(days[0]);
    const lastDay = parseISO(days[days.length - 1]);
    const firstWeekStart = startOfWeek(firstDay, { weekStartsOn: 1 });
    const lastWeekStart = startOfWeek(lastDay, { weekStartsOn: 1 });
    const base = candidate ? parseISO(candidate) : firstDay;
    let next = startOfWeek(base, { weekStartsOn: 1 });
    if (next < firstWeekStart) next = firstWeekStart;
    if (next > lastWeekStart) next = lastWeekStart;
    return format(next, "yyyy-MM-dd");
  };

  const getVisibleWeekDays = (days: string[], weekStart: string | null): string[] => {
    if (!days.length) return [];
    const clampedWeekStart = clampWeekStart(weekStart, days);
    if (!clampedWeekStart) return days;
    const start = parseISO(clampedWeekStart);
    const end = addDays(start, 6);
    return days.filter((day) => {
      const d = parseISO(day);
      return d >= start && d <= end;
    });
  };

  const visibleMainDays = useMemo(() => {
    if (mainViewRangeMode === "month") return monthDays;
    return getVisibleWeekDays(monthDays, mainWeekStart);
  }, [monthDays, mainViewRangeMode, mainWeekStart]);

  const visiblePreviewDays = useMemo(() => {
    if (previewRangeMode === "fullRange") return previewDays;
    return getVisibleWeekDays(previewDays, previewWeekStart);
  }, [previewDays, previewRangeMode, previewWeekStart]);

  // Get machines an employee is qualified for
  const getQualifiedMachines = (employeeId: string) => {
    return machines.filter((m) => skillSet.has(`${employeeId}_${m.id}`));
  };

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    employees.forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  const assignmentsByMachineDay = useMemo(() => {
    const m = new Map<string, DailyAssignment[]>();
    dailyAssignments.forEach((a) => {
      if (absentEmployeeDaySet.has(`${a.employee_id}_${a.day_date}`)) return;
      const key = `${a.machine_id}_${a.day_date}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    });
    return m;
  }, [dailyAssignments, absentEmployeeDaySet]);

  const proposedByMachineDay = useMemo(() => {
    const m = new Map<string, DailyAssignment[]>();
    autoPlanProposedAssignments.forEach((a) => {
      if (absentEmployeeDaySet.has(`${a.employee_id}_${a.day_date}`)) return;
      const key = `${a.machine_id}_${a.day_date}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    });
    return m;
  }, [autoPlanProposedAssignments, absentEmployeeDaySet]);
  const filteredAssignmentsByMachineDay = useMemo(() => {
    const m = new Map<string, DailyAssignment[]>();
    assignmentsByMachineDay.forEach((rows, key) => {
      m.set(key, rows.filter((a) => selectedEmployeeIdSet.has(a.employee_id)));
    });
    return m;
  }, [assignmentsByMachineDay, selectedEmployeeIdSet]);
  const filteredProposedByMachineDay = useMemo(() => {
    const m = new Map<string, DailyAssignment[]>();
    proposedByMachineDay.forEach((rows, key) => {
      m.set(key, rows.filter((a) => selectedEmployeeIdSet.has(a.employee_id)));
    });
    return m;
  }, [proposedByMachineDay, selectedEmployeeIdSet]);

  const machineGroups = useMemo(() => {
    const groupMap = new Map<string, Machine[]>();
    machines.forEach((m) => {
      const g = m.machine_group || "Other";
      if (!groupMap.has(g)) groupMap.set(g, []);
      groupMap.get(g)!.push(m);
    });
    return Array.from(groupMap.entries())
      .map(([group, machs]) => ({ group, machines: machs }))
      .sort((a, b) => {
        if (a.group === "Other") return 1;
        if (b.group === "Other") return -1;
        const aMin = Math.min(...a.machines.map((m) => m.sort_order));
        const bMin = Math.min(...b.machines.map((m) => m.sort_order));
        return aMin - bMin;
      });
  }, [machines]);

  // Handlers
  const handleAssign = async (employeeId: string, dayDate: string, machineId: string | null, timeSlotId: string | null) => {
    const existing = assignmentMap.get(`${employeeId}_${dayDate}`);
    if (machineId === null && existing) {
      await supabase.from("luxlait_daily_assignments" as any).delete().eq("id", existing.id);
    } else if (machineId && existing) {
      await supabase.from("luxlait_daily_assignments" as any).update({ machine_id: machineId, time_slot_id: timeSlotId }).eq("id", existing.id);
    } else if (machineId) {
      await supabase.from("luxlait_daily_assignments" as any).insert({
        day_date: dayDate,
        employee_id: employeeId,
        machine_id: machineId,
        time_slot_id: timeSlotId,
      });
    }
    fetchMonthData();
  };

  const handleSetDayStatus = async (employeeId: string, dayDate: string, statusId: string | null) => {
    const existing = empStatuses.find((es) => es.employee_id === employeeId && es.day_date === dayDate);
    if (statusId === null && existing) {
      await supabase.from("luxlait_weekly_employee_statuses" as any).delete().eq("id", existing.id);
    } else if (statusId && existing) {
      await supabase.from("luxlait_weekly_employee_statuses" as any).update({ status_id: statusId }).eq("id", existing.id);
    } else if (statusId) {
      await supabase.from("luxlait_weekly_employee_statuses" as any).insert({ day_date: dayDate, employee_id: employeeId, status_id: statusId });
    }
    fetchMonthData();
  };

  const duplicateMonth = async () => {
    const prevMonth = subMonths(currentMonth, 1);
    const prevStart = format(startOfMonth(prevMonth), "yyyy-MM-dd");
    const prevEnd = format(endOfMonth(prevMonth), "yyyy-MM-dd");
    const { data: prevAssignments } = await supabase.from("luxlait_daily_assignments" as any).select("*").gte("day_date", prevStart).lte("day_date", prevEnd);
    if (!prevAssignments?.length) {
      toast({ title: "Aucune donnée", description: "Pas de planning le mois précédent.", variant: "destructive" });
      return;
    }
    // Map day-of-month from previous month to current month
    const inserts = (prevAssignments as unknown as DailyAssignment[]).map((a) => {
      const dayOfMonth = parseInt(a.day_date.split("-")[2]);
      const clampedDay = Math.min(dayOfMonth, daysInMonth);
      const newDate = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), clampedDay), "yyyy-MM-dd");
      return {
        day_date: newDate,
        employee_id: a.employee_id,
        machine_id: a.machine_id,
        time_slot_id: a.time_slot_id,
      };
    });
    const { error } = await supabase.from("luxlait_daily_assignments" as any).upsert(inserts, { onConflict: "day_date,employee_id" });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Planning dupliqué depuis le mois précédent." });
      fetchMonthData();
    }
  };

  const requestAutoPlan = async () => {
    if (!canUseAutoPlan) return;

    const token = localStorage.getItem(JWT_STORAGE_KEY);
    if (!token) {
      toast({ title: "Authentication required", description: "Please sign in again.", variant: "destructive" });
      return;
    }

    const from = parseISO(autoPlanFromDate);
    const to = parseISO(autoPlanToDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      toast({ title: "Invalid date range", description: "Please choose a valid range.", variant: "destructive" });
      return;
    }

    // Keep auto planning within the visible month for now.
    const monthStartDate = parseISO(monthStart);
    const monthEndDate = parseISO(monthEnd);
    if (from < monthStartDate || to > monthEndDate) {
      toast({ title: "Range out of bounds", description: "Auto Plan is limited to the current month.", variant: "destructive" });
      return;
    }

    setAutoPlanLoading(true);
    try {
      const response = await fetch("/api/planning/auto_plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromDate: autoPlanFromDate,
          toDate: autoPlanToDate,
          lockExisting: true,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json?.ok) {
        toast({
          title: "Auto Plan failed",
          description: json?.error ? String(json.error) : "Solver returned an error",
          variant: "destructive",
        });
        return;
      }

      const proposed = (json.assignments ?? []).map((a: any) => ({
        id: `preview_${a.employee_id}_${a.day_date}`,
        day_date: a.day_date,
        employee_id: a.employee_id,
        machine_id: a.machine_id,
        time_slot_id: a.time_slot_id ?? null,
      })) as DailyAssignment[];

      if (proposed.length === 0) {
        toast({
          title: "No assignment generated",
          description:
            "Solver returned an empty plan. Check active employees, machine skills, machine open shifts, and machine importance.",
          variant: "destructive",
        });
        return;
      }

      setAutoPlanProposedAssignments(proposed);
      setAutoPlanRowsToSave(proposed);
      setAutoPlanStats(json.stats ?? null);
      setIsReplanPreview(false);
      setShowChangesTable(false);
      setAutoPlanPreviewOpen(true);
      setAutoPlanFormOpen(false);
    } catch (e) {
      toast({ title: "Network error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    } finally {
      setAutoPlanLoading(false);
    }
  };

  const requestReplan = async () => {
    if (!canUseAutoPlan) return;

    const token = localStorage.getItem(JWT_STORAGE_KEY);
    if (!token) {
      toast({ title: "Authentication required", description: "Please sign in again.", variant: "destructive" });
      return;
    }

    const replanDate = parseISO(replanFromDate);
    if (Number.isNaN(replanDate.getTime())) {
      toast({ title: "Date invalide", description: "Choisissez une date valide.", variant: "destructive" });
      return;
    }

    const monthStartDate = parseISO(monthStart);
    const monthEndDate = parseISO(monthEnd);
    if (replanDate < monthStartDate || replanDate > monthEndDate) {
      toast({ title: "Date hors limites", description: "La date doit être dans le mois courant.", variant: "destructive" });
      return;
    }

    setReplanLoading(true);
    try {
      const response = await fetch("/api/planning/auto_plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          replanFromDate: replanFromDate,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json?.ok) {
        toast({
          title: "Re-Plan failed",
          description: json?.error ? String(json.error) : "Solver returned an error",
          variant: "destructive",
        });
        return;
      }

      const solverRows = (json.assignments ?? []).map((a: any) => ({
        id: `preview_${a.employee_id}_${a.day_date}`,
        day_date: a.day_date,
        employee_id: a.employee_id,
        machine_id: a.machine_id,
        time_slot_id: a.time_slot_id ?? null,
      })) as DailyAssignment[];

      const solverDays = new Set(solverRows.map((a) => a.day_date));

      const merged = [
        ...dailyAssignments
          .filter((a) => a.day_date >= replanFromDate && !solverDays.has(a.day_date))
          .map((a) => ({ ...a, id: `preview_${a.employee_id}_${a.day_date}` })),
        ...solverRows,
      ] as DailyAssignment[];

      const actualChanges = solverRows.filter((a) => {
        const existing = dailyAssignments.find(
          (e) => e.employee_id === a.employee_id && e.day_date === a.day_date
        );
        if (!existing) return true;
        return existing.machine_id !== a.machine_id || existing.time_slot_id !== a.time_slot_id;
      });

      if (actualChanges.length === 0 && solverRows.length === 0) {
        toast({
          title: "Aucun changement nécessaire",
          description: "Le planning actuel est déjà optimal.",
        });
        return;
      }

      setAutoPlanFromDate(replanFromDate);
      setAutoPlanToDate(monthEnd);
      setAutoPlanProposedAssignments(merged);
      setAutoPlanRowsToSave(solverRows);
      setAutoPlanStats(json.stats ?? null);
      setIsReplanPreview(true);
      setShowChangesTable(false);
      setAutoPlanPreviewOpen(true);
      setReplanFormOpen(false);
    } catch (e) {
      toast({ title: "Network error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    } finally {
      setReplanLoading(false);
    }
  };

  const approveAutoPlan = async () => {
    const token = localStorage.getItem(JWT_STORAGE_KEY);
    if (!token) return;

    setAutoPlanApproveLoading(true);
    try {
      const response = await fetch("/api/planning/luxlait_daily_assignments/bulk_upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rows: autoPlanRowsToSave.map((a) => ({
            day_date: a.day_date,
            employee_id: a.employee_id,
            machine_id: a.machine_id,
            time_slot_id: a.time_slot_id || null,
          })),
        }),
      });

      const json = await response.json();
      if (!response.ok || !json?.ok) {
        toast({
          title: "Save failed",
          description: json?.detail
            ? `${String(json.error ?? "Bulk upsert returned an error")} (${String(json.detail)})`
            : json?.error
              ? String(json.error)
              : "Bulk upsert returned an error",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Auto Plan saved", description: "Assignments were updated successfully." });
      setAutoPlanPreviewOpen(false);
      setAutoPlanProposedAssignments([]);
      await fetchMonthData();
    } catch (e) {
      toast({ title: "Network error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    } finally {
      setAutoPlanApproveLoading(false);
    }
  };

  const shiftMainWeek = (delta: -1 | 1) => {
    const base = clampWeekStart(mainWeekStart, monthDays);
    if (!base) return;
    setMainWeekStart(clampWeekStart(format((delta < 0 ? subWeeks : addWeeks)(parseISO(base), 1), "yyyy-MM-dd"), monthDays));
  };

  const shiftPreviewWeek = (delta: -1 | 1) => {
    const base = clampWeekStart(previewWeekStart, previewDays);
    if (!base) return;
    setPreviewWeekStart(clampWeekStart(format((delta < 0 ? subWeeks : addWeeks)(parseISO(base), 1), "yyyy-MM-dd"), previewDays));
  };

  const toggleEmployee = (employeeId: string) => {
    setEmployeeFilterTouched(true);
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId]
    );
  };

  const selectAllEmployees = () => {
    setEmployeeFilterTouched(true);
    setSelectedEmployeeIds(sortedEmployees.map((e) => e.id));
  };

  const clearAllEmployees = () => {
    setEmployeeFilterTouched(true);
    setSelectedEmployeeIds([]);
  };

  const clearDisplayedMonthPlanning = async () => {
    const token = localStorage.getItem(JWT_STORAGE_KEY);
    if (!token) {
      toast({ title: "Authentification requise", description: "Reconnectez vous.", variant: "destructive" });
      return;
    }
    setClearMonthLoading(true);
    try {
      const response = await fetch("/api/planning/clear_month_planning_test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fromDate: monthStart, toDate: monthEnd }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        toast({
          title: "Échec",
          description: json?.error ? String(json.error) : "Impossible de vider le planning",
          variant: "destructive",
        });
        return;
      }
      setClearMonthDialogOpen(false);
      toast({
        title: "Planning vidé",
        description: `Plage ${monthStart} → ${monthEnd}. Assignations et statuts supprimés (test).`,
      });
      await fetchMonthData();
    } catch (e) {
      toast({
        title: "Erreur réseau",
        description: e instanceof Error ? e.message : "Échec de la requête",
        variant: "destructive",
      });
    } finally {
      setClearMonthLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: fr })}
        </div>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={duplicateMonth}>
            <Copy className="h-4 w-4 mr-1" /> Dupliquer mois précédent
          </Button>
        )}
        {isAdmin && (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setClearMonthDialogOpen(true)}
              disabled={clearMonthLoading}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Vider le mois (test)
            </Button>
            <AlertDialog open={clearMonthDialogOpen} onOpenChange={setClearMonthDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Vider le planning du mois affiché ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Supprime pour {format(currentMonth, "MMMM yyyy", { locale: fr })} ({monthStart} au {monthEnd}) les
                    assignations quotidiennes, les statuts employés, les indisponibilités machines sur cette plage, et les
                    règles associées par jour. Réservé aux tests.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={clearMonthLoading}>Annuler</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    disabled={clearMonthLoading}
                    onClick={() => void clearDisplayedMonthPlanning()}
                  >
                    {clearMonthLoading ? "Suppression…" : "Tout supprimer"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
        {canUseAutoPlan && (
          <Button variant="outline" size="sm" onClick={() => setAutoPlanFormOpen(true)} disabled={autoPlanLoading}>
            Auto Plan
          </Button>
        )}
        {canUseAutoPlan && dailyAssignments.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setReplanFormOpen(true)} disabled={replanLoading}>
            Re-Plan
          </Button>
        )}
        <ToggleGroup
          type="single"
          value={mainViewRangeMode}
          onValueChange={(v) => { if (v) setMainViewRangeMode(v as "month" | "week"); }}
          size="sm"
          variant="outline"
        >
          <ToggleGroupItem value="month" className="text-xs">Mois</ToggleGroupItem>
          <ToggleGroupItem value="week" className="text-xs">Semaine</ToggleGroupItem>
        </ToggleGroup>
        {mainViewRangeMode === "week" && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMainWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMainWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        <EmployeeFilterPopover
          employees={sortedEmployees}
          selectedEmployeeIds={selectedEmployeeIds}
          onToggleEmployee={toggleEmployee}
          onSelectAll={selectAllEmployees}
          onClearAll={clearAllEmployees}
        />
        <div className="ml-auto">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => { if (v) setViewMode(v as "employee" | "machine"); }}
            size="sm"
            variant="outline"
          >
            <ToggleGroupItem value="employee" className="text-xs gap-1">
              <Users className="h-3.5 w-3.5" /> Employees
            </ToggleGroupItem>
            <ToggleGroupItem value="machine" className="text-xs gap-1">
              <Factory className="h-3.5 w-3.5" /> Machines
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Legends */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground">Statuts:</span>
          {statuses.map((s) => (
            <Badge key={s.id} style={{ backgroundColor: s.color, color: "#fff" }} className="border-0">
              {s.name}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground">Créneaux:</span>
          {timeSlots.map((ts) => (
            <Badge key={ts.id} style={{ backgroundColor: ts.color, color: ts.name === "Nuit" ? "#fff" : "#1f2937" }} className="border-0">
              {ts.name}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs font-medium text-muted-foreground">Lignes shift:</span>
          {displayShifts.map((s) => {
            const label = s.short_name || s.name;
            const checked = shiftRowVisible[s.id] !== false;
            return (
              <label
                key={s.id}
                className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleShiftRowVisibility(s.id)}
                  className="h-3.5 w-3.5"
                />
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 border border-border/60"
                  style={{ backgroundColor: `${s.color}28` }}
                >
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Planning grid */}
      {viewMode === "employee" ? (
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-2 text-left font-medium text-muted-foreground min-w-[160px] sticky left-0 bg-muted/50 z-10 border-r">
                Employé
              </th>
              {visibleMainDays.map((day) => {
                const d = new Date(day + "T00:00:00");
                const dayNum = d.getDate();
                const dayOfWeek = d.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                return (
                  <th
                    key={day}
                    className={`p-1 text-center font-medium min-w-[60px] ${isWeekend ? "bg-muted" : ""}`}
                  >
                    <div className="text-muted-foreground text-[9px]">{DAY_ABBR[dayOfWeek]}</div>
                    <div className="text-xs">{dayNum}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => (
              <tr key={emp.id} className="border-b hover:bg-muted/30">
                <td className="p-1 font-medium sticky left-0 bg-card z-10 border-r text-xs whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {emp.is_backup && <span className="text-[8px] font-bold text-muted-foreground" title="Back Up">◆</span>}
                    {emp.first_name} {emp.last_name}
                  </div>
                </td>
                {visibleMainDays.map((day) => {
                  const d = new Date(day + "T00:00:00");
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <PlanningCell
                      key={day}
                      employee={emp}
                      dayDate={day}
                      canEditPlanning={canEditPlanning}
                      isWeekend={isWeekend}
                      assignment={assignmentMap.get(`${emp.id}_${day}`) ?? null}
                      statusId={empStatusMap.get(`${emp.id}_${day}`) ?? null}
                      statusMap={statusMap}
                      statuses={statuses}
                      machineMap={machineMap}
                      timeSlotMap={timeSlotMap}
                      qualifiedMachines={getQualifiedMachines(emp.id).filter(
                        (m) => !machineDowntimeKeySet.has(`${m.id}_${day}`)
                      )}
                      machineDowntimeKeySet={machineDowntimeKeySet}
                      timeSlots={timeSlots}
                      onAssign={handleAssign}
                      onSetStatus={handleSetDayStatus}
                      displayShifts={visibleDisplayShifts}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : (
        <MachineGrid
          days={visibleMainDays}
          machineGroups={machineGroups}
          getAssignments={(key) => filteredAssignmentsByMachineDay.get(key) ?? []}
          employeeMap={employeeMap}
          machineDowntimeKeySet={machineDowntimeKeySet}
          spacious={false}
          displayShifts={visibleDisplayShifts}
          canEditPlanning={canEditPlanning}
          onAssign={handleAssign}
          assignmentByEmployeeDay={assignmentMap}
          skillSet={skillSet}
          employeesForPicker={filteredEmployees}
          absentEmployeeDaySet={absentEmployeeDaySet}
        />
      )}
      
    {/* Auto Plan form dialog */}
    <Dialog open={autoPlanFormOpen} onOpenChange={setAutoPlanFormOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Auto Plan</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">From</div>
              <Input
                type="date"
                value={autoPlanFromDate}
                onChange={(e) => setAutoPlanFromDate(e.target.value)}
                disabled={autoPlanLoading}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">To</div>
              <Input
                type="date"
                value={autoPlanToDate}
                onChange={(e) => setAutoPlanToDate(e.target.value)}
                disabled={autoPlanLoading}
              />
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            You will review the proposed assignments first, then approve to save them.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAutoPlanFormOpen(false)} disabled={autoPlanLoading}>
            Cancel
          </Button>
          <Button onClick={requestAutoPlan} disabled={autoPlanLoading}>
            {autoPlanLoading ? "Solving..." : "Run Auto Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Re-Plan form dialog */}
    <Dialog open={replanFormOpen} onOpenChange={setReplanFormOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Re-Plan</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Re-calculer le planning à partir d'une date. Les assignations avant cette date sont verrouillées. Le solveur minimise les changements par rapport au planning actuel.
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Re-planifier à partir du</div>
            <Input
              type="date"
              value={replanFromDate}
              min={monthStart}
              max={monthEnd}
              onChange={(e) => setReplanFromDate(e.target.value)}
              disabled={replanLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setReplanFormOpen(false)} disabled={replanLoading}>
            Cancel
          </Button>
          <Button onClick={requestReplan} disabled={replanLoading}>
            {replanLoading ? "Solving..." : "Run Re-Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Auto Plan preview dialog */}
    <Dialog
      open={autoPlanPreviewOpen}
      onOpenChange={(open) => {
        if (!open) {
          setAutoPlanPreviewOpen(false);
          setAutoPlanProposedAssignments([]);
          setAutoPlanRowsToSave([]);
          setPreviewViewMode("employee");
          setIsReplanPreview(false);
          setShowChangesTable(false);
        }
      }}
    >
      <DialogContent className="w-[98vw] sm:w-[96vw] max-w-[1400px] h-[92vh] max-h-[92vh] p-3 sm:p-4 flex flex-col">
        <DialogHeader className="space-y-3 pb-1">
          <DialogTitle className="text-base sm:text-lg">{isReplanPreview ? "Preview Re-Plan" : "Preview Auto Plan"}</DialogTitle>
          <div className="w-full overflow-x-auto">
            <div className="min-w-max flex items-center gap-3 justify-between">
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                {autoPlanStats?.durationMs ? `Solver duration: ${String(autoPlanStats.durationMs)} ms` : null}
              </div>
              <div className="shrink-0">
                <div className="flex items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={previewRangeMode}
                    onValueChange={(v) => { if (v) setPreviewRangeMode(v as "fullRange" | "week"); }}
                    size="sm"
                    variant="outline"
                  >
                    <ToggleGroupItem value="fullRange" className="text-sm px-3">Période</ToggleGroupItem>
                    <ToggleGroupItem value="week" className="text-sm px-3">Semaine</ToggleGroupItem>
                  </ToggleGroup>
                  {previewRangeMode === "week" && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftPreviewWeek(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftPreviewWeek(1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <ToggleGroup
                    type="single"
                    value={previewViewMode}
                    onValueChange={(v) => { if (v) setPreviewViewMode(v as "employee" | "machine"); }}
                    size="sm"
                    variant="outline"
                  >
                    <ToggleGroupItem value="employee" className="text-sm gap-1.5 px-3">
                      <Users className="h-4 w-4" /> Employees
                    </ToggleGroupItem>
                    <ToggleGroupItem value="machine" className="text-sm gap-1.5 px-3">
                      <Factory className="h-4 w-4" /> Machines
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <EmployeeFilterPopover
                    employees={sortedEmployees}
                    selectedEmployeeIds={selectedEmployeeIds}
                    onToggleEmployee={toggleEmployee}
                    onSelectAll={selectAllEmployees}
                    onClearAll={clearAllEmployees}
                    compact
                  />
                  {isReplanPreview && (
                    <Button
                      variant={showChangesTable ? "default" : "outline"}
                      size="sm"
                      className="text-sm gap-1.5 px-3"
                      onClick={() => setShowChangesTable((v) => !v)}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      Changements
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
          {showChangesTable && isReplanPreview ? (
            <ReplanChangesTable
              existingAssignments={dailyAssignments}
              proposedAssignments={autoPlanProposedAssignments}
              fromDate={autoPlanFromDate}
              toDate={autoPlanToDate}
              employeeMap={employeeMap}
              machineMap={machineMap}
              timeSlotMap={timeSlotMap}
            />
          ) : previewViewMode === "employee" ? (
          <div className="overflow-x-auto rounded-lg border border-border/40 bg-card/40">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/40">
                  <th className="p-3 text-left font-medium text-muted-foreground min-w-[220px] sticky left-0 bg-muted/50 z-10 border-r">
                    Employee
                  </th>
                  {visiblePreviewDays.map((day) => {
                    const d = new Date(day + "T00:00:00");
                    const dayNum = d.getDate();
                    const dayOfWeek = d.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    return (
                      <th key={day} className={`p-2 text-center font-medium min-w-[84px] ${isWeekend ? "bg-muted" : ""}`}>
                        <div className="text-muted-foreground text-xs">{DAY_ABBR[dayOfWeek]}</div>
                        <div className="text-sm">{dayNum}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="p-2 font-medium sticky left-0 bg-card z-10 border-r text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {emp.is_backup && (
                          <span className="text-[8px] font-bold text-muted-foreground" title="Backup">
                            ◆
                          </span>
                        )}
                        {emp.first_name} {emp.last_name}
                      </div>
                    </td>
                    {visiblePreviewDays.map((day) => {
                      const key = `${emp.id}_${day}`;
                      const existing = assignmentMap.get(key) ?? null;
                      const proposed = proposedAssignmentMap.get(key) ?? null;
                      const isDifferent =
                        (existing?.machine_id ?? null) !== (proposed?.machine_id ?? null) ||
                        (existing?.time_slot_id ?? null) !== (proposed?.time_slot_id ?? null);
                      const d = new Date(day + "T00:00:00");
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <PlanningCell
                          key={day}
                          employee={emp}
                          dayDate={day}
                          canEditPlanning={false}
                          isWeekend={isWeekend}
                          assignment={proposed}
                          statusId={empStatusMap.get(key) ?? null}
                          statusMap={statusMap}
                          statuses={statuses}
                          machineMap={machineMap}
                          timeSlotMap={timeSlotMap}
                          qualifiedMachines={getQualifiedMachines(emp.id).filter(
                            (m) => !machineDowntimeKeySet.has(`${m.id}_${day}`)
                          )}
                          machineDowntimeKeySet={machineDowntimeKeySet}
                          timeSlots={timeSlots}
                          onAssign={(_empId, _day, _machineId, _timeSlotId) => undefined}
                          onSetStatus={(_empId, _day, _statusId) => undefined}
                          isProposedChange={isDifferent}
                          spacious
                          displayShifts={visibleDisplayShifts}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : (
            <MachineGrid
              days={visiblePreviewDays}
              machineGroups={machineGroups}
              getAssignments={(key) => filteredProposedByMachineDay.get(key) ?? []}
              getExistingAssignments={(key) => filteredAssignmentsByMachineDay.get(key) ?? []}
              employeeMap={employeeMap}
              machineDowntimeKeySet={machineDowntimeKeySet}
              showChanges
              spacious
              displayShifts={visibleDisplayShifts}
              canEditPlanning={false}
              onAssign={() => undefined}
              assignmentByEmployeeDay={new Map()}
              skillSet={new Set()}
              employeesForPicker={[]}
              absentEmployeeDaySet={new Set()}
            />
          )}

          <div className="w-full overflow-x-auto pt-2 border-t border-border/40">
            <div className="min-w-max flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => { setAutoPlanPreviewOpen(false); setAutoPlanProposedAssignments([]); }}>
              Cancel
              </Button>
              <Button onClick={approveAutoPlan} disabled={autoPlanApproveLoading}>
                {autoPlanApproveLoading ? "Saving..." : "Approve and Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}

/* ---- Cell component ---- */

function PlanningCell({
  employee,
  dayDate,
  canEditPlanning,
  isWeekend,
  assignment,
  statusId,
  statusMap,
  statuses,
  machineMap,
  timeSlotMap,
  qualifiedMachines,
  machineDowntimeKeySet,
  timeSlots,
  onAssign,
  onSetStatus,
  isProposedChange,
  spacious,
  displayShifts,
}: {
  employee: Employee;
  dayDate: string;
  canEditPlanning: boolean;
  isWeekend: boolean;
  assignment: DailyAssignment | null;
  statusId: string | null;
  statusMap: Map<string, Status>;
  statuses: Status[];
  machineMap: Map<string, Machine>;
  timeSlotMap: Map<string, TimeSlot>;
  qualifiedMachines: Machine[];
  machineDowntimeKeySet: Set<string>;
  timeSlots: TimeSlot[];
  onAssign: (empId: string, day: string, machineId: string | null, timeSlotId: string | null) => void;
  onSetStatus: (empId: string, day: string, statusId: string | null) => void;
  isProposedChange?: boolean;
  spacious?: boolean;
  displayShifts: DisplayShift[];
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [pendingShiftId, setPendingShiftId] = useState<string | null>(null);

  const NO_MACHINE_VALUE = "__none_machine__";
  const REMOVE_MACHINE_VALUE = "__remove__";
  const NO_TIME_SLOT_VALUE = "__none__";
  const status = statusId ? statusMap.get(statusId) : null;
  const machine = assignment ? machineMap.get(assignment.machine_id) : null;
  const timeSlot = assignment?.time_slot_id ? timeSlotMap.get(assignment.time_slot_id) : null;
  const assignedMachineIsQualified = assignment
    ? qualifiedMachines.some((m) => m.id === assignment.machine_id)
    : true;
  const machineOnDowntime = assignment
    ? machineDowntimeKeySet.has(`${assignment.machine_id}_${dayDate}`)
    : false;

  const isPlaceholderShift = (id: string) => id.startsWith("__empty_");
  const firstRealShiftId = displayShifts.find((s) => !isPlaceholderShift(s.id))?.id ?? null;
  const slotWhenChoosingMachine =
    assignment?.time_slot_id ?? pendingShiftId ?? firstRealShiftId ?? null;

  const cellBg = status
    ? status.color
    : isWeekend
      ? "hsl(var(--muted))"
      : undefined;

  const openPopoverWithShift = (shiftId: string | null) => {
    setPendingShiftId(shiftId);
    setPopoverOpen(true);
  };

  const onPopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (!open) setPendingShiftId(null);
  };

  const cellContent = () => {
    if (status) {
      return (
        <span className={`${spacious ? "text-[10px]" : "text-[8px]"} font-bold`} style={{ color: "#fff" }}>
          {status.name.substring(0, 3)}
        </span>
      );
    }
    return (
      <div className="w-full">
        {displayShifts.map((shift, idx) => {
          const active = !!assignment && assignment.time_slot_id === shift.id;
          const machineLabel = machine ? (machine.short_name || machine.name) : "";
          return (
            <div
              key={shift.id}
              className={`flex items-center justify-between px-1 ${spacious ? "h-3.5 text-[9px]" : "h-3 text-[8px]"} ${idx < displayShifts.length - 1 ? "border-b border-border/30" : ""}`}
              style={{ backgroundColor: active ? `${shift.color}40` : "transparent" }}
              title={shift.name}
            >
              <span className="font-medium">{shift.short_name || shift.name}</span>
              <span className="truncate max-w-[42px]">{active ? machineLabel : "·"}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (!canEditPlanning) {
    return (
      <td
        className={`p-0 text-center border-r border-border/30 ${isProposedChange ? "ring-1 ring-red-500 ring-inset" : ""}`}
        style={cellBg ? { backgroundColor: cellBg } : {}}
      >
        <div className={`flex items-center justify-center ${spacious ? "h-10" : "h-8"}`}>
          {cellContent()}
        </div>
      </td>
    );
  }

  const formBody = (
    <div className="space-y-2">
      <div>
        <div className="text-[10px] font-medium text-muted-foreground mb-1">Machine</div>
        <Select
          value={assignment?.machine_id ?? NO_MACHINE_VALUE}
          onValueChange={(val) => {
            if (val === REMOVE_MACHINE_VALUE || val === NO_MACHINE_VALUE) {
              onAssign(employee.id, dayDate, null, null);
            } else {
              onAssign(employee.id, dayDate, val, slotWhenChoosingMachine);
            }
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Aucune">{machine ? machine.name : "Aucune"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_MACHINE_VALUE} className="text-xs">Aucune</SelectItem>
            {assignment && <SelectItem value={REMOVE_MACHINE_VALUE} className="text-destructive text-xs">Retirer</SelectItem>}
            {qualifiedMachines.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
            ))}
            {assignment && machine && (!assignedMachineIsQualified || machineOnDowntime) && (
              <SelectItem
                value={machine.id}
                className="text-xs opacity-60"
                disabled
              >
                {machine.name} (current)
                {machineOnDowntime ? " — arrêt" : ""}
              </SelectItem>
            )}
            {qualifiedMachines.length === 0 && (
              <SelectItem value="__no_qualified_machine__" className="text-xs text-muted-foreground" disabled>
                Aucune machine qualifiée
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {assignment && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground mb-1">Créneau</div>
          <Select
            value={assignment.time_slot_id ?? NO_TIME_SLOT_VALUE}
            onValueChange={(val) => {
              const slotId = val === NO_TIME_SLOT_VALUE ? null : val;
              onAssign(employee.id, dayDate, assignment.machine_id, slotId);
            }}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Aucun">
                {timeSlot ? timeSlot.name : "Aucun"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TIME_SLOT_VALUE} className="text-xs">Aucun</SelectItem>
              {timeSlots.map((ts) => (
                <SelectItem key={ts.id} value={ts.id} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ts.color }} />
                    {ts.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <div className="text-[10px] font-medium text-muted-foreground mb-1">Statut</div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={`text-[10px] px-1.5 py-0.5 rounded border ${!statusId ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => onSetStatus(employee.id, dayDate, null)}
          >
            Normal
          </button>
          {statuses.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`text-[10px] px-1.5 py-0.5 rounded border ${statusId === s.id ? "ring-2 ring-ring" : "hover:bg-muted"}`}
              style={{ backgroundColor: s.color, color: "#fff" }}
              onClick={() => onSetStatus(employee.id, dayDate, s.id)}
            >
              {s.name.substring(0, 4)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <td
      className={`p-0 text-center border-r border-border/30 ${isProposedChange ? "ring-1 ring-red-500 ring-inset" : ""}`}
      style={cellBg ? { backgroundColor: cellBg } : {}}
    >
      <Popover open={popoverOpen} onOpenChange={onPopoverOpenChange}>
        <PopoverAnchor asChild>
          <div
            className={`flex flex-col w-full ${spacious ? "min-h-11" : "min-h-9"} ${status ? "items-center justify-center" : ""}`}
          >
            {status ? (
              <button
                type="button"
                className={`w-full flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer ${spacious ? "min-h-11" : "min-h-9"}`}
                onClick={() => openPopoverWithShift(firstRealShiftId)}
              >
                {cellContent()}
              </button>
            ) : (
              displayShifts.map((shift, idx) => {
                const active = !!assignment && assignment.time_slot_id === shift.id;
                const machineLabel = machine ? (machine.short_name || machine.name) : "";
                const placeholder = isPlaceholderShift(shift.id);
                return (
                  <button
                    key={shift.id}
                    type="button"
                    className={`w-full flex items-center justify-between px-1 hover:opacity-90 transition-opacity cursor-pointer ${spacious ? "h-3.5 text-[9px]" : "h-3 text-[8px]"} ${idx < displayShifts.length - 1 ? "border-b border-border/30" : ""}`}
                    style={{ backgroundColor: active ? `${shift.color}40` : "transparent" }}
                    title={placeholder ? undefined : `${shift.name}: assigner`}
                    onClick={() => openPopoverWithShift(placeholder ? null : shift.id)}
                    disabled={placeholder}
                  >
                    <span className="font-medium">{shift.short_name || shift.name}</span>
                    <span className="truncate max-w-[42px]">{active ? machineLabel : "·"}</span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent className="w-56 p-2" side="bottom" align="center">
          {formBody}
        </PopoverContent>
      </Popover>
    </td>
  );
}

/* ---- Machine view components ---- */

function MachineGrid({
  days,
  machineGroups,
  getAssignments,
  getExistingAssignments,
  employeeMap,
  machineDowntimeKeySet,
  showChanges,
  spacious,
  displayShifts,
  canEditPlanning,
  onAssign,
  assignmentByEmployeeDay,
  skillSet,
  employeesForPicker,
  absentEmployeeDaySet,
}: {
  days: string[];
  machineGroups: { group: string; machines: Machine[] }[];
  getAssignments: (key: string) => DailyAssignment[];
  getExistingAssignments?: (key: string) => DailyAssignment[];
  employeeMap: Map<string, Employee>;
  machineDowntimeKeySet: Set<string>;
  showChanges?: boolean;
  spacious?: boolean;
  displayShifts: DisplayShift[];
  canEditPlanning: boolean;
  onAssign: (employeeId: string, dayDate: string, machineId: string | null, timeSlotId: string | null) => void;
  assignmentByEmployeeDay: Map<string, DailyAssignment>;
  skillSet: Set<string>;
  employeesForPicker: Employee[];
  absentEmployeeDaySet: Set<string>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/40 bg-card/40">
      <table className={`w-full border-collapse ${spacious ? "text-sm" : "text-xs"}`}>
        <thead>
          <tr className="border-b border-border/40 bg-muted/40">
            <th className={`text-left font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 border-r ${spacious ? "p-3 min-w-[220px]" : "p-2 min-w-[160px]"}`}>
              Machine
            </th>
            {days.map((day) => {
              const d = new Date(day + "T00:00:00");
              const dayNum = d.getDate();
              const dayOfWeek = d.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              return (
                <th
                  key={day}
                  className={`text-center font-medium ${spacious ? "p-2 min-w-[84px]" : "p-1 min-w-[60px]"} ${isWeekend ? "bg-muted" : ""}`}
                >
                  <div className={`${spacious ? "text-xs" : "text-[9px]"} text-muted-foreground`}>{DAY_ABBR[dayOfWeek]}</div>
                  <div className={spacious ? "text-sm" : "text-xs"}>{dayNum}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {machineGroups.map(({ group, machines: groupMachines }) => (
            <React.Fragment key={group}>
              <tr className="bg-muted/40">
                <td
                  colSpan={1 + days.length}
                  className={`${spacious ? "p-2 px-3 text-sm" : "p-1 px-2 text-xs"} font-semibold uppercase sticky left-0 z-10`}
                  style={{ borderBottom: "1px solid hsl(var(--border) / 0.5)" }}
                >
                  {group}
                </td>
              </tr>
              {groupMachines.map((machine) => (
                <tr key={machine.id} className="border-b border-border/30 hover:bg-muted/30">
                  <td className={`${spacious ? "p-2 text-sm" : "p-1 text-xs"} font-medium sticky left-0 bg-card z-10 border-r whitespace-nowrap`}>
                    <div className="flex items-center gap-1">
                      <span>{machine.short_name || machine.name}</span>
                      <span className="text-[8px] text-muted-foreground">({machine.max_employees})</span>
                    </div>
                  </td>
                  {days.map((day) => {
                    const d = new Date(day + "T00:00:00");
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const key = `${machine.id}_${day}`;
                    const assignments = getAssignments(key);

                    let isProposedChange = false;
                    if (showChanges && getExistingAssignments) {
                      const existing = getExistingAssignments(key);
                      const existingKeys = new Set(existing.map((a) => `${a.employee_id}:${a.time_slot_id ?? ""}`));
                      const proposedKeys = new Set(assignments.map((a) => `${a.employee_id}:${a.time_slot_id ?? ""}`));
                      isProposedChange =
                        existingKeys.size !== proposedKeys.size ||
                        [...proposedKeys].some((v) => !existingKeys.has(v));
                    }

                    return (
                      <MachineDayCell
                        key={day}
                        machine={machine}
                        dayDate={day}
                        assignments={assignments}
                        employeeMap={employeeMap}
                        isWeekend={isWeekend}
                        isDowntime={machineDowntimeKeySet.has(`${machine.id}_${day}`)}
                        isProposedChange={isProposedChange}
                        spacious={spacious}
                        displayShifts={displayShifts}
                        canEditPlanning={canEditPlanning}
                        onAssign={onAssign}
                        assignmentByEmployeeDay={assignmentByEmployeeDay}
                        skillSet={skillSet}
                        employeesForPicker={employeesForPicker}
                        absentEmployeeDaySet={absentEmployeeDaySet}
                      />
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MachineDayCell({
  machine,
  dayDate,
  assignments,
  employeeMap,
  isWeekend,
  isDowntime,
  isProposedChange,
  spacious,
  displayShifts,
  canEditPlanning,
  onAssign,
  assignmentByEmployeeDay,
  skillSet,
  employeesForPicker,
  absentEmployeeDaySet,
}: {
  machine: Machine;
  dayDate: string;
  assignments: DailyAssignment[];
  employeeMap: Map<string, Employee>;
  isWeekend: boolean;
  isDowntime: boolean;
  isProposedChange?: boolean;
  spacious?: boolean;
  displayShifts: DisplayShift[];
  canEditPlanning: boolean;
  onAssign: (employeeId: string, dayDate: string, machineId: string | null, timeSlotId: string | null) => void;
  assignmentByEmployeeDay: Map<string, DailyAssignment>;
  skillSet: Set<string>;
  employeesForPicker: Employee[];
  absentEmployeeDaySet: Set<string>;
}) {
  const bgStyle: React.CSSProperties = {};
  if (isWeekend) bgStyle.backgroundColor = "hsl(var(--muted))";
  if (isDowntime) bgStyle.backgroundColor = "hsl(var(--muted) / 0.85)";

  const isPlaceholderShift = (id: string) => id.startsWith("__empty_");

  const qualifiedPicker = employeesForPicker.filter((e) => {
    if (!skillSet.has(`${e.id}_${machine.id}`)) return false;
    if (absentEmployeeDaySet.has(`${e.id}_${dayDate}`)) return false;
    return true;
  });

  const canAddMoreOnMachine = assignments.length < machine.max_employees;

  return (
    <td
      className={`p-0 text-center border-r border-border/30 ${isProposedChange ? "ring-1 ring-red-500 ring-inset" : ""} ${isDowntime ? "text-muted-foreground" : ""}`}
      style={Object.keys(bgStyle).length ? bgStyle : undefined}
      title={isDowntime ? "Machine à l’arrêt ce jour" : undefined}
    >
      <div className={`flex flex-col items-stretch justify-center gap-1 ${spacious ? "min-h-[44px] py-1" : "min-h-[32px] py-0.5"}`}>
        {displayShifts.map((shift, idx) => {
          if (isPlaceholderShift(shift.id)) {
            return (
              <div
                key={shift.id}
                className={`w-full px-1 ${spacious ? "min-h-[16px] text-[9px]" : "min-h-[12px] text-[8px]"} ${idx < displayShifts.length - 1 ? "border-b border-border/30" : ""}`}
                style={{ backgroundColor: `${shift.color}20` }}
              >
                <span className="font-semibold mr-1">{shift.short_name || shift.name}:</span>
                <span className="text-muted-foreground">—</span>
              </div>
            );
          }

          const rows = assignments.filter((a) => a.time_slot_id === shift.id);
          const canUsePicker =
            canEditPlanning &&
            !isDowntime &&
            canAddMoreOnMachine &&
            qualifiedPicker.length > 0;

          const candidatesForShift = qualifiedPicker.filter(
            (e) => !rows.some((r) => r.employee_id === e.id)
          );

          const rowLabels = rows
            .map((a) => {
              const emp = employeeMap.get(a.employee_id);
              if (!emp) return null;
              return `${emp.first_name.charAt(0)}.${emp.last_name}`;
            })
            .filter(Boolean)
            .join(", ");

          return (
            <div
              key={shift.id}
              className={`w-full px-1 text-left ${spacious ? "h-4 text-[9px]" : "h-3 text-[8px]"} ${idx < displayShifts.length - 1 ? "border-b border-border/30" : ""}`}
              style={{ backgroundColor: `${shift.color}20` }}
            >
              <div className="flex items-center h-full gap-1 overflow-hidden">
                <span className="font-semibold shrink-0">{shift.short_name || shift.name}:</span>
                {isDowntime ? (
                  <span className="text-amber-700/90 font-medium truncate">Arrêt</span>
                ) : (
                  <>
                    <span className="truncate whitespace-nowrap flex-1">
                      {rowLabels || ((canUsePicker && candidatesForShift.length > 0) ? "" : "·")}
                    </span>
                    {canUsePicker && candidatesForShift.length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0"
                            title={rows.length === 0 ? "Assigner un employé" : "Ajouter"}
                          >
                            {rows.length === 0 ? "Assigner…" : "+"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="center" side="bottom">
                          <div className="text-[10px] font-medium text-muted-foreground mb-1.5">Employé</div>
                          <Select
                            value=""
                            onValueChange={(empId) => {
                              if (!empId) return;
                              const existing = assignmentByEmployeeDay.get(`${empId}_${dayDate}`);
                              if (existing && existing.machine_id === machine.id && existing.time_slot_id === shift.id) {
                                return;
                              }
                              onAssign(empId, dayDate, machine.id, shift.id);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Choisir…" />
                            </SelectTrigger>
                            <SelectContent>
                              {candidatesForShift.map((e) => (
                                <SelectItem key={e.id} value={e.id} className="text-xs">
                                  {e.first_name} {e.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </PopoverContent>
                      </Popover>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </td>
  );
}

function ReplanChangesTable({
  existingAssignments,
  proposedAssignments,
  fromDate,
  toDate,
  employeeMap,
  machineMap,
  timeSlotMap,
}: {
  existingAssignments: DailyAssignment[];
  proposedAssignments: DailyAssignment[];
  fromDate: string;
  toDate: string;
  employeeMap: Map<string, Employee>;
  machineMap: Map<string, Machine>;
  timeSlotMap: Map<string, TimeSlot>;
}) {
  const inRange = (dayDate: string) => dayDate >= fromDate && dayDate <= toDate;

  const existingByKey = useMemo(() => {
    const m = new Map<string, DailyAssignment>();
    existingAssignments
      .filter((a) => inRange(a.day_date))
      .forEach((a) => m.set(`${a.employee_id}_${a.day_date}`, a));
    return m;
  }, [existingAssignments, fromDate, toDate]);

  const proposedByKey = useMemo(() => {
    const m = new Map<string, DailyAssignment>();
    proposedAssignments
      .filter((a) => inRange(a.day_date))
      .forEach((a) => m.set(`${a.employee_id}_${a.day_date}`, a));
    return m;
  }, [proposedAssignments, fromDate, toDate]);

  const formatMachineSlot = (a: DailyAssignment | undefined) => {
    if (!a) return "—";
    const m = machineMap.get(a.machine_id);
    const ts = a.time_slot_id ? timeSlotMap.get(a.time_slot_id) : null;
    const machineName = m ? (m.short_name || m.name) : "?";
    return ts ? `${machineName} (${ts.short_name || ts.name})` : machineName;
  };

  type ChangeRow = {
    employeeId: string;
    dayDate: string;
    type: "added" | "removed" | "changed";
    before: DailyAssignment | undefined;
    after: DailyAssignment | undefined;
  };

  const changes = useMemo<ChangeRow[]>(() => {
    const rows: ChangeRow[] = [];
    const allKeys = new Set<string>();
    existingAssignments.forEach((a) => allKeys.add(`${a.employee_id}_${a.day_date}`));
    proposedAssignments.forEach((a) => allKeys.add(`${a.employee_id}_${a.day_date}`));

    allKeys.forEach((key) => {
      const before = existingByKey.get(key);
      const after = proposedByKey.get(key);
      const [employeeId, dayDate] = key.split("_", 2);

      if (before && !after) {
        rows.push({ employeeId, dayDate, type: "removed", before, after: undefined });
      } else if (!before && after) {
        rows.push({ employeeId, dayDate, type: "added", before: undefined, after });
      } else if (before && after) {
        if (before.machine_id !== after.machine_id || before.time_slot_id !== after.time_slot_id) {
          rows.push({ employeeId, dayDate, type: "changed", before, after });
        }
      }
    });

    rows.sort((a, b) => {
      const dateCmp = a.dayDate.localeCompare(b.dayDate);
      if (dateCmp !== 0) return dateCmp;
      const empA = employeeMap.get(a.employeeId);
      const empB = employeeMap.get(b.employeeId);
      return (empA?.last_name ?? "").localeCompare(empB?.last_name ?? "");
    });
    return rows;
  }, [existingByKey, proposedByKey, existingAssignments, proposedAssignments, employeeMap]);

  if (changes.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">
        Aucun changement détecté.
      </div>
    );
  }

  const typeLabel = (t: ChangeRow["type"]) => {
    switch (t) {
      case "added": return "Nouveau";
      case "removed": return "Supprimé";
      case "changed": return "Modifié";
    }
  };
  const typeColor = (t: ChangeRow["type"]) => {
    switch (t) {
      case "added": return "bg-emerald-100 text-emerald-800";
      case "removed": return "bg-red-100 text-red-800";
      case "changed": return "bg-amber-100 text-amber-800";
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border/40 bg-card/40">
      <div className="px-3 py-2 border-b border-border/40 bg-muted/30">
        <span className="text-sm font-medium">{changes.length} changement{changes.length > 1 ? "s" : ""}</span>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border/40 bg-muted/40">
            <th className="p-2 text-left font-medium text-muted-foreground">Date</th>
            <th className="p-2 text-left font-medium text-muted-foreground">Employé</th>
            <th className="p-2 text-left font-medium text-muted-foreground">Type</th>
            <th className="p-2 text-left font-medium text-muted-foreground">Avant</th>
            <th className="p-2 text-center font-medium text-muted-foreground w-8"></th>
            <th className="p-2 text-left font-medium text-muted-foreground">Après</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c, i) => {
            const emp = employeeMap.get(c.employeeId);
            const empLabel = emp ? `${emp.first_name} ${emp.last_name}` : "?";
            const d = new Date(c.dayDate + "T00:00:00");
            const dayLabel = format(d, "EEE dd MMM", { locale: fr });
            return (
              <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                <td className="p-2 text-xs whitespace-nowrap">{dayLabel}</td>
                <td className="p-2 text-xs whitespace-nowrap font-medium">{empLabel}</td>
                <td className="p-2">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor(c.type)}`}>
                    {typeLabel(c.type)}
                  </span>
                </td>
                <td className="p-2 text-xs whitespace-nowrap">
                  {c.type === "added" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{formatMachineSlot(c.before)}</span>
                  )}
                </td>
                <td className="p-2 text-center text-muted-foreground">→</td>
                <td className="p-2 text-xs whitespace-nowrap">
                  {c.type === "removed" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">{formatMachineSlot(c.after)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeFilterPopover({
  employees,
  selectedEmployeeIds,
  onToggleEmployee,
  onSelectAll,
  onClearAll,
  compact,
}: {
  employees: Employee[];
  selectedEmployeeIds: string[];
  onToggleEmployee: (employeeId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  compact?: boolean;
}) {
  const selectedSet = new Set(selectedEmployeeIds);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size={compact ? "sm" : "default"} className="text-xs">
          Employés {selectedEmployeeIds.length}/{employees.length}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">Filtre employés</div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onSelectAll}>
                Tous
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onClearAll}>
                Aucun
              </Button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {employees.map((emp) => {
              const isChecked = selectedSet.has(emp.id);
              return (
                <label
                  key={emp.id}
                  className="flex items-center gap-2 text-xs rounded px-1.5 py-1 hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleEmployee(emp.id)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate">
                    {emp.first_name} {emp.last_name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
