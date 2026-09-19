import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { 
  CheckSquare, Clock, Calendar, ExternalLink, CheckCircle2, FolderKanban, 
  Paperclip, Search, RefreshCw, FileText, Download, LayoutGrid, List, 
  RotateCcw, X, AlertTriangle, AlertCircle, ArrowUpRight, Check, Send, 
  Filter, Play, ShieldAlert, User, ChevronRight, CheckCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getProjectDueDateStatus } from '../utils/projectDueDate';
import './Tasks.css';

// Helper to parse checklist markdown and render interactive-styled items
const renderDescriptionWithCheckboxes = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    const isUnchecked = trimmed.startsWith('- [ ]');
    const isChecked = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
    
    if (isUnchecked || isChecked) {
      const content = trimmed.substring(5).trim();
      return (
        <div key={idx} className={`checklist-item ${isChecked ? 'completed' : ''}`}>
          <div className={`custom-checkbox-indicator ${isChecked ? 'checked' : ''}`}>
            {isChecked && <Check size={11} />}
          </div>
          <span className={`checklist-text ${isChecked ? 'line-through' : ''}`}>
            {content}
          </span>
        </div>
      );
    }
    
    return (
      <div key={idx} className="description-text-line">
        {line || <span className="line-break-spacer" />}
      </div>
    );
  });
};

// Helper to count checklist items
const getChecklistStats = (text) => {
  if (!text) return { total: 0, completed: 0 };
  const lines = text.split('\n');
  let total = 0;
  let completed = 0;
  lines.forEach(l => {
    const trimmed = l.trim();
    if (trimmed.startsWith('- [ ]')) total++;
    else if (trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
      total++;
      completed++;
    }
  });
  return { total, completed };
};

