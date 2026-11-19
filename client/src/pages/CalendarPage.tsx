import { useState, useEffect } from 'react';
import { apiClient, ApiErrorResponse } from '../services/apiClient';
import { CalendarEvent, Module, NextActionResponse, EventType, UserProfileResponse } from '@studyflow/shared/types';
import AcademicCalendarGrid from '../components/calendar/AcademicCalendarGrid';
import IcsImportModal from '../components/calendar/IcsImportModal';
import EventModal from '../components/calendar/EventModal';
import NextActionCard from '../components/dashboard/NextActionCard';
import PaywallModal from '../components/common/PaywallModal';
import { UploadCloud, Plus, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';

interface CalendarPageProps {
  modules: Module[];
  user: UserProfileResponse;
  onModulesChanged: () => void;
  onRefreshProfile?: () => void;
}

export default function CalendarPage({ modules, user, onModulesChanged, onRefreshProfile }: CalendarPageProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isIcsModalOpen, setIsIcsModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Pro Paywall state
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  // Auto-Scheduling states
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState<{ count: number; rationale: string } | null>(null);

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

  async function handleAutoSchedule() {
    try {
      setIsAutoScheduling(true);
      setScheduleFeedback(null);
      const res = await apiClient.generateSchedule();
      setScheduleFeedback({
        count: res.scheduled_count,
        rationale: res.next_action_rationale,
      });
      fetchEvents();
      fetchNextAction();
    } catch (err: unknown) {
      if (err instanceof ApiErrorResponse && err.code === 'PRO_TIER_REQUIRED') {
        setIsPaywallOpen(true);
      } else {
        console.error('Auto-scheduling error:', err);
      }
    } finally {
      setIsAutoScheduling(false);
    }
  }

  async function handleRebalance() {
    try {
      setIsAutoScheduling(true);
      setScheduleFeedback(null);
      const res = await apiClient.rebalanceSchedule();
      setScheduleFeedback({
        count: res.scheduled_count,
        rationale: res.next_action_rationale,
      });
      fetchEvents();
      fetchNextAction();
    } catch (err: unknown) {
      if (err instanceof ApiErrorResponse && err.code === 'PRO_TIER_REQUIRED') {
        setIsPaywallOpen(true);
      } else {
        console.error('Rebalance error:', err);
      }
    } finally {
      setIsAutoScheduling(false);
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

      {scheduleFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-start space-x-3 text-xs shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold">
              {scheduleFeedback.count > 0
                ? `Auto-Scheduled ${scheduleFeedback.count} Study Blocks`
                : 'Schedule Checked'}
            </h4>
            <p className="text-emerald-700 leading-relaxed">{scheduleFeedback.rationale}</p>
          </div>
        </div>
      )}

      {/* Top Banner Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Academic Timetable & Study Schedule</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View university lectures, tutorials, exams, and scheduled study sessions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Pro Auto-Schedule Button */}
          <button
            onClick={handleAutoSchedule}
            disabled={isAutoScheduling}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition ${
              user.subscription_tier === 'PRO'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
            }`}
          >
            {isAutoScheduling ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Scheduling...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Auto-Schedule {user.subscription_tier === 'FREE' && '⚡ (Pro)'}</span>
              </>
            )}
          </button>

          {user.subscription_tier === 'PRO' && (
            <button
              onClick={handleRebalance}
              disabled={isAutoScheduling}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              title="Rebalance future study blocks around timetable changes"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Rebalance</span>
            </button>
          )}

          <button
            onClick={() => handleAddStudyBlock()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
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
      {/* Paywall Modal */}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        featureTitle="Intelligent Auto-Scheduling"
        featureDescription="Auto-scheduling maps coursework into your real timetable gaps over the next 14 days using Gemini. Available on StudyFlow Pro."
        onUpgradeSuccess={() => {
          if (onRefreshProfile) onRefreshProfile();
          fetchEvents();
          fetchNextAction();
        }}
      />
    </div>
  );
}
