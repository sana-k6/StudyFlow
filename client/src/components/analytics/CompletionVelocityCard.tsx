import { AnalyticsSummary } from '@studyflow/shared/types';
import { Zap, CheckCircle2 } from 'lucide-react';

interface CompletionVelocityCardProps {
  velocity: AnalyticsSummary['completion_velocity'];
}

export default function CompletionVelocityCard({ velocity }: CompletionVelocityCardProps) {
  const { completed_subtasks, total_subtasks, completion_rate } = velocity;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Completion Velocity</h3>
          <p className="text-xs text-slate-500">Coursework subtask completion rate</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <Zap className="w-4 h-4 fill-amber-500" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div>
          <div className="text-3xl font-extrabold text-slate-900">
            {completion_rate}%
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{completed_subtasks} of {total_subtasks} subtasks completed</span>
          </p>
        </div>

        {/* Circular Progress Ring */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-100"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-blue-600 transition-all duration-500 ease-out"
              strokeDasharray={`${completion_rate}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute text-[11px] font-bold text-slate-700">
            {completion_rate}%
          </span>
        </div>
      </div>

      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-center justify-between">
        <span className="font-medium">Study Momentum:</span>
        <span className="font-bold text-slate-900">
          {completion_rate >= 80
            ? '🔥 High Velocity'
            : completion_rate >= 50
            ? '⚡ Steady Progress'
            : '🌱 Ramping Up'}
        </span>
      </div>
    </div>
  );
}
