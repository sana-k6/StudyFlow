import { getDb } from '../config/db.js';
import { NextActionResponse, Subtask, Assignment, Module } from '@studyflow/shared/types.js';

interface RawCandidateRow {
  subtask_id: string;
  subtask_title: string;
  order_index: number;
  estimated_mins: number;
  completed_mins: number;
  subtask_is_completed: number;
  ai_generated: number;

  assignment_id: string;
  assignment_title: string;
  description: string | null;
  due_date: string;
  weight_percentage: number;
  estimated_total_mins: number;
  priority_score: number;
  status: string;

  module_id: string;
  module_code: string;
  module_name: string;
  color_hex: string;
  credits: number | null;
  semester: string | null;
}

/**
 * Calculates priority score and rationale for the student's next highest-impact task
 */
export function calculateNextAction(userId: string): NextActionResponse {
  const db = getDb();

  // Query incomplete subtasks with parent assignment and module
  const rows = db.prepare(`
    SELECT
      s.id as subtask_id, s.title as subtask_title, s.order_index, s.estimated_mins,
      s.completed_mins, s.is_completed as subtask_is_completed, s.ai_generated,
      a.id as assignment_id, a.title as assignment_title, a.description, a.due_date,
      a.weight_percentage, a.estimated_total_mins, a.priority_score, a.status,
      m.id as module_id, m.code as module_code, m.name as module_name, m.color_hex,
      m.credits, m.semester
    FROM subtasks s
    JOIN assignments a ON s.assignment_id = a.id
    JOIN modules m ON a.module_id = m.id
    WHERE a.user_id = ? AND s.is_completed = 0 AND a.status != 'COMPLETED'
    ORDER BY a.due_date ASC, s.order_index ASC
  `).all(userId) as RawCandidateRow[];

  if (rows.length === 0) {
    return {
      subtask: null,
      assignment: null,
      module: null,
      urgency_score: 0,
      rationale: "You're all caught up! No incomplete assignments or subtasks pending.",
    };
  }

  const nowMs = Date.now();
  let bestCandidate: RawCandidateRow | null = null;
  let highestScore = -1;
  let bestRationale = '';

  // Group by assignment to only consider the earliest incomplete subtask per assignment
  const earliestSubtaskPerAssignment = new Map<string, RawCandidateRow>();
  for (const row of rows) {
    if (!earliestSubtaskPerAssignment.has(row.assignment_id)) {
      earliestSubtaskPerAssignment.set(row.assignment_id, row);
    }
  }

  for (const candidate of earliestSubtaskPerAssignment.values()) {
    const dueMs = new Date(candidate.due_date).getTime();
    const hoursLeft = (dueMs - nowMs) / (1000 * 60 * 60);
    const daysLeft = Math.ceil(hoursLeft / 24);

    // 1. Deadline Proximity Score (0 to 60 pts)
    let deadlineScore = 0;
    if (hoursLeft <= 0) {
      deadlineScore = 60; // Overdue
    } else if (hoursLeft <= 24) {
      deadlineScore = 55; // Due within 24 hours
    } else if (hoursLeft <= 72) {
      deadlineScore = 45; // Due within 3 days
    } else if (hoursLeft <= 168) {
      deadlineScore = 30; // Due within 7 days
    } else if (hoursLeft <= 336) {
      deadlineScore = 15; // Due within 14 days
    } else {
      deadlineScore = 5;
    }

    // 2. Weight Percentage Score (0 to 30 pts)
    const weightScore = Math.min(30, (candidate.weight_percentage / 100) * 30);

    // 3. Task Granularity / Completable quick win bonus (0 to 10 pts)
    // Subtasks under 60 mins that move an imminent project forward get a modest focus bonus
    const quickWinBonus = candidate.estimated_mins <= 60 ? 10 : 5;

    const totalScore = Math.min(100, Math.round(deadlineScore + weightScore + quickWinBonus));

    if (totalScore > highestScore) {
      highestScore = totalScore;
      bestCandidate = candidate;

      // Construct student-friendly rationale
      const moduleTag = candidate.module_code;
      const weightText = candidate.weight_percentage > 0 ? `carries ${candidate.weight_percentage}% of your grade` : 'is key coursework';

      let timeText = '';
      if (hoursLeft <= 0) {
        timeText = 'is past its scheduled deadline';
      } else if (daysLeft === 0) {
        timeText = 'is due today';
      } else if (daysLeft === 1) {
        timeText = 'is due tomorrow';
      } else {
        timeText = `is due in ${daysLeft} days`;
      }

      bestRationale = `${candidate.assignment_title} (${moduleTag}) ${timeText} and ${weightText}. Completing "${candidate.subtask_title}" (${candidate.estimated_mins} mins) is your next highest-impact step.`;
    }
  }

  if (!bestCandidate) {
    return {
      subtask: null,
      assignment: null,
      module: null,
      urgency_score: 0,
      rationale: "You're all caught up! No incomplete assignments or subtasks pending.",
    };
  }

  const subtask: Subtask = {
    id: bestCandidate.subtask_id,
    assignment_id: bestCandidate.assignment_id,
    title: bestCandidate.subtask_title,
    order_index: bestCandidate.order_index,
    estimated_mins: bestCandidate.estimated_mins,
    completed_mins: bestCandidate.completed_mins,
    is_completed: Boolean(bestCandidate.subtask_is_completed),
    ai_generated: Boolean(bestCandidate.ai_generated),
  };

  const assignment: Assignment = {
    id: bestCandidate.assignment_id,
    user_id: userId,
    module_id: bestCandidate.module_id,
    title: bestCandidate.assignment_title,
    description: bestCandidate.description,
    due_date: bestCandidate.due_date,
    weight_percentage: bestCandidate.weight_percentage,
    estimated_total_mins: bestCandidate.estimated_total_mins,
    priority_score: highestScore,
    status: bestCandidate.status as any,
  };

  const module: Module = {
    id: bestCandidate.module_id,
    user_id: userId,
    code: bestCandidate.module_code,
    name: bestCandidate.module_name,
    color_hex: bestCandidate.color_hex,
    credits: bestCandidate.credits,
    semester: bestCandidate.semester,
  };

  return {
    subtask,
    assignment,
    module,
    urgency_score: highestScore,
    rationale: bestRationale,
  };
}
