import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { EmergencyModal } from './components/EmergencyModal';
import { ProfileSetupModal } from './components/ProfileSetupModal';
import { AuthModal } from './components/AuthModal';
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
      const [profileRes, riskRes, scenarioRes] = await Promise.all([
        profileApi.get(),
        riskApi.getSummary(),
        scenarioApi.getCurrent()
      ]);

      const fetchedProfile = profileRes.profile;
      setProfile(fetchedProfile);
      setRiskSummary(riskRes.risk);
      setCurrentScenario(scenarioRes.currentScenario);

      // PART 8: If current authenticated user has not completed profile, show profile setup popup
      if (!fetchedProfile.profileCompleted) {
        setShowProfileSetup(true);
      } else {
        setShowProfileSetup(false);
      }
    } catch (err) {
      console.warn('Error loading initial applet state:', err);
      // Fallback local profile
      const fallbackProfile: UserProfile = {
        id: 'usr_patient_default',
        name: 'Patient User',
        email: 'patient@swasthai.com',
        role: 'USER',
        age: 30,
        sex: 'male',
        height: 172,
        weight: 68,
        existingConditions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profileCompleted: false
      };
      setProfile(fallbackProfile);
      setShowProfileSetup(true);
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
    await bootstrapApp();
  };

  const handleLogout = async () => {
    await authApi.logout();
    setProfile(null);
    setIsAuthModalOpen(true);
  };

  // If initial load in progress
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] text-center p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#15803D] border-t-transparent mb-3" />
        <h2 className="text-sm font-bold text-gray-800">Starting SwasthAI...</h2>
        <p className="text-xs text-gray-500 mt-1">Checking sensor readiness and physiological baselines</p>
      </div>
    );
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
          <LabBookingScreen onBack={() => setActiveSubView('none')} userProfile={profile} />
        )}

        {activeSubView === 'follow_up' && (
          <FollowUpScreen
            riskSummary={riskSummary}
            onOpenDoctorConsult={() => setActiveSubView('doctor_consult')}
            onOpenLabBooking={() => setActiveSubView('lab_booking')}
            onOpenReports={() => {
              setActiveSubView('none');
              setCurrentTab('reports');
            }}
            onBack={() => setActiveSubView('none')}
          />
        )}

        {/* PRIMARY TABS */}
        {activeSubView === 'none' && (
          <>
            {currentTab === 'home' && (
              <HomeScreen
                profile={profile}
                riskSummary={riskSummary}
                onStartCheckup={() => setCurrentTab('checkup')}
                onNavigateTab={(tab) => setCurrentTab(tab)}
                onOpenDoctorConsult={() => setActiveSubView('doctor_consult')}
                onOpenLabBooking={() => setActiveSubView('lab_booking')}
                onOpenFollowUp={() => setActiveSubView('follow_up')}
              />
            )}

            {currentTab === 'checkup' && (
              <CheckupFlow
                profile={profile!}
                currentScenario={currentScenario}
                onFinishCheckup={() => {
                  refreshRisk();
                  setCurrentTab('home');
                }}
                onNavigateToFollowUp={() => setActiveSubView('follow_up')}
                onNavigateToReports={() => setCurrentTab('reports')}
              />
            )}

            {currentTab === 'trends' && <TrendsScreen />}

            {currentTab === 'reports' && (
              <ReportsScreen onBack={() => setCurrentTab('home')} />
            )}

            {currentTab === 'profile' && (
              <ProfileScreen
                profile={profile!}
                currentScenario={currentScenario}
                onUpdateProfile={(p) => setProfile(p)}
                onScenarioChange={handleScenarioChange}
                onResetDemoData={handleResetDemoData}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav
        activeTab={currentTab}
        onTabChange={(tab) => {
          setActiveSubView('none');
          setCurrentTab(tab);
        }}
        onChangeTab={(tab) => {
          setActiveSubView('none');
          setCurrentTab(tab);
        }}
      />

      {/* First-Time User Profile Setup Modal */}
      <ProfileSetupModal
        initialProfile={profile}
        isOpen={showProfileSetup}
        onComplete={handleProfileSetupComplete}
      />

      {/* Account Switching & Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Emergency & Red-Flag Guidance Modal */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
      />
    </div>
  );
}
