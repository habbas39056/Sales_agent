import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, CreditCard, Folder, StickyNote, Check, Eye, Printer, X, ChevronRight, Lock, LogOut, Plus, Edit, Trash2, MessageSquare } from 'lucide-react';
import StepComments from '../components/StepComments';
import './ClientPortal.css';

export default function ClientPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [expandedRevisions, setExpandedRevisions] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [termsAndConditions, setTermsAndConditions] = useState('');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchPortalData();
  }, []);

  const fetchPortalData = async () => {
    try {
      axios.get('/api/settings').then(res => {
        if (res.data && res.data.terms_and_conditions) {
          setTermsAndConditions(res.data.terms_and_conditions);
        }
      }).catch(err => console.error(err));

      const userStr = localStorage.getItem('user');
      if (!userStr) {
        setLoading(false);
        return;
      }
      const user = JSON.parse(userStr);
      
      const res = await axios.get(`/api/clients/user/${user.id}/portal-data`);
      setPortalData(res.data);
      setLoading(false);
      
      if (selectedProject) {
        const updatedProject = res.data.projects.find(p => p.id === selectedProject.id);
        if (updatedProject) setSelectedProject(updatedProject);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const acceptTerms = async (projectId) => {
    try {
      await axios.post(`/api/projects/${projectId}/accept-terms`);
      fetchPortalData();
    } catch (e) { console.error(e); }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingNote) {
        await axios.put(`/api/clients/notes/${editingNote.id}`, { content: noteContent });
      } else {
        await axios.post(`/api/clients/notes`, { 
          client_id: portalData.client.id, 
          content: noteContent, 
          created_by: currentUser.id 
        });
      }
      setIsNoteModalOpen(false);
      setEditingNote(null);
      setNoteContent('');
      fetchPortalData();
    } catch (error) { console.error('Failed to save note:', error); }
  };

  const handleNoteDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this note?')) {
      try {
        await axios.delete(`/api/clients/notes/${id}`);
        fetchPortalData();
      } catch(e) { console.error(e); }
    }
  };

  if (loading) return <div className="portal-loading">Loading your portal...</div>;
  if (!portalData || !portalData.client) return (
    <div className="portal-loading">
      <p style={{marginBottom: '1rem'}}>Client profile not found. Make sure you are logged in correctly.</p>
      <button className="btn btn-primary" onClick={handleLogout}>Log Out & Try Again</button>
    </div>
  );

  const { client, invoices, payments, projects, files, textNotes } = portalData;
  const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balance), 0);

  return (
    <div className="app-container">
      {/* Admin-like Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="client-avatar">
              {client.full_name.charAt(0)}
            </div>
            <div className="client-info">
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'white', fontWeight: '600' }}>{client.full_name}</h4>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{client.business_name || 'Personal Account'}</span>
            </div>
          </div>
        </div>

        <div className="sidebar-menu-title">Portal Menu</div>
        <ul className="nav-links">
          <li>
            <button className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => {setActiveTab('dashboard'); setSelectedProject(null);}}>
              <LayoutDashboard size={20} /> Dashboard
            </button>
          </li>
          <li>
            <button className={`nav-button ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => {setActiveTab('invoices'); setSelectedProject(null);}}>
              <FileText size={20} /> Invoices
            </button>
          </li>
          <li>
            <button className={`nav-button ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => {setActiveTab('payments'); setSelectedProject(null);}}>
              <CreditCard size={20} /> Payments
            </button>
          </li>
          <li>
            <button className={`nav-button ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => {setActiveTab('projects'); setSelectedProject(null);}}>
              <Folder size={20} /> Projects
            </button>
          </li>
          <li>
            <button className={`nav-button ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => {setActiveTab('notes'); setSelectedProject(null);}}>
              <StickyNote size={20} /> Files & Notes
            </button>
          </li>
        </ul>

        <div className="sidebar-footer" style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button 
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', 
              padding: '0.75rem 1rem', background: 'transparent', border: 'none', 
              color: '#ef4444', fontSize: '1rem', fontWeight: '500', 
              cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s ease',
              fontFamily: 'inherit'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="portal-content-area">
          <header className="portal-topbar">
            <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
            <p className="portal-subtitle">Manage your account and projects</p>
          </header>
          
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div>
              <div className="portal-dashboard-grid">
                <div className="portal-stat-card">
                  <h3>Active Projects</h3>
                  <div className="portal-stat-value">{projects.filter(p => p.status !== 'Completed').length}</div>
                </div>
                <div className="portal-stat-card">
                  <h3>Total Invoices</h3>
                  <div className="portal-stat-value">{invoices.length}</div>
                </div>
                <div className="portal-stat-card warning">
                  <h3>Outstanding Balance</h3>
                  <div className="portal-stat-value">PKR {totalOutstanding.toFixed(2)}</div>
                </div>
              </div>
              
              <div className="card" style={{marginTop: '2rem'}}>
                <h3>Recent Activity</h3>
                <p className="text-secondary" style={{marginTop: '0.5rem'}}>Welcome to your dedicated client portal. Navigate using the sidebar to view your projects, invoices, and finances.</p>
              </div>
            </div>
          )}

          {/* INVOICES TAB */}
          {activeTab === 'invoices' && (
            <div className="card">
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>INVOICE NO</th>
                      <th>DATE</th>
                      <th>DUE DATE</th>
                      <th>AMOUNT</th>
                      <th>BALANCE</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id}>
                        <td><strong>{inv.invoice_number}</strong></td>
                        <td>{new Date(inv.issue_date).toLocaleDateString()}</td>
                        <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                        <td>PKR {Number(inv.amount).toFixed(2)}</td>
                        <td style={{ color: inv.balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>PKR {Number(inv.balance).toFixed(2)}
                        </td>
                        <td><span className={`badge badge-${inv.status.toLowerCase() === 'paid' ? 'success' : (inv.status === 'Overdue' ? 'danger' : 'warning')}`}>{inv.status}</span></td>
                        <td>
                          <button className="btn-icon view-btn" style={{background:'none', border:'none', cursor:'pointer'}} onClick={() => setPreviewInvoice(inv)} title="View Invoice">
                            <Eye size={20} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && <tr><td colSpan="7" className="empty-state">No invoices found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className="card">
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>DATE</th>
                      <th>INVOICE</th>
                      <th>METHOD</th>
                      <th>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(pay => (
                      <tr key={pay.id}>
                        <td>{new Date(pay.payment_date).toLocaleDateString()}</td>
                        <td><strong>{pay.invoice_number}</strong></td>
                        <td>{pay.payment_method}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>+ ${Number(pay.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                    {payments.length === 0 && <tr><td colSpan="4" className="empty-state">No payment history found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PROJECTS TAB */}
          {activeTab === 'projects' && !selectedProject && (
            <div className="portal-project-grid">
              {projects.map(p => (
                <div key={p.id} className="portal-project-card" onClick={() => setSelectedProject(p)}>
                  <div className="project-card-header">
                    <h4>{p.title}</h4>
                    <span className={`badge badge-${p.status === 'Completed' ? 'success' : 'warning'}`}>{p.status}</span>
                  </div>
                  <p className="project-desc">{p.description}</p>
                  <div className="project-meta">
                    <span><strong>Terms:</strong> {p.terms_accepted ? <span style={{color:'var(--success)'}}>Accepted</span> : <span style={{color:'var(--danger)'}}>Pending</span>}</span>
                    <span><strong>Deadline:</strong> {new Date(p.locked_deadline).toLocaleDateString()}</span>
                  </div>
                  <button className="btn btn-primary" style={{marginTop: '1.5rem', width: '100%'}}>Open Workspace</button>
                </div>
              ))}
              {projects.length === 0 && <p className="text-secondary">No projects assigned yet.</p>}
            </div>
          )}

          {/* PROJECT WORKSPACE */}
          {activeTab === 'projects' && selectedProject && (
            <div className="project-workspace">
              <button className="btn-link" onClick={() => setSelectedProject(null)} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '1rem', cursor: 'pointer', padding: 0 }}>
                <ChevronRight size={18} style={{transform: 'rotate(180deg)'}}/> Back to Projects
              </button>
              
              <div className="workspace-header">
                <h2>{selectedProject.title}</h2>
                <span className={`badge badge-${selectedProject.status === 'Completed' ? 'success' : 'warning'}`}>{selectedProject.status}</span>
              </div>

              {!selectedProject.terms_accepted ? (
                <div className="terms-gateway">
                  <div className="lock-icon-wrapper">
                    <Lock size={40} />
                  </div>
                  <h3 style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>Project Locked</h3>
                  <p className="text-secondary" style={{textAlign: 'center', maxWidth: '600px', margin: '0 auto 2rem'}}>
                    Before we begin work on this project, please review and accept the terms and conditions, including our revision policy.
                  </p>
                  <div className="terms-box">
                    <h4>Terms & Conditions</h4>
                    {selectedProject.terms_and_conditions ? (
                      <div style={{marginBottom: '1.5rem', paddingBottom: '1.5rem'}}>
                        <p style={{whiteSpace: 'pre-wrap', margin: 0}}>{selectedProject.terms_and_conditions}</p>
                      </div>
                    ) : (
                      <p className="text-secondary">Please review and accept the terms of the project to continue.</p>
                    )}
                  </div>

                  <div className="terms-actions">
                    <button className="btn btn-primary" style={{display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 2rem', fontSize: '1.1rem'}} onClick={() => acceptTerms(selectedProject.id)}>
                      <Check size={20} /> I Accept the Terms
                    </button>
                  </div>
                </div>
              ) : (
                <div className="project-steps-view">
                  <div style={{display: 'flex', gap: '1rem', marginBottom: '2rem'}}>
                    <div className="card" style={{flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', margin: 0}}>
                      <h4 style={{margin: 0, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Check size={20} /> Terms Accepted</h4>
                      <p style={{margin: '0.5rem 0 0 0', color: 'var(--text-secondary)'}}>The project workspace is unlocked and ready.</p>
                    </div>
                    <div className="card" style={{flex: 1, backgroundColor: '#f8fafc', borderColor: '#e2e8f0', margin: 0}}>
                      <h4 style={{margin: 0, color: 'var(--text-primary)'}}>Revision Cycles</h4>
                      <p style={{margin: '0.5rem 0 0 0', color: 'var(--text-secondary)'}}>You have <strong>{selectedProject.revision_cycles_remaining}</strong> of <strong>{selectedProject.revision_cycles_included}</strong> free revisions remaining.</p>
                    </div>
                  </div>
                  
                  <h3 style={{marginBottom: '1.5rem'}}>Project Timeline & Steps</h3>
                  <div className="client-steps-list">
                    {selectedProject.steps && selectedProject.steps.length > 0 ? (
                      selectedProject.steps.map((step, index) => {
                        // Check if a revision exists for this step
                        const stepRevisions = selectedProject.revisions ? selectedProject.revisions.filter(r => r.step_id === step.id) : [];
                        const hasRevision = stepRevisions.length > 0;
                        const isExpanded = expandedRevisions[step.id];

                        return (
                          <div key={step.id} className="client-step-card">
                            <div className="step-number">{index + 1}</div>
                            <div className="step-content">
                              <h4>{step.title}</h4>
                              <p>{step.description}</p>
                              <div className="step-meta">
                                <span className={`badge badge-${step.status === 'Completed' ? 'success' : step.status === 'In Progress' ? 'primary' : 'warning'}`}>{step.status}</span>
                              </div>
                              
                              {step.attachments && (
                                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  <h5 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Folder size={16} /> Attached Files
                                  </h5>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {(() => {
                                      try {
                                        const files = JSON.parse(step.attachments);
                                        return files.map((file, idx) => {
                                          const fileName = file.split('/').pop();
                                          const isImg = file.match(/\.(jpeg|jpg|gif|png)$/i);
                                          return (
                                            <a key={idx} href={`${file}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', textDecoration: 'none', color: 'var(--primary-color)', fontSize: '0.85rem' }}>
                                              {isImg ? <Eye size={14} /> : <FileText size={14} />} {fileName}
                                            </a>
                                          );
                                        });
                                      } catch(e) { return null; }
                                    })()}
                                  </div>
                                </div>
                              )}
                              
                              {/* Revision & Comments Buttons */}
                              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                {!!step.allow_revision && !hasRevision && (
                                  <button 
                                    className="btn" 
                                    style={{ backgroundColor: '#e2e8f0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #cbd5e1' }}
                                    onClick={() => navigate(`/client-portal/revision/${selectedProject.id}/${step.id}`)}
                                  >
                                    <Edit size={16} /> Revision Required
                                  </button>
                                )}

                                <button 
                                  className="btn-link" 
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                  onClick={() => setExpandedComments(prev => ({ ...prev, [step.id]: !prev[step.id] }))}
                                >
                                  <MessageSquare size={16} /> {expandedComments[step.id] ? 'Hide Comments & Chat' : 'Comments & Discussion'}
                                </button>
                              </div>

                              {/* Comments Chat Drawer */}
                              {expandedComments[step.id] && (
                                <div style={{ marginTop: '1rem' }}>
                                  <StepComments stepId={step.id} currentUser={currentUser} />
                                </div>
                              )}

                              {/* If revision exists, show View Revision button */}
                              {hasRevision && (
                                <div style={{marginTop: '1rem'}}>
                                  <button 
                                    className="btn-link" 
                                    style={{display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold'}}
                                    onClick={() => setExpandedRevisions(prev => ({...prev, [step.id]: !prev[step.id]}))}
                                  >
                                    <Eye size={16} /> {isExpanded ? 'Hide Requested Revision' : 'View Requested Revision'}
                                  </button>

                                  {isExpanded && (
                                    <div style={{marginTop: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderLeft: '4px solid var(--danger)', borderRadius: '4px'}}>
                                      {stepRevisions.map(rev => (
                                        <div key={rev.id} style={{marginBottom: '1.5rem'}}>
                                          <h5 style={{margin: '0 0 0.5rem 0'}}>{rev.title}</h5>
                                          <p style={{margin: '0 0 1rem 0', whiteSpace: 'pre-wrap', fontSize: '0.9rem'}}>{rev.description}</p>
                                          {rev.image_url && (
                                            <div style={{marginBottom: '1rem'}}>
                                              <strong style={{fontSize: '0.85rem'}}>Attachments:</strong>
                                              <div style={{marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem'}}>
                                                {(() => {
                                                  let images = [];
                                                  try {
                                                    images = JSON.parse(rev.image_url);
                                                    if (!Array.isArray(images)) images = [rev.image_url];
                                                  } catch(e) {
                                                    images = [rev.image_url];
                                                  }
                                                  return images.map((img, i) => (
                                                    img.startsWith('http') ? (
                                                      <a key={i} href={img} target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary-color)', fontSize: '0.9rem', display: 'block'}}>View Reference Link {i+1}</a>
                                                    ) : (
                                                      <img key={i} src={`${img}`} alt={`Revision attachment ${i+1}`} style={{maxWidth: '100%', maxHeight: '200px', borderRadius: '4px', border: '1px solid #e2e8f0'}} />
                                                    )
                                                  ));
                                                })()}
                                              </div>
                                            </div>
                                          )}
                                          <div className="step-meta">
                                            <span className={`badge badge-${rev.status === 'Completed' ? 'success' : (rev.status === 'In Progress' ? 'primary' : 'warning')}`}>{rev.status}</span>
                                            <span className="text-secondary" style={{fontSize: '0.8rem'}}>{new Date(rev.requested_at).toLocaleString()}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-secondary">No steps have been assigned to this project yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FILES & NOTES TAB */}
          {activeTab === 'notes' && (
            <div style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
              
              {/* Text Notes Section */}
              <div className="card">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                  <h3 style={{margin: 0}}>Discussion & Notes</h3>
                  <button className="btn-primary" onClick={() => { setEditingNote(null); setNoteContent(''); setIsNoteModalOpen(true); }} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', padding: '0.5rem 1rem'}}>
                    <Plus size={16} /> Add Note
                  </button>
                </div>
                
                <div className="notes-list">
                  {textNotes && textNotes.length > 0 ? textNotes.map(note => {
                    const isOwner = note.created_by === currentUser.id;
                    return (
                      <div key={note.id} className="note-card" style={{borderLeft: isOwner ? '4px solid var(--primary-color)' : '4px solid #cbd5e1'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem'}}>
                          <div>
                            <strong style={{fontSize: '1rem', color: isOwner ? 'var(--primary-color)' : 'var(--text-primary)'}}>
                              {note.created_by_name} {isOwner ? '(You)' : '(Admin)'}
                            </strong>
                            <span className="text-secondary" style={{fontSize: '0.8rem', marginLeft: '1rem'}}>{new Date(note.created_at).toLocaleString()}</span>
                          </div>
                          {isOwner && (
                            <div style={{display: 'flex', gap: '0.5rem'}}>
                              <button className="btn-icon" style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)'}} onClick={() => { setEditingNote(note); setNoteContent(note.content); setIsNoteModalOpen(true); }}><Edit size={16}/></button>
                              <button className="btn-icon" style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)'}} onClick={() => handleNoteDelete(note.id)}><Trash2 size={16}/></button>
                            </div>
                          )}
                        </div>
                        <p style={{margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.5'}}>{note.content}</p>
                      </div>
                    );
                  }) : <p className="text-secondary">No notes yet.</p>}
                </div>
              </div>

              {/* Files Section */}
              <div className="card">
                <h3 style={{marginTop: 0, marginBottom: '1.5rem'}}>Project Files & Deliverables</h3>
                <div className="notes-list">
                  {files && files.length > 0 ? files.map(file => (
                    <div key={file.id} className="note-card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong style={{fontSize: '1.1rem'}}>{file.file_name}</strong>
                        <p className="text-secondary" style={{margin: '0.5rem 0 0 0'}}>Project: {file.project_title} | Submitted: {new Date(file.submitted_at).toLocaleDateString()}</p>
                      </div>
                      <a href={file.file_url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{fontSize: '0.9rem', padding: '0.4rem 1rem'}}>Download</a>
                    </div>
                  )) : <p className="text-secondary">No files found.</p>}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* NOTE MODAL */}
      {isNoteModalOpen && (
        <div className="modal-overlay" style={{zIndex: 3000}}>
          <div className="modal-content">
            <h2>{editingNote ? 'Edit Note' : 'Add New Note'}</h2>
            <form onSubmit={handleNoteSubmit}>
              <div className="form-group" style={{marginBottom: '2rem'}}>
                <label>Note Content *</label>
                <textarea 
                  rows="5" 
                  value={noteContent} 
                  onChange={(e) => setNoteContent(e.target.value)} 
                  required 
                  placeholder="Write your note or question here..."
                ></textarea>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsNoteModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingNote ? 'Update Note' : 'Save Note'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewInvoice && (
        <div className="modal-overlay" style={{zIndex: 3000}}>
          <div className="modal-content preview-modal">
            <div className="modal-header print-hide" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem'}}>
              <h2 style={{margin: 0}}>Invoice Preview</h2>
              <div style={{display: 'flex', gap: '1rem'}}>
                <button className="btn" style={{backgroundColor: '#e2e8f0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem'}} onClick={() => window.print()}><Printer size={18} /> Print</button>
                <button className="btn" style={{backgroundColor: '#e2e8f0', color: '#1e293b', padding: '0.5rem'}} onClick={() => setPreviewInvoice(null)}><X size={20} /></button>
              </div>
            </div>
            
            <div className={`invoice-document ${previewInvoice.status === 'Paid' ? 'is-paid' : 'is-unpaid'}`} id="printable-invoice" style={{ position: 'relative', padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <img src="/Adwise-Labs-Primary-Logo.png" alt="Adwise Labs Logo" style={{ maxWidth: '220px', height: 'auto', display: 'block' }} />
                  </div>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Invoice {previewInvoice.invoice_number}</h2>
                  
                  <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Invoice To,</div>
                    <div>{client.full_name}</div>
                    {client.business_name && <div>{client.business_name}</div>}
                    {client.physical_address && <div style={{ maxWidth: '250px' }}>{client.physical_address}</div>}
                    <div>{client.email}</div>
                  </div>
                </div>
                
                <div style={{ flex: 1, textAlign: 'right', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Date: {new Date(previewInvoice.issue_date).toLocaleDateString()}</div>
                  <div style={{ letterSpacing: '2px', marginBottom: '1rem' }}>******************************</div>
                  
                  <div style={{ fontWeight: 'bold' }}>Account Title: Adwise labs</div>
                  <div style={{ fontWeight: 'bold' }}>Bank Al Falah</div>
                  <div style={{ fontWeight: 'bold' }}>Account Number: 56395002519988</div>
                  <div style={{ fontWeight: 'bold' }}>info@adwiselabs.com</div>
                  <div style={{ fontWeight: 'bold' }}>www.adwiselabs.com</div>
                </div>
              </div>

              <table className="invoice-table" style={{ border: '1px solid #000', marginBottom: '2rem', width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #000', textAlign: 'left', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold', padding: '0.75rem 1rem' }}>Description</th>
                    <th style={{ border: '1px solid #000', textAlign: 'center', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold', padding: '0.75rem 1rem' }}>Qty</th>
                    <th style={{ border: '1px solid #000', textAlign: 'center', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold', padding: '0.75rem 1rem' }}>Rate</th>
                    <th style={{ border: '1px solid #000', textAlign: 'right', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold', padding: '0.75rem 1rem' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewInvoice.items?.map(item => (
                    <tr key={item.id}>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem' }}>
                        <div>{item.description}</div>
                        {item.details && <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{item.details}</div>}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'center' }}>{item.quantity} {item.unit}</td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'center' }}>PKR {Number(item.unit_price).toFixed(2)}</td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right' }}>PKR {Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>Sub Total</td>
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {Number(previewInvoice.amount).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>Total Paid</td>
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {(previewInvoice.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>Total Amount Receivable</td>
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {Number(previewInvoice.balance).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ textAlign: 'center', color: '#0369a1', fontSize: '0.9rem', fontWeight: 'bold', lineHeight: '1.6', marginTop: '3rem' }}>
                <div style={{ marginBottom: '0.5rem' }}>Prompt Payments are Appreciated!</div>
                <div style={{ marginBottom: '0.5rem' }}>Thank You</div>
                <div style={{ marginBottom: '0.5rem' }}>Accounts Department – Adwise Labs</div>
                <div style={{ color: '#000', fontSize: '0.8rem' }}>ADWISE LABS | A-205/II Saba Ave, DHA Karachi Phase VIII Zone A, 76500</div>
                <div style={{ color: '#000', fontSize: '0.8rem', fontWeight: 'normal' }}>Contact No. +1 (774) 674-1872 | +92 329 2371279 | Email: info@adwiselabs.com</div>
              </div>

              {/* SEPARATE PAGE: TERMS & CONDITIONS */}
              {termsAndConditions && (
                <div className="terms-page-break">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
                    <img src="/Adwise-Labs-Primary-Logo.png" alt="Adwise Labs Logo" style={{ maxWidth: '180px', height: 'auto' }} />
                    <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Terms & Conditions</h2>
                  </div>
                  
                  <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {termsAndConditions}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
