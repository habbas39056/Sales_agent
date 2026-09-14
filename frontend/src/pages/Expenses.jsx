import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Plus, Download, Briefcase, CreditCard, Banknote, X, Building2, 
  FileText, AlertCircle, Search, Clock, Calendar, Wallet, 
  ArrowLeftRight, Check, Edit2, RotateCcw, LayoutGrid, List, 
  TrendingUp, FileSpreadsheet, Trash2, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [summary, setSummary] = useState({ 
    cashInHand: 0, otherExpenses: 0, totalExpenses: 0, totalReceipts: 0, 
    totalNetBalance: 0, bankTotals: {}, uncategorizedExpenses: 0, categoryTotals: {} 
  });
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState([]);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [bankFilter, setBankFilter] = useState('All Banks');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePreset, setDatePreset] = useState('All Dates');

  // View Mode: 'table' or 'cards'
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('exp_view_mode') || 'table';
  });

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('exp_view_mode', mode);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isManageBanksModalOpen, setIsManageBanksModalOpen] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankOpeningBalance, setNewBankOpeningBalance] = useState('');
  const [editingBankId, setEditingBankId] = useState(null);
  const [editBankName, setEditBankName] = useState('');
  const [editBankOpening, setEditBankOpening] = useState('');
  const [isManageCategoriesModalOpen, setIsManageCategoriesModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    client: '',
    description: '',
    category: '',
    mode: 'Cash',
    bank: '',
    from_bank: '',
    to_bank: '',
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

  // Handle Date Presets
  const handlePresetDate = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'All Dates') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'Today') {
      const dateStr = now.toISOString().split('T')[0];
      setFromDate(dateStr);
      setToDate(dateStr);
    } else if (preset === 'This Week') {
      const firstday = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().slice(0, 10);
      const lastday = new Date(now.setDate(now.getDate() - now.getDay() + 6)).toISOString().slice(0, 10);
      setFromDate(firstday);
      setToDate(lastday);
    } else if (preset === 'This Month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(lastDay);
    } else if (preset === 'Last Month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(lastDay);
    } else if (preset === 'This Year') {
      const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(lastDay);
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('All Types');
    setBankFilter('All Banks');
    setCategoryFilter('All Categories');
    setDatePreset('All Dates');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

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
      setCategories(res.data || []);
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
      setBanks(res.data || []);
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
      setExpenses(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'mode' && value === 'Cash') {
      setFormData(prev => ({ ...prev, mode: 'Cash', bank: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.type === 'transfer') {
        if (!formData.from_bank || !formData.to_bank) {
          alert('Both Source and Destination accounts are required for an account transfer.');
          return;
        }
        if (formData.from_bank === formData.to_bank) {
          alert('Source and Destination accounts cannot be the same.');
          return;
        }
      }

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
        from_bank: '',
        to_bank: '',
        reference: '',
        type: 'payment',
        amount: ''
      });
      fetchExpenses();
      fetchBanks();
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
      from_bank: '',
      to_bank: '',
      reference: exp.reference || '',
      type: Number(exp.receipt_amount) > 0 ? 'receipt' : 'payment',
      amount: Number(exp.receipt_amount) > 0 ? exp.receipt_amount : exp.payment_amount
    });
    setIsModalOpen(true);
  };

  const handleCreateBank = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/banks', { 
        name: newBankName, 
        opening_balance: parseFloat(newBankOpeningBalance) || 0 
      });
      setNewBankName('');
      setNewBankOpeningBalance('');
      fetchBanks();
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating bank');
    }
  };

  const handleStartEditBank = (bank) => {
    setEditingBankId(bank.id);
    setEditBankName(bank.name);
    setEditBankOpening(bank.opening_balance !== undefined ? bank.opening_balance : 0);
  };

  const handleSaveEditBank = async (id) => {
    try {
      await axios.put(`/api/banks/${id}`, {
        name: editBankName,
        opening_balance: parseFloat(editBankOpening) || 0
      });
      setEditingBankId(null);
      fetchBanks();
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.error || 'Error updating bank');
    }
  };

  const handleDeleteBank = async (id) => {
    if (window.confirm("Are you sure you want to delete this bank?")) {
      try {
        await axios.delete(`/api/banks/${id}`);
        fetchBanks();
        fetchExpenses();
      } catch (err) {
        alert(err.response?.data?.error || 'Error deleting bank');
      }
    }
  };

  const handleOrphanCleanup = async () => {
    try {
      const checkRes = await axios.get('/api/expenses/orphan-check');
      if (checkRes.data.count === 0) {
        alert('All ledger entries are healthy! No phantom receipts from deleted invoices were found.');
        return;
      }
      const totalAmount = checkRes.data.orphans.reduce((s, o) => s + parseFloat(o.receipt_amount || 0), 0);
      if (window.confirm(`Found ${checkRes.data.count} phantom receipts in ledger from deleted invoices (Total: PKR ${totalAmount.toFixed(2)}).\n\nDo you want to clean them up now to reconcile your ledger balances?`)) {
        const res = await axios.post('/api/expenses/cleanup-orphans');
        alert(res.data.message);
        fetchExpenses();
        fetchBanks();
      }
    } catch (err) {
      alert('Error during cleanup: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/expense-categories', { name: newCategoryName });
      setNewCategoryName('');
      fetchCategories();
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm("Are you sure you want to delete this category?")) {
      try {
        await axios.delete(`/api/expense-categories/${id}`);
        fetchCategories();
        fetchExpenses();
      } catch (err) {
        alert(err.response?.data?.error || 'Error deleting category');
      }
    }
  };

  // Generate Branded PDF Statement
  const generatePDF = () => {
    if (!filteredExpenses || filteredExpenses.length === 0) {
      alert('No ledger records to export!');
      return;
    }
    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');
      
      // Header & branding
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("Adwise Sales - Cash & Bank Ledger Statement", 40, 45);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated: ${new Date().toLocaleDateString('en-GB')} | Total Receipts: PKR ${dynamicTotalReceipts.toFixed(2)} | Total Expenses: PKR ${dynamicOtherExpenses.toFixed(2)} | Net Balance: PKR ${dynamicNetBalance.toFixed(2)}`,
        40,
        62
      );

      const tableColumns = ["Date", "Client/Party", "Category", "Description", "Mode", "Bank", "Ref", "Receipt (+)", "Payment (-)", "Balance"];
      const tableRows = filteredExpenses.map(exp => [
        new Date(exp.date).toLocaleDateString('en-GB'),
        exp.client || '-',
        exp.category || '-',
        exp.description || '-',
        exp.mode || 'Cash',
        exp.bank || '-',
        exp.reference || '-',
        Number(exp.receipt_amount || 0) > 0 ? Number(exp.receipt_amount).toFixed(2) : '-',
        Number(exp.payment_amount || 0) > 0 ? Number(exp.payment_amount).toFixed(2) : '-',
        Number(exp.balance || 0).toFixed(2)
      ]);

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY: 75,
        theme: 'grid',
        headStyles: {
          fillColor: [225, 29, 72], // Crimson Red
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8.5
        },
        styles: {
          fontSize: 8,
          cellPadding: 5.5,
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 70 },
          7: { halign: 'right', fontStyle: 'bold' },
          8: { halign: 'right', fontStyle: 'bold' },
          9: { halign: 'right', fontStyle: 'bold' }
        },
        didDrawPage: () => {
          const str = `Page ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(str, doc.internal.pageSize.width - 60, doc.internal.pageSize.height - 20);
        }
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Adwise_Expense_Ledger_${dateStr}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF statement.');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredExpenses || filteredExpenses.length === 0) {
      alert('No ledger records to export!');
      return;
    }

    const wb = XLSX.utils.book_new();

    const ledgerData = filteredExpenses.map(exp => ({
      'Date': exp.date ? new Date(exp.date).toLocaleDateString('en-GB') : '',
      'Client / Party': exp.client || '-',
      'Category': exp.category || 'Uncategorized',
      'Description': exp.description || '',
      'Payment Mode': exp.mode || 'Cash',
      'Bank': exp.bank || '-',
      'Reference': exp.reference || '',
      'Receipt (Inflow)': Number(exp.receipt_amount || 0),
      'Payment (Expense)': Number(exp.payment_amount || 0),
      'Running Balance': Number(exp.balance || 0)
    }));

    const ws = XLSX.utils.json_to_sheet(ledgerData);
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Adwise_Expense_Ledger_${dateStr}.xlsx`);
  };

  // Filtered Expenses Computation
  const filteredExpenses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return expenses.filter(exp => {
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
      if (typeFilter === 'Receipts') matchesType = Number(exp.receipt_amount || 0) > 0 && exp.category !== 'Account Transfer';
      if (typeFilter === 'Payments') matchesType = Number(exp.payment_amount || 0) > 0 && exp.category !== 'Account Transfer';
      if (typeFilter === 'Transfers') matchesType = exp.category === 'Account Transfer';
      
      let matchesBank = true;
      if (bankFilter === 'Cash in Hand') {
        matchesBank = !exp.bank || exp.bank.trim() === '';
      } else if (bankFilter !== 'All Banks') {
        matchesBank = exp.bank === bankFilter;
      }

      let matchesCategory = true;
      if (categoryFilter === 'Uncategorized') {
        matchesCategory = !exp.category || exp.category.trim() === '';
      } else if (categoryFilter !== 'All Categories') {
        matchesCategory = exp.category === categoryFilter;
      }

      // Date Range Filter
      let matchesDate = true;
      if (exp.date) {
        const expDateStr = new Date(exp.date).toISOString().slice(0, 10);
        if (fromDate && expDateStr < fromDate) matchesDate = false;
        if (toDate && expDateStr > toDate) matchesDate = false;
      }
      
      return matchesSearch && matchesType && matchesBank && matchesCategory && matchesDate;
    });
  }, [expenses, searchTerm, typeFilter, bankFilter, categoryFilter, fromDate, toDate]);

  // Dynamic Statistics
  const isFiltered = Boolean(fromDate || toDate || bankFilter !== 'All Banks' || typeFilter !== 'All Types' || categoryFilter !== 'All Categories' || searchTerm.trim());

  const dynamicOtherExpenses = useMemo(() => {
    return isFiltered
      ? filteredExpenses.reduce((sum, exp) => exp.category === 'Account Transfer' ? sum : sum + Number(exp.payment_amount || 0), 0)
      : Number(summary.totalExpenses || summary.otherExpenses || 0);
  }, [filteredExpenses, isFiltered, summary]);

  const dynamicTotalReceipts = useMemo(() => {
    return isFiltered
      ? filteredExpenses.reduce((sum, exp) => exp.category === 'Account Transfer' ? sum : sum + Number(exp.receipt_amount || 0), 0)
      : Number(summary.totalReceipts || 0);
  }, [filteredExpenses, isFiltered, summary]);

  // Standing Account Balances (Always real ledger balances, never corrupted by table row filters)
  const actualBankTotals = useMemo(() => {
    const bTotals = {};
    banks.forEach(b => {
      bTotals[b.name] = summary.bankTotals?.[b.name] !== undefined 
        ? summary.bankTotals[b.name] 
        : (parseFloat(b.opening_balance) || 0);
    });
    return bTotals;
  }, [banks, summary]);

  const actualCashInHand = Number(summary.cashInHand || 0);
  const actualTotalNetBalance = Number(summary.totalNetBalance || 0);

  // Active account balance for the 1st KPI Card
  const activeAccountBalance = useMemo(() => {
    if (bankFilter === 'Cash in Hand') return actualCashInHand;
    if (bankFilter !== 'All Banks') return actualBankTotals[bankFilter] || 0;
    return actualTotalNetBalance;
  }, [bankFilter, actualCashInHand, actualBankTotals, actualTotalNetBalance]);

  // Category Spend & Uncategorized in active filtered view
  const { dynamicCategoryTotals, dynamicUncategorizedExpenses } = useMemo(() => {
    const cTotals = {};
    let uncat = 0;
    if (isFiltered) {
      filteredExpenses.forEach(exp => {
        const cName = exp.category ? exp.category.trim() : '';
        const net = Number(exp.payment_amount || 0) - Number(exp.receipt_amount || 0);
        if (cName && cName !== 'Account Transfer') {
          if (!cTotals[cName]) cTotals[cName] = 0;
          cTotals[cName] += net;
        } else if (!cName && (Number(exp.payment_amount || 0) > 0 || Number(exp.receipt_amount || 0) > 0)) {
          uncat += net;
        }
      });
    } else {
      categories.forEach(c => {
        cTotals[c.name] = summary.categoryTotals?.[c.name] || 0;
      });
      uncat = Number(summary.uncategorizedExpenses || 0);
    }
    return { dynamicCategoryTotals: cTotals, dynamicUncategorizedExpenses: uncat };
  }, [isFiltered, filteredExpenses, categories, summary]);

  const currentExpenses = useMemo(() => {
    return filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredExpenses, currentPage, itemsPerPage]);

  const clientOptions = useMemo(() => {
    return (Array.isArray(clients) ? clients : []).map(c => ({
      value: c.full_name || c.name || '',
      label: `${c.full_name || c.name || ''} ${c.business_name ? `(${c.business_name})` : ''}`.trim()
    }));
  }, [clients]);

  return (
    <div className="expenses-container">
      {/* 1. SEAMLESS TOP HEADER: SUB-MODULE TABS + RIGHT-ALIGNED ACTION TOOLBAR */}
      <div className="expenses-header-bar">
        {/* Tabs */}
        <div className="expenses-tab-nav">
          <button 
            className={`expenses-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: 'ledger' })}
          >
            <CreditCard size={16} /> Cash & Bank Ledger
          </button>
          <button 
            className={`expenses-tab-btn ${activeTab === 'future-payables' ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: 'future-payables' })}
          >
            <Clock size={16} /> Future Payables & Scheduled Bills
            {(payablesSummary.due_today_count > 0 || payablesSummary.overdue_count > 0) && (
              <span className="expenses-tab-badge alert">
                {payablesSummary.due_today_count + payablesSummary.overdue_count} Due
              </span>
            )}
          </button>
        </div>

        {/* Right-aligned Header Actions */}
        {activeTab === 'ledger' && (
          <div className="expenses-header-actions">
            <button className="exp-btn-secondary" onClick={handleOrphanCleanup} title="Clean phantom receipts from deleted invoices">
              <FileText size={15} color="#475569" /> Clean Invoices
            </button>
            <button className="exp-btn-secondary" onClick={() => setIsManageCategoriesModalOpen(true)} title="Manage Expense Categories">
              <Briefcase size={15} color="#475569" /> Categories
            </button>
            <button className="exp-btn-secondary" onClick={() => setIsManageBanksModalOpen(true)} title="Manage Bank Accounts & Opening Balances">
              <Building2 size={15} color="#475569" /> Banks
            </button>
            <button className="exp-btn-secondary" onClick={handleExportExcel} title="Export Ledger to Excel">
              <FileSpreadsheet size={15} color="#10b981" /> Export Excel
            </button>
            <button className="exp-btn-secondary" onClick={generatePDF} title="Download PDF Ledger Statement">
              <Download size={15} color="#e11d48" /> PDF Statement
            </button>
            <button 
              className="exp-btn-primary" 
              onClick={() => {
                setEditingId(null);
                setFormData({
                  date: new Date().toISOString().split('T')[0],
                  client: '',
                  description: '',
                  category: '',
                  mode: 'Cash',
                  bank: '',
                  from_bank: '',
                  to_bank: '',
                  reference: '',
                  type: 'payment',
                  amount: ''
                });
                setIsModalOpen(true);
              }}
              title="Add New Ledger Entry"
            >
              <Plus size={16} /> Add Entry
            </button>
          </div>
        )}
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
          {/* 2. COMPACT SHORT FINANCIAL KPI CARDS ROW */}
          <div className="exp-kpi-grid">
            {/* Net Balance / Account Balance Card */}
            <div 
              className={`exp-kpi-card ${typeFilter === 'All Types' && bankFilter === 'All Banks' ? 'active-kpi' : ''}`}
              onClick={handleResetFilters}
              title="Click to reset filters and view all transactions"
            >
              <div className="exp-kpi-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Banknote size={18} />
              </div>
              <div className="exp-kpi-content">
                <span className="exp-kpi-label">
                  {bankFilter === 'All Banks' ? 'Total Net Balance' : bankFilter === 'Cash in Hand' ? 'Cash in Hand Balance' : `${bankFilter} Balance`}
                </span>
                <div className="exp-kpi-value" style={{ color: activeAccountBalance < 0 ? '#e11d48' : '#059669' }}>
                  PKR {activeAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="exp-kpi-sub">
                  {bankFilter === 'All Banks' ? 'All Banks + Cash in Hand' : bankFilter === 'Cash in Hand' ? 'Liquid counter cash drawer' : 'Standing bank account balance'}
                </span>
              </div>
            </div>

            {/* Total Expenses Card */}
            <div 
              className={`exp-kpi-card ${typeFilter === 'Payments' ? 'active-kpi' : ''}`}
              onClick={() => { setTypeFilter('Payments'); setCurrentPage(1); }}
              title="Click to filter Payments (Expenses)"
            >
              <div className="exp-kpi-icon-box" style={{ background: '#ffe4e6', color: '#e11d48' }}>
                <Building2 size={18} />
              </div>
              <div className="exp-kpi-content">
                <span className="exp-kpi-label">Total Expenses</span>
                <div className="exp-kpi-value" style={{ color: '#e11d48' }}>
                  PKR {dynamicOtherExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="exp-kpi-sub">All category payments</span>
              </div>
            </div>

            {/* Total Receipts Card */}
            <div 
              className={`exp-kpi-card ${typeFilter === 'Receipts' ? 'active-kpi' : ''}`}
              onClick={() => { setTypeFilter('Receipts'); setCurrentPage(1); }}
              title="Click to filter Receipts (Inflows)"
            >
              <div className="exp-kpi-icon-box" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                <TrendingUp size={18} />
              </div>
              <div className="exp-kpi-content">
                <span className="exp-kpi-label">Total Receipts</span>
                <div className="exp-kpi-value" style={{ color: '#4f46e5' }}>
                  PKR {dynamicTotalReceipts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="exp-kpi-sub">Total incoming payments</span>
              </div>
            </div>

            {/* Cash in Hand / Net Flow Card */}
            <div 
              className={`exp-kpi-card ${bankFilter === 'Cash in Hand' ? 'active-kpi' : ''}`}
              onClick={() => { setBankFilter(bankFilter === 'Cash in Hand' ? 'All Banks' : 'Cash in Hand'); setCurrentPage(1); }}
              title="Click to filter Cash in Hand"
            >
              <div className="exp-kpi-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <Wallet size={18} />
              </div>
              <div className="exp-kpi-content">
                <span className="exp-kpi-label" style={{ color: '#166534' }}>
                  {bankFilter === 'All Banks' ? 'Cash in Hand' : 'Filtered Net Flow'}
                </span>
                <div className="exp-kpi-value" style={{ color: (bankFilter === 'All Banks' ? actualCashInHand : (dynamicTotalReceipts - dynamicOtherExpenses)) < 0 ? '#e11d48' : '#15803d' }}>
                  PKR {(bankFilter === 'All Banks' ? actualCashInHand : (dynamicTotalReceipts - dynamicOtherExpenses)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="exp-kpi-sub" style={{ color: '#166534' }}>
                  {bankFilter === 'All Banks' ? 'Liquid counter cash' : 'Receipts minus payments'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. COMPACT ACCOUNTS & CASH RIBBON (ROW 2 - COMPACT 38PX HIGH) */}
          <div className="exp-accounts-bar">
            <div className="exp-accounts-bar-label">
              <Building2 size={13} /> Accounts:
            </div>
            
            <button 
              className={`exp-account-chip ${bankFilter === 'All Banks' ? 'active' : ''}`}
              onClick={() => { setBankFilter('All Banks'); setCurrentPage(1); }}
            >
              <span>All Accounts</span>
            </button>

            <button 
              className={`exp-account-chip cash ${bankFilter === 'Cash in Hand' ? 'active' : ''}`}
              onClick={() => { setBankFilter(bankFilter === 'Cash in Hand' ? 'All Banks' : 'Cash in Hand'); setCurrentPage(1); }}
            >
              <Wallet size={13} />
              <span>Cash: <strong>PKR {actualCashInHand.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
            </button>

            {banks.map(bank => {
              const bBal = actualBankTotals[bank.name] !== undefined ? actualBankTotals[bank.name] : (parseFloat(bank.opening_balance) || 0);
              return (
                <button 
                  key={bank.id}
                  className={`exp-account-chip ${bankFilter === bank.name ? 'active' : ''}`}
                  onClick={() => { setBankFilter(bankFilter === bank.name ? 'All Banks' : bank.name); setCurrentPage(1); }}
                >
                  <Building2 size={13} />
                  <span>{bank.name}: <strong style={{ color: bBal < 0 ? '#e11d48' : 'inherit' }}>PKR {bBal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
                </button>
              );
            })}

            <button 
              className="exp-account-chip" 
              onClick={() => setIsManageBanksModalOpen(true)}
              style={{ borderStyle: 'dashed', color: '#64748b' }}
              title="Manage Bank Accounts"
            >
              <Plus size={13} /> Manage
            </button>
          </div>

          {/* 4. COMPACT CATEGORIES SPEND RIBBON */}
          {categories.length > 0 && (
            <div className="exp-categories-bar">
              <button 
                className={`exp-cat-chip ${categoryFilter === 'All Categories' ? 'active' : ''}`}
                onClick={() => { setCategoryFilter('All Categories'); setCurrentPage(1); }}
              >
                All Categories
              </button>

              {categories.map(c => {
                const cSpend = dynamicCategoryTotals[c.name] || 0;
                return (
                  <button 
                    key={c.id}
                    className={`exp-cat-chip ${categoryFilter === c.name ? 'active' : ''}`}
                    onClick={() => { setCategoryFilter(categoryFilter === c.name ? 'All Categories' : c.name); setCurrentPage(1); }}
                  >
                    <span>{c.name}</span>
                    {cSpend > 0 && (
                      <span style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 700 }}>
                        (PKR {cSpend >= 1000 ? `${(cSpend / 1000).toFixed(1)}k` : cSpend.toFixed(0)})
                      </span>
                    )}
                  </button>
                );
              })}

              {dynamicUncategorizedExpenses > 0 && (
                <button 
                  className={`exp-cat-chip uncat ${categoryFilter === 'Uncategorized' ? 'active' : ''}`}
                  onClick={() => { setCategoryFilter(categoryFilter === 'Uncategorized' ? 'All Categories' : 'Uncategorized'); setCurrentPage(1); }}
                >
                  <AlertCircle size={12} />
                  <span>Uncategorized: PKR {dynamicUncategorizedExpenses.toFixed(0)}</span>
                </button>
              )}
            </div>
          )}

          {/* 5. CONTROLS, SEARCH & FILTERS TOOLBAR */}
          <div className="exp-panel">
            <div className="exp-toolbar">
              <div className="exp-toolbar-row">
                {/* Search Box */}
                <div className="exp-search-wrapper">
                  <Search size={16} className="exp-search-icon" />
                  <input 
                    type="text" 
                    className="exp-search-input"
                    placeholder="Search party, description, mode, bank, ref, amount..." 
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                  {searchTerm && (
                    <button 
                      className="exp-search-clear"
                      onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filters Row */}
                <div className="exp-filters-group">
                  {/* Type Filter */}
                  <select 
                    className="exp-select"
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="All Types">All Types</option>
                    <option value="Payments">Payments (Expenses)</option>
                    <option value="Receipts">Receipts (Inflows)</option>
                    <option value="Transfers">Transfers (Contra)</option>
                  </select>

                  {/* Category Filter */}
                  <select 
                    className="exp-select"
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{ maxWidth: '170px' }}
                  >
                    <option value="All Categories">All Categories</option>
                    <option value="Uncategorized">⚠️ Uncategorized</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>

                  {/* Bank Filter */}
                  <select 
                    className="exp-select"
                    value={bankFilter}
                    onChange={(e) => {
                      setBankFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{ maxWidth: '170px' }}
                  >
                    <option value="All Banks">All Banks & Cash</option>
                    <option value="Cash in Hand">Cash in Hand</option>
                    {banks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>

                  {/* Date Presets */}
                  <select 
                    className="exp-select"
                    value={datePreset}
                    onChange={e => handlePresetDate(e.target.value)}
                  >
                    <option value="All Dates">All Dates</option>
                    <option value="Today">Today</option>
                    <option value="This Week">This Week</option>
                    <option value="This Month">This Month</option>
                    <option value="Last Month">Last Month</option>
                    <option value="This Year">This Year</option>
                    <option value="Custom">Custom Range</option>
                  </select>

                  {/* Date Range Pickers */}
                  <div className="exp-date-group">
                    <input 
                      type="date" 
                      className="exp-date-input"
                      value={fromDate} 
                      onChange={e => {
                        setFromDate(e.target.value);
                        setDatePreset('Custom');
                        setCurrentPage(1);
                      }}
                      title="From Date"
                    />
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>to</span>
                    <input 
                      type="date" 
                      className="exp-date-input"
                      value={toDate} 
                      onChange={e => {
                        setToDate(e.target.value);
                        setDatePreset('Custom');
                        setCurrentPage(1);
                      }}
                      title="To Date"
                    />
                  </div>

                  {/* 1-Click Reset Button */}
                  {(searchTerm || typeFilter !== 'All Types' || bankFilter !== 'All Banks' || categoryFilter !== 'All Categories' || datePreset !== 'All Dates' || fromDate || toDate) && (
                    <button 
                      className="exp-reset-btn"
                      onClick={handleResetFilters}
                      title="Reset all search queries and filters"
                    >
                      <RotateCcw size={13} /> Reset
                    </button>
                  )}

                  {/* Dual View Mode Toggle */}
                  <div className="exp-view-toggle">
                    <button 
                      className={`exp-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                      onClick={() => handleViewModeChange('table')}
                      title="Enterprise Ledger Table View"
                    >
                      <List size={14} /> Table
                    </button>
                    <button 
                      className={`exp-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                      onClick={() => handleViewModeChange('cards')}
                      title="Visual Transaction Cards View"
                    >
                      <LayoutGrid size={14} /> Cards
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. MAIN PRESENTATION: ENTERPRISE TABLE OR VISUAL CARDS */}
            {viewMode === 'table' ? (
              <div className="exp-table-wrapper">
                <table className="exp-table">
                  <thead>
                    <tr>
                      <th>DATE</th>
                      <th>TYPE & CATEGORY</th>
                      <th>PARTY / CLIENT</th>
                      <th>DESCRIPTION</th>
                      <th>MODE & ACCOUNT</th>
                      <th>REFERENCE</th>
                      <th style={{ textAlign: 'right' }}>RECEIPT (+)</th>
                      <th style={{ textAlign: 'right' }}>PAYMENT (-)</th>
                      <th style={{ textAlign: 'right' }}>BALANCE</th>
                      <th style={{ textAlign: 'center', paddingRight: '1rem' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentExpenses.map(exp => {
                      const isTransfer = exp.category === 'Account Transfer';
                      const isReceipt = Number(exp.receipt_amount || 0) > 0;
                      const isPayment = Number(exp.payment_amount || 0) > 0;

                      return (
                        <tr key={exp.id}>
                          {/* Date */}
                          <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {exp.date ? new Date(exp.date).toLocaleDateString('en-GB') : '-'}
                          </td>

                          {/* Type & Category */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {isTransfer ? (
                                <span className="exp-type-badge transfer">
                                  <ArrowLeftRight size={11} /> Transfer
                                </span>
                              ) : isReceipt ? (
                                <span className="exp-type-badge receipt">
                                  <ArrowDownLeft size={11} /> Receipt
                                </span>
                              ) : (
                                <span className="exp-type-badge payment">
                                  <ArrowUpRight size={11} /> Payment
                                </span>
                              )}
                              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                                {exp.category || 'Uncategorized'}
                              </span>
                            </div>
                          </td>

                          {/* Party / Client */}
                          <td>
                            <strong style={{ color: '#0f172a' }}>{exp.client || '-'}</strong>
                          </td>

                          {/* Description */}
                          <td>
                            <span style={{ color: '#475569', fontSize: '0.82rem' }}>
                              {exp.description || '-'}
                            </span>
                          </td>

                          {/* Mode & Bank */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                {exp.bank ? (exp.mode && exp.mode !== 'Cash' ? exp.mode : 'Bank Transfer') : (exp.mode || 'Cash')}
                              </span>
                              {exp.bank && (
                                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{exp.bank}</span>
                              )}
                            </div>
                          </td>

                          {/* Reference */}
                          <td>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>
                              {exp.reference || '-'}
                            </span>
                          </td>

                          {/* Receipt (+) */}
                          <td style={{ textAlign: 'right' }}>
                            {isReceipt ? (
                              <strong style={{ color: '#059669' }}>
                                + PKR {Number(exp.receipt_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </strong>
                            ) : (
                              <span style={{ color: '#cbd5e1' }}>-</span>
                            )}
                          </td>

                          {/* Payment (-) */}
                          <td style={{ textAlign: 'right' }}>
                            {isPayment ? (
                              <strong style={{ color: '#e11d48' }}>
                                - PKR {Number(exp.payment_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </strong>
                            ) : (
                              <span style={{ color: '#cbd5e1' }}>-</span>
                            )}
                          </td>

                          {/* Running Balance */}
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            PKR {Number(exp.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'center' }}>
                            <div className="action-buttons" style={{ justifyContent: 'center' }}>
                              <button 
                                className="btn-icon edit-btn" 
                                onClick={() => handleEditClick(exp)} 
                                title="Edit Entry"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button 
                                className="btn-icon delete-btn" 
                                onClick={async () => {
                                  if (window.confirm('Delete this ledger entry?')) {
                                    try {
                                      await axios.delete(`/api/expenses/${exp.id}`);
                                      fetchExpenses();
                                    } catch (err) {
                                      alert('Failed to delete entry');
                                    }
                                  }
                                }} 
                                title="Delete Entry"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {currentExpenses.length === 0 && (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                            <FileText size={36} color="#cbd5e1" />
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>No ledger records match your filters</div>
                            <div style={{ fontSize: '0.85rem' }}>Try clearing your query or adjusting the date/category filters</div>
                            <button 
                              onClick={handleResetFilters} 
                              className="exp-btn-secondary" 
                              style={{ marginTop: '0.5rem' }}
                            >
                              <RotateCcw size={14} /> Clear All Filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Visual Transaction Cards Grid View */
              <div className="exp-cards-grid">
                {currentExpenses.map(exp => {
                  const isTransfer = exp.category === 'Account Transfer';
                  const isReceipt = Number(exp.receipt_amount || 0) > 0;

                  return (
                    <div 
                      key={exp.id} 
                      className={`exp-card ${isTransfer ? 'is-transfer' : (isReceipt ? 'is-receipt' : 'is-payment')}`}
                    >
                      <div className="exp-card-header">
                        <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Calendar size={13} />
                          {exp.date ? new Date(exp.date).toLocaleDateString('en-GB') : '-'}
                        </span>
                        {isTransfer ? (
                          <span className="exp-type-badge transfer">Transfer</span>
                        ) : isReceipt ? (
                          <span className="exp-type-badge receipt">Receipt</span>
                        ) : (
                          <span className="exp-type-badge payment">Payment</span>
                        )}
                      </div>

                      <div className="exp-card-body">
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                            {exp.client || 'General Entry'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            {exp.category || 'Uncategorized'}
                          </div>
                        </div>

                        {exp.description && (
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: '1.4' }}>
                            {exp.description}
                          </p>
                        )}

                        <div className="exp-card-amount-box">
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                              {isReceipt ? 'Amount Received' : 'Amount Paid'}
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isReceipt ? '#059669' : '#e11d48' }}>
                              PKR {Number(isReceipt ? exp.receipt_amount : exp.payment_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Balance</div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                              PKR {Number(exp.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="exp-card-footer">
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {exp.bank ? (exp.mode && exp.mode !== 'Cash' ? `${exp.mode} (${exp.bank})` : `Bank (${exp.bank})`) : (exp.mode || 'Cash')}
                        </span>
                        <div className="action-buttons">
                          <button className="btn-icon edit-btn" onClick={() => handleEditClick(exp)} title="Edit Entry">
                            <Edit2 size={15} />
                          </button>
                          <button 
                            className="btn-icon delete-btn" 
                            onClick={async () => {
                              if (window.confirm('Delete this ledger entry?')) {
                                try {
                                  await axios.delete(`/api/expenses/${exp.id}`);
                                  fetchExpenses();
                                } catch (err) {
                                  alert('Failed to delete entry');
                                }
                              }
                            }} 
                            title="Delete Entry"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {currentExpenses.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <FileText size={36} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>No ledger records found</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>Try clearing filters or adjusting your date range</div>
                    <button 
                      onClick={handleResetFilters} 
                      className="exp-btn-secondary" 
                      style={{ margin: '1rem auto 0 auto' }}
                    >
                      <RotateCcw size={14} /> Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Pagination */}
            {filteredExpenses.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <Pagination 
                  currentPage={currentPage}
                  totalItems={filteredExpenses.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* 7. ADD / EDIT ENTRY MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '480px', borderRadius: '12px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>{editingId ? 'Edit Ledger Entry' : 'New Ledger Entry'}</h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>Record incoming, outgoing, or transfer transactions</div>
              </div>
              <button className="btn-close" onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
              {/* Type Selector Tabs */}
              <div className="exp-modal-type-selector">
                <button 
                  type="button" 
                  className={`exp-modal-type-btn ${formData.type === 'payment' ? 'active payment' : ''}`}
                  onClick={() => setFormData({ ...formData, type: 'payment' })}
                >
                  💸 Payment (Expense)
                </button>
                <button 
                  type="button" 
                  className={`exp-modal-type-btn ${formData.type === 'receipt' ? 'active receipt' : ''}`}
                  onClick={() => setFormData({ ...formData, type: 'receipt' })}
                >
                  💰 Receipt (Inflow)
                </button>
                {!editingId && (
                  <button 
                    type="button" 
                    className={`exp-modal-type-btn ${formData.type === 'transfer' ? 'active transfer' : ''}`}
                    onClick={() => setFormData({ ...formData, type: 'transfer' })}
                  >
                    🔄 Transfer (Contra)
                  </button>
                )}
              </div>

              {/* Date */}
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Date *</label>
                <input 
                  type="date" 
                  name="date" 
                  value={formData.date} 
                  onChange={handleInputChange} 
                  required 
                  style={{ width: '100%', height: '38px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              {formData.type === 'transfer' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>From Account *</label>
                      <select 
                        name="from_bank" 
                        value={formData.from_bank || ''} 
                        onChange={handleInputChange} 
                        required
                        style={{ width: '100%', height: '38px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box', cursor: 'pointer' }}
                      >
                        <option value="">- Source -</option>
                        <option value="Cash">Cash in Hand</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>To Account *</label>
                      <select 
                        name="to_bank" 
                        value={formData.to_bank || ''} 
                        onChange={handleInputChange} 
                        required
                        style={{ width: '100%', height: '38px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box', cursor: 'pointer' }}
                      >
                        <option value="">- Destination -</option>
                        <option value="Cash">Cash in Hand</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Transfer Amount (PKR) *</label>
                    <input 
                      type="number" 
                      name="amount" 
                      value={formData.amount} 
                      onChange={handleInputChange} 
                      step="0.01" 
                      min="0.01" 
                      required 
                      style={{ width: '100%', height: '38px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Reference #</label>
                    <input 
                      type="text" 
                      name="reference" 
                      value={formData.reference} 
                      onChange={handleInputChange} 
                      placeholder="Cheque #, Online Trans ID" 
                      style={{ width: '100%', height: '38px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Description / Note</label>
                    <input 
                      type="text" 
                      name="description" 
                      value={formData.description} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Petty cash top-up or bank deposit" 
                      style={{ width: '100%', height: '38px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Category */}
                  <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Category</label>
                    <select 
                      name="category" 
                      value={formData.category} 
                      onChange={handleInputChange}
                      style={{ width: '100%', height: '38px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box', cursor: 'pointer' }}
                    >
                      <option value="">- Select Category (Optional) -</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Client / Party */}
                  <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Client / Party (Optional)</label>
                    <Select
                      options={clientOptions}
                      value={clientOptions.find(opt => opt.value === formData.client)}
                      onChange={(selected) => setFormData({ ...formData, client: selected ? selected.value : '' })}
                      isClearable
                      isSearchable
                      placeholder="- General Expense / No Client -"
                      styles={{
                        control: (base) => ({
                          ...base,
                          minHeight: '38px',
                          borderRadius: '8px',
                          borderColor: '#e2e8f0',
                          backgroundColor: '#f8fafc',
                          boxShadow: 'none',
                          fontSize: '0.85rem'
                        })
                      }}
                    />
                  </div>

                  {/* Amount */}
                  <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Amount (PKR) *</label>
                    <input 
                      type="number" 
                      name="amount" 
                      value={formData.amount} 
                      onChange={handleInputChange} 
                      step="0.01" 
                      min="0.01" 
                      required 
                      style={{ width: '100%', height: '38px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Description */}
                  <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Description</label>
                    <input 
                      type="text" 
                      name="description" 
                      value={formData.description} 
                      onChange={handleInputChange} 
                      placeholder="Details about this entry" 
                      style={{ width: '100%', height: '38px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Mode & Bank */}
                  <div style={{ display: 'grid', gridTemplateColumns: formData.mode === 'Cash' ? '1fr' : '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Mode</label>
                      <select 
                        name="mode" 
                        value={formData.mode} 
                        onChange={handleInputChange}
                        style={{ width: '100%', height: '38px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box', cursor: 'pointer' }}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Check">Cheque</option>
                      </select>
                    </div>
                    {formData.mode !== 'Cash' && (
                      <div className="form-group">
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Bank Name</label>
                        <select 
                          name="bank" 
                          value={formData.bank} 
                          onChange={handleInputChange}
                          style={{ width: '100%', height: '38px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box', cursor: 'pointer' }}
                        >
                          <option value="">- Select Bank (Optional) -</option>
                          {banks.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Reference */}
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>Reference #</label>
                    <input 
                      type="text" 
                      name="reference" 
                      value={formData.reference} 
                      onChange={handleInputChange} 
                      placeholder="Cheque #, Transaction ID" 
                      style={{ width: '100%', height: '38px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button type="button" className="exp-btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="exp-btn-primary">
                  <Check size={16} /> Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MANAGE BANKS MODAL */}
      {isManageBanksModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '520px', borderRadius: '12px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Manage Bank Accounts</h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>Configure accounts and starting opening balances</div>
              </div>
              <button className="btn-close" onClick={() => { setIsManageBanksModalOpen(false); setEditingBankId(null); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem', maxHeight: '280px', overflowY: 'auto', marginTop: '0.75rem' }}>
              {banks.length === 0 && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No banks added yet.</p>}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {banks.map(bank => (
                  <li key={bank.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.65rem 0.75rem', borderBottom: '1px solid #f1f5f9', background: editingBankId === bank.id ? '#f8fafc' : 'transparent', borderRadius: '8px' }}>
                    {editingBankId === bank.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input 
                          type="text" 
                          value={editBankName} 
                          onChange={e => setEditBankName(e.target.value)} 
                          placeholder="Bank Name"
                          style={{ flex: '1 1 140px', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} 
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Opening:</span>
                          <input 
                            type="number" 
                            value={editBankOpening} 
                            onChange={e => setEditBankOpening(e.target.value)} 
                            placeholder="Opening PKR"
                            step="0.01"
                            style={{ width: '100px', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} 
                          />
                        </div>
                        <button type="button" className="exp-btn-primary" onClick={() => handleSaveEditBank(bank.id)} style={{ padding: '0.35rem 0.65rem' }}>
                          <Check size={14} />
                        </button>
                        <button type="button" className="exp-btn-secondary" onClick={() => setEditingBankId(null)} style={{ padding: '0.35rem 0.65rem' }}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>{bank.name}</div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', gap: '0.75rem', marginTop: '2px' }}>
                            <span>Opening: <strong>PKR {Number(bank.opening_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                            <span>Live: <strong style={{ color: Number(bank.balance || 0) < 0 ? '#e11d48' : '#059669' }}>PKR {Number(bank.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></span>
                          </div>
                        </div>
                        <div className="action-buttons">
                          <button className="btn-icon edit-btn" onClick={() => handleStartEditBank(bank)} title="Edit Bank">
                            <Edit2 size={14} />
                          </button>
                          <button className="btn-icon delete-btn" onClick={() => handleDeleteBank(bank.id)} title="Delete Bank">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>Add New Account:</span>
              <form onSubmit={handleCreateBank} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  value={newBankName} 
                  onChange={(e) => setNewBankName(e.target.value)} 
                  placeholder="Account / Bank Name" 
                  required 
                  style={{ flex: '1 1 170px', height: '38px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem' }}
                />
                <input 
                  type="number" 
                  value={newBankOpeningBalance} 
                  onChange={(e) => setNewBankOpeningBalance(e.target.value)} 
                  placeholder="Opening PKR" 
                  step="0.01"
                  style={{ width: '120px', height: '38px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem' }}
                />
                <button type="submit" className="exp-btn-primary">Add Bank</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 9. MANAGE CATEGORIES MODAL */}
      {isManageCategoriesModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '440px', borderRadius: '12px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Manage Expense Categories</h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>Configure accounting categories for spending</div>
              </div>
              <button className="btn-close" onClick={() => setIsManageCategoriesModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem', maxHeight: '220px', overflowY: 'auto', marginTop: '0.75rem' }}>
              {categories.length === 0 && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No categories added yet.</p>}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {categories.map(category => (
                  <li key={category.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>{category.name}</span>
                    <button className="btn-icon delete-btn" onClick={() => handleDeleteCategory(category.id)} title="Delete Category">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
              <input 
                type="text" 
                value={newCategoryName} 
                onChange={(e) => setNewCategoryName(e.target.value)} 
                placeholder="New Category Name (e.g. Marketing)" 
                required 
                style={{ flex: 1, height: '38px', padding: '0 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem' }}
              />
              <button type="submit" className="exp-btn-primary">Add Category</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
