import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, AlertTriangle, Clock, FolderKanban, Plus, Trash2, 
  ExternalLink, Upload, ArrowRight, ShieldAlert, FileText, CheckSquare, 
  Layers, Search, Filter, RotateCcw, LayoutGrid, ListFilter, MessageSquare, 
  Check, Calendar, Paperclip, ChevronDown, ChevronUp, Sparkles, User, 
  Briefcase, Send, X, FileCheck
} from 'lucide-react';
import StepInhouseChat from '../components/StepInhouseChat';
import './ProductionPortal.css';
import './Modal.css';

export default function ProductionPortal() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // View mode: 'table' (High-density Step Matrix) vs 'cards' (Project Kanban Cards)
  const [viewMode, setViewMode] = useState('table');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [urgencyFilter, setUrgencyFilter] = useState('All');
  const [kpiFilter, setKpiFilter] = useState('All'); // Clickable KPI card filtering

  // Interactive To-Do Checklist State
  const [todoList, setTodoList] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [todoFilter, setTodoFilter] = useState('all');

  // Expanded rows in table view to see description/revision details
  const [expandedStepIds, setExpandedStepIds] = useState(new Set());

  // In-house Chat Modal State
  const [chatModal, setChatModal] = useState({ isOpen: false, stepId: null, stepTitle: '', projectId: null, projectTitle: '' });

  // Step Deliverable Submission Modal State
  const [submitModal, setSubmitModal] = useState({ 
    isOpen: false, 
    projectId: null, 
    stepId: null, 
    projectName: '', 
    stepTitle: '' 
  });
  const [deliverableName, setDeliverableName] = useState('');
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [deliverableFile, setDeliverableFile] = useState(null);
  const [submittingDeliverable, setSubmittingDeliverable] = useState(false);

  // Project-Level Final Delivery Modal State
  const [projectDeliveryModal, setProjectDeliveryModal] = useState({ isOpen: false, project: null });
  const [projectDeliveryForm, setProjectDeliveryForm] = useState({ file_name: '', file_url: '', notes: '' });
  const [submittingProjectDelivery, setSubmittingProjectDelivery] = useState(false);

  // Deadline Appeal Modal State
  const [appealModalStep, setAppealModalStep] = useState(null);
  const [appealForm, setAppealForm] = useState({ proposed_deadline: '', reason: '' });
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  // Top Ribbon Alert State
  const [isRibbonDismissed, setIsRibbonDismissed] = useState(false);
  const [batchAccepting, setBatchAccepting] = useState(false);

  const navigate = useNavigate();
  const currentUser = useMemo(() => {
    return JSON.parse(localStorage.getItem('user') || '{}');
  }, []);

  const isAdminOrPM = currentUser.role === 'Admin' || currentUser.role === 'Project Manager';

  useEffect(() => {
    fetchProjects();
    loadTodoList();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      let url = '/api/projects';
      if (currentUser && currentUser.id) {
        url += `?user_id=${currentUser.id}&role=${encodeURIComponent(currentUser.role || 'Production')}`;
      }
      const res = await axios.get(url);
      setProjects(res.data || []);
    } catch (e) {
      console.error('Failed to fetch projects', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchProjects();
  };

  // --- To-Do Checklist Handlers ---
  const loadTodoList = () => {
    const key = `prod_todos_${currentUser.id || 'guest'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setTodoList(JSON.parse(saved));
        return;
      } catch (e) { console.error(e); }
    }
    const initial = [
      { id: 1, text: 'Review briefing & creative assets', completed: true },
      { id: 2, text: 'Execute assigned project step deliverables', completed: false },
      { id: 3, text: 'Perform export QA & submit deliverable proof', completed: false }
    ];
    setTodoList(initial);
    localStorage.setItem(key, JSON.stringify(initial));
  };

  const saveTodoList = (updated) => {
    setTodoList(updated);
    const key = `prod_todos_${currentUser.id || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    const newItem = {
      id: Date.now(),
      text: newTodoText.trim(),
      completed: false
    };
    const updated = [newItem, ...todoList];
    saveTodoList(updated);
    setNewTodoText('');
  };

  const handleToggleTodo = (id) => {
    const updated = todoList.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    saveTodoList(updated);
  };

  const handleDeleteTodo = (id) => {
    const updated = todoList.filter(item => item.id !== id);
    saveTodoList(updated);
  };

  const handleClearCompletedTodos = () => {
    const updated = todoList.filter(item => !item.completed);
    saveTodoList(updated);
  };

  // --- Step Workflow Actions ---
  const handleAcceptDeadline = async (projectId, stepId) => {
    try {
      await axios.post(`/api/projects/${projectId}/steps/${stepId}/accept-deadline`, {
        user_id: currentUser.id
      });
      fetchProjects();
    } catch (e) {
      console.error('Failed to accept deadline', e);
      alert('Failed to accept deadline: ' + (e.response?.data?.error || e.message));
    }
  };

  // 1-Click Quick Batch Accept All Pending Deadlines from Ribbon
  const handleQuickAcceptAllPending = async () => {
    const pendingSteps = allProductionSteps.filter(s => 
      s.status !== 'Completed' && (!s.deadline_status || s.deadline_status === 'Pending Acceptance' || s.deadline_status === 'Rejected')
    );
    if (pendingSteps.length === 0) return;
    if (!window.confirm(`Are you sure you want to accept all ${pendingSteps.length} pending milestone deadline(s)?`)) return;

    setBatchAccepting(true);
    try {
      await Promise.all(
        pendingSteps.map(s => 
          axios.post(`/api/projects/${s.project_id}/steps/${s.id}/accept-deadline`, {
            user_id: currentUser.id
          }).catch(err => console.error(`Failed to accept step ${s.id}`, err))
        )
      );
      fetchProjects();
    } catch (e) {
      console.error('Failed to batch accept deadlines', e);
      alert('Failed to batch accept deadlines: ' + (e.response?.data?.error || e.message));
    } finally {
      setBatchAccepting(false);
    }
  };

  const handleOpenAppealModal = (project, step) => {
    setAppealModalStep({
      project_id: project.id,
      step_id: step.id,
      step_title: step.title,
      project_title: project.title,
      current_deadline: step.deadline
    });
    setAppealForm({
      proposed_deadline: step.deadline ? step.deadline.split('T')[0] : '',
      reason: step.deadline_appeal_reason || ''
    });
  };

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
      setAppealModalStep(null);
      fetchProjects();
    } catch (e) {
      console.error('Failed to submit appeal', e);
      alert('Failed to submit deadline appeal: ' + (e.response?.data?.error || e.message));
    } finally {
      setSubmittingAppeal(false);
    }
  };

  // Step-level deliverable submission (marks Pending Approval)
  const openStepSubmitModal = (projectId, projectName, step) => {
    setSubmitModal({
      isOpen: true,
      projectId,
      stepId: step.id,
      projectName,
      stepTitle: step.title
    });
    setDeliverableName(step.deliverable_name || `${projectName} - ${step.title} Package`);
    setDeliverableUrl(step.deliverable_url || '');
    setDeliverableFile(null);
  };

  const handleStepDeliverableSubmit = async (e) => {
    e.preventDefault();
    if (!deliverableName.trim() || (!deliverableUrl.trim() && !deliverableFile)) {
      alert("Please provide a deliverable package name and either a file upload or download link.");
      return;
    }
    setSubmittingDeliverable(true);
    try {
      let finalUrl = deliverableUrl.trim();

      // If user provided a local file, upload it first
      if (deliverableFile) {
        const formData = new FormData();
        formData.append('documents', deliverableFile);
        const uploadRes = await axios.post(`/api/projects/${submitModal.projectId}/steps/${submitModal.stepId}/documents`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (uploadRes.data?.paths && uploadRes.data.paths[0]) {
          finalUrl = uploadRes.data.paths[0];
        }
      }

      await axios.put(`/api/projects/${submitModal.projectId}/steps/${submitModal.stepId}`, {
        status: 'Pending Approval',
        deliverable_name: deliverableName.trim(),
        deliverable_url: finalUrl
      });

      setSubmitModal({ isOpen: false, projectId: null, stepId: null, projectName: '', stepTitle: '' });
      fetchProjects();
    } catch (error) {
      console.error('Failed to submit step deliverable', error);
      alert('Failed to submit deliverable: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmittingDeliverable(false);
    }
  };

  // Project-level delivery submission
  const openProjectDeliveryModal = (project) => {
    setProjectDeliveryModal({ isOpen: true, project });
    setProjectDeliveryForm({
      file_name: `${project.title} - Final Delivery`,
      file_url: '',
      notes: ''
    });
  };

  const handleProjectDeliverySubmit = async (e) => {
    e.preventDefault();
    if (!projectDeliveryModal.project || !projectDeliveryForm.file_url) {
      alert('Please provide a valid deliverable download URL.');
      return;
    }
    setSubmittingProjectDelivery(true);
    try {
      await axios.post(`/api/projects/${projectDeliveryModal.project.id}/submit-delivery`, {
        user_id: currentUser.id || 1,
        file_url: projectDeliveryForm.file_url,
        file_name: projectDeliveryForm.file_name || 'Final Project Deliverables'
      });
      setProjectDeliveryModal({ isOpen: false, project: null });
      fetchProjects();
    } catch (e) {
      console.error('Failed to submit project delivery', e);
      alert('Failed to submit delivery: ' + (e.response?.data?.error || e.message));
    } finally {
      setSubmittingProjectDelivery(false);
    }
  };

  // Toggle table row expansion
  const toggleStepExpansion = (stepId) => {
    setExpandedStepIds(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  // Deadline calculation utility
  const getDeadlineInfo = (deadlineStr) => {
    if (!deadlineStr) return { isOverdue: false, isSoon: false, isToday: false, label: 'No Deadline', daysDiff: null };
    const due = new Date(deadlineStr);
    const now = new Date();
    // Normalize both to start of day for comparison
    const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = dueDate - nowDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { 
        isOverdue: true, 
        isSoon: false, 
        isToday: false, 
        daysDiff: diffDays,
        label: `Overdue by ${Math.abs(diffDays)}d` 
      };
    } else if (diffDays === 0) {
      return { 
        isOverdue: false, 
        isSoon: true, 
        isToday: true, 
        daysDiff: 0,
        label: 'Due Today!' 
      };
    } else if (diffDays <= 3) {
      return { 
        isOverdue: false, 
        isSoon: true, 
        isToday: false, 
        daysDiff: diffDays,
        label: `Due in ${diffDays}d` 
      };
    } else {
      return { 
        isOverdue: false, 
        isSoon: false, 
        isToday: false, 
        daysDiff: diffDays,
        label: `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` 
      };
    }
  };

  // Relevant projects for the current user
  const relevantProjects = useMemo(() => {
    if (isAdminOrPM) return projects;
    return projects.filter(p => {
      const hasSteps = (p.user_assigned_steps && p.user_assigned_steps.length > 0);
      const isLead = (p.production_id === currentUser.id);
      return hasSteps || isLead;
    });
  }, [projects, isAdminOrPM, currentUser]);

  // Flattened steps list for the Enterprise Task Matrix Table
  const allProductionSteps = useMemo(() => {
    return relevantProjects.flatMap(project => {
      const stepsList = isAdminOrPM ? (project.steps || []) : (project.user_assigned_steps || []);
      return stepsList.map(step => {
        const hasRevision = Boolean(
          (step.reject_todos && step.reject_todos !== '0' && step.reject_todos !== 0) ||
          (step.reassign_todos && step.reassign_todos !== '0' && step.reassign_todos !== 0) ||
          step.status === 'Revision Requested'
        );
        const deadlineInfo = getDeadlineInfo(step.deadline);
        return {
          ...step,
          project_id: project.id,
          project_title: project.title,
          project_status: project.status,
          client_name: project.client_name,
          service_type: project.service_type,
          project_deadline: project.locked_deadline || project.due_date,
          assigned_members: project.assigned_members,
          deadlineInfo,
          hasRevision
        };
      });
    });
  }, [relevantProjects, isAdminOrPM]);

  // Metric Calculations
  const metrics = useMemo(() => {
    const totalProjects = relevantProjects.length;
    const activeProjects = relevantProjects.filter(p => p.status !== 'Completed' && p.status !== 'Commission Released').length;
    const activeSteps = allProductionSteps.filter(s => s.status !== 'Completed').length;
    const pendingAcceptance = allProductionSteps.filter(s => 
      s.status !== 'Completed' && (!s.deadline_status || s.deadline_status === 'Pending Acceptance' || s.deadline_status === 'Rejected')
    ).length;
    const appealedSteps = allProductionSteps.filter(s => s.status !== 'Completed' && s.deadline_status === 'Appealed').length;
    const revisionsNeeded = allProductionSteps.filter(s => s.hasRevision && s.status !== 'Completed').length;
    const underReview = allProductionSteps.filter(s => s.status === 'Pending Approval').length;
    const completedSteps = allProductionSteps.filter(s => s.status === 'Completed').length;
    
    // Urgent tasks (overdue or due in <= 3 days)
    const urgentSteps = allProductionSteps.filter(s => s.status !== 'Completed' && (s.deadlineInfo.isOverdue || s.deadlineInfo.isSoon));

    return {
      totalProjects,
      activeProjects,
      activeSteps,
      pendingAcceptance,
      appealedSteps,
      revisionsNeeded,
      underReview,
      completedSteps,
      urgentSteps
    };
  }, [relevantProjects, allProductionSteps]);

  // Quick 1-click filter from KPI cards
  const handleKpiCardClick = (filterKey) => {
    if (kpiFilter === filterKey) {
      setKpiFilter('All');
      setStatusFilter('All');
      setUrgencyFilter('All');
    } else {
      setKpiFilter(filterKey);
      if (filterKey === 'active_projects') {
        setStatusFilter('Active');
        setUrgencyFilter('All');
      } else if (filterKey === 'active_steps') {
        setStatusFilter('In Progress');
        setUrgencyFilter('All');
      } else if (filterKey === 'pending_acceptance') {
        setStatusFilter('Pending Acceptance');
        setUrgencyFilter('All');
      } else if (filterKey === 'revisions') {
        setStatusFilter('Revision Required');
        setUrgencyFilter('All');
      } else if (filterKey === 'under_review') {
        setStatusFilter('Pending Approval');
        setUrgencyFilter('All');
      } else if (filterKey === 'completed') {
        setStatusFilter('Completed');
        setUrgencyFilter('All');
      }
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setUrgencyFilter('All');
    setKpiFilter('All');
  };

  // Filtered steps for the Matrix Table view
  const filteredSteps = useMemo(() => {
    return allProductionSteps.filter(step => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = step.title?.toLowerCase().includes(q);
        const matchesProject = step.project_title?.toLowerCase().includes(q);
        const matchesClient = step.client_name?.toLowerCase().includes(q);
        const matchesService = step.service_type?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesProject && !matchesClient && !matchesService) return false;
      }

      // Status filter
      if (statusFilter === 'Pending Acceptance') {
        if (step.status === 'Completed') return false;
        if (step.deadline_status === 'Accepted') return false;
      } else if (statusFilter === 'In Progress') {
        if (step.status === 'Completed' || step.status === 'Pending Approval') return false;
      } else if (statusFilter === 'Pending Approval') {
        if (step.status !== 'Pending Approval') return false;
      } else if (statusFilter === 'Revision Required') {
        if (!step.hasRevision) return false;
      } else if (statusFilter === 'Completed') {
        if (step.status !== 'Completed') return false;
      }

      // Urgency filter
      if (urgencyFilter === 'Overdue' && !step.deadlineInfo.isOverdue) return false;
      if (urgencyFilter === 'Due Today' && !step.deadlineInfo.isToday) return false;
      if (urgencyFilter === 'Due Soon' && !step.deadlineInfo.isSoon) return false;

      return true;
    });
  }, [allProductionSteps, searchQuery, statusFilter, urgencyFilter]);

  // Filtered projects for the Kanban Cards view
  const filteredProjects = useMemo(() => {
    return relevantProjects.filter(p => {
      const isComp = p.status === 'Completed' || p.status === 'Commission Released';
      if (statusFilter === 'Active' && isComp) return false;
      if (statusFilter === 'Completed' && !isComp) return false;

      const projectSteps = isAdminOrPM ? (p.steps || []) : (p.user_assigned_steps || []);

      if (statusFilter === 'Pending Acceptance') {
        const hasPending = projectSteps.some(s => !s.deadline_status || s.deadline_status === 'Pending Acceptance');
        if (!hasPending) return false;
      }
      if (statusFilter === 'Pending Approval') {
        const hasApproval = projectSteps.some(s => s.status === 'Pending Approval');
        if (!hasApproval) return false;
      }
      if (statusFilter === 'Revision Required') {
        const hasRev = projectSteps.some(s => (s.reject_todos && s.reject_todos !== '0') || (s.reassign_todos && s.reassign_todos !== '0'));
        if (!hasRev) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title?.toLowerCase().includes(q);
        const matchesClient = p.client_name?.toLowerCase().includes(q);
        const matchesService = p.service_type?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesClient && !matchesService) return false;
      }

      const pDl = getDeadlineInfo(p.locked_deadline);
      if (urgencyFilter === 'Overdue' && !pDl.isOverdue) return false;
      if (urgencyFilter === 'Due Today' && !pDl.isToday) return false;
      if (urgencyFilter === 'Due Soon' && !pDl.isSoon) return false;

      return true;
    });
  }, [relevantProjects, statusFilter, urgencyFilter, searchQuery, isAdminOrPM]);

  // Filtered to-dos
  const filteredTodos = useMemo(() => {
    if (todoFilter === 'active') return todoList.filter(t => !t.completed);
    if (todoFilter === 'completed') return todoList.filter(t => t.completed);
    return todoList;
  }, [todoList, todoFilter]);

  const todoCompletionPercent = todoList.length > 0 
    ? Math.round((todoList.filter(t => t.completed).length / todoList.length) * 100) 
    : 0;

  const hasPendingAlert = metrics.pendingAcceptance > 0 || metrics.appealedSteps > 0 || (isAdminOrPM && metrics.underReview > 0);

  return (
    <div className="prod-dashboard-container modern-ui">
      
      {/* Top Ribbon Alert: Deadline Approval & 2-Hour Acceptance Workflow */}
      {hasPendingAlert && !isRibbonDismissed && (
        <div className="prod-top-ribbon-alert">
          <div className="ribbon-left">
            <div className="ribbon-icon-container">
              <AlertTriangle size={18} />
              <span className="ribbon-ping-ring"></span>
            </div>
            <div className="ribbon-text-content">
              <div className="ribbon-title-row">
                <span className="ribbon-title">DEADLINE APPROVAL & ACCEPTANCE ALERT</span>
                <span className="ribbon-timer-badge">
                  <Clock size={12} /> 2-Hour Auto-Accept Window Active
                </span>
                {metrics.pendingAcceptance > 0 && (
                  <span className="ribbon-count-tag">{metrics.pendingAcceptance} Unconfirmed</span>
                )}
                {metrics.appealedSteps > 0 && (
                  <span className="ribbon-appealed-tag">{metrics.appealedSteps} Extension Appeals</span>
                )}
              </div>
              <p className="ribbon-desc">
                {metrics.pendingAcceptance > 0 ? (
                  <>
                    You have <strong>{metrics.pendingAcceptance} milestone deadline{metrics.pendingAcceptance !== 1 ? 's' : ''}</strong> awaiting confirmation. 
                    Deadlines automatically accept <strong>after 2 hours</strong> of inactivity. Please review and confirm or appeal before the timer expires.
                  </>
                ) : metrics.appealedSteps > 0 ? (
                  <>
                    {isAdminOrPM 
                      ? <><strong>{metrics.appealedSteps} deadline extension appeal(s)</strong> require your administrative review and approval.</>
                      : <><strong>{metrics.appealedSteps} milestone extension appeal(s)</strong> have been submitted and are currently under PM review.</>
                    }
                  </>
                ) : (
                  <>Deliverables are currently in review.</>
                )}
              </p>
            </div>
          </div>

          <div className="ribbon-actions">
            {metrics.pendingAcceptance > 0 && (
              <button 
                className="ribbon-btn primary"
                onClick={() => {
                  setKpiFilter('pending_acceptance');
                  setStatusFilter('Pending Acceptance');
                  setUrgencyFilter('All');
                }}
                title="Filter table to view all pending deadlines"
              >
                <ListFilter size={14} />
                <span>Review Deadlines ({metrics.pendingAcceptance})</span>
              </button>
            )}

            {metrics.pendingAcceptance > 0 && !isAdminOrPM && (
              <button 
                className="ribbon-btn success"
                onClick={handleQuickAcceptAllPending}
                disabled={batchAccepting}
                title="Confirm and accept all your pending milestone deadlines in 1 click"
              >
                <CheckCircle2 size={14} />
                <span>{batchAccepting ? 'Accepting...' : `Accept All (${metrics.pendingAcceptance})`}</span>
              </button>
            )}

            <button 
              className="ribbon-btn secondary"
              onClick={() => navigate('/deadlines')}
              title="Open full Deadline Workflow manager"
            >
              <ExternalLink size={14} />
              <span>Workflow</span>
            </button>

            <button 
              className="ribbon-close-btn"
              onClick={() => setIsRibbonDismissed(true)}
              title="Dismiss alert for this session"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 1. Page Header */}
      <div className="prod-page-header">
        <div className="header-title-area">
          <div className="header-badge-row">
            <h1 className="prod-main-heading">Production Command Center</h1>
            <span className="prod-role-badge">
              <Briefcase size={13} />
              {isAdminOrPM ? 'Admin / PM Oversight' : 'Production Specialist'}
            </span>
            <span className="prod-count-badge">
              {metrics.activeSteps} Active Task{metrics.activeSteps !== 1 ? 's' : ''}
            </span>
            {metrics.urgentSteps.length > 0 && (
              <span className="prod-urgent-pill">
                🔥 {metrics.urgentSteps.length} Urgent Deadlines
              </span>
            )}
          </div>
          <p className="prod-subheading">
            Triage assigned project steps, confirm or appeal deadlines, submit deliverables, and track client revisions in real time.
          </p>
        </div>

        {/* Header Action Toolbar */}
        <div className="prod-header-actions">
          {/* Restore Ribbon Pill (shown if user dismissed the ribbon but pending alerts exist) */}
          {hasPendingAlert && isRibbonDismissed && (
            <button 
              className="ribbon-restore-pill"
              onClick={() => setIsRibbonDismissed(false)}
              title="Show deadline approval alert ribbon"
            >
              <AlertTriangle size={13} />
              <span>{metrics.pendingAcceptance} Pending Deadlines (2h Timer)</span>
            </button>
          )}

          {/* Dual View Switcher */}
          <div className="view-mode-toggle" title="Switch between Table Matrix & Card Grid">
            <button 
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <ListFilter size={15} />
              <span>Task Matrix</span>
            </button>
            <button 
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid size={15} />
              <span>Project Cards</span>
            </button>
          </div>

          {/* Quick Refresh */}
          <button 
            className="action-btn secondary-btn"
            onClick={handleManualRefresh}
            title="Reload live production data"
          >
            <RotateCcw size={15} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Compact (~75px) KPI Metric Cards Row */}
      <div className="prod-kpi-grid">
        {/* Total Assigned Projects */}
        <div 
          className={`prod-kpi-card ${kpiFilter === 'active_projects' ? 'active' : ''}`}
          onClick={() => handleKpiCardClick('active_projects')}
          title="Click to filter active assigned projects"
        >
          <div className="kpi-icon-wrap total">
            <FolderKanban size={20} />
          </div>
          <div className="kpi-card-content">
            <span className="kpi-card-val">{metrics.activeProjects}</span>
            <span className="kpi-card-lbl">Assigned Projects</span>
          </div>
        </div>

        {/* Active Work Steps */}
        <div 
          className={`prod-kpi-card ${kpiFilter === 'active_steps' ? 'active' : ''}`}
          onClick={() => handleKpiCardClick('active_steps')}
          title="Click to filter active work steps"
        >
          <div className="kpi-icon-wrap active">
            <Layers size={20} />
          </div>
          <div className="kpi-card-content">
            <span className="kpi-card-val">{metrics.activeSteps}</span>
            <span className="kpi-card-lbl">Active Steps</span>
          </div>
        </div>

        {/* Pending Deadline Acceptance */}
        <div 
          className={`prod-kpi-card ${kpiFilter === 'pending_acceptance' ? 'active' : ''}`}
          onClick={() => handleKpiCardClick('pending_acceptance')}
          title="Click to filter steps awaiting deadline confirmation"
        >
          <div className="kpi-icon-wrap pending">
            <Clock size={20} />
          </div>
          <div className="kpi-card-content">
            <span className="kpi-card-val">{metrics.pendingAcceptance}</span>
            <span className="kpi-card-lbl">Pending Accept</span>
          </div>
        </div>

        {/* Revision Feedback Callouts */}
        <div 
          className={`prod-kpi-card ${kpiFilter === 'revisions' ? 'active' : ''}`}
          onClick={() => handleKpiCardClick('revisions')}
          title="Click to filter steps with client or PM revision feedback"
        >
          <div className="kpi-icon-wrap revisions">
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-card-content">
            <span className="kpi-card-val">{metrics.revisionsNeeded}</span>
            <span className="kpi-card-lbl">Feedback / Fixes</span>
          </div>
        </div>

        {/* Submitted for Review */}
        <div 
          className={`prod-kpi-card ${kpiFilter === 'under_review' ? 'active' : ''}`}
          onClick={() => handleKpiCardClick('under_review')}
          title="Click to filter steps currently under PM review"
        >
          <div className="kpi-icon-wrap review">
            <FileCheck size={20} />
          </div>
          <div className="kpi-card-content">
            <span className="kpi-card-val">{metrics.underReview}</span>
            <span className="kpi-card-lbl">Under Review</span>
          </div>
        </div>

        {/* Completed Steps */}
        <div 
          className={`prod-kpi-card ${kpiFilter === 'completed' ? 'active' : ''}`}
          onClick={() => handleKpiCardClick('completed')}
          title="Click to filter finished steps"
        >
          <div className="kpi-icon-wrap completed">
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-card-content">
            <span className="kpi-card-val">{metrics.completedSteps}</span>
            <span className="kpi-card-lbl">Completed</span>
          </div>
        </div>
      </div>

      {/* 3. Urgent Overdue / Due Soon Alert Banner */}
      {metrics.urgentSteps.length > 0 && (
        <div className="prod-urgent-banner">
          <div className="urgent-banner-icon">
            <ShieldAlert size={22} />
          </div>
          <div className="urgent-banner-content">
            <div className="urgent-banner-header">
              <strong>ATTENTION REQUIRED: {metrics.urgentSteps.length} Step{metrics.urgentSteps.length !== 1 ? 's' : ''} Require Urgent Production Action</strong>
              <span className="urgent-sub-text">Deadlines are due today, overdue, or due within 72 hours.</span>
            </div>
            <div className="urgent-banner-pills">
              {metrics.urgentSteps.slice(0, 4).map(step => (
                <div key={step.id} className="urgent-task-pill" onClick={() => {
                  setSearchQuery(step.title);
                  setViewMode('table');
                }}>
                  <span className="pill-title">{step.title}</span>
                  <span className="pill-proj">({step.project_title})</span>
                  <span className={`pill-badge ${step.deadlineInfo.isOverdue ? 'overdue' : 'soon'}`}>
                    {step.deadlineInfo.label}
                  </span>
                </div>
              ))}
              {metrics.urgentSteps.length > 4 && (
                <button 
                  className="urgent-see-all-btn"
                  onClick={() => { setUrgencyFilter('Overdue'); setViewMode('table'); }}
                >
                  +{metrics.urgentSteps.length - 4} More...
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Filter & Search Toolbar */}
      <div className="prod-toolbar-card">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text"
            className="search-input"
            placeholder="Search by step name, project title, client, or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-controls-group">
          {/* Status Dropdown */}
          <div className="select-wrapper">
            <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setKpiFilter('All'); }}
              className="toolbar-select"
            >
              <option value="All">All Step Statuses</option>
              <option value="Pending Acceptance">⏳ Pending Acceptance</option>
              <option value="In Progress">⚡ In Progress / Confirmed</option>
              <option value="Revision Required">⚠️ Revision Feedback</option>
              <option value="Pending Approval">🔍 Under Review</option>
              <option value="Completed">✅ Completed</option>
            </select>
          </div>

          {/* Urgency Dropdown */}
          <div className="select-wrapper">
            <select 
              value={urgencyFilter} 
              onChange={(e) => { setUrgencyFilter(e.target.value); }}
              className="toolbar-select"
            >
              <option value="All">All Deadlines</option>
              <option value="Overdue">🔥 Overdue</option>
              <option value="Due Today">⏰ Due Today</option>
              <option value="Due Soon">⚡ Due in 3 Days</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(searchQuery || statusFilter !== 'All' || urgencyFilter !== 'All' || kpiFilter !== 'All') && (
            <button className="reset-filter-btn" onClick={handleResetFilters} title="Reset all filters">
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Main Content Area: Workload Matrix / Cards + Side Daily Scratchpad */}
      <div className="prod-main-grid">
        
        {/* Left Column: Primary Work Area */}
        <div className="prod-work-column">
          
          {loading ? (
            <div className="prod-loading-box">
              <div className="spinner"></div>
              <span>Loading production command center...</span>
            </div>
          ) : viewMode === 'table' ? (
            
            /* VIEW MODE A: Enterprise Task Matrix Table */
            <div className="prod-table-card">
              <div className="table-header-info">
                <div className="table-title-wrap">
                  <h2 className="table-heading">Assigned Steps & Deadline Matrix</h2>
                  <span className="table-record-count">Showing {filteredSteps.length} of {allProductionSteps.length} Steps</span>
                </div>
              </div>

              {filteredSteps.length === 0 ? (
                <div className="prod-empty-state">
                  <FolderKanban size={44} className="empty-icon" />
                  <h3>No Production Steps Found</h3>
                  <p>No steps match the selected search or filter criteria.</p>
                  <button className="action-btn secondary-btn" onClick={handleResetFilters}>
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="table-responsive-wrapper">
                  <table className="prod-matrix-table">
                    <thead>
                      <tr>
                        <th style={{ width: '28%' }}>Step & Specifications</th>
                        <th style={{ width: '20%' }}>Project & Client</th>
                        <th style={{ width: '18%' }}>Deadline & Urgency</th>
                        <th style={{ width: '16%' }}>Deliverable Status</th>
                        <th style={{ width: '18%', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSteps.map((step) => {
                        const isExpanded = expandedStepIds.has(step.id);
                        const isAccepted = step.deadline_status === 'Accepted';
                        const isPendingAccept = !step.deadline_status || step.deadline_status === 'Pending Acceptance' || step.deadline_status === 'Rejected';
                        const isAppealed = step.deadline_status === 'Appealed';
                        const isUnderReview = step.status === 'Pending Approval';
                        const isCompleted = step.status === 'Completed';

                        // Parse revision todos if present
                        let revisionTodos = [];
                        const rawTodos = (step.reject_todos && step.reject_todos !== '0' && step.reject_todos !== 0) 
                          ? step.reject_todos 
                          : ((step.reassign_todos && step.reassign_todos !== '0' && step.reassign_todos !== 0) ? step.reassign_todos : null);
                        if (rawTodos) {
                          try {
                            revisionTodos = typeof rawTodos === 'string' ? JSON.parse(rawTodos) : rawTodos;
                          } catch (e) {}
                        }

                        return (
                          <React.Fragment key={step.id}>
                            <tr className={`step-row ${step.hasRevision ? 'has-revision-row' : ''} ${step.deadlineInfo.isOverdue && !isCompleted ? 'is-overdue-row' : ''}`}>
                              {/* Step & Specifications */}
                              <td>
                                <div className="step-main-cell">
                                  <div className="step-title-row">
                                    <span className="step-title-text">{step.title}</span>
                                    {step.hasRevision && (
                                      <span className="badge-revision-alert" title="Revision requested by client or PM">
                                        ⚠️ Revision
                                      </span>
                                    )}
                                    {step.description && (
                                      <button 
                                        className="btn-toggle-expand"
                                        onClick={() => toggleStepExpansion(step.id)}
                                        title="View full step instructions"
                                      >
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                      </button>
                                    )}
                                  </div>
                                  
                                  {step.description && !isExpanded && (
                                    <p className="step-snippet-desc">
                                      {step.description.length > 75 ? `${step.description.substring(0, 75)}...` : step.description}
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* Project & Client */}
                              <td>
                                <div className="proj-cell">
                                  <span 
                                    className="proj-title-link"
                                    onClick={() => navigate(`/projects/${step.project_id}`)}
                                    title="Open Project Details"
                                  >
                                    {step.project_title}
                                    <ExternalLink size={11} />
                                  </span>
                                  <div className="proj-meta-sub">
                                    <span>Client: <strong>{step.client_name || 'Direct'}</strong></span>
                                    {step.service_type && <span>· {step.service_type}</span>}
                                  </div>
                                </div>
                              </td>

                              {/* Deadline & Urgency */}
                              <td>
                                <div className="deadline-cell">
                                  <div className="deadline-primary-row">
                                    <Calendar size={13} className="text-slate-400" />
                                    <span className="deadline-date-val">
                                      {step.deadline ? new Date(step.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Target Set'}
                                    </span>
                                  </div>

                                  <div className="deadline-badge-wrap">
                                    {/* Relative countdown pill */}
                                    {step.deadline && !isCompleted && (
                                      <span className={`urgency-chip ${step.deadlineInfo.isOverdue ? 'overdue' : step.deadlineInfo.isSoon ? 'soon' : 'normal'}`}>
                                        {step.deadlineInfo.label}
                                      </span>
                                    )}

                                    {/* Acceptance state pill */}
                                    {isAccepted && (
                                      <span className="chip-accepted" title="Deadline accepted by production member">
                                        ✓ Confirmed
                                      </span>
                                    )}
                                    {isPendingAccept && (
                                      <span className="chip-pending-accept" title="Deadline awaiting production confirmation (Auto-accepts after 2 hours of inactivity)">
                                        ⏳ Unconfirmed
                                      </span>
                                    )}
                                    {isAppealed && (
                                      <span className="chip-appealed" title="Extension appeal submitted to PM">
                                        ⚠️ Appealed
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Deliverable Status */}
                              <td>
                                <div className="deliverable-cell">
                                  {isCompleted ? (
                                    <span className="status-badge completed">
                                      <CheckCircle2 size={13} /> Approved
                                    </span>
                                  ) : isUnderReview ? (
                                    <span className="status-badge review">
                                      <Clock size={13} /> Under Review
                                    </span>
                                  ) : (step.deliverable_name || step.deliverable_url) ? (
                                    <div className="submitted-file-pill">
                                      <Paperclip size={12} />
                                      <span className="file-name">{step.deliverable_name || 'Proof Link'}</span>
                                      {step.deliverable_url && (
                                        <a 
                                          href={step.deliverable_url.startsWith('http') ? step.deliverable_url : `https://${step.deliverable_url}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="link-icon"
                                          title="Open submitted deliverable file"
                                        >
                                          <ExternalLink size={12} />
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="status-badge pending">
                                      Pending Upload
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Actions */}
                              <td style={{ textAlign: 'right' }}>
                                <div className="action-buttons-group">
                                  
                                  {/* If deadline is unconfirmed, show Accept & Appeal */}
                                  {isPendingAccept && !isCompleted && (
                                    <>
                                      <button 
                                        className="btn-action btn-accept"
                                        onClick={() => handleAcceptDeadline(step.project_id, step.id)}
                                        title="Accept deadline commitment"
                                      >
                                        <Check size={14} /> Accept
                                      </button>
                                      <button 
                                        className="btn-action btn-appeal"
                                        onClick={() => handleOpenAppealModal({ id: step.project_id, title: step.project_title }, step)}
                                        title="Appeal for deadline extension"
                                      >
                                        Appeal
                                      </button>
                                    </>
                                  )}

                                  {/* If confirmed or appealed, can submit deliverable */}
                                  {(isAccepted || isAppealed) && !isCompleted && !isUnderReview && (
                                    <button 
                                      className="btn-action btn-submit-proof"
                                      onClick={() => openStepSubmitModal(step.project_id, step.project_title, step)}
                                      title="Submit deliverable file or link for review"
                                    >
                                      <Upload size={14} /> Submit Proof
                                    </button>
                                  )}

                                  {/* Internal Step Chat */}
                                  <button 
                                    className="btn-action btn-chat-icon"
                                    onClick={() => setChatModal({
                                      isOpen: true,
                                      stepId: step.id,
                                      stepTitle: step.title,
                                      projectId: step.project_id,
                                      projectTitle: step.project_title
                                    })}
                                    title="Open internal team chat for this step"
                                  >
                                    <MessageSquare size={14} />
                                  </button>

                                </div>
                              </td>
                            </tr>

                            {/* Expandable Row for Details & Revision To-Dos */}
                            {(isExpanded || (step.hasRevision && Array.isArray(revisionTodos) && revisionTodos.length > 0)) && (
                              <tr className="expanded-details-row">
                                <td colSpan="5">
                                  <div className="expanded-panel-body">
                                    
                                    {/* Description / Instructions */}
                                    {step.description && (
                                      <div className="spec-block">
                                        <span className="spec-label">STEP SPECIFICATIONS & INSTRUCTIONS:</span>
                                        <p className="spec-text">{step.description}</p>
                                      </div>
                                    )}

                                    {/* Revision Feedback Callout */}
                                    {Array.isArray(revisionTodos) && revisionTodos.length > 0 && (
                                      <div className="revision-feedback-box">
                                        <div className="revision-header">
                                          <AlertTriangle size={16} />
                                          <span>REVISION FEEDBACK & REQUIRED AMENDMENTS:</span>
                                        </div>
                                        <ul className="revision-items-list">
                                          {revisionTodos.map((todo, idx) => (
                                            <li key={idx} className="revision-item">
                                              <span className="revision-todo-text">{todo.text}</span>
                                              {todo.file_url && (
                                                <a 
                                                  href={`http://localhost:5000${todo.file_url}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="revision-file-attachment"
                                                >
                                                  <Paperclip size={12} /> Reference Attachment
                                                </a>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Submitted Deliverable Info if available */}
                                    {(step.deliverable_name || step.deliverable_url) && (
                                      <div className="submitted-proof-block">
                                        <span className="spec-label">CURRENTLY SUBMITTED PROOF:</span>
                                        <div className="proof-details-inline">
                                          <strong>{step.deliverable_name || 'Deliverable Package'}</strong>
                                          {step.deliverable_url && (
                                            <a 
                                              href={step.deliverable_url.startsWith('http') ? step.deliverable_url : `https://${step.deliverable_url}`} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="proof-link"
                                            >
                                              <ExternalLink size={13} /> {step.deliverable_url}
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          ) : (
            
            /* VIEW MODE B: Project Cards & Kanban Board */
            <div className="prod-cards-grid">
              {filteredProjects.length === 0 ? (
                <div className="prod-empty-state">
                  <FolderKanban size={44} className="empty-icon" />
                  <h3>No Projects Found</h3>
                  <p>No assigned projects match the selected filters.</p>
                  <button className="action-btn secondary-btn" onClick={handleResetFilters}>
                    Clear Filters
                  </button>
                </div>
              ) : (
                filteredProjects.map(project => {
                  const pSteps = isAdminOrPM ? (project.steps || []) : (project.user_assigned_steps || []);
                  const totalSteps = pSteps.length;
                  const completedSteps = pSteps.filter(s => s.status === 'Completed').length;
                  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                  const pDeadline = getDeadlineInfo(project.locked_deadline);
                  const isFinished = project.status === 'Completed' || project.status === 'Commission Released';

                  return (
                    <div key={project.id} className={`project-kanban-card ${isFinished ? 'is-completed' : ''}`}>
                      
                      {/* Card Header */}
                      <div className="card-top-bar">
                        <div className="card-title-group">
                          <h3 
                            className="card-project-title"
                            onClick={() => navigate(`/projects/${project.id}`)}
                            title="Click to view full project timeline"
                          >
                            {project.title}
                          </h3>
                          <div className="card-meta-row">
                            <span>Client: <strong>{project.client_name || 'Direct'}</strong></span>
                            <span>·</span>
                            <span>Service: <strong>{project.service_type || 'Custom'}</strong></span>
                          </div>
                        </div>

                        <div className="card-badge-group">
                          <span className={`status-pill ${isFinished ? 'completed' : 'active'}`}>
                            {isFinished ? 'Completed' : project.status || 'Active'}
                          </span>
                          <span className={`urgency-pill ${pDeadline.isOverdue ? 'overdue' : pDeadline.isSoon ? 'soon' : 'normal'}`}>
                            {pDeadline.label}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="card-progress-section">
                        <div className="progress-labels">
                          <span className="progress-title">Milestone Progress</span>
                          <span className="progress-ratio">{completedSteps}/{totalSteps} Steps ({progressPct}%)</span>
                        </div>
                        <div className="progress-track">
                          <div 
                            className={`progress-fill ${progressPct === 100 ? 'done' : ''}`}
                            style={{ width: `${progressPct}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Steps List Drawer inside Card */}
                      <div className="card-steps-drawer">
                        <div className="drawer-heading">Assigned Steps ({pSteps.length}):</div>
                        <div className="drawer-steps-list">
                          {pSteps.map(step => {
                            const stepDl = getDeadlineInfo(step.deadline);
                            const isStepDone = step.status === 'Completed';
                            const isStepUnderReview = step.status === 'Pending Approval';
                            const isStepAccepted = step.deadline_status === 'Accepted';
                            const isStepUnconfirmed = !step.deadline_status || step.deadline_status === 'Pending Acceptance' || step.deadline_status === 'Rejected';

                            return (
                              <div key={step.id} className="drawer-step-item">
                                <div className="step-info-col">
                                  <div className="step-title-line">
                                    <span className="step-text">{step.title}</span>
                                    {step.deadline && !isStepDone && (
                                      <span className={`step-dl-tag ${stepDl.isOverdue ? 'overdue' : stepDl.isSoon ? 'soon' : ''}`}>
                                        {stepDl.label}
                                      </span>
                                    )}
                                  </div>
                                  <span className="step-date-sub">
                                    Target: {step.deadline ? new Date(step.deadline).toLocaleDateString() : 'None'}
                                  </span>
                                </div>

                                <div className="step-action-col">
                                  {isStepDone ? (
                                    <span className="chip-accepted">✓ Done</span>
                                  ) : isStepUnderReview ? (
                                    <span className="chip-under-review">⏳ In Review</span>
                                  ) : isStepUnconfirmed ? (
                                    <button 
                                      className="btn-action btn-accept mini"
                                      onClick={() => handleAcceptDeadline(project.id, step.id)}
                                    >
                                      Accept
                                    </button>
                                  ) : (
                                    <button 
                                      className="btn-action btn-submit-proof mini"
                                      onClick={() => openStepSubmitModal(project.id, project.title, step)}
                                    >
                                      <Upload size={12} /> Submit
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="card-footer-actions">
                        <button 
                          className="btn-final-delivery"
                          onClick={() => openProjectDeliveryModal(project)}
                        >
                          <Upload size={14} /> Final Client Delivery
                        </button>
                        <button 
                          className="btn-view-project"
                          onClick={() => navigate(`/projects/${project.id}`)}
                        >
                          <ExternalLink size={14} /> Details
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>

        {/* Right Column: Daily Production To-Do Scratchpad */}
        <div className="prod-side-column">
          <div className="prod-todo-widget">
            
            <div className="todo-widget-header">
              <div className="todo-title-wrap">
                <CheckSquare size={18} className="todo-icon" />
                <h3 className="todo-heading">Daily Task Board</h3>
              </div>
              <span className="todo-counter-pill">
                {todoList.filter(t => t.completed).length}/{todoList.length}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="todo-progress-wrap">
              <div className="todo-progress-bar">
                <div 
                  className="todo-progress-fill"
                  style={{ width: `${todoCompletionPercent}%` }}
                ></div>
              </div>
              <span className="todo-progress-text">{todoCompletionPercent}% Completed</span>
            </div>

            {/* Add Task Form */}
            <form onSubmit={handleAddTodo} className="todo-add-form">
              <input 
                type="text"
                className="todo-add-input"
                placeholder="Add daily task..."
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
              />
              <button type="submit" className="todo-add-btn" title="Add item">
                <Plus size={16} />
              </button>
            </form>

            {/* Todo Filter Pills */}
            <div className="todo-filter-pills">
              <button 
                className={`todo-pill ${todoFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTodoFilter('all')}
              >
                All ({todoList.length})
              </button>
              <button 
                className={`todo-pill ${todoFilter === 'active' ? 'active' : ''}`}
                onClick={() => setTodoFilter('active')}
              >
                Active ({todoList.filter(t => !t.completed).length})
              </button>
              <button 
                className={`todo-pill ${todoFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setTodoFilter('completed')}
              >
                Done ({todoList.filter(t => t.completed).length})
              </button>
            </div>

            {/* Checklist items */}
            <div className="todo-items-list">
              {filteredTodos.length === 0 ? (
                <div className="todo-empty-notice">
                  <span>No tasks found in this view.</span>
                </div>
              ) : (
                filteredTodos.map(item => (
                  <div key={item.id} className={`todo-item-row ${item.completed ? 'is-done' : ''}`}>
                    <label className="todo-checkbox-label">
                      <input 
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleTodo(item.id)}
                        className="todo-native-checkbox"
                      />
                      <span className="todo-text">{item.text}</span>
                    </label>
                    <button 
                      className="todo-del-btn"
                      onClick={() => handleDeleteTodo(item.id)}
                      title="Delete task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Clear Completed Action */}
            {todoList.some(t => t.completed) && (
              <div className="todo-footer-wrap">
                <button className="todo-clear-btn" onClick={handleClearCompletedTodos}>
                  Clear Completed Tasks
                </button>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: STEP DELIVERABLE & PROOF SUBMISSION */}
      {/* ========================================================================= */}
      {submitModal.isOpen && (
        <div className="prod-modal-overlay">
          <div className="prod-modal-dialog">
            <div className="prod-modal-header">
              <div className="modal-title-wrap">
                <Upload size={20} className="modal-header-icon" />
                <h3>Submit Step Deliverable Proof</h3>
              </div>
              <button 
                className="modal-close-btn"
                onClick={() => setSubmitModal({ isOpen: false, projectId: null, stepId: null, projectName: '', stepTitle: '' })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-context-strip">
              <div>Project: <strong>{submitModal.projectName}</strong></div>
              <div>Step: <span className="highlight-step">{submitModal.stepTitle}</span></div>
            </div>

            <form onSubmit={handleStepDeliverableSubmit} className="prod-modal-form">
              <div className="form-group">
                <label>PACKAGE / DELIVERABLE NAME *</label>
                <input 
                  type="text"
                  required
                  value={deliverableName}
                  onChange={(e) => setDeliverableName(e.target.value)}
                  placeholder="e.g. Logo Design Final Assets v1.0"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>DOWNLOAD LINK / CLOUD REPOSITORY URL *</label>
                <input 
                  type="url"
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  placeholder="https://drive.google.com/... or https://figma.com/..."
                  className="form-control"
                />
                <span className="input-helper-text">
                  Provide a shareable Google Drive, Figma, Dropbox, Loom, or GitHub link.
                </span>
              </div>

              <div className="form-group">
                <label>OR ATTACH DIRECT FILE (OPTIONAL)</label>
                <input 
                  type="file"
                  onChange={(e) => setDeliverableFile(e.target.files[0])}
                  className="form-file-control"
                />
                {deliverableFile && (
                  <span className="selected-file-label">Selected: {deliverableFile.name}</span>
                )}
              </div>

              <div className="modal-actions-row">
                <button 
                  type="button" 
                  className="btn-modal-cancel"
                  onClick={() => setSubmitModal({ isOpen: false, projectId: null, stepId: null, projectName: '', stepTitle: '' })}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-modal-primary"
                  disabled={submittingDeliverable}
                >
                  {submittingDeliverable ? 'Submitting Proof...' : 'Submit for PM Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DEADLINE EXTENSION APPEAL */}
      {/* ========================================================================= */}
      {appealModalStep && (
        <div className="prod-modal-overlay">
          <div className="prod-modal-dialog">
            <div className="prod-modal-header">
              <div className="modal-title-wrap">
                <Clock size={20} className="modal-header-icon amber" />
                <h3>Appeal Deadline Extension</h3>
              </div>
              <button 
                className="modal-close-btn"
                onClick={() => setAppealModalStep(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-context-strip">
              <div>Project: <strong>{appealModalStep.project_title}</strong></div>
              <div>Step: <span className="highlight-step">{appealModalStep.step_title}</span></div>
              <div>Current Deadline: <strong>{appealModalStep.current_deadline ? new Date(appealModalStep.current_deadline).toLocaleDateString() : 'None'}</strong></div>
            </div>

            <form onSubmit={handleSubmitAppeal} className="prod-modal-form">
              <div className="form-group">
                <label>PROPOSED NEW DEADLINE DATE *</label>
                <input 
                  type="date"
                  required
                  value={appealForm.proposed_deadline}
                  onChange={(e) => setAppealForm({ ...appealForm, proposed_deadline: e.target.value })}
                  className="form-control"
                />

                {/* Quick Add Presets */}
                <div className="quick-presets-row">
                  <span className="preset-label">Quick Add:</span>
                  <button 
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      const base = appealModalStep?.current_deadline ? new Date(appealModalStep.current_deadline) : new Date();
                      base.setDate(base.getDate() + 2);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                  >
                    +2 Days
                  </button>
                  <button 
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      const base = appealModalStep?.current_deadline ? new Date(appealModalStep.current_deadline) : new Date();
                      base.setDate(base.getDate() + 5);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                  >
                    +5 Days
                  </button>
                  <button 
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      const base = appealModalStep?.current_deadline ? new Date(appealModalStep.current_deadline) : new Date();
                      base.setDate(base.getDate() + 7);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                  >
                    +1 Week
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>REASON FOR EXTENSION APPEAL *</label>
                <textarea 
                  required
                  rows="3"
                  className="form-control"
                  placeholder="Explain why extra production time is required (e.g., waiting for client brand guidelines, complex 3D render cycles, scope addition)..."
                  value={appealForm.reason}
                  onChange={(e) => setAppealForm({ ...appealForm, reason: e.target.value })}
                ></textarea>
              </div>

              <div className="modal-actions-row">
                <button 
                  type="button" 
                  className="btn-modal-cancel"
                  onClick={() => setAppealModalStep(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-modal-amber"
                  disabled={submittingAppeal}
                >
                  {submittingAppeal ? 'Submitting Appeal...' : 'Submit Appeal to PM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PROJECT-LEVEL FINAL DELIVERY */}
      {/* ========================================================================= */}
      {projectDeliveryModal.isOpen && (
        <div className="prod-modal-overlay">
          <div className="prod-modal-dialog">
            <div className="prod-modal-header">
              <div className="modal-title-wrap">
                <Upload size={20} className="modal-header-icon" />
                <h3>Submit Project Final Delivery</h3>
              </div>
              <button 
                className="modal-close-btn"
                onClick={() => setProjectDeliveryModal({ isOpen: false, project: null })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-context-strip">
              Project: <strong>{projectDeliveryModal.project?.title}</strong>
            </div>

            <form onSubmit={handleProjectDeliverySubmit} className="prod-modal-form">
              <div className="form-group">
                <label>DELIVERY PACKAGE TITLE *</label>
                <input 
                  type="text"
                  required
                  value={projectDeliveryForm.file_name}
                  onChange={(e) => setProjectDeliveryForm({ ...projectDeliveryForm, file_name: e.target.value })}
                  placeholder="e.g. Master Production Deliverables v1.0"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>MASTER DOWNLOAD URL / REPOSITORY LINK *</label>
                <input 
                  type="url"
                  required
                  value={projectDeliveryForm.file_url}
                  onChange={(e) => setProjectDeliveryForm({ ...projectDeliveryForm, file_url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="form-control"
                />
              </div>

              <div className="modal-actions-row">
                <button 
                  type="button" 
                  className="btn-modal-cancel"
                  onClick={() => setProjectDeliveryModal({ isOpen: false, project: null })}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-modal-primary"
                  disabled={submittingProjectDelivery}
                >
                  {submittingProjectDelivery ? 'Submitting...' : 'Submit Delivery Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: STEP INTERNAL TEAM CHAT */}
      {/* ========================================================================= */}
      {chatModal.isOpen && (
        <div className="prod-modal-overlay">
          <div className="prod-modal-dialog chat-dialog">
            <div className="prod-modal-header">
              <div className="modal-title-wrap">
                <MessageSquare size={20} className="modal-header-icon" />
                <div>
                  <h3 style={{ margin: 0 }}>Step Team Collaboration</h3>
                  <span className="chat-sub-title">{chatModal.stepTitle} · {chatModal.projectTitle}</span>
                </div>
              </div>
              <button 
                className="modal-close-btn"
                onClick={() => setChatModal({ isOpen: false, stepId: null, stepTitle: '', projectId: null, projectTitle: '' })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="chat-modal-content">
              <StepInhouseChat stepId={chatModal.stepId} currentUser={currentUser} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
