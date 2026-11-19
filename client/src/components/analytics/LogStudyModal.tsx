import React, { useState } from 'react';
import { apiClient } from '../../services/apiClient';
import { Module } from '@studyflow/shared/types';
import { Clock, Star, X } from 'lucide-react';

interface LogStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  onLogSaved: () => void;
  defaultModuleId?: string;
  defaultSubtaskId?: string;
}

export default function LogStudyModal({
  isOpen,
  onClose,
  modules,
  onLogSaved,
  defaultModuleId,
  defaultSubtaskId,
}: LogStudyModalProps) {
  const [moduleId, setModuleId] = useState(defaultModuleId || modules[0]?.id || '');
  const [durationMins, setDurationMins] = useState<number | ''>(45);
  const [focusRating, setFocusRating] = useState<number>(4);
  const [subtaskId] = useState<string | null>(defaultSubtaskId || null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleId || !durationMins || Number(durationMins) < 5) {
      setErrorMsg('Please select a module and enter at least 5 minutes');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      await apiClient.logStudy({
        module_id: moduleId,
        subtask_id: subtaskId,
        duration_mins: Number(durationMins),
        focus_rating: focusRating,
      });

      onLogSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to log study session');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Log Study Session</h3>
              <p className="text-[11px] text-slate-500">Record focus time and track module hours</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Module</label>
            <select
              required
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (minutes)</label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="5"
                max="720"
                step="5"
                required
                value={durationMins}
                onChange={(e) => setDurationMins(e.target.value ? Number(e.target.value) : '')}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                {durationMins ? `(${(Number(durationMins) / 60).toFixed(1)} hrs)` : ''}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Focus Rating (1–5 Stars)
            </label>
            <div className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFocusRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= focusRating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              {saving ? 'Logging...' : 'Save Study Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
