import { TimeSlot } from '@studyflow/shared/types.js';

export interface FixedInterval {
  start_time: string; // ISO-8601
  end_time: string;   // ISO-8601
}

export interface SlotEngineOptions {
  startDate?: string;             // ISO-8601 UTC string (default: now)
  days?: number;                  // Number of days to schedule (default: 14)
  preferredStudyStart?: string;   // "HH:mm", e.g. "09:00"
  preferredStudyEnd?: string;     // "HH:mm", e.g. "21:00"
  dailyStudyCapMins?: number;     // e.g. 240 mins (4 hours)
  minSlotDurationMins?: number;   // e.g. 30 mins
  maxSlotDurationMins?: number;   // e.g. 90 mins
}

interface IntervalMs {
  start: number;
  end: number;
}

/**
 * Merges overlapping and abutting time intervals
 */
export function mergeIntervals(intervals: IntervalMs[]): IntervalMs[] {
  if (intervals.length === 0) return [];

  // Sort by start time ascending
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: IntervalMs[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping or abutting
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Computes non-overlapping free time intervals between busy intervals within a window
 */
export function subtractIntervals(
  window: IntervalMs,
  busyIntervals: IntervalMs[]
): IntervalMs[] {
  if (window.start >= window.end) return [];

  // Clip busy intervals to within the window
  const clippedBusy: IntervalMs[] = [];
  for (const busy of busyIntervals) {
    const start = Math.max(window.start, busy.start);
    const end = Math.min(window.end, busy.end);
    if (start < end) {
      clippedBusy.push({ start, end });
    }
  }

  const mergedBusy = mergeIntervals(clippedBusy);
  const freeGaps: IntervalMs[] = [];
  let currentStart = window.start;

  for (const busy of mergedBusy) {
    if (busy.start > currentStart) {
      freeGaps.push({ start: currentStart, end: busy.start });
    }
    currentStart = Math.max(currentStart, busy.end);
  }

  if (currentStart < window.end) {
    freeGaps.push({ start: currentStart, end: window.end });
  }

  return freeGaps;
}

/**
 * Parses "HH:mm" string into hours and minutes
 */
function parseTimeStr(timeStr: string): { hours: number; minutes: number } {
  const [hStr, mStr] = timeStr.split(':');
  return {
    hours: parseInt(hStr, 10) || 0,
    minutes: parseInt(mStr, 10) || 0,
  };
}

/**
 * Computes available study slots over a multi-day horizon (default 14 days)
 * strictly constrained by:
 * 1. Fixed university/personal events
 * 2. User's daily preferred study window [preferredStudyStart, preferredStudyEnd]
 * 3. Daily study cap in minutes (dailyStudyCapMins)
 * 4. Discrete slot granularity [minSlotDurationMins, maxSlotDurationMins]
 */
export function computeFreeSlots(
  fixedEvents: FixedInterval[],
  options: SlotEngineOptions = {}
): TimeSlot[] {
  const {
    startDate = new Date().toISOString(),
    days = 14,
    preferredStudyStart = '09:00',
    preferredStudyEnd = '21:00',
    dailyStudyCapMins = 240,
    minSlotDurationMins = 30,
    maxSlotDurationMins = 90,
  } = options;

  const startParsed = parseTimeStr(preferredStudyStart);
  const endParsed = parseTimeStr(preferredStudyEnd);

  const initialDate = new Date(startDate);
  const nowMs = initialDate.getTime();
  const allSlots: TimeSlot[] = [];

  // Convert fixed events to millisecond intervals
  const rawBusyIntervals: IntervalMs[] = fixedEvents.map((ev) => ({
    start: new Date(ev.start_time).getTime(),
    end: new Date(ev.end_time).getTime(),
  }));

  for (let d = 0; d < days; d++) {
    // Construct the day's study window in UTC
    const currentDay = new Date(initialDate);
    currentDay.setUTCDate(initialDate.getUTCDate() + d);

    const windowStart = Date.UTC(
      currentDay.getUTCFullYear(),
      currentDay.getUTCMonth(),
      currentDay.getUTCDate(),
      startParsed.hours,
      startParsed.minutes,
      0,
      0
    );

    const windowEnd = Date.UTC(
      currentDay.getUTCFullYear(),
      currentDay.getUTCMonth(),
      currentDay.getUTCDate(),
      endParsed.hours,
      endParsed.minutes,
      0,
      0
    );

    // If today is the start day, cannot schedule in the past
    const effectiveWindowStart = Math.max(windowStart, nowMs);
    if (effectiveWindowStart >= windowEnd) {
      continue;
    }

    const dayWindow: IntervalMs = {
      start: effectiveWindowStart,
      end: windowEnd,
    };

    // Calculate free intervals for this day
    const freeGaps = subtractIntervals(dayWindow, rawBusyIntervals);

    let dayAllocatedMins = 0;

    for (const gap of freeGaps) {
      if (dayAllocatedMins >= dailyStudyCapMins) {
        break; // Daily cap reached
      }

      let gapStart = gap.start;
      const gapEnd = gap.end;

      while (gapStart < gapEnd && dayAllocatedMins < dailyStudyCapMins) {
        const remainingGapMins = Math.floor((gapEnd - gapStart) / (60 * 1000));
        if (remainingGapMins < minSlotDurationMins) {
          break; // Gap too small for minimum slot
        }

        const remainingDailyCapMins = dailyStudyCapMins - dayAllocatedMins;
        if (remainingDailyCapMins < minSlotDurationMins) {
          break; // Not enough daily cap left to form a meaningful slot
        }

        // Determine slot duration
        const durationMins = Math.min(
          remainingGapMins,
          maxSlotDurationMins,
          remainingDailyCapMins
        );

        const slotEnd = gapStart + durationMins * 60 * 1000;
        const startIso = new Date(gapStart).toISOString();
        const endIso = new Date(slotEnd).toISOString();

        // Deterministic, unique slot identifier
        const dateTag = startIso.slice(0, 10).replace(/-/g, '');
        const timeTag = startIso.slice(11, 16).replace(/:/g, '');
        const slot_id = `slot_${dateTag}_${timeTag}_${durationMins}m`;

        allSlots.push({
          slot_id,
          start_time: startIso,
          end_time: endIso,
          duration_mins: durationMins,
        });

        dayAllocatedMins += durationMins;
        gapStart = slotEnd;
      }
    }
  }

  return allSlots;
}
