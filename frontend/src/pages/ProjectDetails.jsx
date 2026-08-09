import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, UploadCloud, Download, CheckCircle, Clock, Plus, X, Check, ExternalLink, Image, FileCode, Film, Music, Archive, Upload, Edit, Link2, Trash2 } from 'lucide-react';
import StepComments from '../components/StepComments';
import StepActivityLog from '../components/StepActivityLog';
import './ProjectDetails.css';
import './Modal.css';

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

  const currentUserStr = localStorage.getItem('user');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const canManageSteps = currentUser && ['Admin', 'Project Manager', 'PM', 'Product Manager', 'Production Manager'].includes(currentUser.role);

  useEffect(() => {
    fetchProjectDetails();
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

  const handleToggleRevisionOption = async (stepId, currentVal) => {
    try {
      await axios.put(`/api/projects/${id}/steps/${stepId}`, { allow_revision: !currentVal });
      fetchProjectDetails();
    } catch(err) {
      console.error('Failed to toggle revision option', err);
      alert('Failed to update step');
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
    try {
      await axios.post(`/api/projects/${id}/steps/${stepToReassign.id}/reassign`, {
        new_deadline: newDeadline
      });
      setIsReassignModalOpen(false);
      setStepToReassign(null);
      setNewDeadline('');
      alert('Step successfully reassigned!');
      fetchProjectDetails();
    } catch (err) {
      console.error('Failed to reassign step', err);
      alert(err.response?.data?.error || 'Failed to reassign step');
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
                      </div>
                    </div>
                    <div className="workflow-item-right" onClick={(e) => e.stopPropagation()} style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                      <div className="revision-toggle" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Allow Revision</span>
                        <label className="toggle-switch" style={{transform: 'scale(0.8)'}}>
                          <input 
                            type="checkbox" 
                            checked={!!step.allow_revision} 
                            onChange={() => handleToggleRevisionOption(step.id, step.allow_revision)} 
                          />
                          <span className="slider round blue-slider"></span>
                        </label>
                      </div>

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

                      {step.status !== 'Completed' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to mark this step as completed?')) {
                              handleStatusChange(step.id, 'Completed');
                            }
                          }}
                          style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: 'var(--success)',
                            color: 'white',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Complete Step
                        </button>
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
                        {['Details', 'Fields', 'Documents', 'Comments', 'Revisions', 'Invoices', 'Activity'].map(tab => (
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
                                <p>{step.description || 'No description provided.'}</p>
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

    </div>
  );
}
