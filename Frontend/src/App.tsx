import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Landing from "@/pages/Landing";
import NotFound from "@/pages/NotFound";
import CitizenLogin from "@/pages/citizen/Login";
import CitizenDashboard from "@/pages/citizen/Dashboard";
import CitizenReport from "@/pages/citizen/Report";
import CitizenTrack from "@/pages/citizen/Track";
import CitizenLeaderboard from "@/pages/citizen/Leaderboard";
import CitizenRewards from "@/pages/citizen/Rewards";
import CitizenSOS from "@/pages/citizen/SOS";
import CitizenFeedback from "@/pages/citizen/Feedback";
import AdminLogin from "@/pages/admin/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminComplaints from "@/pages/admin/Complaints";
import AdminResolve from "@/pages/admin/Resolve";
import AdminSettings from "@/pages/admin/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/citizen/login" element={<CitizenLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/citizen/dashboard" element={<ProtectedRoute role="citizen"><CitizenDashboard /></ProtectedRoute>} />
            <Route path="/citizen/report" element={<ProtectedRoute role="citizen"><CitizenReport /></ProtectedRoute>} />
            <Route path="/citizen/track" element={<ProtectedRoute role="citizen"><CitizenTrack /></ProtectedRoute>} />
            <Route path="/citizen/leaderboard" element={<CitizenLeaderboard />} />
            <Route path="/citizen/rewards" element={<ProtectedRoute role="citizen"><CitizenRewards /></ProtectedRoute>} />
            <Route path="/citizen/sos" element={<ProtectedRoute role="citizen"><CitizenSOS /></ProtectedRoute>} />
            <Route path="/citizen/feedback" element={<ProtectedRoute role="citizen"><CitizenFeedback /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/complaints" element={<ProtectedRoute role="admin"><AdminComplaints /></ProtectedRoute>} />
            <Route path="/admin/resolve" element={<ProtectedRoute role="admin"><AdminResolve /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminSettings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppProvider>
  </QueryClientProvider>
);

export default App;
