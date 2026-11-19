import { useState } from 'react';
import { apiClient } from '../../services/apiClient';
import { Sparkles, Check, X, Zap } from 'lucide-react';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradeSuccess: () => void;
  featureTitle?: string;
  featureDescription?: string;
}

export default function PaywallModal({
  isOpen,
  onClose,
  onUpgradeSuccess,
  featureTitle = 'Unlock StudyFlow Pro',
  featureDescription = 'Upgrade your plan to unlock intelligent scheduling and unlimited AI breakdowns.',
}: PaywallModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleUpgrade() {
    try {
      setLoading(true);
      await apiClient.upgradeMock();
      onUpgradeSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to upgrade:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Pro Banner */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 text-white text-center relative overflow-hidden">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Sparkles className="w-6 h-6 text-amber-300" />
          </div>

          <h3 className="text-xl font-black tracking-tight">{featureTitle}</h3>
          <p className="text-xs text-white/80 mt-1 max-w-xs mx-auto">
            {featureDescription}
          </p>
        </div>

        {/* Features List */}
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-3" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Intelligent 14-Day Auto-Scheduling</h4>
                <p className="text-[11px] text-slate-500">
                  Maps coursework into your real timetable gaps using Gemini and our deterministic slot calculator.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-3" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Unlimited AI Coursework Breakdowns</h4>
                <p className="text-[11px] text-slate-500">
                  No monthly caps. Break down dissertations, lab reports, and coding projects into step-by-step subtasks.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-3" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Dynamic Schedule Rebalancing</h4>
                <p className="text-[11px] text-slate-500">
                  Reschedule with one click when exams are announced or classes shift.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Upgrading...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                  <span>Activate Pro (Demo Upgrade)</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-2">
              Free trial demonstration mode • Instant activation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
