import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus } from "lucide-react";

type Team = { id: string; name: string; color: string; sort_order: number };

export default function TeamsAdmin() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [sortOrder, setSortOrder] = useState(0);
  const { toast } = useToast();

  const fetch = async () => {
    const { data } = await supabase.from("luxlait_teams" as any).select("*").order("sort_order");
    setTeams((data as any) ?? []);
  };
  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditing(null); setName(""); setColor("#3B82F6"); setSortOrder(teams.length); setOpen(true); };
  const openEdit = (t: Team) => { setEditing(t); setName(t.name); setColor(t.color); setSortOrder(t.sort_order); setOpen(true); };

  const save = async () => {
    if (editing) {
      await supabase.from("luxlait_teams" as any).update({ name, color, sort_order: sortOrder }).eq("id", editing.id);
    } else {
      await supabase.from("luxlait_teams" as any).insert({ name, color, sort_order: sortOrder });
    }
    setOpen(false);
    fetch();
  };

  const remove = async (id: string) => {
    await supabase.from("luxlait_teams" as any).delete().eq("id", id);
    fetch();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Gestion des équipes</h2>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Couleur</TableHead>
            <TableHead>Ordre</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell>
                <span className="inline-block h-5 w-5 rounded" style={{ backgroundColor: t.color }} />
              </TableCell>
              <TableCell>{t.sort_order}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'équipe" : "Nouvelle équipe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex items-center gap-2">
              <label className="text-sm">Couleur</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 cursor-pointer" />
            </div>
            <Input type="number" placeholder="Ordre" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </div>
          <DialogFooter>
            <Button onClick={save}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
