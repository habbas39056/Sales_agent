import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Plus, Download, Briefcase, CreditCard, Banknote, X, Building2, FileText, AlertCircle, Search, Clock, Calendar } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Select from 'react-select';
import Pagination from '../components/Pagination';
import FuturePayablesView from './FuturePayablesView';
import './Expenses.css';
import './Modal.css';

export default function Expenses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'future-payables' ? 'future-payables' : 'ledger';
  const [payablesSummary, setPayablesSummary] = useState({ due_today_count: 0, overdue_count: 0 });

  const [expenses, setExpenses] = useState([]);
  const [clients, setClients] = useState([]);
  const [banks, setBanks] = useState([]);
  const [summary, setSummary] = useState({ cashInHand: 0, otherExpenses: 0, totalNetBalance: 0, bankTotals: {} });
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState([]);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [bankFilter, setBankFilter] = useState('All Banks');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isManageBanksModalOpen, setIsManageBanksModalOpen] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [isManageCategoriesModalOpen, setIsManageCategoriesModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    client: '',
    description: '',
    category: '',
    mode: 'Cash',
    bank: '',
    reference: '',
    type: 'payment',
    amount: ''
  });

  useEffect(() => {
    fetchExpenses();
    fetchClients();
    fetchBanks();
    fetchInvoices();
    fetchCategories();
    fetchPayablesSummary();
  }, []);

  const fetchPayablesSummary = async () => {
    try {
      const res = await axios.get('/api/future-payables');
      if (res.data && res.data.summary) {
        setPayablesSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch payables summary', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/expense-categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const fetchInvoices = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let queryParams = '';
      if (user) {
        queryParams = `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }
      const res = await axios.get(`/api/invoices${queryParams}`);
      setInvoices(res.data || []);
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await axios.get('/api/banks');
      setBanks(res.data);
    } catch (err) {
      console.error('Failed to fetch banks', err);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await axios.get('/api/clients');
      const data = Array.isArray(res.data) ? res.data : (res.data?.clients || []);
      setClients(data);
    } catch (err) {
      console.error('Failed to fetch clients', err);
      setClients([]);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await axios.get('/api/expenses');
      setExpenses(res.data.data);
      setSummary(res.data.summary);
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/expenses/${editingId}`, formData);
      } else {
        await axios.post('/api/expenses', formData);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        client: '',
        description: '',
        category: '',
        mode: 'Cash',
        bank: '',
        reference: '',
        type: 'payment',
        amount: ''
      });
      fetchExpenses();
    } catch (err) {
      console.error('Error saving expense', err);
      alert(err.response?.data?.error || 'Error saving entry');
    }
  };

  const handleEditClick = (exp) => {
    setEditingId(exp.id);
    setFormData({
      date: new Date(exp.date).toISOString().split('T')[0],
      client: exp.client || '',
      description: exp.description || '',
      category: exp.category || '',
      mode: exp.mode || 'Cash',
      bank: exp.bank || '',
      reference: exp.reference || '',
      type: exp.receipt_amount > 0 ? 'receipt' : 'payment',
      amount: exp.receipt_amount > 0 ? exp.receipt_amount : exp.payment_amount
    });
    setIsModalOpen(true);
  };

  const handleCreateBank = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/banks', { name: newBankName });
      setNewBankName('');
      fetchBanks();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating bank');
    }
  };

  const handleDeleteBank = async (id) => {
    if (window.confirm("Delete this bank?")) {
      try {
        await axios.delete(`/api/banks/${id}`);
        fetchBanks();
      } catch (err) {
        alert(err.response?.data?.error || 'Error deleting bank');
      }
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/expense-categories', { name: newCategoryName });
      setNewCategoryName('');
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm("Delete this category?")) {
      try {
        await axios.delete(`/api/expense-categories/${id}`);
        fetchCategories();
      } catch (err) {
        alert(err.response?.data?.error || 'Error deleting category');
      }
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Expense Report', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.text(`Total Receipts: PKR ${dynamicTotalReceipts.toFixed(2)}`, 14, 40);
    doc.text(`Total Expenses: PKR ${dynamicOtherExpenses.toFixed(2)}`, 14, 46);
    doc.text(`Total Net Balance: PKR ${dynamicNetBalance.toFixed(2)}`, 14, 52);

    const tableColumn = ["Date", "Client/Party", "Category", "Description", "Mode", "Bank", "Ref", "Receipt", "Payment", "Balance"];
    const tableRows = filteredExpenses.map(exp => [
      new Date(exp.date).toLocaleDateString(),
      exp.client,
      exp.category || '-',
      exp.description,
      exp.mode,
      exp.bank,
      exp.reference,
      `PKR ${Number(exp.receipt_amount).toFixed(2)}`,
      `PKR ${Number(exp.payment_amount).toFixed(2)}`,
      `PKR ${Number(exp.balance).toFixed(2)}`
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 60,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save('expense_report.pdf');
  };

  const filteredExpenses = expenses.filter(exp => {
    const term = searchTerm.trim().toLowerCase();

    const matchesSearch = !term || 
      (exp.client && exp.client.toLowerCase().includes(term)) || 
      (exp.description && exp.description.toLowerCase().includes(term)) || 
      (exp.category && exp.category.toLowerCase().includes(term)) || 
      (exp.mode && exp.mode.toLowerCase().includes(term)) || 
      (exp.bank && exp.bank.toLowerCase().includes(term)) || 
      (exp.reference && exp.reference.toLowerCase().includes(term)) || 
      (exp.receipt_amount && exp.receipt_amount.toString().includes(term)) || 
      (exp.payment_amount && exp.payment_amount.toString().includes(term)) || 
      (exp.id && exp.id.toString().includes(term));
    
    let matchesType = true;
    if (typeFilter === 'Receipts') matchesType = exp.receipt_amount > 0;
    if (typeFilter === 'Payments') matchesType = exp.payment_amount > 0;
    
    const matchesBank = bankFilter === 'All Banks' || exp.bank === bankFilter;

    // Date Range Filter
    let matchesDate = true;
    if (exp.date) {
      const expDateStr = new Date(exp.date).toISOString().slice(0, 10);
      if (fromDate && expDateStr < fromDate) matchesDate = false;
      if (toDate && expDateStr > toDate) matchesDate = false;
    }
    
    return matchesSearch && matchesType && matchesBank && matchesDate;
  });

  const filteredInvoices = invoices.filter(inv => {
    if (!inv.issue_date && !inv.created_at) return false;
    const invDateStr = new Date(inv.issue_date || inv.created_at).toISOString().slice(0, 10);
    if (fromDate && invDateStr < fromDate) return false;
    if (toDate && invDateStr > toDate) return false;
    return true;
  });

  // Calculate dynamic stats based on filtered data
  const isFiltered = Boolean(fromDate || toDate || bankFilter !== 'All Banks' || typeFilter !== 'All Types' || searchTerm.trim());

  const dynamicOtherExpenses = filteredExpenses.reduce((sum, exp) => sum + Number(exp.payment_amount || 0), 0);
  const dynamicTotalReceipts = filteredExpenses.reduce((sum, exp) => sum + Number(exp.receipt_amount || 0), 0);
  const dynamicNetBalance = isFiltered ? (dynamicTotalReceipts - dynamicOtherExpenses) : Number(summary.totalNetBalance || 0);

  const dynamicTotalInvoiced = (fromDate || toDate)
    ? filteredInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0)
    : Number(summary.totalInvoiced || 0);

  const dynamicUnpaidInvoices = (fromDate || toDate)
    ? filteredInvoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0)
    : Number(summary.totalInvoiceBalance || 0);

  const dynamicBankTotals = {};
  const dynamicCategoryTotals = {};
  if (isFiltered) {
    filteredExpenses.forEach(exp => {
      if (exp.bank && exp.bank.trim() !== '') {
        if (!dynamicBankTotals[exp.bank]) dynamicBankTotals[exp.bank] = 0;
        dynamicBankTotals[exp.bank] += Number(exp.receipt_amount || 0) - Number(exp.payment_amount || 0);
      }
      if (exp.category && exp.category.trim() !== '') {
        if (!dynamicCategoryTotals[exp.category]) dynamicCategoryTotals[exp.category] = 0;
        dynamicCategoryTotals[exp.category] += Number(exp.payment_amount || 0) - Number(exp.receipt_amount || 0);
      }
    });
  }

  const handlePresetDate = (preset) => {
    const now = new Date();
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'today') {
      const dateStr = now.toISOString().split('T')[0];
      setFromDate(dateStr);
      setToDate(dateStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(lastDay);
    } else if (preset === 'lastMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(lastDay);
    } else if (preset === 'thisYear') {
      const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(lastDay);
    }
    setCurrentPage(1);
  };

  const currentExpenses = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const clientOptions = (Array.isArray(clients) ? clients : []).map(c => ({
    value: c.full_name || c.name || '',
    label: `${c.full_name || c.name || ''} ${c.business_name ? `(${c.business_name})` : ''}`.trim()
  }));

  return (
    <div className="expenses-container modern-ui">
      {/* Sub-Module Navigation Header */}
      <div className="expenses-tab-nav">
        <button 
          className={`expenses-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'ledger' })}
        >
          <CreditCard size={18} /> Cash & Bank Ledger
        </button>
        <button 
          className={`expenses-tab-btn ${activeTab === 'future-payables' ? 'active' : ''}`}
          onClick={() => setSearchParams({ tab: 'future-payables' })}
        >
          <Clock size={18} /> Future Payables & Scheduled Bills
          {(payablesSummary.due_today_count > 0 || payablesSummary.overdue_count > 0) && (
            <span className="expenses-tab-badge alert">
              {payablesSummary.due_today_count + payablesSummary.overdue_count} Due
            </span>
          )}
        </button>
      </div>

      {activeTab === 'future-payables' ? (
        <FuturePayablesView 
          banks={banks} 
          categories={categories} 
          onManageCategories={() => setIsManageCategoriesModalOpen(true)}
          onManageBanks={() => setIsManageBanksModalOpen(true)}
        />
      ) : (
        <>
          <div className="expenses-controls" style={{ justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <div className="controls-right">
              <button className="btn-outline" onClick={() => setIsManageCategoriesModalOpen(true)}>
                <Briefcase size={16} /> Manage Expense
              </button>
              <button className="btn-outline" onClick={() => setIsManageBanksModalOpen(true)}>
                <Building2 size={16} /> Manage Banks
              </button>
              <button className="btn-outline" onClick={generatePDF}>
                <Download size={16} /> Download PDF
              </button>
              <button className="btn-primary" onClick={() => {
                setEditingId(null);
                setFormData({
                  date: new Date().toISOString().split('T')[0],
                  client: '',
                  description: '',
                  category: '',
                  mode: 'Cash',
                  bank: '',
                  reference: '',
                  type: 'payment',
                  amount: ''
                });
                setIsModalOpen(true);
              }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '6px' }}>
                <Plus size={16} /> Add Entry
              </button>
            </div>
          </div>

      {/* Summary Cards */}
      <div className="expense-summary-cards" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>

        <div className="expense-card" style={{ flex: '1 1 300px' }}>
          <div className="expense-card-icon bg-orange">
            <Building2 size={24} />
          </div>
          <div className="expense-card-info">
            <p>OTHER EXPENSES {isFiltered ? '(FILTERED)' : ''}</p>
            <h3>PKR {dynamicOtherExpenses.toFixed(2)}</h3>
          </div>
        </div>
        <div className="expense-card" style={{ flex: '1 1 300px' }}>
          <div className="expense-card-icon bg-gray">
            <Banknote size={24} />
          </div>
          <div className="expense-card-info">
            <p>TOTAL NET BALANCE {isFiltered ? '(FILTERED)' : ''}</p>
            <h3>PKR {dynamicNetBalance.toFixed(2)}</h3>
          </div>
        </div>

        <div className="expense-card" style={{ flex: '1 1 300px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div className="expense-card-icon" style={{ backgroundColor: '#cffafe', color: '#0891b2' }}>
            <FileText size={24} />
          </div>
          <div className="expense-card-info">
            <p>TOTAL INVOICED {(fromDate || toDate) ? '(FILTERED)' : ''}</p>
            <h3 style={{ color: '#0891b2' }}>PKR {dynamicTotalInvoiced.toFixed(2)}</h3>
          </div>
        </div>

        <div className="expense-card" style={{ flex: '1 1 300px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div className="expense-card-icon" style={{ backgroundColor: '#ffe4e6', color: '#e11d48' }}>
            <AlertCircle size={24} />
          </div>
          <div className="expense-card-info">
            <p>UNPAID INVOICES {(fromDate || toDate) ? '(FILTERED)' : ''}</p>
            <h3 style={{ color: '#e11d48' }}>PKR {dynamicUnpaidInvoices.toFixed(2)}</h3>
          </div>
        </div>

        {/* Dynamic Bank Cards */}
        {banks.map(bank => {
          const bankBalance = isFiltered 
            ? (dynamicBankTotals[bank.name] || 0) 
            : (summary.bankTotals?.[bank.name] || 0);
          return (
            <div className="expense-card" key={bank.id} style={{ flex: '1 1 300px' }}>
              <div className="expense-card-icon" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
                <Building2 size={24} />
              </div>
              <div className="expense-card-info">
                <p>{bank.name.toUpperCase()} {isFiltered ? '(FILTERED)' : ''}</p>
                <h3 style={{ color: bankBalance < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>PKR {bankBalance.toFixed(2)}
                </h3>
              </div>
            </div>
          );
        })}

        {/* Dynamic Category Cards */}
        {categories.map(category => {
          const categoryBalance = isFiltered 
            ? (dynamicCategoryTotals[category.name] || 0) 
            : (summary.categoryTotals?.[category.name] || 0);
          return (
            <div className="expense-card" key={category.id} style={{ flex: '1 1 300px' }}>
              <div className="expense-card-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                <Briefcase size={24} />
              </div>
              <div className="expense-card-info">
                <p>{category.name.toUpperCase()} {isFiltered ? '(FILTERED)' : ''}</p>
                <h3 style={{ color: categoryBalance > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>PKR {categoryBalance.toFixed(2)}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expenses Table */}
      <div className="recent-orders-panel" style={{ marginTop: '2rem' }}>
        <div className="panel-header-ref" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem', alignItems: 'stretch' }}>
          {/* ROW 1: SEARCH & FILTER SELECTS */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-box-ref" style={{ margin: 0, flex: '1 1 250px', minWidth: '220px' }}>
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search by client, description, mode, bank, ref, amount..." 
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
            <select 
              className="filter-select"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="All Types">All Types</option>
              <option value="Receipts">Receipts</option>
              <option value="Payments">Payments</option>
            </select>
            <select 
              className="filter-select"
              value={bankFilter}
              onChange={(e) => {
                setBankFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', outline: 'none', maxWidth: '180px' }}
            >
              <option value="All Banks">All Banks</option>
              {banks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
          </div>

          {/* ROW 2: FIXED DATE PRESETS & DATE RANGE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '0.4rem 0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={() => handlePresetDate('all')}
                style={{ padding: '0.25rem 0.65rem', borderRadius: '12px', border: 'none', background: (!fromDate && !toDate) ? '#0f172a' : '#e2e8f0', color: (!fromDate && !toDate) ? '#fff' : '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                All
              </button>
              <button 
                type="button"
                onClick={() => handlePresetDate('today')}
                style={{ padding: '0.25rem 0.65rem', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Today
              </button>
              <button 
                type="button"
                onClick={() => handlePresetDate('thisMonth')}
                style={{ padding: '0.25rem 0.65rem', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                This Month
              </button>
              <button 
                type="button"
                onClick={() => handlePresetDate('lastMonth')}
                style={{ padding: '0.25rem 0.65rem', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Last Month
              </button>
              <button 
                type="button"
                onClick={() => handlePresetDate('thisYear')}
                style={{ padding: '0.25rem 0.65rem', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                This Year
              </button>
            </div>

            <div style={{ width: '1px', height: '18px', background: '#cbd5e1', margin: '0 0.2rem' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>From:</span>
              <input 
                type="date" 
                value={fromDate} 
                onChange={e => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ border: '1px solid #cbd5e1', background: '#ffffff', borderRadius: '6px', padding: '0.2rem 0.4rem', fontSize: '0.82rem', color: '#1e293b', outline: 'none' }}
              />
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>To:</span>
              <input 
                type="date" 
                value={toDate} 
                onChange={e => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ border: '1px solid #cbd5e1', background: '#ffffff', borderRadius: '6px', padding: '0.2rem 0.4rem', fontSize: '0.82rem', color: '#1e293b', outline: 'none' }}
              />
              {(fromDate || toDate) && (
                <button 
                  onClick={() => { setFromDate(''); setToDate(''); setCurrentPage(1); }}
                  style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold', marginLeft: '0.25rem' }}
                  title="Clear Date Filter"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="table-responsive-ref">
          <table className="ref-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>PARTY/CLIENT</th>
                <th>EXPENSE</th>
                <th>DESCRIPTION</th>
                <th>MODE</th>
                <th>BANK</th>
                <th>REFERENCE</th>
                <th style={{textAlign: 'right'}}>RECEIPT</th>
                <th style={{textAlign: 'right'}}>PAYMENT</th>
                <th style={{textAlign: 'right'}}>BALANCE</th>
                <th style={{textAlign: 'center'}}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {currentExpenses.map(exp => (
                <tr key={exp.id}>
                  <td>{new Date(exp.date).toLocaleDateString()}</td>
                  <td style={{fontWeight: '600'}}>{exp.client}</td>
                  <td>{exp.category || '-'}</td>
                  <td>{exp.description}</td>
                  <td>{exp.mode}</td>
                  <td>{exp.bank || '-'}</td>
                  <td>{exp.reference || '-'}</td>
                  <td style={{textAlign: 'right', color: 'var(--success)'}}>PKR {Number(exp.receipt_amount).toFixed(2)}</td>
                  <td style={{textAlign: 'right', color: 'var(--danger)'}}>PKR {Number(exp.payment_amount).toFixed(2)}</td>
                  <td style={{textAlign: 'right', fontWeight: 'bold'}}>PKR {Number(exp.balance).toFixed(2)}</td>
                  <td style={{textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '0.5rem'}}>
                    <button className="btn-icon" onClick={() => handleEditClick(exp)} title="Edit Entry">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button className="btn-icon delete-btn" onClick={async () => {
                      if(window.confirm('Delete entry?')) {
                        await axios.delete(`/api/expenses/${exp.id}`);
                        fetchExpenses();
                      }
                    }} title="Delete Entry"><X size={16} /></button>
                  </td>
                </tr>
              ))}
              {currentExpenses.length === 0 && (
                <tr>
                  <td colSpan="10" className="empty-state" style={{textAlign: 'center', padding: '2rem'}}>No expenses found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {filteredExpenses.length > 0 && (
          <Pagination 
            currentPage={currentPage}
            totalItems={filteredExpenses.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
      </>
      )}

      {/* Add Entry Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? 'Edit Entry' : 'Add Entry'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
              </div>
              
              <div className="form-group">
                <label>Entry Type *</label>
                <select name="type" value={formData.type} onChange={handleInputChange} required>
                  <option value="receipt">Receipt (Cash In)</option>
                  <option value="payment">Payment (Expense / Cash Out)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Expense</label>
                <select name="category" value={formData.category} onChange={handleInputChange}>
                  <option value="">- Select Expense (Optional) -</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Client / Party (Optional)</label>
                <Select
                  options={clientOptions}
                  value={clientOptions.find(opt => opt.value === formData.client)}
                  onChange={(selected) => setFormData({ ...formData, client: selected ? selected.value : '' })}
                  isClearable
                  isSearchable
                  placeholder="- General Expense / No Client -"
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: '42px',
                      borderRadius: '6px',
                      borderColor: state.isFocused ? 'var(--primary-color)' : 'var(--border-color)',
                      boxShadow: 'none',
                      '&:hover': {
                        borderColor: 'var(--primary-color)'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999,
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      overflow: 'hidden'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected 
                        ? 'var(--primary-color)' 
                        : state.isFocused 
                          ? '#f1f5f9' 
                          : '#ffffff',
                      color: state.isSelected ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                      padding: '10px 16px',
                      fontWeight: state.isSelected ? '600' : '500',
                      '&:active': {
                        backgroundColor: '#0284c7',
                        color: '#ffffff'
                      }
                    })
                  }}
                />
                
                {(() => {
                  if (!formData.client) return null;
                  const selectedClient = clients.find(c => (c.full_name === formData.client || c.name === formData.client));
                  if (!selectedClient) return null;

                  const clientInvoices = (invoices || []).filter(inv => Number(inv.client_id) === Number(selectedClient.id) && inv.status !== 'Void');
                  const liveInvoiced = clientInvoices.length > 0
                    ? clientInvoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0)
                    : Number(selectedClient.total_invoiced_amount || 0);

                  const liveBalance = clientInvoices.length > 0
                    ? clientInvoices.reduce((sum, i) => sum + parseFloat(i.balance || 0), 0)
                    : Number(selectedClient.total_balance || 0);

                  return (
                    <div style={{ 
                      marginTop: '0.75rem', 
                      padding: '0.75rem', 
                      backgroundColor: '#f8fafc', 
                      borderRadius: '6px', 
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem'
                    }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Total Invoiced:</span>
                        <strong style={{ marginLeft: '0.5rem', color: '#334155' }}>
                          PKR {liveInvoiced.toFixed(2)}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Remaining Balance:</span>
                        <strong style={{ 
                          marginLeft: '0.5rem', 
                          color: liveBalance > 0 ? '#ef4444' : '#10b981' 
                        }}>
                          PKR {liveBalance.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="form-group">
                <label>Amount *</label>
                <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} step="0.01" min="0.01" required />
              </div>

              <div className="form-group">
                <label>Description</label>
                <input type="text" name="description" value={formData.description} onChange={handleInputChange} placeholder="Details about this entry" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: formData.mode === 'Cash' ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Mode</label>
                  <select name="mode" value={formData.mode} onChange={handleInputChange}>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Check">Check</option>
                  </select>
                </div>
                {formData.mode !== 'Cash' && (
                  <div className="form-group">
                    <label>Bank Name</label>
                    <select name="bank" value={formData.bank} onChange={handleInputChange}>
                      <option value="">- Select Bank (Optional) -</option>
                      {banks.map(b => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Reference #</label>
                <input type="text" name="reference" value={formData.reference} onChange={handleInputChange} placeholder="Check #, Transaction ID" />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '0.75rem 1.25rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Banks Modal */}
      {isManageBanksModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Manage Banks</h2>
              <button className="btn-close" onClick={() => setIsManageBanksModalOpen(false)}><X size={24} /></button>
            </div>
            <div className="banks-list" style={{ marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto' }}>
              {banks.length === 0 && <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No banks added yet.</p>}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {banks.map(bank => (
                  <li key={bank.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: '500' }}>{bank.name}</span>
                    <button className="btn-icon delete-btn" onClick={() => handleDeleteBank(bank.id)} title="Delete Bank">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <form onSubmit={handleCreateBank} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={newBankName} 
                onChange={(e) => setNewBankName(e.target.value)} 
                placeholder="New Bank Name" 
                required 
                style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '6px' }}>Add</button>
            </form>
          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      {isManageCategoriesModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Manage Categories</h2>
              <button className="btn-close" onClick={() => setIsManageCategoriesModalOpen(false)}><X size={24} /></button>
            </div>
            <div className="banks-list" style={{ marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto' }}>
              {categories.length === 0 && <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No categories added yet.</p>}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {categories.map(category => (
                  <li key={category.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: '500' }}>{category.name}</span>
                    <button className="btn-icon delete-btn" onClick={() => handleDeleteCategory(category.id)} title="Delete Category">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={newCategoryName} 
                onChange={(e) => setNewCategoryName(e.target.value)} 
                placeholder="New Category Name" 
                required 
                style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '6px' }}>Add</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
