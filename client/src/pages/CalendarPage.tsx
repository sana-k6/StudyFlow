import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { CalendarEvent, Module, NextActionResponse, EventType } from '@studyflow/shared/types';
import AcademicCalendarGrid from '../components/calendar/AcademicCalendarGrid';
import IcsImportModal from '../components/calendar/IcsImportModal';
import EventModal from '../components/calendar/EventModal';
import NextActionCard from '../components/dashboard/NextActionCard';
import { UploadCloud, Plus, Sparkles } from 'lucide-react';

interface CalendarPageProps {
  modules: Module[];
  onModulesChanged: () => void;
}

export default function CalendarPage({ modules, onModulesChanged }: CalendarPageProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isIcsModalOpen, setIsIcsModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Next-Action state
  const [nextAction, setNextAction] = useState<NextActionResponse | null>(null);
  const [loadingNextAction, setLoadingNextAction] = useState(true);

  // EventModal defaults for custom block creation
  const [modalDefaults, setModalDefaults] = useState<{
    date?: string;
    title?: string;
    moduleId?: string;
    subtaskId?: string;
    estimatedMins?: number;
    eventType?: EventType;
  }>({});

  useEffect(() => {
    fetchEvents();
    fetchNextAction();
  }, []);

  async function fetchEvents() {
    try {
      setLoading(true);
      const data = await apiClient.getEvents();
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchNextAction() {
    try {
      setLoadingNextAction(true);
      const data = await apiClient.getNextAction();
      setNextAction(data);
    } catch (err) {
      console.error('Failed to load next action', err);
    } finally {
      setLoadingNextAction(false);
    }
  }

  async function handleToggleNextActionSubtask() {
    if (!nextAction || !nextAction.subtask) return;
    try {
      await apiClient.updateSubtask(nextAction.subtask.id, {
        is_completed: !nextAction.subtask.is_completed,
      });
      fetchNextAction();
      fetchEvents();
    } catch (err) {
      console.error('Failed to toggle subtask', err);
    }
  }

  function handleScheduleBlockForNextAction(
    subtaskTitle: string,
    moduleId?: string,
    subtaskId?: string,
    estimatedMins: number = 60
  ) {
    setSelectedEvent(null);
    setModalDefaults({
      title: `Study Session: ${subtaskTitle}`,
      moduleId,
      subtaskId,
      estimatedMins,
      eventType: 'AI_STUDY_BLOCK',
    });
    setIsEventModalOpen(true);
  }

  function handleAddEvent(date?: string) {
    setSelectedEvent(null);
    setModalDefaults({
      date,
      eventType: 'LECTURE',
    });
    setIsEventModalOpen(true);
  }

  function handleAddStudyBlock(date?: string) {
    setSelectedEvent(null);
    setModalDefaults({
      date,
      title: 'Self-Directed Study Session',
      estimatedMins: 60,
      eventType: 'AI_STUDY_BLOCK',
    });
    setIsEventModalOpen(true);
  }

  function handleEditEvent(event: CalendarEvent) {
    setSelectedEvent(event);
    setModalDefaults({});
    setIsEventModalOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Next Recommended Action Banner */}
      <NextActionCard
        nextAction={nextAction}
        loading={loadingNextAction}
        onSubtaskToggled={handleToggleNextActionSubtask}
        onScheduleBlock={handleScheduleBlockForNextAction}
      />

      {/* Top Banner Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Academic Timetable & Study Schedule</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View university lectures, tutorials, exams, and scheduled study sessions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleAddStudyBlock()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-semibold transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>+ Study Block</span>
          </button>

          <button
            onClick={() => setIsIcsModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
          >
            <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
            <span>Import (.ics)</span>
          </button>

          <button
            onClick={() => handleAddEvent()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-16 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <AcademicCalendarGrid
          events={events}
          onAddEventClick={handleAddEvent}
          onEventClick={handleEditEvent}
        />
      )}

      {/* Import Modal */}
      <IcsImportModal
        isOpen={isIcsModalOpen}
        onClose={() => setIsIcsModalOpen(false)}
        onSuccess={() => {
          fetchEvents();
          onModulesChanged();
        }}
      />

      {/* Add / Edit Event Modal */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        modules={modules}
        initialEvent={selectedEvent}
        defaultDate={modalDefaults.date}
        defaultTitle={modalDefaults.title}
        defaultModuleId={modalDefaults.moduleId}
        defaultSubtaskId={modalDefaults.subtaskId}
        defaultEstimatedMins={modalDefaults.estimatedMins}
        defaultEventType={modalDefaults.eventType}
        onEventSaved={() => {
          fetchEvents();
          fetchNextAction();
        }}
      />
    </div>
  );
}
