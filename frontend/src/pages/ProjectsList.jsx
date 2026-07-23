import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Search, Folder, Plus, X, FileSpreadsheet } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [serviceFilter, setServiceFilter] = useState('All Services');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    invoice_id: '',
    pm_id: '',
    service_type: '',
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
  }, []);

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
        service_type: categories.length > 0 ? categories[0].name : '',
        revision_cycles_included: 0,
        terms_and_conditions: ''
      });
      fetchProjects();
    } catch (error) {
      console.error('Error creating project', error);
      alert('Error creating project');
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (project.client_name && project.client_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Simplistic mapping for Active/Pending/etc for display purposes based on DB ENUM
    const isCompleted = project.status === 'Completed' || project.status === 'Commission Released';
    const displayStatus = isCompleted ? 'Completed' : 'Active';

    const matchesStatus = statusFilter === 'All Statuses' || displayStatus === statusFilter;
    const matchesService = serviceFilter === 'All Services' || project.service_type === serviceFilter;
    
    return matchesSearch && matchesStatus && matchesService;
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
                        <span>{project.title}</span>
                      </div>
                    </td>
                    <td style={{ color: '#475569', fontWeight: '500' }}>{project.client_name || 'No Client'}</td>
                    <td style={{ color: '#475569', fontWeight: '500' }}>{project.assigned_name || 'Unassigned'}</td>
                    <td>
                      <span className="service-tag">{project.service_type || 'Unspecified'}</span>
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
                        {isCompleted ? 'Completed' : 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '1.25rem' }}>
                      <button className="btn-view-link">View</button>
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
                      <option key={i.id} value={i.id}>{i.invoice_number} - ${i.amount}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Assign To (Team Member)</label>
                  <select name="pm_id" value={formData.pm_id} onChange={handleInputChange}>
                    <option value="">Unassigned</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Service Type *</label>
                  <select name="service_type" value={formData.service_type} onChange={handleInputChange} required>
                    {availableServices.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <div className="form-group">
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
    </div>
  );
}
