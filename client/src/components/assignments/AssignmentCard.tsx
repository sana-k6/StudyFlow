import React, { useState } from 'react';
import { AssignmentWithDetails, apiClient } from '../../services/apiClient';
import { Clock, Calendar, CheckSquare, Square, Trash2, Plus, Sparkles } from 'lucide-react';

interface AssignmentCardProps {
  assignment: AssignmentWithDetails;
  onRefresh: () => void;
  onAiBreakdown?: (assignmentId: string) => void;
}

export default function AssignmentCard({ assignment, onRefresh, onAiBreakdown }: AssignmentCardProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskMins, setNewSubtaskMins] = useState(45);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completedSubtasks = assignment.subtasks.filter((s) => s.is_completed).length;
  const totalSubtasks = assignment.subtasks.length;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Calculate days remaining
  const dueDate = new Date(assignment.due_date);
  const now = new Date();
  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  async function handleToggleSubtask(subtaskId: string, currentStatus: boolean) {
    try {
      await apiClient.updateSubtask(subtaskId, { is_completed: !currentStatus });
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle subtask', err);
    }
  }

  async function handleAddSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await apiClient.createSubtask(assignment.id, newSubtaskTitle.trim(), newSubtaskMins);
      setNewSubtaskTitle('');
      setIsAddingSubtask(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to add subtask', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSubtask(subtaskId: string) {
    try {
      await apiClient.deleteSubtask(subtaskId);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete subtask', err);
    }
  }

  async function handleDeleteAssignment() {
    if (!confirm(`Delete assignment "${assignment.title}"?`)) return;
    try {
      await apiClient.deleteAssignment(assignment.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete assignment', err);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-md text-white shadow-2xs"
              style={{ backgroundColor: assignment.module_color || '#3B82F6' }}
            >
              {assignment.module_code || 'MODULE'}
            </span>
            {assignment.weight_percentage > 0 && (
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {assignment.weight_percentage}% of Grade
              </span>
            )}
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                diffDays < 3
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : diffDays < 7
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {diffDays < 0
                ? 'Overdue'
                : diffDays === 0
                ? 'Due Today'
                : diffDays === 1
                ? 'Due Tomorrow'
                : `Due in ${diffDays} days`}
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-900 pt-0.5">{assignment.title}</h3>
          {assignment.description && (
            <p className="text-xs text-slate-500 line-clamp-2">{assignment.description}</p>
          )}
        </div>

        <button
          onClick={handleDeleteAssignment}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          title="Delete Assignment"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Meta Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
        <span className="flex items-center space-x-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </span>
        <span className="flex items-center space-x-1">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Est. {(assignment.estimated_total_mins / 60).toFixed(1)} hrs</span>
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
          <span>Subtasks Completion</span>
          <span>{completedSubtasks} / {totalSubtasks} ({progressPercent}%)</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Subtasks List */}
      <div className="space-y-2 pt-1">
        {assignment.subtasks.map((sub) => (
          <div
            key={sub.id}
            className={`group flex items-center justify-between p-2 rounded-xl text-xs transition ${
              sub.is_completed ? 'bg-slate-50 text-slate-400' : 'bg-slate-50/70 hover:bg-slate-50 text-slate-800'
            }`}
          >
            <div className="flex items-center space-x-2.5 flex-1 min-w-0 mr-2">
              <button
                type="button"
                onClick={() => handleToggleSubtask(sub.id, sub.is_completed)}
                className="text-slate-400 hover:text-blue-600 transition flex-shrink-0"
              >
                {sub.is_completed ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>

              <span className={`truncate ${sub.is_completed ? 'line-through text-slate-400' : 'font-medium'}`}>
                {sub.title}
              </span>

              {sub.ai_generated && (
                <span className="text-[10px] px-1 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200 flex items-center space-x-0.5 flex-shrink-0">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>AI</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                {sub.estimated_mins}m
              </span>
              <button
                onClick={() => handleDeleteSubtask(sub.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition"
                title="Remove subtask"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {/* Add Subtask Inline Form */}
        {isAddingSubtask ? (
          <form onSubmit={handleAddSubtask} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <input
              type="text"
              required
              placeholder="Subtask name (e.g. Write Literature Review)..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 text-xs text-slate-600">
                <span>Est:</span>
                <input
                  type="number"
                  min="10"
                  step="5"
                  value={newSubtaskMins}
                  onChange={(e) => setNewSubtaskMins(Number(e.target.value))}
                  className="w-14 text-xs px-1.5 py-1 border border-slate-300 rounded"
                />
                <span>mins</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddingSubtask(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setIsAddingSubtask(true)}
              className="flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-700 p-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subtask</span>
            </button>

            {onAiBreakdown && assignment.subtasks.length === 0 && (
              <button
                onClick={() => onAiBreakdown(assignment.id)}
                className="flex items-center space-x-1 text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Breakdown</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
