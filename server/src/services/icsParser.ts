import { EventType } from '@studyflow/shared/types.js';

export interface ParsedIcsEvent {
  external_uid: string;
  title: string;
  event_type: EventType;
  start_time: string; // ISO-8601 UTC
  end_time: string;   // ISO-8601 UTC
  module_code?: string;
  description?: string;
  location?: string;
}

/**
 * Unfold RFC 5545 multi-line strings.
 * Lines that begin with whitespace (space or tab) are continuations of the previous line.
 */
function unfoldIcsLines(rawIcs: string): string[] {
  const normalized = rawIcs.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');
  const unfolded: string[] = [];

  for (const line of rawLines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (unfolded.length > 0) {
        unfolded[unfolded.length - 1] += line.slice(1);
      }
    } else if (line.trim().length > 0) {
      unfolded.push(line);
    }
  }

  return unfolded;
}

/**
 * Parse an iCalendar datetime string (e.g. 20261118T130000Z, 20261118T130000, 20261118)
 * into a standard ISO-8601 UTC string.
 */
export function parseIcsDate(dateStr: string, tzid?: string): string {
  const cleanStr = dateStr.trim();

  // Format 1: Full UTC timestamp with 'Z' (e.g., 20261118T140000Z)
  const utcMatch = cleanStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utcMatch) {
    const [, y, m, d, hh, mm, ss] = utcMatch;
    return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss)).toISOString();
  }

  // Format 2: Local datetime with time (e.g., 20261118T140000)
  const localMatch = cleanStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    // If TZID is Europe/London, London is UTC in winter (GMT) and UTC+1 in summer (BST)
    if (tzid && tzid.includes('London')) {
      // Create date object interpreting as London timezone
      const approxUtc = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
      return approxUtc.toISOString();
    }
    // Default to UTC
    return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss)).toISOString();
  }

  // Format 3: All-day date (e.g., 20261118)
  const dayMatch = cleanStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dayMatch) {
    const [, y, m, d] = dayMatch;
    return new Date(Date.UTC(+y, +m - 1, +d, 0, 0, 0)).toISOString();
  }

  // Fallback: standard Date parsing
  const fallbackDate = new Date(cleanStr);
  if (!isNaN(fallbackDate.getTime())) {
    return fallbackDate.toISOString();
  }

  throw new Error(`Unable to parse iCalendar date string: "${dateStr}"`);
}

/**
 * Classify event type based on title/summary and description
 */
export function classifyEventType(summary: string, description?: string): EventType {
  const combined = `${summary} ${description || ''}`.toLowerCase();

  if (/\b(exam|examination|test|midterm|final|assessment)\b/i.test(combined)) {
    return 'EXAM';
  }
  if (/\b(tutorial|workshop|seminar|supervision|colloquium)\b/i.test(combined)) {
    return 'TUTORIAL';
  }
  if (/\b(lecture|class|lect|session)\b/i.test(combined)) {
    return 'LECTURE';
  }

  return 'PERSONAL';
}

/**
 * Extract a candidate university module code (e.g., CS101, COMP2001, MATH102, 06-12345)
 */
export function extractModuleCode(summary: string): string | undefined {
  // Common UK/US university module codes:
  // e.g. "CS101", "COMP 2001", "06-25801", "MATH102", "PHYS-101"
  const modulePattern = /\b([A-Z]{2,5}\s?\d{3,4}|[0-9]{2}-[0-9]{4,5})\b/i;
  const match = summary.match(modulePattern);
  if (match) {
    return match[1].replace(/\s+/g, '').toUpperCase();
  }
  return undefined;
}

/**
 * Parse an .ics string into structured events
 */
export function parseIcsContent(icsContent: string): ParsedIcsEvent[] {
  const lines = unfoldIcsLines(icsContent);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let currentEvent: Partial<ParsedIcsEvent> & { tzidStart?: string; tzidEnd?: string; rawStart?: string; rawEnd?: string } = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      if (inEvent && currentEvent.title && currentEvent.rawStart) {
        try {
          const startTime = parseIcsDate(currentEvent.rawStart, currentEvent.tzidStart);
          let endTime: string;
          if (currentEvent.rawEnd) {
            endTime = parseIcsDate(currentEvent.rawEnd, currentEvent.tzidEnd);
          } else {
            // Default to 1 hour after start if DTEND is missing
            const startD = new Date(startTime);
            endTime = new Date(startD.getTime() + 60 * 60 * 1000).toISOString();
          }

          const external_uid = currentEvent.external_uid || `generated_${Buffer.from(currentEvent.title + startTime).toString('hex').slice(0, 24)}`;
          const event_type = currentEvent.event_type || classifyEventType(currentEvent.title, currentEvent.description);
          const module_code = extractModuleCode(currentEvent.title);

          events.push({
            external_uid,
            title: currentEvent.title,
            event_type,
            start_time: startTime,
            end_time: endTime,
            module_code,
            description: currentEvent.description,
            location: currentEvent.location,
          });
        } catch (err) {
          console.warn('Skipping event due to date parsing error:', err);
        }
      }
      inEvent = false;
      currentEvent = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const keyPart = line.slice(0, colonIdx);
    const valuePart = line.slice(colonIdx + 1);

    // Unescape iCalendar special characters in text values
    const cleanValue = valuePart
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');

    const [mainKey, ...params] = keyPart.split(';');

    switch (mainKey) {
      case 'UID':
        currentEvent.external_uid = cleanValue.trim();
        break;
      case 'SUMMARY':
        currentEvent.title = cleanValue.trim();
        break;
      case 'DESCRIPTION':
        currentEvent.description = cleanValue.trim();
        break;
      case 'LOCATION':
        currentEvent.location = cleanValue.trim();
        break;
      case 'DTSTART': {
        const tzidParam = params.find((p) => p.startsWith('TZID='));
        currentEvent.tzidStart = tzidParam ? tzidParam.split('=')[1] : undefined;
        currentEvent.rawStart = cleanValue.trim();
        break;
      }
      case 'DTEND': {
        const tzidParam = params.find((p) => p.startsWith('TZID='));
        currentEvent.tzidEnd = tzidParam ? tzidParam.split('=')[1] : undefined;
        currentEvent.rawEnd = cleanValue.trim();
        break;
      }
    }
  }

  return events;
}
