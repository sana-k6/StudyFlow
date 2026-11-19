import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { AnalyticsSummary, Module, StudyLog } from '@studyflow/shared/types';
import ModuleHoursChart from '../components/analytics/ModuleHoursChart';
import CompletionVelocityCard from '../components/analytics/CompletionVelocityCard';
import LogStudyModal from '../components/analytics/LogStudyModal';
import { Clock, AlertTriangle, Plus, Calendar, Star } from 'lucide-react';

interface AnalyticsPageProps {
  modules: Module[];
}

export default function AnalyticsPage({ modules }: AnalyticsPageProps) {
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<
    Array<
      StudyLog & {
        module_code: string;
        module_name: string;
        module_color: string;
        subtask_title?: string;
      }
    >
  >([]);
  const [loading, setLoading] = useState(true);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [range]);

  async function fetchData() {
    try {
      setLoading(true);
      const [sumData, logsData] = await Promise.all([
        apiClient.getAnalyticsSummary(range),
        apiClient.getStudyLogs(),
      ]);
      setSummary(sumData);
      setRecentLogs(logsData);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Productivity & Study Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track focused study hours, module workloads, and completion velocity
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* 7d vs 30d toggle */}
          <div className="flex items-center space-x-1 border border-slate-200 rounded-xl p-1 bg-slate-50 text-xs font-semibold">
            <button
              onClick={() => setRange('7d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                range === '7d' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Past 7 Days
            </button>
            <button
              onClick={() => setRange('30d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                range === '30d' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Past 30 Days
            </button>
          </div>

          <button
            onClick={() => setIsLogModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Log Study</span>
          </button>
        </div>
      </div>

      {loading || !summary ? (
        <div className="flex items-center justify-center p-16 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Key Metric Counters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Logged Focus Time</p>
                <p className="text-2xl font-extrabold text-slate-900">
                  {(summary.total_study_mins / 60).toFixed(1)} <span className="text-sm font-normal text-slate-500">hours</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Subtasks Velocity</p>
                <p className="text-2xl font-extrabold text-slate-900">
                  {summary.completion_velocity.completed_subtasks} <span className="text-sm font-normal text-slate-500">/ {summary.completion_velocity.total_subtasks}</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                summary.at_risk_deadlines.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'
              }`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Upcoming At-Risk Deadlines</p>
                <p className={`text-2xl font-extrabold ${summary.at_risk_deadlines.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {summary.at_risk_deadlines.length}
                </p>
              </div>
            </div>
          </div>

          {/* At-Risk Deadlines Banner (if any) */}
          {summary.at_risk_deadlines.length > 0 && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Attention Required — Imminent Deadlines
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summary.at_risk_deadlines.map((item) => (
                  <div
                    key={item.assignment_id}
                    className="bg-white p-3.5 rounded-xl border border-amber-200 flex items-center justify-between text-xs shadow-2xs"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900">{item.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Due: {new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded font-bold text-[10px] bg-red-100 text-red-800">
                        {item.days_left <= 0 ? 'Due Today' : `In ${item.days_left}d`}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Est. {(item.remaining_mins / 60).toFixed(1)} hrs left
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ModuleHoursChart
              data={summary.hours_by_module}
              totalMins={summary.total_study_mins}
            />

            <CompletionVelocityCard velocity={summary.completion_velocity} />
          </div>

          {/* Recent Study Log Activity */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Focus Sessions</h3>
                <p className="text-xs text-slate-500">History of logged study intervals</p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {recentLogs.length} sessions logged
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No focus sessions logged yet. Click "+ Log Study" to start tracking.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: log.module_color || '#3B82F6' }}
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{log.module_code}</span>
                          {log.subtask_title && (
                            <span className="text-slate-500 truncate max-w-xs">
                              — {log.subtask_title}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(log.logged_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {log.focus_rating && (
                        <div className="flex items-center text-amber-400">
                          {Array.from({ length: log.focus_rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-current" />
                          ))}
                        </div>
                      )}
                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                        {log.duration_mins} mins
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Log Study Modal */}
      <LogStudyModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        modules={modules}
        onLogSaved={fetchData}
      />
    </div>
  );
}
