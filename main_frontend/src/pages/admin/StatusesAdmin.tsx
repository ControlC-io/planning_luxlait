import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";

type Status = { id: string; name: string; color: string; sort_order: number };

export default function StatusesAdmin() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Status | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#9CA3AF");
  const [sortOrder, setSortOrder] = useState(0);

  const fetch = async () => {
    const { data } = await supabase.from("luxlait_statuses" as any).select("*").order("sort_order");
    setStatuses((data as any) ?? []);
  };
  useEffect(() => { fetch(); }, []);

  const openNew = () => { setEditing(null); setName(""); setColor("#9CA3AF"); setSortOrder(statuses.length); setOpen(true); };
  const openEdit = (s: Status) => { setEditing(s); setName(s.name); setColor(s.color); setSortOrder(s.sort_order); setOpen(true); };

  const save = async () => {
    if (editing) {
      await supabase.from("luxlait_statuses" as any).update({ name, color, sort_order: sortOrder }).eq("id", editing.id);
    } else {
      await supabase.from("luxlait_statuses" as any).insert({ name, color, sort_order: sortOrder });
    }
    setOpen(false);
    fetch();
  };

  const remove = async (id: string) => {
    await supabase.from("luxlait_statuses" as any).delete().eq("id", id);
    fetch();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Gestion des statuts</h2>
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
          {statuses.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  <span className="h-5 w-5 rounded" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-muted-foreground">{s.color}</span>
                </span>
              </TableCell>
              <TableCell>{s.sort_order}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le statut" : "Nouveau statut"}</DialogTitle>
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
