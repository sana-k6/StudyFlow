import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { CalendarEvent, Module } from '@studyflow/shared/types';
import AcademicCalendarGrid from '../components/calendar/AcademicCalendarGrid';
import IcsImportModal from '../components/calendar/IcsImportModal';
import EventModal from '../components/calendar/EventModal';
import { UploadCloud, Plus } from 'lucide-react';

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
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchEvents();
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

  function handleAddEvent(date?: string) {
    setSelectedEvent(null);
    setDefaultDate(date);
    setIsEventModalOpen(true);
  }

  function handleEditEvent(event: CalendarEvent) {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Academic Timetable & Schedule</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View university lectures, tutorials, exams, and scheduled study sessions
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsIcsModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
          >
            <UploadCloud className="w-4 h-4 text-blue-600" />
            <span>Import Timetable (.ics)</span>
          </button>

          <button
            onClick={() => handleAddEvent()}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
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
        defaultDate={defaultDate}
        onEventSaved={fetchEvents}
      />
    </div>
  );
}
