import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  FolderKanban, Search, Calendar, FileText, DollarSign, Clock, 
  CheckCircle2, AlertCircle, Edit3, Check, X, FileSpreadsheet, 
  ExternalLink, Eye, Plus, Filter, ShieldAlert, ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Pagination from '../components/Pagination';
import './ProjectManagement.css';

export default function ProjectManagement() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Editing Remarks State
  const [editingRemarksId, setEditingRemarksId] = useState(null);
  const [tempRemarks, setTempRemarks] = useState('');
  const [savingRemarks, setSavingRemarks] = useState(false);

  // Invoice Preview Modal
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isPMorAdmin = user?.role === 'Admin' || user?.role === 'Product Manager' || user?.role === 'PM' || user?.role === 'Project Manager';

  // Recovery Modal State
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [targetRecoveryProject, setTargetRecoveryProject] = useState(null);
  const [salesPeople, setSalesPeople] = useState([]);
  const [recoveryForm, setRecoveryForm] = useState({
    assigned_salesperson_id: '',
    assigned_date: new Date().toISOString().slice(0, 10),
    reason: 'Manual Manager Trigger',
    remark: ''
  });

  useEffect(() => {
    fetchProjects();
    axios.get('/api/users')
      .then(res => setSalesPeople((res.data || []).filter(u => u.role !== 'Client')))
      .catch(err => console.error('Failed to fetch users:', err));
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const queryParams = user ? `?user_id=${user.id}&role=${encodeURIComponent(user.role)}` : '';
      const res = await axios.get(`/api/projects/management/overview${queryParams}`);
      setProjects(res.data || []);
    } catch (err) {
      console.error('Failed to fetch project management data:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEditRemarks = (project) => {
    setEditingRemarksId(project.id);
    setTempRemarks(project.remarks || '');
  };

  const saveRemarks = async (projectId) => {
    try {
      setSavingRemarks(true);
      await axios.patch(`/api/projects/${projectId}/remarks`, { remarks: tempRemarks });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, remarks: tempRemarks } : p));
      setEditingRemarksId(null);
    } catch (err) {
      console.error('Failed to save remarks:', err);
      alert('Failed to save remarks.');
    } finally {
      setSavingRemarks(false);
    }
  };

  const cancelEditRemarks = () => {
    setEditingRemarksId(null);
    setTempRemarks('');
  };

  const openInvoicePreview = async (invoiceId) => {
    if (!invoiceId) return;
    try {
      setLoadingInvoice(true);
      const res = await axios.get(`/api/invoices/${invoiceId}`);
      setPreviewInvoice(res.data);
    } catch (err) {
      console.error('Failed to load invoice:', err);
      alert('Could not load invoice details.');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleSendProjectToRecovery = (p) => {
    setTargetRecoveryProject(p);
    setRecoveryForm({
      assigned_salesperson_id: p.salesperson_id || (salesPeople.length > 0 ? salesPeople[0].id : ''),
      assigned_date: new Date().toISOString().slice(0, 10),
      reason: 'Manual Manager Trigger',
      remark: ''
    });
    setIsRecoveryModalOpen(true);
  };

  const submitSendProjectToRecovery = async (e) => {
    e.preventDefault();
    if (!recoveryForm.assigned_salesperson_id) {
      alert("Please select an Assigned Sales Person.");
      return;
    }
    try {
      const res = await axios.post('/api/recovery/trigger', {
        project_id: targetRecoveryProject.id,
        assigned_salesperson_id: recoveryForm.assigned_salesperson_id,
        trigger_reason: recoveryForm.reason,
        manager_remark: recoveryForm.remark,
        assigned_date: recoveryForm.assigned_date
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.data && res.data.success) {
        alert(`Project "${targetRecoveryProject.title}" successfully sent to Recovery Queue.`);
        setIsRecoveryModalOpen(false);
        setTargetRecoveryProject(null);
        fetchProjects();
      } else {
        alert((res.data && res.data.error) || 'Failed to send project to recovery');
      }
    } catch (err) {
      alert((err.response && err.response.data && err.response.data.error) || 'Error sending to recovery');
    }
  };

  // KPI calculations
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'Active' || p.status === 'In Progress' || p.status === 'Assigned' || p.status === 'Deadline Confirmed' || p.status === 'Submitted for Review' || p.status === 'Revision Required').length;
  const completedProjects = projects.filter(p => p.status === 'Completed').length;
  const totalOutstandingBalance = projects.reduce((acc, p) => acc + (parseFloat(p.balance) || 0), 0);

  // Filter & Search Logic
  const filteredProjects = projects.filter(p => {
    const matchesSearch = 
      (p.title && p.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.business_name && p.business_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.client_name && p.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.invoice_number && p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.remarks && p.remarks.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;

    let matchesDate = true;
    if (startDateFilter || endDateFilter) {
      const projDateStr = p.start_date || p.created_at;
      if (projDateStr) {
        const projDate = new Date(projDateStr);
        if (startDateFilter) {
          const start = new Date(startDateFilter);
          start.setHours(0, 0, 0, 0);
          if (projDate < start) matchesDate = false;
        }
        if (endDateFilter) {
          const end = new Date(endDateFilter);
          end.setHours(23, 59, 59, 999);
          if (projDate > end) matchesDate = false;
        }
      } else {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const currentProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return '—';
    }
  };

  const isOverdue = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(23, 59, 59, 999);
    return Date.now() > d.getTime();
  };

  const handleExportExcel = () => {
    const dataToExport = filteredProjects.map(p => ({
      'Start Date': p.start_date ? new Date(p.start_date).toLocaleDateString() : '',
      'Business Name': p.business_name || '',
      'Project Title': p.title || '',
      'Client Name': p.client_name || '',
      'Invoice #': p.invoice_number || 'N/A',
      'Invoice Balance': p.balance !== null ? `PKR ${parseFloat(p.balance).toFixed(2)}` : 'N/A',
      'Invoice Due Date': p.invoice_due_date ? new Date(p.invoice_due_date).toLocaleDateString() : '',
      'Project Due Date': p.project_due_date ? new Date(p.project_due_date).toLocaleDateString() : '',
      'Status': p.status || 'Assigned',
      'Remarks': p.remarks || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Project Management');
    XLSX.writeFile(wb, `Project_Management_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="pm-management-container">
      {/* KPI STATS ROW */}
      <div className="pm-stats-grid">
        <div className="pm-stat-card">
          <div className="pm-stat-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
            <FolderKanban size={20} />
          </div>
          <div className="pm-stat-info">
            <h4>Total Projects</h4>
            <p>{totalProjects}</p>
          </div>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={20} />
          </div>
          <div className="pm-stat-info">
            <h4>Active / In Progress</h4>
            <p>{activeProjects}</p>
          </div>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="pm-stat-info">
            <h4>Completed</h4>
            <p>{completedProjects}</p>
          </div>
        </div>

        <div className="pm-stat-card">
          <div className="pm-stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <DollarSign size={20} />
          </div>
          <div className="pm-stat-info">
            <h4>Outstanding Balance</h4>
            <p>PKR {totalOutstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* TOOLBAR CONTROLS */}
      <div className="pm-toolbar-row">
        <div className="pm-toolbar-left">
          <div className="pm-search-box">
            <Search size={16} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Search by project, business, invoice #, remarks..." 
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm('')} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={15} color="#64748b" />
            <select 
              className="pm-filter-select"
              value={statusFilter} 
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="All">All Statuses</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>

          {/* DATE RANGE FILTER */}
          <div className="pm-date-filter-group">
            <Calendar size={14} color="#64748b" />
            <span className="pm-date-filter-label">From:</span>
            <input 
              type="date"
              className="pm-date-input"
              value={startDateFilter}
              onChange={e => { setStartDateFilter(e.target.value); setCurrentPage(1); }}
              title="Filter from start date"
            />
            <span className="pm-date-filter-label" style={{ marginLeft: '4px' }}>To:</span>
            <input 
              type="date"
              className="pm-date-input"
              value={endDateFilter}
              onChange={e => { setEndDateFilter(e.target.value); setCurrentPage(1); }}
              title="Filter to end date"
            />
            {(startDateFilter || endDateFilter) && (
              <button 
                type="button" 
                className="pm-btn-clear-date"
                onClick={() => { setStartDateFilter(''); setEndDateFilter(''); setCurrentPage(1); }}
                title="Clear date filter"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="pm-toolbar-right">
          <select 
            className="pm-filter-select"
            value={itemsPerPage}
            onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            title="Rows per page"
            style={{ padding: '0.45rem 0.6rem' }}
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
          <button type="button" onClick={handleExportExcel} className="pm-btn-export">
            <FileSpreadsheet size={15} />
            Export Excel
          </button>
          <button type="button" onClick={() => navigate('/projects')} className="pm-btn-primary">
            <Plus size={15} />
            Create Project
          </button>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="pm-table-card">
        <div className="pm-table-wrapper">
          <table className="pm-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Start Date</th>
                <th style={{ minWidth: '180px' }}>Business & Project</th>
                <th style={{ width: '140px' }}>Invoice #</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Balance</th>
                <th style={{ width: '120px' }}>Invoice Due</th>
                <th style={{ width: '120px' }}>Project Due</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '180px' }}>Remarks</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentProjects.map(p => {
                const isRemarksEditing = editingRemarksId === p.id;
                const bal = p.balance !== null ? parseFloat(p.balance) : null;
                const invOverdue = p.invoice_due_date && bal > 0 && isOverdue(p.invoice_due_date);
                const projOverdue = p.project_due_date && p.status !== 'Completed' && isOverdue(p.project_due_date);

                return (
                  <tr key={p.id}>
                    {/* 1. PROJECT START DATE */}
                    <td>
                      <div className="pm-date-badge">
                        <Calendar size={13} color="#6366f1" />
                        <span>{formatDate(p.start_date)}</span>
                      </div>
                    </td>

                    {/* 2. BUSINESS NAME */}
                    <td className="pm-business-cell">
                      <strong>{p.business_name}</strong>
                      <span>{p.title} {p.client_name ? `• ${p.client_name}` : ''}</span>
                    </td>

                    {/* 3. INVOICE # (WITH LINK TO INVOICE) */}
                    <td>
                      {p.invoice_number ? (
                        <button 
                          type="button" 
                          onClick={() => openInvoicePreview(p.invoice_id)} 
                          className="pm-invoice-link"
                          title="Click to preview invoice"
                        >
                          <FileText size={12} />
                          {p.invoice_number}
                          <ExternalLink size={10} />
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.78rem' }}>No Invoice</span>
                      )}
                    </td>

                    {/* 4. BALANCE */}
                    <td style={{ textAlign: 'right' }}>
                      {bal !== null ? (
                        <span className={`pm-balance-badge ${bal > 0 ? 'unpaid' : 'paid'}`}>
                          PKR {bal.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>

                    {/* 5. INVOICE DUE DATE */}
                    <td>
                      {p.invoice_due_date ? (
                        <span className={`pm-date-badge ${invOverdue ? 'overdue' : ''}`}>
                          {invOverdue && <AlertCircle size={12} />}
                          {formatDate(p.invoice_due_date)}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>

                    {/* 6. PROJECT DUE DATE */}
                    <td>
                      {p.project_due_date ? (
                        <span className={`pm-date-badge ${projOverdue ? 'overdue' : ''}`}>
                          {projOverdue && <AlertCircle size={12} />}
                          {formatDate(p.project_due_date)}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>

                    {/* 7. STATUS (AUTO PICKED) */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`pm-status-pill ${p.status ? p.status.replace(/\s+/g, '-') : 'Assigned'}`}>
                        {p.status || 'Assigned'}
                      </span>
                    </td>

                    {/* 8. REMARKS (PM EDITABLE) */}
                    <td>
                      <div className="pm-remarks-box">
                        {isRemarksEditing ? (
                          <div className="pm-remarks-edit-form">
                            <textarea 
                              className="pm-remarks-input"
                              rows="2"
                              value={tempRemarks}
                              onChange={e => setTempRemarks(e.target.value)}
                              placeholder="Type PM remarks..."
                              autoFocus
                            />
                            <div className="pm-remarks-actions">
                              <button 
                                type="button" 
                                className="pm-btn-action-small cancel" 
                                onClick={cancelEditRemarks}
                              >
                                Cancel
                              </button>
                              <button 
                                type="button" 
                                className="pm-btn-action-small save" 
                                onClick={() => saveRemarks(p.id)}
                                disabled={savingRemarks}
                              >
                                {savingRemarks ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className={`pm-remarks-display ${!p.remarks ? 'empty' : ''}`}
                            onClick={() => isPMorAdmin && startEditRemarks(p)}
                            title={isPMorAdmin ? "Click to edit remarks" : ""}
                          >
                            <span>{p.remarks || (isPMorAdmin ? '+ Add remarks...' : 'No remarks')}</span>
                            {isPMorAdmin && <Edit3 size={11} color="#94a3b8" style={{ flexShrink: 0 }} />}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* ACTION */}
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        type="button" 
                        onClick={() => navigate(`/projects/${p.id}`)}
                        className="pm-btn-action-small"
                        style={{ background: '#f1f5f9', color: '#4f46e5', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: '700' }}
                        title="View Project Details & Steps"
                      >
                        <Eye size={12} />
                        View
                      </button>
                      {isPMorAdmin && (
                        p.recovery_case_id ? (
                          <button 
                            type="button" 
                            onClick={() => navigate(`/recovery/${p.recovery_case_id}`)}
                            className="pm-btn-action-small"
                            style={{ background: '#ecfdf5', color: '#10b981', border: '1px solid #10b981', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: '700', marginLeft: '4px' }}
                            title="In Recovery Queue - Click to View Case"
                          >
                            <ShieldCheck size={12} />
                            In Recovery
                          </button>
                        ) : (
                          <button 
                            type="button" 
                            onClick={() => handleSendProjectToRecovery(p)}
                            className="pm-btn-action-small"
                            style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: '700', marginLeft: '4px' }}
                            title="■ SEND TO RECOVERY"
                          >
                            <ShieldAlert size={12} />
                            Recovery
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}

              {currentProjects.length === 0 && !loading && (
                <tr>
                  <td colSpan="9">
                    <div className="pm-empty-state">
                      <h3>No projects found</h3>
                      <p>Try adjusting your search query or status filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div style={{ padding: '0.75rem 1rem' }}>
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredProjects.length}
            itemsPerPage={itemsPerPage}
            onPageChange={page => setCurrentPage(page)}
          />
        </div>
      </div>

      {/* INVOICE PREVIEW MODAL */}
      {previewInvoice && (
        <div className="modal-overlay" style={{ zIndex: 3000 }} onClick={() => setPreviewInvoice(null)}>
          <div className="modal-content" style={{ maxWidth: '620px', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Invoice {previewInvoice.invoice_number}</h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Client: {previewInvoice.client_name || previewInvoice.business_name}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setPreviewInvoice(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '8px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>TOTAL AMOUNT</span>
                <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>PKR {parseFloat(previewInvoice.amount || 0).toFixed(2)}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>OUTSTANDING BALANCE</span>
                <strong style={{ fontSize: '1.05rem', color: parseFloat(previewInvoice.balance) > 0 ? '#dc2626' : '#16a34a' }}>
                  PKR {parseFloat(previewInvoice.balance || 0).toFixed(2)}
                </strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>DUE DATE</span>
                <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{formatDate(previewInvoice.due_date)}</strong>
              </div>
            </div>

            {/* INVOICE ITEMS */}
            {previewInvoice.items && previewInvoice.items.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#334155' }}>Billed Line Items</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                      <th style={{ padding: '5px 8px' }}>Description</th>
                      <th style={{ padding: '5px 8px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '5px 8px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewInvoice.items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 8px' }}>{it.description || it.item_name}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>{it.quantity}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>PKR {parseFloat(it.total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setPreviewInvoice(null)}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
              >
                Close
              </button>
              <button 
                type="button" 
                className="btn-primary"
                onClick={() => {
                  setPreviewInvoice(null);
                  navigate(`/invoices`);
                }}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
              >
                Go to Invoices Module
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SEND TO RECOVERY FORM MODAL */}
      {isRecoveryModalOpen && targetRecoveryProject && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: '520px', background: '#1e293b', color: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <ShieldAlert size={20} /> Send Project to Recovery
              </h3>
              <button onClick={() => setIsRecoveryModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitSendProjectToRecovery}>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Target Project:</div>
                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>
                  {targetRecoveryProject.title} ({targetRecoveryProject.client_name || targetRecoveryProject.business_name || 'Client'})
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>Assigned Sales Person *</label>
                <select 
                  value={recoveryForm.assigned_salesperson_id} 
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, assigned_salesperson_id: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  required
                >
                  <option value="">Select Salesperson</option>
                  {salesPeople.map(sp => {
                    const displayName = sp.name || sp.full_name || sp.username || `User #${sp.id}`;
                    return (
                      <option key={sp.id} value={sp.id}>
                        {displayName} {sp.role ? `(${sp.role})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>Assigned Date (Auto)</label>
                <input 
                  type="date" 
                  value={recoveryForm.assigned_date}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, assigned_date: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>Reason / Category *</label>
                <select 
                  value={recoveryForm.reason} 
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                  required
                >
                  <option value="Manual Manager Trigger">Manual Manager Trigger</option>
                  <option value="Promise Missed">Promise Missed</option>
                  <option value="Repeated Delay">Repeated Delay</option>
                  <option value="No Response">No Response</option>
                  <option value="Dispute / Issue">Dispute / Issue</option>
                  <option value="High-Value Recovery">High-Value Recovery</option>
                  <option value="Management Escalation">Management Escalation</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>Description / Remarks</label>
                <textarea 
                  rows="3" 
                  placeholder="Enter detailed description or remarks..."
                  value={recoveryForm.remark}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, remark: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsRecoveryModalOpen(false)}
                  style={{ padding: '8px 16px', background: '#334155', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '8px 18px', background: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
                >
                  Confirm & Send to Recovery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
