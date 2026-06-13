import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Search, Folder, Plus, X } from 'lucide-react';
import './ProjectsList.css';
import './Modal.css';

export default function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [serviceFilter, setServiceFilter] = useState('All Services');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    invoice_id: '',
    service_type: 'Income Tax Return Filing',
    revision_cycles_included: 0,
    terms_and_conditions: ''
  });

  const availableServices = [
    'Income Tax Return Filing',
    'Sales Tax Registration',
    'Corporate Tax Filing',
    'Company Registration',
    'Website Development',
    'Logo Design',
    'SEO Optimization'
  ];

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
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/projects');
      setProjects(res.data);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/clients');
      setClients(res.data);
    } catch (error) {
      console.error('Failed to fetch clients', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/invoices');
      setInvoices(res.data);
    } catch (error) {
      console.error('Failed to fetch invoices', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/projects', formData);
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        client_id: '',
        invoice_id: '',
        service_type: 'Income Tax Return Filing',
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

  return (
    <div className="projects-container">
      <div className="projects-header">
        <h1>Project Management</h1>
        <button className="btn-create" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Create Project
        </button>
      </div>

      <div className="projects-filters">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by title or client name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All Statuses">All Statuses</option>
          {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select 
          className="filter-select"
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
        >
          <option value="All Services">All Services</option>
          {availableServices.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="projects-grid">
        {filteredProjects.map(project => {
          const total = project.total_steps || 0;
          const completed = project.completed_steps || 0;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
          const isCompleted = project.status === 'Completed' || project.status === 'Commission Released';
          
          return (
            <div 
              key={project.id} 
              className="project-card" 
              onClick={() => navigate(`/projects/${project.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-title">
                <div className="folder-icon">
                  <Folder size={20} />
                </div>
                <h3>{project.title}</h3>
              </div>
              
              <div className="card-details">
                <p><strong>Client:</strong> {project.client_name || 'No Client'}</p>
                <p><strong>Service:</strong> {project.service_type || 'Unspecified'}</p>
              </div>

              <div className="card-progress-section">
                <div className="progress-labels">
                  <span className="progress-title">Progress</span>
                  <span className="progress-stats">{completed}/{total} Steps ({percent}%)</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${percent}%` }}></div>
                </div>
              </div>

              <div className="card-footer">
                <span className={`status-pill ${isCompleted ? 'completed' : 'active'}`}>
                  {isCompleted ? 'Completed' : 'Active'}
                </span>
              </div>
            </div>
          );
        })}
        {filteredProjects.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
            No projects found matching your criteria.
          </div>
        )}
      </div>

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
