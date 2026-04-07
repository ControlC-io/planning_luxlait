import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

type ClosedDay = {
  id: string;
  day_date: string;
  reason: string | null;
};

const WEEK_DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

function authHeaders(withJson: boolean = false): Record<string, string> {
  const token = localStorage.getItem("myrtest_jwt_token");
  return {
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function ClosedDaysAdmin() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([]);
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");

  const currentYear = new Date().getFullYear();
  const fromDate = `${currentYear}-01-01`;
  const toDate = `${currentYear + 2}-12-31`;

  const sortedClosedDays = useMemo(
    () => [...closedDays].sort((a, b) => a.day_date.localeCompare(b.day_date)),
    [closedDays]
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [weekdaysRes, datesRes] = await Promise.all([
        fetch("/api/planning/luxlait_closed_weekdays", { headers: authHeaders() }),
        fetch(`/api/planning/luxlait_closed_days?fromDate=${fromDate}&toDate=${toDate}`, {
          headers: authHeaders(),
        }),
      ]);

      const weekdaysJson = await weekdaysRes.json().catch(() => ({}));
      const datesJson = await datesRes.json().catch(() => []);

      if (!weekdaysRes.ok) throw new Error(weekdaysJson?.error ?? "Failed to load closed weekdays");
      if (!datesRes.ok) throw new Error(datesJson?.error ?? "Failed to load closed days");

      setClosedWeekdays(Array.isArray(weekdaysJson?.weekdays) ? weekdaysJson.weekdays : []);
      setClosedDays(Array.isArray(datesJson) ? datesJson : []);
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Chargement impossible",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveClosedWeekdays = async () => {
    try {
      const res = await fetch("/api/planning/luxlait_closed_weekdays", {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ weekdays: closedWeekdays }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to save closed weekdays");
      toast({ title: "Succès", description: "Jours fermés hebdomadaires enregistrés." });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Enregistrement impossible",
        variant: "destructive",
      });
    }
  };

  const addClosedDate = async () => {
    if (!newDate) return;
    try {
      const res = await fetch("/api/planning/luxlait_closed_days", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ day_date: newDate, reason: newReason || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to add closed day");
      setNewDate("");
      setNewReason("");
      await fetchData();
      toast({ title: "Succès", description: "Date fermée ajoutée." });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Ajout impossible",
        variant: "destructive",
      });
    }
  };

  const removeClosedDate = async (dayDate: string) => {
    try {
      const res = await fetch("/api/planning/luxlait_closed_days", {
        method: "DELETE",
        headers: authHeaders(true),
        body: JSON.stringify({ day_date: dayDate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete closed day");
      await fetchData();
      toast({ title: "Succès", description: "Date fermée supprimée." });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Suppression impossible",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold">Jours fermés</h2>
        <p className="text-sm text-muted-foreground">
          Configurez les fermetures récurrentes et exceptionnelles pour empêcher l auto planification.
        </p>
      </div>

      <div className="space-y-3 border rounded-md p-4">
        <h3 className="font-medium">Fermeture hebdomadaire</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {WEEK_DAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={closedWeekdays.includes(day.value)}
                onCheckedChange={(checked) =>
                  setClosedWeekdays((prev) =>
                    checked
                      ? Array.from(new Set([...prev, day.value])).sort((a, b) => a - b)
                      : prev.filter((d) => d !== day.value)
                  )
                }
              />
              {day.label}
            </label>
          ))}
        </div>
        <Button onClick={saveClosedWeekdays} disabled={loading}>
          Enregistrer les jours hebdomadaires
        </Button>
      </div>

      <div className="space-y-3 border rounded-md p-4">
        <h3 className="font-medium">Dates exceptionnelles</h3>
        <div className="flex flex-col md:flex-row gap-2">
          <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <Input
            placeholder="Raison optionnelle"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
          />
          <Button type="button" onClick={addClosedDate} disabled={!newDate || loading}>
            Ajouter
          </Button>
        </div>

        {sortedClosedDays.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucune date fermée enregistrée.</div>
        ) : (
          <div className="space-y-2">
            {sortedClosedDays.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{entry.day_date}</div>
                  {entry.reason ? (
                    <div className="text-xs text-muted-foreground">{entry.reason}</div>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => removeClosedDate(entry.day_date)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
