import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Clock, CheckCircle2, XCircle, ArrowRight, User, AlertCircle, 
  FolderKanban, RefreshCw, Calendar, ShieldCheck, Edit3, ExternalLink, 
  Search, FileText, Download, LayoutGrid, List, RotateCcw, X, 
  AlertTriangle, Check, Send, ShieldAlert, CheckSquare, MessageSquare, 
  Receipt, ArrowUpRight, HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getProjectDueDateStatus } from '../utils/projectDueDate';
import './DeadlineWorkflow.css';

export default function DeadlineWorkflow() {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [filterTab, setFilterTab] = useState('Pending Acceptance');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI View Mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState('cards');

  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isManagerRole = ['Admin', 'Product Manager', 'PM', 'Project Manager', 'Production Manager'].includes(currentUser.role);

  // Sync tab with URL search parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'approval') {
      setFilterTab('Tasks for Approval');
    } else if (tab === 'appeals') {
      setFilterTab('Appealed');
    } else if (tab === 'accepted') {
      setFilterTab('Accepted');
    } else if (tab === 'all') {
      setFilterTab('All');
    } else if (tab === 'pending') {
      setFilterTab('Pending Acceptance');
    }
  }, [location.search]);

  // Extension Appeal Modal State
  const [appealModalStep, setAppealModalStep] = useState(null);
  const [appealForm, setAppealForm] = useState({
    proposed_deadline: '',
    reason: ''
  });
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  // Rejection / Revision Request Modal State
  const [revisionModal, setRevisionModal] = useState({
    isOpen: false,
    stepId: null,
    projectId: null,
    stepTitle: '',
    feedback: ''
  });

  // Direct Edit Date State
  const [editingDateStepId, setEditingDateStepId] = useState(null);
  const [editingDateValue, setEditingDateValue] = useState('');

  useEffect(() => {
    fetchAppeals();
  }, []);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/deadlines/appeals', {
        params: {
          user_id: currentUser.id,
          role: currentUser.role
        }
      });
      setAppeals(res.data || []);
    } catch (error) {
      console.error('Failed to fetch deadline appeals', error);
    } finally {
      setLoading(false);
    }
  };

  // Review (Approve or Reject) an Appeal
  const handleReviewAppeal = async (stepId, action) => {
    if (!window.confirm(`Are you sure you want to ${action.toLowerCase()} this deadline extension appeal?`)) return;
    setProcessingId(stepId);
    try {
      await axios.post(`/api/deadlines/appeals/${stepId}/review`, {
        action,
        user_id: currentUser.id
      });
      alert(`Deadline appeal ${action === 'Approve' ? 'approved' : 'rejected'} successfully!`);
      await fetchAppeals();
    } catch (error) {
      console.error('Failed to review appeal', error);
      alert('Failed to process appeal review: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessingId(null);
    }
  };

  // Confirm / Accept a Deadline
  const handleConfirmDeadline = async (stepId) => {
    setProcessingId(stepId);
    try {
      await axios.post(`/api/deadlines/accept/${stepId}`, {
        user_id: currentUser.id
      });
      alert('✓ Step deadline confirmed and accepted successfully!');
      await fetchAppeals();
    } catch (error) {
      console.error('Failed to confirm deadline', error);
      alert('Failed to confirm deadline: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessingId(null);
    }
  };

  // Open Appeal Modal
  const handleOpenAppealModal = (item) => {
    setAppealModalStep(item);
    setAppealForm({
      proposed_deadline: item.original_deadline ? item.original_deadline.split('T')[0] : '',
      reason: ''
    });
  };

  // Submit Appeal
  const handleSubmitAppeal = async (e) => {
    e.preventDefault();
    if (!appealModalStep || !appealForm.proposed_deadline) return;
    setSubmittingAppeal(true);
    try {
      await axios.post(`/api/projects/${appealModalStep.project_id}/steps/${appealModalStep.step_id}/appeal-deadline`, {
        proposed_deadline: appealForm.proposed_deadline,
        reason: appealForm.reason,
        user_id: currentUser.id
      });
      alert('Deadline extension appeal submitted successfully!');
      setAppealModalStep(null);
      await fetchAppeals();
    } catch (error) {
      console.error('Failed to submit appeal', error);
      alert('Failed to submit deadline appeal: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmittingAppeal(false);
    }
  };

  // Direct Date Save (Admin / PM)
  const handleSaveDirectDate = async (stepId) => {
    if (!editingDateValue) return;
    setProcessingId(stepId);
    try {
      await axios.post(`/api/deadlines/update-date/${stepId}`, {
        deadline: editingDateValue,
        user_id: currentUser.id
      });
      alert('Step deadline updated successfully!');
      setEditingDateStepId(null);
      await fetchAppeals();
    } catch (error) {
      console.error('Failed to update date', error);
      alert('Failed to update deadline date: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessingId(null);
    }
  };

  // Approve Deliverable
  const handleApproveTask = async (stepId, projectId) => {
    if (!window.confirm('Are you sure you want to approve this deliverable and mark the task as completed?')) return;
    setProcessingId(stepId);
    try {
      await axios.post(`/api/deadlines/tasks/${stepId}/approve`, {
        user_id: currentUser.id
      });
      alert('✓ Task approved and completed successfully!');
      await fetchAppeals();
    } catch (error) {
      console.error('Failed to approve task', error);
      alert('Failed to approve task: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessingId(null);
    }
  };

  // Open Revision Request Modal
  const handleOpenRevisionModal = (item) => {
    setRevisionModal({
      isOpen: true,
      stepId: item.step_id,
      projectId: item.project_id,
      stepTitle: item.step_title,
      feedback: ''
    });
  };

  // Submit Revision Request
  const handleSubmitRevision = async (e) => {
    e.preventDefault();
    if (!revisionModal.feedback.trim()) {
      alert('Please specify revision instructions for the team member.');
      return;
    }
    setProcessingId(revisionModal.stepId);
    try {
      await axios.post(`/api/deadlines/tasks/${revisionModal.stepId}/reject`, {
        user_id: currentUser.id,
        feedback: revisionModal.feedback.trim()
      });
      alert('Task returned to production team member for revision.');
      setRevisionModal({ isOpen: false, stepId: null, projectId: null, stepTitle: '', feedback: '' });
      await fetchAppeals();
    } catch (error) {
      console.error('Failed to reject task', error);
      alert('Failed to request revision: ' + (error.response?.data?.error || error.message));
    } finally {
      setProcessingId(null);
    }
  };

  const getLocalDateString = (d) => {
    const date = new Date(d);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().split('T')[0];
  };

  const setQuickDateFilter = (type) => {
    const today = new Date();
    if (type === 'today') {
      const dateStr = getLocalDateString(today);
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (type === 'tomorrow') {
      const tmrw = new Date(today);
      tmrw.setDate(tmrw.getDate() + 1);
      const dateStr = getLocalDateString(tmrw);
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (type === 'this_week') {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay() || 7;
      startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      setStartDate(getLocalDateString(startOfWeek));
      setEndDate(getLocalDateString(endOfWeek));
    }
  };

  // Tab & Global Metrics
  const totalCount = appeals.length;
  const pendingAcceptanceCount = appeals.filter(a => a.deadline_status === 'Pending Acceptance' || !a.deadline_status).length;
  const extensionAppealsCount = appeals.filter(a => a.deadline_status === 'Appealed').length;
  const confirmedCount = appeals.filter(a => a.deadline_status === 'Accepted').length;
  const tasksForApprovalCount = appeals.filter(a => a.step_status === 'Pending Approval').length;

  const isFilterActive = searchQuery !== '' || 
    urgencyFilter !== 'All' || 
    startDate !== '' || 
    endDate !== '';

  const handleResetFilters = () => {
    setSearchQuery('');
    setUrgencyFilter('All');
    setStartDate('');
    setEndDate('');
  };

  // Filtered Collection
  const filteredItems = useMemo(() => {
    return appeals.filter(item => {
      // 1. Tab filter
      if (filterTab === 'Appealed' && item.deadline_status !== 'Appealed') return false;
      if (filterTab === 'Pending Acceptance' && item.deadline_status !== 'Pending Acceptance' && item.deadline_status) return false;
      if (filterTab === 'Accepted' && item.deadline_status !== 'Accepted') return false;
      if (filterTab === 'Tasks for Approval' && item.step_status !== 'Pending Approval') return false;

      // 2. Urgency filter
      if (urgencyFilter !== 'All') {
        const due = getProjectDueDateStatus(item.original_deadline, item.step_status);
        if (urgencyFilter === 'Overdue' && due.status !== 'overdue') return false;
        if (urgencyFilter === 'Today' && due.status !== 'due_today') return false;
        if (urgencyFilter === 'Tomorrow' && due.status !== 'urgent') return false;
        if (urgencyFilter === 'This Week' && due.status !== 'soon' && due.status !== 'due_today' && due.status !== 'urgent') return false;
        if (urgencyFilter === 'On Track' && due.status !== 'on_track') return false;
      }

      // 3. Date range filter
      if (startDate || endDate) {
        if (!item.original_deadline) return false;
        const itemDate = new Date(item.original_deadline);
        const itemDateStr = getLocalDateString(itemDate);
        
        if (startDate && itemDateStr < startDate) return false;
        if (endDate && itemDateStr > endDate) return false;
      }

      // 4. Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesProject = item.project_title && item.project_title.toLowerCase().includes(q);
        const matchesStep = item.step_title && item.step_title.toLowerCase().includes(q);
        const matchesClient = item.client_name && item.client_name.toLowerCase().includes(q);
        const matchesEmployee = item.employee_name && item.employee_name.toLowerCase().includes(q);
        
        if (!matchesProject && !matchesStep && !matchesClient && !matchesEmployee) {
          return false;
        }
      }

      return true;
    });
  }, [appeals, filterTab, urgencyFilter, startDate, endDate, searchQuery]);

  // PDF Export
  const handleExportPDF = () => {
    if (filteredItems.length === 0) {
      alert('No records to export!');
      return;
    }

    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("Adwise Sales - Deadline Workflow & Timeline Report", 40, 45);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Category: ${filterTab} | Generated: ${new Date().toLocaleDateString('en-GB')} | Total Records: ${filteredItems.length}`,
        40,
        62
      );

      const tableColumns = [
        "ID", "Milestone / Step", "Project", "Client", "Assignee", "Original Date", "Proposed Date", "Reason", "Status"
      ];

      const tableRows = filteredItems.map(item => {
        const origDate = item.original_deadline ? new Date(item.original_deadline).toLocaleDateString('en-GB') : '-';
        const propDate = item.proposed_deadline ? new Date(item.proposed_deadline).toLocaleDateString('en-GB') : '-';
        const statusLabel = item.step_status === 'Pending Approval' ? 'In Review' : (item.deadline_status || 'Pending Acceptance');

        return [
          `#${item.step_id}`,
          item.step_title || '-',
          item.project_title || '-',
          item.client_name || '-',
          item.employee_name || 'Unassigned',
          origDate,
          propDate,
          item.appeal_reason ? item.appeal_reason.slice(0, 40) + (item.appeal_reason.length > 40 ? '...' : '') : '-',
          statusLabel
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
          2: { cellWidth: 120 },
          3: { cellWidth: 90 },
          4: { cellWidth: 90 },
          5: { cellWidth: 65 },
          6: { cellWidth: 65 },
          7: { cellWidth: 120 },
          8: { cellWidth: 65 }
        }
      });

      doc.save(`deadline_workflow_${filterTab.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export error', err);
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      alert('No records to export!');
      return;
    }

    const exportData = filteredItems.map(item => ({
      'Step ID': item.step_id,
      'Milestone Title': item.step_title,
      'Project Title': item.project_title || 'N/A',
      'Client Name': item.client_name || 'N/A',
      'Assignee Name': item.employee_name || 'Unassigned',
      'Assignee Role': item.employee_role || 'Staff',
      'Original Target Deadline': item.original_deadline ? new Date(item.original_deadline).toLocaleDateString('en-GB') : 'N/A',
      'Proposed Extension Date': item.proposed_deadline ? new Date(item.proposed_deadline).toLocaleDateString('en-GB') : 'N/A',
      'Appeal Reason': item.appeal_reason || 'N/A',
      'Deadline Status': item.deadline_status || 'Pending Acceptance',
      'Step Status': item.step_status || 'Active',
      'Deliverable URL': item.deliverable_url || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deadlines & Approvals');
    XLSX.writeFile(wb, `Deadline_Workflow_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="deadline-workflow-container modern-ui">
      {/* 1. Page Header with Title and Shifted Right-Aligned Action Buttons */}
      <div className="deadline-page-header">
        <div className="header-title-area">
          <div className="header-badge-row">
            <h1 className="deadline-main-heading">
              {filterTab === 'Tasks for Approval' ? 'Deliverables Approval Center' : 'Deadline Workflow & Appeals'}
            </h1>
            <span className="deadline-count-badge">
              {filteredItems.length} {filteredItems.length === 1 ? 'Record' : 'Records'}
            </span>
            {extensionAppealsCount > 0 && (
              <span className="deadline-appeals-pill">
                ⚠️ {extensionAppealsCount} Extension {extensionAppealsCount === 1 ? 'Appeal' : 'Appeals'}
              </span>
            )}
            {tasksForApprovalCount > 0 && isManagerRole && (
              <span className="deadline-approval-pill">
                📋 {tasksForApprovalCount} Awaiting Review
              </span>
            )}
            {isFilterActive && (
              <span className="filter-active-pill">Filtered Results</span>
            )}
          </div>
          <p className="deadline-subheading">
            {filterTab === 'Tasks for Approval' 
              ? 'Review, verify, and approve completed deliverables submitted by specialists or return with revisions.'
              : 'Track agency deliverable timelines, review extension appeals, confirm milestone commitments, and monitor schedules.'}
          </p>
        </div>

        <div className="deadline-header-actions">
          <button 
            type="button" 
            className="action-btn secondary-btn" 
            onClick={fetchAppeals}
            title="Refresh workflow records"
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
            onClick={() => navigate('/tasks')}
            title="Go to personal task execution workspace"
          >
            <CheckSquare size={16} />
            <span>My Tasks</span>
          </button>
        </div>
      </div>

      {/* 2. Top Interactive KPI Counter Cards */}
      <div className="deadline-kpi-grid">
        <div 
          className={`deadline-kpi-card ${filterTab === 'All' ? 'active' : ''}`}
          onClick={() => { navigate('/deadlines?tab=all'); setFilterTab('All'); }}
          title="View all step deadlines across agency"
        >
          <div className="kpi-icon-wrap total">
            <Calendar size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Milestones</span>
            <span className="kpi-val">{totalCount}</span>
          </div>
        </div>

        <div 
          className={`deadline-kpi-card ${filterTab === 'Pending Acceptance' ? 'active' : ''}`}
          onClick={() => { navigate('/deadlines?tab=pending'); setFilterTab('Pending Acceptance'); }}
          title="View milestones awaiting specialist acceptance"
        >
          <div className="kpi-icon-wrap pending">
            <Clock size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Pending Acceptance</span>
            <span className="kpi-val">{pendingAcceptanceCount}</span>
          </div>
        </div>

        <div 
          className={`deadline-kpi-card appeals-card ${filterTab === 'Appealed' ? 'active' : ''}`}
          onClick={() => { navigate('/deadlines?tab=appeals'); setFilterTab('Appealed'); }}
          title="View deadline extension appeals submitted by specialists"
        >
          <div className="kpi-icon-wrap appeals">
            <AlertCircle size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">⚠️ Extension Appeals</span>
            <span className="kpi-val text-crimson">{extensionAppealsCount}</span>
          </div>
        </div>

        <div 
          className={`deadline-kpi-card ${filterTab === 'Accepted' ? 'active' : ''}`}
          onClick={() => { navigate('/deadlines?tab=accepted'); setFilterTab('Accepted'); }}
          title="View agreed and confirmed step deadlines"
        >
          <div className="kpi-icon-wrap confirmed">
            <CheckCircle2 size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Confirmed & Aligned</span>
            <span className="kpi-val">{confirmedCount}</span>
          </div>
        </div>

        {isManagerRole && (
          <div 
            className={`deadline-kpi-card approval-card ${filterTab === 'Tasks for Approval' ? 'active' : ''}`}
            onClick={() => { navigate('/deadlines?tab=approval'); setFilterTab('Tasks for Approval'); }}
            title="View submitted deliverables requiring PM / Admin approval"
          >
            <div className="kpi-icon-wrap approval">
              <ShieldCheck size={18} />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">📋 For Approval</span>
              <span className="kpi-val text-indigo">{tasksForApprovalCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Workflow Segmented Tabs Navigation */}
      <div className="deadline-segmented-tabs">
        <button 
          type="button"
          className={`seg-tab-btn ${filterTab === 'Pending Acceptance' ? 'active' : ''}`}
          onClick={() => { navigate('/deadlines?tab=pending'); setFilterTab('Pending Acceptance'); }}
        >
          <Clock size={15} />
          <span>Pending Acceptance</span>
          <span className="seg-counter">{pendingAcceptanceCount}</span>
        </button>

        <button 
          type="button"
          className={`seg-tab-btn ${filterTab === 'Appealed' ? 'active' : ''}`}
          onClick={() => { navigate('/deadlines?tab=appeals'); setFilterTab('Appealed'); }}
        >
          <AlertCircle size={15} />
          <span>Extension Appeals</span>
          <span className="seg-counter crimson">{extensionAppealsCount}</span>
        </button>

        <button 
          type="button"
          className={`seg-tab-btn ${filterTab === 'Accepted' ? 'active' : ''}`}
          onClick={() => { navigate('/deadlines?tab=accepted'); setFilterTab('Accepted'); }}
        >
          <CheckCircle2 size={15} />
          <span>Confirmed Deadlines</span>
          <span className="seg-counter">{confirmedCount}</span>
        </button>

        <button 
          type="button"
          className={`seg-tab-btn ${filterTab === 'All' ? 'active' : ''}`}
          onClick={() => { navigate('/deadlines?tab=all'); setFilterTab('All'); }}
        >
          <Calendar size={15} />
          <span>All Milestones</span>
          <span className="seg-counter">{totalCount}</span>
        </button>

        {isManagerRole && (
          <button 
            type="button"
            className={`seg-tab-btn ${filterTab === 'Tasks for Approval' ? 'active' : ''}`}
            onClick={() => { navigate('/deadlines?tab=approval'); setFilterTab('Tasks for Approval'); }}
          >
            <ShieldCheck size={15} />
            <span>Tasks for Approval</span>
            <span className="seg-counter indigo">{tasksForApprovalCount}</span>
          </button>
        )}
      </div>

      {/* 4. Comprehensive Control Toolbar & Filter Panel */}
      <div className="deadline-control-panel">
        <div className="deadline-filter-bar">
          {/* Search Box */}
          <div className="deadline-search-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by milestone, project, client, or team member..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button" 
                className="search-clear-btn" 
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Urgency Filter */}
          <div className="filter-item-wrapper">
            <select 
              className="custom-deadline-select"
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
            >
              <option value="All">All Deadline Urgencies</option>
              <option value="Overdue">🚨 Overdue Deadlines</option>
              <option value="Today">⏰ Due Today</option>
              <option value="Tomorrow">⏳ Due Tomorrow</option>
              <option value="This Week">📅 Due This Week</option>
              <option value="On Track">✓ On Track / Future</option>
            </select>
          </div>

          {/* Date Range Picker */}
          <div className="deadline-date-range-box">
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

          {/* Quick Date Presets */}
          <div className="quick-presets-group">
            <button 
              type="button" 
              className="preset-btn" 
              onClick={() => setQuickDateFilter('today')}
            >
              Today
            </button>
            <button 
              type="button" 
              className="preset-btn" 
              onClick={() => setQuickDateFilter('tomorrow')}
            >
              Tomorrow
            </button>
            <button 
              type="button" 
              className="preset-btn" 
              onClick={() => setQuickDateFilter('this_week')}
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

      {/* 5. Main Content: Cards Grid View or Table View */}
      {loading ? (
        <div className="deadline-loading-state">
          <RefreshCw size={28} className="spin text-crimson" />
          <p>Loading deadline workflow and review records...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="deadline-empty-state">
          <div className="empty-icon-circle">
            <CheckCircle2 size={36} />
          </div>
          <h3>All Clear! No Records Found</h3>
          <p>No milestone deadlines match the active tab and search criteria.</p>
          {isFilterActive && (
            <button type="button" className="action-btn secondary-btn" onClick={handleResetFilters}>
              <RotateCcw size={14} /> Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* Visual Cards Grid View */
        <div className="deadline-cards-grid">
          {filteredItems.map(item => {
            const isAppealed = item.deadline_status === 'Appealed';
            const isPending = item.deadline_status === 'Pending Acceptance' || !item.deadline_status;
            const isAccepted = item.deadline_status === 'Accepted';
            const isApproval = item.step_status === 'Pending Approval';
            const dueStatus = getProjectDueDateStatus(item.original_deadline, item.step_status);

            return (
              <div 
                key={item.step_id} 
                className={`deadline-card-item ${isAppealed ? 'appealed' : isApproval ? 'approval' : isAccepted ? 'confirmed' : 'pending'}`}
              >
                {/* Header: User Badge & Meta */}
                <div className="card-top-bar">
                  <div className="user-assignee-badge">
                    <User size={13} />
                    <span className="user-name">{item.employee_name || 'Team Specialist'}</span>
                    <span className="user-role">({item.employee_role || 'Specialist'})</span>
                  </div>

                  <span className="card-timestamp">
                    {item.appealed_at ? new Date(item.appealed_at).toLocaleDateString('en-GB') : (item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : 'Active')}
                  </span>
                </div>

                {/* Milestone Title & Project Link */}
                <div className="card-title-group">
                  <div className="card-title-row">
                    <h3 
                      className="step-title-text"
                      onClick={() => navigate(`/projects/${item.project_id}`)}
                      title="Open project details workspace"
                    >
                      {item.step_title}
                    </h3>

                    {/* Status Badges */}
                    {isApproval && (
                      <span className="wf-status-badge approval">
                        ⏳ Deliverable Submitted
                      </span>
                    )}
                    {isAppealed && (
                      <span className="wf-status-badge appealed">
                        ⚠️ Extension Appealed
                      </span>
                    )}
                    {isPending && !isApproval && (
                      <span className="wf-status-badge pending">
                        ⏳ Needs Acceptance
                      </span>
                    )}
                    {isAccepted && !isApproval && (
                      <span className="wf-status-badge confirmed">
                        ✓ Confirmed
                      </span>
                    )}
                  </div>

                  <div className="project-breadcrumb-row">
                    <Link to={`/projects/${item.project_id}`} className="project-link-badge">
                      <FolderKanban size={13} />
                      <span>{item.project_title || 'Project Workspace'}</span>
                    </Link>

                    {item.client_name && (
                      <span className="client-chip">
                        <User size={11} /> {item.client_name}
                      </span>
                    )}

                    {item.invoice_items && item.invoice_items.length > 0 && isManagerRole && (
                      <span className="invoice-items-chip">
                        <Receipt size={11} /> {item.invoice_items.map(i => i.description).join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Submitted Deliverable Banner */}
                {(item.deliverable_url || item.deliverable_name) && (
                  <div className="deliverable-banner-card">
                    <div className="banner-left">
                      <span className="banner-label">Submitted Package</span>
                      <span className="banner-name">{item.deliverable_name || 'Production Output'}</span>
                    </div>
                    <a 
                      href={item.deliverable_url?.startsWith('http') ? item.deliverable_url : `${item.deliverable_url}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="view-deliverable-btn"
                    >
                      <span>Open Link</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Task Details / Description */}
                {item.description && (
                  <div className="card-scope-box">
                    <span className="scope-label">Milestone Scope:</span>
                    <p className="scope-text">{item.description}</p>
                  </div>
                )}

                {/* Reassignment / Feedback To-Dos */}
                {(() => {
                  const todosList = (item.reject_todos && item.reject_todos !== '0' && item.reject_todos !== 0) 
                    ? item.reject_todos 
                    : ((item.reassign_todos && item.reassign_todos !== '0' && item.reassign_todos !== 0) ? item.reassign_todos : null);
                  if (!todosList) return null;
                  let parsedTodos = [];
                  try {
                    parsedTodos = typeof todosList === 'string' ? JSON.parse(todosList) : todosList;
                  } catch (e) {
                    if (typeof todosList === 'string') parsedTodos = [{ text: todosList }];
                  }
                  
                  if (Array.isArray(parsedTodos) && parsedTodos.length > 0) {
                    return (
                      <div className="reassignment-feedback-box">
                        <span className="feedback-title">⚠️ Reassignment Feedback & Changes:</span>
                        <ul className="feedback-list">
                          {parsedTodos.map((todo, idx) => (
                            <li key={idx}>
                              <span>{todo.text || todo}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Deadline Comparison Block */}
                {!isApproval && (
                  <div className="deadline-comparison-card">
                    <div className="date-block">
                      <span className="date-block-label">Target Step Deadline</span>
                      <div className="date-block-row">
                        <Clock size={13} style={{ color: dueStatus.color }} />
                        <span className="date-val">
                          {item.original_deadline ? new Date(item.original_deadline).toLocaleDateString('en-GB') : 'No Date Set'}
                        </span>
                      </div>
                    </div>

                    {isAppealed && (
                      <>
                        <ArrowRight size={16} className="arrow-divider" />
                        <div className="date-block proposed">
                          <span className="date-block-label">Proposed Extension</span>
                          <span className="date-val proposed">
                            {item.proposed_deadline ? new Date(item.proposed_deadline).toLocaleDateString('en-GB') : 'N/A'}
                          </span>
                        </div>
                      </>
                    )}

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
                )}

                {/* Reason for Appeal Box */}
                {isAppealed && item.appeal_reason && (
                  <div className="appeal-justification-box">
                    <span className="justification-title">💬 Justification for Extension:</span>
                    <p className="justification-text">{item.appeal_reason}</p>
                  </div>
                )}

                {/* Direct Set Date Inline Input */}
                {editingDateStepId === item.step_id && (
                  <div className="inline-set-date-box">
                    <input 
                      type="date"
                      value={editingDateValue}
                      onChange={(e) => setEditingDateValue(e.target.value)}
                      className="date-input"
                    />
                    <button 
                      type="button" 
                      className="action-btn primary-add-btn small"
                      onClick={() => handleSaveDirectDate(item.step_id)}
                      disabled={processingId === item.step_id}
                    >
                      Save
                    </button>
                    <button 
                      type="button" 
                      className="action-btn secondary-btn small"
                      onClick={() => setEditingDateStepId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Card Action Footer */}
                <div className="card-actions-footer">
                  {/* Approval Actions (For Managers/Admins in Approval Tab) */}
                  {isApproval && isManagerRole && (
                    <>
                      <button 
                        type="button"
                        className="btn-approve-action"
                        disabled={processingId === item.step_id}
                        onClick={() => handleApproveTask(item.step_id, item.project_id)}
                        title="Approve deliverable and mark milestone as completed"
                      >
                        <CheckCircle2 size={15} />
                        <span>Approve Deliverable</span>
                      </button>

                      <button 
                        type="button"
                        className="btn-reject-action"
                        disabled={processingId === item.step_id}
                        onClick={() => handleOpenRevisionModal(item)}
                        title="Return deliverable with revision instructions"
                      >
                        <XCircle size={15} />
                        <span>Request Revision</span>
                      </button>
                    </>
                  )}

                  {/* Extension Appeal Review Actions (For Managers/Admins) */}
                  {isAppealed && isManagerRole && (
                    <>
                      <button 
                        type="button"
                        className="btn-approve-action"
                        disabled={processingId === item.step_id}
                        onClick={() => handleReviewAppeal(item.step_id, 'Approve')}
                        title="Approve extension and update deadline"
                      >
                        <CheckCircle2 size={15} />
                        <span>Approve Extension</span>
                      </button>

                      <button 
                        type="button"
                        className="btn-reject-action"
                        disabled={processingId === item.step_id}
                        onClick={() => handleReviewAppeal(item.step_id, 'Reject')}
                        title="Reject appeal and keep original target date"
                      >
                        <XCircle size={15} />
                        <span>Keep Original</span>
                      </button>
                    </>
                  )}

                  {/* Specialist Pending Acceptance Actions */}
                  {isPending && !isApproval && (
                    <>
                      <button 
                        type="button"
                        className="btn-confirm-action"
                        disabled={processingId === item.step_id}
                        onClick={() => handleConfirmDeadline(item.step_id)}
                        title="Confirm and accept this target deadline (Auto-accepts after 2 hours of inactivity)"
                      >
                        <Check size={14} />
                        <span>Accept Deadline</span>
                      </button>

                      <button 
                        type="button"
                        className="btn-appeal-action"
                        onClick={() => handleOpenAppealModal(item)}
                        title="Appeal for an extension with reason"
                      >
                        <Clock size={14} />
                        <span>Appeal</span>
                      </button>
                    </>
                  )}

                  {/* Confirmed State Actions */}
                  {isAccepted && !isApproval && (
                    <button 
                      type="button"
                      className="btn-appeal-action"
                      onClick={() => handleOpenAppealModal(item)}
                      title="Request an extension if timeline slipped"
                    >
                      <Clock size={14} />
                      <span>Request Extension</span>
                    </button>
                  )}

                  {/* Admin/PM Set Date Override */}
                  {isManagerRole && (
                    <button 
                      type="button"
                      className="action-btn secondary-btn small"
                      onClick={() => {
                        setEditingDateStepId(item.step_id);
                        setEditingDateValue(item.original_deadline ? item.original_deadline.split('T')[0] : '');
                      }}
                      title="Directly set milestone deadline"
                    >
                      <Edit3 size={13} />
                      <span>Set Date</span>
                    </button>
                  )}

                  {/* Workspace Link */}
                  <button 
                    type="button"
                    className="action-btn secondary-btn small"
                    onClick={() => navigate(`/projects/${item.project_id}`)}
                    title="Open project details"
                  >
                    <ExternalLink size={13} />
                    <span>Workspace</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Enterprise High-Density Table View */
        <div className="deadline-table-card">
          <div className="table-responsive">
            <table className="enterprise-deadline-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '1.25rem', width: '26%' }}>Milestone & Scope</th>
                  <th style={{ width: '18%' }}>Project & Client</th>
                  <th style={{ width: '14%' }}>Assignee</th>
                  <th style={{ width: '14%' }}>Target Deadline</th>
                  <th style={{ width: '14%' }}>Proposed / Urgency</th>
                  <th style={{ width: '14%' }}>Status</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.25rem', width: '18%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const isAppealed = item.deadline_status === 'Appealed';
                  const isPending = item.deadline_status === 'Pending Acceptance' || !item.deadline_status;
                  const isAccepted = item.deadline_status === 'Accepted';
                  const isApproval = item.step_status === 'Pending Approval';
                  const dueStatus = getProjectDueDateStatus(item.original_deadline, item.step_status);

                  return (
                    <tr key={item.step_id} className="deadline-table-row">
                      {/* Milestone Title */}
                      <td style={{ paddingLeft: '1.25rem' }}>
                        <div className="table-step-info">
                          <span 
                            className="table-step-title" 
                            onClick={() => navigate(`/projects/${item.project_id}`)}
                          >
                            {item.step_title}
                          </span>
                          <span className="table-step-id">#{item.step_id}</span>
                        </div>
                      </td>

                      {/* Project & Client */}
                      <td>
                        <div className="table-project-col">
                          <Link to={`/projects/${item.project_id}`} className="table-proj-link">
                            <FolderKanban size={13} />
                            <span>{item.project_title || 'Project'}</span>
                          </Link>
                          {item.client_name && (
                            <span className="table-client-name">{item.client_name}</span>
                          )}
                        </div>
                      </td>

                      {/* Assignee */}
                      <td>
                        <div className="table-assignee-col">
                          <span className="assignee-name">{item.employee_name || 'Unassigned'}</span>
                          <span className="assignee-role">{item.employee_role || 'Staff'}</span>
                        </div>
                      </td>

                      {/* Target Deadline */}
                      <td>
                        <div className="table-deadline-col">
                          <div className="date-row">
                            <Clock size={12} style={{ color: dueStatus.color }} />
                            <span>{item.original_deadline ? new Date(item.original_deadline).toLocaleDateString('en-GB') : '-'}</span>
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

                      {/* Proposed / Extra */}
                      <td>
                        {isAppealed ? (
                          <div className="table-proposed-col">
                            <span className="proposed-date">
                              {item.proposed_deadline ? new Date(item.proposed_deadline).toLocaleDateString('en-GB') : '-'}
                            </span>
                            {item.appeal_reason && (
                              <span className="proposed-reason-snippet" title={item.appeal_reason}>
                                {item.appeal_reason.slice(0, 30)}...
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>

                      {/* Workflow Status */}
                      <td>
                        {isApproval ? (
                          <span className="wf-status-badge approval">In Review</span>
                        ) : isAppealed ? (
                          <span className="wf-status-badge appealed">Appealed</span>
                        ) : isAccepted ? (
                          <span className="wf-status-badge confirmed">Confirmed</span>
                        ) : (
                          <span className="wf-status-badge pending">Pending</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                        <div className="table-actions-row">
                          {isApproval && isManagerRole && (
                            <>
                              <button 
                                type="button" 
                                className="row-action-btn approve"
                                onClick={() => handleApproveTask(item.step_id, item.project_id)}
                                title="Approve Task Deliverable"
                              >
                                <CheckCircle2 size={13} />
                              </button>
                              <button 
                                type="button" 
                                className="row-action-btn reject"
                                onClick={() => handleOpenRevisionModal(item)}
                                title="Request Revision"
                              >
                                <XCircle size={13} />
                              </button>
                            </>
                          )}

                          {isAppealed && isManagerRole && (
                            <>
                              <button 
                                type="button" 
                                className="row-action-btn approve"
                                onClick={() => handleReviewAppeal(item.step_id, 'Approve')}
                                title="Approve Extension Appeal"
                              >
                                <CheckCircle2 size={13} />
                              </button>
                              <button 
                                type="button" 
                                className="row-action-btn reject"
                                onClick={() => handleReviewAppeal(item.step_id, 'Reject')}
                                title="Keep Original Date"
                              >
                                <XCircle size={13} />
                              </button>
                            </>
                          )}

                          {isPending && !isApproval && (
                            <button 
                              type="button" 
                              className="btn-confirm-action micro"
                              onClick={() => handleConfirmDeadline(item.step_id)}
                              title="Accept Deadline"
                            >
                              <Check size={12} /> Accept
                            </button>
                          )}

                          <button 
                            type="button" 
                            className="row-action-btn view"
                            onClick={() => navigate(`/projects/${item.project_id}`)}
                            title="View Project Workspace"
                          >
                            <ExternalLink size={13} />
                          </button>
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

      {/* 6. Senior-Level Extension Appeal Modal */}
      {appealModalStep && (
        <div className="modal-overlay" onClick={() => setAppealModalStep(null)}>
          <div className="modal-content deadline-appeal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>Appeal Milestone Deadline</h2>
                <p>Request an extension with a proposed completion date and business justification</p>
              </div>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setAppealModalStep(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitAppeal} className="appeal-modal-form">
              <div className="appeal-summary-banner">
                <span className="banner-step-title">{appealModalStep.step_title}</span>
                <span className="banner-current-date">
                  Current Target: {appealModalStep.original_deadline ? new Date(appealModalStep.original_deadline).toLocaleDateString('en-GB') : 'Unspecified'}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Proposed New Deadline Date <span className="req-star">*</span>
                </label>
                <input 
                  type="date"
                  required
                  value={appealForm.proposed_deadline ? appealForm.proposed_deadline.split('T')[0] : ''}
                  onChange={(e) => setAppealForm({ ...appealForm, proposed_deadline: e.target.value })}
                  className="form-input"
                />

                {/* Quick Add Presets */}
                <div className="quick-add-row">
                  <span className="quick-add-label">Quick Add:</span>
                  <button 
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      const base = appealModalStep?.original_deadline ? new Date(appealModalStep.original_deadline) : new Date();
                      base.setDate(base.getDate() + 2);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                  >
                    + 2 Days
                  </button>
                  <button 
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      const base = appealModalStep?.original_deadline ? new Date(appealModalStep.original_deadline) : new Date();
                      base.setDate(base.getDate() + 5);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                  >
                    + 5 Days
                  </button>
                  <button 
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      const base = appealModalStep?.original_deadline ? new Date(appealModalStep.original_deadline) : new Date();
                      base.setDate(base.getDate() + 7);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                  >
                    + 1 Week
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Reason / Justification for Appeal <span className="req-star">*</span>
                </label>
                <textarea 
                  required
                  rows="3"
                  value={appealForm.reason}
                  onChange={(e) => setAppealForm({ ...appealForm, reason: e.target.value })}
                  placeholder="Explain why extra time is required (e.g. Awaiting client assets, extra revision cycle needed)..."
                  className="form-textarea"
                />
              </div>

              <div className="modal-footer-actions">
                <button 
                  type="button"
                  className="action-btn secondary-btn"
                  onClick={() => setAppealModalStep(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="action-btn primary-add-btn"
                  disabled={submittingAppeal}
                >
                  {submittingAppeal ? (
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

      {/* 7. Senior-Level Rejection / Revision Request Modal */}
      {revisionModal.isOpen && (
        <div className="modal-overlay" onClick={() => setRevisionModal({ isOpen: false, stepId: null, projectId: null, stepTitle: '', feedback: '' })}>
          <div className="modal-content deadline-revision-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h2>Request Deliverable Revision</h2>
                <p>Provide actionable feedback for the production specialist to implement</p>
              </div>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setRevisionModal({ isOpen: false, stepId: null, projectId: null, stepTitle: '', feedback: '' })}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitRevision} className="revision-modal-form">
              <div className="revision-step-banner">
                <span className="banner-label">Target Milestone</span>
                <h4 className="banner-title">{revisionModal.stepTitle}</h4>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Revision Feedback & Required Corrections <span className="req-star">*</span>
                </label>
                <textarea 
                  required
                  rows="4"
                  value={revisionModal.feedback}
                  onChange={(e) => setRevisionModal({ ...revisionModal, feedback: e.target.value })}
                  placeholder="Describe specific changes needed (e.g. Correct font formatting, recalculate line items, re-export in high-res)..."
                  className="form-textarea"
                />
                <span className="field-hint">This note will be delivered to the specialist's portal and WhatsApp notification feed.</span>
              </div>

              <div className="modal-footer-actions">
                <button 
                  type="button"
                  className="action-btn secondary-btn"
                  onClick={() => setRevisionModal({ isOpen: false, stepId: null, projectId: null, stepTitle: '', feedback: '' })}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="action-btn reject-submit-btn"
                  disabled={processingId === revisionModal.stepId}
                >
                  {processingId === revisionModal.stepId ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Sending Revisions...</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={15} />
                      <span>Request Revision & Return</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
