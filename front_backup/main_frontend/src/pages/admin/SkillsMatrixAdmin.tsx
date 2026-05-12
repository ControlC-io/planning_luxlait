import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

type Employee = { id: string; first_name: string; last_name: string };
type Machine = { id: string; name: string; machine_group: string | null };
type Skill = { employee_id: string; machine_id: string };

export default function SkillsMatrixAdmin() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    const [e, m, s] = await Promise.all([
      supabase.from("luxlait_employees" as any).select("id, first_name, last_name").eq("active", true).order("last_name"),
      supabase.from("luxlait_machines" as any).select("id, name, machine_group").order("sort_order"),
      supabase.from("luxlait_employee_machine_skills" as any).select("employee_id, machine_id"),
    ]);
    setEmployees((e.data as any) ?? []);
    setMachines((m.data as any) ?? []);
    setSkills((s.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const skillSet = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => set.add(`${s.employee_id}_${s.machine_id}`));
    return set;
  }, [skills]);

  const hasSkill = (empId: string, machId: string) => skillSet.has(`${empId}_${machId}`);

  const toggleSkill = useCallback(async (empId: string, machId: string, currentlyChecked: boolean) => {
    if (currentlyChecked) {
      // Remove
      const { error } = await supabase
        .from("luxlait_employee_machine_skills" as any)
        .delete()
        .eq("employee_id", empId)
        .eq("machine_id", machId);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        return;
      }
      setSkills((prev) => prev.filter((s) => !(s.employee_id === empId && s.machine_id === machId)));
    } else {
      // Add
      const { error } = await supabase
        .from("luxlait_employee_machine_skills" as any)
        .insert({ employee_id: empId, machine_id: machId });
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        return;
      }
      setSkills((prev) => [...prev, { employee_id: empId, machine_id: machId }]);
    }
  }, [toast]);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Matrice des compétences</h2>
        <p className="text-sm text-muted-foreground">Cochez les machines sur lesquelles chaque employé est habilité.</p>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-[11px] border-collapse leading-none">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-1.5 py-1 text-left font-medium text-muted-foreground min-w-[120px] sticky left-0 bg-muted/50 z-10 border-r">
                Employé
              </th>
              {machines.map((m) => (
                <th
                  key={m.id}
                  className="px-0.5 py-0.5 text-center font-medium min-w-[28px] border-r"
                  title={m.name}
                >
                  <div className="text-[9px] leading-tight whitespace-nowrap overflow-hidden max-h-[80px]"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    {m.name}
                  </div>
                </th>
              ))}
              <th className="px-1 py-1 text-center font-medium text-muted-foreground min-w-[32px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const empSkillCount = machines.filter((m) => hasSkill(emp.id, m.id)).length;
              return (
                <tr key={emp.id} className="border-b hover:bg-muted/30">
                  <td className="px-1.5 py-0.5 font-medium sticky left-0 bg-card z-10 border-r whitespace-nowrap">
                    {emp.last_name} {emp.first_name}
                  </td>
                  {machines.map((m) => {
                    const checked = hasSkill(emp.id, m.id);
                    return (
                      <td key={m.id} className="px-0.5 py-0 text-center border-r">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSkill(emp.id, m.id, checked)}
                          className="h-3.5 w-3.5"
                        />
                      </td>
                    );
                  })}
                  <td className="px-1 py-0.5 text-center font-semibold text-muted-foreground">
                    {empSkillCount}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-muted/50 border-t-2">
              <td className="px-1.5 py-0.5 font-medium sticky left-0 bg-muted/50 z-10 border-r">
                Total
              </td>
              {machines.map((m) => {
                const count = employees.filter((e) => hasSkill(e.id, m.id)).length;
                return (
                  <td key={m.id} className="px-0.5 py-0.5 text-center font-semibold text-muted-foreground border-r">
                    {count}
                  </td>
                );
              })}
              <td className="px-1 py-0.5 text-center font-bold">
                {skills.length}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
