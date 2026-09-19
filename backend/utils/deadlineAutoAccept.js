const db = require('../db');

/**
 * Checks all project steps with 'Pending Acceptance' (or NULL) deadline status.
 * If 2 hours or more have elapsed since the deadline was assigned
 * (measured from COALESCE(deadline_assigned_at, created_at)),
 * automatically updates deadline_status to 'Accepted', records in step_activity,
 * and notifies the assignee and project managers.
 */
async function checkAndAutoAcceptDeadlines() {
  try {
    const [steps] = await db.query(`
      SELECT 
        ps.id, 
        ps.title, 
        ps.project_id, 
        ps.assignee_id, 
        ps.deadline,
        p.pm_id, 
        p.title as project_title,
        COALESCE(ps.deadline_assigned_at, ps.created_at) as effective_assigned_at
      FROM project_steps ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.assignee_id IS NOT NULL
        AND (ps.deadline_status = 'Pending Acceptance' OR ps.deadline_status IS NULL)
        AND ps.status NOT IN ('Completed')
        AND COALESCE(ps.deadline_assigned_at, ps.created_at) <= NOW() - INTERVAL 2 HOUR
    `);

    if (!steps || steps.length === 0) {
      return { count: 0, steps: [] };
    }

    const acceptedSteps = [];

    for (const step of steps) {
      try {
        await db.query(
          "UPDATE project_steps SET deadline_status = 'Accepted' WHERE id = ?",
          [step.id]
        );

        await db.query(
          "INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, NULL, 'System Auto-Accepted the deadline after 2 hours of inactivity.')",
          [step.id]
        );

        // Notify assigned specialist
        if (step.assignee_id) {
          await db.query(
            "INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, 'deadline_auto_accepted', ?)",
            [
              step.assignee_id,
              `⚡ [Deadline Auto-Accepted] The deadline for milestone "${step.title}" in project "${step.project_title}" was automatically accepted after 2 hours.`,
              `/tasks`
            ]
          );
        }

        // Notify Project Manager if different
        if (step.pm_id && step.pm_id !== step.assignee_id) {
          await db.query(
            "INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, 'deadline_auto_accepted', ?)",
            [
              step.pm_id,
              `⚡ [Deadline Auto-Accepted] The deadline for milestone "${step.title}" in project "${step.project_title}" was auto-accepted by the system.`,
              `/projects/${step.project_id}`
            ]
          );
        }

        acceptedSteps.push(step);
        console.log(`[Auto-Accept] Auto-accepted step #${step.id} ("${step.title}") after 2 hours of inactivity.`);
      } catch (stepErr) {
        console.error(`[Auto-Accept] Error auto-accepting step #${step.id}:`, stepErr);
      }
    }

    return { count: acceptedSteps.length, steps: acceptedSteps };
  } catch (error) {
    console.error('Error running checkAndAutoAcceptDeadlines:', error);
    return { count: 0, error: error.message };
  }
}

module.exports = { checkAndAutoAcceptDeadlines };
