import { describe, it, expect } from 'vitest';
import { parseIcsContent, parseIcsDate, classifyEventType, extractModuleCode } from '../src/services/icsParser.js';

describe('ICS Timetable Parser Service', () => {
  it('parses UTC iCalendar date correctly', () => {
    const iso = parseIcsDate('20261118T143000Z');
    expect(iso).toBe('2026-11-18T14:30:00.000Z');
  });

  it('classifies event types accurately', () => {
    expect(classifyEventType('Advanced Algorithms Lecture')).toBe('LECTURE');
    expect(classifyEventType('Software Engineering Tutorial Group 4')).toBe('TUTORIAL');
    expect(classifyEventType('Midterm Examination Hall A')).toBe('EXAM');
    expect(classifyEventType('Coffee with study buddy')).toBe('PERSONAL');
  });

  it('extracts module codes from course summaries', () => {
    expect(extractModuleCode('CS101: Introduction to Computer Science')).toBe('CS101');
    expect(extractModuleCode('COMP 2001 - Software Engineering')).toBe('COMP2001');
    expect(extractModuleCode('06-25801 Databases and Web Systems')).toBe('06-25801');
    expect(extractModuleCode('Dentistry Club Social')).toBeUndefined();
  });

  it('parses sample University timetable ICS file with folded lines and multiple events', () => {
    const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//University of Birmingham//Timetable//EN
BEGIN:VEVENT
UID:uob-event-101@bham.ac.uk
DTSTART:20261119T090000Z
DTEND:20261119T100000Z
SUMMARY:CS201 Data Structures and 
 Algorithms Lecture
LOCATION:Haworth Building 101
DESCRIPTION:Module: CS201\\nLecturer: Dr. Alan Turing
END:VEVENT
BEGIN:VEVENT
UID:uob-event-102@bham.ac.uk
DTSTART:20261119T140000Z
DTEND:20261119T160000Z
SUMMARY:MATH102 Linear Algebra Tutorial
LOCATION:Watson Building LT2
DESCRIPTION:Bring problem sheet 4
END:VEVENT
BEGIN:VEVENT
UID:uob-event-103@bham.ac.uk
DTSTART:20261120T100000Z
DTEND:20261120T120000Z
SUMMARY:CS201 Midterm Examination
LOCATION:Great Hall
END:VEVENT
END:VCALENDAR`;

    const events = parseIcsContent(sampleIcs);
    expect(events.length).toBe(3);

    // Event 1: Lecture with unfolded summary and module extraction
    expect(events[0].external_uid).toBe('uob-event-101@bham.ac.uk');
    expect(events[0].title).toBe('CS201 Data Structures and Algorithms Lecture');
    expect(events[0].event_type).toBe('LECTURE');
    expect(events[0].module_code).toBe('CS201');
    expect(events[0].start_time).toBe('2026-11-19T09:00:00.000Z');
    expect(events[0].end_time).toBe('2026-11-19T10:00:00.000Z');
    expect(events[0].location).toBe('Haworth Building 101');
    expect(events[0].description).toBe('Module: CS201\nLecturer: Dr. Alan Turing');

    // Event 2: Tutorial
    expect(events[1].external_uid).toBe('uob-event-102@bham.ac.uk');
    expect(events[1].event_type).toBe('TUTORIAL');
    expect(events[1].module_code).toBe('MATH102');

    // Event 3: Exam
    expect(events[2].external_uid).toBe('uob-event-103@bham.ac.uk');
    expect(events[2].event_type).toBe('EXAM');
    expect(events[2].module_code).toBe('CS201');
  });

  it('generates fallback end time and UID when not explicitly provided', () => {
    const minimalIcs = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20261122T150000Z
SUMMARY:Ad-hoc Seminar
END:VEVENT
END:VCALENDAR`;

    const events = parseIcsContent(minimalIcs);
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Ad-hoc Seminar');
    expect(events[0].external_uid).toBeDefined();
    expect(events[0].start_time).toBe('2026-11-22T15:00:00.000Z');
    expect(events[0].end_time).toBe('2026-11-22T16:00:00.000Z');
  });
});
