import React, { useState, useEffect } from 'react';
import { Step1ServerConnect } from './components/Step1ServerConnect';
import { Step2Auth } from './components/Step2Auth';
import { Step3Nickname } from './components/Step3Nickname';
import { Dashboard } from './components/Dashboard';
import { GameServer, GlobalConfig, UserProfile } from './types';
import { apiService } from './services/api';
import { authService } from './services/auth';
import { Loader2 } from 'lucide-react';

type FlowStep = 'INITIALIZING' | 'STEP_1_SERVER' | 'STEP_2_AUTH' | 'STEP_3_NICKNAME' | 'STEP_4_DASHBOARD';

export const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<FlowStep>('INITIALIZING');
  const [backendUrl, setBackendUrl] = useState<string>(apiService.getBaseUrl());
  
  // Temporary state during Step 2 -> Step 3 registration flow
  const [pendingRegistration, setPendingRegistration] = useState<{ email: string; passwordPlain: string } | null>(null);

  // Authenticated State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Dashboard Data
  const [selectedServer, setSelectedServer] = useState<GameServer | null>(null);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    id: 'global',
    minecraftVersion: '1.20.1',
    loaderType: 'FABRIC',
    loaderVersion: '0.15.11',
    javaVersion: 17,
    jvmArgs: '-XX:+UseG1GC',
  });

  // Initialize flow on startup
  useEffect(() => {
    const initFlow = async () => {
      const storedUrl = apiService.getBaseUrl();
      setBackendUrl(storedUrl);

      // 1. Check if backend is reachable
      try {
        await apiService.checkHealth(storedUrl);
      } catch (err) {
        // Backend not configured or offline -> Start at Step 1
        setCurrentStep('STEP_1_SERVER');
        return;
      }

      // 2. Check for existing auth session
      const authState = authService.getInitialState();
      if (authState.isAuthenticated && authState.token && authState.user) {
        try {
          const verifiedUser = await apiService.fetchMe(authState.token);
          setUser(verifiedUser);
          setAuthToken(authState.token);
          authService.setSession(authState.token, verifiedUser);
          await loadDashboardData();
          setCurrentStep('STEP_4_DASHBOARD');
          return;
        } catch {
          // Token expired or invalid
          authService.clearSession();
        }
      }

      // 3. Fallback to Auth step
      setCurrentStep('STEP_2_AUTH');
    };

    initFlow();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [serverList, config] = await Promise.all([
        apiService.fetchServers(),
        apiService.fetchGlobalConfig(),
      ]);

      if (serverList.length > 0) {
        const primary = serverList.find((s) => s.isPrimary) || serverList[0];
        setSelectedServer(primary);
      }
      setGlobalConfig(config);
    } catch (err) {
      console.error('[App] Failed to load dashboard server data:', err);
    }
  };

  // Step 1: Server Connected Callback
  const handleServerConnected = async (url: string) => {
    setBackendUrl(url);
    const authState = authService.getInitialState();
    if (authState.isAuthenticated && authState.token && authState.user) {
      try {
        const verifiedUser = await apiService.fetchMe(authState.token);
        setUser(verifiedUser);
        setAuthToken(authState.token);
        await loadDashboardData();
        setCurrentStep('STEP_4_DASHBOARD');
        return;
      } catch {
        authService.clearSession();
      }
    }
    setCurrentStep('STEP_2_AUTH');
  };

  // Step 2: Auth Login Success
  const handleAuthSuccess = async (token: string, authUser: UserProfile) => {
    setUser(authUser);
    setAuthToken(token);
    authService.setSession(token, authUser);
    await loadDashboardData();
    setCurrentStep('STEP_4_DASHBOARD');
  };

  // Step 2 -> Step 3: Begin Registration
  const handleStartRegister = (email: string, passwordPlain: string) => {
    setPendingRegistration({ email, passwordPlain });
    setCurrentStep('STEP_3_NICKNAME');
  };

  // Step 3: Registration Complete
  const handleRegistrationComplete = async (token: string, authUser: UserProfile) => {
    setPendingRegistration(null);
    setUser(authUser);
    setAuthToken(token);
    authService.setSession(token, authUser);
    await loadDashboardData();
    setCurrentStep('STEP_4_DASHBOARD');
  };

  // Dashboard Actions
  const handleLogout = () => {
    authService.clearSession();
    setUser(null);
    setAuthToken(null);
    setCurrentStep('STEP_2_AUTH');
  };

  // Render Current Step
  if (currentStep === 'INITIALIZING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0f17] text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-xs text-slate-400 font-mono">Initializing CustomMCLauncher...</span>
      </div>
    );
  }

  if (currentStep === 'STEP_1_SERVER') {
    return <Step1ServerConnect onConnected={handleServerConnected} />;
  }

  if (currentStep === 'STEP_2_AUTH') {
    return (
      <Step2Auth
        backendUrl={backendUrl}
        onChangeServer={() => setCurrentStep('STEP_1_SERVER')}
        onAuthenticated={handleAuthSuccess}
        onStartRegister={handleStartRegister}
      />
    );
  }

  if (currentStep === 'STEP_3_NICKNAME' && pendingRegistration) {
    return (
      <Step3Nickname
        email={pendingRegistration.email}
        passwordPlain={pendingRegistration.passwordPlain}
        onBack={() => setCurrentStep('STEP_2_AUTH')}
        onRegistered={handleRegistrationComplete}
      />
    );
  }

  return (
    <Dashboard
      selectedServer={selectedServer}
      globalConfig={globalConfig}
      user={user}
      authToken={authToken}
      onLogout={handleLogout}
      onAuthSuccess={async (u, t) => {
        setUser(u);
        setAuthToken(t);
        authService.setSession(t, u);
        await loadDashboardData();
      }}
    />
  );
};

export default App;