// Helper to safely parse reassignment / rejection todos and notes
const parseFeedbackTodos = (raw) => {
  if (!raw || raw === '0' || raw === 0) return null;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && parsed.text) return [parsed];
    if (typeof parsed === 'string') return [{ text: parsed }];
  } catch (e) {
    if (typeof raw === 'string' && raw.trim()) {
      return [{ text: raw.trim() }];
    }
  }
  return null;
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [urgencyFilter, setUrgencyFilter] = useState('All');
  const [acceptanceFilter, setAcceptanceFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI View Mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState('cards');

  // Submit Deliverable Modal State
  const [submitModal, setSubmitModal] = useState({ 
    isOpen: false, 
    projectId: null, 
    stepId: null, 
    projectName: '',
    stepTitle: ''
  });
  const [deliverableName, setDeliverableName] = useState('');
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extension Appeal Modal State
  const [appealModal, setAppealModal] = useState({
    isOpen: false,
    task: null,
    proposed_deadline: '',
    reason: ''
  });

  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/tasks', {
        params: {
          user_id: currentUser.id,
          role: currentUser.role
        }
      });
      setTasks(res.data || []);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (deadlineStr) => {
    if (!deadlineStr) return false;
    const due = new Date(deadlineStr);
    const now = new Date();
    due.setHours(23, 59, 59, 999);
    return now > due;
  };

  // Quick Accept Deadline
  const handleConfirmDeadline = async (task) => {
    try {
      await axios.post(`/api/deadlines/accept/${task.id}`, {
        user_id: currentUser.id
      });
      alert('✓ Deadline accepted and confirmed!');
      fetchTasks();
    } catch (error) {
      console.error('Failed to confirm deadline', error);
      alert('Failed to confirm deadline: ' + (error.response?.data?.error || error.message));
    }
  };

  // Open Appeal Modal
  const handleOpenAppealModal = (task) => {
    setAppealModal({
      isOpen: true,
      task,
      proposed_deadline: task.deadline ? task.deadline.split('T')[0] : '',
      reason: ''
    });
  };

  // Submit Appeal
  const handleAppealSubmit = async (e) => {
    e.preventDefault();
    if (!appealModal.task || !appealModal.proposed_deadline) {
      alert('Please select a proposed extension deadline');
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.post(`/api/projects/${appealModal.task.project_id}/steps/${appealModal.task.id}/appeal-deadline`, {
        proposed_deadline: appealModal.proposed_deadline,
        reason: appealModal.reason,
        user_id: currentUser.id
      });
      alert('Deadline extension appeal submitted to Project Manager!');
      setAppealModal({ isOpen: false, task: null, proposed_deadline: '', reason: '' });
      fetchTasks();
    } catch (error) {
      console.error('Failed to submit appeal', error);
      alert('Failed to submit deadline appeal: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status Transition (e.g. from Pending to In Progress)
  const handleSetStatus = async (task, newStatus) => {
    try {
      await axios.put(`/api/projects/${task.project_id}/steps/${task.id}`, {
        status: newStatus
      });
      fetchTasks();
    } catch (error) {
      console.error('Failed to update status', error);
      alert('Failed to update status: ' + (error.response?.data?.error || error.message));
    }
  };

  // Open Deliverable Modal
  const handleOpenSubmitModal = (task) => {
    setSubmitModal({
      isOpen: true,
      projectId: task.project_id,
      stepId: task.id,
      projectName: task.project_title || 'Project Workspace',
      stepTitle: task.title
    });
    setDeliverableName(`${task.project_title || 'Deliverable'} - ${task.title} Final`);
    setDeliverableUrl('');
  };

  // Submit Deliverable
  const submitDeliverable = async (e) => {
    e.preventDefault();
    if (!deliverableName.trim() || !deliverableUrl.trim()) {
      alert('Please specify both the deliverable package name and the access URL.');
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.put(`/api/projects/${submitModal.projectId}/steps/${submitModal.stepId}`, {
        status: 'Pending Approval',
        deliverable_name: deliverableName.trim(),
        deliverable_url: deliverableUrl.trim()
      });
      alert('Deliverable submitted successfully! Your Project Manager has been notified.');
      setSubmitModal({ isOpen: false, projectId: null, stepId: null, projectName: '', stepTitle: '' });
      fetchTasks();
    } catch (error) {
      console.error('Failed to submit task for approval', error);
      alert('Failed to submit deliverable: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Preset Date Filters
  const setQuickDateFilter = (type) => {
    const today = new Date();
    if (type === 'today') {
      const dateStr = today.toISOString().split('T')[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (type === 'tomorrow') {
      const tmrw = new Date(today);
      tmrw.setDate(tmrw.getDate() + 1);
      const dateStr = tmrw.toISOString().split('T')[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (type === 'this_week') {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      setStartDate(today.toISOString().split('T')[0]);
      setEndDate(endOfWeek.toISOString().split('T')[0]);
    }
  };

  const isFilterActive = searchTerm !== '' || 
    statusFilter !== 'All' || 
    urgencyFilter !== 'All' || 
    acceptanceFilter !== 'All' || 
    startDate !== '' || 
    endDate !== '';

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setUrgencyFilter('All');
    setAcceptanceFilter('All');
    setStartDate('');
    setEndDate('');
  };

  // Filtered Task Collection
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Search filter
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        const titleMatch = (task.title || '').toLowerCase().includes(term);
        const projMatch = (task.project_title || '').toLowerCase().includes(term);
        const clientMatch = (task.client_name || '').toLowerCase().includes(term);
        const pmMatch = (task.pm_name || '').toLowerCase().includes(term);
        const descMatch = (task.description || '').toLowerCase().includes(term);
        if (!titleMatch && !projMatch && !clientMatch && !pmMatch && !descMatch) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Overdue') {
          if (task.status === 'Completed' || !isOverdue(task.deadline)) return false;
        } else if (task.status !== statusFilter) {
          return false;
        }
      }

      // 3. Urgency filter
      if (urgencyFilter !== 'All') {
        const due = getProjectDueDateStatus(task.deadline, task.status);
        if (urgencyFilter === 'Overdue' && due.status !== 'overdue') return false;
        if (urgencyFilter === 'Today' && due.status !== 'due_today') return false;
        if (urgencyFilter === 'Tomorrow' && due.status !== 'urgent') return false;
        if (urgencyFilter === 'This Week' && due.status !== 'soon' && due.status !== 'due_today' && due.status !== 'urgent') return false;
        if (urgencyFilter === 'On Track' && due.status !== 'on_track') return false;
      }

      // 4. Acceptance filter
      if (acceptanceFilter !== 'All') {
        const acc = task.deadline_status || 'Pending Acceptance';
        if (acceptanceFilter === 'Accepted' && acc !== 'Accepted') return false;
        if (acceptanceFilter === 'Pending' && acc === 'Accepted') return false;
        if (acceptanceFilter === 'Appealed' && acc !== 'Appealed') return false;
      }

      // 5. Date filter (by deadline)
      if (startDate || endDate) {
        if (!task.deadline) return false;
        const taskDate = new Date(task.deadline);
        if (startDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          if (taskDate < s) return false;
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          if (taskDate > e) return false;
        }
      }

      return true;
    });
  }, [tasks, searchTerm, statusFilter, urgencyFilter, acceptanceFilter, startDate, endDate]);

  // High-Level KPI Statistics
  const stats = useMemo(() => {
    let inProgress = 0;
    let pendingApproval = 0;
    let pendingAcceptance = 0;
    let overdueCount = 0;
    let completedCount = 0;

    tasks.forEach(t => {
      if (t.status === 'In Progress') inProgress++;
      if (t.status === 'Pending Approval') pendingApproval++;
      if (t.status === 'Completed') completedCount++;
      if (t.status !== 'Completed' && isOverdue(t.deadline)) overdueCount++;
      if (t.status !== 'Completed' && t.deadline_status !== 'Accepted') pendingAcceptance++;
    });

    return {
      total: tasks.length,
      inProgress,
      pendingApproval,
      pendingAcceptance,
      overdueCount,
      completedCount
    };
  }, [tasks]);

  // PDF Export
  const handleExportPDF = () => {
    if (filteredTasks.length === 0) {
      alert('No tasks to export!');
      return;
    }

    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("Adwise Sales - My Tasks & Deliverables Statement", 40, 45);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Specialist: ${currentUser.name || 'Current User'} (${currentUser.role || 'Specialist'}) | Date: ${new Date().toLocaleDateString('en-GB')} | Records: ${filteredTasks.length}`,
        40,
        62
      );

      const tableColumns = [
        "ID", "Task Title", "Project", "Client", "Lead PM", "Deadline", "Urgency", "Acceptance", "Status"
      ];

      const tableRows = filteredTasks.map(t => {
        const due = getProjectDueDateStatus(t.deadline, t.status);
        return [
          `#${t.id}`,
          t.title || '-',
          t.project_title || '-',
          t.client_name || '-',
          t.pm_name || '-',
          due.formattedDate,
          due.badgeText,
          t.deadline_status || 'Pending Acceptance',
          t.status || 'Pending'
        ];
      });

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY: 75,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 150 },
          2: { cellWidth: 140 },
          3: { cellWidth: 100 },
          4: { cellWidth: 80 },
          5: { cellWidth: 65 },
          6: { cellWidth: 75 },
          7: { cellWidth: 65 },
          8: { cellWidth: 65 }
        }
      });

      doc.save(`my_tasks_statement_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export error', err);
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    if (filteredTasks.length === 0) {
      alert('No tasks to export!');
      return;
    }

    const exportData = filteredTasks.map(t => {
      const due = getProjectDueDateStatus(t.deadline, t.status);
      return {
        'Task ID': t.id,
        'Task Title': t.title,
        'Project Name': t.project_title || 'N/A',
        'Client Name': t.client_name || 'N/A',
        'Lead PM': t.pm_name || 'N/A',
        'Deadline': due.formattedDate,
        'Deadline Status': due.label,
        'Acceptance Status': t.deadline_status || 'Pending Acceptance',
        'Status': t.status || 'Pending',
        'Deliverable URL': t.deliverable_url || 'N/A',
        'Assigned Date': t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB') : 'N/A'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'My Tasks');
    XLSX.writeFile(wb, `My_Tasks_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Render Attachment Badges
  const renderAttachments = (attachmentsStr) => {
    if (!attachmentsStr) return null;
    try {
      const files = JSON.parse(attachmentsStr);
      if (!files || files.length === 0) return null;
      return (
        <div className="task-attachments-box">
          <span className="attachments-title"><Paperclip size={13} /> Attachments ({files.length}):</span>
          <div className="attachment-chip-list">
            {files.map((file, i) => {
              const fileName = file.split('/').pop();
              return (
                <a key={i} href={file} target="_blank" rel="noreferrer" className="attachment-file-pill">
                  <span>{fileName}</span>
                  <ExternalLink size={11} />
                </a>
              );
            })}
          </div>
        </div>
      );
    } catch(e) {
      return null;
    }
  };

  return (
    <div className="tasks-page-container modern-ui">
      {/* 1. Header with Title and Shifted Right-Aligned Action Buttons */}
      <div className="tasks-page-header">
        <div className="header-title-area">
          <div className="header-badge-row">
            <h1 className="tasks-main-heading">My Tasks & Deliverables</h1>
            <span className="task-count-badge">
              {stats.total} {stats.total === 1 ? 'Task' : 'Tasks'} Assigned
            </span>
            {stats.overdueCount > 0 && (
              <span className="task-overdue-pill">
                🔥 {stats.overdueCount} Overdue
              </span>
            )}
            {isFilterActive && (
              <span className="filter-active-pill">Filtered Results</span>
            )}
          </div>
          <p className="tasks-subheading">
            Manage your assigned project milestones, execute deliverable checklists, accept schedules, and submit deliverables for approval
          </p>
        </div>

        <div className="tasks-header-actions">
          <button 
            type="button" 
            className="action-btn secondary-btn" 
            onClick={fetchTasks}
            title="Refresh task records"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button 
            type="button" 
            className="action-btn export-pdf-btn" 
            onClick={handleExportPDF}
            title="Download PDF statement"
          >
            <FileText size={15} />
            <span>PDF Statement</span>
          </button>

          <button 
            type="button" 
            className="action-btn excel-btn" 
            onClick={handleExportExcel}
            title="Download Excel spreadsheet"
          >
            <Download size={15} />
            <span>Export Excel</span>
          </button>

          <button 
            type="button" 
            className="action-btn primary-add-btn" 
            onClick={() => navigate('/deadlines')}
            title="Open Deadline Workflow and Approvals Hub"
          >
            <Clock size={16} />
            <span>Deadline Workflow</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="tasks-kpi-grid">
        <div 
          className={`task-kpi-card ${statusFilter === 'All' && !isFilterActive ? 'active' : ''}`}
          onClick={() => { handleResetFilters(); setStatusFilter('All'); }}
          title="Show all tasks"
        >
          <div className="kpi-icon-wrap total">
            <CheckSquare size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Assigned</span>
            <span className="kpi-val">{stats.total}</span>
          </div>
        </div>

        <div 
          className={`task-kpi-card ${statusFilter === 'In Progress' ? 'active' : ''}`}
          onClick={() => { handleResetFilters(); setStatusFilter('In Progress'); }}
          title="Filter tasks in progress"
        >
          <div className="kpi-icon-wrap progress">
            <Play size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">In Progress</span>
            <span className="kpi-val">{stats.inProgress}</span>
          </div>
        </div>

        <div 
          className={`task-kpi-card ${acceptanceFilter === 'Pending' ? 'active' : ''}`}
          onClick={() => { handleResetFilters(); setAcceptanceFilter('Pending'); }}
          title="Filter tasks needing deadline acceptance"
        >
          <div className="kpi-icon-wrap acceptance">
            <ShieldAlert size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Needs Acceptance</span>
            <span className="kpi-val">{stats.pendingAcceptance}</span>
          </div>
        </div>

        <div 
          className={`task-kpi-card ${statusFilter === 'Pending Approval' ? 'active' : ''}`}
          onClick={() => { handleResetFilters(); setStatusFilter('Pending Approval'); }}
          title="Filter submitted deliverables awaiting review"
        >
          <div className="kpi-icon-wrap pending">
            <Clock size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Pending Approval</span>
            <span className="kpi-val">{stats.pendingApproval}</span>
          </div>
        </div>

        <div 
          className={`task-kpi-card overdue-card ${statusFilter === 'Overdue' ? 'active' : ''}`}
          onClick={() => { handleResetFilters(); setStatusFilter('Overdue'); }}
          title="Filter overdue tasks requiring urgent action"
        >
          <div className="kpi-icon-wrap overdue">
            <AlertTriangle size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">🔥 Overdue</span>
            <span className="kpi-val text-crimson">{stats.overdueCount}</span>
          </div>
        </div>

        <div 
          className={`task-kpi-card ${statusFilter === 'Completed' ? 'active' : ''}`}
          onClick={() => { handleResetFilters(); setStatusFilter('Completed'); }}
          title="Filter completed and approved tasks"
        >
          <div className="kpi-icon-wrap completed">
            <CheckCircle2 size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Completed</span>
            <span className="kpi-val">{stats.completedCount}</span>
          </div>
        </div>
      </div>

      {/* 3. Comprehensive Control Toolbar & Filter Panel */}
      <div className="tasks-control-panel">
        <div className="tasks-filter-bar">
          {/* Live Search Input */}
          <div className="tasks-search-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by task title, project, client, or PM..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                type="button" 
                className="search-clear-btn" 
                onClick={() => setSearchTerm('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="filter-select-wrapper">
            <select 
              className="custom-task-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending Approval">⏳ Pending Approval</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">🔥 Overdue Only</option>
            </select>
          </div>

          {/* Deadline Urgency Filter */}
          <div className="filter-select-wrapper">
            <select 
              className="custom-task-select"
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
            >
              <option value="All">All Deadlines</option>
              <option value="Overdue">🚨 Overdue Deadlines</option>
              <option value="Today">⏰ Due Today</option>
              <option value="Tomorrow">⏳ Due Tomorrow</option>
              <option value="This Week">📅 Due This Week</option>
              <option value="On Track">✓ On Track / Upcoming</option>
            </select>
          </div>

          {/* Acceptance Filter */}
          <div className="filter-select-wrapper">
            <select 
              className="custom-task-select"
              value={acceptanceFilter}
              onChange={(e) => setAcceptanceFilter(e.target.value)}
            >
              <option value="All">All Acceptance States</option>
              <option value="Accepted">✓ Deadline Accepted</option>
              <option value="Pending">⚠️ Needs Acceptance</option>
              <option value="Appealed">🚨 Extension Appealed</option>
            </select>
          </div>

          {/* Date Range Picker with Quick Presets */}
          <div className="task-date-range-box">
            <Calendar size={14} className="calendar-icon" />
            <span className="date-label">From:</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="date-input"
              title="Filter from start date"
            />
            <span className="date-label">To:</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="date-input"
              title="Filter to end date"
            />
            {(startDate || endDate) && (
              <button 
                type="button" 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="date-clear-btn"
                title="Clear date filter"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Presets */}
          <div className="quick-presets-group">
            <button 
              type="button" 
              className="preset-btn" 
              onClick={() => setQuickDateFilter('today')}
              title="Filter for today's deadline"
            >
              Today
            </button>
            <button 
              type="button" 
              className="preset-btn" 
              onClick={() => setQuickDateFilter('tomorrow')}
              title="Filter for tomorrow's deadline"
            >
              Tomorrow
            </button>
            <button 
              type="button" 
              className="preset-btn" 
              onClick={() => setQuickDateFilter('this_week')}
              title="Filter for this week's deadlines"
            >
              This Week
            </button>
          </div>

          {/* 1-Click Reset */}
          {isFilterActive && (
            <button 
              type="button" 
              className="reset-filters-btn" 
              onClick={handleResetFilters}
              title="Reset all filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}

          {/* Dual View Toggle */}
          <div className="view-mode-toggle" title="Switch View Mode">
            <button 
              type="button" 
              className={`view-mode-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Visual Cards Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              type="button" 
              className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Enterprise Table View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Tasks Content Display: Cards Grid View or Table View */}
      {loading ? (
        <div className="tasks-loading-state">
          <RefreshCw size={28} className="spin text-crimson" />
          <p>Loading your assigned task workspace...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="tasks-empty-state">
          <div className="empty-icon-circle">
            <CheckSquare size={36} />
          </div>
          <h3>No tasks found matching your filters</h3>
          <p>Try adjusting your search terms or reset the filters to see all assigned deliverables.</p>
          {isFilterActive && (
            <button type="button" className="action-btn secondary-btn" onClick={handleResetFilters}>
              <RotateCcw size={14} /> Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* Visual Task Cards Grid */
        <div className="tasks-cards-grid">
          {filteredTasks.map(task => {
            const overdue = task.status !== 'Completed' && isOverdue(task.deadline);
            const dueStatus = getProjectDueDateStatus(task.deadline, task.status);
            const checklist = getChecklistStats(task.description);
            const isAccepted = task.deadline_status === 'Accepted';
            const isAppealed = task.deadline_status === 'Appealed';
            const reassignTodosList = parseFeedbackTodos(task.reassign_todos);
            const rejectTodosList = parseFeedbackTodos(task.reject_todos);

            return (
              <div 
                key={task.id} 
                className={`task-card-item ${overdue ? 'overdue' : task.status === 'Completed' ? 'completed' : task.status === 'In Progress' ? 'in-progress' : 'pending'}`}
              >
                {/* Card Top: Status & Badges */}
                <div className="task-card-header-bar">
                  <div className="header-tags-row">
                    <span className="task-id-badge">#{task.id}</span>
                    
                    {/* Status Badge */}
                    <span className={`status-pill ${task.status ? task.status.toLowerCase().replace(/\s+/g, '-') : 'pending'}`}>
                      {task.status === 'Completed' && '✓ Completed'}
                      {task.status === 'Pending Approval' && '⏳ In Review'}
                      {task.status === 'In Progress' && '⚡ In Progress'}
                      {task.status === 'Pending' && 'Pending'}
                      {!['Completed', 'Pending Approval', 'In Progress', 'Pending'].includes(task.status) && task.status}
                    </span>

                    {/* Reassigned Tag */}
                    {reassignTodosList && reassignTodosList.length > 0 && task.status !== 'Completed' && (
                      <span 
                        className="acceptance-pill reassign-pill" 
                        title="Task reassigned with instructions & required changes"
                        onClick={() => setSelectedTaskDetails(task)}
                        style={{ cursor: 'pointer' }}
                      >
                        <RotateCcw size={11} /> Reassigned
                      </span>
                    )}

                    {/* Revision Tag */}
                    {rejectTodosList && rejectTodosList.length > 0 && task.status !== 'Completed' && (
                      <span 
                        className="acceptance-pill reject-pill" 
                        title="Milestone revision requested"
                        onClick={() => setSelectedTaskDetails(task)}
                        style={{ cursor: 'pointer' }}
                      >
                        <AlertTriangle size={11} /> Revision
                      </span>
                    )}

                    {/* Deadline Acceptance Badge */}
                    {isAccepted ? (
                      <span className="acceptance-pill accepted" title="Deadline accepted by specialist">
                        <CheckCheck size={11} /> Accepted
                      </span>
                    ) : isAppealed ? (
                      <span className="acceptance-pill appealed" title="Extension request under PM review">
                        <Clock size={11} /> Extension Appealed
                      </span>
                    ) : (
                      <span className="acceptance-pill unconfirmed" title="Deadline requires your confirmation">
                        ⚠️ Accept Deadline
                      </span>
                    )}
                  </div>

                  {/* Urgency Pill */}
                  <span 
                    className="due-urgency-pill"
                    style={{
                      color: dueStatus.color,
                      backgroundColor: dueStatus.bg,
                      borderColor: dueStatus.border
                    }}
                  >
                    {dueStatus.badgeText}
                  </span>
                </div>

                {/* Card Title & Project Breadcrumb */}
                <div className="task-card-title-block">
                  <h3 className="task-main-title" title={task.title}>{task.title}</h3>
                  
                  <div className="project-breadcrumb-row">
                    <Link to={`/projects/${task.project_id}`} className="project-link-badge">
                      <FolderKanban size={13} />
                      <span className="project-link-text">{task.project_title || 'Project Workspace'}</span>
                    </Link>

                    {task.client_name && (
                      <span className="client-chip">
                        <User size={11} /> {task.client_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Checklist Progress Meter */}
                {checklist.total > 0 && (
                  <div className="checklist-progress-box">
                    <div className="checklist-stats-row">
                      <span className="checklist-label">Checklist Milestones</span>
                      <span className="checklist-counter">
                        {checklist.completed}/{checklist.total} ({Math.round((checklist.completed / checklist.total) * 100)}%)
                      </span>
                    </div>
                    <div className="checklist-track">
                      <div 
                        className="checklist-bar" 
                        style={{ 
                          width: `${Math.round((checklist.completed / checklist.total) * 100)}%`,
                          backgroundColor: checklist.completed === checklist.total ? '#10b981' : '#e11d48'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Scope Description / Checklist items */}
                <div className="task-body-scope">
                  {task.description ? (
                    renderDescriptionWithCheckboxes(task.description)
                  ) : (
                    <span className="no-desc-text">No detailed requirements or checklist specified for this milestone.</span>
                  )}
                </div>

                {/* Attachments */}
                {renderAttachments(task.attachments)}

                {/* Submitted Deliverable Display (if pending approval or completed) */}
                {task.deliverable_url && (
                  <div className="submitted-deliverable-banner">
                    <div className="deliverable-text-group">
                      <span className="banner-title">Submitted Package:</span>
                      <span className="banner-file">{task.deliverable_name || 'Project Deliverable'}</span>
                    </div>
                    <a 
                      href={task.deliverable_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="view-deliverable-btn"
                    >
                      <span>Open Link</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Reassignment Notes, Details & Checklist */}
                {reassignTodosList && reassignTodosList.length > 0 && task.status !== 'Completed' && (
                  <div className="reassignment-feedback-card">
                    <div className="feedback-header reassign">
                      <div className="feedback-header-title">
                        <RotateCcw size={14} className="icon-reassign" />
                        <span>Reassignment Notes & Instructions:</span>
                      </div>
                      <span className="feedback-mini-badge reassign">REASSIGNED</span>
                    </div>
                    
                    <div className="feedback-items-container">
                      {reassignTodosList.map((item, idx) => (
                        item.is_note ? (
                          <div key={idx} className="reassign-note-banner">
                            <div className="note-badge-row">
                              <FileText size={12} />
                              <span>PM Instructions</span>
                            </div>
                            <p className="note-text-content">{item.text}</p>
                          </div>
                        ) : (
                          <div key={idx} className="feedback-item-row">
                            <span className="item-bullet">•</span>
                            <div className="item-main-wrap">
                              <span className="item-text">{item.text || item}</span>
                              {item.file_url && (
                                <a 
                                  href={item.file_url.startsWith('http') ? item.file_url : `${item.file_url}`}
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="feedback-file-attachment"
                                >
                                  <Paperclip size={11} />
                                  <span>Reference Attachment</span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejection / Revision feedback notice */}
                {rejectTodosList && rejectTodosList.length > 0 && task.status !== 'Completed' && (
                  <div className="revision-feedback-card">
                    <div className="feedback-header reject">
                      <div className="feedback-header-title">
                        <AlertCircle size={14} className="icon-reject" />
                        <span>Revision Requested Feedback:</span>
                      </div>
                      <span className="feedback-mini-badge reject">NEEDS REVISION</span>
                    </div>

                    <div className="feedback-items-container">
                      {rejectTodosList.map((item, idx) => (
                        <div key={idx} className="feedback-item-row">
                          <span className="item-bullet reject">•</span>
                          <div className="item-main-wrap">
                            <span className="item-text">{item.text || item}</span>
                            {item.file_url && (
                              <a 
                                href={item.file_url.startsWith('http') ? item.file_url : `${item.file_url}`}
                                target="_blank" 
                                rel="noreferrer" 
                                className="feedback-file-attachment"
                              >
                                <Paperclip size={11} />
                                <span>Reference Attachment</span>
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata & Deadlines */}
                <div className="task-card-meta-bar">
                  <div className="meta-col">
                    <span className="meta-label">Target Deadline</span>
                    <div className="meta-val-row">
                      <Clock size={13} style={{ color: dueStatus.color }} />
                      <span className={`meta-val ${overdue ? 'text-crimson font-bold' : ''}`}>
                        {dueStatus.formattedDate}
                      </span>
                    </div>
                  </div>

                  {task.pm_name && (
                    <div className="meta-col text-right">
                      <span className="meta-label">Lead PM</span>
                      <span className="meta-val">{task.pm_name}</span>
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="task-card-footer-actions">
                  {/* Left: View Details & Project */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button 
                      type="button" 
                      className="action-btn secondary-btn small"
                      onClick={() => setSelectedTaskDetails(task)}
                      title="View full task specifications, notes & details"
                    >
                      <FileText size={14} />
                      <span>Details</span>
                    </button>
                    <button 
                      type="button" 
                      className="action-btn secondary-btn small"
                      onClick={() => navigate(`/projects/${task.project_id}`)}
                      title="Open project details workspace"
                    >
                      <ExternalLink size={14} />
                      <span>Workspace</span>
                    </button>
                  </div>

                  <div className="footer-right-buttons">
                    {/* If Deadline not accepted yet, show Accept & Appeal buttons */}
                    {!isAccepted && task.status !== 'Completed' && (
                      <>
                        <button 
                          type="button" 
                          className="btn-action-accept"
                          onClick={() => handleConfirmDeadline(task)}
                          title="Confirm and accept assigned deadline"
                        >
                          <Check size={13} />
                          <span>Accept</span>
                        </button>

                        <button 
                          type="button" 
                          className="btn-action-appeal"
                          onClick={() => handleOpenAppealModal(task)}
                          title="Request a deadline extension"
                        >
                          <span>Appeal</span>
                        </button>
                      </>
                    )}

                    {/* Quick Move to In Progress if Pending */}
                    {task.status === 'Pending' && isAccepted && (
                      <button 
                        type="button" 
                        className="btn-action-start"
                        onClick={() => handleSetStatus(task, 'In Progress')}
                        title="Mark task as In Progress"
                      >
                        <Play size={13} />
                        <span>Start Task</span>
                      </button>
                    )}

                    {/* Submit Deliverable Button (if accepted and not completed) */}
                    {isAccepted && task.status !== 'Completed' && task.status !== 'Pending Approval' && (
                      <button 
                        type="button" 
                        className="action-btn primary-add-btn small"
                        onClick={() => handleOpenSubmitModal(task)}
                        title="Submit deliverables for manager approval"
                      >
                        <Send size={13} />
                        <span>Submit Deliverable</span>
                      </button>
                    )}

                    {/* If already submitted and Pending Approval */}
                    {task.status === 'Pending Approval' && (
                      <span className="awaiting-review-chip">
                        ⏳ Awaiting PM Review
                      </span>
                    )}

                    {/* Completed State */}
                    {task.status === 'Completed' && (
                      <span className="approved-badge">
                        <CheckCircle2 size={13} />
                        <span>Approved</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Enterprise High-Density Table View */
        <div className="tasks-table-card">
          <div className="table-responsive">
            <table className="enterprise-tasks-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '1.25rem', width: '28%' }}>Task Title & Scope</th>
                  <th style={{ width: '20%' }}>Project & Client</th>
                  <th style={{ width: '14%' }}>Deadline & Urgency</th>
                  <th style={{ width: '12%' }}>Acceptance</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.25rem', width: '16%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const overdue = task.status !== 'Completed' && isOverdue(task.deadline);
                  const dueStatus = getProjectDueDateStatus(task.deadline, task.status);
                  const isAccepted = task.deadline_status === 'Accepted';
                  const checklist = getChecklistStats(task.description);
                  const reassignTodosList = parseFeedbackTodos(task.reassign_todos);
                  const rejectTodosList = parseFeedbackTodos(task.reject_todos);

                  return (
                    <tr key={task.id} className="task-table-row">
                      {/* Task Title & Scope */}
                      <td style={{ paddingLeft: '1.25rem' }}>
                        <div className="table-task-info">
                          <span 
                            className="table-task-title"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedTaskDetails(task)}
                            title="Click to view details and notes"
                          >
                            {task.title}
                          </span>
                          <div className="table-submeta-row">
                            <span className="table-task-id">#{task.id}</span>
                            {reassignTodosList && reassignTodosList.length > 0 && task.status !== 'Completed' && (
                              <span 
                                className="reassigned-micro-badge" 
                                onClick={() => setSelectedTaskDetails(task)}
                                style={{ cursor: 'pointer' }}
                                title="Click to view reassignment notes & instructions"
                              >
                                <RotateCcw size={10} /> Reassigned ({reassignTodosList.length})
                              </span>
                            )}
                            {rejectTodosList && rejectTodosList.length > 0 && task.status !== 'Completed' && (
                              <span 
                                className="revision-micro-badge" 
                                onClick={() => setSelectedTaskDetails(task)}
                                style={{ cursor: 'pointer' }}
                                title="Click to view revision feedback"
                              >
                                <AlertTriangle size={10} /> Revision ({rejectTodosList.length})
                              </span>
                            )}
                            {checklist.total > 0 && (
                              <span className="checklist-micro-badge">
                                ✓ {checklist.completed}/{checklist.total} Checklist
                              </span>
                            )}
                            {task.attachments && (
                              <span className="attachment-micro-badge" title="Files attached">
                                <Paperclip size={10} /> Files
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Project & Client */}
                      <td>
                        <div className="table-project-cell">
                          <Link to={`/projects/${task.project_id}`} className="table-proj-link">
                            <FolderKanban size={13} />
                            <span>{task.project_title || 'Project'}</span>
                          </Link>
                          {task.client_name && (
                            <span className="table-client-name">{task.client_name}</span>
                          )}
                        </div>
                      </td>

                      {/* Deadline & Urgency */}
                      <td>
                        <div className="table-deadline-cell">
                          <div className="deadline-date-row">
                            <Clock size={12} style={{ color: dueStatus.color }} />
                            <span className={`deadline-text ${overdue ? 'text-crimson font-bold' : ''}`}>
                              {dueStatus.formattedDate}
                            </span>
                          </div>
                          <span 
                            className="due-urgency-pill micro"
                            style={{
                              color: dueStatus.color,
                              backgroundColor: dueStatus.bg,
                              borderColor: dueStatus.border
                            }}
                          >
                            {dueStatus.badgeText}
                          </span>
                        </div>
                      </td>

                      {/* Acceptance Status */}
                      <td>
                        {isAccepted ? (
                          <span className="acceptance-pill accepted">✓ Accepted</span>
                        ) : task.deadline_status === 'Appealed' ? (
                          <span className="acceptance-pill appealed">Appealed</span>
                        ) : (
                          <span className="acceptance-pill unconfirmed">⚠️ Unconfirmed</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`status-pill ${task.status ? task.status.toLowerCase().replace(/\s+/g, '-') : 'pending'}`}>
                          {task.status || 'Pending'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                        <div className="table-action-row">
                          <button 
                            type="button" 
                            className="row-btn view" 
                            onClick={() => setSelectedTaskDetails(task)}
                            title="View Full Task Details & Notes"
                          >
                            <FileText size={13} />
                          </button>

                          <button 
                            type="button" 
                            className="row-btn view" 
                            onClick={() => navigate(`/projects/${task.project_id}`)}
                            title="View Project Workspace"
                          >
                            <ExternalLink size={13} />
                          </button>

                          {!isAccepted && task.status !== 'Completed' && (
                            <button 
                              type="button" 
                              className="btn-action-accept micro"
                              onClick={() => handleConfirmDeadline(task)}
                              title="Accept deadline"
                            >
                              <Check size={12} /> Accept
                            </button>
                          )}

                          {isAccepted && task.status !== 'Completed' && task.status !== 'Pending Approval' && (
                            <button 
                              type="button" 
                              className="action-btn primary-add-btn micro"
                              onClick={() => handleOpenSubmitModal(task)}
                              title="Submit deliverable"
                            >
                              <Send size={12} /> Submit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Senior-Level Submit Deliverable Modal */}
      {submitModal.isOpen && (
        <div className="modal-overlay" onClick={() => setSubmitModal({ isOpen: false, projectId: null, stepId: null, projectName: '', stepTitle: '' })}>
          <div className="modal-content task-deliverable-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>Submit Milestone Deliverable</h2>
                <p>Attach output files, verify URLs, and send to Project Manager for approval</p>
              </div>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setSubmitModal({ isOpen: false, projectId: null, stepId: null, projectName: '', stepTitle: '' })}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitDeliverable} className="deliverable-modal-form">
              <div className="project-banner-card">
                <FolderKanban size={20} className="banner-icon" />
                <div>
                  <span className="banner-label">Target Project</span>
                  <h4 className="banner-project">{submitModal.projectName}</h4>
                  <span className="banner-step">Step: {submitModal.stepTitle}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Deliverable / Package Name <span className="req-star">*</span>
                </label>
                <input 
                  type="text" 
                  value={deliverableName}
                  onChange={(e) => setDeliverableName(e.target.value)}
                  placeholder="e.g. TAX-FILING-2026-FINAL-DOCS.zip"
                  required
                  className="form-input"
                />
                <span className="field-hint">Use a standard naming convention to help the client and manager review your work.</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Download Link / Cloud Storage URL <span className="req-star">*</span>
                </label>
                <input 
                  type="url" 
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/... or Dropbox link"
                  required
                  className="form-input"
                />
                <span className="field-hint">Ensure the access link permissions are set to "Anyone with the link can view".</span>
              </div>

              <div className="modal-footer-actions">
                <button 
                  type="button" 
                  className="action-btn secondary-btn"
                  onClick={() => setSubmitModal({ isOpen: false, projectId: null, stepId: null, projectName: '', stepTitle: '' })}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="action-btn primary-add-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Submitting Deliverable...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Submit for Approval</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Senior-Level Extension Appeal Modal */}
      {appealModal.isOpen && (
        <div className="modal-overlay" onClick={() => setAppealModal({ isOpen: false, task: null, proposed_deadline: '', reason: '' })}>
          <div className="modal-content task-appeal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>Appeal Milestone Deadline</h2>
                <p>Request an extension with a proposed completion date and business justification</p>
              </div>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setAppealModal({ isOpen: false, task: null, proposed_deadline: '', reason: '' })}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAppealSubmit} className="appeal-modal-form">
              <div className="appeal-task-summary">
                <span className="summary-step-title">{appealModal.task?.title}</span>
                <span className="summary-current-deadline">
                  Current Deadline: {appealModal.task?.deadline ? new Date(appealModal.task.deadline).toLocaleDateString('en-GB') : 'None'}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Proposed New Deadline <span className="req-star">*</span>
                </label>
                <input 
                  type="date"
                  value={appealModal.proposed_deadline}
                  onChange={(e) => setAppealModal({ ...appealModal, proposed_deadline: e.target.value })}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason / Justification for Extension</label>
                <textarea 
                  value={appealModal.reason}
                  onChange={(e) => setAppealModal({ ...appealModal, reason: e.target.value })}
                  rows="3"
                  placeholder="Explain client feedback delays, scope additions, or technical roadblocks..."
                  className="form-textarea"
                />
              </div>

              <div className="modal-footer-actions">
                <button 
                  type="button" 
                  className="action-btn secondary-btn"
                  onClick={() => setAppealModal({ isOpen: false, task: null, proposed_deadline: '', reason: '' })}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="action-btn primary-add-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Submitting Appeal...</span>
                    </>
                  ) : (
                    <>
                      <Clock size={15} />
                      <span>Submit Extension Appeal</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 7. Comprehensive Task Details & Notes Modal */}
      {selectedTaskDetails && (
        <div className="modal-overlay" onClick={() => setSelectedTaskDetails(null)}>
          <div className="modal-content task-full-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-text">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                  <span className="task-id-badge">#{selectedTaskDetails.id}</span>
                  <span className={`status-pill ${selectedTaskDetails.status ? selectedTaskDetails.status.toLowerCase().replace(/\s+/g, '-') : 'pending'}`}>
                    {selectedTaskDetails.status || 'Pending'}
                  </span>
                  {selectedTaskDetails.deadline_status === 'Accepted' ? (
                    <span className="acceptance-pill accepted">✓ Accepted</span>
                  ) : selectedTaskDetails.deadline_status === 'Appealed' ? (
                    <span className="acceptance-pill appealed">Appealed</span>
                  ) : (
                    <span className="acceptance-pill unconfirmed">⚠️ Unconfirmed</span>
                  )}
                </div>
                <h2>{selectedTaskDetails.title}</h2>
                <p>Project: <strong>{selectedTaskDetails.project_title || 'Project Workspace'}</strong> {selectedTaskDetails.client_name ? `• Client: ${selectedTaskDetails.client_name}` : ''}</p>
              </div>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setSelectedTaskDetails(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="details-modal-body">
              {/* Meta strip */}
              <div className="details-meta-strip">
                <div className="meta-strip-item">
                  <span className="strip-label">Target Deadline</span>
                  <span className="strip-val">
                    <Clock size={13} /> {selectedTaskDetails.deadline ? new Date(selectedTaskDetails.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No target date'}
                  </span>
                </div>
                {selectedTaskDetails.pm_name && (
                  <div className="meta-strip-item">
                    <span className="strip-label">Lead PM</span>
                    <span className="strip-val">
                      <User size={13} /> {selectedTaskDetails.pm_name}
                    </span>
                  </div>
                )}
                <div className="meta-strip-item">
                  <span className="strip-label">Acceptance</span>
                  <span className="strip-val">
                    {selectedTaskDetails.deadline_status || 'Pending Acceptance'}
                  </span>
                </div>
              </div>

              {/* Reassignment Notes & Instructions if present */}
              {(() => {
                const rTodos = parseFeedbackTodos(selectedTaskDetails.reassign_todos);
                if (!rTodos || rTodos.length === 0) return null;
                return (
                  <div className="reassignment-feedback-card modal-highlight">
                    <div className="feedback-header reassign">
                      <div className="feedback-header-title">
                        <RotateCcw size={14} className="icon-reassign" />
                        <span>Reassignment Notes & Special Instructions:</span>
                      </div>
                      <span className="feedback-mini-badge reassign">REASSIGNED</span>
                    </div>
                    <div className="feedback-items-container">
                      {rTodos.map((item, idx) => (
                        item.is_note ? (
                          <div key={idx} className="reassign-note-banner">
                            <div className="note-badge-row">
                              <FileText size={12} />
                              <span>PM Note / Instructions</span>
                            </div>
                            <p className="note-text-content">{item.text}</p>
                          </div>
                        ) : (
                          <div key={idx} className="feedback-item-row">
                            <span className="item-bullet">•</span>
                            <div className="item-main-wrap">
                              <span className="item-text">{item.text || item}</span>
                              {item.file_url && (
                                <a 
                                  href={item.file_url.startsWith('http') ? item.file_url : `${item.file_url}`}
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="feedback-file-attachment"
                                >
                                  <Paperclip size={11} />
                                  <span>Reference Attachment</span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Revision Feedback if present */}
              {(() => {
                const rejTodos = parseFeedbackTodos(selectedTaskDetails.reject_todos);
                if (!rejTodos || rejTodos.length === 0) return null;
                return (
                  <div className="revision-feedback-card modal-highlight">
                    <div className="feedback-header reject">
                      <div className="feedback-header-title">
                        <AlertCircle size={14} className="icon-reject" />
                        <span>Revision Requested Feedback:</span>
                      </div>
                      <span className="feedback-mini-badge reject">NEEDS REVISION</span>
                    </div>
                    <div className="feedback-items-container">
                      {rejTodos.map((item, idx) => (
                        <div key={idx} className="feedback-item-row">
                          <span className="item-bullet reject">•</span>
                          <div className="item-main-wrap">
                            <span className="item-text">{item.text || item}</span>
                            {item.file_url && (
                              <a 
                                href={item.file_url.startsWith('http') ? item.file_url : `${item.file_url}`}
                                target="_blank" 
                                rel="noreferrer" 
                                className="feedback-file-attachment"
                              >
                                <Paperclip size={11} />
                                <span>Reference Attachment</span>
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Full Scope Specifications */}
              <div className="details-section">
                <span className="section-title">Milestone Scope & Requirements</span>
                <div className="details-scope-box">
                  {selectedTaskDetails.description ? (
                    renderDescriptionWithCheckboxes(selectedTaskDetails.description)
                  ) : (
                    <span className="no-desc-text">No detailed requirements or checklist specified for this milestone.</span>
                  )}
                </div>
              </div>

              {/* Attachments */}
              {renderAttachments(selectedTaskDetails.attachments)}

              {/* Deliverable info if submitted */}
              {selectedTaskDetails.deliverable_url && (
                <div className="submitted-deliverable-banner">
                  <div className="deliverable-text-group">
                    <span className="banner-title">Submitted Package:</span>
                    <span className="banner-file">{selectedTaskDetails.deliverable_name || 'Project Deliverable'}</span>
                  </div>
                  <a 
                    href={selectedTaskDetails.deliverable_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="view-deliverable-btn"
                  >
                    <span>Open Link</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            <div className="modal-footer-actions">
              <button 
                type="button" 
                className="action-btn secondary-btn"
                onClick={() => {
                  navigate(`/projects/${selectedTaskDetails.project_id}`);
                  setSelectedTaskDetails(null);
                }}
              >
                <ExternalLink size={14} />
                <span>Open Project Workspace</span>
              </button>
              <button 
                type="button" 
                className="action-btn primary-add-btn"
                onClick={() => setSelectedTaskDetails(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
