import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";

type Team = { id: string; name: string; color: string };
type Machine = { id: string; name: string };
type Employee = { id: string; first_name: string; last_name: string; default_team_id: string | null; is_team_leader: boolean; is_backup: boolean; active: boolean };

export default function EmployeesAdmin() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [skills, setSkills] = useState<{ employee_id: string; machine_id: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [isLeader, setIsLeader] = useState(false);
  const [isBackup, setIsBackup] = useState(false);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);

  const fetchAll = async () => {
    const [e, t, m, s] = await Promise.all([
      supabase.from("luxlait_employees" as any).select("*").eq("active", true).order("last_name"),
      supabase.from("luxlait_teams" as any).select("id, name, color").order("sort_order"),
      supabase.from("luxlait_machines" as any).select("id, name").order("sort_order"),
      supabase.from("luxlait_employee_machine_skills" as any).select("employee_id, machine_id"),
    ]);
    setEmployees((e.data as any) ?? []);
    setTeams((t.data as any) ?? []);
    setMachines((m.data as any) ?? []);
    setSkills((s.data as any) ?? []);
  };
  useEffect(() => { fetchAll(); }, []);

  const openNew = () => {
    setEditing(null); setFirstName(""); setLastName(""); setTeamId(""); setIsLeader(false); setIsBackup(false); setSelectedMachines([]);
    setOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp); setFirstName(emp.first_name); setLastName(emp.last_name);
    setTeamId(emp.default_team_id ?? ""); setIsLeader(emp.is_team_leader); setIsBackup(emp.is_backup);
    setSelectedMachines(skills.filter((s) => s.employee_id === emp.id).map((s) => s.machine_id));
    setOpen(true);
  };

  const save = async () => {
    const empData = {
      first_name: firstName,
      last_name: lastName,
      default_team_id: teamId || null,
      is_team_leader: isLeader,
      is_backup: isBackup,
    };
    let empId = editing?.id;
    if (editing) {
      await supabase.from("luxlait_employees" as any).update(empData).eq("id", editing.id);
    } else {
      const { data } = await supabase.from("luxlait_employees" as any).insert(empData).select("id").single();
      empId = (data as any)?.id;
    }
    if (empId) {
      await supabase.from("luxlait_employee_machine_skills" as any).delete().eq("employee_id", empId);
      if (selectedMachines.length > 0) {
        await supabase.from("luxlait_employee_machine_skills" as any).insert(
          selectedMachines.map((mid) => ({ employee_id: empId!, machine_id: mid }))
        );
      }
    }
    setOpen(false);
    fetchAll();
  };

  const remove = async (id: string) => {
    await supabase.from("luxlait_employees" as any).update({ active: false }).eq("id", id);
    fetchAll();
  };

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Gestion des employés</h2>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Prénom</TableHead>
            <TableHead>Équipe</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Machines</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((emp) => {
            const team = teamMap.get(emp.default_team_id ?? "");
            const empSkills = skills.filter((s) => s.employee_id === emp.id);
            return (
              <TableRow key={emp.id}>
                <TableCell className="font-medium">{emp.last_name}</TableCell>
                <TableCell>{emp.first_name}</TableCell>
                <TableCell>
                  {team && <Badge style={{ backgroundColor: team.color, color: "#fff" }} className="border-0">{team.name}</Badge>}
                </TableCell>
                <TableCell>
                  {emp.is_team_leader && <Badge variant="outline" className="mr-1">Chef</Badge>}
                  {emp.is_backup && <Badge variant="outline">Backup</Badge>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {empSkills.length} machine(s)
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(emp.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'employé" : "Nouvel employé"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder="Équipe par défaut" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isLeader} onCheckedChange={(v) => setIsLeader(!!v)} />
                Chef d'équipe
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isBackup} onCheckedChange={(v) => setIsBackup(!!v)} />
                Back Up
              </label>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Machines autorisées</p>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                {machines.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedMachines.includes(m.id)}
                      onCheckedChange={(checked) => {
                        setSelectedMachines((prev) =>
                          checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                        );
                      }}
                    />
                    {m.name}
                  </label>
                ))}
              </div>
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
