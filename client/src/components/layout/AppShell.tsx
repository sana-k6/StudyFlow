import { useState, useEffect } from 'react';
import { UserProfileResponse, Module } from '@studyflow/shared/types';
import { apiClient } from '../../services/apiClient';
import CalendarPage from '../../pages/CalendarPage';
import AssignmentsPage from '../../pages/AssignmentsPage';
import AnalyticsPage from '../../pages/AnalyticsPage';
import ModulesModal from '../modules/ModulesModal';
import {
  GraduationCap,
  Calendar,
  CheckSquare,
  BookOpen,
  LogOut,
  Sparkles,
  BarChart3,
} from 'lucide-react';

interface AppShellProps {
  user: UserProfileResponse;
  onLogout: () => void;
  onRefreshUser?: () => void;
}

export default function AppShell({ user, onLogout, onRefreshUser }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'assignments' | 'analytics'>('calendar');
  const [modules, setModules] = useState<Module[]>([]);
  const [isModulesModalOpen, setIsModulesModalOpen] = useState(false);

  useEffect(() => {
    fetchModules();
  }, []);

  async function fetchModules() {
    try {
      const data = await apiClient.getModules();
      setModules(data);
    } catch (err) {
      console.error('Failed to load modules', err);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900 leading-none block">
                StudyFlow
              </span>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block mt-0.5">
                Academic Planner
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 border border-slate-200 rounded-xl p-1 bg-slate-50/80">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'calendar'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Timetable</span>
            </button>

            <button
              onClick={() => setActiveTab('assignments')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'assignments'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Assignments</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => setIsModulesModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 transition"
            >
              <BookOpen className="w-4 h-4" />
              <span>Modules ({modules.length})</span>
            </button>
          </nav>
        </div>

        {/* User Profile & Tier Status */}
        <div className="flex items-center space-x-3">
          <span
            className={`inline-flex items-center space-x-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
              user.subscription_tier === 'PRO'
                ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 border-purple-200'
                : 'bg-blue-50 text-blue-700 border-blue-200/80'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{user.subscription_tier} Tier</span>
          </span>

          <div className="hidden sm:block text-right">
            <p className="text-xs font-bold text-slate-800">{user.full_name}</p>
            <p className="text-[11px] text-slate-500 font-medium">{user.university || 'University Student'}</p>
          </div>

          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Tab View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'calendar' ? (
          <CalendarPage
            modules={modules}
            user={user}
            onModulesChanged={fetchModules}
            onRefreshProfile={onRefreshUser}
          />
        ) : activeTab === 'assignments' ? (
          <AssignmentsPage
            modules={modules}
            onOpenModulesModal={() => setIsModulesModalOpen(true)}
            onRefreshProfile={onRefreshUser}
          />
        ) : (
          <AnalyticsPage modules={modules} />
        )}
      </main>

      {/* Modules Management Modal */}
      <ModulesModal
        isOpen={isModulesModalOpen}
        onClose={() => setIsModulesModalOpen(false)}
        modules={modules}
        onModulesChanged={fetchModules}
      />
    </div>
  );
}
