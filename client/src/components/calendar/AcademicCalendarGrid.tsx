import { useState } from 'react';
import { CalendarEvent, EventType } from '@studyflow/shared/types';
import { ChevronLeft, ChevronRight, Clock, Sparkles, Plus, Calendar as CalendarIcon } from 'lucide-react';

interface AcademicCalendarGridProps {
  events: CalendarEvent[];
  onAddEventClick: (defaultDate?: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const EVENT_TYPE_STYLES: Record<EventType, { bg: string; border: string; text: string; badge: string }> = {
  LECTURE: {
    bg: 'bg-blue-50/80',
    border: 'border-l-4 border-blue-500',
    text: 'text-blue-900',
    badge: 'bg-blue-100 text-blue-700',
  },
  TUTORIAL: {
    bg: 'bg-purple-50/80',
    border: 'border-l-4 border-purple-500',
    text: 'text-purple-900',
    badge: 'bg-purple-100 text-purple-700',
  },
  EXAM: {
    bg: 'bg-rose-50/80',
    border: 'border-l-4 border-rose-500',
    text: 'text-rose-900',
    badge: 'bg-rose-100 text-rose-700',
  },
  PERSONAL: {
    bg: 'bg-amber-50/80',
    border: 'border-l-4 border-amber-500',
    text: 'text-amber-900',
    badge: 'bg-amber-100 text-amber-700',
  },
  AI_STUDY_BLOCK: {
    bg: 'bg-emerald-50/80',
    border: 'border-l-4 border-emerald-500',
    text: 'text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-800',
  },
};

export default function AcademicCalendarGrid({ events, onAddEventClick, onEventClick }: AcademicCalendarGridProps) {
  // Current view offset in weeks (0 = current week)
  const [weekOffset, setWeekOffset] = useState(0);

  // Helper to get array of 7 dates for the active week starting on Monday
  function getWeekDates(offsetWeeks: number) {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
    const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayDiff + offsetWeeks * 7);
    monday.setHours(0, 0, 0, 0);

    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  const weekDates = getWeekDates(weekOffset);
  const weekStartStr = weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const weekEndStr = weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Filter events by day
  function getEventsForDay(date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((e) => {
      const evDate = new Date(e.start_time).toISOString().split('T')[0];
      return evDate === dateStr;
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  const isToday = (d: Date) => {
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  return (
    <div className="space-y-4">
      {/* Calendar Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 border border-slate-200 rounded-lg p-1 bg-slate-50">
            <button
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1 hover:bg-white rounded text-slate-600 transition shadow-none hover:shadow-xs"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-2.5 py-1 text-xs font-semibold hover:bg-white rounded text-slate-700 transition"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-1 hover:bg-white rounded text-slate-600 transition shadow-none hover:shadow-xs"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-sm font-bold text-slate-800 ml-2">
            {weekStartStr} – {weekEndStr}
          </h2>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center space-x-3 text-xs">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-600">Lecture</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="text-slate-600">Tutorial</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-600">Exam</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600">AI Study Block</span>
          </span>
        </div>

        <button
          onClick={() => onAddEventClick(weekDates[0].toISOString().split('T')[0])}
          className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Event</span>
        </button>
      </div>

      {/* 7-Day Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDates.map((dayDate, idx) => {
          const dayEvents = getEventsForDay(dayDate);
          const dayName = dayDate.toLocaleDateString(undefined, { weekday: 'short' });
          const dayNum = dayDate.getDate();
          const activeToday = isToday(dayDate);

          return (
            <div
              key={idx}
              className={`bg-white rounded-xl border flex flex-col min-h-[420px] transition ${
                activeToday ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm' : 'border-slate-200'
              }`}
            >
              {/* Day Header */}
              <div
                className={`p-3 border-b flex items-center justify-between rounded-t-xl ${
                  activeToday ? 'bg-blue-50/50 border-blue-200 text-blue-900' : 'bg-slate-50/80 border-slate-100 text-slate-700'
                }`}
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider">{dayName}</span>
                  <p className="text-base font-extrabold">{dayNum}</p>
                </div>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Day Events Column */}
              <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                {dayEvents.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-8">
                    <CalendarIcon className="w-6 h-6 stroke-1 mb-1" />
                    <span className="text-[11px]">Free day</span>
                  </div>
                ) : (
                  dayEvents.map((ev) => {
                    const style = EVENT_TYPE_STYLES[ev.event_type] || EVENT_TYPE_STYLES.PERSONAL;
                    return (
                      <div
                        key={ev.id}
                        onClick={() => onEventClick && onEventClick(ev)}
                        className={`p-2.5 rounded-lg border text-left shadow-2xs hover:shadow-xs transition cursor-pointer ${style.bg} ${style.border}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${style.badge}`}>
                            {ev.event_type === 'AI_STUDY_BLOCK' ? (
                              <span className="flex items-center space-x-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>AI Study</span>
                              </span>
                            ) : (
                              ev.event_type
                            )}
                          </span>
                        </div>

                        <h4 className={`text-xs font-bold leading-tight ${style.text}`}>
                          {ev.title}
                        </h4>

                        <div className="mt-1.5 flex items-center text-[10px] text-slate-600 space-x-2">
                          <span className="flex items-center space-x-0.5">
                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                            <span>
                              {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
