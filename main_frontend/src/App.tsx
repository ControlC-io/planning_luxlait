import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import Planning from "./pages/Planning";
import AppLayout from "./components/AppLayout";
import MachinesAdmin from "./pages/admin/MachinesAdmin";
import EmployeesAdmin from "./pages/admin/EmployeesAdmin";
import StatusesAdmin from "./pages/admin/StatusesAdmin";
import TimeSlotsAdmin from "./pages/admin/TimeSlotsAdmin";
import SkillsMatrixAdmin from "./pages/admin/SkillsMatrixAdmin";
import ClosedDaysAdmin from "./pages/admin/ClosedDaysAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Chargement...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isManager, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Chargement...</div>;
  if (!isAdmin && !isManager) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/" element={<Planning />} />
      <Route path="/admin/machines" element={<AdminRoute><MachinesAdmin /></AdminRoute>} />
      <Route path="/admin/employees" element={<AdminRoute><EmployeesAdmin /></AdminRoute>} />
      <Route path="/admin/statuses" element={<AdminRoute><StatusesAdmin /></AdminRoute>} />
      <Route path="/admin/skills" element={<AdminRoute><SkillsMatrixAdmin /></AdminRoute>} />
      <Route path="/admin/timeslots" element={<AdminRoute><TimeSlotsAdmin /></AdminRoute>} />
      <Route path="/admin/closed-days" element={<AdminRoute><ClosedDaysAdmin /></AdminRoute>} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
