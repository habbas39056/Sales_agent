import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, CreditCard, Folder, StickyNote, Check, CheckCircle, DollarSign, Filter, Eye, Printer, X, ChevronRight, Lock, LogOut, Plus, Edit, Trash2, MessageSquare, Activity, AlertCircle, Briefcase, Clock, Bell, User, Search, Download, Image } from 'lucide-react';
import StepComments from '../components/StepComments';
import './ClientPortal.css';

export default function ClientPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = React.useRef(null);
  
  const fetchNotifications = async () => {
    const userStr = localStorage.getItem('user');
    const u = userStr ? JSON.parse(userStr) : null;
    if (!u) return;
    try {
      const res = await axios.get(`/api/notifications?user_id=${u.id}`);
      setNotifications(res.data);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30 sec polling
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modals
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState('project_steps');
  const [stepReviewModal, setStepReviewModal] = useState({ isOpen: false, stepId: null });
  const [stepReviewResponse, setStepReviewResponse] = useState({ status: 'Approved', todos: [{ text: '', files: [] }] });
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [expandedRevisions, setExpandedRevisions] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [termsAndConditions, setTermsAndConditions] = useState('');
  
  // File Upload State
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadProjectId, setUploadProjectId] = useState('');

  // Client Review Modal State
  const [reviewModal, setReviewModal] = useState({ isOpen: false, reviewId: null });
  const [reviewResponse, setReviewResponse] = useState({ status: 'Approved', todos: [{ text: '', files: [] }] });

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

  const handleStepReviewSubmit = async (e) => {
    e.preventDefault();
    if (!stepReviewModal.stepId) return;

    if (stepReviewResponse.status === 'Approved') {
      try {
        await axios.post(`/api/projects/${selectedProject.id}/steps/${stepReviewModal.stepId}/client-approve`);
        setStepReviewModal({ isOpen: false, stepId: null });
        fetchPortalData();
        alert('Step approved successfully!');
      } catch (error) {
        console.error('Failed to approve step', error);
        alert('Failed to approve step.');
      }
    } else {
      const validTodos = stepReviewResponse.todos.filter(t => t.text.trim() !== '');
      if (validTodos.length === 0) {
        alert('Please add at least one feedback point for the revision.');
        return;
      }
      
      const formData = new FormData();
      formData.append('title', 'Revision Request');
      formData.append('description', validTodos.map((t, i) => `${i + 1}. ${t.text}`).join('\n'));
      formData.append('step_id', stepReviewModal.stepId);
      
      validTodos.forEach((t) => {
        if (t.files && t.files.length > 0) {
          for (let i = 0; i < t.files.length; i++) {
            formData.append('images', t.files[i]);
          }
        }
      });

      try {
        await axios.post(`/api/projects/${selectedProject.id}/request-revision`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setStepReviewModal({ isOpen: false, stepId: null });
        setStepReviewResponse({ status: 'Approved', todos: [{ text: '', files: [] }] });
        fetchPortalData();
        alert('Revision requested successfully!');
      } catch (error) {
        console.error('Failed to request revision', error);
        alert('Failed to request revision.');
      }
    }
  };

  const handleReviewResponseSubmit = async (e) => {
    e.preventDefault();
    if (!reviewModal.reviewId) return;

    const formData = new FormData();
    formData.append('status', reviewResponse.status);
    
    if (reviewResponse.status === 'Revision Requested') {
      const validTodos = reviewResponse.todos.filter(t => t.text.trim() !== '');
      if (validTodos.length === 0) {
        alert('Please add at least one feedback point for the revision.');
        return;
      }
      formData.append('feedback_todos', JSON.stringify(validTodos.map(t => t.text)));
      
      validTodos.forEach(t => {
        if (t.files && t.files.length > 0) {
          for (let i = 0; i < t.files.length; i++) {
            formData.append('feedback_files', t.files[i]);
          }
        }
      });
    }

    try {
      await axios.post(`/api/client-reviews/${reviewModal.reviewId}/respond`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setReviewModal({ isOpen: false, reviewId: null });
      setReviewResponse({ status: 'Approved', todos: [{ text: '', files: [] }] });
      fetchPortalData();
      alert('Response submitted successfully.');
    } catch (error) {
      console.error('Failed to submit response', error);
      alert('Failed to submit response.');
    }
  };

  const handleNoteDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this note?')) {
      try {
        await axios.delete(`/api/clients/notes/${id}`);
        fetchPortalData();
      } catch(e) { console.error(e); }
    }
  };

  const handleFileDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this file?')) {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        await axios.delete(`/api/clients/files/${id}?user_id=${user.id}`);
        fetchPortalData();
      } catch(e) { console.error(e); alert(e.response?.data?.error || 'Failed to delete file'); }
    }
  };

  const handleFileUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadProjectId) {
      alert('Please select a project');
      return;
    }
    if (uploadFiles.length === 0) {
      alert('Please select at least one file');
      return;
    }
    
    const formData = new FormData();
    const user = JSON.parse(localStorage.getItem('user'));
    formData.append('project_id', uploadProjectId);
    formData.append('user_id', user.id);
    
    for (let i = 0; i < uploadFiles.length; i++) {
      formData.append('files', uploadFiles[i]);
    }
    
    try {
      await axios.post('/api/clients/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIsFileUploadModalOpen(false);
      setUploadFiles([]);
      setUploadProjectId('');
      fetchPortalData();
      alert('Files uploaded successfully');
    } catch(e) {
      console.error(e);
      alert('Failed to upload files');
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
      <aside className="sidebar client-portal-sidebar">
        <div className="sidebar-brand" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem 1.5rem 1rem 1.5rem' }}>
          <img src="/logo.png" alt="Adwise Labs Logo" style={{ width: '100%', maxWidth: '240px', height: 'auto', display: 'block', margin: '0 auto' }} />
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <header className="top-header" style={{ padding: '1rem 1.5rem', background: 'white', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div className="header-left">
              <div className="header-titles">
                <h1 style={{ margin: '0 0 0.2rem 0', fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </h1>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Welcome back, here is your overview
                </p>
              </div>
            </div>
            
            <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div className="header-search" style={{ position: 'relative' }}>
                <Search size={18} className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder="Search everything..." 
                  style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem', width: '240px', outline: 'none' }}
                />
              </div>

              <div className="header-notifications" ref={notifRef} style={{ position: 'relative' }}>
                <button 
                  className="header-icon-btn"
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s' }}
                >
                  <Bell size={20} />
                  {notifications.filter(n => !n.is_read).length > 0 && (
                    <span className="notification-dot" style={{ position: 'absolute', top: 2, right: 2, background: '#ef4444', width: 8, height: 8, borderRadius: '50%', border: '2px solid white' }}></span>
                  )}
                </button>
                
                {showNotifDropdown && (
                  <div className="notif-dropdown" style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', width: '320px',
                    backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                    border: '1px solid #e2e8f0', zIndex: 1000, overflow: 'hidden'
                  }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>Notifications</h3>
                      {notifications.filter(n => !n.is_read).length > 0 && (
                        <button onClick={async () => {
                          const userStr = localStorage.getItem('user');
                          const u = userStr ? JSON.parse(userStr) : null;
                          if(!u) return;
                          await axios.put('/api/notifications/mark-all-read', { user_id: u.id });
                          fetchNotifications();
                        }} style={{ fontSize: '0.75rem', color: '#4338ca', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Mark all read</button>
                      )}
                    </div>
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                          No recent notifications.
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={async () => {
                              if (!n.is_read) {
                                await axios.put(`/api/notifications/${n.id}/read`);
                                fetchNotifications();
                              }
                              setShowNotifDropdown(false);
                            }}
                            style={{ 
                              padding: '0.85rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                              background: n.is_read ? '#ffffff' : '#f8fafc', transition: 'background 0.2s',
                              display: 'flex', gap: '0.75rem'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: '#0f172a', fontWeight: n.is_read ? '500' : '700' }}>
                                {n.message}
                              </p>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(n.created_at).toLocaleString()}</span>
                            </div>
                            {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', alignSelf: 'center' }}></div>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="header-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '1rem', borderLeft: '1px solid #e2e8f0' }}>
                <div className="profile-info" style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                  <span className="profile-name" style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' }}>
                    {portalData?.client?.full_name || 'Client'}
                  </span>
                  <span className="profile-role" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    @{portalData?.client?.full_name?.replace(/\s+/g, '').toLowerCase() || 'client'}
                  </span>
                </div>
                <div className="profile-avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  {portalData?.client?.full_name?.charAt(0) || <User size={18} />}
                </div>
              </div>
            </div>
          </header>
          
          <main className="main-content">
            <div className="portal-content-area">

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.25rem' }}>
                  Welcome back, {portalData?.client?.full_name?.split(' ')[0] || 'Client'}!
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Here is what is happening with your projects today.</p>
              </div>

              <div className="portal-dashboard-grid">
                <div className="portal-stat-card">
                  <div className="portal-stat-header">
                    <div className="portal-stat-icon icon-blue">
                      <Briefcase size={20} />
                    </div>
                  </div>
                  <div>
                    <h3>Active Projects</h3>
                    <div className="portal-stat-value">{projects.filter(p => p.status !== 'Completed').length}</div>
                    <div className="stat-subtitle">Currently in progress</div>
                  </div>
                </div>
                
                <div className="portal-stat-card">
                  <div className="portal-stat-header">
                    <div className="portal-stat-icon icon-purple">
                      <FileText size={20} />
                    </div>
                  </div>
                  <div>
                    <h3>Total Invoices</h3>
                    <div className="portal-stat-value">{invoices.length}</div>
                    <div className="stat-subtitle">{invoices.filter(i => i.balance > 0).length} pending payment</div>
                  </div>
                </div>

                <div className="portal-stat-card warning">
                  <div className="portal-stat-header">
                    <div className="portal-stat-icon icon-orange">
                      <AlertCircle size={20} />
                    </div>
                  </div>
                  <div>
                    <h3>Outstanding Balance</h3>
                    <div className="portal-stat-value">PKR {totalOutstanding.toFixed(2)}</div>
                    <div className="stat-subtitle">Total due across all invoices</div>
                  </div>
                </div>
              </div>
              
              <div className="dashboard-grid-container">
                <div className="dashboard-section">
                  <h3><Activity size={20} color="#4f46e5" /> Active Project Overview</h3>
                  <div className="dashboard-project-list">
                    {projects.filter(p => p.status !== 'Completed').length > 0 ? (
                      projects.filter(p => p.status !== 'Completed').slice(0, 4).map(p => {
                        const totalSteps = p.steps ? p.steps.length : 0;
                        const completedSteps = p.steps ? p.steps.filter(s => s.status === 'Completed').length : 0;
                        const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                        
                        return (
                          <div key={p.id} className="dashboard-project-item">
                            <div className="dashboard-project-header">
                              <h4 onClick={() => { setActiveTab('projects'); setSelectedProject(p); }}>{p.title}</h4>
                              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: progress === 100 ? '#10b981' : '#4f46e5' }}>{progress}%</span>
                            </div>
                            <div className="progress-container">
                              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                              <span>{completedSteps} of {totalSteps} steps completed</span>
                              <span>{p.status}</span>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p style={{ color: '#64748b', fontStyle: 'italic' }}>No active projects at the moment.</p>
                    )}
                  </div>
                </div>

                <div>
                  {invoices.filter(i => i.balance > 0).length > 0 && (
                    <div className="dashboard-invoice-alert">
                      <div className="invoice-alert-details">
                        <h4>Payment Required</h4>
                        <p>You have {invoices.filter(i => i.balance > 0).length} unpaid invoice(s).</p>
                      </div>
                      <button className="btn btn-primary" onClick={() => setActiveTab('invoices')} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                        Pay Now
                      </button>
                    </div>
                  )}

                  <div className="dashboard-section" style={{ padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem' }}><Clock size={18} color="#64748b" /> Quick Actions</h3>
                    <div className="dashboard-actions-grid">
                      <button className="dashboard-action-btn" onClick={() => setActiveTab('projects')}>
                        <Folder size={24} color="#64748b" />
                        <span>All Projects</span>
                      </button>
                      <button className="dashboard-action-btn" onClick={() => setActiveTab('notes')}>
                        <StickyNote size={24} color="#64748b" />
                        <span>Files & Notes</span>
                      </button>
                      <button className="dashboard-action-btn" onClick={() => setActiveTab('payments')}>
                        <CreditCard size={24} color="#64748b" />
                        <span>Payment History</span>
                      </button>
                      <button className="dashboard-action-btn" onClick={() => setActiveTab('invoices')}>
                        <FileText size={24} color="#64748b" />
                        <span>Invoices</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INVOICES TAB */}
          {activeTab === 'invoices' && (
            <div className="invoices-tab-container">
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                    <div style={{ background: '#eff6ff', padding: '4px', borderRadius: '4px', marginRight: '8px' }}>
                      <FileText size={16} color="#3b82f6" />
                    </div>
                    TOTAL INVOICES
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{invoices.length}</div>
                </div>
                
                <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                    <div style={{ background: '#ecfdf5', padding: '4px', borderRadius: '4px', marginRight: '8px' }}>
                      <CheckCircle size={16} color="#10b981" />
                    </div>
                    AMOUNT PAID
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
                    PKR {invoices.reduce((sum, inv) => sum + (inv.amount - inv.balance), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                    <div style={{ background: '#fef2f2', padding: '4px', borderRadius: '4px', marginRight: '8px' }}>
                      <Clock size={16} color="#ef4444" />
                    </div>
                    OUTSTANDING
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444' }}>
                    PKR {invoices.reduce((sum, inv) => sum + Number(inv.balance), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                    <div style={{ background: '#fff7ed', padding: '4px', borderRadius: '4px', marginRight: '8px' }}>
                      <DollarSign size={16} color="#f59e0b" />
                    </div>
                    TOTAL BILLED
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>
                    PKR {invoices.reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Billing History Table */}
              <div className="card" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Billing History</h3>
                  <button style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
                    <Filter size={16} /> Filter
                  </button>
                </div>
                <div className="table-responsive" style={{ margin: 0 }}>
                  <table className="custom-table" style={{ width: '100%', borderSpacing: 0 }}>
                    <thead style={{ background: '#f8fafc' }}>
                      <tr>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>INVOICE ID</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>DATE</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>DUE DATE</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>SERVICE FEES</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>TOTAL AMOUNT</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>PAID</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>BALANCE</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>STATUS</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(inv => {
                        const paid = inv.amount - inv.balance;
                        const isOverdue = inv.status === 'Overdue';
                        return (
                          <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '1.25rem 1.5rem' }}>
                              <span style={{ background: '#f3e8ff', color: '#7e22ce', padding: '4px 8px', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 600 }}>
                                #{inv.invoice_number}
                              </span>
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', color: '#334155' }}>
                              {new Date(inv.issue_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', color: isOverdue ? '#ef4444' : '#334155' }}>
                              {new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', color: '#475569' }}>
                              PKR {Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#0f172a' }}>
                              PKR {Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', color: '#10b981', fontWeight: 600 }}>
                              PKR {Number(paid).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', color: '#64748b' }}>
                              PKR {Number(inv.balance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem' }}>
                              <span className={`badge badge-${inv.status.toLowerCase() === 'paid' ? 'success' : (inv.status === 'Overdue' ? 'danger' : 'warning')}`}>
                                {inv.status}
                              </span>
                            </td>
                            <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button className="btn-icon view-btn" style={{background:'none', border:'none', cursor:'pointer', color: '#94a3b8'}} onClick={() => setPreviewInvoice(inv)} title="View Invoice">
                                <Eye size={18} />
                              </button>
                              <button className="btn-icon" style={{background:'none', border:'none', cursor:'pointer', color: '#3b82f6'}} onClick={() => { setPreviewInvoice(inv); setTimeout(() => window.print(), 100); }} title="Download PDF">
                                <Download size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {invoices.length === 0 && (
                        <tr><td colSpan="10" className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No billing history found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className="payments-tab-container">
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                    <div style={{ background: '#ecfdf5', padding: '4px', borderRadius: '4px', marginRight: '8px' }}>
                      <CheckCircle size={16} color="#10b981" />
                    </div>
                    TRANSACTIONS
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{payments.length}</div>
                </div>

                <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                    <div style={{ background: '#eff6ff', padding: '4px', borderRadius: '4px', marginRight: '8px' }}>
                      <DollarSign size={16} color="#3b82f6" />
                    </div>
                    TOTAL TRANSACTED
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>
                    PKR {payments.reduce((sum, pay) => sum + Number(pay.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Recent Transactions Table */}
              <div className="card" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Recent Transactions</h3>
                </div>
                <div className="table-responsive" style={{ margin: 0 }}>
                  <table className="custom-table" style={{ width: '100%', borderSpacing: 0 }}>
                    <thead style={{ background: '#f8fafc' }}>
                      <tr>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>INVOICE</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>DATE</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>METHOD</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>REFERENCE</th>
                        <th style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(pay => (
                        <tr key={pay.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#0f172a' }}>
                            {pay.invoice_number ? `#${pay.invoice_number}` : '-'}
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem', color: '#475569' }}>
                            {new Date(pay.payment_date).toLocaleDateString('en-GB')}
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem', color: '#475569' }}>
                            {pay.payment_method}
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem', color: '#64748b' }}>
                            {pay.reference_number || (123739 + pay.id)}
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem', color: '#10b981', fontWeight: 700 }}>
                            PKR {Number(pay.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr><td colSpan="5" className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No payment history found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PROJECTS TAB */}
          {activeTab === 'projects' && !selectedProject && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
              {projects.map(p => (
                <div key={p.id} className="card" style={{ padding: '1.75rem', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', background: '#fff', position: 'relative', overflow: 'hidden' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.3, paddingRight: '1rem' }}>{p.title}</h4>
                    <span style={{ background: '#fef3c7', color: '#d97706', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {p.status || 'Assigned'}
                    </span>
                  </div>
                  
                  <div style={{ flex: 1 }}></div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                      Terms: {p.terms_accepted ? <span style={{ color: '#10b981', fontWeight: 500 }}>Accepted</span> : <span style={{ color: '#ef4444', fontWeight: 500 }}>Pending</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                      Deadline: <span style={{ color: '#64748b', fontWeight: 500 }}>{new Date(p.locked_deadline).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </div>
                  </div>
                  
                  <button onClick={() => setSelectedProject(p)} style={{ background: '#ea580c', color: 'white', border: 'none', borderRadius: '8px', padding: '0.85rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', width: '100%', transition: 'all 0.2s ease', boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)' }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#c2410c'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#ea580c'}
                  >
                    Open Workspace
                  </button>
                </div>
              ))}
              {projects.length === 0 && <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#64748b' }}>No projects assigned yet.</div>}
            </div>
          )}

          {/* PROJECT WORKSPACE */}
          {activeTab === 'projects' && selectedProject && (
            <div className="project-workspace">
              <button onClick={() => setSelectedProject(null)} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                <ChevronRight size={18} style={{transform: 'rotate(180deg)'}}/> Back to Projects
              </button>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{selectedProject.title}</h2>
                <span style={{ background: '#fef3c7', color: '#d97706', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700 }}>
                  {selectedProject.status || 'Assigned'}
                </span>
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
                  <div style={{display: 'flex', gap: '1.5rem', marginBottom: '2.5rem', flexWrap: 'wrap'}}>
                    <div style={{flex: 1, minWidth: '300px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '1.5rem'}}>
                      <h4 style={{margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 700}}>
                        <Check size={20} /> Terms Accepted
                      </h4>
                      <p style={{margin: '0.75rem 0 0 0', color: '#64748b', fontSize: '0.95rem'}}>The project workspace is unlocked and ready.</p>
                    </div>
                    <div style={{flex: 1, minWidth: '300px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'}}>
                      <h4 style={{margin: 0, color: '#0f172a', fontSize: '1.1rem', fontWeight: 800}}>Revision Cycles</h4>
                      <p style={{margin: '0.75rem 0 0 0', color: '#64748b', fontSize: '0.95rem'}}>You have <strong style={{color: '#0f172a'}}>{selectedProject.revision_cycles_remaining}</strong> of <strong style={{color: '#0f172a'}}>{selectedProject.revision_cycles_included}</strong> free revisions remaining.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '2rem', gap: '0.5rem', overflowX: 'auto' }}>
                    <button 
                      onClick={() => setWorkspaceTab('terms')}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        padding: '0.75rem 1.25rem', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        fontSize: '0.95rem', 
                        fontWeight: 600, 
                        borderBottom: workspaceTab === 'terms' ? '2px solid #3b82f6' : '2px solid transparent', 
                        color: workspaceTab === 'terms' ? '#3b82f6' : '#64748b',
                        backgroundColor: workspaceTab === 'terms' ? '#eff6ff' : 'transparent',
                        borderTopLeftRadius: '8px',
                        borderTopRightRadius: '8px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <FileText size={18} /> Terms & Conditions
                    </button>
                    <button 
                      onClick={() => setWorkspaceTab('project_steps')}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        padding: '0.75rem 1.25rem', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        fontSize: '0.95rem', 
                        fontWeight: 600, 
                        borderBottom: workspaceTab === 'project_steps' ? '2px solid #3b82f6' : '2px solid transparent', 
                        color: workspaceTab === 'project_steps' ? '#3b82f6' : '#64748b',
                        backgroundColor: workspaceTab === 'project_steps' ? '#eff6ff' : 'transparent',
                        borderTopLeftRadius: '8px',
                        borderTopRightRadius: '8px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <LayoutDashboard size={18} /> Project Steps
                    </button>
                    <button 
                      onClick={() => setWorkspaceTab('revisions')}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        padding: '0.75rem 1.25rem', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        fontSize: '0.95rem', 
                        fontWeight: 600, 
                        borderBottom: workspaceTab === 'revisions' ? '2px solid #3b82f6' : '2px solid transparent', 
                        color: workspaceTab === 'revisions' ? '#3b82f6' : '#64748b',
                        backgroundColor: workspaceTab === 'revisions' ? '#eff6ff' : 'transparent',
                        borderTopLeftRadius: '8px',
                        borderTopRightRadius: '8px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Folder size={18} /> Revisions
                    </button>
                  </div>

                  {/* TERMS AND CONDITIONS SECTION */}
                  {workspaceTab === 'terms' && selectedProject.terms_and_conditions && (
                    <div style={{ marginBottom: '2.5rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b', fontSize: '1.3rem', fontWeight: 800 }}>
                        <FileText size={20} /> Accepted Terms & Conditions
                      </h3>
                      <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '12px', color: '#475569', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', border: '1px solid #f1f5f9' }}>
                        {selectedProject.terms_and_conditions}
                      </div>
                    </div>
                  )}
                  
                  {workspaceTab === 'revisions' && selectedProject.clientReviews && selectedProject.clientReviews.length > 0 && (
                    <div style={{ marginBottom: '2.5rem' }}>
                      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
                        <Folder size={20} /> Pending Reviews ({selectedProject.clientReviews.length})
                      </h3>
                      <div className="client-steps-list">
                        {selectedProject.clientReviews.map((review, index) => (
                          <div key={review.id} style={{ display: 'flex', gap: '1.5rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
                              R{index + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{review.title}</h4>
                                  <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.95rem' }}>{review.description}</p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                      {review.status}
                                    </span>
                                    {review.deadline && (
                                      <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                                        Due: {new Date(review.deadline).toLocaleDateString('en-GB')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                                  <a 
                                    href={review.file_url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 700, padding: '0.6rem 1.25rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem', transition: 'all 0.2s' }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                  >
                                    <Download size={16} /> Download File
                                  </a>
                                  {review.status === 'Pending Review' && (
                                    <button 
                                      className="btn btn-primary"
                                      onClick={() => setReviewModal({ isOpen: true, reviewId: review.id })}
                                    >
                                      Submit Response
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {workspaceTab === 'project_steps' && (
                    <>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem'}}>
                    <h3 style={{margin: 0, color: '#1e293b', fontSize: '1.3rem', fontWeight: 800}}>Project Timeline & Steps</h3>
                    {selectedProject && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                        background: selectedProject.revision_cycles_remaining > 0 ? '#ecfdf5' : '#fef2f2', 
                        border: `1px solid ${selectedProject.revision_cycles_remaining > 0 ? '#10b981' : '#ef4444'}`,
                        padding: '0.5rem 1rem', borderRadius: '8px',
                        color: selectedProject.revision_cycles_remaining > 0 ? '#047857' : '#b91c1c',
                        fontWeight: '700', fontSize: '0.85rem'
                      }}>
                        Revisions Remaining: {selectedProject.revision_cycles_remaining} / {selectedProject.revision_cycles_included}
                      </div>
                    )}
                  </div>
                  <div className="client-steps-list">
                    {selectedProject.steps && selectedProject.steps.length > 0 ? (
                      selectedProject.steps.map((step, index) => {
                        // Check if a revision exists for this step
                        const stepRevisions = selectedProject.revisions ? selectedProject.revisions.filter(r => r.step_id === step.id) : [];
                        const hasRevision = stepRevisions.length > 0;
                        const isExpanded = expandedRevisions[step.id];

                        return (
                          <div key={step.id} style={{ display: 'flex', gap: '1.5rem', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>
                              {index + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{step.title}</h4>
                              <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.95rem' }}>{step.description}</p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: step.status === 'Completed' ? '#10b981' : step.status === 'In Progress' ? '#3b82f6' : '#d97706' }}>
                                  {step.status}
                                </span>
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
                                {!!step.allow_revision && !hasRevision && step.status !== 'Completed' && (
                                  <button 
                                    className="btn btn-primary" 
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    onClick={() => setStepReviewModal({ isOpen: true, stepId: step.id })}
                                  >
                                    <CheckCircle size={16} /> Review Step
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
                    </>
                  )}
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
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                  <h3 style={{margin: 0}}>Project Files & Deliverables</h3>
                  <button className="btn-primary" onClick={() => setIsFileUploadModalOpen(true)} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', padding: '0.5rem 1rem'}}>
                    <Plus size={16} /> Upload File
                  </button>
                </div>
                <div className="notes-list">
                  {files && files.length > 0 ? files.map(file => (
                    <div key={file.id} className="note-card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <strong style={{fontSize: '1.1rem'}}>{file.file_name}</strong>
                        <p className="text-secondary" style={{margin: '0.5rem 0 0 0'}}>Project: {file.project_title} | Submitted: {new Date(file.submitted_at).toLocaleDateString()}</p>
                      </div>
                      <div style={{display: 'flex', gap: '0.5rem'}}>
                        <a href={file.file_url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{fontSize: '0.9rem', padding: '0.4rem 1rem'}}>Download</a>
                        {file.submitted_by === JSON.parse(localStorage.getItem('user'))?.id && (
                          <button onClick={() => handleFileDelete(file.id)} className="btn btn-danger" style={{fontSize: '0.9rem', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Trash2 size={16}/></button>
                        )}
                      </div>
                    </div>
                  )) : <p className="text-secondary">No files found.</p>}
                </div>
              </div>

            </div>
          )}
            </div>
          </main>
        </div>

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

      {/* FILE UPLOAD MODAL */}
      {isFileUploadModalOpen && (
        <div className="modal-overlay" style={{zIndex: 3000}}>
          <div className="modal-content">
            <h2>Upload Project File</h2>
            <form onSubmit={handleFileUploadSubmit}>
              <div className="form-group" style={{marginBottom: '1rem'}}>
                <label>Select Project *</label>
                <select 
                  className="form-control"
                  value={uploadProjectId}
                  onChange={(e) => setUploadProjectId(e.target.value)}
                  required
                >
                  <option value="">-- Choose a Project --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{marginBottom: '2rem'}}>
                <label>Files *</label>
                <input 
                  type="file" 
                  className="form-control"
                  multiple 
                  onChange={(e) => setUploadFiles(e.target.files)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setIsFileUploadModalOpen(false); setUploadFiles([]); setUploadProjectId(''); }}>Cancel</button>
                <button type="submit" className="btn-primary">Upload</button>
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
              
              {/* STAMP */}
              <div className="invoice-stamp">
                {previewInvoice.status === 'Paid' ? 'PAID' : (previewInvoice.status === 'Overdue' ? 'OVERDUE' : 'UNPAID')}
              </div>

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

      {/* Step Review Modal */}
      {stepReviewModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2>Review Project Step</h2>
              <button className="btn-close" onClick={() => setStepReviewModal({ isOpen: false, stepId: null })}><X size={20} /></button>
            </div>
            <form onSubmit={handleStepReviewSubmit} style={{ padding: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Action</label>
                <select 
                  value={stepReviewResponse.status}
                  onChange={(e) => setStepReviewResponse({...stepReviewResponse, status: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Approved">Approve (No changes needed)</option>
                  {selectedProject?.revision_cycles_remaining > 0 ? (
                    <option value="Revision Requested">Request Revision (Changes needed)</option>
                  ) : (
                    <option value="Revision Requested" disabled>Request Revision (No cycles remaining)</option>
                  )}
                </select>
                
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: selectedProject?.revision_cycles_remaining > 0 ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                  Revisions Remaining: {selectedProject?.revision_cycles_remaining} / {selectedProject?.revision_cycles_included}
                </div>
              </div>

              {stepReviewResponse.status === 'Revision Requested' && (
                <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 1rem 0' }}>Revision Details</h4>
                  
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Feedback To-Dos</label>
                    {stepReviewResponse.todos.map((todo, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            value={todo.text}
                            placeholder={`Change requested #${idx + 1}...`}
                            onChange={(e) => {
                              const newTodos = [...stepReviewResponse.todos];
                              newTodos[idx].text = e.target.value;
                              setStepReviewResponse({...stepReviewResponse, todos: newTodos});
                            }}
                            style={{ flex: 1, padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            required
                          />
                          <label style={{ cursor: 'pointer', padding: '0.5rem', color: todo.files?.length ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center' }}>
                            <Image size={20} />
                            <input 
                              type="file" 
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const newTodos = [...stepReviewResponse.todos];
                                newTodos[idx].files = Array.from(e.target.files);
                                setStepReviewResponse({...stepReviewResponse, todos: newTodos});
                              }}
                            />
                          </label>
                          {stepReviewResponse.todos.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => {
                                const newTodos = stepReviewResponse.todos.filter((_, i) => i !== idx);
                                setStepReviewResponse({...stepReviewResponse, todos: newTodos});
                              }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.5rem' }}
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                        {todo.files && todo.files.length > 0 && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', paddingLeft: '0.5rem' }}>
                            {todo.files.length} file(s) attached: {todo.files.map(f => f.name).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => setStepReviewResponse({...stepReviewResponse, todos: [...stepReviewResponse.todos, { text: '', files: [] }]})}
                      style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', marginTop: '0.5rem' }}
                    >
                      <Plus size={16} /> Add Another Point
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setStepReviewModal({ isOpen: false, stepId: null })} style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>Submit Response</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Response Modal */}
      {reviewModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2>Submit Review Response</h2>
              <button className="btn-close" onClick={() => setReviewModal({ isOpen: false, reviewId: null })}><X size={20} /></button>
            </div>
            <form onSubmit={handleReviewResponseSubmit} style={{ padding: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Action</label>
                <select 
                  value={reviewResponse.status}
                  onChange={(e) => setReviewResponse({...reviewResponse, status: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Approved">Approve (No changes needed)</option>
                  <option value="Revision Requested">Request Revision (Changes needed)</option>
                </select>
              </div>

              {reviewResponse.status === 'Revision Requested' && (
                <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 1rem 0' }}>Revision Details</h4>
                  
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Feedback To-Dos</label>
                    {reviewResponse.todos.map((todo, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            value={todo.text}
                            placeholder={`Change requested #${idx + 1}...`}
                            onChange={(e) => {
                              const newTodos = [...reviewResponse.todos];
                              newTodos[idx].text = e.target.value;
                              setReviewResponse({...reviewResponse, todos: newTodos});
                            }}
                            style={{ flex: 1, padding: '0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            required
                          />
                          <label style={{ cursor: 'pointer', padding: '0.5rem', color: todo.files?.length ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center' }}>
                            <Image size={20} />
                            <input 
                              type="file" 
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const newTodos = [...reviewResponse.todos];
                                newTodos[idx].files = Array.from(e.target.files);
                                setReviewResponse({...reviewResponse, todos: newTodos});
                              }}
                            />
                          </label>
                          {reviewResponse.todos.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => {
                                const newTodos = reviewResponse.todos.filter((_, i) => i !== idx);
                                setReviewResponse({...reviewResponse, todos: newTodos});
                              }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.5rem' }}
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                        {todo.files && todo.files.length > 0 && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', paddingLeft: '0.5rem' }}>
                            {todo.files.length} file(s) attached: {todo.files.map(f => f.name).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => setReviewResponse({...reviewResponse, todos: [...reviewResponse.todos, { text: '', files: [] }]})}
                      style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', marginTop: '0.5rem' }}
                    >
                      <Plus size={16} /> Add Another Point
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setReviewModal({ isOpen: false, reviewId: null })} style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>Submit Response</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
