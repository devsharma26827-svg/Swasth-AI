import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { EmergencyModal } from './components/EmergencyModal';
import { ProfileSetupModal } from './components/ProfileSetupModal';
import { AuthModal } from './components/AuthModal';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { CheckupFlow } from './screens/CheckupFlow';
import { TrendsScreen } from './screens/TrendsScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { DoctorConsultScreen } from './screens/DoctorConsultScreen';
import { LabBookingScreen } from './screens/LabBookingScreen';
import { FollowUpScreen } from './screens/FollowUpScreen';
import { profileApi, riskApi, scenarioApi, dataApi, authApi, setAuthToken } from './services/api';
import { UserProfile, RiskSummary, DemoScenario } from './types';

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [currentScenario, setCurrentScenario] = useState<DemoScenario>('normal');
  const [currentTab, setCurrentTab] = useState<'home' | 'checkup' | 'trends' | 'reports' | 'profile'>('home');
  const [activeSubView, setActiveSubView] = useState<'none' | 'doctor_consult' | 'lab_booking' | 'follow_up'>('none');
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    bootstrapApp();
  }, []);

  const bootstrapApp = async () => {
    setIsLoading(true);
    try {
      // 1. Verify active session with GET /api/auth/me
      const meRes = await authApi.me();
      if (meRes && meRes.profile) {
        const fetchedProfile = meRes.profile;
        setProfile(fetchedProfile);

        // Fetch risk summary & demo scenario for authenticated user
        try {
          const [riskRes, scenarioRes] = await Promise.all([
            riskApi.getSummary(),
            scenarioApi.getCurrent()
          ]);
          setRiskSummary(riskRes.risk);
          setCurrentScenario(scenarioRes.currentScenario);
        } catch (_) {}

        if (!fetchedProfile.profileCompleted) {
          setShowProfileSetup(true);
        } else {
          setShowProfileSetup(false);
        }
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.log('[Auth] No active authenticated session:', err);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRisk = async () => {
    try {
      const riskRes = await riskApi.getSummary();
      setRiskSummary(riskRes.risk);
    } catch (e) {
      console.warn('Could not refresh risk', e);
    }
  };

  const handleScenarioChange = async (scenario: DemoScenario) => {
    setCurrentScenario(scenario);
    try {
      await scenarioApi.set(scenario);
      await refreshRisk();
    } catch (e) {
      console.warn('Could not persist scenario change', e);
    }
  };

  const handleResetDemoData = async () => {
    try {
      await dataApi.reset();
      localStorage.removeItem('swasth_onboarded');
      await bootstrapApp();
    } catch (e) {
      console.warn('Could not reset demo data', e);
    }
  };

  const handleProfileSetupComplete = (newProfile: UserProfile) => {
    setProfile(newProfile);
    setShowProfileSetup(false);
    localStorage.setItem('swasth_onboarded', 'true');
  };

  const handleAuthSuccess = async (authUser: UserProfile) => {
    setProfile(authUser);
    await bootstrapApp();
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (_) {}
    setProfile(null);
    setCurrentTab('home');
    setActiveSubView('none');
  };

  // If initial load in progress
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] text-center p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#15803D] border-t-transparent mb-3" />
        <h2 className="text-sm font-bold text-gray-800">Verifying session...</h2>
        <p className="text-xs text-gray-500 mt-1">Connecting to secure SwasthAI authentication engine</p>
      </div>
    );
  }

  // GATEKEEPER: If unauthenticated, render dedicated Login / Register AuthScreen
  if (!profile) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1F2421] font-sans antialiased selection:bg-[#E8F5E9]">
      {/* Top Application Bar */}
      <Header
        onOpenEmergency={() => setIsEmergencyModalOpen(true)}
        currentScenario={currentScenario}
        onScenarioChange={handleScenarioChange}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        userName={profile?.name}
      />

      {/* Main View Router */}
      <main className="mx-auto max-w-lg">
        {/* SUBVIEWS (OVERLAYS) */}
        {activeSubView === 'doctor_consult' && (
          <DoctorConsultScreen onBack={() => setActiveSubView('none')} />
        )}

        {activeSubView === 'lab_booking' && (
          <LabBookingScreen onBack={() => setActiveSubView('none')} />
        )}

        {activeSubView === 'follow_up' && (
          <FollowUpScreen
            onBack={() => setActiveSubView('none')}
            onConsultClick={() => setActiveSubView('doctor_consult')}
            onLabClick={() => setActiveSubView('lab_booking')}
          />
        )}

        {/* PRIMARY TAB SCREENS */}
        {activeSubView === 'none' && (
          <>
            {currentTab === 'home' && (
              <HomeScreen
                onStartCheckup={() => setCurrentTab('checkup')}
                onViewTrends={() => setCurrentTab('trends')}
                onViewReports={() => setCurrentTab('reports')}
                onOpenDoctorConsult={() => setActiveSubView('doctor_consult')}
                onOpenLabBooking={() => setActiveSubView('lab_booking')}
                onOpenFollowUp={() => setActiveSubView('follow_up')}
                riskSummary={riskSummary}
                userProfile={profile}
              />
            )}

            {currentTab === 'checkup' && (
              <CheckupFlow
                onComplete={() => {
                  refreshRisk();
                  setCurrentTab('reports');
                }}
                onCancel={() => setCurrentTab('home')}
                userProfile={profile}
              />
            )}

            {currentTab === 'trends' && (
              <TrendsScreen onStartCheckup={() => setCurrentTab('checkup')} />
            )}

            {currentTab === 'reports' && (
              <ReportsScreen
                onConsultDoctor={() => setActiveSubView('doctor_consult')}
                onBookLab={() => setActiveSubView('lab_booking')}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileScreen
                profile={profile}
                onProfileUpdate={setProfile}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav currentTab={currentTab} onTabChange={tab => {
        setActiveSubView('none');
        setCurrentTab(tab);
      }} />

      {/* Modals & Popups */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
      />

      <ProfileSetupModal
        isOpen={showProfileSetup}
        profile={profile}
        onSave={handleProfileSetupComplete}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
