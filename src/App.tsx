import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { StrategyPage } from './pages/StrategyPage';
import { ContentPage } from './pages/ContentPage';
import { ContentEditorPage } from './pages/ContentEditorPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { NewCampaignPage } from './pages/NewCampaignPage';
import { CampaignDetailsPage } from './pages/CampaignDetailsPage';
import { LeadsPage } from './pages/LeadsPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ProspectingPage } from './pages/ProspectingPage';
import { ProspectingDetailsPage } from './pages/ProspectingDetailsPage';
import { AssistantPage } from './pages/AssistantPage';

function ProtectedRoute({ children, requireOnboarding = true }: { children: React.ReactNode, requireOnboarding?: boolean }) {
  const { user, business, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (requireOnboarding && business && !business.onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Se já fez onboarding, não deixa acessar o onboarding de novo
  if (!requireOnboarding && business?.onboardingCompleted && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/onboarding" element={
            <ProtectedRoute requireOnboarding={false}>
              <OnboardingPage />
            </ProtectedRoute>
          } />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="strategy" element={<StrategyPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="content/:id" element={<ContentEditorPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="campaigns/new" element={<NewCampaignPage />} />
            <Route path="campaigns/:id" element={<CampaignDetailsPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="prospecting" element={<ProspectingPage />} />
            <Route path="prospecting/:searchId" element={<ProspectingDetailsPage />} />
            <Route path="opportunities" element={<OpportunitiesPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="assistant" element={<AssistantPage />} />
            {/* Outras rotas serao adicionadas nas proximas fases */}
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
