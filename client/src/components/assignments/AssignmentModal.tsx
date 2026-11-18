import React, { useState } from 'react';
import { apiClient } from '../../services/apiClient';
import { Module } from '@studyflow/shared/types';
import { FileText, X } from 'lucide-react';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  onAssignmentCreated: () => void;
}

export default function AssignmentModal({
  isOpen,
  onClose,
  modules,
  onAssignmentCreated,
}: AssignmentModalProps) {
  const [moduleId, setModuleId] = useState(modules[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Default due date: 7 days from now at 23:59
  const defaultDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [dueDateStr, setDueDateStr] = useState(defaultDueDate.toISOString().slice(0, 10));
  const [dueTimeStr, setDueTimeStr] = useState('23:59');

  const [weightPercentage, setWeightPercentage] = useState<number | ''>(25);
  const [estimatedTotalMins, setEstimatedTotalMins] = useState<number | ''>(180);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleId || !title.trim()) {
      setErrorMsg('Please select a module and enter a title');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      const dueIso = new Date(`${dueDateStr}T${dueTimeStr}:00Z`).toISOString();

      await apiClient.createAssignment({
        module_id: moduleId,
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueIso,
        weight_percentage: weightPercentage ? Number(weightPercentage) : 0,
        estimated_total_mins: estimatedTotalMins ? Number(estimatedTotalMins) : 120,
      });

      onAssignmentCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">New Academic Assignment</h3>
              <p className="text-xs text-slate-500">Track essays, projects, lab reports, and dissertations</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Module</label>
              <select
                required
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {modules.length === 0 && <option value="">No modules found (create one first)</option>}
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Weight (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={weightPercentage}
                onChange={(e) => setWeightPercentage(e.target.value ? Number(e.target.value) : '')}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assignment Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Systems Lab Project"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Brief</label>
            <textarea
              rows={3}
              placeholder="Requirements, rubric guidelines, or topics to cover..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                required
                value={dueDateStr}
                onChange={(e) => setDueDateStr(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Time</label>
              <input
                type="time"
                required
                value={dueTimeStr}
                onChange={(e) => setDueTimeStr(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Estimated Total Study Time (minutes)
            </label>
            <input
              type="number"
              step="15"
              min="15"
              value={estimatedTotalMins}
              onChange={(e) => setEstimatedTotalMins(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {estimatedTotalMins ? `Approx. ${(Number(estimatedTotalMins) / 60).toFixed(1)} hours` : ''}
            </p>
          </div>

          <div className="p-4 bg-slate-50 -mx-5 -mb-5 mt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !moduleId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              {saving ? 'Creating...' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
