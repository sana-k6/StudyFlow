import { useState } from 'react';
import { apiClient, ApiErrorResponse } from '../../services/apiClient';
import { Sparkles, Check, Clock, AlertCircle, X } from 'lucide-react';

interface AiBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  assignmentTitle: string;
  onBreakdownApplied: () => void;
  onQuotaExceeded?: () => void;
}

export default function AiBreakdownModal({
  isOpen,
  onClose,
  assignmentId,
  assignmentTitle,
  onBreakdownApplied,
  onQuotaExceeded,
}: AiBreakdownModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleRunBreakdown() {
    try {
      setLoading(true);
      setErrorMsg(null);
      await apiClient.triggerAiBreakdown(assignmentId);
      onBreakdownApplied();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiErrorResponse) {
        if (err.code === 'QUOTA_EXCEEDED') {
          onClose();
          if (onQuotaExceeded) onQuotaExceeded();
          return;
        }
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to generate breakdown. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Gemini AI Task Breakdown</h3>
              <p className="text-[11px] text-slate-500">Structured outputs via gemini-2.5-flash</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Target Assignment</span>
            <h4 className="text-sm font-bold text-slate-900">{assignmentTitle}</h4>
            <p className="text-xs text-slate-600 pt-1">
              Gemini will break this assignment into 4 to 8 sequential, bite-sized study blocks (30–90 mins each) tailored for your weekly timetable.
            </p>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Generates sequential checklist with estimated minutes</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Compatible with Auto-Scheduling & Next Action</span>
            </div>
          </div>

          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-700">Analyzing brief & generating steps...</p>
              <p className="text-[11px] text-slate-400">Structured JSON schema enforced</p>
            </div>
          ) : (
            <div className="pt-2">
              <button
                onClick={handleRunBreakdown}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Subtasks with AI</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
