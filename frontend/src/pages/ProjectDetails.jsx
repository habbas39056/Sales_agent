import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, UploadCloud, Download, CheckCircle, Clock, Plus, X, Check, ExternalLink } from 'lucide-react';
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

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      const res = await axios.get(`/api/projects/${id}`);
      setProject(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch project details', error);
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadName) return;
    try {
      await axios.post(`/api/projects/${id}/submit-delivery`, {
        user_id: 1, 
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

  const handleToggleRevisionOption = async (stepId, currentOption) => {
    try {
      await axios.put(`/api/projects/${id}/steps/${stepId}`, { allow_revision: !currentOption });
      fetchProjectDetails();
    } catch (error) {
      console.error('Failed to update revision option', error);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading Project...</div>;
  if (!project) return <div style={{ padding: '2rem' }}>Project Not Found</div>;

  const steps = project.steps || [];
  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.status === 'Completed').length;
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
          </div>
          
          <div className="pd-header-progress">
            <div className="pd-percent-text">{percent}%</div>
            <div className="pd-percent-label">Completion</div>
            <div className="progress-bar-bg-clean">
              <div className="progress-bar-fill-clean" style={{ width: `${percent}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Steps Section */}
      <div className="workflow-section">
        <div className="workflow-header">
          <h2>Workflow Steps ({totalSteps})</h2>
          <button className="btn-create" onClick={() => navigate(`/projects/${id}/steps/new`)}>
            <Plus size={16} /> Add Step
          </button>
        </div>

        {totalSteps === 0 ? (
          <div className="workflow-empty-state">
            <p>No steps yet. Click "Add Step" to create your first workflow step.</p>
          </div>
        ) : (
          <div className="workflow-list">
            {steps.map((step, index) => {
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
                        <div className="step-title-row">
                          <h4>{step.title}</h4>
                          {step.status === 'Completed' && <span className="status-badge completed">Completed</span>}
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
                      <select 
                        value={step.status || 'Pending'} 
                        onChange={(e) => handleStatusChange(step.id, e.target.value)}
                        className={`status-dropdown ${step.status === 'Completed' ? 'completed' : step.status === 'In Progress' ? 'in-progress' : 'pending'}`}
                        style={{ 
                          padding: '0.4rem 0.75rem', 
                          borderRadius: '6px', 
                          border: '1px solid var(--border-color)', 
                          outline: 'none',
                          backgroundColor: step.status === 'Completed' ? 'var(--success)' : step.status === 'In Progress' ? 'var(--warning)' : '#f1f5f9',
                          color: step.status === 'Pending' ? 'var(--text-primary)' : 'white',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
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
                            {step.requires_payment ? (
                              project.invoice ? (
                                <div className="linked-invoice-box">
                                  <FileText size={20} />
                                  <div className="inv-info">
                                    <strong>{project.invoice.invoice_number}</strong>
                                    <span>PKR {project.invoice.amount} - {project.invoice.status}</span>
                                  </div>
                                </div>
                              ) : (
                                <p className="empty-tab-msg">Payment is required, but no invoice is linked to this project.</p>
                              )
                            ) : (
                              <p className="empty-tab-msg">No payment required for this step.</p>
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
                            {step.attachments ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                {(() => {
                                  try {
                                    const files = JSON.parse(step.attachments);
                                    return files.map((file, idx) => {
                                      const fileName = file.split('/').pop();
                                      const isImg = file.match(/\.(jpeg|jpg|gif|png)$/i);
                                      return (
                                        <a key={idx} href={`${file}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', textDecoration: 'none', color: 'var(--primary-color)' }}>
                                          <ExternalLink size={16} /> {fileName}
                                        </a>
                                      );
                                    });
                                  } catch(e) { return <p className="empty-tab-msg">Failed to load attachments.</p>; }
                                })()}
                              </div>
                            ) : (
                              <p className="empty-tab-msg">No documents attached to this step.</p>
                            )}
                          </div>
                        )}

                        {['Comments', 'Activity'].includes(activeTab) && (
                          <div className="tab-pane-placeholder">
                            <p className="empty-tab-msg">No {activeTab.toLowerCase()} yet.</p>
                          </div>
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
    </div>
  );
}
