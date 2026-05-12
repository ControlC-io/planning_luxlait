import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarOff, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Employee = { id: string; first_name: string; last_name: string };
type Status = { id: string; name: string; color: string; sort_order: number };
type WeeklyStatusRow = {
  id: string;
  day_date: string;
  employee_id: string;
  status_id: string;
};
const JWT_STORAGE_KEY = "myrtest_jwt_token";

function authHeaders(withJson: boolean = false): Record<string, string> {
  const token = localStorage.getItem(JWT_STORAGE_KEY);
  return {
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function pickDefaultStatusId(statuses: Status[]): string {
  if (statuses.length === 0) return "";
  const byName = statuses.find((s) =>
    /congé|vacation|conge|absence/i.test(s.name.trim())
  );
  return byName?.id ?? statuses[0]!.id;
}

function mapsEqual(a: Map<string, string | null>, b: Map<string, string | null>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

function cloneMap(m: Map<string, string | null>): Map<string, string | null> {
  return new Map(m);
}

export default function EmployeeDayOffsAdmin() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [selectedStatusId, setSelectedStatusId] = useState<string>("");
  const [baseline, setBaseline] = useState<Map<string, string | null>>(new Map());
  const [working, setWorking] = useState<Map<string, string | null>>(new Map());

  const monthStart = format(currentMonth, "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: fr });

  const daysInMonth = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      }).map((d) => format(d, "yyyy-MM-dd")),
    [currentMonth]
  );

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem(JWT_STORAGE_KEY);
      if (!token) {
        toast({
          title: "Session",
          description: "Connectez-vous pour gérer les congés.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const [empRes, stRes, wesRes] = await Promise.all([
        fetch("/api/planning/luxlait_employees?active=true", { headers: authHeaders() }),
        fetch("/api/planning/luxlait_statuses", { headers: authHeaders() }),
        fetch(
          `/api/planning/luxlait_weekly_employee_statuses?fromDate=${monthStart}&toDate=${monthEnd}`,
          { headers: authHeaders() }
        ),
      ]);

      const empJson = await empRes.json().catch(() => []);
      const stJson = await stRes.json().catch(() => []);
      const wesJson = await wesRes.json().catch(() => []);

      if (!empRes.ok) throw new Error(typeof empJson?.error === "string" ? empJson.error : "Employés");
      if (!stRes.ok) throw new Error(typeof stJson?.error === "string" ? stJson.error : "Statuts");
      if (!wesRes.ok) throw new Error(typeof wesJson?.error === "string" ? wesJson.error : "Indisponibilités");

      const emps = Array.isArray(empJson) ? (empJson as Employee[]) : [];
      const sts = Array.isArray(stJson) ? (stJson as Status[]) : [];
      const weekly = Array.isArray(wesJson) ? (wesJson as WeeklyStatusRow[]) : [];

      setEmployees(emps);
      setStatuses(sts);
      setSelectedStatusId((prev) => {
        if (prev && sts.some((s) => s.id === prev)) return prev;
        return pickDefaultStatusId(sts);
      });

      const daySet = new Set(
        eachDayOfInterval({
          start: startOfMonth(currentMonth),
          end: endOfMonth(currentMonth),
        }).map((d) => format(d, "yyyy-MM-dd"))
      );

      const m = new Map<string, string | null>();
      for (const e of emps) {
        for (const d of daySet) {
          m.set(`${e.id}|${d}`, null);
        }
      }
      for (const w of weekly) {
        const k = `${w.employee_id}|${w.day_date}`;
        if (m.has(k)) m.set(k, w.status_id);
      }

      setBaseline(cloneMap(m));
      setWorking(cloneMap(m));
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Chargement impossible",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast stable enough; avoid effect churn
  }, [currentMonth, monthEnd, monthStart]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const hasChanges = useMemo(() => !mapsEqual(baseline, working), [baseline, working]);

  const statusById = useMemo(() => {
    const r = new Map<string, Status>();
    for (const s of statuses) r.set(s.id, s);
    return r;
  }, [statuses]);

  const handleCellClick = (employeeId: string, day: string) => {
    if (!selectedStatusId) {
      toast({
        title: "Statut",
        description: "Choisissez un statut d’absence à appliquer.",
        variant: "destructive",
      });
      return;
    }

    const key = `${employeeId}|${day}`;
    setWorking((prev) => {
      const next = cloneMap(prev);
      const cur = next.get(key) ?? null;
      if (cur === null) {
        next.set(key, selectedStatusId);
      } else if (cur === selectedStatusId) {
        next.set(key, null);
      } else {
        next.set(key, selectedStatusId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const rows: { employee_id: string; day_date: string; status_id: string | null }[] = [];
    for (const [k, w] of working) {
      const b = baseline.get(k) ?? null;
      if (w !== b) {
        const [employee_id, day_date] = k.split("|");
        rows.push({ employee_id, day_date, status_id: w });
      }
    }
    if (rows.length === 0) {
      toast({ title: "Rien à enregistrer", description: "Aucune modification." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/planning/luxlait_weekly_employee_statuses/bulk_sync", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ rows }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Enregistrement impossible");
      setBaseline(cloneMap(working));
      toast({
        title: "Enregistré",
        description: `${rows.length} mise(s) à jour.`,
      });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Échec de l’enregistrement",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setWorking(cloneMap(baseline));
  };

  const weekdayLetter = (iso: string) => {
    const d = new Date(`${iso}T12:00:00.000Z`);
    return format(d, "EEEEE", { locale: fr });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarOff className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Congés et jours off</h1>
            <p className="text-sm text-muted-foreground">
              Indisponibilités par employé (prise en compte par l’auto-plan).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium capitalize">
            {monthLabel}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <label className="text-sm font-medium">Statut appliqué au clic</label>
          <Select
            value={selectedStatusId || undefined}
            onValueChange={setSelectedStatusId}
            disabled={statuses.length === 0}
          >
            <SelectTrigger className="w-[min(100%,280px)]">
              <SelectValue placeholder="Choisir un statut" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Clic sur une case : pose le statut choisi ; second clic identique : efface. Un autre statut
            existant est remplacé.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleDiscard}
            disabled={!hasChanges || saving}
          >
            Annuler les changements
          </Button>
          <Button type="button" onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Chargement…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-20 min-w-[10rem] border-r bg-muted/40 px-2 py-2 text-left font-medium backdrop-blur-sm">
                  Employé
                </th>
                {daysInMonth.map((d) => {
                  return (
                    <th
                      key={d}
                      className="min-w-[2.25rem] px-0.5 py-2 text-center font-normal"
                      title={d}
                    >
                      <div className="text-[10px] leading-none text-muted-foreground">
                        {weekdayLetter(d)}
                      </div>
                      <div className="text-xs font-medium">{format(new Date(`${d}T12:00:00.000Z`), "d")}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b border-border/60 hover:bg-muted/20">
                  <td className="sticky left-0 z-10 border-r bg-card px-2 py-1.5 font-medium backdrop-blur-sm">
                    {e.last_name} {e.first_name}
                  </td>
                  {daysInMonth.map((d) => {
                    const key = `${e.id}|${d}`;
                    const sid = working.get(key) ?? null;
                    const st = sid ? statusById.get(sid) : undefined;
                    const isSelectedKind = sid !== null && sid === selectedStatusId;
                    return (
                      <td key={d} className="p-0.5">
                        <button
                          type="button"
                          onClick={() => handleCellClick(e.id, d)}
                          className={cn(
                            "flex h-8 w-full min-w-[2rem] items-center justify-center rounded border transition-colors cursor-pointer hover:ring-2 hover:ring-ring/40",
                            sid && "border-transparent",
                            !sid && "border-dashed border-muted-foreground/25 bg-background",
                            sid && isSelectedKind && "ring-1 ring-offset-1",
                            sid && st && !isSelectedKind && "ring-1 ring-offset-1"
                          )}
                          style={
                            sid && st
                              ? {
                                  backgroundColor: `${st.color}33`,
                                  borderColor: st.color,
                                }
                              : undefined
                          }
                          title={
                            st
                              ? `${st.name} — clic pour modifier`
                              : "Disponible — clic pour poser l’absence"
                          }
                          aria-label={
                            st
                              ? `${e.last_name} ${st.name} le ${d}`
                              : `${e.last_name} disponible le ${d}`
                          }
                        >
                          {sid && (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: st?.color ?? "#64748b" }}
                            />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length === 0 && (
            <p className="p-8 text-center text-muted-foreground">Aucun employé actif.</p>
          )}
        </div>
      )}
    </div>
  );
}
