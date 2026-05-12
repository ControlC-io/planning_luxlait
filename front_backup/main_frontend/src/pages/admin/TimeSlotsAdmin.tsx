import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";

type TimeSlot = { id: string; name: string; short_name: string | null; color: string; sort_order: number };

export default function TimeSlotsAdmin() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TimeSlot | null>(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [sortOrder, setSortOrder] = useState(0);

  const fetchSlots = async () => {
    const { data } = await supabase.from("luxlait_time_slots" as any).select("*").order("sort_order");
    setSlots((data as any) ?? []);
  };
  useEffect(() => { fetchSlots(); }, []);

  const openNew = () => { setEditing(null); setName(""); setShortName(""); setColor("#3B82F6"); setSortOrder(slots.length); setOpen(true); };
  const openEdit = (s: TimeSlot) => { setEditing(s); setName(s.name); setShortName(s.short_name ?? ""); setColor(s.color); setSortOrder(s.sort_order); setOpen(true); };

  const save = async () => {
    if (editing) {
      await supabase.from("luxlait_time_slots" as any).update({ name, short_name: shortName || null, color, sort_order: sortOrder }).eq("id", editing.id);
    } else {
      await supabase.from("luxlait_time_slots" as any).insert({ name, short_name: shortName || null, color, sort_order: sortOrder });
    }
    setOpen(false);
    fetchSlots();
  };

  const remove = async (id: string) => {
    await supabase.from("luxlait_time_slots" as any).delete().eq("id", id);
    fetchSlots();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Gestion des créneaux horaires</h2>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Nom raccourci</TableHead>
            <TableHead>Couleur</TableHead>
            <TableHead>Ordre</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slots.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>{s.short_name ?? "—"}</TableCell>
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
            <DialogTitle>{editing ? "Modifier le créneau" : "Nouveau créneau"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Nom raccourci (ex: M, AM, N)" value={shortName} onChange={(e) => setShortName(e.target.value)} />
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
