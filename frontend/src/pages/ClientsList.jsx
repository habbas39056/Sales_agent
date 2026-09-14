import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Search, Plus, User, Edit, Trash2, MoreVertical, Eye, RefreshCw, 
  FileText, Download, Upload, MessageSquare, Mail, Phone, ExternalLink, 
  Filter, RotateCcw, ArrowUpRight, ShieldCheck, Building, Key, EyeOff,
  DollarSign, CheckCircle2, AlertCircle, Users, Receipt, Briefcase
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../components/Pagination';
import './ClientsList.css';
import './Modal.css';

export default function ClientsList() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [agentsList, setAgentsList] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  
  // Advanced Filter States
  const [balanceFilter, setBalanceFilter] = useState('all'); // 'all', 'has_balance', 'settled', 'zero'
  const [agentFilter, setAgentFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('All Dates');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  
  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    business_name: '',
    email: '',
    whatsapp_number: '',
    physical_address: '',
    profile_image_url: '',
    password: '',
    created_by: ''
  });

  useEffect(() => {
    fetchAgents();
    fetchClients();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.client-action-container')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/users/specialists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgentsList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      let url = '/api/clients';
      if (user) {
        url += `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }

      const res = await axios.get(url);
      setClients(res.data || []);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const openAddModal = () => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    setEditingClient(null);
    setShowPassword(false);
    setFormData({
      full_name: '', 
      business_name: '', 
      email: '', 
      whatsapp_number: '', 
      physical_address: '', 
      profile_image_url: '',
      password: '',
      created_by: currentUser.id || ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setShowPassword(false);
    setFormData({
      full_name: client.full_name || '',
      business_name: client.business_name || '',
      email: client.email || '',
      whatsapp_number: client.whatsapp_number || '',
      physical_address: client.physical_address || '',
      profile_image_url: client.profile_image_url || '',
      password: '', // Leave blank unless changing
      created_by: client.created_by || ''
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
        created_by: formData.created_by || (user ? user.id : null)
      };

      if (editingClient) {
        await axios.put(`/api/clients/${editingClient.id}`, payload);
      } else {
        await axios.post('/api/clients', payload);
      }
      setIsModalOpen(false);
      setEditingClient(null);
      fetchClients();
    } catch (error) {
      console.error('Failed to save client:', error);
      alert(error.response?.data?.error || 'Error saving client. Please check the required fields.');
    }
  };

  // Date presets handler
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
    }
  }, [datePreset]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setBalanceFilter('all');
    setAgentFilter('all');
    setDatePreset('All Dates');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const isFilterActive = searchTerm !== '' || balanceFilter !== 'all' || agentFilter !== 'all' || datePreset !== 'All Dates' || fromDate !== '' || toDate !== '';

  // Filtered Clients
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const term = searchTerm.trim().toLowerCase();
      
      const matchesSearch = !term || 
        (c.full_name && c.full_name.toLowerCase().includes(term)) || 
        (c.business_name && c.business_name.toLowerCase().includes(term)) || 
        (c.email && c.email.toLowerCase().includes(term)) || 
        (c.whatsapp_number && c.whatsapp_number.toLowerCase().includes(term)) || 
        (c.physical_address && c.physical_address.toLowerCase().includes(term)) || 
        (c.id && c.id.toString().includes(term));

      let matchesDate = true;
      if (c.created_at) {
        const clientDateStr = new Date(c.created_at).toISOString().slice(0, 10);
        if (fromDate && clientDateStr < fromDate) matchesDate = false;
        if (toDate && clientDateStr > toDate) matchesDate = false;
      }

      let matchesAgent = true;
      if (agentFilter !== 'all') {
        matchesAgent = String(c.created_by) === String(agentFilter);
      }

      let matchesBalance = true;
      const balance = Number(c.total_balance) || 0;
      const invoiced = Number(c.total_invoiced_amount) || 0;
      if (balanceFilter === 'has_balance') {
        matchesBalance = balance > 0;
      } else if (balanceFilter === 'settled') {
        matchesBalance = invoiced > 0 && balance <= 0;
      } else if (balanceFilter === 'zero') {
        matchesBalance = invoiced === 0;
      }

      return matchesSearch && matchesDate && matchesAgent && matchesBalance;
    });
  }, [clients, searchTerm, fromDate, toDate, agentFilter, balanceFilter]);


  const currentClients = useMemo(() => {
    return filteredClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredClients, currentPage, itemsPerPage]);

  const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return 'PKR ' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const getInitials = (name) => {
    if (!name) return 'CL';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarBg = (name) => {
    const palettes = [
      '#e11d48', '#2563eb', '#0891b2', '#059669', 
      '#d97706', '#7c3aed', '#db2777', '#4f46e5'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palettes[Math.abs(hash) % palettes.length];
  };

  const cleanPhoneForWhatsApp = (phone) => {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("Adwise Sales - Clients Statement Report", 14, 18);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} | Total Records: ${filteredClients.length}`, 14, 25);
      
      const tableColumn = ["Client / Business", "WhatsApp", "Email", "Invoiced", "Paid", "Balance Due", "Joined"];
      const tableRows = filteredClients.map(client => [
        client.business_name ? `${client.business_name} (${client.full_name})` : (client.full_name || '-'),
        client.whatsapp_number || '-',
        client.email || 'None',
        formatCurrency(client.total_invoiced_amount),
        formatCurrency(client.total_paid),
        formatCurrency(client.total_balance),
        client.created_at ? new Date(client.created_at).toLocaleDateString('en-GB') : '-'
      ]);
      
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      doc.save(`clients_directory_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (error) {
      console.error("PDF Export error:", error);
      alert("Failed to export PDF: " + error.message);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredClients.map(client => ({
      "Client ID": client.id,
      "Full Name": client.full_name,
      "Business Name": client.business_name || '-',
      "WhatsApp": client.whatsapp_number || '-',
      "Email": client.email || 'None',
      "Physical Address": client.physical_address || '-',
      "Total Invoiced (PKR)": Number(client.total_invoiced_amount) || 0,
      "Total Paid (PKR)": Number(client.total_paid) || 0,
      "Balance Due (PKR)": Number(client.total_balance) || 0,
      "Created Date": client.created_at ? new Date(client.created_at).toLocaleDateString('en-GB') : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clients Directory");
    XLSX.writeFile(workbook, `clients_directory_${new Date().toISOString().slice(0,10)}.xlsx`);
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
            full_name: row.Name || row['Full Name'] || row.full_name || 'Imported Client',
            business_name: row.BusinessName || row['Business Name'] || row.business_name || '',
            email: row.Email || row.email || `imported_${Date.now()}_${Math.floor(Math.random()*1000)}@client.com`,
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
    e.target.value = null;
  };

  return (
    <div className="clients-list-container modern-ui">
      {/* 1. Header with Title and Global Actions */}
      <div className="clients-page-header">
        <div className="header-title-area">
          <div className="header-badge-row">
            <h1 className="clients-main-heading">Client Management</h1>
            <span className="client-count-badge">
              {filteredClients.length} {filteredClients.length === 1 ? 'Client' : 'Clients'}
            </span>
            {isFilterActive && (
              <span className="filter-active-pill">Filtered Results</span>
            )}
          </div>
          <p className="clients-subheading">
            Manage relationship portfolios, contact communications, portal credentials, and live receivable balances
          </p>
        </div>

        <div className="clients-header-actions">
          <button 
            type="button"
            className="action-btn secondary-btn" 
            onClick={fetchClients} 
            title="Refresh clients list"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          
          <button 
            type="button"
            className="action-btn export-pdf-btn" 
            onClick={handleExportPDF} 
            title="Download PDF report"
          >
            <FileText size={15} />
            <span>PDF Statement</span>
          </button>

          <button 
            type="button"
            className="action-btn secondary-btn" 
            onClick={handleExportExcel} 
            title="Export Excel spreadsheet"
          >
            <Download size={15} />
            <span>Export Excel</span>
          </button>

          <label className="action-btn secondary-btn import-label" title="Import from Excel">
            <Upload size={15} />
            <span>Import</span>
            <input type="file" accept=".xlsx, .xls, .csv" style={{ display: 'none' }} onChange={handleImportExcel} />
          </label>

          <button 
            type="button"
            className="action-btn primary-add-btn" 
            onClick={openAddModal}
          >
            <Plus size={16} />
            <span>Add New Client</span>
          </button>
        </div>
      </div>


      {/* 3. Main Data Card with Advanced Filtering & Table */}
      <div className="clients-table-panel">
        {/* Filter Control Bar */}
        <div className="clients-filter-bar">
          {/* Search Box */}
          <div className="search-field-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by client, company, phone, email, address..." 
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button 
                type="button"
                className="clear-search-btn" 
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Controls */}
          <div className="filter-controls-group">
            {/* Balance Status Filter */}
            <div className="select-wrapper">
              <select 
                value={balanceFilter} 
                onChange={e => { setBalanceFilter(e.target.value); setCurrentPage(1); }}
                className="filter-select"
              >
                <option value="all">All Payment Statuses</option>
                <option value="has_balance">⚠️ Has Balance Due</option>
                <option value="settled">✅ Fully Settled / Paid</option>
                <option value="zero">📁 Zero Invoices (New)</option>
              </select>
            </div>

            {/* Sales Agent Filter */}
            <div className="select-wrapper">
              <select 
                value={agentFilter}
                onChange={e => { setAgentFilter(e.target.value); setCurrentPage(1); }}
                className="filter-select"
              >
                <option value="all">All Sales Agents</option>
                {agentsList.map(agent => (
                  <option key={agent.id} value={agent.id}>Agent: {agent.full_name}</option>
                ))}
              </select>
            </div>

            {/* Date Preset */}
            <div className="select-wrapper">
              <select 
                value={datePreset}
                onChange={e => { setDatePreset(e.target.value); setCurrentPage(1); }}
                className="filter-select"
              >
                <option value="All Dates">All Dates</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="Custom">Custom Date Range</option>
              </select>
            </div>

            {/* Date Inputs Range */}
            <div className="date-range-box">
              <input 
                type="date" 
                value={fromDate} 
                onChange={e => {
                  setFromDate(e.target.value);
                  setDatePreset('Custom');
                  setCurrentPage(1);
                }}
                className="date-input"
                title="From Date"
              />
              <span className="date-separator">to</span>
              <input 
                type="date" 
                value={toDate} 
                onChange={e => {
                  setToDate(e.target.value);
                  setDatePreset('Custom');
                  setCurrentPage(1);
                }}
                className="date-input"
                title="To Date"
              />
            </div>

            {/* Reset Filters */}
            {isFilterActive && (
              <button 
                type="button" 
                className="reset-filters-btn" 
                onClick={handleResetFilters}
                title="Reset all filters"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Clients Table */}
        <div className="table-responsive-wrapper">
          <table className="clients-table">
            <thead>
              <tr>
                <th style={{ width: '260px' }}>CLIENT / BUSINESS</th>
                <th style={{ width: '180px' }}>COMMUNICATION</th>
                <th style={{ width: '130px', textAlign: 'right' }}>INVOICED</th>
                <th style={{ width: '130px', textAlign: 'right' }}>PAID</th>
                <th style={{ width: '150px', textAlign: 'center' }}>RECEIVABLE STATUS</th>
                <th style={{ width: '150px' }}>PORTAL ACCESS</th>
                <th style={{ width: '120px' }}>JOINED</th>
                <th style={{ width: '60px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    <div className="loading-spinner-row">
                      <RefreshCw size={24} className="spin" style={{ color: '#e11d48' }} />
                      <span>Loading clients directory...</span>
                    </div>
                  </td>
                </tr>
              ) : currentClients.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    <div className="empty-state-content">
                      <Users size={40} style={{ color: '#94a3b8', marginBottom: '0.75rem' }} />
                      <h3>No clients found</h3>
                      <p>Try adjusting your search criteria or filter selections.</p>
                      {isFilterActive && (
                        <button type="button" className="btn-secondary" onClick={handleResetFilters} style={{ marginTop: '0.75rem' }}>
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentClients.map(client => {
                  const balance = Number(client.total_balance) || 0;
                  const invoiced = Number(client.total_invoiced_amount) || 0;
                  const paid = Number(client.total_paid) || 0;
                  const displayName = client.business_name || client.full_name;
                  const cleanPhone = cleanPhoneForWhatsApp(client.whatsapp_number);

                  return (
                    <tr key={client.id} className="client-row">
                      {/* Client Identity & Avatar */}
                      <td>
                        <div className="client-identity-cell">
                          {client.profile_image_url ? (
                            <img src={client.profile_image_url} alt={client.full_name} className="client-avatar" />
                          ) : (
                            <div 
                              className="client-avatar initials" 
                              style={{ backgroundColor: getAvatarBg(client.full_name) }}
                            >
                              {getInitials(client.full_name)}
                            </div>
                          )}
                          <div className="client-name-details">
                            <Link to={`/clients/${client.id}`} className="client-primary-name" title="View Client 360°">
                              {displayName}
                            </Link>
                            {client.business_name && client.business_name !== client.full_name ? (
                              <span className="client-contact-name">
                                <User size={12} /> {client.full_name}
                              </span>
                            ) : (
                              <span className="client-id-badge">ID: #{client.id}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Communication & Direct Actions */}
                      <td>
                        <div className="client-comm-cell">
                          {client.whatsapp_number ? (
                            <div className="comm-item">
                              <a 
                                href={`https://wa.me/${cleanPhone}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="comm-link whatsapp"
                                title="Chat on WhatsApp"
                              >
                                <MessageSquare size={13} />
                                <span>{client.whatsapp_number}</span>
                              </a>
                            </div>
                          ) : (
                            <span className="comm-empty">No phone</span>
                          )}

                          {client.email ? (
                            <div className="comm-item">
                              <a 
                                href={`mailto:${client.email}`} 
                                className="comm-link email"
                                title="Send Email"
                              >
                                <Mail size={13} />
                                <span>{client.email}</span>
                              </a>
                            </div>
                          ) : (
                            <span className="comm-empty">No email</span>
                          )}
                        </div>
                      </td>

                      {/* Total Invoiced */}
                      <td style={{ textAlign: 'right' }}>
                        <span className="finance-amount invoiced">
                          {formatCurrency(invoiced)}
                        </span>
                      </td>

                      {/* Total Paid */}
                      <td style={{ textAlign: 'right' }}>
                        <span className="finance-amount paid">
                          {formatCurrency(paid)}
                        </span>
                      </td>

                      {/* Balance & Status Badge */}
                      <td style={{ textAlign: 'center' }}>
                        {balance > 0 ? (
                          <div className="balance-badge-wrap">
                            <span className="balance-pill due" title="Outstanding balance">
                              {formatCurrency(balance)}
                            </span>
                            <span className="balance-subtext">Due Pending</span>
                          </div>
                        ) : invoiced > 0 ? (
                          <span className="balance-pill settled">
                            <CheckCircle2 size={12} /> Settled
                          </span>
                        ) : (
                          <span className="balance-pill new">
                            No Invoices
                          </span>
                        )}
                      </td>

                      {/* Portal Access Details */}
                      <td>
                        <div className="portal-cred-box">
                          <div className="cred-line">
                            <span className="cred-label">Login:</span>
                            <span className="cred-val" title={client.email}>
                              {client.email ? client.email.split('@')[0] : 'None'}
                            </span>
                          </div>
                          <div className="cred-line">
                            <span className="cred-label">Pass:</span>
                            <span className="cred-masked">••••••••</span>
                          </div>
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td>
                        <span className="joined-date">
                          {client.created_at ? new Date(client.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </span>
                      </td>

                      {/* Actions Menu */}
                      <td style={{ textAlign: 'center', position: 'relative' }}>
                        <div className="client-action-container">
                          <button 
                            type="button"
                            className="btn-action-trigger" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === client.id ? null : client.id);
                            }}
                            title="Actions"
                          >
                            <MoreVertical size={17} />
                          </button>

                          {activeDropdown === client.id && (
                            <div className="client-actions-dropdown">
                              <Link 
                                to={`/clients/${client.id}`} 
                                className="dropdown-action-item"
                                onClick={() => setActiveDropdown(null)}
                              >
                                <Eye size={15} className="item-icon" />
                                <span>View 360° Profile</span>
                              </Link>

                              <button 
                                type="button"
                                className="dropdown-action-item highlight"
                                onClick={() => {
                                  setActiveDropdown(null);
                                  navigate(`/invoices/new?client_id=${client.id}`);
                                }}
                              >
                                <Receipt size={15} className="item-icon" />
                                <span>Create Invoice</span>
                              </button>

                              <button 
                                type="button"
                                className="dropdown-action-item"
                                onClick={() => {
                                  setActiveDropdown(null);
                                  navigate(`/quotations/new?client_id=${client.id}`);
                                }}
                              >
                                <FileText size={15} className="item-icon" />
                                <span>Create Quotation</span>
                              </button>

                              <div className="dropdown-divider"></div>

                              <button 
                                type="button"
                                className="dropdown-action-item" 
                                onClick={() => { 
                                  setActiveDropdown(null); 
                                  openEditModal(client); 
                                }}
                              >
                                <Edit size={15} className="item-icon" />
                                <span>Edit Information</span>
                              </button>

                              <button 
                                type="button"
                                className="dropdown-action-item danger" 
                                onClick={() => { 
                                  setActiveDropdown(null); 
                                  handleDelete(client.id); 
                                }}
                              >
                                <Trash2 size={15} className="item-icon" />
                                <span>Delete Client</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredClients.length > 0 && (
          <div className="clients-pagination-wrapper">
            <Pagination 
              currentPage={currentPage}
              totalItems={filteredClients.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 4. Senior Designer Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content client-modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div className="modal-header-title">
                <div className="modal-icon-badge">
                  <User size={20} />
                </div>
                <div>
                  <h2>{editingClient ? 'Edit Client Profile' : 'Onboard New Client'}</h2>
                  <p>Enter contact profile details and configure client portal credentials</p>
                </div>
              </div>
              <button 
                type="button" 
                className="close-modal-btn" 
                onClick={() => { setIsModalOpen(false); setEditingClient(null); }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="client-modal-form">
              {/* Section 1: Client & Company Information */}
              <div className="form-section-card">
                <h3 className="section-title">
                  <Building size={16} /> Client & Company Identity
                </h3>
                
                <div className="form-grid-2">
                  <div className="form-group-custom">
                    <label>Full Name <span className="req">*</span></label>
                    <input 
                      type="text" 
                      name="full_name" 
                      value={formData.full_name} 
                      onChange={handleInputChange} 
                      placeholder="e.g. John Doe"
                      required 
                    />
                  </div>
                  
                  <div className="form-group-custom">
                    <label>Company / Business Name</label>
                    <input 
                      type="text" 
                      name="business_name" 
                      value={formData.business_name} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Apex Global Tech"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group-custom">
                    <label>Assigned Sales Specialist</label>
                    <select 
                      name="created_by" 
                      value={formData.created_by} 
                      onChange={handleInputChange}
                    >
                      <option value="">Select Sales Specialist</option>
                      {agentsList.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.full_name} ({agent.email})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group-custom">
                    <label>Profile Image URL</label>
                    <input 
                      type="url" 
                      name="profile_image_url" 
                      value={formData.profile_image_url} 
                      onChange={handleInputChange} 
                      placeholder="https://example.com/photo.jpg"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Contact & Communication */}
              <div className="form-section-card">
                <h3 className="section-title">
                  <Phone size={16} /> Contact & Address Information
                </h3>
                
                <div className="form-grid-2">
                  <div className="form-group-custom">
                    <label>Email Address <span className="req">*</span></label>
                    <input 
                      type="email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleInputChange} 
                      placeholder="client@company.com"
                      required 
                      disabled={!!editingClient} 
                      title={editingClient ? "Email cannot be modified after registration" : ""} 
                    />
                    {editingClient && <span className="field-hint">Email serves as login username and is locked</span>}
                  </div>
                  
                  <div className="form-group-custom">
                    <label>WhatsApp / Mobile Phone</label>
                    <input 
                      type="text" 
                      name="whatsapp_number" 
                      value={formData.whatsapp_number} 
                      onChange={handleInputChange} 
                      placeholder="e.g. +92 300 1234567"
                    />
                  </div>
                </div>

                <div className="form-group-custom">
                  <label>Physical / Billing Address</label>
                  <textarea 
                    name="physical_address" 
                    value={formData.physical_address} 
                    onChange={handleInputChange} 
                    rows="2"
                    placeholder="Suite, Street, City, Country"
                  ></textarea>
                </div>
              </div>

              {/* Section 3: Portal Security Credentials */}
              <div className="form-section-card">
                <h3 className="section-title">
                  <Key size={16} /> Client Portal Access
                </h3>

                <div className="form-group-custom">
                  <label>
                    {editingClient ? 'Reset Portal Password (Optional)' : 'Client Portal Password'} 
                    {!editingClient && <span className="req">*</span>}
                  </label>
                  <div className="password-input-wrap">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      name="password" 
                      value={formData.password} 
                      onChange={handleInputChange} 
                      placeholder={editingClient ? 'Leave blank to keep existing password' : 'Enter temporary portal password'} 
                      required={!editingClient} 
                    />
                    <button 
                      type="button" 
                      className="password-toggle-btn" 
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="field-hint">
                    Client will use their email and this password to log in at the Client Portal
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="modal-footer-custom">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => { setIsModalOpen(false); setEditingClient(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editingClient ? 'Save Changes' : 'Create Client Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
