export function getProjectDueDateStatus(dueDateStr, projectStatus) {
  if (!dueDateStr) {
    return {
      status: 'none',
      label: 'No Due Date',
      badgeText: 'No Due Date',
      shortBadgeText: 'No Date',
      color: '#94a3b8',
      bg: '#f8fafc',
      border: '#e2e8f0',
      diffDays: null,
      formattedDate: '-'
    };
  }

  const isCompleted = projectStatus === 'Completed' || projectStatus === 'Commission Released';
  const dueDate = new Date(dueDateStr);
  const formattedDate = dueDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  if (isCompleted) {
    return {
      status: 'completed',
      label: 'Completed',
      badgeText: '✓ Completed',
      shortBadgeText: '✓ Done',
      color: '#059669',
      bg: '#ecfdf5',
      border: '#a7f3d0',
      diffDays: null,
      formattedDate
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      status: 'overdue',
      label: `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`,
      badgeText: `🚨 Overdue by ${overdueDays}d`,
      shortBadgeText: `🚨 -${overdueDays}d`,
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fecaca',
      diffDays,
      formattedDate,
      isOverdue: true,
      daysOverdue: overdueDays
    };
  }

  if (diffDays === 0) {
    return {
      status: 'due_today',
      label: 'Due Today',
      badgeText: '⏰ Due Today',
      shortBadgeText: '⏰ Today',
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
      diffDays: 0,
      formattedDate,
      isDueToday: true
    };
  }

  if (diffDays === 1) {
    return {
      status: 'urgent',
      label: 'Due Tomorrow (1 day left)',
      badgeText: '⏳ 1 day left',
      shortBadgeText: '⏳ 1d left',
      color: '#ea580c',
      bg: '#fff7ed',
      border: '#fed7aa',
      diffDays: 1,
      formattedDate,
      isDueSoon: true
    };
  }

  if (diffDays <= 3) {
    return {
      status: 'soon',
      label: `${diffDays} days left`,
      badgeText: `⏳ ${diffDays} days left`,
      shortBadgeText: `⏳ ${diffDays}d left`,
      color: '#b45309',
      bg: '#fffbeb',
      border: '#fde68a',
      diffDays,
      formattedDate,
      isDueSoon: true
    };
  }

  return {
    status: 'on_track',
    label: `${diffDays} days left`,
    badgeText: `📅 ${diffDays} days left`,
    shortBadgeText: `📅 ${diffDays}d`,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    diffDays,
    formattedDate,
    isOnTrack: true
  };
}
