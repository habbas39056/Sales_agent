import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Plus, Search, Filter, Calendar, AlertCircle, Clock, CheckCircle2, 
  Trash2, Edit3, DollarSign, Download, ArrowUpRight, ShieldAlert,
  Building, CreditCard, RefreshCw, FileText, Send, AlertTriangle, Eye, Briefcase
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Pagination from '../components/Pagination';
import './FuturePayablesView.css';

export default function FuturePayablesView({ banks = [], categories = [], onManageCategories, onManageBanks }) {
  const [payables, setPayables] = useState([]);
  const [summary, setSummary] = useState({
    total_pending_amount: 0,
    due_today_count: 0,
    due_today_amount: 0,
    due_7days_count: 0,
    due_7days_amount: 0,
    overdue_count: 0,
    overdue_amount: 0,
    paid_this_month_amount: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Extract clean managed expense categories directly from database
  const categoryList = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    return categories.map(c => typeof c === 'string' ? c : c.name).filter(Boolean);
  }, [categories]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activePayable, setActivePayable] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    id: null,
    title: '',
    category: 'Software & SaaS Licenses',
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    priority: 'Medium',
    preferred_bank: '',
    reference_no: '',
    recurring_cycle: 'One-Time',
    notes: '',
    status: 'Pending'
  });

  // Form State for Mark as Paid Modal
  const [payFormData, setPayFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'Bank Transfer',
    bank: '',
    reference_no: '',
    notes: ''
  });

  // Current logged in user
  const currentUserStr = localStorage.getItem('user');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

  useEffect(() => {
    fetchPayables();
  }, [statusFilter, priorityFilter, categoryFilter, startDate, endDate]);

  const fetchPayables = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await axios.get(`/api/future-payables?${params.toString()}`);
      setPayables(res.data.data || []);
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Error fetching future payables:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Payables
  const filteredPayables = useMemo(() => {
    if (!searchTerm.trim()) return payables;
    const term = searchTerm.toLowerCase();
    return payables.filter(p => 
      (p.title && p.title.toLowerCase().includes(term)) ||
      (p.notes && p.notes.toLowerCase().includes(term)) ||
      (p.reference_no && p.reference_no.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term)) ||
      (p.preferred_bank && p.preferred_bank.toLowerCase().includes(term))
    );
  }, [payables, searchTerm]);

  // Paginated Payables
  const paginatedPayables = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPayables.slice(start, start + itemsPerPage);
  }, [filteredPayables, currentPage, itemsPerPage]);

  const fmt = (val) => {
    const n = Number(val || 0);
    return `PKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleOpenCreateModal = (payableToEdit = null) => {
    if (payableToEdit) {
      setFormData({
        id: payableToEdit.id,
        title: payableToEdit.title || '',
        category: payableToEdit.category || (categoryList.length > 0 ? categoryList[0] : ''),
        amount: payableToEdit.amount || '',
        due_date: payableToEdit.due_date ? String(payableToEdit.due_date).split('T')[0] : '',
        priority: payableToEdit.priority || 'Medium',
        preferred_bank: payableToEdit.preferred_bank || '',
        reference_no: payableToEdit.reference_no || '',
        recurring_cycle: payableToEdit.recurring_cycle || 'One-Time',
        notes: payableToEdit.notes || '',
        status: payableToEdit.status || 'Pending'
      });
    } else {
      setFormData({
        id: null,
        title: '',
        category: categoryList.length > 0 ? categoryList[0] : '',
        amount: '',
        due_date: new Date().toISOString().split('T')[0],
        priority: 'Medium',
        preferred_bank: banks.length > 0 ? banks[0].name : '',
        reference_no: '',
        recurring_cycle: 'One-Time',
        notes: '',
        status: 'Pending'
      });
    }
    setIsCreateModalOpen(true);
  };

  const handleSavePayable = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.amount || !formData.due_date) {
      alert('Please fill out the Title, Amount, and Due Date.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (formData.id) {
        await axios.put(`/api/future-payables/${formData.id}`, formData);
      } else {
        await axios.post('/api/future-payables', {
          ...formData,
          created_by: currentUser?.id
        });
      }
      setIsCreateModalOpen(false);
      fetchPayables();
    } catch (err) {
      console.error('Error saving payable:', err);
      alert(err.response?.data?.error || 'Failed to save future payable.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayable = async (id) => {
    if (!window.confirm('Are you sure you want to delete this scheduled payable obligation?')) return;
    try {
      await axios.delete(`/api/future-payables/${id}`);
      fetchPayables();
    } catch (err) {
      console.error('Error deleting payable:', err);
      alert('Failed to delete payable.');
    }
  };

  const handleOpenPayModal = (payable) => {
    setActivePayable(payable);
    setPayFormData({
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'Bank Transfer',
      bank: payable.preferred_bank || (banks.length > 0 ? banks[0].name : 'Cash in Hand'),
      reference_no: payable.reference_no || `FP-SETTLE-#${payable.id}`,
      notes: `Settlement for scheduled payable: ${payable.title}`
    });
    setIsPayModalOpen(true);
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!activePayable) return;

    setIsSubmitting(true);
    try {
      await axios.post(`/api/future-payables/${activePayable.id}/pay`, payFormData);
      setIsPayModalOpen(false);
      setActivePayable(null);
      fetchPayables();
      alert(`Success! "${activePayable.title}" marked as Paid and recorded as a verified cash outflow expense voucher.`);
    } catch (err) {
      console.error('Error settling payable:', err);
      alert(err.response?.data?.error || 'Failed to settle payable.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = filteredPayables.map((p, idx) => ({
      'Sr #': idx + 1,
      'Payable Title': p.title,
      'Category': p.category,
      'Amount (PKR)': parseFloat(p.amount || 0),
      'Due Date': p.due_date ? String(p.due_date).split('T')[0] : 'N/A',
      'Priority': p.priority,
      'Status': p.status,
      'Preferred Bank / Mode': p.preferred_bank || 'N/A',
      'Recurring Cycle': p.recurring_cycle,
      'Reference No': p.reference_no || 'N/A',
      'Expense Voucher ID': p.expense_id ? `#${p.expense_id}` : 'Pending',
      'Notes': p.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Future Payables');
    XLSX.writeFile(wb, `Future_Payables_Schedule_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text('Future Payables & Scheduled Obligations Schedule', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated On: ${new Date().toLocaleString()} | Total Pending: PKR ${summary.total_pending_amount.toLocaleString()}`, 14, 22);

    const tableData = filteredPayables.map((p, idx) => [
      idx + 1,
      p.title,
      p.category,
      `PKR ${Number(p.amount).toLocaleString()}`,
      p.due_date ? String(p.due_date).split('T')[0] : 'N/A',
      p.priority,
      p.status,
      p.recurring_cycle,
      p.preferred_bank || 'N/A'
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['#', 'Title / Vendor', 'Category', 'Amount (PKR)', 'Due Date', 'Priority', 'Status', 'Cycle', 'Bank']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 }
    });

    doc.save(`Future_Payables_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getDueBadge = (dueDateStr, status) => {
    if (status === 'Paid') {
      return <span className="fp-due-badge paid"><CheckCircle2 size={12} /> Settled & Paid</span>;
    }
    if (status === 'Cancelled') {
      return <span className="fp-due-badge cancelled">Cancelled</span>;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="fp-due-badge overdue">
          <AlertCircle size={12} /> Overdue by {Math.abs(diffDays)} {Math.abs(diffDays) === 1 ? 'day' : 'days'}
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="fp-due-badge today">
          <AlertTriangle size={12} /> DUE TODAY
        </span>
      );
    } else if (diffDays <= 7) {
      return (
        <span className="fp-due-badge upcoming-urgent">
          <Clock size={12} /> Due in {diffDays} {diffDays === 1 ? 'day' : 'days'}
        </span>
      );
    } else {
      return (
        <span className="fp-due-badge upcoming">
          <Calendar size={12} /> Due in {diffDays} days
        </span>
      );
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'Urgent':
        return <span className="fp-priority-tag urgent">URGENT</span>;
      case 'High':
        return <span className="fp-priority-tag high">HIGH</span>;
      case 'Low':
        return <span className="fp-priority-tag low">LOW</span>;
      default:
        return <span className="fp-priority-tag medium">MEDIUM</span>;
    }
  };

  return (
    <div className="future-payables-container">
      {/* 1. Macro Summary KPI Cards */}
      <div className="fp-kpi-grid">
        <div className="fp-kpi-card total">
          <div className="fp-kpi-header">
            <span className="fp-kpi-title">Total Future Commitments</span>
            <div className="fp-kpi-icon blue"><Clock size={20} /></div>
          </div>
          <h2 className="fp-kpi-value">{fmt(summary.total_pending_amount)}</h2>
          <span className="fp-kpi-meta">All outstanding unbilled obligations</span>
        </div>

        <div className={`fp-kpi-card ${summary.due_today_count > 0 ? 'alert-pulse' : 'today'}`}>
          <div className="fp-kpi-header">
            <span className="fp-kpi-title">Due Today</span>
            <div className="fp-kpi-icon orange"><AlertTriangle size={20} /></div>
          </div>
          <h2 className="fp-kpi-value">{fmt(summary.due_today_amount)}</h2>
          <span className="fp-kpi-meta font-bold">
            {summary.due_today_count} {summary.due_today_count === 1 ? 'payable requires' : 'payables require'} immediate settlement
          </span>
        </div>

        <div className={`fp-kpi-card ${summary.overdue_count > 0 ? 'alert-danger' : 'overdue'}`}>
          <div className="fp-kpi-header">
            <span className="fp-kpi-title">Overdue Payables</span>
            <div className="fp-kpi-icon red"><ShieldAlert size={20} /></div>
          </div>
          <h2 className="fp-kpi-value text-red">{fmt(summary.overdue_amount)}</h2>
          <span className="fp-kpi-meta text-red font-bold">
            {summary.overdue_count} past due date
          </span>
        </div>

        <div className="fp-kpi-card paid">
          <div className="fp-kpi-header">
            <span className="fp-kpi-title">Settled This Month</span>
            <div className="fp-kpi-icon green"><CheckCircle2 size={20} /></div>
          </div>
          <h2 className="fp-kpi-value text-green">{fmt(summary.paid_this_month_amount)}</h2>
          <span className="fp-kpi-meta">Converted to verified expense vouchers</span>
        </div>
      </div>

      {/* 2. Top Action & Filter Bar */}
      <div className="fp-action-bar-card">
        <div className="fp-search-filter-wrap">
          <div className="fp-search-box">
            <Search size={18} className="fp-search-icon" />
            <input 
              type="text" 
              placeholder="Search payables by title, vendor, reference, notes..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button className="fp-clear-search" onClick={() => setSearchTerm('')}>×</button>
            )}
          </div>

          <div className="fp-filter-group">
            <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="fp-select"
            >
              <option value="all">All Statuses</option>
              <option value="Due Today">Due Today</option>
              <option value="Overdue">Overdue</option>
              <option value="Pending">Pending (Upcoming)</option>
              <option value="Paid">Settled & Paid</option>
            </select>

            <select 
              value={priorityFilter} 
              onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
              className="fp-select"
            >
              <option value="all">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select 
              value={categoryFilter} 
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="fp-select"
            >
              <option value="all">All Categories</option>
              {categoryList.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="fp-action-buttons">
          {onManageCategories && (
            <button className="fp-btn-export" onClick={onManageCategories} title="Manage Expense Categories">
              <Briefcase size={16} /> Manage Expense
            </button>
          )}
          {onManageBanks && (
            <button className="fp-btn-export" onClick={onManageBanks} title="Manage Banks">
              <Building size={16} /> Manage Banks
            </button>
          )}
          <button className="fp-btn-export" onClick={handleExportExcel} title="Export Excel">
            <Download size={16} /> Excel
          </button>
          <button className="fp-btn-export" onClick={handleExportPDF} title="Export PDF">
            <Download size={16} /> PDF
          </button>
          <button className="fp-btn-create" onClick={() => handleOpenCreateModal()}>
            <Plus size={18} /> Schedule Future Payable
          </button>
        </div>
      </div>

      {/* 3. Interactive Payables Ledger Table */}
      <div className="fp-table-card">
        <div className="fp-table-header-title">
          <div>
            <h3>Scheduled Payables Ledger</h3>
            <span className="fp-table-sub">Showing {filteredPayables.length} upcoming & settled financial obligations</span>
          </div>
          {summary.due_today_count > 0 && (
            <div className="fp-urgent-badge-pill">
              <AlertTriangle size={14} /> {summary.due_today_count} DUE TODAY
            </div>
          )}
        </div>

        <div className="fp-table-responsive">
          <table className="fp-table">
            <thead>
              <tr>
                <th className="col-vendor">Payable / Vendor</th>
                <th className="col-due">Due Date & Countdown</th>
                <th className="col-cat">Category</th>
                <th className="col-priority">Priority</th>
                <th className="col-amount">Amount (PKR)</th>
                <th className="col-bank">Preferred Bank</th>
                <th className="col-recurring">Recurring</th>
                <th className="col-status">Status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="fp-empty-cell">
                    <RefreshCw size={24} className="fp-spinner" />
                    <span>Loading scheduled payables...</span>
                  </td>
                </tr>
              ) : paginatedPayables.length === 0 ? (
                <tr>
                  <td colSpan="9" className="fp-empty-cell">
                    <Calendar size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                    <p>No future payables found matching your search or filters.</p>
                    <button className="fp-btn-create-inline" onClick={() => handleOpenCreateModal()}>
                      <Plus size={16} /> Create New Payable
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedPayables.map((p) => {
                  const dueDateStr = p.due_date ? String(p.due_date).split('T')[0] : 'N/A';
                  const isPaid = p.status === 'Paid';

                  return (
                    <tr key={p.id} className={p.status === 'Due Today' ? 'row-due-today' : (p.status === 'Overdue' ? 'row-overdue' : '')}>
                      <td>
                        <div className="fp-payable-title-cell">
                          <span className="fp-title-text">{p.title}</span>
                          <div className="fp-title-meta-row">
                            {p.reference_no && (
                              <span className="fp-ref-code">Ref: {p.reference_no}</span>
                            )}
                            {p.notes && (
                              <span className="fp-memo-text" title={p.notes}>
                                {p.notes.length > 50 ? p.notes.slice(0, 50) + '...' : p.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="fp-due-cell">
                          <div className="fp-due-date-row">
                            <Calendar size={13} style={{ color: '#64748b' }} />
                            <span>{dueDateStr}</span>
                          </div>
                          {getDueBadge(dueDateStr, p.status)}
                        </div>
                      </td>

                      <td>
                        <span className="fp-category-tag">{p.category || 'General'}</span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {getPriorityBadge(p.priority)}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="fp-amount-cell">
                          <span>{fmt(p.amount)}</span>
                        </div>
                      </td>

                      <td>
                        <div className="fp-bank-cell">
                          <Building size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span>{p.preferred_bank || 'Any / Cash'}</span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className={`fp-recurring-badge ${p.recurring_cycle !== 'One-Time' ? 'active' : ''}`}>
                          {p.recurring_cycle !== 'One-Time' && <RefreshCw size={11} />}
                          {p.recurring_cycle || 'One-Time'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className={`fp-status-tag ${p.status ? p.status.toLowerCase().replace(' ', '-') : 'pending'}`}>
                          {p.status}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div className="fp-action-btns-wrap">
                          {!isPaid && (
                            <button 
                              className="fp-action-btn pay" 
                              onClick={() => handleOpenPayModal(p)}
                              title="Mark as Paid & Convert to Expense"
                            >
                              <CheckCircle2 size={16} /> Pay
                            </button>
                          )}
                          {isPaid && p.expense_id && (
                            <span className="fp-paid-voucher-tag" title={`Converted to Expense Voucher #${p.expense_id}`}>
                              Exp #{p.expense_id}
                            </span>
                          )}
                          <button 
                            className="fp-action-btn edit" 
                            onClick={() => handleOpenCreateModal(p)}
                            title="Edit Payable"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            className="fp-action-btn delete" 
                            onClick={() => handleDeletePayable(p.id)}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
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
        {filteredPayables.length > itemsPerPage && (
          <div className="fp-pagination-wrap">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredPayables.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 4. Modal: Create / Edit Future Payable */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="fp-modal-card">
            <div className="fp-modal-header">
              <div className="fp-modal-title-with-icon">
                <div className="fp-modal-icon-box blue">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3>{formData.id ? 'Edit Scheduled Payable' : 'Schedule New Future Payable'}</h3>
                  <p className="fp-modal-subtitle">Set up upcoming obligation with automated WhatsApp and dashboard alerts</p>
                </div>
              </div>
              <button className="fp-close-btn" onClick={() => setIsCreateModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSavePayable}>
              <div className="fp-modal-body">
                <div className="fp-form-grid">
                  <div className="fp-form-group col-span-2">
                    <label>Payable Title / Vendor Name <span className="req">*</span></label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g., AWS Cloud Server Hosting, Office Rent, Freelance UI Designer" 
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>

                  <div className="fp-form-group">
                    <label>Amount (PKR) <span className="req">*</span></label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      step="0.01"
                      placeholder="e.g., 25000" 
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                  </div>

                  <div className="fp-form-group">
                    <label>Due Date / Payable Date <span className="req">*</span></label>
                    <input 
                      type="date" 
                      required
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>

                  <div className="fp-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ margin: 0 }}>Expense Category</label>
                      {onManageCategories && (
                        <button 
                          type="button" 
                          onClick={onManageCategories} 
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '700', textDecoration: 'underline', padding: 0 }}
                        >
                          + Manage Expense
                        </button>
                      )}
                    </div>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="">- Select Expense (Optional) -</option>
                      {categoryList.map((c, i) => (
                        <option key={i} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fp-form-group">
                    <label>Priority / Urgency</label>
                    <select 
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">🚨 Urgent (Top Priority)</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="fp-form-group">
                    <label>Preferred Bank / Payment Account</label>
                    <select 
                      value={formData.preferred_bank}
                      onChange={(e) => setFormData({ ...formData, preferred_bank: e.target.value })}
                    >
                      <option value="">Cash in Hand / Any Bank</option>
                      {banks.map((b) => (
                        <option key={b.id} value={b.name}>{b.name} (PKR {Number(b.balance || 0).toLocaleString()})</option>
                      ))}
                    </select>
                  </div>

                  <div className="fp-form-group">
                    <label>Recurring Cycle</label>
                    <select 
                      value={formData.recurring_cycle}
                      onChange={(e) => setFormData({ ...formData, recurring_cycle: e.target.value })}
                    >
                      <option value="One-Time">One-Time Only</option>
                      <option value="Monthly">Monthly Recurring</option>
                      <option value="Quarterly">Quarterly (Every 3 Months)</option>
                      <option value="Yearly">Yearly (Annual)</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </div>

                  <div className="fp-form-group col-span-2">
                    <label>Bill / Invoice Reference #</label>
                    <input 
                      type="text" 
                      placeholder="e.g., INV-98234, BILL-AUG-2026" 
                      value={formData.reference_no}
                      onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                    />
                  </div>

                  <div className="fp-form-group col-span-2">
                    <label>Internal Notes / Payment Instructions</label>
                    <textarea 
                      rows="3"
                      placeholder="Add vendor bank account details, IBAN, contact info, or payment terms..." 
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="fp-alert-notice-box">
                  <AlertCircle size={18} className="text-blue" />
                  <span>
                    <strong>Automated Alert Rule:</strong> When this payable's due date arrives, the system will automatically send an instant alert to your <strong>WhatsApp</strong> and create an in-portal notification bell badge.
                  </span>
                </div>
              </div>

              <div className="fp-modal-footer">
                <button type="button" className="fp-btn-cancel" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fp-btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : (formData.id ? 'Update Payable' : 'Schedule Future Payable')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Quick Mark as Paid & Convert to Expense */}
      {isPayModalOpen && activePayable && (
        <div className="modal-overlay">
          <div className="fp-modal-card pay-settle">
            <div className="fp-modal-header">
              <div className="fp-modal-title-with-icon">
                <div className="fp-modal-icon-box green">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3>Settle & Pay Scheduled Obligation</h3>
                  <p className="fp-modal-subtitle">Convert "{activePayable.title}" into a verified cash outflow expense voucher</p>
                </div>
              </div>
              <button className="fp-close-btn" onClick={() => setIsPayModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleConfirmPayment}>
              <div className="fp-modal-body">
                <div className="fp-settle-summary-card">
                  <div className="fp-settle-row">
                    <span className="label">Payable Obligation:</span>
                    <strong className="val">{activePayable.title}</strong>
                  </div>
                  <div className="fp-settle-row">
                    <span className="label">Category:</span>
                    <span className="val">{activePayable.category}</span>
                  </div>
                  <div className="fp-settle-row highlight">
                    <span className="label">Settlement Amount:</span>
                    <strong className="val text-green font-bold" style={{ fontSize: '1.25rem' }}>
                      {fmt(activePayable.amount)}
                    </strong>
                  </div>
                </div>

                <div className="fp-form-grid">
                  <div className="fp-form-group">
                    <label>Settlement Date <span className="req">*</span></label>
                    <input 
                      type="date" 
                      required
                      value={payFormData.payment_date}
                      onChange={(e) => setPayFormData({ ...payFormData, payment_date: e.target.value })}
                    />
                  </div>

                  <div className="fp-form-group">
                    <label>Payment Mode <span className="req">*</span></label>
                    <select 
                      value={payFormData.payment_mode}
                      onChange={(e) => setPayFormData({ ...payFormData, payment_mode: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer / Online</option>
                      <option value="Cash">Cash in Hand</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Credit Card">Company Card</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="fp-form-group col-span-2">
                    <label>Paid From Bank / Account</label>
                    <select 
                      value={payFormData.bank}
                      onChange={(e) => setPayFormData({ ...payFormData, bank: e.target.value })}
                    >
                      <option value="">Cash in Hand (No Bank)</option>
                      {banks.map((b) => (
                        <option key={b.id} value={b.name}>{b.name} (Balance: PKR {Number(b.balance || 0).toLocaleString()})</option>
                      ))}
                    </select>
                  </div>

                  <div className="fp-form-group col-span-2">
                    <label>Transaction ID / Reference #</label>
                    <input 
                      type="text" 
                      placeholder="e.g., TXN-9812739182, Cheque #00491" 
                      value={payFormData.reference_no}
                      onChange={(e) => setPayFormData({ ...payFormData, reference_no: e.target.value })}
                    />
                  </div>

                  <div className="fp-form-group col-span-2">
                    <label>Payment Confirmation Notes</label>
                    <textarea 
                      rows="2"
                      placeholder="Optional notes or memo for the expense voucher..." 
                      value={payFormData.notes}
                      onChange={(e) => setPayFormData({ ...payFormData, notes: e.target.value })}
                    />
                  </div>
                </div>

                {activePayable.recurring_cycle && activePayable.recurring_cycle !== 'One-Time' && (
                  <div className="fp-recurring-notice">
                    <RefreshCw size={16} className="text-purple" />
                    <span>
                      This is a <strong>{activePayable.recurring_cycle}</strong> obligation. Settle this payment and the system will automatically schedule the next cycle for you.
                    </span>
                  </div>
                )}
              </div>

              <div className="fp-modal-footer">
                <button type="button" className="fp-btn-cancel" onClick={() => setIsPayModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fp-btn-submit-green" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording Payment...' : 'Confirm & Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
