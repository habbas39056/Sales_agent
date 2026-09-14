import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Plus, FileText, Eye, X, Check, Trash2, Printer, Edit, 
  FileSpreadsheet, RefreshCw, LayoutGrid, List, RotateCcw, Copy, 
  TrendingUp, Clock, AlertCircle, CheckCircle2, XCircle, DollarSign, 
  Calendar, User, Building2, Send, FileCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Pagination from '../components/Pagination';
import './QuotationsList.css';

export default function QuotationsList() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesPersons, setSalesPersons] = useState([]);
  const [banks, setBanks] = useState([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePreset, setDatePreset] = useState('All Dates');

  // View Mode: 'table' or 'cards'
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('quote_view_mode') || 'table';
  });

  // UI States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Preview Modal
  const [previewQuotation, setPreviewQuotation] = useState(null);

  // Store View Mode preference
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('quote_view_mode', mode);
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

      const [quoteRes, cliRes, projRes, prodRes, salesRes, bankRes] = await Promise.all([
        axios.get(`/api/quotations${queryParams}`),
        axios.get(`/api/clients${queryParams}`),
        axios.get('/api/projects'),
        axios.get('/api/products'),
        axios.get('/api/users/specialists'),
        axios.get('/api/banks')
      ]);
      setQuotations(quoteRes.data || []);
      setClients(cliRes.data || []);
      setProjects(projRes.data || []);
      setProducts(prodRes.data || []);
      setSalesPersons(salesRes.data || []);
      setBanks(bankRes.data || []);
    } catch (error) {
      console.error('Failed to fetch quotation data:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Open Preview Modal
  const openPreview = async (id) => {
    try {
      const res = await axios.get(`/api/quotations/${id}`);
      setPreviewQuotation(res.data);
    } catch (error) {
      console.error('Failed to load quotation preview:', error);
      alert('Failed to load quotation preview details');
    }
  };

  // Update Quotation Status
  const updateQuotationStatus = async (id, newStatus, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.put(`/api/quotations/${id}/status`, { status: newStatus });
      if (previewQuotation && previewQuotation.id === id) {
        setPreviewQuotation({ ...previewQuotation, status: newStatus });
      }
      fetchData();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert(error.response?.data?.error || 'Failed to update quotation status');
    }
  };

  // Delete Quotation
  const handleDeleteQuotation = async (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this quotation? This action cannot be undone.")) {
      try {
        await axios.delete(`/api/quotations/${id}`);
        if (previewQuotation && previewQuotation.id === id) {
          setPreviewQuotation(null);
        }
        fetchData();
      } catch (error) {
        console.error('Failed to delete quotation:', error);
        alert(error.response?.data?.error || 'Failed to delete quotation');
      }
    }
  };

  // Copy Quotation Number
  const handleCopyQuoteNumber = (num, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(num);
    setCopiedId(num);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Reset Filters 1-click
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('All Statuses');
    setDatePreset('All Dates');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  // Calculate Pipeline KPIs
  const stats = useMemo(() => {
    let totalValue = 0;
    let acceptedValue = 0;
    let acceptedCount = 0;
    let sentValue = 0;
    let sentCount = 0;
    let draftValue = 0;
    let draftCount = 0;
    let rejectedCount = 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    quotations.forEach(q => {
      const amt = Number(q.amount || 0);
      totalValue += amt;

      const isExpired = q.expiry_date && new Date(q.expiry_date).toISOString().slice(0, 10) < todayStr && q.status !== 'Accepted';

      if (q.status === 'Accepted') {
        acceptedValue += amt;
        acceptedCount++;
      } else if (q.status === 'Sent' && !isExpired) {
        sentValue += amt;
        sentCount++;
      } else if (q.status === 'Draft') {
        draftValue += amt;
        draftCount++;
      } else if (q.status === 'Rejected' || isExpired) {
        rejectedCount++;
      }
    });

    return {
      totalValue,
      totalCount: quotations.length,
      acceptedValue,
      acceptedCount,
      sentValue,
      sentCount,
      draftValue,
      draftCount,
      rejectedCount
    };
  }, [quotations]);

  // Handle 1-click KPI Card Filter
  const handleKpiFilter = (status) => {
    setCurrentPage(1);
    setStatusFilter(status);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredQuotations || filteredQuotations.length === 0) {
      alert('No quotations to export!');
      return;
    }

    const wb = XLSX.utils.book_new();

    const quotationData = filteredQuotations.map(q => ({
      'Quotation #': q.quotation_number,
      'Total Amount (PKR)': Number(q.amount || 0),
      'Customer': q.client_name || 'N/A',
      'Business': q.business_name || '-',
      'Issue Date': q.issue_date ? new Date(q.issue_date).toLocaleDateString('en-GB') : '',
      'Expiry Date': q.expiry_date ? new Date(q.expiry_date).toLocaleDateString('en-GB') : '',
      'Prepared By': q.creator_name || 'Unassigned',
      'Status': q.status || 'Draft'
    }));

    const ws = XLSX.utils.json_to_sheet(quotationData);
    XLSX.utils.book_append_sheet(wb, ws, 'Quotations');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Adwise_Quotations_Export_${dateStr}.xlsx`);
  };

  // Export Directory PDF Statement
  const handleExportDirectoryPDF = () => {
    if (!filteredQuotations || filteredQuotations.length === 0) {
      alert('No quotations to export!');
      return;
    }
    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');
      
      // Header & branding
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text("Adwise Sales - Quotations & Proposals Directory Statement", 40, 45);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated: ${new Date().toLocaleDateString('en-GB')} | Total Records: ${filteredQuotations.length} | Status Filter: ${statusFilter}`,
        40,
        62
      );

      const tableColumns = [
        "Quotation #", "Customer", "Business", "Prepared By", "Issue Date", "Expiry Date", "Amount (PKR)", "Status"
      ];

      const tableRows = filteredQuotations.map(q => [
        q.quotation_number || `QT-${q.id}`,
        q.client_name || '-',
        q.business_name || '-',
        q.creator_name || 'Unassigned',
        q.issue_date ? new Date(q.issue_date).toLocaleDateString('en-GB') : '-',
        q.expiry_date ? new Date(q.expiry_date).toLocaleDateString('en-GB') : '-',
        Number(q.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        q.status || 'Draft'
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
          fontSize: 8.5,
          cellPadding: 6,
          valign: 'middle'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 90 },
          6: { halign: 'right', fontStyle: 'bold' },
          7: { halign: 'center' }
        },
        didDrawPage: () => {
          const str = `Page ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(str, doc.internal.pageSize.width - 60, doc.internal.pageSize.height - 20);
        }
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Adwise_Quotations_Directory_Statement_${dateStr}.pdf`);
    } catch (err) {
      console.error('Error generating PDF statement:', err);
      alert('Failed to generate PDF statement.');
    }
  };

  // Filter Quotations
  const filteredQuotations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const todayStr = new Date().toISOString().slice(0, 10);

    return quotations.filter(q => {
      // Multi-field search
      const matchesSearch = !term || 
        (q.quotation_number && q.quotation_number.toLowerCase().includes(term)) || 
        (q.client_name && q.client_name.toLowerCase().includes(term)) || 
        (q.business_name && q.business_name.toLowerCase().includes(term)) || 
        (q.creator_name && q.creator_name.toLowerCase().includes(term)) || 
        (q.amount && q.amount.toString().includes(term)) || 
        (q.id && q.id.toString().includes(term));

      // Status filter
      let matchesStatus = true;
      const isExpired = q.expiry_date && new Date(q.expiry_date).toISOString().slice(0, 10) < todayStr && q.status !== 'Accepted';

      if (statusFilter === 'Draft') {
        matchesStatus = q.status === 'Draft';
      } else if (statusFilter === 'Sent') {
        matchesStatus = q.status === 'Sent' && !isExpired;
      } else if (statusFilter === 'Accepted') {
        matchesStatus = q.status === 'Accepted';
      } else if (statusFilter === 'Rejected') {
        matchesStatus = q.status === 'Rejected';
      } else if (statusFilter === 'Expired') {
        matchesStatus = isExpired || q.status === 'Expired';
      }

      // Date range filter
      let matchesDate = true;
      if (q.issue_date) {
        const quoteDateStr = new Date(q.issue_date).toISOString().slice(0, 10);
        if (fromDate && quoteDateStr < fromDate) matchesDate = false;
        if (toDate && quoteDateStr > toDate) matchesDate = false;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [quotations, searchTerm, statusFilter, fromDate, toDate]);

  // Pagination Slice
  const currentQuotations = useMemo(() => {
    return filteredQuotations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredQuotations, currentPage, itemsPerPage]);

  // Helper for initials
  const getInitials = (name) => {
    if (!name) return 'QT';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Helper for expiry check
  const getExpiryStatus = (expiryDate, status) => {
    if (!expiryDate || status === 'Accepted') return { isExpired: false, text: '' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { isExpired: true, text: 'Expired' };
    }
    if (diffDays === 0) {
      return { isExpired: false, text: 'Expires today' };
    }
    if (diffDays <= 3) {
      return { isExpired: false, text: `Expires in ${diffDays}d` };
    }
    return { isExpired: false, text: '' };
  };

  return (
    <div className="quote-main-container">
      {/* 1. TOP HEADER & RIGHT-ALIGNED ACTIONS */}
      <div className="quote-header">
        <div className="quote-header-title-area">
          <div className="quote-header-title-row">
            <h1 className="quote-header-title">Quotations & Proposals</h1>
            <span className="quote-header-badge">
              {filteredQuotations.length} {filteredQuotations.length === 1 ? 'Proposal' : 'Proposals'}
            </span>
          </div>
          <p className="quote-header-sub">
            Manage client proposals, monitor deal conversions, track quotes, and dispatch sales estimates
          </p>
        </div>

        {/* Right-aligned action buttons */}
        <div className="quote-header-actions">
          <button 
            className={`quote-btn-secondary quote-btn-refresh ${isRefreshing ? 'spinning' : ''}`}
            onClick={fetchData} 
            title="Refresh Quotations"
          >
            <RefreshCw size={15} color="#475569" /> Refresh
          </button>
          <button 
            className="quote-btn-secondary" 
            onClick={handleExportDirectoryPDF} 
            title="Export PDF Directory Statement"
          >
            <FileText size={15} color="#e11d48" /> PDF Statement
          </button>
          <button 
            className="quote-btn-secondary" 
            onClick={handleExportExcel} 
            title="Export Quotations as Excel Spreadsheet"
          >
            <FileSpreadsheet size={15} color="#10b981" /> Export Excel
          </button>
          <button 
            className="quote-btn-primary" 
            onClick={() => navigate('/quotations/new')} 
            title="Create New Quotation"
          >
            <Plus size={16} /> Create Quotation
          </button>
        </div>
      </div>

      {/* 2. INTERACTIVE PIPELINE KPI METRIC CARDS */}
      <div className="quote-kpi-grid">
        {/* Total Pipeline Value */}
        <div 
          className={`quote-kpi-card ${statusFilter === 'All Statuses' ? 'active-kpi' : ''}`}
          onClick={() => handleKpiFilter('All Statuses')}
          title="Click to view all quotations"
        >
          <div className="quote-kpi-top">
            <span className="quote-kpi-label">Pipeline Value</span>
            <div className="quote-kpi-icon-box" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="quote-kpi-value">
            PKR {stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="quote-kpi-subtext">
            <TrendingUp size={13} color="#4338ca" />
            <span>{stats.totalCount} total proposals created</span>
          </div>
        </div>

        {/* Won / Accepted */}
        <div 
          className={`quote-kpi-card ${statusFilter === 'Accepted' ? 'active-kpi' : ''}`}
          onClick={() => handleKpiFilter('Accepted')}
          title="Click to view Accepted proposals"
        >
          <div className="quote-kpi-top">
            <span className="quote-kpi-label">Accepted (Won)</span>
            <div className="quote-kpi-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="quote-kpi-value" style={{ color: '#059669' }}>
            PKR {stats.acceptedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="quote-kpi-subtext">
            <Check size={13} color="#059669" />
            <span>{stats.acceptedCount} deals closed ({stats.totalValue > 0 ? Math.round((stats.acceptedValue / stats.totalValue) * 100) : 0}%)</span>
          </div>
        </div>

        {/* Sent / Active */}
        <div 
          className={`quote-kpi-card ${statusFilter === 'Sent' ? 'active-kpi' : ''}`}
          onClick={() => handleKpiFilter('Sent')}
          title="Click to view Sent proposals"
        >
          <div className="quote-kpi-top">
            <span className="quote-kpi-label">Sent & Pending</span>
            <div className="quote-kpi-icon-box" style={{ background: '#f0f9ff', color: '#0284c7' }}>
              <Send size={18} />
            </div>
          </div>
          <div className="quote-kpi-value" style={{ color: '#0284c7' }}>
            PKR {stats.sentValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="quote-kpi-subtext">
            <span>{stats.sentCount} awaiting client decision</span>
          </div>
        </div>

        {/* Draft Quotations */}
        <div 
          className={`quote-kpi-card ${statusFilter === 'Draft' ? 'active-kpi' : ''}`}
          onClick={() => handleKpiFilter('Draft')}
          title="Click to view Drafts"
        >
          <div className="quote-kpi-top">
            <span className="quote-kpi-label">Draft Bids</span>
            <div className="quote-kpi-icon-box" style={{ background: '#f8fafc', color: '#64748b' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="quote-kpi-value" style={{ color: '#475569' }}>
            {stats.draftCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>drafts</span>
          </div>
          <div className="quote-kpi-subtext">
            <span>PKR {stats.draftValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} in preparation</span>
          </div>
        </div>
      </div>

      {/* 3. CONTROLS, SEARCH & FILTERS TOOLBAR */}
      <div className="quote-panel">
        <div className="quote-toolbar">
          <div className="quote-toolbar-row">
            {/* Search Input */}
            <div className="quote-search-wrapper">
              <Search size={16} className="quote-search-icon" />
              <input 
                type="text" 
                className="quote-search-input"
                placeholder="Search quote #, client, business, amount..." 
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchTerm && (
                <button 
                  className="quote-search-clear"
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Dropdowns & View Mode */}
            <div className="quote-filters-group">
              {/* Status Filter */}
              <select 
                className="quote-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All Statuses">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Expired">Expired</option>
              </select>

              {/* Date Presets */}
              <select 
                className="quote-select"
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
              <div className="quote-date-group">
                <input 
                  type="date" 
                  className="quote-date-input"
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
                  className="quote-date-input"
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
              {(searchTerm || statusFilter !== 'All Statuses' || datePreset !== 'All Dates' || fromDate || toDate) && (
                <button 
                  className="quote-reset-btn"
                  onClick={handleResetFilters}
                  title="Reset all search queries and filters"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              )}

              {/* Dual View Mode Toggle */}
              <div className="quote-view-toggle">
                <button 
                  className={`quote-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('table')}
                  title="Enterprise Table View"
                >
                  <List size={14} /> Table
                </button>
                <button 
                  className={`quote-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('cards')}
                  title="Visual Proposal Cards Grid View"
                >
                  <LayoutGrid size={14} /> Cards
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. MAIN QUOTATIONS PRESENTATION: TABLE OR CARDS */}
        {viewMode === 'table' ? (
          <div className="quote-table-wrapper">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>QUOTATION #</th>
                  <th>CUSTOMER & BUSINESS</th>
                  <th>PREPARED BY</th>
                  <th>ISSUE / EXPIRY DATE</th>
                  <th>QUOTED AMOUNT</th>
                  <th>STATUS</th>
                  <th>PIPELINE ACTION</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {currentQuotations.map(q => {
                  const amt = Number(q.amount || 0);
                  const expInfo = getExpiryStatus(q.expiry_date, q.status);
                  const isExpired = expInfo.isExpired;

                  return (
                    <tr key={q.id}>
                      {/* Quotation # */}
                      <td>
                        <div 
                          className="quote-num-cell"
                          onClick={() => openPreview(q.id)}
                          title="Click to Preview Quotation"
                        >
                          <span>{q.quotation_number}</span>
                          <button 
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                            onClick={(e) => handleCopyQuoteNumber(q.quotation_number, e)}
                            title="Copy Quote #"
                          >
                            {copiedId === q.quotation_number ? (
                              <Check size={13} color="#10b981" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Customer & Business */}
                      <td>
                        <div className="quote-client-cell">
                          <div className="quote-avatar">
                            {getInitials(q.client_name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{q.client_name || 'N/A'}</div>
                            {q.business_name && (
                              <div className="quote-business-tag">
                                {q.business_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Prepared By */}
                      <td>
                        <span style={{ color: '#6366f1', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <User size={13} /> {q.creator_name || 'Admin'}
                        </span>
                      </td>

                      {/* Dates */}
                      <td>
                        <div>{q.issue_date ? new Date(q.issue_date).toLocaleDateString('en-GB') : '-'}</div>
                        {q.expiry_date && (
                          <div className={`quote-due-badge ${isExpired ? 'expired' : 'normal'}`}>
                            Exp: {new Date(q.expiry_date).toLocaleDateString('en-GB')}
                            {expInfo.text && <span>({expInfo.text})</span>}
                          </div>
                        )}
                      </td>

                      {/* Quoted Amount */}
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>
                          PKR {amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`quote-status-pill ${q.status ? q.status.toLowerCase() : 'draft'}`}>
                          {q.status || 'Draft'}
                        </span>
                      </td>

                      {/* Quick Pipeline Status Actions */}
                      <td>
                        {q.status === 'Draft' && (
                          <button 
                            className="inv-btn-secondary"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', gap: '0.3rem' }}
                            onClick={(e) => updateQuotationStatus(q.id, 'Sent', e)}
                            title="Mark Proposal as Sent"
                          >
                            <Send size={12} color="#0284c7" /> Mark Sent
                          </button>
                        )}
                        {q.status === 'Sent' && (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button 
                              className="inv-btn-secondary"
                              style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', gap: '0.25rem', color: '#059669', borderColor: '#a7f3d0' }}
                              onClick={(e) => updateQuotationStatus(q.id, 'Accepted', e)}
                              title="Mark as Accepted"
                            >
                              <Check size={12} /> Accept
                            </button>
                            <button 
                              className="inv-btn-secondary"
                              style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', gap: '0.25rem', color: '#e11d48', borderColor: '#fecdd3' }}
                              onClick={(e) => updateQuotationStatus(q.id, 'Rejected', e)}
                              title="Mark as Rejected"
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        )}
                        {q.status === 'Accepted' && (
                          <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={13} /> Won Deal
                          </span>
                        )}
                        {q.status === 'Rejected' && (
                          <span style={{ fontSize: '0.78rem', color: '#e11d48', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <XCircle size={13} /> Declined
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-icon view-btn" 
                            onClick={() => openPreview(q.id)} 
                            title="Preview & Print Quotation"
                          >
                            <Eye size={17} />
                          </button>
                          <button 
                            className="btn-icon" 
                            style={{ color: '#0284c7' }}
                            onClick={() => navigate(`/invoices/new?client_id=${q.client_id || ''}`)} 
                            title="Convert into Customer Invoice"
                          >
                            <FileCheck size={17} />
                          </button>
                          <button 
                            className="btn-icon edit-btn" 
                            onClick={() => navigate(`/quotations/edit/${q.id}`)} 
                            title="Edit Quotation"
                          >
                            <Edit size={17} />
                          </button>
                          <button 
                            className="btn-icon delete-btn" 
                            onClick={(e) => handleDeleteQuotation(q.id, e)} 
                            title="Delete Quotation"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {currentQuotations.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                        <FileText size={36} color="#cbd5e1" />
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>No quotations matching your search</div>
                        <div style={{ fontSize: '0.85rem' }}>Try clearing your query or adjusting the filters</div>
                        <button 
                          onClick={handleResetFilters} 
                          className="quote-btn-secondary" 
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
          <div className="quote-cards-grid">
            {currentQuotations.map(q => {
              const amt = Number(q.amount || 0);
              const expInfo = getExpiryStatus(q.expiry_date, q.status);
              const isExpired = expInfo.isExpired;

              return (
                <div 
                  key={q.id} 
                  className={`quote-card ${q.status === 'Accepted' ? 'is-accepted' : (q.status === 'Rejected' ? 'is-rejected' : (q.status === 'Sent' ? 'is-sent' : ''))}`}
                >
                  {/* Header */}
                  <div className="quote-card-header">
                    <div className="quote-card-num" onClick={() => openPreview(q.id)} style={{ cursor: 'pointer' }}>
                      <span>{q.quotation_number}</span>
                      <button 
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
                        onClick={(e) => handleCopyQuoteNumber(q.quotation_number, e)}
                        title="Copy Quote #"
                      >
                        {copiedId === q.quotation_number ? (
                          <Check size={13} color="#10b981" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>

                    <span className={`quote-status-pill ${q.status ? q.status.toLowerCase() : 'draft'}`}>
                      {q.status || 'Draft'}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="quote-card-body">
                    <div className="quote-card-client-row">
                      <div className="quote-avatar">
                        {getInitials(q.client_name)}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {q.client_name || 'N/A'}
                        </div>
                        {q.business_name && (
                          <div className="quote-business-tag" style={{ marginTop: '2px' }}>
                            {q.business_name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financials */}
                    <div className="quote-card-financials">
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Quoted Proposal</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                          PKR {amt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {q.status === 'Draft' && (
                          <button 
                            className="inv-btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', gap: '0.3rem' }}
                            onClick={(e) => updateQuotationStatus(q.id, 'Sent', e)}
                          >
                            <Send size={12} color="#0284c7" /> Send
                          </button>
                        )}
                        {q.status === 'Sent' && (
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button 
                              className="inv-btn-secondary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: '#059669', borderColor: '#a7f3d0' }}
                              onClick={(e) => updateQuotationStatus(q.id, 'Accepted', e)}
                              title="Accept Proposal"
                            >
                              <Check size={12} />
                            </button>
                            <button 
                              className="inv-btn-secondary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: '#e11d48', borderColor: '#fecdd3' }}
                              onClick={(e) => updateQuotationStatus(q.id, 'Rejected', e)}
                              title="Reject Proposal"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dates */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={13} color="#94a3b8" />
                        <span>{q.issue_date ? new Date(q.issue_date).toLocaleDateString('en-GB') : '-'}</span>
                      </div>
                      <div>
                        {q.expiry_date && (
                          <span className={`quote-due-badge ${isExpired ? 'expired' : 'normal'}`}>
                            Exp: {new Date(q.expiry_date).toLocaleDateString('en-GB')} {expInfo.text && `(${expInfo.text})`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="quote-card-footer">
                    <span style={{ fontSize: '0.78rem', color: '#6366f1', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <User size={12} /> {q.creator_name || 'Admin'}
                    </span>

                    <div className="action-buttons">
                      <button 
                        className="btn-icon view-btn" 
                        onClick={() => openPreview(q.id)} 
                        title="Preview & Print Quotation"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        className="btn-icon" 
                        style={{ color: '#0284c7' }}
                        onClick={() => navigate(`/invoices/new?client_id=${q.client_id || ''}`)} 
                        title="Convert into Customer Invoice"
                      >
                        <FileCheck size={16} />
                      </button>
                      <button 
                        className="btn-icon edit-btn" 
                        onClick={() => navigate(`/quotations/edit/${q.id}`)} 
                        title="Edit Quotation"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn-icon delete-btn" 
                        onClick={(e) => handleDeleteQuotation(q.id, e)} 
                        title="Delete Quotation"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {currentQuotations.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3.5rem 1rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <FileText size={36} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>No quotations found</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>Try clearing filters or adjusting your date search</div>
                <button 
                  onClick={handleResetFilters} 
                  className="quote-btn-secondary" 
                  style={{ margin: '1rem auto 0 auto' }}
                >
                  <RotateCcw size={14} /> Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {filteredQuotations.length > 0 && (
          <div style={{ marginTop: '1.25rem' }}>
            <Pagination 
              currentPage={currentPage}
              totalItems={filteredQuotations.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 5. PREVIEW MODAL WITH STRICTLY PRESERVED PRINTABLE QUOTATION LAYOUT */}
      {previewQuotation && (
        <div className="modal-overlay">
          <div className="modal-content preview-modal">
            <div className="modal-header print-hide" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem'}}>
              <h2 style={{margin: 0}}>Quotation Preview</h2>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                <button 
                  className="btn" 
                  style={{backgroundColor: '#e11d48', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600'}} 
                  onClick={() => window.print()}
                  title="Print or Save as PDF"
                >
                  <Printer size={18} /> Print / PDF
                </button>
                <button className="btn" style={{backgroundColor: '#e2e8f0', color: '#1e293b', padding: '0.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center'}} onClick={() => setPreviewQuotation(null)}><X size={20} /></button>
              </div>
            </div>
            
            {/* EXACT UNTOUCHED PRINTABLE QUOTATION ELEMENT */}
            <div className={`quotation-document ${previewQuotation.status === 'Accepted' || previewQuotation.status === 'Paid' ? 'is-paid' : 'is-unpaid'}`} id="printable-quotation" style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
              
              {/* STAMP */}
              <div className="quotation-stamp">
                {previewQuotation.status === 'Accepted' ? 'ACCEPTED' : (previewQuotation.status === 'Paid' ? 'PAID' : (previewQuotation.status === 'Overdue' ? 'OVERDUE' : 'UNPAID'))}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <img src="/logo.webp" alt="Adwise Labs Logo" style={{ maxWidth: '220px', height: 'auto', display: 'block' }} />
                  </div>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Quotation {previewQuotation.quotation_number}</h2>
                  
                  <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Quotation To,</div>
                    <div>{previewQuotation.client_name}</div>
                    {previewQuotation.business_name && <div>{previewQuotation.business_name}</div>}
                    {previewQuotation.physical_address && <div style={{ maxWidth: '250px' }}>{previewQuotation.physical_address}</div>}
                    <div>{previewQuotation.client_email}</div>
                  </div>
                </div>
                
                <div style={{ flex: 1, textAlign: 'right', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Date: {new Date(previewQuotation.issue_date).toLocaleDateString()}</div>
                  <div style={{ letterSpacing: '2px', marginBottom: '1rem' }}>******************************</div>
                  
                  <div style={{ fontWeight: 'bold' }}>Account Title: Adwise labs</div>
                  <div style={{ fontWeight: 'bold' }}>Bank Al Falah</div>
                  <div style={{ fontWeight: 'bold' }}>Account Number: 56395002519988</div>
                  <div style={{ fontWeight: 'bold' }}>info@adwiselabs.com</div>
                  <div style={{ fontWeight: 'bold' }}>www.adwiselabs.com</div>
                </div>
              </div>

              <table className="quotation-table" style={{ border: '1px solid #000', marginBottom: '2rem' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #000', textAlign: 'left', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Description</th>
                    <th style={{ border: '1px solid #000', textAlign: 'center', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Qty</th>
                    <th style={{ border: '1px solid #000', textAlign: 'center', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Rate</th>
                    <th style={{ border: '1px solid #000', textAlign: 'right', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewQuotation.items?.map(item => (
                    <tr key={item.id}>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem' }}>
                        <div>{item.description}</div>
                        {item.details && <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{item.details}</div>}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'center' }}>{item.quantity} {item.unit}</td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'center' }}>PKR {Number(item.unit_price).toFixed(2)}</td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right' }}>PKR {Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>Sub Total</td>
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {Number(previewQuotation.amount).toFixed(2)}</td>
                  </tr>

                </tbody>
              </table>

              <div style={{ textAlign: 'center', color: '#0369a1', fontSize: '0.9rem', fontWeight: 'bold', lineHeight: '1.6', marginTop: '3rem' }}>
                <div style={{ marginBottom: '0.5rem' }}>Prompt Payments are Appreciated!</div>
                <div style={{ marginBottom: '0.5rem' }}>Thank You</div>
                <div style={{ marginBottom: '0.5rem' }}>Accounts Department – Adwise Labs</div>
                <div style={{ color: '#000', fontSize: '0.8rem' }}>ADWISE LABS | A-205/II Saba Ave, DHA Karachi Phase VIII Zone A, 76500</div>
                <div style={{ color: '#000', fontSize: '0.8rem', fontWeight: 'normal' }}>Contact No. +1 (774) 674-1872 | +92 329 2371279 | Email: info@adwiselabs.com</div>
              </div>

              {/* SEPARATE PAGE: TERMS & CONDITIONS */}
              {previewQuotation?.terms_and_conditions && (
                <div className="terms-page-break">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
                    <img src="/logo.webp" alt="Adwise Labs Logo" style={{ maxWidth: '180px', height: 'auto' }} />
                    <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Terms & Conditions</h2>
                  </div>
                  
                  <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {previewQuotation.terms_and_conditions}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
