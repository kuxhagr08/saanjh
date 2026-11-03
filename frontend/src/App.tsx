import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CallProvider } from './context/CallContext';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { MessagesPage } from './pages/MessagesPage';
import { VaultPage } from './pages/VaultPage';
import { AIPage } from './pages/AIPage';
import { PlannerPage } from './pages/PlannerPage';
import { GrowthPage } from './pages/GrowthPage';
import { SecurityPage } from './pages/SecurityPage';
import { CustomizationProvider, useCustomization } from './context/CustomizationContext';
import { IntentProvider } from './context/IntentContext';
import { SocialPage } from './pages/SocialPage';
import { DisabledModuleNotice } from './components/DisabledModuleNotice';
import { Shield } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from './constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();
  const { isModuleEnabled } = useCustomization();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    let handler: any;
    try {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (location.pathname !== '/') {
          navigate(-1);
        } else {
          CapApp.exitApp();
        }
      }).then((h) => {
        handler = h;
      });
    } catch {
      // standard web browser context
    }
    return () => {
      if (handler?.remove) handler.remove();
    };
  }, [location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-apna-bg gap-4">
        <div className="w-12 h-12 rounded-2xl bg-apna-accent flex items-center justify-center shadow-glow">
          <Shield className="w-6 h-6 text-white animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-apna-text">{APP_NAME}</p>
          <p className="text-xs text-apna-faint mt-0.5">Unlocking your private space...</p>
        </div>
        <div className="w-24 h-0.5 bg-apna-border rounded-full overflow-hidden">
          <div className="h-full bg-apna-accent rounded-full animate-[shimmer_1.5s_ease_infinite]" style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/messages"
          element={isModuleEnabled('messages') ? <MessagesPage /> : <DisabledModuleNotice moduleId="messages" />}
        />
        <Route
          path="/social"
          element={isModuleEnabled('social') ? <SocialPage /> : <DisabledModuleNotice moduleId="social" />}
        />
        <Route
          path="/vault"
          element={isModuleEnabled('vault') ? <VaultPage /> : <DisabledModuleNotice moduleId="vault" />}
        />
        <Route
          path="/ai"
          element={isModuleEnabled('ai') ? <AIPage /> : <DisabledModuleNotice moduleId="ai" />}
        />
        <Route
          path="/planner"
          element={isModuleEnabled('planner') ? <PlannerPage /> : <DisabledModuleNotice moduleId="planner" />}
        />
        <Route
          path="/growth"
          element={isModuleEnabled('growth') ? <GrowthPage /> : <DisabledModuleNotice moduleId="growth" />}
        />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CallProvider>
          <CustomizationProvider>
            <IntentProvider>
              <BrowserRouter>
                <ProtectedRoutes />
              </BrowserRouter>
            </IntentProvider>
          </CustomizationProvider>
        </CallProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
