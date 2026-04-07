import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type MachineImportance = "MANDATORY" | "PRIORITY" | "OPTIONAL";
type Machine = {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  sort_order: number;
  machine_group: string | null;
  max_employees: number;
  importance?: MachineImportance | null;
};

type TimeSlot = { id: string; name: string; short_name: string | null; color: string; sort_order: number };
type MachineOpenShift = { id: string; machine_id: string; time_slot_id: string };
type MachineDowntime = { id: string; machine_id: string; day_date: string; reason: string | null };
type DowntimeEntry = { day_date: string; reason: string };

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("myrtest_jwt_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function MachinesAdmin() {
  const { toast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [maxEmployees, setMaxEmployees] = useState(1);

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [machineOpenShifts, setMachineOpenShifts] = useState<MachineOpenShift[]>([]);
  const [machineDowntimes, setMachineDowntimes] = useState<MachineDowntime[]>([]);

  const [importance, setImportance] = useState<MachineImportance>("OPTIONAL");
  const [selectedOpenShiftIds, setSelectedOpenShiftIds] = useState<string[]>([]);
  const [downtimeEntries, setDowntimeEntries] = useState<DowntimeEntry[]>([]);
  const [newDowntimeDate, setNewDowntimeDate] = useState<string>("");
  const [newDowntimeReason, setNewDowntimeReason] = useState<string>("");

  const fetchData = async () => {
    const [machinesRes, timeSlotsRes, openShiftsRes, downtimesRes] = await Promise.all([
      supabase.from("luxlait_machines" as any).select("*").order("sort_order"),
      supabase.from("luxlait_time_slots" as any).select("*").order("sort_order"),
      supabase.from("luxlait_machine_open_shifts" as any).select("*"),
      supabase.from("luxlait_machine_downtimes" as any).select("*"),
    ]);

    setMachines((machinesRes.data as any) ?? []);
    setTimeSlots((timeSlotsRes.data as any) ?? []);
    setMachineOpenShifts((openShiftsRes.data as any) ?? []);
    setMachineDowntimes((downtimesRes.data as any) ?? []);
  };
  useEffect(() => { fetchData(); }, []);

  const openNew = () => {
    setEditing(null);
    setName("");
    setShortName("");
    setDescription("");
    setGroup("");
    setSortOrder(machines.length);
    setMaxEmployees(1);
    setImportance("OPTIONAL");
    setSelectedOpenShiftIds([]);
    setDowntimeEntries([]);
    setNewDowntimeDate("");
    setNewDowntimeReason("");
    setOpen(true);
  };

  const openEdit = (m: Machine) => {
    const osForMachine = machineOpenShifts.filter((os) => os.machine_id === m.id);
    const dtForMachine = machineDowntimes.filter((dt) => dt.machine_id === m.id);

    setEditing(m);
    setName(m.name);
    setShortName(m.short_name ?? "");
    setDescription(m.description ?? "");
    setGroup(m.machine_group ?? "");
    setSortOrder(m.sort_order);
    setMaxEmployees(m.max_employees ?? 1);
    setImportance(((m.importance ?? "OPTIONAL") as MachineImportance) || "OPTIONAL");
    setSelectedOpenShiftIds(osForMachine.map((os) => os.time_slot_id));
    setDowntimeEntries(dtForMachine.map((dt) => ({ day_date: dt.day_date, reason: dt.reason ?? "" })));
    setNewDowntimeDate("");
    setNewDowntimeReason("");
    setOpen(true);
  };

  const save = async () => {
    try {
      const machinePayload = {
        name,
        short_name: shortName || null,
        description: description || null,
        machine_group: group || null,
        sort_order: sortOrder,
        max_employees: maxEmployees,
        importance,
      };

      let resolvedMachineId: string;

      if (editing) {
        const res = await window.fetch(`/api/planning/luxlait_machines/${editing.id}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify(machinePayload),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.detail ?? errBody?.error ?? `Failed to update machine: ${res.status}`);
        }
        resolvedMachineId = editing.id;
      } else {
        const res = await window.fetch("/api/planning/luxlait_machines", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(machinePayload),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.detail ?? errBody?.error ?? `Failed to create machine: ${res.status}`);
        }
        const json = await res.json();
        resolvedMachineId = json?.data?.id ?? json?.id;
        if (!resolvedMachineId) throw new Error("Missing machine id after create");
      }

      const osRes = await window.fetch(`/api/planning/luxlait_machines/${resolvedMachineId}/open_shifts`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ timeSlotIds: selectedOpenShiftIds }),
      });
      if (!osRes.ok) throw new Error(`Failed to save open shifts: ${osRes.status}`);

      const existingDtDates = machineDowntimes
        .filter((dt) => dt.machine_id === resolvedMachineId)
        .map((dt) => dt.day_date);

      if (existingDtDates.length > 0) {
        const delRes = await window.fetch("/api/planning/luxlait_machine_downtimes", {
          method: "DELETE",
          headers: authHeaders(),
          body: JSON.stringify({ machineId: resolvedMachineId, dates: existingDtDates }),
        });
        if (!delRes.ok) throw new Error(`Failed to clear downtimes: ${delRes.status}`);
      }

      const uniqueDowntimeEntries = Array.from(
        new Map(downtimeEntries.map((e) => [e.day_date, e])).values()
      ).filter((e) => e.day_date);

      if (uniqueDowntimeEntries.length > 0) {
        const dtRes = await window.fetch("/api/planning/luxlait_machine_downtimes", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            machineId: resolvedMachineId,
            dates: uniqueDowntimeEntries.map((e) => e.day_date),
            reason: uniqueDowntimeEntries[0]?.reason || null,
          }),
        });
        if (!dtRes.ok) throw new Error(`Failed to save downtimes: ${dtRes.status}`);
      }

      setOpen(false);
      fetchData();
      toast({ title: "Saved", description: "Machine updated successfully." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    await supabase.from("luxlait_machines" as any).delete().eq("id", id);
    fetchData();
  };

  const shiftTimeSlots = timeSlots.filter((ts) => {
    const nameLower = (ts.name ?? "").toLowerCase();
    const shortLower = (ts.short_name ?? "").toLowerCase();
    const isRepos = nameLower.includes("repos") || shortLower.includes("repos");
    return !isRepos;
  });

  const addDowntimeEntry = () => {
    if (!newDowntimeDate) return;
    const trimmedReason = newDowntimeReason.trim();
    setDowntimeEntries((prev) => {
      if (prev.some((e) => e.day_date === newDowntimeDate)) return prev;
      return [...prev, { day_date: newDowntimeDate, reason: trimmedReason }];
    });
    setNewDowntimeDate("");
    setNewDowntimeReason("");
  };

  const removeDowntimeEntry = (day_date: string) => {
    setDowntimeEntries((prev) => prev.filter((e) => e.day_date !== day_date));
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Gestion des machines</h2>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Nom raccourci</TableHead>
            <TableHead>Groupe</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Importance</TableHead>
            <TableHead>Max employés</TableHead>
            <TableHead>Ordre</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {machines.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>{m.short_name ?? "—"}</TableCell>
              <TableCell>{m.machine_group ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{m.description ?? "—"}</TableCell>
              <TableCell>
                {(() => {
                  const imp = (m.importance ?? "OPTIONAL") as MachineImportance;
                  const label = imp === "MANDATORY" ? "Mandatory" : imp === "PRIORITY" ? "Priority" : "Optional";
                  const bg =
                    imp === "MANDATORY" ? "#F87171" : imp === "PRIORITY" ? "#FBBF24" : "#9CA3AF";
                  return (
                    <Badge style={{ backgroundColor: bg, color: "#fff" }} className="border-0">
                      {label}
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell>{m.max_employees ?? 1}</TableCell>
              <TableCell>{m.sort_order}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la machine" : "Nouvelle machine"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Name</div>
              <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Short name</div>
              <Input
                placeholder="ex: CDL-T"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Group</div>
              <Input placeholder="ex: CDL" value={group} onChange={(e) => setGroup(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Description</div>
              <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Importance</div>
              <Select value={importance} onValueChange={(v) => setImportance(v as MachineImportance)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Importance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANDATORY">Mandatory</SelectItem>
                  <SelectItem value="PRIORITY">Priority</SelectItem>
                  <SelectItem value="OPTIONAL">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Open shifts</div>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                {Array.from(new Map(shiftTimeSlots.map((ts) => [ts.name, ts])).values()).map((ts) => {
                  const idsForName = shiftTimeSlots.filter((s) => s.name === ts.name).map((s) => s.id);
                  const allSelected = idsForName.every((id) => selectedOpenShiftIds.includes(id));
                  return (
                    <label key={ts.name} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          setSelectedOpenShiftIds((prev) =>
                            checked
                              ? [...new Set([...prev, ...idsForName])]
                              : prev.filter((id) => !idsForName.includes(id))
                          );
                        }}
                      />
                      <span>{ts.name}</span>
                    </label>
                  );
                })}
              </div>
              {selectedOpenShiftIds.length === 0 && (
                <div className="text-xs text-muted-foreground">All shifts are allowed</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Indisponibilités (arrêts machine)</div>
              <p className="text-xs text-muted-foreground">
                Jours où cette machine ne peut pas être planifiée (auto-plan et saisie manuelle).
              </p>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Date</div>
                  <Input type="date" value={newDowntimeDate} onChange={(e) => setNewDowntimeDate(e.target.value)} />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="text-xs text-muted-foreground">Reason</div>
                  <Input
                    placeholder="Optional"
                    value={newDowntimeReason}
                    onChange={(e) => setNewDowntimeReason(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" onClick={addDowntimeEntry} disabled={!newDowntimeDate}>
                  Add
                </Button>
              </div>

              {downtimeEntries.length === 0 ? (
                <div className="text-xs text-muted-foreground">No downtime scheduled</div>
              ) : (
                <div className="space-y-2">
                  {downtimeEntries.map((entry) => (
                    <div
                      key={entry.day_date}
                      className="flex items-center justify-between gap-2 text-sm border rounded-md px-2 py-1"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{entry.day_date}</div>
                        {entry.reason ? (
                          <div className="text-xs text-muted-foreground truncate">{entry.reason}</div>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => removeDowntimeEntry(entry.day_date)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Max employees</div>
              <Input
                type="number"
                placeholder="Max employees"
                value={maxEmployees}
                onChange={(e) => setMaxEmployees(Math.max(1, Number(e.target.value)))}
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
