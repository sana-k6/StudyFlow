import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';
import { CalendarEvent, EventType, Module } from '@studyflow/shared/types';
import { Calendar as CalendarIcon, Trash2, X, Sparkles } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  onEventSaved: () => void;
  initialEvent?: CalendarEvent | null;
  defaultDate?: string;
  defaultTitle?: string;
  defaultModuleId?: string;
  defaultSubtaskId?: string;
  defaultEstimatedMins?: number;
  defaultEventType?: EventType;
}

export default function EventModal({
  isOpen,
  onClose,
  modules,
  onEventSaved,
  initialEvent,
  defaultDate,
  defaultTitle,
  defaultModuleId,
  defaultSubtaskId,
  defaultEstimatedMins = 60,
  defaultEventType = 'LECTURE',
}: EventModalProps) {
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>('LECTURE');
  const [moduleId, setModuleId] = useState<string>('');
  const [subtaskId, setSubtaskId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title);
      setEventType(initialEvent.event_type);
      setModuleId(initialEvent.module_id || '');
      setSubtaskId(initialEvent.subtask_id || null);
      setStartDate(initialEvent.start_time.slice(0, 10));
      setStartTime(initialEvent.start_time.slice(11, 16));
      setEndTime(initialEvent.end_time.slice(11, 16));
    } else {
      setTitle(defaultTitle || '');
      setEventType(defaultEventType);
      setModuleId(defaultModuleId || '');
      setSubtaskId(defaultSubtaskId || null);
      
      const dateToUse = defaultDate || new Date().toISOString().split('T')[0];
      setStartDate(dateToUse);

      const now = new Date();
      // Default to next nearest hour (e.g. 10:00)
      const currentHour = (now.getUTCHours() + 1) % 24;
      const startH = String(currentHour).padStart(2, '0');
      setStartTime(`${startH}:00`);

      // Calculate end time based on estimated mins
      const endTotalMins = currentHour * 60 + defaultEstimatedMins;
      const endH = String(Math.floor(endTotalMins / 60) % 24).padStart(2, '0');
      const endM = String(endTotalMins % 60).padStart(2, '0');
      setEndTime(`${endH}:${endM}`);
    }
  }, [isOpen, initialEvent, defaultDate, defaultTitle, defaultModuleId, defaultSubtaskId, defaultEstimatedMins, defaultEventType]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSaving(true);
      setErrorMsg(null);

      const startIso = new Date(`${startDate}T${startTime}:00Z`).toISOString();
      const endIso = new Date(`${startDate}T${endTime}:00Z`).toISOString();

      if (startIso >= endIso) {
        setErrorMsg('Start time must be before end time');
        setSaving(false);
        return;
      }

      const isFixed = eventType !== 'AI_STUDY_BLOCK';

      if (initialEvent) {
        await apiClient.updateEvent(initialEvent.id, {
          title: title.trim(),
          event_type: eventType,
          module_id: moduleId || null,
          subtask_id: subtaskId || null,
          start_time: startIso,
          end_time: endIso,
          is_fixed: isFixed,
        });
      } else {
        await apiClient.createEvent({
          title: title.trim(),
          event_type: eventType,
          module_id: moduleId || null,
          subtask_id: subtaskId || null,
          start_time: startIso,
          end_time: endIso,
          is_fixed: isFixed,
        });
      }

      onEventSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save calendar event');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initialEvent) return;
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await apiClient.deleteEvent(initialEvent.id);
      onEventSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete event');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              eventType === 'AI_STUDY_BLOCK' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
            }`}>
              {eventType === 'AI_STUDY_BLOCK' ? <Sparkles className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                {initialEvent ? 'Edit Calendar Event' : eventType === 'AI_STUDY_BLOCK' ? 'Schedule Study Block' : 'Add Calendar Event'}
              </h3>
              <p className="text-xs text-slate-500">
                {eventType === 'AI_STUDY_BLOCK' ? 'Movable study block (will not block auto-rescheduling)' : 'Fixed university event or commitment'}
              </p>
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Event / Session Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Study Session: Balanced Trees"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="AI_STUDY_BLOCK">✨ AI Study Block</option>
                <option value="LECTURE">📘 Lecture</option>
                <option value="TUTORIAL">👥 Tutorial / Lab</option>
                <option value="EXAM">🎯 Exam / Assessment</option>
                <option value="PERSONAL">☕ Personal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Module</label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">None / General</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} - {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            {initialEvent ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-slate-600 hover:text-slate-800 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                {saving ? 'Saving...' : initialEvent ? 'Update' : eventType === 'AI_STUDY_BLOCK' ? 'Schedule Block' : 'Create Event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
