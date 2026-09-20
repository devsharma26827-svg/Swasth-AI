import React from 'react';
import { Home, Activity, TrendingUp, FileText, User } from 'lucide-react';

export type NavTab = 'home' | 'checkup' | 'trends' | 'reports' | 'profile';

interface Props {
  activeTab: NavTab;
  onTabChange?: (tab: NavTab) => void;
  onChangeTab?: (tab: NavTab) => void;
}

export const BottomNav: React.FC<Props> = ({ activeTab, onTabChange, onChangeTab }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'checkup', label: 'Checkup', icon: Activity, badge: '5-min' },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  const handleTabChange = (tabId: NavTab) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else if (onChangeTab) {
      onChangeTab(tabId);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#EAE7DE] bg-[#FDFCF9]/95 backdrop-blur-md pb-safe">
      <div className="w-full md:max-w-lg md:mx-auto flex items-center justify-around px-2 py-1.5">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as NavTab)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-[#15803D] font-bold'
                  : 'text-[#656E66] hover:text-[#1F2421] font-medium'
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-[#E8F5E9]' : ''}`}>
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
              {tab.badge && !isActive && (
                <span className="absolute -top-1 right-1 rounded-full bg-[#15803D] text-white px-1.5 py-0.2 text-[8px] font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
