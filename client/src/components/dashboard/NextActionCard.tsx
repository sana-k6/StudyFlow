import { NextActionResponse } from '@studyflow/shared/types';
import { Target, CheckCircle2, CheckSquare, Square, Clock, Sparkles } from 'lucide-react';

interface NextActionCardProps {
  nextAction: NextActionResponse | null;
  loading: boolean;
  onSubtaskToggled?: () => void;
  onScheduleBlock?: (subtaskTitle: string, moduleId?: string, subtaskId?: string, estimatedMins?: number) => void;
}

export default function NextActionCard({
  nextAction,
  loading,
  onSubtaskToggled,
  onScheduleBlock,
}: NextActionCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/4 mb-3" />
        <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
      </div>
    );
  }

  if (!nextAction || !nextAction.subtask) {
    return (
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 rounded-2xl border border-emerald-200/80 p-5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">All Caught Up!</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {nextAction?.rationale || 'No urgent coursework pending. Great job staying ahead!'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { subtask, assignment, module, urgency_score, rationale } = nextAction;

  return (
    <div className="bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 rounded-2xl border border-blue-200 shadow-xs p-5 space-y-4">
      {/* Top Banner Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="flex items-center space-x-1.5 px-2.5 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-lg uppercase tracking-wider shadow-2xs">
            <Target className="w-3.5 h-3.5" />
            <span>Next Recommended Action</span>
          </span>

          {module && (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-md text-white shadow-2xs"
              style={{ backgroundColor: module.color_hex }}
            >
              {module.code}
            </span>
          )}
        </div>

        {/* Urgency Gauge Pill */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500">Urgency:</span>
          <span
            className={`text-xs font-extrabold ${
              urgency_score >= 80
                ? 'text-red-600'
                : urgency_score >= 50
                ? 'text-amber-600'
                : 'text-blue-600'
            }`}
          >
            {urgency_score}/100
          </span>
        </div>
      </div>

      {/* Main Task Highlight Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onSubtaskToggled}
            className="text-slate-400 hover:text-emerald-600 transition flex-shrink-0 mt-0.5"
            title="Mark subtask completed"
          >
            {subtask.is_completed ? (
              <CheckSquare className="w-5 h-5 text-emerald-600" />
            ) : (
              <Square className="w-5 h-5 text-slate-400 hover:text-emerald-500" />
            )}
          </button>

          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-slate-900 leading-tight">
              {subtask.title}
            </h4>
            {assignment && (
              <p className="text-xs text-slate-500">
                Part of <span className="font-semibold text-slate-700">{assignment.title}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2.5 sm:self-center pl-8 sm:pl-0">
          <span className="flex items-center space-x-1 text-xs text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{subtask.estimated_mins} mins</span>
          </span>

          {onScheduleBlock && (
            <button
              onClick={() => onScheduleBlock(subtask.title, module?.id, subtask.id, subtask.estimated_mins)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Schedule Study Block</span>
            </button>
          )}
        </div>
      </div>

      {/* Plain-English Rationale */}
      <div className="flex items-start space-x-2 text-xs text-slate-600 bg-blue-50/60 p-3 rounded-xl border border-blue-100">
        <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">{rationale}</p>
      </div>
    </div>
  );
}
