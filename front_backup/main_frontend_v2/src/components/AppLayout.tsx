import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar, Users, Wrench, Palette, Clock, Grid3X3, LogOut, CalendarOff } from "lucide-react";

const navItems = [
  { to: "/", label: "Planning", icon: Calendar },
  { to: "/admin/machines", label: "Machines", icon: Wrench, admin: true },
  { to: "/admin/employees", label: "Employés", icon: Users, admin: true },
  { to: "/admin/skills", label: "Compétences", icon: Grid3X3, admin: true },
  { to: "/admin/statuses", label: "Statuts", icon: Palette, admin: true },
  { to: "/admin/timeslots", label: "Créneaux", icon: Clock, admin: true },
  { to: "/admin/employee-day-offs", label: "Congés", icon: CalendarOff, admin: true },
  { to: "/admin/machine-weekly-closures", label: "Fermetures machines", icon: CalendarOff, admin: true },
];

export default function AppLayout() {
  const { user, isAdmin, isManager, signOut } = useAuth();
  const location = useLocation();
  const canViewAdminPages = isAdmin || isManager;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="flex h-14 items-center gap-4 px-4">
          <h1 className="text-lg font-bold text-primary">Luxlait</h1>
          <nav className="flex items-center gap-1 ml-4">
            {navItems
              .filter((item) => !item.admin || canViewAdminPages)
              .map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    location.pathname === item.to
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
