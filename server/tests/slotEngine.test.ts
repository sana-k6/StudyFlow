import { describe, it, expect } from 'vitest';
import {
  computeFreeSlots,
  mergeIntervals,
  subtractIntervals,
  FixedInterval,
} from '../src/services/slotEngine.js';

describe('Deterministic Slot Engine Service', () => {
  describe('mergeIntervals', () => {
    it('merges overlapping intervals correctly', () => {
      const intervals = [
        { start: 100, end: 200 },
        { start: 150, end: 250 },
        { start: 300, end: 400 },
      ];
      const merged = mergeIntervals(intervals);
      expect(merged).toEqual([
        { start: 100, end: 250 },
        { start: 300, end: 400 },
      ]);
    });

    it('merges abutting intervals correctly', () => {
      const intervals = [
        { start: 100, end: 200 },
        { start: 200, end: 300 },
      ];
      const merged = mergeIntervals(intervals);
      expect(merged).toEqual([{ start: 100, end: 300 }]);
    });
  });

  describe('subtractIntervals', () => {
    it('finds free intervals between busy blocks inside window', () => {
      const window = { start: 100, end: 500 };
      const busy = [
        { start: 150, end: 200 },
        { start: 300, end: 350 },
      ];
      const gaps = subtractIntervals(window, busy);
      expect(gaps).toEqual([
        { start: 100, end: 150 },
        { start: 200, end: 300 },
        { start: 350, end: 500 },
      ]);
    });

    it('handles busy block starting before and ending inside window', () => {
      const window = { start: 100, end: 300 };
      const busy = [{ start: 50, end: 150 }];
      const gaps = subtractIntervals(window, busy);
      expect(gaps).toEqual([{ start: 150, end: 300 }]);
    });
  });

  describe('computeFreeSlots', () => {
    const baseDate = '2026-11-20T00:00:00.000Z';

    it('computes free slots around single lecture within preferred study hours', () => {
      // Study window: 09:00 - 21:00 (12 hours)
      // Lecture: 11:00 - 13:00 (2 hours)
      const fixedEvents: FixedInterval[] = [
        {
          start_time: '2026-11-20T11:00:00.000Z',
          end_time: '2026-11-20T13:00:00.000Z',
        },
      ];

      const slots = computeFreeSlots(fixedEvents, {
        startDate: baseDate,
        days: 1,
        preferredStudyStart: '09:00',
        preferredStudyEnd: '21:00',
        dailyStudyCapMins: 240, // 4 hours cap
        minSlotDurationMins: 30,
        maxSlotDurationMins: 90,
      });

      // Total daily minutes allocated should not exceed 240 mins
      const totalMins = slots.reduce((acc, s) => acc + s.duration_mins, 0);
      expect(totalMins).toBe(240);

      // Verify no slot overlaps with the 11:00 - 13:00 lecture
      const lectureStart = new Date('2026-11-20T11:00:00.000Z').getTime();
      const lectureEnd = new Date('2026-11-20T13:00:00.000Z').getTime();

      for (const slot of slots) {
        const sStart = new Date(slot.start_time).getTime();
        const sEnd = new Date(slot.end_time).getTime();
        expect(sStart < lectureEnd && sEnd > lectureStart).toBe(false);
      }
    });

    it('merges overlapping lectures and correctly routes around them', () => {
      // Lecture 1: 10:00 - 11:30
      // Tutorial 2: 11:00 - 12:30 (overlaps with Lecture 1)
      const fixedEvents: FixedInterval[] = [
        {
          start_time: '2026-11-20T10:00:00.000Z',
          end_time: '2026-11-20T11:30:00.000Z',
        },
        {
          start_time: '2026-11-20T11:00:00.000Z',
          end_time: '2026-11-20T12:30:00.000Z',
        },
      ];

      const slots = computeFreeSlots(fixedEvents, {
        startDate: baseDate,
        days: 1,
        preferredStudyStart: '09:00',
        preferredStudyEnd: '17:00',
        dailyStudyCapMins: 180,
      });

      // Slot 1: 09:00 - 10:00 (60 mins before the merged 10:00-12:30 block)
      expect(slots[0].start_time).toBe('2026-11-20T09:00:00.000Z');
      expect(slots[0].end_time).toBe('2026-11-20T10:00:00.000Z');
      expect(slots[0].duration_mins).toBe(60);

      // Slot 2: starts at 12:30 (after the merged busy block)
      expect(slots[1].start_time).toBe('2026-11-20T12:30:00.000Z');
    });

    it('strictly enforces dailyStudyCapMins', () => {
      // Day with no fixed events: 09:00 to 21:00 has 720 free minutes
      // Cap is set to 120 minutes
      const slots = computeFreeSlots([], {
        startDate: baseDate,
        days: 1,
        preferredStudyStart: '09:00',
        preferredStudyEnd: '21:00',
        dailyStudyCapMins: 120,
        maxSlotDurationMins: 90,
      });

      const totalMins = slots.reduce((acc, s) => acc + s.duration_mins, 0);
      expect(totalMins).toBe(120);
      // First slot: 90 mins, second slot: 30 mins
      expect(slots.length).toBe(2);
      expect(slots[0].duration_mins).toBe(90);
      expect(slots[1].duration_mins).toBe(30);
    });

    it('ignores overnight events outside the preferred study window', () => {
      // Overnight party from 22:00 to 04:00 next morning
      const fixedEvents: FixedInterval[] = [
        {
          start_time: '2026-11-20T22:00:00.000Z',
          end_time: '2026-11-21T04:00:00.000Z',
        },
      ];

      const slots = computeFreeSlots(fixedEvents, {
        startDate: baseDate,
        days: 1,
        preferredStudyStart: '09:00',
        preferredStudyEnd: '20:00',
        dailyStudyCapMins: 180,
      });

      // 09:00 - 20:00 is completely unaffected
      const totalMins = slots.reduce((acc, s) => acc + s.duration_mins, 0);
      expect(totalMins).toBe(180);
      expect(slots[0].start_time).toBe('2026-11-20T09:00:00.000Z');
    });

    it('yields zero slots for a day completely engulfed by an exam', () => {
      // Full day event 08:00 to 22:00
      const fixedEvents: FixedInterval[] = [
        {
          start_time: '2026-11-20T08:00:00.000Z',
          end_time: '2026-11-20T22:00:00.000Z',
        },
      ];

      const slots = computeFreeSlots(fixedEvents, {
        startDate: baseDate,
        days: 1,
        preferredStudyStart: '09:00',
        preferredStudyEnd: '21:00',
      });

      expect(slots.length).toBe(0);
    });

    it('generates multi-day slots across a 14-day horizon', () => {
      const slots = computeFreeSlots([], {
        startDate: baseDate,
        days: 14,
        preferredStudyStart: '09:00',
        preferredStudyEnd: '13:00',
        dailyStudyCapMins: 120, // 2 hours per day
      });

      // 14 days * 2 hours per day = 28 hours (1680 mins)
      const totalMins = slots.reduce((acc, s) => acc + s.duration_mins, 0);
      expect(totalMins).toBe(14 * 120);

      // Verify slot IDs are deterministic and formatted properly
      for (const slot of slots) {
        expect(slot.slot_id).toMatch(/^slot_\d{8}_\d{4}_\d+m$/);
      }
    });
  });
});
