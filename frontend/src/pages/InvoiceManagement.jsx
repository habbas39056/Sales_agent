import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Plus, FileText, Eye, X, Check, Trash2, Printer, Banknote, Edit, 
  FileSpreadsheet, RefreshCw, LayoutGrid, List, RotateCcw, Copy, 
  TrendingUp, Clock, AlertCircle, CheckCircle2, DollarSign, Calendar, User, Building2, MessageSquare
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Pagination from '../components/Pagination';
import InvoiceTemplate from '../components/InvoiceTemplate';
import './InvoiceManagement.css';

export default function InvoiceManagement() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesPersons, setSalesPersons] = useState([]);
  const [banks, setBanks] = useState([]);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [salesPersonFilter, setSalesPersonFilter] = useState('All Sales Persons');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePreset, setDatePreset] = useState('All Dates');

  // View Mode: 'table' or 'cards'
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('inv_view_mode') || 'table';
  });

  // UI States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modals
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [targetInvoiceForPayment, setTargetInvoiceForPayment] = useState(null);

  // Payment Form State
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    bank: '',
    transaction_id: '',
    notes: ''
  });

  // Store View Mode preference
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('inv_view_mode', mode);
  };

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
      const now = new Date();
      const firstday = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().slice(0, 10);
      const lastday = new Date(now.setDate(now.getDate() - now.getDay() + 6)).toISOString().slice(0, 10);
      setFromDate(firstday);
      setToDate(lastday);
    } else if (datePreset === 'This Month') {
      const now = new Date();
      const firstday = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastday = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      setFromDate(firstday);
      setToDate(lastday);
    } else if (datePreset === 'This Quarter') {
      const now = new Date();
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const firstday = new Date(now.getFullYear(), quarterMonth, 1).toISOString().slice(0, 10);
      const lastday = new Date(now.getFullYear(), quarterMonth + 3, 0).toISOString().slice(0, 10);
      setFromDate(firstday);
      setToDate(lastday);
    }
  }, [datePreset]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let queryParams = '';
      if (user) {
        queryParams = `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }

      const [invRes, cliRes, projRes, prodRes, salesRes, bankRes] = await Promise.all([
        axios.get(`/api/invoices${queryParams}`),
        axios.get(`/api/clients${queryParams}`),
        axios.get('/api/projects'),
        axios.get('/api/products'),
        axios.get('/api/users/specialists'),
        axios.get('/api/banks')
      ]);
      setInvoices(invRes.data || []);
      setClients(cliRes.data || []);
      setProjects(projRes.data || []);
      setProducts(prodRes.data || []);
      setSalesPersons(salesRes.data || []);
      setBanks(bankRes.data || []);
    } catch (error) {
      console.error('Failed to fetch invoice data:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Open Preview Modal
  const openPreview = async (id) => {
    try {
      const res = await axios.get(`/api/invoices/${id}`);
      setPreviewInvoice(res.data);
    } catch (error) {
      console.error('Failed to load invoice preview:', error);
      alert('Failed to load invoice preview details');
    }
  };

  // Open Payment Modal directly
  const openPaymentModal = (invoice) => {
    const target = invoice || previewInvoice;
    if (!target) return;
    setTargetInvoiceForPayment(target);
    const curBal = Number(target.balance !== undefined && target.balance !== null ? target.balance : target.amount);
    setPaymentData({
      amount: curBal > 0 ? curBal : '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Bank Transfer',
      bank: banks.length > 0 ? banks[0].name : '',
      transaction_id: '',
      notes: ''
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentChange = (e) => {
    setPaymentData({ ...paymentData, [e.target.name]: e.target.value });
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const target = targetInvoiceForPayment || previewInvoice;
    if (!target) return;

    const enteredAmount = parseFloat(paymentData.amount);
    if (!paymentData.amount || isNaN(enteredAmount) || enteredAmount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    const currentBalance = parseFloat(target.balance ?? Math.max(0, (target.amount || 0) - (target.payments || []).reduce((sum, p) => sum + (parseFloat(p?.amount) || 0), 0)));

    if (enteredAmount > (currentBalance + 0.01)) {
      alert(`Payment amount (PKR ${enteredAmount.toFixed(2)}) cannot exceed the remaining balance (PKR ${currentBalance.toFixed(2)}).`);
      return;
    }

    try {
      await axios.post(`/api/invoices/${target.id}/payments`, paymentData);
      setIsPaymentModalOpen(false);
      // Refresh the invoice preview data if currently open
      if (previewInvoice && previewInvoice.id === target.id) {
        openPreview(target.id);
      }
      // Refresh list
      fetchData();
    } catch (error) {
      console.error('Failed to record payment:', error);
      alert(error.response?.data?.error || 'Error recording payment.');
    }
  };

  const handleDeleteInvoice = async (id) => {
    if (window.confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
      try {
        await axios.delete(`/api/invoices/${id}`);
        if (previewInvoice && previewInvoice.id === id) {
          setPreviewInvoice(null);
        }
        fetchData();
      } catch (error) {
        console.error('Failed to delete invoice:', error);
        alert(error.response?.data?.error || 'Failed to delete invoice');
      }
    }
  };

  // Copy Invoice Number
  const handleCopyInvoiceNumber = (num, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(num);
    setCopiedId(num);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Reset Filters 1-click
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('All Statuses');
    setSalesPersonFilter('All Sales Persons');
    setDatePreset('All Dates');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  // KPI Calculations across entire dataset
  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalReceivable = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let paidCount = 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    invoices.forEach(inv => {
      const amt = Number(inv.amount || 0);
      const bal = Number(inv.balance !== undefined && inv.balance !== null ? inv.balance : amt);
      const paid = Math.max(0, amt - bal);

      totalInvoiced += amt;
      totalCollected += paid;
      totalReceivable += bal;

      const isOverdue = bal > 0 && (
        inv.status === 'Overdue' || 
        (inv.due_date && new Date(inv.due_date).toISOString().slice(0, 10) < todayStr)
      );

      if (isOverdue) {
        overdueCount++;
        overdueAmount += bal;
      }

      if (bal <= 0 || inv.status === 'Paid') {
        paidCount++;
      }
    });

    return {
      totalInvoiced,
      totalCollected,
      totalReceivable,
      overdueCount,
      overdueAmount,
      paidCount,
      totalCount: invoices.length
    };
  }, [invoices]);

  // KPI Card click handles instant filter
  const handleKpiFilter = (type) => {
    setCurrentPage(1);
    if (type === 'all') {
      setStatusFilter('All Statuses');
    } else if (type === 'paid') {
      setStatusFilter('Paid');
    } else if (type === 'unpaid') {
      setStatusFilter('Unpaid');
    } else if (type === 'overdue') {
      setStatusFilter('Overdue');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      alert('No invoices to export!');
      return;
    }

    const wb = XLSX.utils.book_new();

    const invoiceData = filteredInvoices.map(inv => ({
      'Invoice #': inv.invoice_number,
      'Total Amount': Number(inv.amount || 0),
      'Balance Due': Number(inv.balance !== undefined && inv.balance !== null ? inv.balance : 0),
      'Collected': Math.max(0, Number(inv.amount || 0) - Number(inv.balance || 0)),
      'Date': inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-GB') : '',
      'Due Date': inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : '',
      'Customer': inv.client_name || 'N/A',
      'Business Name': inv.business_name || '-',
      'Sales Person': inv.agent_name || 'Unassigned',
      'Project': inv.project_title || 'Direct Billing',
      'Status': inv.status || 'Unpaid'
    }));

    const ws = XLSX.utils.json_to_sheet(invoiceData);
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Adwise_Invoices_Export_${dateStr}.xlsx`);
  };

  // Export Directory PDF Statement
  const handleExportDirectoryPDF = () => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      alert('No invoices to export!');
      return;
    }
    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');
      
      // Header & branding
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("Adwise Sales - Invoices & Billing Directory Statement", 40, 45);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated: ${new Date().toLocaleDateString('en-GB')} | Total Records: ${filteredInvoices.length} | Status Filter: ${statusFilter} | Sales Agent: ${salesPersonFilter}`,
        40,
        62
      );

      const tableColumns = [
        "Invoice #", "Customer", "Business", "Project", "Sales Agent", "Issue Date", "Due Date", "Amount (PKR)", "Balance (PKR)", "Status"
      ];

      const tableRows = filteredInvoices.map(inv => [
        inv.invoice_number || `INV-${inv.id}`,
        inv.client_name || '-',
        inv.business_name || '-',
        inv.project_title || 'Direct Billing',
        inv.agent_name || 'Unassigned',
        inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-GB') : '-',
        inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : '-',
        Number(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        Number(inv.balance !== undefined && inv.balance !== null ? inv.balance : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        inv.status || 'Unpaid'
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
          cellPadding: 6,
          valign: 'middle'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 80 },
          7: { halign: 'right', fontStyle: 'bold' },
          8: { halign: 'right', fontStyle: 'bold' },
          9: { halign: 'center' }
        },
        didDrawPage: () => {
          const str = `Page ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(str, doc.internal.pageSize.width - 60, doc.internal.pageSize.height - 20);
        }
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Adwise_Invoices_Directory_Statement_${dateStr}.pdf`);
    } catch (err) {
      console.error('Error generating PDF statement:', err);
      alert('Failed to generate PDF statement.');
    }
  };

  // Filter Invoices
  const filteredInvoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const todayStr = new Date().toISOString().slice(0, 10);

    return invoices.filter(inv => {
      // Multi-field search
      const matchesSearch = !term || 
        (inv.invoice_number && inv.invoice_number.toLowerCase().includes(term)) || 
        (inv.client_name && inv.client_name.toLowerCase().includes(term)) || 
        (inv.business_name && inv.business_name.toLowerCase().includes(term)) || 
        (inv.agent_name && inv.agent_name.toLowerCase().includes(term)) || 
        (inv.project_title && inv.project_title.toLowerCase().includes(term)) || 
        (inv.amount && inv.amount.toString().includes(term)) || 
        (inv.balance && inv.balance.toString().includes(term)) || 
        (inv.id && inv.id.toString().includes(term));

      // Status filter
      let matchesStatus = true;
      const bal = Number(inv.balance !== undefined && inv.balance !== null ? inv.balance : inv.amount);
      const amt = Number(inv.amount || 0);
      const isOverdue = bal > 0 && (
        inv.status === 'Overdue' || 
        (inv.due_date && new Date(inv.due_date).toISOString().slice(0, 10) < todayStr)
      );

      if (statusFilter === 'Paid') {
        matchesStatus = (bal <= 0 || inv.status === 'Paid');
      } else if (statusFilter === 'Unpaid') {
        matchesStatus = (bal > 0 && !isOverdue);
      } else if (statusFilter === 'Overdue') {
        matchesStatus = isOverdue;
      } else if (statusFilter === 'Partially Paid') {
        matchesStatus = (bal > 0 && bal < amt);
      }

      // Sales person filter
      const matchesSalesPerson = salesPersonFilter === 'All Sales Persons' || inv.agent_name === salesPersonFilter;

      // Date range filter
      let matchesDate = true;
      if (inv.issue_date) {
        const invDateStr = new Date(inv.issue_date).toISOString().slice(0, 10);
        if (fromDate && invDateStr < fromDate) matchesDate = false;
        if (toDate && invDateStr > toDate) matchesDate = false;
      }

      return matchesSearch && matchesStatus && matchesSalesPerson && matchesDate;
    });
  }, [invoices, searchTerm, statusFilter, salesPersonFilter, fromDate, toDate]);

  // Pagination Slice
  const currentInvoices = useMemo(() => {
    return filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredInvoices, currentPage, itemsPerPage]);

  // Helper for overdue display
  const getInvoiceDueStatus = (dueDate, balance) => {
    if (!dueDate || Number(balance) <= 0) return { isOverdue: false, text: '' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return { isOverdue: true, text: `${diffDays}d overdue` };
    }
    return { isOverdue: false, text: '' };
  };

  // Helper for client initials
  const getInitials = (name) => {
    if (!name) return 'IN';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleSendWhatsAppInvoice = async (invoiceId, invoiceNumber) => {
    if (!window.confirm(`Send official WhatsApp due notice for Invoice #${invoiceNumber}?`)) return;
    try {
      const res = await axios.post(`/api/invoices/${invoiceId}/send-whatsapp`);
      alert(res.data?.message || 'WhatsApp notice sent successfully!');
    } catch (err) {
      console.error('Failed to send WhatsApp alert:', err);
      alert(err.response?.data?.error || 'Failed to dispatch WhatsApp alert.');
    }
  };

  const handlePrintInvoice = () => {
    const printableElement = document.getElementById('printable-invoice');
    if (!printableElement) {
      window.print();
      return;
    }

    const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = '0';
    iframe.id = 'invoice-print-frame';

    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow.document;
    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${previewInvoice?.invoice_number || 'INV'}</title>
          ${styleTags}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            * {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              width: 100% !important;
              height: auto !important;
            }
            .inv-tpl-container {
              max-width: 100% !important;
              width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
            }
            .inv-tpl-page-1 {
              display: block !important;
              page-break-after: always !important;
              break-after: page !important;
              margin-bottom: 0 !important;
            }
            .terms-page-break, .inv-tpl-terms-page {
              display: block !important;
              page-break-before: always !important;
              break-before: page !important;
              margin-top: 0 !important;
              padding-top: 5mm !important;
            }
            .print-hide {
              display: none !important;
            }
          </style>
        </head>
        <body>
          ${printableElement.outerHTML}
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Iframe print fallback:', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    }, 300);
  };

  return (
    <div className="inv-main-container">
      {/* 1. TOP HEADER & RIGHT-ALIGNED ACTIONS */}
      <div className="inv-header">
        <div className="inv-header-title-area">
          <div className="inv-header-title-row">
            <h1 className="inv-header-title">Invoice Management</h1>
            <span className="inv-header-badge">
              {filteredInvoices.length} {filteredInvoices.length === 1 ? 'Invoice' : 'Invoices'}
            </span>
          </div>
          <p className="inv-header-sub">
            Track billing lifecycles, monitor collections, handle receipts, and manage accounts receivable
          </p>
        </div>

        {/* Right-aligned action buttons */}
        <div className="inv-header-actions">
          <button 
            className={`inv-btn-secondary inv-btn-refresh ${isRefreshing ? 'spinning' : ''}`}
            onClick={fetchData} 
            title="Refresh Invoices Data"
          >
            <RefreshCw size={15} color="#475569" /> Refresh
          </button>
          <button 
            className="inv-btn-secondary" 
            onClick={handleExportDirectoryPDF} 
            title="Export PDF Directory Statement"
          >
            <FileText size={15} color="#e11d48" /> PDF Statement
          </button>
          <button 
            className="inv-btn-secondary" 
            onClick={handleExportExcel} 
            title="Export Invoices as Excel Spreadsheet"
          >
            <FileSpreadsheet size={15} color="#10b981" /> Export Excel
          </button>
          <button 
            className="inv-btn-primary" 
            onClick={() => navigate('/invoices/new')} 
            title="Create New Customer Invoice"
          >
            <Plus size={16} /> Create Invoice
          </button>
        </div>
      </div>

      {/* 2. INTERACTIVE EXECUTIVE FINANCIAL KPI METRIC CARDS */}
      <div className="inv-kpi-grid">
        {/* Total Invoiced */}
        <div 
          className={`inv-kpi-card ${statusFilter === 'All Statuses' ? 'active-kpi' : ''}`}
          onClick={() => handleKpiFilter('all')}
          title="Click to view all invoices"
        >
          <div className="inv-kpi-top">
            <span className="inv-kpi-label">Total Invoiced</span>
            <div className="inv-kpi-icon-box" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="inv-kpi-value">
            PKR {stats.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="inv-kpi-subtext">
            <TrendingUp size={13} color="#4338ca" />
            <span>{stats.totalCount} total billed accounts</span>
          </div>
        </div>

        {/* Total Collected */}
        <div 
          className={`inv-kpi-card ${statusFilter === 'Paid' ? 'active-kpi' : ''}`}
          onClick={() => handleKpiFilter('paid')}
          title="Click to filter Paid invoices"
        >
          <div className="inv-kpi-top">
            <span className="inv-kpi-label">Total Collected</span>
            <div className="inv-kpi-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="inv-kpi-value" style={{ color: '#059669' }}>
            PKR {stats.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="inv-kpi-subtext">
            <Check size={13} color="#059669" />
            <span>{stats.paidCount} settled in full ({stats.totalInvoiced > 0 ? Math.round((stats.totalCollected / stats.totalInvoiced) * 100) : 0}%)</span>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div 
          className={`inv-kpi-card ${statusFilter === 'Unpaid' ? 'active-kpi' : ''}`}
          onClick={() => handleKpiFilter('unpaid')}
          title="Click to filter Unpaid invoices"
        >
          <div className="inv-kpi-top">
            <span className="inv-kpi-label">Outstanding Balance</span>
            <div className="inv-kpi-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="inv-kpi-value" style={{ color: '#d97706' }}>
            PKR {stats.totalReceivable.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="inv-kpi-subtext">
            <span>Pending collection receivable</span>
          </div>
        </div>

        {/* Overdue Receivables */}
        <div 
          className={`inv-kpi-card ${statusFilter === 'Overdue' ? 'active-kpi' : ''}`}
          onClick={() => handleKpiFilter('overdue')}
          title="Click to filter Overdue invoices"
        >
          <div className="inv-kpi-top">
            <span className="inv-kpi-label">Overdue Invoices</span>
            <div className="inv-kpi-icon-box" style={{ background: '#ffe4e6', color: '#e11d48' }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="inv-kpi-value" style={{ color: '#e11d48' }}>
            {stats.overdueCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>overdue</span>
          </div>
          <div className="inv-kpi-subtext" style={{ color: '#e11d48' }}>
            <span>PKR {stats.overdueAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} past due</span>
          </div>
        </div>
      </div>

      {/* 3. CONTROLS, SEARCH & ADVANCED FILTERS TOOLBAR */}
      <div className="inv-panel">
        <div className="inv-toolbar">
          <div className="inv-toolbar-row">
            {/* Search Input */}
            <div className="inv-search-wrapper">
              <Search size={16} className="inv-search-icon" />
              <input 
                type="text" 
                className="inv-search-input"
                placeholder="Search inv #, client, business, project, amount..." 
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchTerm && (
                <button 
                  className="inv-search-clear"
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Dropdowns & View Mode */}
            <div className="inv-filters-group">
              {/* Status Filter */}
              <select 
                className="inv-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All Statuses">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Overdue">Overdue</option>
              </select>

              {/* Sales Person Filter */}
              <select 
                className="inv-select"
                value={salesPersonFilter}
                onChange={(e) => {
                  setSalesPersonFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ maxWidth: '175px' }}
              >
                <option value="All Sales Persons">All Sales Persons</option>
                {salesPersons.map(sp => (
                  <option key={sp.id} value={sp.full_name}>{sp.full_name}</option>
                ))}
              </select>

              {/* Date Presets */}
              <select 
                className="inv-select"
                value={datePreset}
                onChange={e => {
                  setDatePreset(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All Dates">All Dates</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="This Quarter">This Quarter</option>
                <option value="Custom">Custom Range</option>
              </select>

              {/* Date Pickers */}
              <div className="inv-date-group">
                <input 
                  type="date" 
                  className="inv-date-input"
                  value={fromDate} 
                  onChange={e => {
                    setFromDate(e.target.value);
                    setDatePreset('Custom');
                    setCurrentPage(1);
                  }}
                  title="From Issue Date"
                />
                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>to</span>
                <input 
                  type="date" 
                  className="inv-date-input"
                  value={toDate} 
                  onChange={e => {
                    setToDate(e.target.value);
                    setDatePreset('Custom');
                    setCurrentPage(1);
                  }}
                  title="To Issue Date"
                />
              </div>

              {/* 1-Click Reset Button */}
              {(searchTerm || statusFilter !== 'All Statuses' || salesPersonFilter !== 'All Sales Persons' || datePreset !== 'All Dates' || fromDate || toDate) && (
                <button 
                  className="inv-reset-btn"
                  onClick={handleResetFilters}
                  title="Reset all search queries and filters"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              )}

              {/* Dual View Mode Toggle */}
              <div className="inv-view-toggle">
                <button 
                  className={`inv-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('table')}
                  title="Enterprise Table View"
                >
                  <List size={14} /> Table
                </button>
                <button 
                  className={`inv-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('cards')}
                  title="Visual Cards Grid View"
                >
                  <LayoutGrid size={14} /> Cards
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. MAIN INVOICES PRESENTATION: TABLE OR CARDS */}
        {viewMode === 'table' ? (
          <div className="inv-table-wrapper">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>INVOICE #</th>
                  <th>CUSTOMER & BUSINESS</th>
                  <th>PROJECT</th>
                  <th>SALES AGENT</th>
                  <th>ISSUE / DUE DATE</th>
                  <th>AMOUNT</th>
                  <th>BALANCE DUE</th>
                  <th>PROGRESS</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {currentInvoices.map(inv => {
                  const amt = Number(inv.amount || 0);
                  const bal = Number(inv.balance !== undefined && inv.balance !== null ? inv.balance : amt);
                  const paid = Math.max(0, amt - bal);
                  const pct = amt > 0 ? Math.min(100, Math.round((paid / amt) * 100)) : 0;
                  const dueInfo = getInvoiceDueStatus(inv.due_date, bal);
                  const isOverdue = dueInfo.isOverdue || inv.status === 'Overdue';

                  return (
                    <tr key={inv.id} className={isOverdue ? 'is-overdue' : ''}>
                      {/* Invoice # */}
                      <td>
                        <div 
                          className="inv-num-cell"
                          onClick={() => openPreview(inv.id)}
                          title="Click to Preview Invoice"
                        >
                          <span>{inv.invoice_number}</span>
                          <button 
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                            onClick={(e) => handleCopyInvoiceNumber(inv.invoice_number, e)}
                            title="Copy Invoice #"
                          >
                            {copiedId === inv.invoice_number ? (
                              <Check size={13} color="#10b981" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Customer & Business */}
                      <td>
                        <div className="inv-client-cell">
                          <div className="inv-avatar">
                            {getInitials(inv.client_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{inv.client_name || 'N/A'}</div>
                            {inv.business_name && (
                              <div className="inv-business-tag">
                                {inv.business_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Project */}
                      <td>
                        <span style={{ fontWeight: 500, color: inv.project_title ? '#334155' : '#94a3b8' }}>
                          {inv.project_title || 'Direct Billing'}
                        </span>
                      </td>

                      {/* Sales Agent */}
                      <td>
                        <span style={{ color: '#4f46e5', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <User size={13} color="#6366f1" /> {inv.agent_name || 'Unassigned'}
                        </span>
                      </td>

                      {/* Issue / Due Date */}
                      <td>
                        <div>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-GB') : '-'}</div>
                        {inv.due_date && (
                          <div className={`inv-due-badge ${isOverdue ? 'overdue' : 'normal'}`}>
                            Due: {new Date(inv.due_date).toLocaleDateString('en-GB')}
                            {dueInfo.isOverdue && <span>({dueInfo.text})</span>}
                          </div>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td>
                        <strong style={{ color: '#0f172a' }}>
                          PKR {amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </td>

                      {/* Balance Due */}
                      <td>
                        <strong style={{ color: bal > 0 ? '#e11d48' : '#10b981' }}>
                          PKR {bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </td>

                      {/* Progress Bar */}
                      <td>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                          {pct}% paid
                        </div>
                        <div className="inv-progress-track">
                          <div 
                            className="inv-progress-fill" 
                            style={{ 
                              width: `${pct}%`,
                              background: pct === 100 ? '#10b981' : (isOverdue ? '#e11d48' : '#3b82f6')
                            }} 
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`inv-status-pill ${inv.status ? inv.status.toLowerCase() : 'unpaid'}`}>
                          {inv.status || 'Unpaid'}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-icon view-btn" 
                            onClick={() => openPreview(inv.id)} 
                            title="Preview & Print Invoice"
                          >
                            <Eye size={17} />
                          </button>
                          {bal > 0 && (
                            <button 
                              className="btn-icon" 
                              style={{ color: '#059669' }}
                              onClick={() => openPaymentModal(inv)} 
                              title="Record Customer Payment"
                            >
                              <Banknote size={17} />
                            </button>
                          )}
                          <button 
                            className="btn-icon edit-btn" 
                            onClick={() => navigate(`/invoices/edit/${inv.id}`)} 
                            title="Edit Invoice"
                          >
                            <Edit size={17} />
                          </button>
                          <button 
                            className="btn-icon delete-btn" 
                            onClick={() => handleDeleteInvoice(inv.id)} 
                            title="Delete Invoice"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {currentInvoices.length === 0 && (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                        <FileText size={36} color="#cbd5e1" />
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>No invoices matching your criteria</div>
                        <div style={{ fontSize: '0.85rem' }}>Try clearing your search query or adjusting your filters</div>
                        <button 
                          onClick={handleResetFilters} 
                          className="inv-btn-secondary" 
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
          /* Cards Grid View */
          <div className="inv-cards-grid">
            {currentInvoices.map(inv => {
              const amt = Number(inv.amount || 0);
              const bal = Number(inv.balance !== undefined && inv.balance !== null ? inv.balance : amt);
              const paid = Math.max(0, amt - bal);
              const pct = amt > 0 ? Math.min(100, Math.round((paid / amt) * 100)) : 0;
              const dueInfo = getInvoiceDueStatus(inv.due_date, bal);
              const isOverdue = dueInfo.isOverdue || inv.status === 'Overdue';

              return (
                <div key={inv.id} className={`inv-card ${isOverdue ? 'is-overdue' : ''}`}>
                  {/* Card Header */}
                  <div className="inv-card-header">
                    <div className="inv-card-num" onClick={() => openPreview(inv.id)} style={{ cursor: 'pointer' }}>
                      <span>{inv.invoice_number}</span>
                      <button 
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                        onClick={(e) => handleCopyInvoiceNumber(inv.invoice_number, e)}
                        title="Copy Invoice #"
                      >
                        {copiedId === inv.invoice_number ? (
                          <Check size={13} color="#10b981" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>

                    <span className={`inv-status-pill ${inv.status ? inv.status.toLowerCase() : 'unpaid'}`}>
                      {inv.status || 'Unpaid'}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="inv-card-body">
                    <div className="inv-card-client-row">
                      <div className="inv-avatar">
                        {getInitials(inv.client_name)}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {inv.client_name || 'N/A'}
                        </div>
                        {inv.business_name && (
                          <div className="inv-business-tag" style={{ marginTop: '2px' }}>
                            {inv.business_name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Building2 size={13} color="#94a3b8" />
                      <span>{inv.project_title || 'Direct Billing'}</span>
                    </div>

                    {/* Financials Box */}
                    <div className="inv-card-financials">
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Billed Amount</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                          PKR {amt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Balance Due</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: bal > 0 ? '#e11d48' : '#10b981' }}>
                          PKR {bal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                        <span>Payment Progress</span>
                        <span>{pct}% collected</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${pct}%`, 
                            height: '100%', 
                            background: pct === 100 ? '#10b981' : (isOverdue ? '#e11d48' : '#3b82f6'),
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                          }} 
                        />
                      </div>
                    </div>

                    {/* Dates & Agent */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={13} color="#94a3b8" />
                        <span>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-GB') : '-'}</span>
                      </div>
                      <div>
                        {inv.due_date && (
                          <span className={`inv-due-badge ${isOverdue ? 'overdue' : 'normal'}`}>
                            Due: {new Date(inv.due_date).toLocaleDateString('en-GB')} {dueInfo.text && `(${dueInfo.text})`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="inv-card-footer">
                    <span style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <User size={12} /> {inv.agent_name || 'Unassigned'}
                    </span>

                    <div className="action-buttons">
                      <button 
                        className="btn-icon view-btn" 
                        onClick={() => openPreview(inv.id)} 
                        title="Preview & Print Invoice"
                      >
                        <Eye size={16} />
                      </button>
                      {bal > 0 && (
                        <button 
                          className="btn-icon" 
                          style={{ color: '#059669' }}
                          onClick={() => openPaymentModal(inv)} 
                          title="Record Payment"
                        >
                          <Banknote size={16} />
                        </button>
                      )}
                      <button 
                        className="btn-icon" 
                        style={{ color: '#16a34a' }}
                        onClick={() => handleSendWhatsAppInvoice(inv.id, inv.invoice_number)} 
                        title="Send Due Notice via WhatsApp"
                      >
                        <MessageSquare size={16} />
                      </button>
                      <button 
                        className="btn-icon edit-btn" 
                        onClick={() => navigate(`/invoices/edit/${inv.id}`)} 
                        title="Edit Invoice"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn-icon delete-btn" 
                        onClick={() => handleDeleteInvoice(inv.id)} 
                        title="Delete Invoice"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {currentInvoices.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <FileText size={36} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>No invoices found</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>Try clearing filters or adjusting your date search</div>
                <button 
                  onClick={handleResetFilters} 
                  className="inv-btn-secondary" 
                  style={{ margin: '1rem auto 0 auto' }}
                >
                  <RotateCcw size={14} /> Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {filteredInvoices.length > 0 && (
          <div style={{ marginTop: '1.25rem' }}>
            <Pagination 
              currentPage={currentPage}
              totalItems={filteredInvoices.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 5. PREVIEW MODAL WITH STRICTLY PRESERVED PRINTABLE INVOICE & PDF LAYOUT */}
      {previewInvoice && (
        <div className="modal-overlay">
          <div className="modal-content preview-modal">
            <div className="modal-header print-hide" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem'}}>
              <h2 style={{margin: 0}}>Invoice Preview</h2>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                {previewInvoice.status !== 'Paid' && (
                  <button className="btn-success" onClick={() => openPaymentModal(previewInvoice)}>
                    <Banknote size={18} style={{marginRight:'0.5rem', verticalAlign:'middle'}}/> Record Payment
                  </button>
                )}
                <button 
                  className="btn" 
                  style={{backgroundColor: '#e11d48', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600'}} 
                  onClick={handlePrintInvoice}
                  title="Print or Save as PDF"
                >
                  <Printer size={18} /> Print / PDF
                </button>
                <button className="btn" style={{backgroundColor: '#e2e8f0', color: '#1e293b', padding: '0.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center'}} onClick={() => setPreviewInvoice(null)}><X size={20} /></button>
              </div>
            </div>
            
            {/* NEW MODERN INVOICE TEMPLATE */}
            <InvoiceTemplate invoice={previewInvoice} />
          </div>
        </div>
      )}

      {/* 6. MODERN RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && targetInvoiceForPayment && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '440px', borderRadius: '12px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Record Payment</h2>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>Apply incoming transaction to customer balance</div>
              </div>
              <button 
                className="btn-close" 
                onClick={() => setIsPaymentModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ marginTop: '1rem' }}>
              {/* Context info box */}
              <div className="inv-pay-modal-context">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748b' }}>Invoice Number:</span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{targetInvoiceForPayment.invoice_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748b' }}>Customer:</span>
                  <strong style={{ color: '#0f172a' }}>{targetInvoiceForPayment.client_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingTop: '0.35rem', borderTop: '1px dashed #e2e8f0' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Remaining Balance:</span>
                  <strong style={{ color: '#e11d48' }}>
                    PKR {Number(targetInvoiceForPayment.balance !== undefined && targetInvoiceForPayment.balance !== null ? targetInvoiceForPayment.balance : targetInvoiceForPayment.amount).toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Amount Received Input */}
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Amount Received (PKR) *
                </label>
                <input 
                  type="number" 
                  name="amount" 
                  value={paymentData.amount} 
                  onChange={handlePaymentChange} 
                  min="0.01" 
                  step="0.01" 
                  max={targetInvoiceForPayment?.balance} 
                  required 
                  style={{ width: '100%', height: '40px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem', color: '#0f172a', boxSizing: 'border-box' }}
                />

                {/* Quick-fill amount chips */}
                <div className="inv-pay-chips">
                  <button 
                    type="button" 
                    className="inv-pay-chip"
                    onClick={() => setPaymentData({ ...paymentData, amount: targetInvoiceForPayment.balance })}
                  >
                    Pay Full Balance
                  </button>
                  <button 
                    type="button" 
                    className="inv-pay-chip"
                    onClick={() => setPaymentData({ ...paymentData, amount: (Number(targetInvoiceForPayment.balance) * 0.5).toFixed(2) })}
                  >
                    50% Balance
                  </button>
                  <button 
                    type="button" 
                    className="inv-pay-chip"
                    onClick={() => setPaymentData({ ...paymentData, amount: (Number(targetInvoiceForPayment.balance) * 0.25).toFixed(2) })}
                  >
                    25% Balance
                  </button>
                </div>
              </div>

              {/* Payment Date */}
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Payment Date *
                </label>
                <input 
                  type="date" 
                  name="payment_date" 
                  value={paymentData.payment_date} 
                  onChange={handlePaymentChange} 
                  required 
                  style={{ width: '100%', height: '40px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              {/* Payment Method */}
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Payment Method
                </label>
                <select 
                  name="payment_method" 
                  value={paymentData.payment_method} 
                  onChange={handlePaymentChange}
                  style={{ width: '100%', height: '40px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#0f172a', boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Bank Selection (if Bank Transfer or Cheque) */}
              {(paymentData.payment_method === 'Bank Transfer' || paymentData.payment_method === 'Cheque') && (
                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Select Receiving Bank *
                  </label>
                  <select 
                    name="bank" 
                    value={paymentData.bank || ''} 
                    onChange={handlePaymentChange} 
                    required
                    style={{ width: '100%', height: '40px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#0f172a', boxSizing: 'border-box', cursor: 'pointer' }}
                  >
                    <option value="">- Choose a Bank -</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Transaction ID */}
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Transaction ID / Ref # (Optional)
                </label>
                <input 
                  type="text" 
                  name="transaction_id" 
                  placeholder="e.g. TRX-982342"
                  value={paymentData.transaction_id || ''} 
                  onChange={handlePaymentChange} 
                  style={{ width: '100%', height: '40px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Notes (Optional)
                </label>
                <input 
                  type="text" 
                  name="notes" 
                  placeholder="Additional payment comments..."
                  value={paymentData.notes} 
                  onChange={handlePaymentChange} 
                  style={{ width: '100%', height: '40px', padding: '0 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#0f172a', boxSizing: 'border-box' }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button 
                  type="button" 
                  className="inv-btn-secondary" 
                  onClick={() => setIsPaymentModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="inv-btn-primary"
                  style={{ background: '#10b981' }}
                >
                  <Check size={16} /> Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
