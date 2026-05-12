import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CalendarOff, Loader2 } from "lucide-react";

type Machine = { id: string; name: string; short_name: string | null; sort_order: number; machine_group: string | null };
type TimeSlot = { id: string; name: string; short_name: string | null; sort_order: number };
type MachineClosedWeekdayShift = { id: string; machine_id: string; weekday: number; time_slot_id: string };
type MachineDowntimeShift = { id: string; machine_id: string; day_date: string; time_slot_id: string; reason: string | null };

const JWT_STORAGE_KEY = "myrtest_jwt_token";
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABEL: Record<number, string> = {
  0: "Dim",
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Jeu",
  5: "Ven",
  6: "Sam",
};

function authHeaders(withJson: boolean = false): Record<string, string> {
  const token = localStorage.getItem(JWT_STORAGE_KEY);
  return {
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function cloneMap(source: Map<string, Set<string>>): Map<string, Set<string>> {
  const copy = new Map<string, Set<string>>();
  for (const [k, v] of source) {
    copy.set(k, new Set(v));
  }
  return copy;
}

function mapEquals(a: Map<string, Set<string>>, b: Map<string, Set<string>>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, aSet] of a) {
    const bSet = b.get(k);
    if (!bSet || bSet.size !== aSet.size) return false;
    for (const v of aSet) {
      if (!bSet.has(v)) return false;
    }
  }
  return true;
}

