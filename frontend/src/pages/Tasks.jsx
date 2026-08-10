import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { CheckSquare, Clock, Calendar, ExternalLink, CheckCircle2, FolderKanban, Paperclip } from 'lucide-react';
import './Tasks.css';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  
  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  const [submitModal, setSubmitModal] = useState({ isOpen: false, projectId: null, stepId: null, projectName: '' });
  const [deliverableName, setDeliverableName] = useState('');
  const [deliverableUrl, setDeliverableUrl] = useState('');

  const handleCompleteTask = (task) => {
    setSubmitModal({
      isOpen: true,
      projectId: task.project_id,
      stepId: task.id,
      projectName: task.project_title || 'Unknown Project'
    });
    setDeliverableName('');
    setDeliverableUrl('');
  };

  const submitDeliverable = async () => {
    if (!deliverableName || !deliverableUrl) {
      alert("Please fill in all required fields.");
      return;
    }
    try {
      await axios.put(`/api/projects/${submitModal.projectId}/steps/${submitModal.stepId}`, {
        status: 'Pending Approval',
        deliverable_name: deliverableName,
        deliverable_url: deliverableUrl
      });
      setSubmitModal({ isOpen: false, projectId: null, stepId: null, projectName: '' });
      fetchTasks();
    } catch (error) {
      console.error('Failed to submit task for approval', error);
      alert('Failed to update task status: ' + (error.response?.data?.error || error.message));
    }
  };

  const isOverdue = (deadlineStr) => {
    if (!deadlineStr) return false;
    const due = new Date(deadlineStr);
    const now = new Date();
    due.setHours(23, 59, 59, 999);
    return now > due;
  };

  const getRemainingTimeLabel = (deadlineStr) => {
    if (!deadlineStr) return null;
    const due = new Date(deadlineStr);
    due.setHours(23, 59, 59, 999);
    const now = new Date();
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} day(s)`;
    } else if (diffDays === 0) {
      return 'Due Today';
    } else {
      return `${diffDays} day(s) left`;
    }
  };

  const filteredTasks = tasks.filter(task => {
    // Status filter
    if (filter === 'Pending' && task.status !== 'Pending') return false;
    if (filter === 'In Progress' && task.status !== 'In Progress') return false;
    if (filter === 'Completed' && task.status !== 'Completed') return false;
    if (filter === 'Overdue' && (task.status === 'Completed' || !isOverdue(task.deadline))) return false;

    // Date filter (by deadline)
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
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay())); // Sunday
      setStartDate(today.toISOString().split('T')[0]);
      setEndDate(endOfWeek.toISOString().split('T')[0]);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Pending': return <span className="badge badge-pending">Pending</span>;
      case 'In Progress': return <span className="badge badge-in-progress">In Progress</span>;
      case 'Pending Approval': return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>⏳ Pending Approval</span>;
      case 'Completed': return <span className="badge badge-completed">✅ Approved & Completed</span>;
      default: return <span className="badge badge-pending">{status || 'Pending'}</span>;
    }
  };

  const renderAttachments = (attachmentsStr) => {
    if (!attachmentsStr) return null;
    try {
      const files = JSON.parse(attachmentsStr);
      if (!files || files.length === 0) return null;
      return (
        <div className="task-attachments">
          <div className="attachments-title"><Paperclip size={14} /> Attached Documents</div>
          <div className="attachment-list">
            {files.map((file, i) => {
              const fileName = file.split('/').pop();
              return (
                <a key={i} href={file} target="_blank" rel="noreferrer" className="attachment-link">
                  {fileName}
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
    <div className="tasks-container">
      <div className="tasks-controls-panel">
        <div className="tasks-filter-bar">
          <button 
            className={`tasks-filter-btn ${filter === 'All' ? 'active' : ''}`}
            onClick={() => setFilter('All')}
          >
            All Tasks
          </button>
          <button 
            className={`tasks-filter-btn ${filter === 'Pending' ? 'active' : ''}`}
            onClick={() => setFilter('Pending')}
          >
            Pending
          </button>
          <button 
            className={`tasks-filter-btn ${filter === 'In Progress' ? 'active' : ''}`}
            onClick={() => setFilter('In Progress')}
          >
            In Progress
          </button>
          <button 
            className={`tasks-filter-btn ${filter === 'Completed' ? 'active' : ''}`}
            onClick={() => setFilter('Completed')}
          >
            Completed
          </button>
          <button 
            className={`tasks-filter-btn ${filter === 'Overdue' ? 'active' : ''}`}
            onClick={() => setFilter('Overdue')}
            style={{ color: filter === 'Overdue' ? '#fff' : '#ef4444' }}
          >
            🔥 Overdue
          </button>
        </div>

        <div className="date-filter-group" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginRight: '0.25rem' }}>Quick Find:</span>
            <button 
              type="button"
              onClick={() => setQuickDateFilter('today')} 
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '600' }}
            >
              Today
            </button>
            <button 
              type="button"
              onClick={() => setQuickDateFilter('tomorrow')} 
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '600' }}
            >
              Tomorrow
            </button>
            <button 
              type="button"
              onClick={() => setQuickDateFilter('this_week')} 
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '600' }}
            >
              This Week
            </button>
          </div>

          <div style={{ width: '1px', background: '#e2e8f0', margin: '0 0.5rem' }}></div>

          <div className="date-input-wrapper">
            <label>Start Deadline</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="date-input"
            />
          </div>
          <div className="date-input-wrapper">
            <label>End Deadline</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="date-input"
            />
          </div>
          {(startDate || endDate) && (
            <button 
              className="clear-dates-btn"
              onClick={() => { setStartDate(''); setEndDate(''); }}
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty-state">
          <CheckSquare size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
          <h3>No Tasks Found</h3>
          <p>You don't have any tasks matching the current filters.</p>
        </div>
      ) : (
        <div className="tasks-grid">
          {filteredTasks.map(task => {
            const overdue = task.status !== 'Completed' && isOverdue(task.deadline);
            return (
              <div key={task.id} className={`task-card ${overdue ? 'overdue' : task.status === 'Completed' ? 'completed' : 'active-task'}`}>
                <div className="task-card-header">
                  <div>
                    <h3 className="task-title">{task.title}</h3>
                    <Link to={`/projects/${task.project_id}`} className="task-project-name">
                      <FolderKanban size={14} /> {task.project_title || 'Unknown Project'}
                    </Link>
                  </div>
                  <div>
                    {getStatusBadge(task.status)}
                  </div>
                </div>

                <div className="task-description">
                  {task.description ? task.description : <span className="no-desc">No description provided.</span>}
                </div>

                {renderAttachments(task.attachments)}

                <div className="task-meta">
                  <div className="task-meta-item">
                    <Calendar size={15} />
                    <span>Assigned: {new Date(task.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="task-meta-item">
                    <Clock size={15} color={overdue ? '#ef4444' : '#64748b'} />
                    <span className={overdue ? 'text-overdue' : ''} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No Deadline'}
                      {task.deadline && task.status !== 'Completed' && (
                        <span style={{ 
                          fontSize: '0.72rem', 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          background: overdue ? '#fee2e2' : '#e0e7ff', 
                          color: overdue ? '#991b1b' : '#3730a3',
                          fontWeight: '800',
                          letterSpacing: '0.02em'
                        }}>
                          {getRemainingTimeLabel(task.deadline)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="task-actions">
                  <button 
                    className="btn-view"
                    onClick={() => navigate(`/projects/${task.project_id}`)}
                  >
                    <ExternalLink size={16} /> View Project
                  </button>
                  
                  {task.status !== 'Completed' && task.status !== 'Pending Approval' && task.deadline_status === 'Accepted' && (
                    <button 
                      className="btn-complete"
                      onClick={() => handleCompleteTask(task)}
                    >
                      <CheckCircle2 size={16} /> Submit for Approval
                    </button>
                  )}
                  {task.status !== 'Completed' && task.status !== 'Pending Approval' && task.deadline_status !== 'Accepted' && (
                    <span style={{ fontSize: '0.75rem', color: '#b45309', background: '#fffbeb', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #fde68a', fontWeight: '600' }}>
                      ⚠️ Accept deadline to submit
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Deliverable Modal */}
      {submitModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Submit Project Deliverable</h2>
              <button className="close-btn" onClick={() => setSubmitModal({ isOpen: false, projectId: null, stepId: null, projectName: '' })}>
                &times;
              </button>
            </div>
            
            <div style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
              <p style={{ margin: '0 0 1.5rem 0', color: '#334155', fontWeight: '600', fontSize: '0.9rem' }}>Project: {submitModal.projectName}</p>
              
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>FILE / PACKAGE NAME *</label>
                <input 
                  type="text" 
                  value={deliverableName}
                  onChange={(e) => setDeliverableName(e.target.value)}
                  placeholder="e.g. MARKETING - Final Deliverable"
                  style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a' }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>DOWNLOAD LINK / FILE URL *</label>
                <input 
                  type="text" 
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a' }}
                />
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              <button 
                type="button" 
                onClick={() => setSubmitModal({ isOpen: false, projectId: null, stepId: null, projectName: '' })}
                style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={submitDeliverable}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                Submit Deliverable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
