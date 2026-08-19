import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, UploadCloud, Download, CheckCircle, Clock, Plus, X, Check, ExternalLink, Image, FileCode, Film, Music, Archive, Upload, Edit, Link2, Trash2, AlertCircle } from 'lucide-react';
import StepComments from '../components/StepComments';
import StepInhouseChat from '../components/StepInhouseChat';
import StepActivityLog from '../components/StepActivityLog';
import './ProjectDetails.css';
import './Modal.css';

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
        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <input type="checkbox" checked={isChecked} readOnly style={{ marginTop: '0.25rem' }} />
          <span style={{ textDecoration: isChecked ? 'line-through' : 'none', color: isChecked ? '#94a3b8' : 'inherit' }}>
            {content}
          </span>
        </div>
      );
    }
    
    return (
      <React.Fragment key={idx}>
        {line}
        {idx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // File upload state
  const [uploadName, setUploadName] = useState('');
  
  // Expanded step state
  const [expandedStepId, setExpandedStepId] = useState(null);
  const [activeTab, setActiveTab] = useState('Details');
  const [stepFilter, setStepFilter] = useState('All');

  // Reassign Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [stepToReassign, setStepToReassign] = useState(null);
  const [newDeadline, setNewDeadline] = useState('');
  const [reassignTodos, setReassignTodos] = useState([{ id: Date.now(), text: '', file: null }]);

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [stepToReject, setStepToReject] = useState(null);
  const [rejectDeadline, setRejectDeadline] = useState('');
  const [rejectTodos, setRejectTodos] = useState([{ id: Date.now(), text: '', file: null }]);

  // Submit Deliverable Modal State
  const [submitModal, setSubmitModal] = useState({ isOpen: false, stepId: null });
  const [deliverableName, setDeliverableName] = useState('');
  const [deliverableUrl, setDeliverableUrl] = useState('');

  // Client Reviews State
  const [clientReviews, setClientReviews] = useState([]);
  const [isClientReviewModalOpen, setIsClientReviewModalOpen] = useState(false);
  const [clientReviewForm, setClientReviewForm] = useState({ title: '', description: '', deadline: '', file: null });
  const [isEditReviewModalOpen, setIsEditReviewModalOpen] = useState(false);
  const [editReviewForm, setEditReviewForm] = useState({ id: null, title: '', description: '', deadline: '', file: null });

  const currentUserStr = localStorage.getItem('user');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const canManageSteps = currentUser && ['Admin', 'Project Manager', 'PM', 'Product Manager', 'Production Manager'].includes(currentUser.role);

  useEffect(() => {
    fetchProjectDetails();
    fetchClientReviews();
    if (currentUser) {
      axios.put(`/api/notifications/read-project/${id}`, { user_id: currentUser.id })
        .catch(err => console.error('Failed to mark notifications as read', err));
    }
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      let url = `/api/projects/${id}`;
      if (currentUser) {
        url += `?user_id=${currentUser.id}&role=${encodeURIComponent(currentUser.role)}`;
      }
      const res = await axios.get(url);
      setProject(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch project details', error);
      setLoading(false);
    }
  };

  const fetchClientReviews = async () => {
    try {
      const res = await axios.get(`/api/client-reviews/projects/${id}`);
      setClientReviews(res.data);
    } catch (error) {
      console.error('Failed to fetch client reviews', error);
    }
  };

  const handleClientReviewSubmit = async (e) => {
    e.preventDefault();
    if (!clientReviewForm.title) {
      alert("Title is required.");
      return;
    }

    const formData = new FormData();
    formData.append('title', clientReviewForm.title);
    formData.append('description', clientReviewForm.description);
    if (clientReviewForm.deadline) {
      formData.append('deadline', clientReviewForm.deadline);
    }
    formData.append('file', clientReviewForm.file);

    try {
      await axios.post(`/api/client-reviews/projects/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIsClientReviewModalOpen(false);
      setClientReviewForm({ title: '', description: '', deadline: '', file: null });
      fetchClientReviews();
      alert("Submitted for client review successfully!");
    } catch (error) {
      console.error('Failed to submit client review', error);
      alert('Failed to submit: ' + (error.response?.data?.error || error.message));
    }
  };
  const handleEditReviewClick = (review) => {
    setEditReviewForm({
      id: review.id,
      title: review.title,
      description: review.description || '',
      deadline: review.deadline ? new Date(review.deadline).toISOString().split('T')[0] : '',
      file: null
    });
    setIsEditReviewModalOpen(true);
  };

  const handleEditReviewSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', editReviewForm.title);
    formData.append('description', editReviewForm.description);
    if (editReviewForm.deadline) formData.append('deadline', editReviewForm.deadline);
    if (editReviewForm.file) formData.append('file', editReviewForm.file);
    
    try {
      await axios.put(`/api/client-reviews/${editReviewForm.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIsEditReviewModalOpen(false);
      fetchClientReviews();
      alert('Review updated successfully.');
    } catch (error) {
      console.error('Failed to update review', error);
      alert('Failed to update review.');
    }
  };

  const handleDeleteReview = async (id) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    try {
      await axios.delete(`/api/client-reviews/${id}`);
      fetchClientReviews();
    } catch (error) {
      console.error('Failed to delete review', error);
      alert('Failed to delete review.');
    }
  };

  const handleDeleteStep = async (stepId) => {
    if (!window.confirm("Are you sure you want to delete this step? This action cannot be undone.")) return;
    try {
      await axios.delete(`/api/projects/${id}/steps/${stepId}`);
      fetchProjectDetails();
    } catch (err) {
      console.error('Failed to delete step', err);
      alert(err.response?.data?.error || 'Failed to delete step');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadName) return;
    try {
      await axios.post(`/api/projects/${id}/submit-delivery`, {
        user_id: currentUser ? currentUser.id : 1, 
        file_url: `https://mock-storage.com/${uploadName.replace(/\s+/g, '_').toLowerCase()}.pdf`,
        file_name: uploadName
      });
      setUploadName('');
      fetchProjectDetails(); 
    } catch (error) {
      console.error('Upload failed', error);
      alert('Upload failed');
    }
  };

  const handleStatusChange = async (stepId, newStatus) => {
    try {
      await axios.put(`/api/projects/${id}/steps/${stepId}`, { status: newStatus });
      fetchProjectDetails();
    } catch (error) {
      console.error('Failed to update step status', error);
    }
  };

  const submitDeliverable = async () => {
    if (!deliverableName || !deliverableUrl) {
      alert("Please fill in all required fields.");
      return;
    }
    try {
      await axios.put(`/api/projects/${id}/steps/${submitModal.stepId}`, {
        status: 'Pending Approval',
        deliverable_name: deliverableName,
        deliverable_url: deliverableUrl
      });
      setSubmitModal({ isOpen: false, stepId: null });
      fetchProjectDetails();
    } catch (error) {
      console.error('Failed to submit step for approval', error);
      alert('Failed to update step status: ' + (error.response?.data?.error || error.message));
    }
  };


  const handleForgiveLate = async (stepId, currentVal) => {
    try {
      await axios.post(`/api/projects/${id}/steps/${stepId}/forgive-late`, { forgive: !currentVal });
      fetchProjectDetails();
    } catch(err) {
      console.error('Failed to toggle forgive late', err);
      alert('Failed to update step');
    }
  };

  const handleApproveProject = async () => {
    if (!window.confirm("Are you sure you want to mark this project as completed?")) return;
    try {
      await axios.post(`/api/projects/${id}/approve`);
      alert("Project marked as completed!");
      fetchProjectDetails();
    } catch(err) {
      console.error('Failed to approve project', err);
      alert(err.response?.data?.error || 'Failed to approve project');
    }
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!newDeadline) {
      alert('Please select a new deadline.');
      return;
    }

    const todosData = [];
    const formData = new FormData();
    formData.append('new_deadline', newDeadline);
    formData.append('user_id', currentUser ? currentUser.id : '');

    let fileIndex = 0;
    reassignTodos.forEach(todo => {
      if (todo.text.trim()) {
        const todoItem = { text: todo.text, hasFile: false };
        if (todo.file) {
          formData.append('attachments', todo.file);
          todoItem.hasFile = true;
          todoItem.fileIndex = fileIndex;
          fileIndex++;
        }
        todosData.push(todoItem);
      }
    });

    if (todosData.length === 0) {
      alert('Please provide at least one feedback/to-do item.');
      return;
    }

    formData.append('todos', JSON.stringify(todosData));

    try {
      await axios.post(`/api/projects/${id}/steps/${stepToReassign.id}/reassign`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIsReassignModalOpen(false);
      setStepToReassign(null);
      setNewDeadline('');
      setReassignTodos([{ id: Date.now(), text: '', file: null }]);
      alert('Step successfully reassigned!');
      fetchProjectDetails();
    } catch (err) {
      console.error('Failed to reassign step', err);
      alert(err.response?.data?.error || 'Failed to reassign step');
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectDeadline) {
      alert('Please select a new deadline.');
      return;
    }

    const todosData = [];
    const formData = new FormData();
    formData.append('new_deadline', rejectDeadline);
    formData.append('user_id', currentUser ? currentUser.id : '');

    let fileIndex = 0;
    rejectTodos.forEach(todo => {
      if (todo.text.trim()) {
        const todoItem = { text: todo.text, hasFile: false };
        if (todo.file) {
          formData.append('attachments', todo.file);
          todoItem.hasFile = true;
          todoItem.fileIndex = fileIndex;
          fileIndex++;
        }
        todosData.push(todoItem);
      }
    });

    if (todosData.length === 0) {
      alert('Please provide at least one feedback/to-do item.');
      return;
    }

    formData.append('todos', JSON.stringify(todosData));

    try {
      await axios.post(`/api/projects/${id}/steps/${stepToReject.id}/reject`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIsRejectModalOpen(false);
      setStepToReject(null);
      setRejectDeadline('');
      setRejectTodos([{ id: Date.now(), text: '', file: null }]);
      alert('Step successfully rejected and reassigned!');
      fetchProjectDetails();
    } catch (err) {
      console.error('Failed to reject step', err);
      alert(err.response?.data?.error || 'Failed to reject step');
    }
  };

  const handleApproveStepCommission = async (stepId) => {
    if (!window.confirm("Are you sure you want to release the commission for this step?")) return;
    try {
      await axios.post(`/api/projects/${id}/steps/${stepId}/approve-commission`);
      alert("Step commission released successfully!");
      fetchProjectDetails();
    } catch(err) {
      console.error('Failed to release step commission', err);
      alert(err.response?.data?.error || 'Failed to release step commission');
    }
  };

  if (loading) return <div className="project-details-loading">Loading project...</div>;
  if (!project) return <div style={{ padding: '2rem' }}>Project Not Found</div>;

  const allSteps = project.steps || [];
  const myAssignedSteps = currentUser 
    ? allSteps.filter(s => s.assignee_id === currentUser.id)
    : [];

  const displaySteps = stepFilter === 'My Steps' ? myAssignedSteps : allSteps;

  const totalSteps = allSteps.length;
  const completedSteps = allSteps.filter(s => s.status === 'Completed').length;
  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="project-details-container">
      
      {/* Clean White Header Card matching screenshot */}
      <div className="pd-clean-header">
        <button className="btn-back-clean" onClick={() => navigate('/projects')}>
          <ArrowLeft size={16} /> Back to Projects
        </button>
        
        <div className="pd-header-content">
          <div className="pd-header-info">
            <h1>{project.title}</h1>
            <p className="pd-subtitle">
              <span className="subtitle-label">Client:</span> <span className="subtitle-value">{project.client_name || 'No Client'}</span>
              <span className="subtitle-divider">·</span>
              <span className="subtitle-label">Service:</span> <span className="subtitle-value">{project.service_type || 'Unspecified'}</span>
            </p>
            {project.assigned_members && project.assigned_members.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Team Members:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {project.assigned_members.map(m => (
                    <span key={m.id} style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '600' }}>
                      {m.name} ({m.role})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="pd-header-progress">
            <div className="pd-percent-text">{percent}%</div>
            <div className="pd-percent-label">Completion</div>
            <div className="progress-bar-bg-clean">
              <div className="progress-bar-fill-clean" style={{ width: `${percent}%` }}></div>
            </div>
            
            {project.status !== 'Completed' && project.status !== 'Commission Released' && currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Project Manager' || currentUser.role === 'PM' || currentUser.role === 'Product Manager') && (
              <button 
                onClick={handleApproveProject}
                disabled={percent !== 100}
                title={percent !== 100 ? "All steps must be completed before marking project complete." : "Mark Project Complete"}
                style={{
                  marginTop: '1rem',
                  width: '100%',
                  padding: '0.6rem 1rem',
                  backgroundColor: percent === 100 ? '#10b981' : '#94a3b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: percent === 100 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: percent === 100 ? '0 4px 6px -1px rgba(16, 185, 129, 0.2)' : 'none',
                  opacity: percent === 100 ? 1 : 0.7
                }}
              >
                <CheckCircle size={16} /> Mark Project Complete
              </button>
            )}
            {(project.status === 'Completed' || project.status === 'Commission Released') && (
              <div style={{ marginTop: '1rem', textAlign: 'center', color: '#10b981', fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                <CheckCircle size={15} /> Project Completed
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Workflow Steps Section */}
      <div className="workflow-section">
        <div className="workflow-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Workflow Steps ({totalSteps})</h2>
            {currentUser && myAssignedSteps.length > 0 && (currentUser.role === 'Admin' || project.pm_id == currentUser.id) && (
              <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                <button 
                  type="button"
                  onClick={() => setStepFilter('All')}
                  style={{ 
                    border: 'none', 
                    padding: '0.35rem 0.85rem', 
                    borderRadius: '6px', 
                    fontSize: '0.82rem', 
                    fontWeight: '600', 
                    cursor: 'pointer',
                    backgroundColor: stepFilter === 'All' ? '#ffffff' : 'transparent',
                    color: stepFilter === 'All' ? '#1e293b' : '#64748b',
                    boxShadow: stepFilter === 'All' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  All Steps ({totalSteps})
                </button>
                <button 
                  type="button"
                  onClick={() => setStepFilter('My Steps')}
                  style={{ 
                    border: 'none', 
                    padding: '0.35rem 0.85rem', 
                    borderRadius: '6px', 
                    fontSize: '0.82rem', 
                    fontWeight: '600', 
                    cursor: 'pointer',
                    backgroundColor: stepFilter === 'My Steps' ? '#4f46e5' : 'transparent',
                    color: stepFilter === 'My Steps' ? '#ffffff' : '#64748b',
                    boxShadow: stepFilter === 'My Steps' ? '0 1px 3px rgba(79, 70, 229, 0.3)' : 'none'
                  }}
                >
                  👤 My Assigned Steps ({myAssignedSteps.length})
                </button>
              </div>
            )}
          </div>
          {canManageSteps && (
            <button className="btn-create" onClick={() => navigate(`/projects/${id}/steps/new`)}>
              <Plus size={16} /> Add Step
            </button>
          )}
        </div>

        {displaySteps.length === 0 ? (
          <div className="workflow-empty-state">
            <p>{stepFilter === 'My Steps' ? 'No steps specifically assigned to you in this project.' : 'No steps yet. Click "Add Step" to create your first workflow step.'}</p>
          </div>
        ) : (
          <div className="workflow-list">
            {displaySteps.map((step, index) => {
              const isExpanded = expandedStepId === step.id;
              
              return (
                <div key={step.id} className={`workflow-item ${step.status === 'Completed' ? 'completed' : ''} ${isExpanded ? 'expanded' : ''}`}>
                  <div 
                    className="workflow-item-header" 
                    onClick={() => {
                      if (isExpanded) {
                        setExpandedStepId(null);
                      } else {
                        setExpandedStepId(step.id);
                        setActiveTab('Details');
                      }
                    }}
                  >
                    <div className="workflow-item-left">
                      <div className="step-number">{index + 1}</div>
                      <div className="step-info">
                        <div className="step-title-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h4>{step.title}</h4>
                          {step.status === 'Completed' && <span className="status-badge completed">Completed</span>}
                          {step.status === 'Completed' && step.completed_at && step.deadline && (
                            (() => {
                              const d_deadline = new Date(step.deadline);
                              d_deadline.setHours(23, 59, 59, 999);
                              const d_completed = new Date(step.completed_at);
                              if (d_completed > d_deadline) {
                                return (
                                  <span style={{ background: '#fef2f2', color: '#ef4444', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    ⚠️ Delivered Late {step.forgive_late_commission ? '(Forgiven)' : ''}
                                  </span>
                                );
                              }
                              return null;
                            })()
                          )}
                          {step.assignee_name ? (
                            <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              👤 Assigned to: {step.assignee_name}
                            </span>
                          ) : (
                            <span style={{ background: '#f1f5f9', color: '#94a3b8', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: '500' }}>
                              Unassigned
                            </span>
                          )}

                          {step.deadline && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: '700', 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              background: step.deadline_status === 'Accepted' ? '#d1fae5' : step.deadline_status === 'Appealed' ? '#e0e7ff' : '#fef3c7', 
                              color: step.deadline_status === 'Accepted' ? '#047857' : step.deadline_status === 'Appealed' ? '#3730a3' : '#b45309' 
                            }}>
                              📅 {step.deadline_status === 'Accepted' ? 'Confirmed' : step.deadline_status === 'Appealed' ? `Appealed (${new Date(step.proposed_deadline).toLocaleDateString()})` : 'Pending Acceptance'}: {new Date(step.deadline).toLocaleDateString()}
                            </span>
                          )}

                          {(() => {
                            let itemIds = [];
                            try { itemIds = typeof step.invoice_item_ids === 'string' ? JSON.parse(step.invoice_item_ids) : step.invoice_item_ids; } catch(e){}
                            if (Array.isArray(itemIds) && itemIds.length > 0 && project.invoice && project.invoice.items) {
                              const stepItems = project.invoice.items.filter(item => itemIds.includes(item.id));
                              if (stepItems.length > 0) {
                                return (
                                  <span style={{ background: '#fdf4ff', color: '#c026d3', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    🧾 Items: {stepItems.map(i => i.description).join(', ')} (Rs. {stepItems.reduce((acc, i) => acc + Number(i.total), 0).toLocaleString()})
                                  </span>
                                );
                              }
                            }
                            return null;
                          })()}
                        </div>

                        {(step.deliverable_name || step.deliverable_url) && (
                          <div style={{ marginTop: '0.8rem', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <strong style={{ fontSize: '0.85rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              📦 Submitted Deliverable
                            </strong>
                            {step.deliverable_name && (
                              <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                                <strong style={{ color: '#334155' }}>Name:</strong> {step.deliverable_name}
                              </span>
                            )}
                            {step.deliverable_url && (
                              <span style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                                <strong style={{ color: '#334155' }}>Link:</strong> 
                                <a 
                                  href={step.deliverable_url.startsWith('http') ? step.deliverable_url : `https://${step.deliverable_url}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: '500' }}
                                >
                                  {step.deliverable_url} <ExternalLink size={14} />
                                </a>
                              </span>
                            )}
                          </div>
                        )}

                        {(() => {
                          const todosList = (step.reject_todos && step.reject_todos !== '0' && step.reject_todos !== 0) 
                            ? step.reject_todos 
                            : ((step.reassign_todos && step.reassign_todos !== '0' && step.reassign_todos !== 0) ? step.reassign_todos : null);
                          if (!todosList) return null;
                          let parsedTodos = [];
                          try {
                            parsedTodos = typeof todosList === 'string' ? JSON.parse(todosList) : todosList;
                          } catch (e) {}
                          
                          if (Array.isArray(parsedTodos) && parsedTodos.length > 0) {
                            return (
                              <div style={{ marginTop: '0.8rem', padding: '1rem', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <strong style={{ fontSize: '0.85rem', color: '#e11d48', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase' }}>
                                    ⚠️ FEEDBACK TO-DOS
                                  </strong>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ background: '#e11d48', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                      REASSIGNED
                                    </span>
                                    {step.deadline && (
                                      <span style={{ background: '#fef2f2', color: '#e11d48', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fecaca', fontWeight: 'bold' }}>
                                        Deadline: {new Date(step.deadline).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#4c1d95', fontSize: '0.9rem' }}>
                                  {parsedTodos.map((todo, idx) => (
                                    <li key={idx} style={{ lineHeight: '1.4' }}>
                                      {todo.text}
                                      {todo.file_url && (
                                        <div style={{ marginTop: '0.2rem' }}>
                                          <a href={`http://localhost:5000${todo.file_url}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', background: '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                                            <ExternalLink size={12} /> View Attached File
                                          </a>
                                        </div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          }
                          return null;
                        })()}

                      </div>
                    </div>
                    <div className="workflow-item-right" onClick={(e) => e.stopPropagation()} style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>

                      {canManageSteps && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/projects/${id}/steps/${step.id}/edit`);
                            }}
                            style={{
                              padding: '0.4rem',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#f8fafc',
                              color: '#64748b',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Edit Step"
                          >
                            <Edit size={16} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStep(step.id);
                            }}
                            style={{
                              padding: '0.4rem',
                              borderRadius: '6px',
                              border: '1px solid #fee2e2',
                              backgroundColor: '#fef2f2',
                              color: '#ef4444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Delete Step"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}

                      {step.status === 'Pending Approval' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {canManageSteps ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Are you sure you want to approve this step and mark it as completed?')) {
                                    handleStatusChange(step.id, 'Completed');
                                  }
                                }}
                                style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--success)', color: 'white', fontWeight: '600', cursor: 'pointer' }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStepToReject(step);
                                  setIsRejectModalOpen(true);
                                }}
                                style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: '600', cursor: 'pointer' }}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #f59e0b', backgroundColor: '#fffbeb', color: '#b45309', fontWeight: '600' }}>
                              Pending Approval
                            </span>
                          )}
                        </div>
                      ) : step.status !== 'Completed' ? (
                        canManageSteps || step.deadline_status === 'Accepted' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canManageSteps) {
                                if (window.confirm('Are you sure you want to mark this step as completed?')) {
                                  handleStatusChange(step.id, 'Completed');
                                }
                              } else {
                                setSubmitModal({ isOpen: true, stepId: step.id });
                                setDeliverableName('');
                                setDeliverableUrl('');
                              }
                            }}
                            style={{
                              padding: '0.4rem 0.75rem',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#4f46e5',
                              color: 'white',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            {canManageSteps ? 'Complete Step' : 'Submit for Approval'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#b45309', background: '#fffbeb', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #fde68a', fontWeight: '600' }}>
                            ⚠️ Accept deadline to submit
                          </span>
                        )
                      ) : (
                        <span style={{ 
                          padding: '0.4rem 0.75rem', 
                          borderRadius: '6px', 
                          border: '1px solid var(--success)',
                          backgroundColor: '#dcfce7',
                          color: 'var(--success)',
                          fontWeight: '600'
                        }}>
                          Completed
                        </span>
                      )}
                      
                      {/* Commission and Reassign Buttons for Step */}
                      {step.status === 'Completed' && currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Project Manager' || currentUser.role === 'PM' || currentUser.role === 'Product Manager') && (
                        step.commission_released ? (
                          <span style={{ background: '#dcfce7', color: '#166534', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle size={14} /> Paid
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveStepCommission(step.id);
                              }}
                              style={{
                                padding: '0.4rem 0.75rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                              }}
                            >
                              <CheckCircle size={14} /> Pay Comm.
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setStepToReassign(step);
                                setIsReassignModalOpen(true);
                              }}
                              style={{
                                padding: '0.4rem 0.75rem',
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)'
                              }}
                            >
                              <Clock size={14} /> Reassign
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="step-expanded-content">
                      <div className="step-tabs">
                        {['Details', 'Fields', 'Documents', 'Comments', 'Internal Chat', 'Revisions', 'Invoices', 'Activity'].map(tab => (
                          <button 
                            key={tab} 
                            className={`step-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                      
                      <div className="step-tab-content">
                        {activeTab === 'Details' && (
                          <div className="tab-pane-details">
                            <div className="tp-grid">
                              <div className="tp-col">
                                <label>Description:</label>
                                <div>{step.description ? renderDescriptionWithCheckboxes(step.description) : 'No description provided.'}</div>
                              </div>
                              <div className="tp-col">
                                <label>Assigned To:</label>
                                <p>{step.assignee_name || 'Unassigned'}</p>
                              </div>
                              <div className="tp-col">
                                <label>Due Date:</label>
                                <p>{step.deadline ? new Date(step.deadline).toLocaleDateString() : 'Not set'}</p>
                              </div>
                              <div className="tp-col">
                                <label>Created:</label>
                                <p>{new Date(step.created_at).toLocaleDateString()}</p>
                              </div>
                              {step.completed_at && (
                                <div className="tp-col">
                                  <label>Completed On:</label>
                                  <p>{new Date(step.completed_at).toLocaleString()}</p>
                                </div>
                              )}
                              {step.status === 'Completed' && step.completed_at && step.deadline && new Date(step.completed_at) > new Date(new Date(step.deadline).setHours(23, 59, 59, 999)) && currentUser?.role === 'Admin' && (
                                <div className="tp-col" style={{ gridColumn: '1 / -1', marginTop: '1rem', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                  <label style={{ color: '#b91c1c' }}>Admin Override: Late Delivery Penalty</label>
                                  <p style={{ fontSize: '0.85rem', color: '#7f1d1d', margin: '0.25rem 0 0.75rem 0' }}>This step was delivered after its deadline. By default, the assigned member will receive 0 commission for this step.</p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#991b1b' }}>Forgive late delivery and pay commission?</span>
                                    <label className="toggle-switch" style={{ transform: 'scale(0.8)' }}>
                                      <input 
                                        type="checkbox" 
                                        checked={!!step.forgive_late_commission} 
                                        onChange={() => handleForgiveLate(step.id, step.forgive_late_commission)} 
                                      />
                                      <span className="slider round blue-slider"></span>
                                    </label>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {activeTab === 'Fields' && (
                          <div className="tab-pane-fields">
                            {step.requires_client_form && step.client_form_schema && step.client_form_schema.length > 0 ? (
                              <div className="schema-fields-list">
                                {step.client_form_schema.map((field, idx) => (
                                  <div key={idx} className="schema-field">
                                    <label>{field.label}</label>
                                    <div className="field-answer">
                                      {step.client_form_answers && step.client_form_answers[field.label] 
                                        ? step.client_form_answers[field.label] 
                                        : <span className="unanswered">Waiting for client response... ({field.type})</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="empty-tab-msg">No custom fields defined for this step.</p>
                            )}
                          </div>
                        )}

                        {activeTab === 'Invoices' && (
                          <div className="tab-pane-invoices">
                            {project.invoice ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Top Dropdown Selector + Link Button matching screenshot */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <select 
                                    style={{
                                      flex: 1,
                                      padding: '0.65rem 1rem',
                                      borderRadius: '10px',
                                      border: '1px solid #e2e8f0',
                                      backgroundColor: '#ffffff',
                                      fontSize: '0.9rem',
                                      fontWeight: '500',
                                      color: '#1e293b',
                                      outline: 'none',
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                    }}
                                    value={project.invoice.id}
                                    onChange={() => {}}
                                  >
                                    <option value={project.invoice.id}>
                                      #{project.invoice.invoice_number} · Rs.{Number(project.invoice.amount).toFixed(2)} · {project.invoice.status.toLowerCase()}
                                    </option>
                                  </select>

                                  <button 
                                    type="button" 
                                    title="Open Linked Invoice"
                                    style={{
                                      width: '42px',
                                      height: '42px',
                                      borderRadius: '10px',
                                      backgroundColor: '#4f46e5',
                                      color: '#ffffff',
                                      border: 'none',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justify: 'center',
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                      boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)',
                                      transition: 'transform 0.2s'
                                    }}
                                    onClick={() => navigate(`/invoices/edit/${project.invoice.id}`)}
                                  >
                                    <Link2 size={18} />
                                  </button>
                                </div>

                                {/* Invoice Summary Card matching screenshot layout */}
                                <div style={{
                                  backgroundColor: '#f8fafc',
                                  borderRadius: '12px',
                                  padding: '1.25rem 1.5rem',
                                  border: '1px solid #f1f5f9',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justify: 'space-between',
                                  gap: '1rem',
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ flex: 1, minWidth: '240px' }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#4f46e5' }}>
                                        #{project.invoice.invoice_number}
                                      </span>
                                      <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: '600' }}>
                                        · Rs. {Number(project.invoice.amount).toLocaleString()}
                                      </span>
                                    </div>

                                    {/* Detailed Line items summary */}
                                    {project.invoice.items && project.invoice.items.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                                        {project.invoice.items.map((item, i) => (
                                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
                                            <span>{item.description} (x{item.quantity})</span>
                                            <span style={{ fontWeight: '600' }}>Rs. {Number(item.total).toLocaleString()}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Linked project billing invoice</p>
                                    )}
                                  </div>

                                  {/* Right side Badge & Edit Pencil Icon matching screenshot */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{
                                      fontSize: '0.75rem',
                                      fontWeight: '800',
                                      letterSpacing: '0.05em',
                                      padding: '0.35rem 0.75rem',
                                      borderRadius: '20px',
                                      backgroundColor: project.invoice.status.toLowerCase() === 'paid' ? '#dcfce7' : '#fef9c3',
                                      color: project.invoice.status.toLowerCase() === 'paid' ? '#15803d' : '#a16207',
                                      textTransform: 'UPPERCASE'
                                    }}>
                                      {project.invoice.status.toUpperCase()}
                                    </span>

                                    <button 
                                      type="button" 
                                      title="Edit Invoice"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#cbd5e1',
                                        cursor: 'pointer',
                                        padding: '0.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justify: 'center',
                                        transition: 'color 0.2s'
                                      }}
                                      onMouseOver={(e) => e.currentTarget.style.color = '#4f46e5'}
                                      onMouseOut={(e) => e.currentTarget.style.color = '#cbd5e1'}
                                      onClick={() => navigate(`/invoices/edit/${project.invoice.id}`)}
                                    >
                                      <Edit size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="empty-tab-msg">No invoice is linked to this project.</p>
                            )}
                          </div>
                        )}

                        {activeTab === 'Revisions' && (
                          <div className="tab-pane-revisions">
                            {project.revisions && project.revisions.filter(r => r.step_id === step.id).length > 0 ? (
                              <div className="revisions-list">
                                {project.revisions.filter(r => r.step_id === step.id).map(rev => (
                                  <div key={rev.id} className="revision-card" style={{border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem'}}>
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
                                      <strong>{rev.title}</strong>
                                      <span className="text-secondary">{new Date(rev.requested_at).toLocaleString()}</span>
                                    </div>
                                    <p style={{whiteSpace: 'pre-wrap', margin: '0.5rem 0'}}>{rev.description}</p>
                                    {rev.image_url && (
                                      <div style={{marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem'}}>
                                        {(() => {
                                          let images = [];
                                          try {
                                            images = JSON.parse(rev.image_url);
                                            if (!Array.isArray(images)) images = [rev.image_url];
                                          } catch(e) {
                                            images = [rev.image_url];
                                          }
                                          return images.map((img, i) => (
                                            <a key={i} href={img.startsWith('http') ? img : `${img}`} target="_blank" rel="noreferrer" style={{color: 'var(--primary-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.5rem 1rem', borderRadius: '4px'}}>
                                              <ExternalLink size={16} /> View Attachment {i+1}
                                            </a>
                                          ));
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="empty-tab-msg">No revisions requested for this step.</p>
                            )}
                          </div>
                        )}

                        {activeTab === 'Documents' && (
                          <div className="tab-pane-documents">
                            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>Step Files & Attachments</h4>
                              <label className="btn-create" style={{ cursor: 'pointer', padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Upload size={14} /> Add Files
                                <input 
                                  type="file" 
                                  multiple 
                                  style={{ display: 'none' }}
                                  onChange={async (e) => {
                                    if (!e.target.files || e.target.files.length === 0) return;
                                    const fileData = new FormData();
                                    Array.from(e.target.files).forEach(f => fileData.append('documents', f));
                                    try {
                                      await axios.post(`/api/projects/${id}/steps/${step.id}/documents`, fileData);
                                      fetchProjectDetails();
                                    } catch(err) {
                                      console.error('Failed to upload documents', err);
                                      alert('Failed to upload files');
                                    }
                                  }}
                                />
                              </label>
                            </div>

                            {step.attachments ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                {(() => {
                                  try {
                                    let files = JSON.parse(step.attachments);
                                    if (!Array.isArray(files)) files = [step.attachments];

                                    return files.map((file, idx) => {
                                      const fileName = file.split('/').pop();
                                      const ext = fileName.split('.').pop().toLowerCase();
                                      
                                      let IconComp = FileText;
                                      let tagColor = '#475569';
                                      let tagBg = '#f1f5f9';

                                      if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
                                        IconComp = Image;
                                        tagColor = '#2563eb';
                                        tagBg = '#dbeafe';
                                      } else if (['pdf'].includes(ext)) {
                                        IconComp = FileText;
                                        tagColor = '#dc2626';
                                        tagBg = '#fee2e2';
                                      } else if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
                                        IconComp = FileText;
                                        tagColor = '#1d4ed8';
                                        tagBg = '#eff6ff';
                                      } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
                                        IconComp = FileText;
                                        tagColor = '#166534';
                                        tagBg = '#dcfce7';
                                      } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
                                        IconComp = Archive;
                                        tagColor = '#d97706';
                                        tagBg = '#fef3c7';
                                      } else if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) {
                                        IconComp = Film;
                                        tagColor = '#9333ea';
                                        tagBg = '#f3e8ff';
                                      } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
                                        IconComp = Music;
                                        tagColor = '#0891b2';
                                        tagBg = '#cff4fc';
                                      } else if (['html', 'js', 'json', 'css', 'py', 'php'].includes(ext)) {
                                        IconComp = FileCode;
                                        tagColor = '#4f46e5';
                                        tagBg = '#e0e7ff';
                                      }

                                      return (
                                        <a 
                                          key={idx} 
                                          href={`${file}`} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '0.6rem', 
                                            padding: '0.6rem 1rem', 
                                            backgroundColor: '#ffffff', 
                                            border: '1px solid #cbd5e1', 
                                            borderRadius: '6px', 
                                            textDecoration: 'none', 
                                            color: '#1e293b',
                                            fontSize: '0.9rem',
                                            fontWeight: '500',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                            transition: 'border-color 0.2s'
                                          }}
                                        >
                                          <IconComp size={18} style={{ color: tagColor }} /> 
                                          <span>{fileName}</span>
                                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: tagBg, color: tagColor, fontWeight: '700', marginLeft: '0.25rem' }}>
                                            {ext}
                                          </span>
                                        </a>
                                      );
                                    });
                                  } catch(e) { return <p className="empty-tab-msg">Failed to load attachments.</p>; }
                                })()}
                              </div>
                            ) : (
                              <p className="empty-tab-msg">No documents attached to this step yet. Click "Add Files" above to upload.</p>
                            )}
                          </div>
                        )}

                        {activeTab === 'Comments' && (
                          <StepComments stepId={step.id} />
                        )}

                        {activeTab === 'Internal Chat' && (
                          <StepInhouseChat stepId={step.id} />
                        )}

                        {activeTab === 'Activity' && (
                          <StepActivityLog stepId={step.id} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Client Reviews Section */}
      <div className="workflow-section" style={{ marginBottom: '2rem', marginTop: '2rem' }}>
        <div className="workflow-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Client Reviews ({clientReviews.length})</h2>
          </div>
          {canManageSteps && (
            <button className="btn-create" onClick={() => setIsClientReviewModalOpen(true)}>
              <UploadCloud size={16} /> Submit for Client Review
            </button>
          )}
        </div>
        
        {clientReviews.length === 0 ? (
          <div className="workflow-empty-state">
            <p>No submissions for client review yet.</p>
          </div>
        ) : (
          <div className="workflow-list">
            {clientReviews.map((review, index) => (
              <div key={review.id} className="workflow-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="workflow-item-header" style={{ cursor: 'default' }}>
                  <div className="workflow-item-left">
                    <div className="step-number" style={{ background: '#f59e0b' }}>R{index + 1}</div>
                    <div className="step-info">
                      <div className="step-title-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h4>{review.title}</h4>
                        <span style={{ 
                          fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '12px',
                          background: review.status === 'Approved' ? '#d1fae5' : review.status === 'Revision Requested' ? '#fef2f2' : '#fef3c7',
                          color: review.status === 'Approved' ? '#047857' : review.status === 'Revision Requested' ? '#ef4444' : '#b45309'
                        }}>
                          {review.status}
                        </span>
                        {review.deadline && (
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', background: '#e0e7ff', color: '#3730a3' }}>
                            📅 Deadline: {new Date(review.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: '#64748b' }}>{review.description}</p>
                      
                      <a href={review.file_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#4f46e5', textDecoration: 'none', fontWeight: '600', background: '#f5f3ff', padding: '0.35rem 0.75rem', borderRadius: '6px' }}>
                        <FileText size={14} /> View Submitted File
                      </a>
                    </div>
                  </div>
                  {canManageSteps && (
                    <div className="workflow-item-right" style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                      <button className="btn-icon" onClick={() => handleEditReviewClick(review)} title="Edit Review">
                        <Edit size={16} />
                      </button>
                      <button className="btn-icon" onClick={() => handleDeleteReview(review.id)} title="Delete Review" style={{ color: '#ef4444' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                
                {review.status === 'Revision Requested' && review.feedback_todos && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#be123c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertCircle size={16} /> Client Feedback & To-Dos
                    </h5>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem', color: '#881337' }}>
                      {(() => {
                        let todos = [];
                        try {
                          if (review.feedback_todos) {
                            todos = typeof review.feedback_todos === 'string' ? JSON.parse(review.feedback_todos) : review.feedback_todos;
                          }
                        } catch (e) {}
                        return Array.isArray(todos) ? todos.map((todo, i) => (
                          <li key={i} style={{ marginBottom: '0.25rem' }}>{todo.text || todo}</li>
                        )) : null;
                      })()}
                    </ul>
                    
                    {(() => {
                      let atts = [];
                      try {
                        if (review.feedback_attachments) {
                          atts = typeof review.feedback_attachments === 'string' ? JSON.parse(review.feedback_attachments) : review.feedback_attachments;
                        }
                      } catch (e) {}
                      if (!Array.isArray(atts) || atts.length === 0) return null;
                      return (
                        <div style={{ marginTop: '0.75rem' }}>
                          <strong style={{ fontSize: '0.8rem', color: '#be123c' }}>Attachments:</strong>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            {atts.map((att, i) => (
                              <a key={i} href={att} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#e11d48', background: '#ffe4e6', padding: '0.25rem 0.5rem', borderRadius: '4px', textDecoration: 'none' }}>
                                <Download size={12} /> File {i + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Reject Step Modal */}
      {isRejectModalOpen && stepToReject && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Reject & Reassign Step</h2>
              <button className="modal-close" onClick={() => setIsRejectModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRejectSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  New Deadline for "{stepToReject.title}"
                </label>
                <input 
                  type="date" 
                  required
                  value={rejectDeadline}
                  onChange={(e) => setRejectDeadline(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '800', fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase' }}>
                  FEEDBACK TO-DOS
                </label>
                
                {rejectTodos.map((todo, index) => (
                  <div key={todo.id} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="text"
                        value={todo.text}
                        onChange={(e) => {
                          const newTodos = [...rejectTodos];
                          newTodos[index].text = e.target.value;
                          setRejectTodos(newTodos);
                        }}
                        placeholder={`Change requested #${index + 1}...`}
                        style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', color: todo.file ? '#10b981' : '#64748b' }}>
                        <Image size={18} />
                        <input 
                          type="file" 
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              const newTodos = [...rejectTodos];
                              newTodos[index].file = e.target.files[0];
                              setRejectTodos(newTodos);
                            }
                          }}
                        />
                      </label>

                      {rejectTodos.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => {
                            const newTodos = rejectTodos.filter(t => t.id !== todo.id);
                            setRejectTodos(newTodos);
                          }}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', border: '1px solid #fecaca', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#ef4444' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    {todo.file && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                        1 file(s) attached: {todo.file.name}
                      </div>
                    )}
                  </div>
                ))}
                
                <button 
                  type="button" 
                  onClick={() => setRejectTodos([...rejectTodos, { id: Date.now(), text: '', file: null }])}
                  style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Plus size={16} /> Add Another Point
                </button>
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsRejectModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Confirm Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Step Modal */}
      {isReassignModalOpen && stepToReassign && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Reassign Step</h2>
              <button className="modal-close" onClick={() => setIsReassignModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleReassignSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Select New Deadline for "{stepToReassign.title}"
                </label>
                <input 
                  type="date" 
                  required
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <small style={{ display: 'block', marginTop: '0.5rem', color: '#64748b' }}>
                  This will reset the step status back to 'Pending' and send it back to the assigned team member.
                </small>
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '800', fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase' }}>
                  FEEDBACK TO-DOS
                </label>
                
                {reassignTodos.map((todo, index) => (
                  <div key={todo.id} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="text"
                        value={todo.text}
                        onChange={(e) => {
                          const newTodos = [...reassignTodos];
                          newTodos[index].text = e.target.value;
                          setReassignTodos(newTodos);
                        }}
                        placeholder={`Change requested #${index + 1}...`}
                        style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', color: todo.file ? '#10b981' : '#64748b' }}>
                        <Image size={18} />
                        <input 
                          type="file" 
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              const newTodos = [...reassignTodos];
                              newTodos[index].file = e.target.files[0];
                              setReassignTodos(newTodos);
                            }
                          }}
                        />
                      </label>

                      {reassignTodos.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => {
                            const newTodos = reassignTodos.filter(t => t.id !== todo.id);
                            setReassignTodos(newTodos);
                          }}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', border: '1px solid #fecaca', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#ef4444' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    {todo.file && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                        1 file(s) attached: {todo.file.name}
                      </div>
                    )}
                  </div>
                ))}
                
                <button 
                  type="button" 
                  onClick={() => setReassignTodos([...reassignTodos, { id: Date.now(), text: '', file: null }])}
                  style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Plus size={16} /> Add Another Point
                </button>
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsReassignModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Confirm Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Deliverable Modal (for step level) */}
      {submitModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Submit Project Deliverable</h2>
              <button className="close-btn" onClick={() => setSubmitModal({ isOpen: false, stepId: null })}>
                &times;
              </button>
            </div>
            
            <div style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
              <p style={{ margin: '0 0 1.5rem 0', color: '#334155', fontWeight: '600', fontSize: '0.9rem' }}>Project: {project.title}</p>
              
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
                onClick={() => setSubmitModal({ isOpen: false, stepId: null })}
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
    {/* Client Review Submit Modal */}
      {isClientReviewModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h2>Submit to Client for Review</h2>
              <button className="btn-close" onClick={() => setIsClientReviewModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleClientReviewSubmit} style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>TITLE *</label>
                <input 
                  type="text" 
                  value={clientReviewForm.title}
                  onChange={(e) => setClientReviewForm({...clientReviewForm, title: e.target.value})}
                  placeholder="e.g. Logo Design - Draft 1"
                  required
                  style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>DESCRIPTION</label>
                <textarea 
                  value={clientReviewForm.description}
                  onChange={(e) => setClientReviewForm({...clientReviewForm, description: e.target.value})}
                  placeholder="Provide context for the client..."
                  rows="3"
                  style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>DELIVERABLE FILE</label>
                <input 
                  type="file" 
                  onChange={(e) => setClientReviewForm({...clientReviewForm, file: e.target.files[0]})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>REVIEW DEADLINE</label>
                <input 
                  type="date" 
                  value={clientReviewForm.deadline}
                  onChange={(e) => setClientReviewForm({...clientReviewForm, deadline: e.target.value})}
                  style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                <button 
                  type="button" 
                  onClick={() => setIsClientReviewModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '0.6rem 1.25rem', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Submit to Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {isEditReviewModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <h2>Edit Client Review</h2>
              <button className="btn-close" onClick={() => setIsEditReviewModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditReviewSubmit} style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>TITLE *</label>
                <input 
                  type="text" 
                  required
                  value={editReviewForm.title}
                  onChange={(e) => setEditReviewForm({...editReviewForm, title: e.target.value})}
                  placeholder="e.g. Website Mockup V1"
                  style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>DESCRIPTION (OPTIONAL)</label>
                <textarea 
                  rows={3}
                  value={editReviewForm.description}
                  onChange={(e) => setEditReviewForm({...editReviewForm, description: e.target.value})}
                  placeholder="Any context the client should know..."
                  style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>NEW FILE (OPTIONAL)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
                  <input 
                    type="file" 
                    onChange={(e) => setEditReviewForm({...editReviewForm, file: e.target.files[0]})}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <small style={{ display: 'block', marginTop: '0.5rem', color: '#64748b' }}>Leave blank to keep existing file.</small>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>DEADLINE (OPTIONAL)</label>
                <input 
                  type="date" 
                  value={editReviewForm.deadline}
                  onChange={(e) => setEditReviewForm({...editReviewForm, deadline: e.target.value})}
                  style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                <button 
                  type="button" 
                  onClick={() => setIsEditReviewModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '0.6rem 1.25rem', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
