import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Search, Folder, Plus, X, FileSpreadsheet, Edit2, Trash2, Eye, MessageCircle, Lock, FileText, Bell } from 'lucide-react';
import * as XLSX from 'xlsx';
import Pagination from '../components/Pagination';
import './ProjectsList.css';
import './Modal.css';

export default function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [serviceFilter, setServiceFilter] = useState('All Services');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    invoice_id: '',
    pm_id: '',
    team_member_ids: [],
    service_type: [],
    revision_cycles_included: 0,
    terms_and_conditions: ''
  });

  const availableServices = categories.map(c => c.name);

  const availableStatuses = [
    'Active',
    'Completed',
    'Pending',
    'On Hold'
  ];

  useEffect(() => {
    fetchProjects();
    fetchClients();
    fetchInvoices();
    fetchCategories();
    fetchTeamMembers();
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user) return;
      const res = await axios.get(`/api/notifications?user_id=${user.id}`);
      setNotifications(res.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await axios.get('/api/users/specialists');
      setTeamMembers(res.data);
    } catch (error) {
      console.error('Failed to fetch team members', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/project-categories');
      setCategories(res.data || []);
      if (res.data && res.data.length > 0) {
        setFormData(prev => ({
          ...prev,
          service_type: prev.service_type || res.data[0].name
        }));
      }
    } catch (error) {
      console.error('Failed to fetch project categories', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let url = '/api/projects';
      if (user) {
        url += `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }
      const res = await axios.get(url);
      setProjects(res.data);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    }
  };

  const fetchClients = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let url = '/api/clients';
      if (user) {
        url += `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }
      const res = await axios.get(url);
      setClients(res.data);
    } catch (error) {
      console.error('Failed to fetch clients', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let url = '/api/invoices';
      if (user) {
        url += `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }
      const res = await axios.get(url);
      setInvoices(res.data);
    } catch (error) {
      console.error('Failed to fetch invoices', error);
    }
  };

  const handleExportExcel = () => {
    if (!filteredProjects || filteredProjects.length === 0) {
      alert('No projects to export!');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. All Projects Summary Sheet
    const allProjectsData = filteredProjects.map(p => ({
      'Project Title': p.title,
      'Client Name': p.client_name || 'N/A',
      'Service Category': p.service_type || 'Unspecified',
      'Status': p.status || 'Active',
      'Completed Steps': p.completed_steps || 0,
      'Total Steps': p.total_steps || 0,
      'Progress (%)': p.total_steps > 0 ? Math.round((p.completed_steps / p.total_steps) * 100) : 0,
      'Created At': p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'
    }));

    const wsAll = XLSX.utils.json_to_sheet(allProjectsData);
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Projects');

    // 2. Separate sheet for each Service Category
    const categoryMap = {};
    filteredProjects.forEach(p => {
      const catName = p.service_type || 'Unspecified';
      if (!categoryMap[catName]) {
        categoryMap[catName] = [];
      }
      categoryMap[catName].push({
        'Project Title': p.title,
        'Client Name': p.client_name || 'N/A',
        'Status': p.status || 'Active',
        'Completed Steps': p.completed_steps || 0,
        'Total Steps': p.total_steps || 0,
        'Progress (%)': p.total_steps > 0 ? Math.round((p.completed_steps / p.total_steps) * 100) : 0,
        'Created At': p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'
      });
    });

    Object.keys(categoryMap).forEach(catName => {
      // Excel sheet name limit is 31 chars, sanitize invalid chars
      const sheetName = catName.replace(/[:\\/?*\[\]]/g, '').substring(0, 30) || 'Category';
      const wsCat = XLSX.utils.json_to_sheet(categoryMap[catName]);
      XLSX.utils.book_append_sheet(wb, wsCat, sheetName);
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Projects_Export_${dateStr}.xlsx`);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/projects', formData);
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        client_id: '',
        invoice_id: '',
        pm_id: '',
        team_member_ids: [],
        service_type: [],
        revision_cycles_included: 0,
        terms_and_conditions: ''
      });
      fetchProjects();
    } catch (error) {
      console.error('Error creating project', error);
      alert('Error creating project');
    }
  };

  const handleEditClick = (e, project) => {
    e.stopPropagation();
    const existingMemberIds = project.assigned_members && project.assigned_members.length > 0
      ? project.assigned_members.map(m => m.id)
      : (project.pm_id ? [project.pm_id] : []);
    
    let st = project.service_type;
    try { if (typeof st === 'string' && st.startsWith('[')) st = JSON.parse(st); } catch(e){}

    setEditFormData({
      title: project.title || '',
      description: project.description || '',
      client_id: project.client_id || '',
      pm_id: project.pm_id || '',
      team_member_ids: existingMemberIds,
      service_type: Array.isArray(st) ? st : (st ? [st] : []),
      revision_cycles_included: project.revision_cycles_included || 0,
      terms_and_conditions: project.terms_and_conditions || ''
    });
    setEditingProject(project);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/projects/${editingProject.id}`, editFormData);
      setIsEditModalOpen(false);
      setEditingProject(null);
      fetchProjects();
    } catch (error) {
      console.error('Error updating project', error);
      alert('Error updating project');
    }
  };

  const handleDeleteClick = async (e, project) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${project.title}"? This will also delete all steps, comments, and deliverables.`)) return;
    try {
      await axios.delete(`/api/projects/${project.id}`);
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project', error);
      alert('Error deleting project');
    }
  };

  const [deadlineFilter, setDeadlineFilter] = useState('All Dates');
  const [actionFilter, setActionFilter] = useState('All Actions');

  const getDeadlineInfo = (deadlineStr) => {
    if (!deadlineStr) return { isOverdue: false, isSoon: false, label: 'No Deadline' };
    const due = new Date(deadlineStr);
    const now = new Date();
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { isOverdue: true, isSoon: false, label: 'Due Today' }; // Treat overdue as due today for filtering purposes
    if (diffDays === 0) return { isOverdue: false, isSoon: true, label: 'Due Today' };
    if (diffDays <= 3) return { isOverdue: false, isSoon: true, label: 'Due Soon' };
    return { isOverdue: false, isSoon: false, label: 'Future' };
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (project.client_name && project.client_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All Statuses' || project.status === statusFilter;
    let matchesService = false;
    if (serviceFilter === 'All Services') {
      matchesService = true;
    } else {
      let st = project.service_type;
      try {
        if (typeof st === 'string' && st.startsWith('[')) {
          st = JSON.parse(st);
        }
      } catch(e){}
      if (Array.isArray(st)) {
        matchesService = st.includes(serviceFilter);
      } else {
        matchesService = st === serviceFilter;
      }
    }

    let matchesDeadline = true;
    if (deadlineFilter !== 'All Dates') {
      const dl = getDeadlineInfo(project.locked_deadline);
      if (deadlineFilter === 'Due Soon / Overdue') matchesDeadline = dl.isOverdue || dl.isSoon;
      if (deadlineFilter === 'Due Today') matchesDeadline = dl.label === 'Due Today';
    }

    let matchesAction = true;
    if (actionFilter === 'Pending Approval') {
      matchesAction = project.steps && project.steps.some(s => s.status === 'Pending Approval');
    } else if (actionFilter === 'Appealed') {
      matchesAction = project.steps && project.steps.some(s => s.deadline_status === 'Appealed');
    }

    return matchesSearch && matchesStatus && matchesService && matchesDeadline && matchesAction;
  });

  const currentProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="projects-container">
      <div className="projects-header" style={{ justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-excel" onClick={handleExportExcel} title="Download Multi-Sheet Excel Listing">
            <FileSpreadsheet size={18} /> Export Excel
          </button>
          <button className="btn-create" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Create Project
          </button>
        </div>
      </div>

      <div className="projects-filters">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by title or client name..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <select 
          className="filter-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All Statuses">All Statuses</option>
          {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select 
          className="filter-select"
          value={serviceFilter}
          onChange={(e) => {
            setServiceFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All Services">All Services</option>
          {availableServices.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select 
          className="filter-select"
          value={deadlineFilter}
          onChange={(e) => {
            setDeadlineFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All Dates">All Dates</option>
          <option value="Due Today">Due Today</option>
          <option value="Due Soon / Overdue">Due Soon / Overdue</option>
        </select>
        <select 
          className="filter-select"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All Actions">All Actions</option>
          <option value="Pending Approval">⏳ Pending Approval</option>
          <option value="Appealed">🚨 Appealed</option>
        </select>
      </div>

      <div className="recent-orders-panel" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div className="table-responsive-ref">
          <table className="ref-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '1.25rem' }}>Project Title</th>
                <th>Client</th>
                <th>Assigned To</th>
                <th>Service Category</th>
                <th>Progress</th>
                <th>Status</th>
                <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentProjects.map(project => {
                const total = project.total_steps || 0;
                const completed = project.completed_steps || 0;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                const isCompleted = project.status === 'Completed' || project.status === 'Commission Released';
                
                return (
                  <tr 
                    key={project.id} 
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="project-row"
                  >
                    <td style={{ paddingLeft: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="folder-icon-sm">
                          <Folder size={16} />
                        </div>
                        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {project.title}
                          {(() => {
                            const unreadForProject = notifications.filter(n => !n.is_read && n.link && (n.link.includes(`/projects?id=${project.id}`) || n.link.includes(`/projects/${project.id}`)));
                            if (unreadForProject.length > 0) {
                              const commentsCount = unreadForProject.filter(n => n.type === 'comment').length;
                              const internalCount = unreadForProject.filter(n => n.type === 'internal_chat').length;
                              const docsCount = unreadForProject.filter(n => n.type === 'document').length;
                              const otherCount = unreadForProject.length - commentsCount - internalCount - docsCount;
                              
                              const badgeStyle = {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                background: '#ef4444',
                                color: 'white',
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                padding: '0.1rem 0.3rem',
                                borderRadius: '10px'
                              };

                              return (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {commentsCount > 0 && <span style={badgeStyle} title="New comments"><MessageCircle size={10} /> {commentsCount}</span>}
                                  {internalCount > 0 && <span style={{...badgeStyle, background: '#f59e0b'}} title="New internal chats"><Lock size={10} /> {internalCount}</span>}
                                  {docsCount > 0 && <span style={{...badgeStyle, background: '#3b82f6'}} title="New documents"><FileText size={10} /> {docsCount}</span>}
                                  {otherCount > 0 && <span style={{...badgeStyle, background: '#8b5cf6'}} title="Other alerts"><Bell size={10} /> {otherCount}</span>}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: '#475569', fontWeight: '500' }}>{project.client_name || 'No Client'}</td>
                    <td style={{ color: '#475569', fontWeight: '500' }}>
                      {project.assigned_members && project.assigned_members.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {project.assigned_members.map(m => (
                            <span key={m.id} className="team-member-badge" title={`${m.name} (${m.role})`}>
                              {m.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        project.assigned_name || 'Unassigned'
                      )}
                    </td>
                    <td>
                      {(() => {
                        let st = project.service_type;
                        try {
                          if (typeof st === 'string' && st.startsWith('[')) {
                            st = JSON.parse(st);
                          }
                        } catch(e){}
                        if (Array.isArray(st) && st.length > 0) {
                          return <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{st.map((s, i) => <span key={i} className="service-tag">{s}</span>)}</div>;
                        }
                        return <span className="service-tag">{st || 'Unspecified'}</span>;
                      })()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '160px' }}>
                        <div className="progress-bar-bg" style={{ flex: 1, height: '6px', margin: 0 }}>
                          <div className="progress-bar-fill" style={{ width: `${percent}%` }}></div>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap' }}>{completed}/{total} ({percent}%)</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${isCompleted ? 'completed' : 'active'}`}>
                        {project.status || 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="btn-view-link" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Eye size={14} /> View
                        </button>
                        <button 
                          onClick={(e) => handleEditClick(e, project)} 
                          style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', color: '#6366f1', display: 'flex', alignItems: 'center' }}
                          title="Edit Project"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteClick(e, project)} 
                          style={{ background: 'none', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                          title="Delete Project"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {currentProjects.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    No projects found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredProjects.length > 0 && (
        <Pagination 
          currentPage={currentPage}
          totalItems={filteredProjects.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create New Project</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Project Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} required placeholder="e.g. Tax Filing (John Doe)" />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Client *</label>
                  <select name="client_id" value={formData.client_id} onChange={handleInputChange} required>
                    <option value="">Select a Client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.business_name || 'Individual'})</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Link Existing Invoice</label>
                  <select name="invoice_id" value={formData.invoice_id} onChange={handleInputChange}>
                    <option value="">No Invoice Linked</option>
                    {invoices.filter(i => i.client_id === parseInt(formData.client_id)).map(i => (
                      <option key={i.id} value={i.id}>{i.invoice_number} - PKR {i.amount}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Assign Team Members</label>
                <div className="multi-select-container">
                  <div className="selected-tags-box">
                    {(formData.team_member_ids || []).length === 0 ? (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No team members assigned yet</span>
                    ) : (
                      (formData.team_member_ids || []).map(id => {
                        const m = teamMembers.find(member => member.id === parseInt(id));
                        if (!m) return null;
                        return (
                          <span key={id} className="member-tag">
                            {m.full_name} ({m.role})
                            <button 
                              type="button" 
                              className="tag-remove-btn" 
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  team_member_ids: prev.team_member_ids.filter(mId => mId !== id),
                                  pm_id: prev.pm_id === id ? (prev.team_member_ids.find(mId => mId !== id) || '') : prev.pm_id
                                }));
                              }}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                  <select 
                    className="multi-select-dropdown"
                    value=""
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val && !formData.team_member_ids.includes(val)) {
                        setFormData(prev => ({
                          ...prev,
                          team_member_ids: [...prev.team_member_ids, val],
                          pm_id: prev.pm_id || val
                        }));
                      }
                    }}
                  >
                    <option value="">+ Select Team Member to Assign...</option>
                    {teamMembers
                      .filter(m => !(formData.team_member_ids || []).includes(m.id))
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Service Type(s) *</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {(formData.service_type || []).map(st => (
                      <span key={st} style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {st}
                        <X 
                          size={14} 
                          style={{ cursor: 'pointer' }} 
                          onClick={() => setFormData(prev => ({...prev, service_type: prev.service_type.filter(s => s !== st)}))} 
                        />
                      </span>
                    ))}
                  </div>
                  <select 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !(formData.service_type || []).includes(val)) {
                        setFormData(prev => ({
                          ...prev,
                          service_type: [...(prev.service_type || []), val]
                        }));
                      }
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Select Service Type...</option>
                    {availableServices.filter(s => !(formData.service_type || []).includes(s)).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Revision Cycles Included</label>
                  <input type="number" name="revision_cycles_included" value={formData.revision_cycles_included} onChange={handleInputChange} min="0" />
                </div>
              </div>

              <div className="form-group">
                <label>Terms & Conditions</label>
                <textarea name="terms_and_conditions" value={formData.terms_and_conditions} onChange={handleInputChange} rows="3" placeholder="Specify any project-specific terms..."></textarea>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3"></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-create">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit Project</h2>
              <button className="btn-close" onClick={() => setIsEditModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>Project Title *</label>
                <input 
                  type="text" 
                  name="title" 
                  value={editFormData.title} 
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} 
                  required 
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Client *</label>
                  <select 
                    name="client_id" 
                    value={editFormData.client_id} 
                    onChange={(e) => setEditFormData({ ...editFormData, client_id: e.target.value })} 
                    required
                  >
                    <option value="">Select a Client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.business_name || 'Individual'})</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Assign Team Members</label>
                <div className="multi-select-container">
                  <div className="selected-tags-box">
                    {(editFormData.team_member_ids || []).length === 0 ? (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No team members assigned yet</span>
                    ) : (
                      (editFormData.team_member_ids || []).map(id => {
                        const m = teamMembers.find(member => member.id === parseInt(id));
                        if (!m) return null;
                        return (
                          <span key={id} className="member-tag">
                            {m.full_name} ({m.role})
                            <button 
                              type="button" 
                              className="tag-remove-btn" 
                              onClick={() => {
                                setEditFormData(prev => ({
                                  ...prev,
                                  team_member_ids: prev.team_member_ids.filter(mId => mId !== id),
                                  pm_id: prev.pm_id === id ? (prev.team_member_ids.find(mId => mId !== id) || '') : prev.pm_id
                                }));
                              }}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                  <select 
                    className="multi-select-dropdown"
                    value=""
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val && !(editFormData.team_member_ids || []).includes(val)) {
                        setEditFormData(prev => ({
                          ...prev,
                          team_member_ids: [...(prev.team_member_ids || []), val],
                          pm_id: prev.pm_id || val
                        }));
                      }
                    }}
                  >
                    <option value="">+ Select Team Member to Assign...</option>
                    {teamMembers
                      .filter(m => !(editFormData.team_member_ids || []).includes(m.id))
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Service Type(s) *</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {(editFormData.service_type || []).map(st => (
                      <span key={st} style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {st}
                        <X 
                          size={14} 
                          style={{ cursor: 'pointer' }} 
                          onClick={() => setEditFormData(prev => ({...prev, service_type: prev.service_type.filter(s => s !== st)}))} 
                        />
                      </span>
                    ))}
                  </div>
                  <select 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !(editFormData.service_type || []).includes(val)) {
                        setEditFormData(prev => ({
                          ...prev,
                          service_type: [...(prev.service_type || []), val]
                        }));
                      }
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Select Service Type...</option>
                    {availableServices.filter(s => !(editFormData.service_type || []).includes(s)).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Revision Cycles Included</label>
                  <input 
                    type="number" 
                    name="revision_cycles_included" 
                    value={editFormData.revision_cycles_included} 
                    onChange={(e) => setEditFormData({ ...editFormData, revision_cycles_included: e.target.value })} 
                    min="0" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Terms & Conditions</label>
                <textarea 
                  name="terms_and_conditions" 
                  value={editFormData.terms_and_conditions} 
                  onChange={(e) => setEditFormData({ ...editFormData, terms_and_conditions: e.target.value })} 
                  rows="3"
                ></textarea>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea 
                  name="description" 
                  value={editFormData.description} 
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} 
                  rows="3"
                ></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-create">Update Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
