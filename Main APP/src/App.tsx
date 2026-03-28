import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppLayout } from '@/components/layout';
import { LandingPage, HomePage, DashboardPage, RecordsPage, DoctorPage, SharedAccessPage } from '@/pages';

export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <BrowserRouter>
        <Routes>
          {/* Landing page - role selection */}
          <Route path="/" element={<LandingPage />} />

          {/* Patient pages with SiteLayout */}
          <Route path="/overview" element={<HomePage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/shared" element={<SharedAccessPage />} />

          {/* Doctor page (standalone) */}
          <Route path="/doctor" element={<DoctorPage />} />

          {/* App pages - sidebar layout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<DashboardPage />} /> {/* TODO: Settings page */}
            <Route path="/help" element={<DashboardPage />} /> {/* TODO: Help page */}
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}
