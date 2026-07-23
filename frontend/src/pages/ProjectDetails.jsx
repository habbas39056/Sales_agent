import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, UploadCloud, Download, CheckCircle, Clock, Plus, X, Check, ExternalLink, Image, FileCode, Film, Music, Archive, Upload, Edit, Link2 } from 'lucide-react';
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
    </div>
  );
}
