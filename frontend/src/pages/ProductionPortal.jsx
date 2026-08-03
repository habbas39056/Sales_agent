import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, AlertTriangle, Clock, FolderKanban, Plus, Trash2, 
  ExternalLink, Upload, ArrowRight, ShieldAlert, FileText, CheckSquare, Layers 
} from 'lucide-react';
import './ProductionPortal.css';
import './Modal.css';

export default function ProductionPortal() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('All');
  
  // Interactive To-Do Checklist State
  const [todoList, setTodoList] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');

  // Deliverable Upload Modal State
  const [activeModalProject, setActiveModalProject] = useState(null);
  const [deliverableForm, setDeliverableForm] = useState({
    file_name: '',
    file_url: '',
    notes: ''
  });
  const [submittingDeliverable, setSubmittingDeliverable] = useState(false);

  // Deadline Appeal Modal State
  const [appealModalStep, setAppealModalStep] = useState(null);
  const [appealForm, setAppealForm] = useState({
    proposed_deadline: '',
    reason: ''
  });
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const handleAcceptDeadline = async (projectId, stepId) => {
    try {
      await axios.post(`/api/projects/${projectId}/steps/${stepId}/accept-deadline`, {
        user_id: currentUser.id
      });
      fetchProjects();
    } catch (e) {
      console.error('Failed to accept deadline', e);
    }
  };

  const handleOpenAppealModal = (project, step) => {
    setAppealModalStep({
      project_id: project.id,
      step_id: step.id,
      step_title: step.title,
      current_deadline: step.deadline
    });
    setAppealForm({
      proposed_deadline: step.deadline || '',
      reason: ''
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
      alert('Deadline extension appeal submitted! Admin will be notified in Deadline Workflow.');
      setAppealModalStep(null);
      fetchProjects();
    } catch (e) {
      console.error('Failed to submit appeal', e);
      alert('Failed to submit deadline appeal.');
    } finally {
      setSubmittingAppeal(false);
    }
  };

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
    }
  };

  const loadTodoList = () => {
    const key = `prod_todos_${currentUser.id || 'guest'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setTodoList(JSON.parse(saved));
        return;
      } catch (e) { console.error(e); }
    }
    // Default sample to-do list for production users
    const initial = [
      { id: 1, text: 'Review initial design wireframes', completed: true },
      { id: 2, text: 'Export high-res client deliverables', completed: false },
      { id: 3, text: 'Perform cross-browser QA checks', completed: false }
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

  const handleStepStatusChange = async (projectId, stepId, newStatus) => {
    try {
      await axios.put(`/api/projects/${projectId}/steps/${stepId}`, { status: newStatus });
      fetchProjects();
    } catch (e) {
      console.error('Failed to update step status', e);
    }
  };

  const openDeliverableModal = (project) => {
    setActiveModalProject(project);
    setDeliverableForm({
      file_name: `${project.title} - Final Deliverable`,
      file_url: 'https://drive.google.com/file/d/sample',
      notes: ''
    });
  };

  const handleDeliverableSubmit = async (e) => {
    e.preventDefault();
    if (!activeModalProject) return;
    setSubmittingDeliverable(true);
    try {
      await axios.post(`/api/projects/${activeModalProject.id}/submit-delivery`, {
        user_id: currentUser.id || 1,
        file_url: deliverableForm.file_url || 'https://drive.google.com/file/d/sample',
        file_name: deliverableForm.file_name || 'Project Deliverable'
      });
      alert('Deliverable submitted successfully! Client has been notified.');
      setActiveModalProject(null);
      fetchProjects();
    } catch (e) {
      console.error('Failed to submit deliverable', e);
      alert('Failed to submit deliverable.');
    } finally {
      setSubmittingDeliverable(false);
    }
  };

  // Utility to calculate deadline status
  const getDeadlineInfo = (deadlineStr) => {
    if (!deadlineStr) return { isOverdue: false, isSoon: false, label: 'No Deadline' };
    const due = new Date(deadlineStr);
    const now = new Date();
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { isOverdue: true, isSoon: false, label: `🔥 Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''}` };
    } else if (diffDays === 0) {
      return { isOverdue: false, isSoon: true, label: '⏰ Due Today!' };
    } else if (diffDays <= 3) {
      return { isOverdue: false, isSoon: true, label: `⚡ Due in ${diffDays} day${diffDays > 1 ? 's' : ''}` };
    } else {
      return { isOverdue: false, isSoon: false, label: `📅 Due ${due.toLocaleDateString()}` };
    }
  };

  // Metrics Calculations
  const totalProjectsCount = projects.length;
  const completedProjectsCount = projects.filter(p => p.status === 'Completed' || p.status === 'Commission Released').length;
  const activeProjectsCount = totalProjectsCount - completedProjectsCount;

  // Find overdue / urgent deadline projects
  const urgentProjects = projects.filter(p => {
    if (p.status === 'Completed' || p.status === 'Commission Released') return false;
    const dl = getDeadlineInfo(p.locked_deadline);
    return dl.isOverdue || dl.isSoon;
  });

  // Calculate overall steps completed percentage across assigned projects
  let totalStepsCount = 0;
  let completedStepsCount = 0;
  projects.forEach(p => {
    const total = p.total_steps || (p.steps ? p.steps.length : 0);
    const completed = p.completed_steps || (p.steps ? p.steps.filter(s => s.status === 'Completed').length : 0);
    totalStepsCount += total;
    completedStepsCount += completed;
  });
  const overallProgressPercent = totalStepsCount > 0 ? Math.round((completedStepsCount / totalStepsCount) * 100) : 0;

  // Filter projects for display
  const filteredProjects = projects.filter(p => {
    const isComp = p.status === 'Completed' || p.status === 'Commission Released';
    if (filterTab === 'Active') return !isComp;
    if (filterTab === 'Completed') return isComp;
    if (filterTab === 'Due Soon') {
      const dl = getDeadlineInfo(p.locked_deadline);
      return !isComp && (dl.isOverdue || dl.isSoon);
    }
    return true; // All
  });

  return (
    <div className="prod-dashboard-container">
      
      {/* Header Banner */}
      <div className="prod-header-banner">
        <div className="prod-header-info">
          <h1>Production Command Center 🚀</h1>
          <p>Welcome back, {currentUser.name || 'Team Member'}. Here is your project workflow breakdown.</p>
        </div>
        <button 
          onClick={fetchProjects}
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', backdropFilter: 'blur(4px)' }}
        >
          <Clock size={16} /> Refresh Dashboard
        </button>
      </div>

      {/* Metric Stat Cards Grid */}
      <div className="prod-metrics-grid">
        <div className="prod-metric-card">
          <div className="prod-metric-icon indigo">
            <FolderKanban size={24} />
          </div>
          <div className="prod-metric-content">
            <span className="prod-metric-val">{totalProjectsCount}</span>
            <span className="prod-metric-lbl">Total Projects</span>
          </div>
        </div>

        <div className="prod-metric-card">
          <div className="prod-metric-icon amber">
            <Clock size={24} />
          </div>
          <div className="prod-metric-content">
            <span className="prod-metric-val">{activeProjectsCount}</span>
            <span className="prod-metric-lbl">Active Projects</span>
          </div>
        </div>

        <div className="prod-metric-card">
          <div className="prod-metric-icon emerald">
            <CheckCircle2 size={24} />
          </div>
          <div className="prod-metric-content">
            <span className="prod-metric-val">{completedProjectsCount}</span>
            <span className="prod-metric-lbl">Completed</span>
          </div>
        </div>

        <div className="prod-metric-card">
          <div className="prod-metric-icon rose">
            <AlertTriangle size={24} />
          </div>
          <div className="prod-metric-content">
            <span className="prod-metric-val">{urgentProjects.length}</span>
            <span className="prod-metric-lbl">Urgent / Due Soon</span>
          </div>
        </div>

        <div className="prod-metric-card">
          <div className="prod-metric-icon indigo">
            <Layers size={24} />
          </div>
          <div className="prod-metric-content">
            <span className="prod-metric-val">{overallProgressPercent}%</span>
            <span className="prod-metric-lbl">Overall Progress</span>
          </div>
        </div>
      </div>

      {/* Urgent Deadline Alert Banner */}
      {urgentProjects.length > 0 && (
        <div className="prod-alerts-banner">
          <div className="prod-alerts-header">
            <ShieldAlert size={20} />
            <span>ATTENTION REQUIRED: {urgentProjects.length} Project{urgentProjects.length > 1 ? 's' : ''} Require Immediate Production Action</span>
          </div>
          <div className="prod-alerts-list">
            {urgentProjects.map(p => {
              const dl = getDeadlineInfo(p.locked_deadline);
              return (
                <div key={p.id} className="prod-alert-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <strong style={{ color: '#1e293b' }}>{p.title}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Client: {p.client_name || 'Unassigned'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={dl.isOverdue ? 'badge-deadline-overdue' : 'badge-deadline-soon'}>
                      {dl.label}
                    </span>
                    <button 
                      onClick={() => navigate(`/projects/${p.id}`)}
                      style={{ background: 'none', border: 'none', color: '#4338ca', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      Open Project <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Layout Grid (Projects List + Side Daily Checklist) */}
      <div className="prod-content-layout">
        
        {/* Left Side: Projects Board */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Filter Pills */}
          <div className="prod-filter-bar">
            <button 
              className={`prod-filter-btn ${filterTab === 'All' ? 'active' : ''}`}
              onClick={() => setFilterTab('All')}
            >
              All Projects ({projects.length})
            </button>
            <button 
              className={`prod-filter-btn ${filterTab === 'Due Soon' ? 'active' : ''}`}
              onClick={() => setFilterTab('Due Soon')}
            >
              🔥 Due Soon / Overdue ({urgentProjects.length})
            </button>
            <button 
              className={`prod-filter-btn ${filterTab === 'Active' ? 'active' : ''}`}
              onClick={() => setFilterTab('Active')}
            >
              ⚡ Active ({activeProjectsCount})
            </button>
            <button 
              className={`prod-filter-btn ${filterTab === 'Completed' ? 'active' : ''}`}
              onClick={() => setFilterTab('Completed')}
            >
              ✅ Completed ({completedProjectsCount})
            </button>
          </div>

          {/* Project Cards List */}
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading production workflow...</div>
          ) : filteredProjects.length === 0 ? (
            <div style={{ background: '#ffffff', padding: '3rem', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>
              <FolderKanban size={40} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontWeight: '600' }}>No projects match the selected filter.</p>
            </div>
          ) : (
            filteredProjects.map(p => {
              const dl = getDeadlineInfo(p.locked_deadline);
              const total = p.total_steps || (p.steps ? p.steps.length : 0);
              const completed = p.completed_steps || (p.steps ? p.steps.filter(s => s.status === 'Completed').length : 0);
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
              const isCompleted = p.status === 'Completed' || p.status === 'Commission Released';

              return (
                <div key={p.id} className="prod-project-card">
                  
                  {/* Top Bar */}
                  <div className="prod-card-top">
                    <div>
                      <h3 className="prod-card-title">{p.title}</h3>
                      <div className="prod-card-meta">
                        <span>Client: <strong>{p.client_name || 'No Client'}</strong></span>
                        <span>·</span>
                        <span>Service: <strong>{p.service_type || 'Unspecified'}</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span className={`badge-status ${isCompleted ? 'completed' : 'active'}`}>
                        {isCompleted ? 'Completed' : p.status || 'Active'}
                      </span>
                      <span className={dl.isOverdue ? 'badge-deadline-overdue' : dl.isSoon ? 'badge-deadline-soon' : 'badge-deadline-normal'}>
                        {dl.label}
                      </span>
                    </div>
                  </div>

                  {/* Steps Checklist inside Project Card */}
                  {(() => {
                    const displaySteps = (p.user_assigned_steps && p.user_assigned_steps.length > 0)
                      ? p.user_assigned_steps
                      : (p.steps || []);

                    if (displaySteps.length === 0) return null;

                    return (
                      <div className="prod-steps-box">
                        <div className="prod-steps-header">📌 Project Steps & Deadline Status:</div>
                        {displaySteps.map(step => {
                          const formattedDeadline = step.deadline ? new Date(step.deadline).toLocaleDateString() : 'No Deadline';
                          const formattedProposed = step.proposed_deadline ? new Date(step.proposed_deadline).toLocaleDateString() : 'N/A';

                          return (
                            <div key={step.id} className="prod-step-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                              <div style={{ flex: 1, minWidth: '200px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span className="prod-step-title">{step.title}</span>
                                  
                                  {/* Deadline Status Badges */}
                                  {step.deadline_status === 'Accepted' && (
                                    <span style={{ background: '#d1fae5', color: '#047857', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                                      ✅ Confirmed: {formattedDeadline}
                                    </span>
                                  )}
                                  {(!step.deadline_status || step.deadline_status === 'Pending Acceptance') && (
                                    <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                                      ⏳ Pending Acceptance ({formattedDeadline})
                                    </span>
                                  )}
                                  {step.deadline_status === 'Appealed' && (
                                    <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                                      ⚠️ Extension Appealed (Proposed: {formattedProposed})
                                    </span>
                                  )}
                                  {step.deadline_status === 'Rejected' && (
                                    <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                                      ❌ Extension Rejected (Due: {formattedDeadline})
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {/* Accept / Appeal Buttons for Production */}
                                {(!step.deadline_status || step.deadline_status === 'Pending Acceptance' || step.deadline_status === 'Rejected') && (
                                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    <button 
                                      type="button"
                                      onClick={() => handleAcceptDeadline(p.id, step.id)}
                                      style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                      Accept
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleOpenAppealModal(p, step)}
                                      style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                      Appeal Extension
                                    </button>
                                  </div>
                                )}

                                {step.deadline_status === 'Accepted' && (
                                  <button 
                                    type="button"
                                    onClick={() => handleOpenAppealModal(p, step)}
                                    style={{ background: 'none', border: '1px solid #cbd5e1', color: '#64748b', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                                  >
                                    Request Extension
                                  </button>
                                )}

                                {step.deadline_status === 'Appealed' && (
                                  <button 
                                    type="button"
                                    onClick={() => handleOpenAppealModal(p, step)}
                                    style={{ background: '#e0e7ff', border: '1px solid #c7d2fe', color: '#3730a3', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}
                                  >
                                    Update Appeal
                                  </button>
                                )}

                                {/* Status Dropdown */}
                                <select 
                                  value={step.status || 'Pending'}
                                  onChange={(e) => handleStepStatusChange(p.id, step.id, e.target.value)}
                                  style={{ 
                                    padding: '0.3rem 0.6rem', 
                                    borderRadius: '6px', 
                                    fontSize: '0.78rem', 
                                    fontWeight: '700', 
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: step.status === 'Completed' ? '#d1fae5' : step.status === 'In Progress' ? '#fef3c7' : '#f1f5f9',
                                    color: step.status === 'Completed' ? '#047857' : step.status === 'In Progress' ? '#b45309' : '#475569',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Completed">Completed</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Card Action Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    {p.assigned_members && p.assigned_members.length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>Team:</span>
                        {p.assigned_members.map(m => (
                          <span key={m.id} style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
                            {m.name}
                          </span>
                        ))}
                      </div>
                    ) : <div></div>}

                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <button 
                        onClick={() => openDeliverableModal(p)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#4338ca', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                      >
                        <Upload size={15} /> Submit Deliverable
                      </button>
                      <button 
                        onClick={() => navigate(`/projects/${p.id}`)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                      >
                        <ExternalLink size={15} /> Details
                      </button>
                    </div>
                  </div>

                </div>
              );
            })
          )}

        </div>

        {/* Right Side: Interactive Daily To-Do Checklist */}
        <div>
          <div className="prod-todo-card">
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckSquare size={20} color="#4338ca" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Daily Production Tasks</h3>
              </div>
              <span style={{ fontSize: '0.78rem', background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                {todoList.filter(t => t.completed).length}/{todoList.length}
              </span>
            </div>

            {/* Add Task Input Form */}
            <form onSubmit={handleAddTodo} className="todo-input-row">
              <input 
                type="text" 
                placeholder="Add daily task..."
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
              />
              <button type="submit" title="Add Task">
                <Plus size={18} />
              </button>
            </form>

            {/* Task Checklist Items */}
            <div className="todo-list">
              {todoList.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', margin: '1rem 0' }}>No tasks added. Add a task above to track your daily progress!</p>
              ) : (
                todoList.map(item => (
                  <div key={item.id} className={`todo-item ${item.completed ? 'completed' : ''}`}>
                    <div className="todo-item-check" onClick={() => handleToggleTodo(item.id)}>
                      <input 
                        type="checkbox" 
                        checked={item.completed} 
                        onChange={() => {}} // Controlled via container click
                        style={{ cursor: 'pointer', accentColor: '#4338ca' }}
                      />
                      <span>{item.text}</span>
                    </div>
                    <button 
                      type="button" 
                      className="todo-delete-btn"
                      onClick={() => handleDeleteTodo(item.id)}
                      title="Delete Task"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

      </div>

      {/* DELIVERABLE SUBMISSION MODAL */}
      {activeModalProject && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="deliverable-modal-content">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={22} color="#4338ca" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Submit Project Deliverable</h3>
              </div>
              <button 
                onClick={() => setActiveModalProject(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>
              Project: <strong style={{ color: '#1e293b' }}>{activeModalProject.title}</strong>
            </p>

            <form onSubmit={handleDeliverableSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#475569', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  FILE / PACKAGE NAME *
                </label>
                <input 
                  type="text"
                  required
                  value={deliverableForm.file_name}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, file_name: e.target.value })}
                  placeholder="e.g. Logo Design Final Assets v1.0"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#475569', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  DOWNLOAD LINK / FILE URL *
                </label>
                <input 
                  type="url"
                  required
                  value={deliverableForm.file_url}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, file_url: e.target.value })}
                  placeholder="https://drive.google.com/... or https://dropbox.com/..."
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button 
                  type="button"
                  onClick={() => setActiveModalProject(null)}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submittingDeliverable}
                  style={{ background: '#4338ca', color: '#ffffff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  {submittingDeliverable ? 'Submitting...' : 'Submit Deliverable'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* DEADLINE APPEAL MODAL */}
      {appealModalStep && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="deliverable-modal-content">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={22} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Appeal Deadline Extension</h3>
              </div>
              <button 
                onClick={() => setAppealModalStep(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 0.25rem 0' }}>
              Step: <strong style={{ color: '#1e293b' }}>{appealModalStep.step_title}</strong>
            </p>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
              Original Admin Deadline: <strong>{appealModalStep.current_deadline ? new Date(appealModalStep.current_deadline).toLocaleDateString() : 'Unspecified'}</strong>
            </p>

            <form onSubmit={handleSubmitAppeal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#475569', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  PROPOSED NEW DEADLINE DATE *
                </label>
                <input 
                  type="date"
                  required
                  value={appealForm.proposed_deadline ? appealForm.proposed_deadline.split('T')[0] : ''}
                  onChange={(e) => setAppealForm({ ...appealForm, proposed_deadline: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
                
                {/* Quick Date Presets */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Quick Add:</span>
                  <button 
                    type="button"
                    onClick={() => {
                      const base = appealModalStep?.current_deadline ? new Date(appealModalStep.current_deadline) : new Date();
                      base.setDate(base.getDate() + 2);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                  >
                    + 2 Days
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const base = appealModalStep?.current_deadline ? new Date(appealModalStep.current_deadline) : new Date();
                      base.setDate(base.getDate() + 5);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                  >
                    + 5 Days
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const base = appealModalStep?.current_deadline ? new Date(appealModalStep.current_deadline) : new Date();
                      base.setDate(base.getDate() + 7);
                      setAppealForm(prev => ({ ...prev, proposed_deadline: base.toISOString().split('T')[0] }));
                    }}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                  >
                    + 1 Week
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#475569', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>
                  REASON FOR EXTENSION APPEAL *
                </label>
                <textarea 
                  required
                  rows="3"
                  value={appealForm.reason}
                  onChange={(e) => setAppealForm({ ...appealForm, reason: e.target.value })}
                  placeholder="Explain why extra time is required (e.g. Awaiting client branding assets, extra revision cycle needed)..."
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button 
                  type="button"
                  onClick={() => setAppealModalStep(null)}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submittingAppeal}
                  style={{ background: '#f59e0b', color: '#ffffff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  {submittingAppeal ? 'Submitting...' : 'Submit Appeal to Admin'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
