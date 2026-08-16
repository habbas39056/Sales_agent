import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search, Plus, User, Edit, Trash2, MoreVertical, Eye, RefreshCw, FileText, Download, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../components/Pagination';
import './ClientsList.css';
import './Modal.css';

export default function ClientsList() {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [agentsList, setAgentsList] = useState([]);
  
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/users/specialists', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAgentsList(res.data);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      }
    };
    fetchAgents();
  }, []);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
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
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      let url = '/api/clients';
      if (user) {
        url += `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }

      const res = await axios.get(url);
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
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      const payload = {
        ...formData,
        created_by: user ? user.id : null
      };

      if (editingClient) {
        // Edit Mode
        await axios.put(`/api/clients/${editingClient.id}`, payload);
      } else {
        // Add Mode
        await axios.post('/api/clients', payload);
      }
      setIsModalOpen(false);
      setEditingClient(null);
      fetchClients(); // Refresh the list
    } catch (error) {
      console.error('Failed to save client:', error);
      alert(error.response?.data?.error || 'Error saving client. Please check the required fields.');
    }
  };

  const handleRefresh = () => {
    fetchClients();
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("Clients Statement Report", 14, 18);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} | Total Records: ${filteredClients.length}`, 14, 25);
      
      const tableColumn = ["Client / Business Name", "WhatsApp", "Email", "Address", "Created Date"];
      const tableRows = filteredClients.map(client => [
        client.business_name ? `${client.business_name}\n(${client.full_name})` : (client.full_name || '-'),
        client.whatsapp_number || '-',
        client.email || 'None',
        client.physical_address || '-',
        client.created_at ? new Date(client.created_at).toLocaleDateString('en-GB') : '-'
      ]);
      
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        styles: { fontSize: 8.5, cellPadding: 3 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      doc.save("clients_statement.pdf");
    } catch (error) {
      console.error("PDF Export error:", error);
      alert("Failed to export PDF: " + error.message);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredClients.map(client => ({
      Name: client.business_name || client.full_name,
      Type: client.business_name ? 'Business' : 'Individual',
      WhatsApp: client.whatsapp_number || '-',
      Email: client.email || 'None',
      CreatedDate: new Date(client.created_at).toLocaleDateString('en-GB')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
    XLSX.writeFile(workbook, "clients_list.xlsx");
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      let successCount = 0;
      let errorCount = 0;
      
      const token = localStorage.getItem('token');
      const currentUser = JSON.parse(localStorage.getItem('user')) || {};

      for (const row of data) {
        try {
          const payload = {
            full_name: row.Name || row.full_name || 'Imported Client',
            business_name: row.BusinessName || row.business_name || '',
            email: row.Email || row.email || `imported_${Date.now()}@example.com`,
            whatsapp_number: row.WhatsApp || row.whatsapp_number || '',
            physical_address: row.Address || row.physical_address || '',
            password: 'password123',
            created_by: currentUser.id
          };
          await axios.post('/api/clients', payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
          successCount++;
        } catch (err) {
          console.error("Import error for row", row, err);
          errorCount++;
        }
      }
      
      alert(`Import complete! Successfully added: ${successCount}. Errors: ${errorCount}.`);
      fetchClients();
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset input
  };

  const [datePreset, setDatePreset] = useState('All Dates');
  const [agentFilter, setAgentFilter] = useState('All Sales Agents');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Handle Date Presets
  useEffect(() => {
    if (datePreset === 'All Dates') {
      setFromDate('');
      setToDate('');
    } else if (datePreset === 'Today') {
      const today = new Date().toISOString().slice(0, 10);
      setFromDate(today);
      setToDate(today);
    } else if (datePreset === 'This Week') {
      const curr = new Date();
      const first = curr.getDate() - curr.getDay() + 1;
      const firstday = new Date(curr.setDate(first)).toISOString().slice(0, 10);
      const lastday = new Date(curr.setDate(curr.getDate() + 6)).toISOString().slice(0, 10);
      setFromDate(firstday);
      setToDate(lastday);
    } else if (datePreset === 'This Month') {
      const curr = new Date();
      const firstday = new Date(curr.getFullYear(), curr.getMonth(), 1).toISOString().slice(0, 10);
      const lastday = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).toISOString().slice(0, 10);
      setFromDate(firstday);
      setToDate(lastday);
    } else if (datePreset === 'Custom') {
      // Leave dates as they are, user will select
    }
  }, [datePreset]);

  const filteredClients = clients.filter(c => {
    const term = searchTerm.trim().toLowerCase();
    
    // Multi-field search across Name, Business, Email, Phone/WhatsApp, Address, and ID
    const matchesSearch = !term || 
      (c.full_name && c.full_name.toLowerCase().includes(term)) || 
      (c.business_name && c.business_name.toLowerCase().includes(term)) || 
      (c.email && c.email.toLowerCase().includes(term)) || 
      (c.whatsapp_number && c.whatsapp_number.toLowerCase().includes(term)) || 
      (c.physical_address && c.physical_address.toLowerCase().includes(term)) || 
      (c.id && c.id.toString().includes(term));

    // Date Range Filter
    let matchesDate = true;
    if (c.created_at) {
      const clientDateStr = new Date(c.created_at).toISOString().slice(0, 10);
      if (fromDate && clientDateStr < fromDate) {
        matchesDate = false;
      }
      if (toDate && clientDateStr > toDate) {
        matchesDate = false;
      }
    }

    // Agent Filter
    let matchesAgent = true;
    if (agentFilter !== 'All Sales Agents') {
      matchesAgent = c.created_by === parseInt(agentFilter, 10);
    }

    return matchesSearch && matchesDate && matchesAgent;
  });

  const currentClients = filteredClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="clients-list-container modern-ui">
      {/* Top Header: Title & Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Clients Directory
            </h1>
            <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.75rem', fontWeight: '600', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
              {filteredClients.length} {filteredClients.length === 1 ? 'Client' : 'Clients'}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Manage client profiles, contact information, and portal credentials
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            className="btn-secondary" 
            onClick={handleRefresh} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#334155', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <RefreshCw size={15} color="#64748b" /> Refresh
          </button>
          <button 
            className="btn-secondary" 
            onClick={handleExportPDF} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.9rem', borderRadius: '8px', border: 'none', background: '#0f172a', color: '#ffffff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, boxShadow: '0 1px 3px rgba(15,23,42,0.15)' }}
          >
            <FileText size={15} /> PDF Statement
          </button>
          <button 
            className="btn-secondary" 
            onClick={handleExportExcel} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#334155', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <Download size={15} color="#64748b" /> Export Excel
          </button>
          <label 
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#334155', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <Upload size={15} color="#64748b" /> Import Excel
            <input type="file" accept=".xlsx, .xls, .csv" style={{ display: 'none' }} onChange={handleImportExcel} />
          </label>
          <button 
            className="btn-primary" 
            onClick={openAddModal} 
            style={{ borderRadius: '8px', fontSize: '0.85rem', padding: '0.55rem 1.15rem', background: '#4f46e5', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontWeight: 600, boxShadow: '0 1px 3px rgba(79,70,229,0.25)' }}
          >
            <Plus size={16} /> Add New Client
          </button>
        </div>
      </div>

      <div className="recent-orders-panel" style={{ marginTop: '0.5rem' }}>
        {/* Search & Filter Toolbar inside Card */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.5rem' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input 
              type="text" 
              placeholder="Search by name, email, phone, address..." 
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: '100%', height: '38px', padding: '0 12px 0 38px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#1e293b', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Filters Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select 
              value={datePreset}
              onChange={e => {
                setDatePreset(e.target.value);
                setCurrentPage(1);
              }}
              style={{ height: '38px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              <option value="All Dates">All Dates</option>
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="Custom">Custom</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 0.65rem', height: '38px', boxSizing: 'border-box' }}>
              <input 
                type="date" 
                value={fromDate} 
                onChange={e => {
                  setFromDate(e.target.value);
                  setDatePreset('Custom');
                  setCurrentPage(1);
                }}
                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', color: '#334155', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              />
              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>to</span>
              <input 
                type="date" 
                value={toDate} 
                onChange={e => {
                  setToDate(e.target.value);
                  setDatePreset('Custom');
                  setCurrentPage(1);
                }}
                style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', color: '#334155', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              />
              {(fromDate || toDate) && (
                <button 
                  onClick={() => { setFromDate(''); setToDate(''); setDatePreset('All Dates'); setCurrentPage(1); }}
                  style={{ border: 'none', background: '#e2e8f0', color: '#64748b', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', marginLeft: '0.2rem', padding: '0.15rem 0.35rem', borderRadius: '4px' }}
                  title="Clear Date Filter"
                >
                  ✕
                </button>
              )}
            </div>

            <select 
              value={agentFilter}
              onChange={e => {
                setAgentFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ height: '38px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              <option value="All Sales Agents">All Sales Agents</option>
              {agentsList.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-responsive-ref" style={{ overflow: 'visible' }}>
          <table className="ref-table client-mockup-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>WhatsApp</th>
                <th>Email</th>
                <th>Portal Credentials</th>
                <th>Created Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {currentClients.map(client => (
                <tr key={client.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <Link to={`/clients/${client.id}`} style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem' }}>
                        {client.business_name || client.full_name}
                      </Link>
                      {client.business_name && client.business_name !== client.full_name && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                          {client.full_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    {client.whatsapp_number || '-'}
                  </td>
                  <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    {client.email || 'None'}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#334155', lineHeight: '1.4' }}>
                    <div><span style={{ color: '#94a3b8' }}>User:</span> <strong>{client.email ? client.email.split('@')[0] : 'N/A'}</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>Pass:</span> <strong>••••••••</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>PIN:</span> <strong>****</strong></div>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    {new Date(client.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td style={{ position: 'relative' }}>
                    <button 
                      className="btn-icon" 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem' }}
                      onClick={() => setActiveDropdown(activeDropdown === client.id ? null : client.id)}
                    >
                      <MoreVertical size={18} />
                    </button>

                    {activeDropdown === client.id && (
                      <div className="action-dropdown-menu">
                        <Link to={`/clients/${client.id}`} className="dropdown-item">
                          <Eye size={14} /> View Details
                        </Link>
                        <button className="dropdown-item" onClick={() => { setActiveDropdown(null); openEditModal(client); }}>
                          <Edit size={14} /> Edit Client
                        </button>
                        <button className="dropdown-item danger" onClick={() => { setActiveDropdown(null); handleDelete(client.id); }}>
                          <Trash2 size={14} /> Delete Client
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {currentClients.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-state">No clients found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {filteredClients.length > 0 && (
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredClients.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
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
