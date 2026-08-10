import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderKanban, Clock, CheckCircle2, AlertCircle, Calendar, 
  ExternalLink, Layers, ShieldCheck, RefreshCw, PlusCircle, FileText,
  ListTodo, CheckSquare, Square, Trash2, Plus, Filter, Tag
} from 'lucide-react';
import './PmPortal.css';

export default function PmPortal() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingAppealsCount, setPendingAppealsCount] = useState(0);
  const [filterTab, setFilterTab] = useState('All');
  const [lockDateState, setLockDateState] = useState({});

  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // PM To-Do List State (Persisted per user in localStorage)
  const todoStorageKey = `pm_todos_${currentUser.id || 'default'}`;
  const [todos, setTodos] = useState(() => {
    try {
      const saved = localStorage.getItem(todoStorageKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading PM todos', e);
    }
    return [
      { id: 1, text: 'Lock target step deadlines for all new project assignments', completed: false, priority: 'High', category: 'Deadline Lock' },
      { id: 2, text: 'Review and approve pending deadline extension appeals', completed: false, priority: 'High', category: 'Appeals' },
      { id: 3, text: 'Verify completed deliverables before releasing to client', completed: false, priority: 'Medium', category: 'Quality Control' },
      { id: 4, text: 'Conduct weekly production team sync & workload alignment', completed: true, priority: 'Low', category: 'Team Sync' }
    ];
  });

  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState('Medium');
  const [newTodoCategory, setNewTodoCategory] = useState('General');
  const [todoFilter, setTodoFilter] = useState('All');

  useEffect(() => {
    fetchProjects();
    fetchAppealsCount();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(todoStorageKey, JSON.stringify(todos));
    } catch (e) {
      console.error('Error saving PM todos', e);
    }
  }, [todos, todoStorageKey]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      let url = '/api/projects';
      if (currentUser && currentUser.id) {
        url += `?user_id=${currentUser.id}&role=${encodeURIComponent(currentUser.role || 'Product Manager')}`;
      }
      const res = await axios.get(url);
      setProjects(res.data || []);
    } catch (e) {
      console.error('Failed to fetch PM projects', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppealsCount = async () => {
    try {
      const res = await axios.get('/api/deadlines/appeals/count');
      setPendingAppealsCount(res.data?.pending_count || 0);
    } catch (e) {
      console.error('Failed to fetch pending appeals count', e);
    }
  };

  const handleLockDeadline = async (projectId) => {
    const targetDate = lockDateState[projectId];
    if (!targetDate) {
      alert('Please select a deadline date before locking.');
      return;
    }
    try {
      await axios.post(`/api/projects/${projectId}/lock-deadline`, { deadline: targetDate });
      alert('Project deadline locked successfully!');
      fetchProjects();
    } catch (e) {
      console.error('Failed to lock deadline', e);
      alert('Failed to lock deadline.');
    }
  };

  const handleStepStatusChange = async (projectId, stepId, newStatus) => {
    try {
      await axios.put(`/api/projects/${projectId}/steps/${stepId}`, { status: newStatus });
      fetchProjects();
    } catch (e) {
      console.error('Failed to update step status', e);
    }
  };

  // To-Do list handlers
  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    const newItem = {
      id: Date.now(),
      text: newTodoText.trim(),
      completed: false,
      priority: newTodoPriority,
      category: newTodoCategory
    };
    setTodos([newItem, ...todos]);
    setNewTodoText('');
  };

  const handleToggleTodo = (id) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDeleteTodo = (id) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  const handleClearCompleted = () => {
    setTodos(todos.filter(t => !t.completed));
  };

  // Metrics
  const totalProjects = projects.length;
  const needDeadlineCount = projects.filter(p => !p.locked_deadline || p.status === 'Assigned').length;
  const completedProjectsCount = projects.filter(p => p.status === 'Completed' || p.status === 'Commission Released').length;
  const activeProjectsCount = totalProjects - completedProjectsCount;

  // Filter projects
  const filteredProjects = projects.filter(p => {
    const isComp = p.status === 'Completed' || p.status === 'Commission Released';
    if (filterTab === 'Needs Deadline') return !p.locked_deadline || p.status === 'Assigned';
    if (filterTab === 'Active') return !isComp;
    if (filterTab === 'Completed') return isComp;
    return true;
  });

  // Filter To-Dos
  const completedTodosCount = todos.filter(t => t.completed).length;
  const pendingTodosCount = todos.filter(t => !t.completed).length;
  const filteredTodos = todos.filter(t => {
    if (todoFilter === 'Pending') return !t.completed;
    if (todoFilter === 'Completed') return t.completed;
    return true;
  });

  // Extract Critical Alerts for PM
  const criticalAlerts = [];
  projects.forEach(p => {
    if (Array.isArray(p.steps)) {
      p.steps.forEach(step => {
        if (step.deadline_status === 'Appealed') {
          criticalAlerts.push({
            id: `appeal-${step.id}`,
            type: 'Appeal',
            message: `Deadline appeal arrived for project "${p.title}" (Step: ${step.title}). Production Member: ${step.assignee_name || 'Unassigned'}.`,
            projectId: p.id
          });
        }
        if (step.status === 'Pending Approval') {
          criticalAlerts.push({
            id: `approval-${step.id}`,
            type: 'Approval',
            message: `Project approval arrived! Deliverable submitted for project "${p.title}" (Step: ${step.title}). Production Member: ${step.assignee_name || 'Unassigned'}.`,
            projectId: p.id
          });
        }
      });
    }
  });

  return (
    <div className="pm-dashboard-container">
      
      {/* Header Banner */}
      <div className="pm-header-banner">
        <div className="pm-header-info">
          <h1>Product Manager Command Center 🎯</h1>
          <p>Welcome back, {currentUser.name || 'Product Manager'}. Manage production assignments, lock deadlines, and oversee project quality.</p>
        </div>

        <div className="pm-header-actions">
          <button 
            onClick={() => navigate('/deadlines')}
            style={{ background: '#f59e0b', color: '#ffffff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Clock size={16} /> Deadline Workflow ({pendingAppealsCount})
          </button>

          <button 
            onClick={() => navigate('/projects')}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <PlusCircle size={16} /> Project Creation
          </button>

          <button 
            onClick={() => { fetchProjects(); fetchAppealsCount(); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.6rem 1rem', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Critical Alerts Section */}
      {criticalAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {criticalAlerts.map(alert => (
            <div key={alert.id} style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '5px solid #ef4444', 
              padding: '1rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem',
              boxShadow: '0 2px 5px rgba(239, 68, 68, 0.1)', cursor: 'pointer'
            }} onClick={() => navigate(`/projects/${alert.projectId}`)}>
              <AlertCircle size={24} color="#ef4444" />
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', color: '#991b1b', fontSize: '1rem', marginBottom: '0.2rem' }}>
                  {alert.type === 'Approval' ? 'Deliverable Pending Approval!' : 'Deadline Appeal Requires Review!'}
                </strong>
                <span style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{alert.message}</span>
              </div>
              <button style={{
                background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1rem', 
                borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem'
              }}>
                Review Now
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="pm-metrics-grid">
        <div className="pm-metric-card">
          <div className="pm-metric-icon indigo">
            <FolderKanban size={24} />
          </div>
          <div className="pm-metric-content">
            <span className="pm-metric-val">{totalProjects}</span>
            <span className="pm-metric-lbl">Supervised Projects</span>
          </div>
        </div>

        <div className="pm-metric-card">
          <div className="pm-metric-icon amber">
            <Calendar size={24} />
          </div>
          <div className="pm-metric-content">
            <span className="pm-metric-val">{needDeadlineCount}</span>
            <span className="pm-metric-lbl">Needs Deadline Lock</span>
          </div>
        </div>

        <div className="pm-metric-card">
          <div className="pm-metric-icon rose">
            <Clock size={24} />
          </div>
          <div className="pm-metric-content">
            <span className="pm-metric-val">{pendingAppealsCount}</span>
            <span className="pm-metric-lbl">Pending Extension Appeals</span>
          </div>
        </div>

        <div className="pm-metric-card">
          <div className="pm-metric-icon emerald">
            <CheckCircle2 size={24} />
          </div>
          <div className="pm-metric-content">
            <span className="pm-metric-val">{completedProjectsCount}</span>
            <span className="pm-metric-lbl">Completed Projects</span>
          </div>
        </div>
      </div>

      {/* PRODUCT MANAGER TO-DO LIST SECTION */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        
        {/* To-Do Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: '#e0e7ff', color: '#4338ca', padding: '0.45rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ListTodo size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>Product Manager To-Do List</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Track daily tasks, deadline reviews, and production milestones.</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', background: '#f1f5f9', color: '#475569', padding: '0.35rem 0.75rem', borderRadius: '20px', fontWeight: '700' }}>
              {completedTodosCount} of {todos.length} Done ({todos.length > 0 ? Math.round((completedTodosCount / todos.length) * 100) : 0}%)
            </span>

            {completedTodosCount > 0 && (
              <button 
                onClick={handleClearCompleted}
                style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
              >
                Clear Completed
              </button>
            )}
          </div>
        </div>

        {/* Add To-Do Input Form */}
        <form onSubmit={handleAddTodo} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <input 
            type="text"
            placeholder="Add a new task (e.g., Review pending extension appeal for Software Developer project)..."
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            style={{ flex: 1, minWidth: '260px', padding: '0.6rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
          />

          <select 
            value={newTodoCategory}
            onChange={(e) => setNewTodoCategory(e.target.value)}
            style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600', color: '#334155', background: '#f8fafc' }}
          >
            <option value="General">Category: General</option>
            <option value="Deadline Lock">Category: Deadline Lock</option>
            <option value="Appeals">Category: Appeals</option>
            <option value="Quality Control">Category: Quality Control</option>
            <option value="Team Sync">Category: Team Sync</option>
          </select>

          <select 
            value={newTodoPriority}
            onChange={(e) => setNewTodoPriority(e.target.value)}
            style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600', color: '#334155', background: '#f8fafc' }}
          >
            <option value="High">Priority: High</option>
            <option value="Medium">Priority: Medium</option>
            <option value="Low">Priority: Low</option>
          </select>

          <button 
            type="submit"
            style={{ background: '#4338ca', color: '#ffffff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={16} /> Add Task
          </button>
        </form>

        {/* To-Do Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
          <button 
            onClick={() => setTodoFilter('All')}
            style={{ background: todoFilter === 'All' ? '#0f172a' : 'transparent', color: todoFilter === 'All' ? '#ffffff' : '#64748b', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
          >
            All Tasks ({todos.length})
          </button>
          <button 
            onClick={() => setTodoFilter('Pending')}
            style={{ background: todoFilter === 'Pending' ? '#0f172a' : 'transparent', color: todoFilter === 'Pending' ? '#ffffff' : '#64748b', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
          >
            Pending ({pendingTodosCount})
          </button>
          <button 
            onClick={() => setTodoFilter('Completed')}
            style={{ background: todoFilter === 'Completed' ? '#0f172a' : 'transparent', color: todoFilter === 'Completed' ? '#ffffff' : '#64748b', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
          >
            Completed ({completedTodosCount})
          </button>
        </div>

        {/* To-Do Items List */}
        {filteredTodos.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
            No tasks in this list view. Add a task above to keep track of your work!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredTodos.map(todo => {
              const isHigh = todo.priority === 'High';
              const isMed = todo.priority === 'Medium';

              return (
                <div 
                  key={todo.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justify: 'space-between', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '10px', 
                    background: todo.completed ? '#f8fafc' : '#ffffff', 
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <button 
                      onClick={() => handleToggleTodo(todo.id)}
                      style={{ background: 'none', border: 'none', color: todo.completed ? '#10b981' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                    >
                      {todo.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>

                    <span 
                      style={{ 
                        fontSize: '0.9rem', 
                        color: todo.completed ? '#94a3b8' : '#1e293b', 
                        textDecoration: todo.completed ? 'line-through' : 'none',
                        fontWeight: todo.completed ? '500' : '600'
                      }}
                    >
                      {todo.text}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span 
                      style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: '700', 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        background: '#f1f5f9',
                        color: '#475569'
                      }}
                    >
                      {todo.category}
                    </span>

                    <span 
                      style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: '700', 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        background: isHigh ? '#ffe4e6' : isMed ? '#fef3c7' : '#e0e7ff',
                        color: isHigh ? '#e11d48' : isMed ? '#b45309' : '#4338ca'
                      }}
                    >
                      {todo.priority}
                    </span>

                    <button 
                      onClick={() => handleDeleteTodo(todo.id)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                      title="Delete Task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Filter Tabs */}
      <div className="pm-filter-bar">
        <button 
          className={`pm-filter-btn ${filterTab === 'All' ? 'active' : ''}`}
          onClick={() => setFilterTab('All')}
        >
          All Projects ({projects.length})
        </button>
        <button 
          className={`pm-filter-btn ${filterTab === 'Needs Deadline' ? 'active' : ''}`}
          onClick={() => setFilterTab('Needs Deadline')}
        >
          ⏳ Needs Deadline Lock ({needDeadlineCount})
        </button>
        <button 
          className={`pm-filter-btn ${filterTab === 'Active' ? 'active' : ''}`}
          onClick={() => setFilterTab('Active')}
        >
          ⚡ Active ({activeProjectsCount})
        </button>
        <button 
          className={`pm-filter-btn ${filterTab === 'Completed' ? 'active' : ''}`}
          onClick={() => setFilterTab('Completed')}
        >
          ✅ Completed ({completedProjectsCount})
        </button>
      </div>

      {/* Projects List Board */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading Product Manager dashboard...</div>
      ) : filteredProjects.length === 0 ? (
        <div style={{ background: '#ffffff', padding: '3.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>
          <FolderKanban size={44} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
          <h3 style={{ margin: '0 0 0.35rem 0', color: '#0f172a' }}>No projects match this view</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Check another filter tab or create a new project to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredProjects.map(p => {
            const isCompleted = p.status === 'Completed' || p.status === 'Commission Released';
            const projectSteps = p.steps || p.user_assigned_steps || [];

            return (
              <div key={p.id} className="pm-project-card">
                
                {/* Top Card Section */}
                <div className="pm-card-top">
                  <div>
                    <h3 className="pm-card-title">{p.title}</h3>
                    <div className="pm-card-meta">
                      <span>Client: <strong style={{ color: '#334155' }}>{p.client_name || 'Unassigned'}</strong></span>
                      <span>·</span>
                      <span>Service: <strong style={{ color: '#334155' }}>{p.service_type || 'Custom'}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={`badge-status ${isCompleted ? 'completed' : 'active'}`}>
                      {p.status || 'Active'}
                    </span>
                    <button 
                      onClick={() => navigate(`/projects/${p.id}`)}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', padding: '0.45rem 0.9rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <ExternalLink size={14} /> Full Details
                    </button>
                  </div>
                </div>

                {/* Deadline Lock Banner / Control */}
                <div className="pm-lock-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={18} color="#4338ca" />
                    <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1e293b' }}>
                      Target Project Deadline:
                    </span>
                    <span style={{ fontSize: '0.88rem', color: p.locked_deadline ? '#047857' : '#b45309', fontWeight: '700' }}>
                      {p.locked_deadline ? new Date(p.locked_deadline).toLocaleDateString() : '⚠️ Not Locked Yet'}
                    </span>
                  </div>

                  {(!p.locked_deadline || p.status === 'Assigned') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="date"
                        value={lockDateState[p.id] || ''}
                        onChange={(e) => setLockDateState({ ...lockDateState, [p.id]: e.target.value })}
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                      <button 
                        onClick={() => handleLockDeadline(p.id)}
                        style={{ background: '#4338ca', color: '#ffffff', border: 'none', padding: '0.45rem 0.9rem', borderRadius: '6px', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
                      >
                        Lock Deadline
                      </button>
                    </div>
                  )}
                </div>

                {/* Team Members List */}
                {p.assigned_members && p.assigned_members.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Assigned Team:</span>
                    {p.assigned_members.map(m => (
                      <span key={m.id} style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
                        {m.name} ({m.role})
                      </span>
                    ))}
                  </div>
                )}

                {/* Steps Workflow List */}
                {projectSteps.length > 0 && (
                  <div className="pm-steps-box">
                    <div className="pm-steps-header">📌 Supervised Steps & Progress:</div>
                    {projectSteps.map(step => (
                      <div key={step.id} className="pm-step-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0f172a' }}>{step.title}</span>
                          {step.assignee_name && (
                            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                              Assignee: {step.assignee_name}
                            </span>
                          )}
                          {step.deadline && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                              Due: {new Date(step.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <select 
                            value={step.status || 'Pending'}
                            onChange={(e) => handleStepStatusChange(p.id, step.id, e.target.value)}
                            style={{ 
                              padding: '0.25rem 0.6rem', 
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
                    ))}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
