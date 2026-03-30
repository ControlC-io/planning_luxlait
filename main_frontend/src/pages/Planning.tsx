import { useState, useEffect, useMemo } from "react";
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Copy, Users, Factory } from "lucide-react";
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
type ClosedDay = { id: string; day_date: string; reason: string | null };

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
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([]);
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([]);

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
  const [autoPlanStats, setAutoPlanStats] = useState<Record<string, unknown> | null>(null);
  const [replanFormOpen, setReplanFormOpen] = useState(false);
  const [replanFromDate, setReplanFromDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [replanLoading, setReplanLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"employee" | "machine">("employee");
  const [previewViewMode, setPreviewViewMode] = useState<"employee" | "machine">("employee");
  const [mainViewRangeMode, setMainViewRangeMode] = useState<"month" | "week">("month");
  const [previewRangeMode, setPreviewRangeMode] = useState<"fullRange" | "week">("fullRange");
  const [mainWeekStart, setMainWeekStart] = useState<string | null>(null);
  const [previewWeekStart, setPreviewWeekStart] = useState<string | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeFilterTouched, setEmployeeFilterTouched] = useState(false);
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

    try {
      const token = localStorage.getItem(JWT_STORAGE_KEY);
      if (!token) return;
      const res = await fetch("/api/planning/luxlait_closed_weekdays", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json?.weekdays)) {
        setClosedWeekdays(json.weekdays);
      }
    } catch {
      // keep planning usable if closed day config cannot be loaded
    }
  };

  const fetchMonthData = async () => {
    const [a, es] = await Promise.all([
      supabase.from("luxlait_daily_assignments" as any).select("*").gte("day_date", monthStart).lte("day_date", monthEnd),
      supabase.from("luxlait_weekly_employee_statuses" as any).select("*").gte("day_date", monthStart).lte("day_date", monthEnd),
    ]);
    setDailyAssignments((a.data as any) ?? []);
    setEmpStatuses((es.data as any) ?? []);

    try {
      const token = localStorage.getItem(JWT_STORAGE_KEY);
      if (!token) return;
      const url = new URL("/api/planning/luxlait_closed_days", window.location.origin);
      url.searchParams.set("fromDate", monthStart);
      url.searchParams.set("toDate", monthEnd);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => []);
      if (res.ok && Array.isArray(json)) {
        setClosedDays(json as ClosedDay[]);
      } else {
        setClosedDays([]);
      }
    } catch {
      setClosedDays([]);
    }
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

  const closedDaySet = useMemo(() => new Set(closedDays.map((d) => d.day_date)), [closedDays]);

  const isClosedDay = (day: string): boolean => {
    if (closedDaySet.has(day)) return true;
    if (!closedWeekdays.length) return false;
    const weekDay = new Date(`${day}T00:00:00`).getDay();
    return closedWeekdays.includes(weekDay);
  };

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
      const key = `${a.machine_id}_${a.day_date}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    });
    return m;
  }, [dailyAssignments]);

  const proposedByMachineDay = useMemo(() => {
    const m = new Map<string, DailyAssignment[]>();
    autoPlanProposedAssignments.forEach((a) => {
      const key = `${a.machine_id}_${a.day_date}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    });
    return m;
  }, [autoPlanProposedAssignments]);
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

      setAutoPlanProposedAssignments(proposed);
      setAutoPlanStats(json.stats ?? null);
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

      const proposed = (json.assignments ?? []).map((a: any) => ({
        id: `preview_${a.employee_id}_${a.day_date}`,
        day_date: a.day_date,
        employee_id: a.employee_id,
        machine_id: a.machine_id,
        time_slot_id: a.time_slot_id ?? null,
      })) as DailyAssignment[];

      setAutoPlanFromDate(replanFromDate);
      setAutoPlanToDate(monthEnd);
      setAutoPlanProposedAssignments(proposed);
      setAutoPlanStats(json.stats ?? null);
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
          rows: autoPlanProposedAssignments.map((a) => ({
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
                const closed = isClosedDay(day);
                return (
                  <th
                    key={day}
                    className={`p-1 text-center font-medium min-w-[60px] ${isWeekend ? "bg-muted" : ""} ${closed ? "bg-red-50" : ""}`}
                  >
                    <div className="text-muted-foreground text-[9px]">{DAY_ABBR[dayOfWeek]}</div>
                    <div className="text-xs">{dayNum}</div>
                    {closed ? <div className="text-[9px] text-red-600">Fermé</div> : null}
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
                      qualifiedMachines={getQualifiedMachines(emp.id)}
                      timeSlots={timeSlots}
                      onAssign={handleAssign}
                      onSetStatus={handleSetDayStatus}
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
          timeSlotMap={timeSlotMap}
          spacious={false}
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
          setPreviewViewMode("employee");
        }
      }}
    >
      <DialogContent className="w-[98vw] sm:w-[96vw] max-w-[1400px] h-[92vh] max-h-[92vh] p-3 sm:p-4 flex flex-col">
        <DialogHeader className="space-y-3 pb-1">
          <DialogTitle className="text-base sm:text-lg">Preview Auto Plan</DialogTitle>
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
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
          {previewViewMode === "employee" ? (
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
                          qualifiedMachines={getQualifiedMachines(emp.id)}
                          timeSlots={timeSlots}
                          onAssign={(_empId, _day, _machineId, _timeSlotId) => undefined}
                          onSetStatus={(_empId, _day, _statusId) => undefined}
                          isProposedChange={isDifferent}
                          spacious
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
              timeSlotMap={timeSlotMap}
              showChanges
              spacious
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
  timeSlots,
  onAssign,
  onSetStatus,
  isProposedChange,
  spacious,
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
  timeSlots: TimeSlot[];
  onAssign: (empId: string, day: string, machineId: string | null, timeSlotId: string | null) => void;
  onSetStatus: (empId: string, day: string, statusId: string | null) => void;
  isProposedChange?: boolean;
  spacious?: boolean;
}) {
  const status = statusId ? statusMap.get(statusId) : null;
  const machine = assignment ? machineMap.get(assignment.machine_id) : null;
  const timeSlot = assignment?.time_slot_id ? timeSlotMap.get(assignment.time_slot_id) : null;
  const assignedMachineIsQualified = assignment
    ? qualifiedMachines.some((m) => m.id === assignment.machine_id)
    : true;

  const cellBg = status
    ? status.color
    : isWeekend
      ? "hsl(var(--muted))"
      : undefined;

  const cellContent = () => {
    if (status) {
      return (
        <span className={`${spacious ? "text-[10px]" : "text-[8px]"} font-bold`} style={{ color: "#fff" }}>
          {status.name.substring(0, 3)}
        </span>
      );
    }
    if (machine) {
      const mLabel = machine.short_name || machine.name;
      const tsLabel = timeSlot ? (timeSlot.short_name || timeSlot.name) : "";
      const display = tsLabel ? `${mLabel}-${tsLabel}` : mLabel;
      return (
        <div className={`flex flex-col items-center ${spacious ? "gap-1" : "gap-0.5"}`}>
          <span
            className={`${spacious ? "text-[11px] max-w-[74px]" : "text-[9px] max-w-[54px]"} font-semibold leading-tight truncate`}
            title={`${machine.name}${timeSlot ? " - " + timeSlot.name : ""}`}
          >
            {display}
          </span>
          {timeSlot && (
            <span
              className={`inline-block rounded-full ${spacious ? "h-2.5 w-2.5" : "h-2 w-2"}`}
              style={{ backgroundColor: timeSlot.color }}
              title={timeSlot.name}
            />
          )}
        </div>
      );
    }
    return <span className={`text-muted-foreground ${spacious ? "text-xs" : "text-[9px]"}`}>·</span>;
  };

  if (!canEditPlanning) {
    return (
      <td
        className={`p-0 text-center border-r border-border/30 ${isProposedChange ? "ring-1 ring-primary/70 ring-inset" : ""}`}
        style={cellBg ? { backgroundColor: cellBg } : {}}
      >
        <div className={`flex items-center justify-center ${spacious ? "h-10" : "h-8"}`}>
          {cellContent()}
        </div>
      </td>
    );
  }

  return (
    <td
      className={`p-0 text-center border-r border-border/30 ${isProposedChange ? "ring-1 ring-primary/70 ring-inset" : ""}`}
      style={cellBg ? { backgroundColor: cellBg } : {}}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button className={`w-full flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer ${spacious ? "h-10" : "h-8"}`}>
            {cellContent()}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" side="bottom" align="center">
          <div className="space-y-2">
            {/* Machine select */}
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-1">Machine</div>
              <Select
                value={assignment?.machine_id ?? ""}
                onValueChange={(val) => {
                  if (val === "__remove__") {
                    onAssign(employee.id, dayDate, null, null);
                  } else {
                    onAssign(employee.id, dayDate, val, assignment?.time_slot_id ?? null);
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Aucune">{machine ? machine.name : "Aucune"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assignment && <SelectItem value="__remove__" className="text-destructive text-xs">Retirer</SelectItem>}
                  {qualifiedMachines.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                  ))}
                  {assignment && machine && !assignedMachineIsQualified && (
                    <SelectItem
                      value={machine.id}
                      className="text-xs opacity-60"
                      disabled
                    >
                      {machine.name} (current)
                    </SelectItem>
                  )}
                  {qualifiedMachines.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">Aucune machine qualifiée</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Time slot select */}
            {assignment && (
              <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-1">Créneau</div>
                <Select
                  value={assignment.time_slot_id ?? ""}
                  onValueChange={(val) => {
                    const slotId = val === "__none__" ? null : val;
                    onAssign(employee.id, dayDate, assignment.machine_id, slotId);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Aucun">
                      {timeSlot ? timeSlot.name : "Aucun"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">Aucun</SelectItem>
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

            {/* Status */}
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-1">Statut</div>
              <div className="flex flex-wrap gap-1">
                <button
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${!statusId ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  onClick={() => onSetStatus(employee.id, dayDate, null)}
                >
                  Normal
                </button>
                {statuses.map((s) => (
                  <button
                    key={s.id}
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
  timeSlotMap,
  showChanges,
  spacious,
}: {
  days: string[];
  machineGroups: { group: string; machines: Machine[] }[];
  getAssignments: (key: string) => DailyAssignment[];
  getExistingAssignments?: (key: string) => DailyAssignment[];
  employeeMap: Map<string, Employee>;
  timeSlotMap: Map<string, TimeSlot>;
  showChanges?: boolean;
  spacious?: boolean;
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
                        assignments={assignments}
                        employeeMap={employeeMap}
                        timeSlotMap={timeSlotMap}
                        isWeekend={isWeekend}
                        isProposedChange={isProposedChange}
                        spacious={spacious}
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
  assignments,
  employeeMap,
  timeSlotMap,
  isWeekend,
  isProposedChange,
  spacious,
}: {
  assignments: DailyAssignment[];
  employeeMap: Map<string, Employee>;
  timeSlotMap: Map<string, TimeSlot>;
  isWeekend: boolean;
  isProposedChange?: boolean;
  spacious?: boolean;
}) {
  return (
    <td
      className={`p-0 text-center border-r border-border/30 ${isProposedChange ? "ring-1 ring-primary/70 ring-inset" : ""}`}
      style={isWeekend ? { backgroundColor: "hsl(var(--muted))" } : {}}
    >
      <div className={`flex flex-col items-center justify-center gap-1 ${spacious ? "min-h-[44px] py-1" : "min-h-[32px] py-0.5"}`}>
        {assignments.length === 0 ? (
          <span className={`text-muted-foreground ${spacious ? "text-xs" : "text-[9px]"}`}>&middot;</span>
        ) : (
          assignments.map((a) => {
            const emp = employeeMap.get(a.employee_id);
            const ts = a.time_slot_id ? timeSlotMap.get(a.time_slot_id) : null;
            if (!emp) return null;
            const shortName = `${emp.first_name.charAt(0)}.${emp.last_name}`;
            return (
              <div key={a.employee_id} className={`flex items-center gap-1 leading-tight ${spacious ? "text-[10px]" : "text-[8px]"}`}>
                {ts && (
                  <span
                    className={`inline-block rounded-full shrink-0 ${spacious ? "h-2 w-2" : "h-1.5 w-1.5"}`}
                    style={{ backgroundColor: ts.color }}
                    title={ts.name}
                  />
                )}
                <span
                  className={`truncate font-medium ${spacious ? "max-w-[74px]" : "max-w-[52px]"}`}
                  title={`${emp.first_name} ${emp.last_name}`}
                >
                  {shortName}
                </span>
              </div>
            );
          })
        )}
      </div>
    </td>
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