export default function MachineWeeklyClosuresAdmin() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [baseline, setBaseline] = useState<Map<string, Set<string>>>(new Map());
  const [working, setWorking] = useState<Map<string, Set<string>>>(new Map());
  const [downtimeShifts, setDowntimeShifts] = useState<MachineDowntimeShift[]>([]);
  const [newDateByMachine, setNewDateByMachine] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [machinesRes, slotsRes, closuresRes, downtimeRes] = await Promise.all([
        fetch("/api/planning/luxlait_machines", { headers: authHeaders() }),
        fetch("/api/planning/luxlait_time_slots", { headers: authHeaders() }),
        fetch("/api/planning/luxlait_machine_closed_weekday_shifts", { headers: authHeaders() }),
        fetch("/api/planning/luxlait_machine_downtime_shifts", { headers: authHeaders() }),
      ]);

      const machinesJson = await machinesRes.json().catch(() => []);
      const slotsJson = await slotsRes.json().catch(() => []);
      const closuresJson = await closuresRes.json().catch(() => []);
      const downtimeJson = await downtimeRes.json().catch(() => []);

      if (!machinesRes.ok) throw new Error(machinesJson?.error ?? "Failed to load machines");
      if (!slotsRes.ok) throw new Error(slotsJson?.error ?? "Failed to load time slots");
      if (!closuresRes.ok) throw new Error(closuresJson?.error ?? "Failed to load weekly closures");
      if (!downtimeRes.ok) throw new Error(downtimeJson?.error ?? "Failed to load dated closures");

      const machineRows = (Array.isArray(machinesJson) ? machinesJson : []) as Machine[];
      const slotRows = (Array.isArray(slotsJson) ? slotsJson : []) as TimeSlot[];
      const closureRows = (Array.isArray(closuresJson) ? closuresJson : []) as MachineClosedWeekdayShift[];
      const downtimeRows = (Array.isArray(downtimeJson) ? downtimeJson : []) as MachineDowntimeShift[];

      const byMachine = new Map<string, Set<string>>();
      for (const machine of machineRows) byMachine.set(machine.id, new Set<string>());
      for (const row of closureRows) {
        if (!byMachine.has(row.machine_id)) byMachine.set(row.machine_id, new Set<string>());
        byMachine.get(row.machine_id)!.add(`${row.weekday}|${row.time_slot_id}`);
      }

      setMachines([...machineRows].sort((a, b) => a.sort_order - b.sort_order));
      setTimeSlots([...slotRows].sort((a, b) => a.sort_order - b.sort_order));
      setBaseline(cloneMap(byMachine));
      setWorking(cloneMap(byMachine));
      setDowntimeShifts(downtimeRows);
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Chargement impossible",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasChanges = useMemo(() => !mapEquals(baseline, working), [baseline, working]);

  const toggleWeekdayShift = (machineId: string, weekday: number, timeSlotId: string) => {
    const key = `${weekday}|${timeSlotId}`;
    setWorking((prev) => {
      const next = cloneMap(prev);
      if (!next.has(machineId)) next.set(machineId, new Set<string>());
      const current = next.get(machineId)!;
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return next;
    });
  };

  const handleDiscard = () => {
    setWorking(cloneMap(baseline));
  };

  const handleSave = async () => {
    const changedMachineIds = machines
      .map((m) => m.id)
      .filter((id) => !mapEquals(new Map([[id, baseline.get(id) ?? new Set<number>()]]), new Map([[id, working.get(id) ?? new Set<number>()]])));

    if (changedMachineIds.length === 0) {
      toast({ title: "Rien à enregistrer", description: "Aucune modification." });
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        changedMachineIds.map(async (machineId) => {
          const rows = [...(working.get(machineId) ?? new Set<string>())]
            .map((k) => {
              const [weekday, time_slot_id] = k.split("|");
              return { weekday: Number(weekday), time_slot_id };
            })
            .filter((r) => Number.isInteger(r.weekday) && !!r.time_slot_id);
          const res = await fetch(`/api/planning/luxlait_machines/${machineId}/closed_weekday_shifts`, {
            method: "PUT",
            headers: authHeaders(true),
            body: JSON.stringify({ rows }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error ?? `Save failed for machine ${machineId}`);
        })
      );

      setBaseline(cloneMap(working));
      toast({
        title: "Enregistré",
        description: `${changedMachineIds.length} machine(s) mises à jour.`,
      });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Enregistrement impossible",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addDatedClosure = async (machineId: string, dayDate: string) => {
    if (!dayDate) return;
    const rows = timeSlots.map((slot) => ({
      machine_id: machineId,
      day_date: dayDate,
      time_slot_id: slot.id,
      reason: null,
    }));
    const res = await fetch("/api/planning/luxlait_machine_downtime_shifts/bulk_sync", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        rows: [
          ...downtimeShifts.filter((r) => r.machine_id === machineId),
          ...rows,
        ],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? "Unable to save dated closures");
    await loadData();
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex items-center gap-2">
        <CalendarOff className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Fermetures hebdomadaires machines</h1>
          <p className="text-sm text-muted-foreground">
            Configure les jours récurrents où une machine est fermée.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 rounded-lg border bg-card p-3">
        <Button type="button" variant="secondary" onClick={handleDiscard} disabled={!hasChanges || saving}>
          Annuler
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

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Chargement…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-2 text-left font-medium">Machine</th>
                {WEEKDAY_ORDER.map((weekday) => (
                  <th key={weekday} className="p-2 text-center font-medium min-w-[72px]">
                    {WEEKDAY_LABEL[weekday]}
                  </th>
                ))}
                <th className="p-2 text-left font-medium min-w-[180px]">Fermeture datée</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((machine) => (
                <tr key={machine.id} className="border-b border-border/60 hover:bg-muted/20">
                  <td className="p-2 font-medium">
                    {machine.short_name || machine.name}
                    {machine.machine_group ? (
                      <span className="ml-2 text-xs text-muted-foreground">({machine.machine_group})</span>
                    ) : null}
                  </td>
                  {WEEKDAY_ORDER.map((weekday) => {
                    const selected = working.get(machine.id) ?? new Set<string>();
                    return (
                      <td key={`${machine.id}_${weekday}`} className="p-2 text-center">
                        <div className="flex flex-col items-start gap-1">
                          {timeSlots.map((slot) => {
                            const k = `${weekday}|${slot.id}`;
                            const checked = selected.has(k);
                            return (
                              <label key={k} className="flex items-center gap-1 text-xs">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleWeekdayShift(machine.id, weekday, slot.id)}
                                  aria-label={`${machine.name} ${WEEKDAY_LABEL[weekday]} ${slot.name}`}
                                />
                                <span>{slot.short_name || slot.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={newDateByMachine[machine.id] ?? ""}
                        onChange={(e) => setNewDateByMachine((prev) => ({ ...prev, [machine.id]: e.target.value }))}
                        className="h-8"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addDatedClosure(machine.id, newDateByMachine[machine.id] ?? "")}
                      >
                        Ajouter
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {machines.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">Aucune machine.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
