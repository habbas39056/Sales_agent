import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, X, User, Mail, Calendar, Shield, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './TeamManagement.css';
import './Modal.css';

export default function TeamManagement() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'Employee',
    role: 'Employee',
    commission_percentage: 0,
    modules_access: []
  });
  const [editingUserId, setEditingUserId] = useState(null);
  const navigate = useNavigate();

  const availableRoles = [
    'Admin',
    'Project Manager',
    'Sales Rep',
    'Production',
    'QA',
    'Employee'
  ];

  const availableModules = [
    'DASHBOARD', 'CLIENTS', 'PROJECTS', 'INVOICES', 'CASHBOOK',
    'COMMISSIONS', 'REPORTS', 'STAFF MANAGEMENT'
  ];

  const moduleDisplayNames = {
    'DASHBOARD': 'Dashboard',
    'CLIENTS': 'Client Management',
    'PROJECTS': 'Project Creation',
    'INVOICES': 'Invoice Management',
    'CASHBOOK': 'Expenses',
    'COMMISSIONS': 'Commissions',
    'REPORTS': 'System Reports',
    'STAFF MANAGEMENT': 'Team Management'
  };

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const res = await axios.get('/api/users');
      setTeamMembers(res.data);
    } catch (error) {
      console.error('Failed to fetch team members', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleModuleToggle = (moduleName) => {
    const currentModules = formData.modules_access;
    if (currentModules.includes(moduleName)) {
      setFormData({ ...formData, modules_access: currentModules.filter(m => m !== moduleName) });
    } else {
      setFormData({ ...formData, modules_access: [...currentModules, moduleName] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        await axios.put(`/api/users/${editingUserId}`, formData);
      } else {
        await axios.post('/api/users', formData);
      }
      closeModal();
      fetchTeamMembers();
    } catch (error) {
      console.error('Error saving team member', error);
      alert(error.response?.data?.error || 'Error saving team member');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setFormData({
      name: '',
      username: '',
      email: '',
      password: '',
      role: 'Employee',
      commission_percentage: 0,
      modules_access: []
    });
  };

  const handleEdit = (e, member) => {
    e.stopPropagation();
    setFormData({
      name: member.name || '',
      username: member.username || '',
      email: member.email || '',
      password: '', // Leave blank for edit, only update if provided
      role: member.role || 'Employee',
      commission_percentage: member.commission_percentage || 0,
      modules_access: member.modules_access || []
    });
    setEditingUserId(member.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this team member? This action cannot be undone.')) {
      try {
        await axios.delete(`/api/users/${id}`);
        fetchTeamMembers();
      } catch (error) {
        console.error('Error deleting team member', error);
        alert(error.response?.data?.error || 'Error deleting team member');
      }
    }
  };

  const getRoleClass = (role) => {
    return `team-role role-${role.toLowerCase().replace(' ', '-')}`;
  };

  const handleCardClick = (member) => {
    // If they click any member, we impersonate them!
    const currentUserStr = localStorage.getItem('user');
    const currentUser = JSON.parse(currentUserStr);

    // Don't let them impersonate themselves
    if (currentUser.id === member.id) return;

    if (window.confirm(`Are you sure you want to view the portal exactly as ${member.name}?`)) {
      // Save current user as the original admin
      if (!localStorage.getItem('originalAdminUser')) {
        localStorage.setItem('originalAdminUser', currentUserStr);
      }
      
      // Overwrite the session user with the target member
      localStorage.setItem('user', JSON.stringify(member));
      
      // Determine correct landing page based on role and modules
      let destination = '/dashboard';
      if (member.role === 'Client') {
        destination = '/client-portal';
      } else if (member.role === 'Project Manager') {
        destination = '/pm';
      } else if (member.role === 'Sales Rep') {
        destination = '/sales';
      } else if (member.role === 'Production') {
        destination = '/production';
      } else if (member.role === 'Employee') {
        if (!member.modules_access || member.modules_access.length === 0) {
          destination = '/dashboard';
        } else if (member.modules_access.includes('DASHBOARD')) {
          destination = '/dashboard';
        } else if (member.modules_access.includes('CLIENTS')) {
          destination = '/clients';
        } else if (member.modules_access.includes('PROJECTS')) {
          destination = '/projects';
        } else if (member.modules_access.includes('INVOICES')) {
          destination = '/invoices';
        } else if (member.modules_access.includes('CASHBOOK')) {
          destination = '/expenses';
        } else {
          destination = '/dashboard';
        }
      }
      
      // Reload the page completely so the entire app re-initializes as this user
      window.location.href = destination;
    }
  };

  return (
    <div className="team-container">
      <div className="page-header">
        <div>
          <h1>Team Management</h1>
          <p className="subtitle" style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage your agency's internal team</p>
        </div>
        <button className="btn-primary" onClick={() => { closeModal(); setIsModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
          <Plus size={18} /> Add Team Member
        </button>
      </div>

      <div className="team-grid">
        {teamMembers.map(member => (
          <div 
            key={member.id} 
            className="team-card"
            onClick={() => handleCardClick(member)}
            style={{ cursor: 'pointer' }}
            title={`View ${member.role} Portal`}
          >
            <div className="team-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                <div className="team-avatar">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="team-info">
                  <h3 className="team-name">{member.name}</h3>
                  <span className={getRoleClass(member.role)}>{member.role}</span>
                </div>
              </div>
              <div className="team-card-actions">
                <button className="btn-icon edit-btn" onClick={(e) => handleEdit(e, member)} title="Edit Member">
                  <Edit size={16} />
                </button>
                <button className="btn-icon delete-btn" onClick={(e) => handleDelete(e, member.id)} title="Delete Member">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="team-details">
              <div className="team-detail-item">
                <Mail size={16} />
                <span>{member.email}</span>
              </div>
              {member.commission_percentage !== null && member.commission_percentage > 0 && (
                <div className="team-detail-item">
                  <strong style={{ display: 'inline-block', width: '16px', textAlign: 'center', fontSize: '14px' }}>%</strong>
                  <span>{Number(member.commission_percentage).toFixed(2)}% Commission</span>
                </div>
              )}
              <div className="team-detail-item">
                <Calendar size={16} />
                <span>Joined {new Date(member.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {member.modules_access && member.modules_access.length > 0 && (
              <div className="team-modules-preview">
                <div className="modules-preview-title">Modules Access</div>
                <div className="modules-preview-list">
                  {member.modules_access.map(mod => (
                    <span key={mod} className="module-pill">{moduleDisplayNames[mod] || mod}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h2>{editingUserId ? 'Edit Team Member' : 'Add New Team Member'}</h2>
              <button type="button" className="btn-close" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row-4">
                <div className="form-group">
                  <label>NAME *</label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>EMAIL</label>
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>USERNAME *</label>
                  <input 
                    type="text" 
                    name="username" 
                    value={formData.username} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>{editingUserId ? 'PASSWORD (Leave blank to keep)' : 'PASSWORD *'}</label>
                  <input 
                    type="password" 
                    name="password" 
                    value={formData.password} 
                    onChange={handleInputChange} 
                    required={!editingUserId} 
                  />
                </div>
              </div>

              <div className="form-group" style={{ width: '25%', marginTop: '1rem' }}>
                <label>ROLE</label>
                <select name="role" value={formData.role} onChange={handleInputChange} required>
                  {availableRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label style={{ marginBottom: '1rem', display: 'block' }}>MODULES ACCESS</label>
                <div className="modules-access-container">
                  {availableModules.map(moduleName => (
                    <label key={moduleName} className="module-checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={formData.modules_access.includes(moduleName)}
                        onChange={() => handleModuleToggle(moduleName)}
                      />
                      <span>{moduleDisplayNames[moduleName] || moduleName}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions" style={{ justifyContent: 'flex-start', margin: '2rem 0' }}>
                <button type="submit" className="btn-primary" style={{ backgroundColor: '#4f46e5', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {editingUserId ? 'Update Employee' : <><Plus size={16} /> Create Employee</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
