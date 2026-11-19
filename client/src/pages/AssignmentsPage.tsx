import { useState, useEffect } from 'react';
import { apiClient, AssignmentWithDetails } from '../services/apiClient';
import { Module } from '@studyflow/shared/types';
import AssignmentCard from '../components/assignments/AssignmentCard';
import AssignmentModal from '../components/assignments/AssignmentModal';
import AiBreakdownModal from '../components/assignments/AiBreakdownTree';
import PaywallModal from '../components/common/PaywallModal';
import { Plus, BookOpen, Clock, CheckCircle2 } from 'lucide-react';

interface AssignmentsPageProps {
  modules: Module[];
  onOpenModulesModal: () => void;
  onRefreshProfile?: () => void;
}

export default function AssignmentsPage({ modules, onOpenModulesModal, onRefreshProfile }: AssignmentsPageProps) {
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('ALL');

  // AI Breakdown Modal state
  const [breakdownTarget, setBreakdownTarget] = useState<{ id: string; title: string } | null>(null);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  async function fetchAssignments() {
    try {
      setLoading(true);
      const data = await apiClient.getAssignments();
      setAssignments(data);
    } catch (err) {
      console.error('Failed to load assignments', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredAssignments = assignments.filter((a) => {
    if (selectedModuleId === 'ALL') return true;
    return a.module_id === selectedModuleId;
  });

  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a) => a.status === 'COMPLETED').length;
  const totalSubtasks = assignments.reduce((acc, a) => acc + a.subtasks.length, 0);
  const completedSubtasks = assignments.reduce(
    (acc, a) => acc + a.subtasks.filter((s) => s.is_completed).length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Coursework & Assignments</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track module deadlines, subtask progress, and weighted assessment goals
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={onOpenModulesModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Manage Modules</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Assignment</span>
          </button>
        </div>
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center space-x-3 shadow-2xs">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Assignments</p>
            <p className="text-lg font-bold text-slate-900">{totalAssignments - completedAssignments}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center space-x-3 shadow-2xs">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Subtasks Completed</p>
            <p className="text-lg font-bold text-slate-900">{completedSubtasks} / {totalSubtasks}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center space-x-3 shadow-2xs">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Tracked Work</p>
            <p className="text-lg font-bold text-slate-900">
              {(assignments.reduce((sum, a) => sum + a.estimated_total_mins, 0) / 60).toFixed(1)} hrs
            </p>
          </div>
        </div>
      </div>

      {/* Filter by Module Pill Row */}
      {modules.length > 0 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedModuleId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedModuleId === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Modules ({assignments.length})
          </button>
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModuleId(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                selectedModuleId === m.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selectedModuleId === m.id ? '#ffffff' : m.color_hex }}
              />
              <span>{m.code}</span>
            </button>
          ))}
        </div>
      )}

      {/* Assignments Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-16 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No assignments found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {modules.length === 0
              ? 'Configure your modules first, then add assignments and subtasks.'
              : 'Add your coursework, dissertations, and lab reports to keep on track.'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            Create First Assignment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAssignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onRefresh={fetchAssignments}
              onAiBreakdown={(id) => setBreakdownTarget({ id, title: assignment.title })}
            />
          ))}
        </div>
      )}

      {/* New Assignment Modal */}
      <AssignmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        modules={modules}
        onAssignmentCreated={fetchAssignments}
      />

      {/* AI Breakdown Modal */}
      {breakdownTarget && (
        <AiBreakdownModal
          isOpen={Boolean(breakdownTarget)}
          onClose={() => setBreakdownTarget(null)}
          assignmentId={breakdownTarget.id}
          assignmentTitle={breakdownTarget.title}
          onBreakdownApplied={() => {
            fetchAssignments();
            if (onRefreshProfile) onRefreshProfile();
          }}
          onQuotaExceeded={() => setIsPaywallOpen(true)}
        />
      )}

      {/* Paywall Upgrade Modal */}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        featureTitle="Monthly AI Quota Reached"
        featureDescription="You've used all 3 free monthly AI breakdowns. Upgrade to StudyFlow Pro for unlimited breakdowns."
        onUpgradeSuccess={() => {
          if (onRefreshProfile) onRefreshProfile();
        }}
      />
    </div>
  );
}
