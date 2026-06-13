import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search, Plus, User, Edit, Trash2 } from 'lucide-react';
import './ClientsList.css';
import './Modal.css';

export default function ClientsList() {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    business_name: '',
    email: '',
    whatsapp_number: '',
    physical_address: '',
    profile_image_url: '',
    password: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await axios.get('/api/clients');
      setClients(res.data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const openAddModal = () => {
    setEditingClient(null);
    setFormData({
      full_name: '', business_name: '', email: '', 
      whatsapp_number: '', physical_address: '', profile_image_url: '',
      password: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setFormData({
      full_name: client.full_name || '',
      business_name: client.business_name || '',
      email: client.email || '',
      whatsapp_number: client.whatsapp_number || '',
      physical_address: client.physical_address || '',
      profile_image_url: client.profile_image_url || '',
      password: '' // Don't show existing password
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (clientId) => {
    if (window.confirm('Are you sure you want to delete this client? This cannot be undone.')) {
      try {
        await axios.delete(`/api/clients/${clientId}`);
        fetchClients();
      } catch (error) {
        console.error('Failed to delete client:', error);
        alert(error.response?.data?.error || 'Failed to delete client. They might have active projects or invoices.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        // Edit Mode
        await axios.put(`/api/clients/${editingClient.id}`, formData);
      } else {
        // Add Mode
        await axios.post('/api/clients', formData);
      }
      setIsModalOpen(false);
      setEditingClient(null);
      fetchClients(); // Refresh the list
    } catch (error) {
      console.error('Failed to save client:', error);
      alert(error.response?.data?.error || 'Error saving client. Please check the required fields.');
    }
  };

  const filteredClients = clients.filter(c => 
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.business_name && c.business_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="clients-list-container modern-ui">
      <div className="recent-orders-panel" style={{ marginTop: '2rem' }}>
        <div className="panel-header-ref">
          <div className="search-box-ref">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search clients..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={openAddModal} style={{ borderRadius: '20px', fontSize: '0.85rem' }}>
            <Plus size={16} /> Add New Client
          </button>
        </div>

        <div className="table-responsive-ref">
          <table className="ref-table">
            <thead>
              <tr>
                <th>CLIENT</th>
                <th>CONTACT</th>
                <th>ADDRESS</th>
                <th>JOINED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id}>
                  <td>
                    <div className="client-cell">
                      {client.profile_image_url ? (
                        <img src={client.profile_image_url} alt={client.full_name} className="avatar" />
                      ) : (
                        <div className="avatar placeholder"><User size={20} /></div>
                      )}
                      <div>
                        <strong>{client.full_name}</strong>
                        {client.business_name && <div className="text-small text-secondary">{client.business_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-small">{client.email}</div>
                    {client.whatsapp_number && <div className="text-small text-secondary">{client.whatsapp_number}</div>}
                  </td>
                  <td>
                    <div className="text-small text-secondary" style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {client.physical_address || '-'}
                    </div>
                  </td>
                  <td>{new Date(client.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <Link to={`/clients/${client.id}`} className="btn-link">View Profile</Link>
                      <button className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => openEditModal(client)} title="Edit Client">
                        <Edit size={18} />
                      </button>
                      <button className="btn-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} onClick={() => handleDelete(client.id)} title="Delete Client">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-state">No clients found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Client Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editingClient ? 'Edit Client' : 'Add New Client'}</h2>
            <form onSubmit={handleSubmit}>
              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', marginTop: '0' }}>1. Client Profile</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} required />
                </div>
                
                <div className="form-group">
                  <label>Business / Company Name</label>
                  <input type="text" name="business_name" value={formData.business_name} onChange={handleInputChange} />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Email Address *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} required disabled={!!editingClient} title={editingClient ? "Email cannot be changed after creation" : ""} />
                </div>
                
                <div className="form-group">
                  <label>WhatsApp Number</label>
                  <input type="text" name="whatsapp_number" value={formData.whatsapp_number} onChange={handleInputChange} />
                </div>
              </div>

              <div className="form-group">
                <label>Physical Address</label>
                <textarea name="physical_address" value={formData.physical_address} onChange={handleInputChange} rows="2"></textarea>
              </div>

              {!editingClient && (
                <>
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', marginTop: '1.5rem' }}>2. Client Portal Login</h3>

                  <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label>Client Portal Password *</label>
                    <input type="password" name="password" value={formData.password} onChange={handleInputChange} placeholder="Set a temporary password" required />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingClient(null); }}>Cancel</button>
                <button type="submit" className="btn-primary">{editingClient ? 'Update Client' : 'Save Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
