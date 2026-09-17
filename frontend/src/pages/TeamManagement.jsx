import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Plus, X, User, Mail, Calendar, Shield, Edit, Trash2, Search, 
  RefreshCw, FileText, Download, LayoutGrid, List, MessageSquare, 
  Target, Percent, LogIn, Eye, EyeOff, RotateCcw, Check, Phone, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../components/Pagination';
import './TeamManagement.css';
import './Modal.css';

export default function TeamManagement() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'Sales',
    whatsapp_number: '',
    commission_percentage: 0,
    monthly_goal: 0,
    modules_access: []
  });
  const [editingUserId, setEditingUserId] = useState(null);
  
  // Search, Filter and Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  
  const navigate = useNavigate();

  const availableRoles = [
    'Admin',
    'Product Manager',
    'Sales',
    'Production'
  ];

  const moduleCategories = [
    {
      name: 'Overview & Portals',
      modules: [
        { key: 'DASHBOARD', label: 'Executive Dashboard' },
        { key: 'SALES_PORTAL', label: 'Sales Specialist Portal' },
        { key: 'PM_PORTAL', label: 'Project Manager Portal' },
        { key: 'PRODUCTION_PORTAL', label: 'Production Portal' },
        { key: 'CLIENT_PORTAL', label: 'Client Portal' }
      ]
    },
    {
      name: 'User Management',
      modules: [
        { key: 'CLIENTS', label: 'Client Management' },
        { key: 'STAFF MANAGEMENT', label: 'Team Management' }
      ]
    },
    {
      name: 'Sales & Leads',
      modules: [
        { key: 'LEADS', label: 'Leads Management' },
        { key: 'INVOICES', label: 'Invoice Management' },
        { key: 'QUOTATIONS', label: 'Quotations & Estimates' },
        { key: 'ITEMS', label: 'Items Catalog' },
        { key: 'RECOVERY', label: 'ERP Recovery Module' }
      ]
    },
    {
      name: 'Operations & Projects',
      modules: [
        { key: 'PROJECTS', label: 'Project Creation' },
        { key: 'PROJECT_MANAGEMENT', label: 'Project Management' },
        { key: 'TASKS', label: 'My Tasks' },
        { key: 'DEADLINES', label: 'Deadline Workflow' },
        { key: 'DEADLINES_APPROVAL', label: 'Tasks for Approval' }
      ]
    },
    {
      name: 'Financial Management',
      modules: [
        { key: 'CASHBOOK', label: 'Expenses & Ledger' },
        { key: 'FUTURE_PAYABLES', label: 'Future Payables' },
        { key: 'COMMISSIONS', label: 'Commissions Tracker' },
        { key: 'PAYROLL', label: 'Payroll Management' }
      ]
    },
    {
      name: 'Reports & Analytics',
      modules: [
        { key: 'REPORTS', label: 'System Reports (Master Access)' },
        { key: 'REPORT_SALES', label: 'Sales Reports' },
        { key: 'REPORT_SALESPERSON', label: 'Salesperson Performance' },
        { key: 'REPORT_CLIENTS', label: 'Client Reports' },
        { key: 'REPORT_TEAM', label: 'Employee & Team Reports' },
        { key: 'REPORT_EXPENSES', label: 'Expense Reports' },
        { key: 'REPORT_PROFIT', label: 'Expenses vs Income' },
        { key: 'REPORT_ACCOUNTING', label: 'Finance & Accounting' },
        { key: 'REPORT_PRODUCTS', label: 'Product / Service Reports' },
        { key: 'REPORT_PROJECTS', label: 'Project Reporting' },
        { key: 'REPORT_INVOICES_AGING', label: 'Invoicing Aging' },
        { key: 'REPORT_CASH_FLOW', label: 'Cash Flow Analysis' },
        { key: 'REPORT_REVENUE_CONCENTRATION', label: 'Revenue Concentration' }
      ]
    },
    {
      name: 'Platform Settings',
      modules: [
        { key: 'SETTINGS', label: 'System Settings' }
      ]
    }
  ];


  const allModuleKeys = useMemo(() => {
    return Array.from(new Set(moduleCategories.flatMap(c => c.modules.map(m => m.key))));
  }, [moduleCategories]);

  const handleGrantAllModules = () => {
    setFormData(prev => ({ ...prev, modules_access: [...allModuleKeys] }));
  };

  const handleRevokeAllModules = () => {
    setFormData(prev => ({ ...prev, modules_access: [] }));
  };

  const moduleDisplayNames = moduleCategories.reduce((acc, c) => {
    c.modules.forEach(m => { acc[m.key] = m.label; });
    return acc;
  }, {});

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/users');
      setTeamMembers(res.data || []);
    } catch (error) {
      console.error('Failed to fetch team members', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleModuleToggle = (moduleName) => {
    const currentModules = formData.modules_access || [];
    if (currentModules.includes(moduleName)) {
      setFormData({ ...formData, modules_access: currentModules.filter(m => m !== moduleName) });
    } else {
      setFormData({ ...formData, modules_access: [...currentModules, moduleName] });
    }
  };

  const handleSelectAllCategory = (category) => {
    const catKeys = category.modules.map(m => m.key);
    const currentModules = formData.modules_access || [];
    const allSelected = catKeys.every(k => currentModules.includes(k));
    
    if (allSelected) {
      // Remove this category's keys
      setFormData({
        ...formData,
        modules_access: currentModules.filter(k => !catKeys.includes(k))
      });
    } else {
      // Add all missing keys from this category
      const merged = Array.from(new Set([...currentModules, ...catKeys]));
      setFormData({
        ...formData,
        modules_access: merged
      });
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
    setShowPassword(false);
    setFormData({
      name: '',
      username: '',
      email: '',
      password: '',
      role: 'Sales',
      whatsapp_number: '',
      commission_percentage: 0,
      monthly_goal: 0,
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
      role: member.role || 'Sales',
      whatsapp_number: member.whatsapp_number || '',
      commission_percentage: member.commission_percentage || 0,
      monthly_goal: member.monthly_goal !== undefined && member.monthly_goal !== null ? member.monthly_goal : 0,
      modules_access: member.modules_access || []
    });
    setEditingUserId(member.id);
    setShowPassword(false);
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

  const handleImpersonate = (e, member) => {
    if (e) e.stopPropagation();
    const currentUserStr = localStorage.getItem('user');
    const currentUser = JSON.parse(currentUserStr || '{}');

    if (currentUser.id === member.id) {
      alert("You are currently logged in as this user.");
      return;
    }

    if (window.confirm(`Switch view and simulate portal access as ${member.name} (${member.role})?`)) {
      if (!localStorage.getItem('originalAdminUser')) {
        localStorage.setItem('originalAdminUser', currentUserStr);
      }
      
      localStorage.setItem('user', JSON.stringify(member));
      
      let destination = '/dashboard';
      if (member.role === 'Client') {
        destination = '/client-portal';
      } else if (member.role === 'Sales' || member.role === 'Sales Rep') {
        destination = '/sales';
      } else if (member.role === 'Production') {
        destination = '/production';
      } else if (member.role === 'Product Manager' || member.role === 'PM') {
        destination = '/pm-portal';
      } else {
        destination = '/dashboard';
      }
      
      window.location.href = destination;
    }
  };

  const getInitials = (name) => {
    if (!name) return 'TM';
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

  const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return 'PKR ' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
      doc.text("Adwise Sales - Team Directory", 14, 18);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} | Total Members: ${filteredMembers.length}`, 14, 25);
      
      const tableColumn = ["Member Name", "Email", "Role", "WhatsApp", "Monthly Goal", "Commission %", "Joined"];
      const tableRows = filteredMembers.map(m => [
        m.name,
        m.email,
        m.role,
        m.whatsapp_number || '-',
        formatCurrency(m.monthly_goal),
        m.commission_percentage ? `${Number(m.commission_percentage).toFixed(1)}%` : '0%',
        m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : '-'
      ]);
      
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      doc.save(`team_roster_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (error) {
      console.error("PDF Export error:", error);
      alert("Failed to export PDF: " + error.message);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredMembers.map(m => ({
      "Name": m.name,
      "Username": m.username || '-',
      "Email": m.email,
      "Role": m.role,
      "WhatsApp": m.whatsapp_number || '-',
      "Monthly Goal (PKR)": Number(m.monthly_goal) || 0,
      "Commission (%)": Number(m.commission_percentage) || 0,
      "Joined Date": m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Team Members");
    XLSX.writeFile(workbook, `team_roster_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setRoleFilter('All Roles');
    setCurrentPage(1);
  };

  const isFilterActive = searchTerm !== '' || roleFilter !== 'All Roles';

  const filteredMembers = useMemo(() => {
    return teamMembers.filter(member => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term || 
        (member.name && member.name.toLowerCase().includes(term)) || 
        (member.email && member.email.toLowerCase().includes(term)) ||
        (member.username && member.username.toLowerCase().includes(term)) ||
        (member.whatsapp_number && member.whatsapp_number.toLowerCase().includes(term));
      
      const matchesRole = roleFilter === 'All Roles' || member.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });
  }, [teamMembers, searchTerm, roleFilter]);

  const currentMembers = useMemo(() => {
    return filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredMembers, currentPage, itemsPerPage]);

  const renderRoleBadge = (role) => {
    const r = (role || '').toLowerCase();
    let badgeClass = 'default';
    if (r.includes('admin')) badgeClass = 'admin';
    else if (r.includes('sales')) badgeClass = 'sales';
    else if (r.includes('product') || r.includes('pm')) badgeClass = 'pm';
    else if (r.includes('production')) badgeClass = 'production';

    return (
      <span className={`team-role-pill ${badgeClass}`}>
        <ShieldCheck size={12} />
        {role}
      </span>
    );
  };

  return (
    <div className="team-management-container modern-ui">
      {/* 1. Header with Title and Shifted Right-Aligned Action Buttons */}
      <div className="team-page-header">
        <div className="team-header-title-area">
          <div className="team-badge-row">
            <h1 className="team-main-heading">Team Management</h1>
            <span className="team-count-badge">
              {filteredMembers.length} {filteredMembers.length === 1 ? 'Member' : 'Members'}
            </span>
            {isFilterActive && (
              <span className="team-filter-pill">Filtered Results</span>
            )}
          </div>
          <p className="team-subheading">
            Manage organization members, portal roles, compensation goals, and granular module permissions
          </p>
        </div>

        <div className="team-header-actions">
          <button 
            type="button" 
            className="action-btn secondary-btn" 
            onClick={fetchTeamMembers}
            title="Refresh team members"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button 
            type="button" 
            className="action-btn export-pdf-btn" 
            onClick={handleExportPDF}
            title="Export PDF Report"
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

          <button 
            type="button" 
            className="action-btn primary-add-btn" 
            onClick={() => { closeModal(); setIsModalOpen(true); }}
          >
            <Plus size={16} />
            <span>Add Team Member</span>
          </button>
        </div>
      </div>

      {/* 2. Control Toolbar: Search, Role Filter, View Switcher */}
      <div className="team-control-card">
        <div className="team-filter-bar">
          {/* Search Box */}
          <div className="team-search-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by name, email, username, phone..." 
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

          {/* Controls Right */}
          <div className="team-filter-actions">
            {/* Role Filter */}
            <div className="select-wrapper">
              <select 
                className="team-filter-select"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All Roles">All Roles</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            {/* 1-Click Reset */}
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

            {/* Dual View Mode Switcher */}
            <div className="view-mode-toggle" title="Switch View Mode">
              <button 
                type="button" 
                className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Cards Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                type="button" 
                className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table List View"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Content View */}
        {loading ? (
          <div className="team-loading-state">
            <RefreshCw size={24} className="spin" style={{ color: '#e11d48' }} />
            <span>Loading team roster...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="team-empty-state">
            <User size={44} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
            <h3>No team members found</h3>
            <p>Try adjusting your search query or role filter.</p>
            {isFilterActive && (
              <button type="button" className="btn-secondary" onClick={handleResetFilters} style={{ marginTop: '0.75rem' }}>
                Clear Filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* A. Card Grid View */
          <div className="team-cards-grid">
            {currentMembers.map(member => {
              const cleanPhone = cleanPhoneForWhatsApp(member.whatsapp_number);
              const goalNum = Number(member.monthly_goal) || 0;
              const commPct = Number(member.commission_percentage) || 0;
              const grantedCount = member.modules_access?.length || 0;

              return (
                <div 
                  key={member.id} 
                  className="team-profile-card"
                  onClick={() => handleImpersonate(null, member)}
                  title={`Click to simulate portal view as ${member.name} (${member.role})`}
                >
                  {/* Card Top Row: Avatar, Identity, and Actions */}
                  <div className="card-top-row">
                    <div className="member-avatar-block">
                      <div 
                        className="member-avatar-circle" 
                        style={{ backgroundColor: getAvatarBg(member.name) }}
                      >
                        {getInitials(member.name)}
                      </div>
                      <div className="member-id-info">
                        <h3 className="member-fullname">{member.name}</h3>
                        {member.username && (
                          <span className="member-username">@{member.username}</span>
                        )}
                        <div className="member-role-row">
                          {renderRoleBadge(member.role)}
                        </div>
                      </div>
                    </div>

                    <div className="card-quick-actions" onClick={e => e.stopPropagation()}>
                      <button 
                        type="button" 
                        className="icon-action-btn impersonate"
                        onClick={(e) => handleImpersonate(e, member)}
                        title={`Simulate ${member.role} View`}
                      >
                        <LogIn size={15} />
                      </button>
                      <button 
                        type="button" 
                        className="icon-action-btn edit" 
                        onClick={(e) => handleEdit(e, member)} 
                        title="Edit Member"
                      >
                        <Edit size={15} />
                      </button>
                      <button 
                        type="button" 
                        className="icon-action-btn delete" 
                        onClick={(e) => handleDelete(e, member.id)} 
                        title="Delete Member"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Contact Methods */}
                  <div className="member-contact-block" onClick={e => e.stopPropagation()}>
                    <div className="contact-entry">
                      <Mail size={14} className="contact-icon" />
                      <a href={`mailto:${member.email}`} className="contact-link email" title="Send email">
                        {member.email}
                      </a>
                    </div>
                    {member.whatsapp_number ? (
                      <div className="contact-entry">
                        <Phone size={14} className="contact-icon" />
                        <a 
                          href={`https://wa.me/${cleanPhone}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="contact-link whatsapp"
                          title="Chat on WhatsApp"
                        >
                          {member.whatsapp_number}
                        </a>
                      </div>
                    ) : (
                      <div className="contact-entry empty">
                        <Phone size={14} className="contact-icon" />
                        <span>No phone configured</span>
                      </div>
                    )}
                  </div>

                  {/* Targets & Compensation Bar */}
                  <div className="member-targets-strip">
                    <div className="target-item">
                      <span className="target-lbl">Monthly Target</span>
                      <strong className="target-val">{goalNum > 0 ? formatCurrency(goalNum) : 'None'}</strong>
                    </div>
                    <div className="target-divider"></div>
                    <div className="target-item">
                      <span className="target-lbl">Commission</span>
                      <strong className="target-val highlight">{commPct > 0 ? `${commPct.toFixed(1)}%` : '0%'}</strong>
                    </div>
                  </div>

                  {/* Module Access Tags */}
                  <div className="member-modules-area">
                    <div className="modules-header-line">
                      <span className="modules-header-lbl">Access Privileges</span>
                      <span className="modules-count-pill">{grantedCount} modules</span>
                    </div>
                    <div className="modules-tags-wrap">
                      {grantedCount > 0 ? (
                        <>
                          {member.modules_access.slice(0, 4).map(mod => (
                            <span key={mod} className="access-chip">
                              {moduleDisplayNames[mod] || mod}
                            </span>
                          ))}
                          {grantedCount > 4 && (
                            <span className="access-chip more">
                              +{grantedCount - 4} more
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="no-access-lbl">Default role access</span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="card-footer-strip">
                    <span className="joined-meta">
                      <Calendar size={13} /> Joined {member.created_at ? new Date(member.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </span>
                    <span className="impersonate-hint">Click card to test view →</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* B. High-Density Table View */
          <div className="team-table-wrapper">
            <table className="team-data-table">
              <thead>
                <tr>
                  <th style={{ width: '260px' }}>TEAM MEMBER</th>
                  <th style={{ width: '150px' }}>ROLE</th>
                  <th style={{ width: '220px' }}>COMMUNICATION</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>MONTHLY GOAL</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>COMMISSION</th>
                  <th style={{ width: '180px' }}>MODULE PERMISSIONS</th>
                  <th style={{ width: '120px' }}>JOINED</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {currentMembers.map(member => {
                  const cleanPhone = cleanPhoneForWhatsApp(member.whatsapp_number);
                  const goalNum = Number(member.monthly_goal) || 0;
                  const commPct = Number(member.commission_percentage) || 0;
                  const grantedCount = member.modules_access?.length || 0;

                  return (
                    <tr key={member.id} className="team-table-row">
                      {/* Identity */}
                      <td>
                        <div className="table-member-identity">
                          <div 
                            className="member-avatar-circle small" 
                            style={{ backgroundColor: getAvatarBg(member.name) }}
                          >
                            {getInitials(member.name)}
                          </div>
                          <div className="table-name-block">
                            <span className="table-member-name">{member.name}</span>
                            <span className="table-username">@{member.username || 'user'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td>
                        {renderRoleBadge(member.role)}
                      </td>

                      {/* Communication */}
                      <td>
                        <div className="table-comm-block">
                          <a href={`mailto:${member.email}`} className="table-comm-link email" title="Send Email">
                            <Mail size={13} />
                            <span>{member.email}</span>
                          </a>
                          {member.whatsapp_number ? (
                            <a 
                              href={`https://wa.me/${cleanPhone}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="table-comm-link whatsapp"
                              title="Chat on WhatsApp"
                            >
                              <Phone size={13} />
                              <span>{member.whatsapp_number}</span>
                            </a>
                          ) : (
                            <span className="table-comm-empty">No WhatsApp</span>
                          )}
                        </div>
                      </td>

                      {/* Monthly Goal */}
                      <td style={{ textAlign: 'right' }}>
                        <span className="table-finance-val">
                          {goalNum > 0 ? formatCurrency(goalNum) : '-'}
                        </span>
                      </td>

                      {/* Commission % */}
                      <td style={{ textAlign: 'center' }}>
                        {commPct > 0 ? (
                          <span className="table-comm-pill">
                            {commPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="table-comm-zero">0%</span>
                        )}
                      </td>

                      {/* Module Permissions */}
                      <td>
                        <div className="table-permissions-pill">
                          <ShieldCheck size={13} style={{ color: '#4f46e5' }} />
                          <span>{grantedCount} active module(s)</span>
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td>
                        <span className="table-joined-date">
                          {member.created_at ? new Date(member.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="table-action-btns">
                          <button 
                            type="button" 
                            className="icon-action-btn impersonate"
                            onClick={() => handleImpersonate(null, member)}
                            title={`Simulate ${member.role} View`}
                          >
                            <LogIn size={15} />
                          </button>
                          <button 
                            type="button" 
                            className="icon-action-btn edit" 
                            onClick={(e) => handleEdit(e, member)} 
                            title="Edit"
                          >
                            <Edit size={15} />
                          </button>
                          <button 
                            type="button" 
                            className="icon-action-btn delete" 
                            onClick={(e) => handleDelete(e, member.id)} 
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredMembers.length > 0 && (
          <div className="team-pagination-wrapper">
            <Pagination 
              currentPage={currentPage}
              totalItems={filteredMembers.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 4. Enterprise Add / Edit Member Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content team-modal-content" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header-custom">
              <div className="modal-header-title">
                <div className="modal-icon-badge">
                  <User size={20} />
                </div>
                <div>
                  <h2>{editingUserId ? 'Edit Team Member' : 'Add New Team Member'}</h2>
                  <p>Configure credentials, compensation structure, and granular role permissions</p>
                </div>
              </div>
              <button type="button" className="close-modal-btn" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="team-modal-form">
              {/* Section 1: Member Identity */}
              <div className="form-section-card">
                <h3 className="section-title">
                  <User size={16} /> 1. Member Profile & System Role
                </h3>
                
                <div className="form-grid-2">
                  <div className="form-group-custom">
                    <label>Full Name <span className="req">*</span></label>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      placeholder="e.g. John Doe"
                      required 
                    />
                  </div>

                  <div className="form-group-custom">
                    <label>Username <span className="req">*</span></label>
                    <input 
                      type="text" 
                      name="username" 
                      value={formData.username} 
                      onChange={handleInputChange} 
                      placeholder="e.g. jdoe"
                      required 
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group-custom">
                    <label>Role Assignment <span className="req">*</span></label>
                    <select 
                      name="role" 
                      value={formData.role} 
                      onChange={handleInputChange} 
                      required
                    >
                      {availableRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
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
              </div>

              {/* Section 2: Account Security */}
              <div className="form-section-card">
                <h3 className="section-title">
                  <Shield size={16} /> 2. Account & Login Security
                </h3>

                <div className="form-grid-2">
                  <div className="form-group-custom">
                    <label>Email Address <span className="req">*</span></label>
                    <input 
                      type="email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleInputChange} 
                      placeholder="member@adwiselabs.com"
                      required 
                    />
                  </div>

                  <div className="form-group-custom">
                    <label>
                      {editingUserId ? 'Password (Leave blank to keep current)' : 'Account Password'} 
                      {!editingUserId && <span className="req">*</span>}
                    </label>
                    <div className="password-input-wrap">
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        name="password" 
                        value={formData.password} 
                        onChange={handleInputChange} 
                        placeholder={editingUserId ? '••••••••' : 'Enter temporary account password'}
                        required={!editingUserId} 
                      />
                      <button 
                        type="button" 
                        className="password-toggle-btn" 
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Targets & Compensation */}
              <div className="form-section-card">
                <h3 className="section-title">
                  <Target size={16} /> 3. Performance Targets & Compensation
                </h3>

                <div className="form-grid-2">
                  <div className="form-group-custom">
                    <label>Monthly Sales Goal (PKR)</label>
                    <input 
                      type="number" 
                      name="monthly_goal" 
                      value={formData.monthly_goal} 
                      onChange={handleInputChange} 
                      min="0" 
                      step="1000"
                      placeholder="e.g. 1000000"
                    />
                    <span className="field-hint">Used for quota tracking and commission milestones</span>
                  </div>

                  <div className="form-group-custom">
                    <label>Commission Rate (%)</label>
                    <input 
                      type="number" 
                      name="commission_percentage" 
                      value={formData.commission_percentage} 
                      onChange={handleInputChange} 
                      min="0" 
                      max="100" 
                      step="0.01"
                      placeholder="e.g. 5.0"
                    />
                    <span className="field-hint">Percentage automatically calculated on closed deal invoices</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Module Access & Permissions */}
              <div className="form-section-card">
                <div className="section-header-row">
                  <h3 className="section-title">
                    <ShieldCheck size={16} /> 4. Granular Module Permissions
                  </h3>
                  <div className="permission-bulk-actions">
                    <button 
                      type="button" 
                      className="bulk-perm-btn select-all"
                      onClick={handleGrantAllModules}
                    >
                      Grant All ({allModuleKeys.length})
                    </button>
                    <button 
                      type="button" 
                      className="bulk-perm-btn clear-all"
                      onClick={handleRevokeAllModules}
                    >
                      Clear All
                    </button>
                    <span className="selected-total-badge">
                      {formData.modules_access?.length || 0} / {allModuleKeys.length} Modules Granted
                    </span>
                  </div>
                </div>

                <div className="module-categories-container">
                  {moduleCategories.map(cat => {
                    const catKeys = cat.modules.map(m => m.key);
                    const selectedInCat = cat.modules.filter(m => (formData.modules_access || []).includes(m.key)).length;
                    const isAllSelected = catKeys.length > 0 && selectedInCat === catKeys.length;

                    return (
                      <div key={cat.name} className="permission-category-block">
                        <div className="permission-category-header">
                          <div className="cat-title-group">
                            <span className="cat-name">{cat.name}</span>
                            <span className="cat-count">({selectedInCat}/{cat.modules.length})</span>
                          </div>
                          <button 
                            type="button" 
                            className="cat-toggle-btn"
                            onClick={() => handleSelectAllCategory(cat)}
                          >
                            {isAllSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        <div className="permission-checkboxes-grid">
                          {cat.modules.map(mod => {
                            const isChecked = (formData.modules_access || []).includes(mod.key);
                            return (
                              <label key={mod.key} className={`permission-chip-label ${isChecked ? 'active' : ''}`}>
                                <input 
                                  type="checkbox" 
                                  checked={isChecked}
                                  onChange={() => handleModuleToggle(mod.key)}
                                />
                                <span className="chip-text">{mod.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer-custom">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editingUserId ? 'Save Employee Changes' : 'Create Team Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
