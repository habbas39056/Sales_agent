import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, X, User, Mail, Calendar, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './TeamManagement.css';
import './Modal.css';

export default function TeamManagement() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Project Manager',
    commission_percentage: 0
  });
  const navigate = useNavigate();

  const availableRoles = [
    'Admin',
    'Project Manager',
    'Sales Rep',
    'Production',
    'QA'
  ];

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/users', formData);
      setIsModalOpen(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'Project Manager',
        commission_percentage: 0
      });
      fetchTeamMembers();
    } catch (error) {
      console.error('Error creating team member', error);
      alert(error.response?.data?.error || 'Error creating team member');
    }
  };

  const getRoleClass = (role) => {
    return `team-role role-${role.toLowerCase().replace(' ', '-')}`;
  };

  const handleCardClick = (role) => {
    switch (role) {
      case 'Project Manager':
        navigate('/pm');
        break;
      case 'Sales Rep':
        navigate('/sales');
        break;
      case 'Production':
        navigate('/production');
        break;
      case 'Admin':
        navigate('/dashboard');
        break;
      default:
        alert(`No specific portal view exists for ${role} yet.`);
    }
  };

  return (
    <div className="team-container">
      <div className="page-header">
        <div>
          <h1>Team Management</h1>
          <p className="subtitle" style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage your agency's internal team</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
          <Plus size={18} /> Add Team Member
        </button>
      </div>

      <div className="team-grid">
        {teamMembers.map(member => (
          <div 
            key={member.id} 
            className="team-card"
            onClick={() => handleCardClick(member.role)}
            style={{ cursor: 'pointer' }}
            title={`View ${member.role} Portal`}
          >
            <div className="team-card-header">
              <div className="team-avatar">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="team-info">
                <h3 className="team-name">{member.name}</h3>
                <span className={getRoleClass(member.role)}>{member.role}</span>
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
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Add New Team Member</h2>
              <button type="button" className="btn-close" onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  placeholder="e.g. Jane Doe"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  placeholder="jane@adwiselabs.com"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Temporary Password</label>
                <input 
                  type="password" 
                  name="password" 
                  value={formData.password} 
                  onChange={handleInputChange} 
                  placeholder="Create an initial password"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select name="role" value={formData.role} onChange={handleInputChange} required>
                  {availableRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Commission Percentage (%)</label>
                <input 
                  type="number" 
                  name="commission_percentage" 
                  value={formData.commission_percentage} 
                  onChange={handleInputChange} 
                  min="0"
                  step="0.01"
                  placeholder="e.g. 5.00 for 5%"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '0.75rem 1.25rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Create Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
