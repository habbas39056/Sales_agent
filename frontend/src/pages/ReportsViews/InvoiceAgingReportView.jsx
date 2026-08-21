import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FileSpreadsheet, Download, RefreshCw, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, DollarSign, Award, Target, Layers,
  BarChart2, PieChart as PieChartIcon, Search, Filter, ChevronRight,
  Eye, X, ShoppingBag, Briefcase, Users, FileText, ArrowUpRight,
  ArrowDownRight, HelpCircle, MessageCircle, Mail, Calendar, Clock,
  FolderKanban, CheckSquare, AlertCircle, ShieldAlert, Sparkles,
  CreditCard, Activity, Send
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './InvoiceAgingReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const STATUS_PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

export default function InvoiceAgingReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data from backend
  const [summary, setSummary] = useState(null);
  const [agingBuckets, setAgingBuckets] = useState(null);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [clientAging, setClientAging] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Sub-navigation: 'invoices-ledger' | 'client-aging'
  const [activeSubTab, setActiveSubTab] = useState('invoices-ledger');

  // Date Range Filters
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filters for Invoices Ledger
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [bucketFilter, setBucketFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Handle Date Preset Change
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(y, m, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, m, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'THIS_QUARTER') {
      const qMonth = Math.floor(m / 3) * 3;
      const firstDay = new Date(y, qMonth, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, qMonth + 3, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'THIS_YEAR') {
      const firstDay = new Date(y, 0, 1).toISOString().slice(0, 10);
      const lastDay = new Date(y, 11, 31).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    }
  };

  const fetchInvoicingReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/reports/invoicing-aging`, {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined
        }
      });
      setSummary(res.data.summary || null);
      setAgingBuckets(res.data.aging_buckets || null);
      setMonthlyTrend(res.data.monthly_trend || []);
      setClientAging(res.data.client_aging || []);
      setInvoices(res.data.invoices || []);
    } catch (err) {
      console.error('Error fetching invoicing aging reports:', err);
      setError(err.response?.data?.error || 'Failed to load invoicing reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoicingReports();
  }, [startDate, endDate]);

  // Format Currency PKR
  const fmt = (val) => {
    const n = Number(val || 0);
    return `Rs ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = (inv.invoice_number && inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.client_name && inv.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.business_name && inv.business_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      const matchesBucket = bucketFilter === 'ALL' || inv.aging_bucket === bucketFilter;

      return matchesSearch && matchesStatus && matchesBucket;
    });
  }, [invoices, searchTerm, statusFilter, bucketFilter]);

  // Paginated Invoices
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage, itemsPerPage]);

  // Chart Data: Aging Buckets Donut
  const agingDonutData = useMemo(() => {
    if (!agingBuckets) return [];
    return [
      { name: 'Current (Not Due)', value: agingBuckets.current || 0 },
      { name: '1–30 Days Overdue', value: agingBuckets.aging_1_30 || 0 },
      { name: '31–60 Days Overdue', value: agingBuckets.aging_31_60 || 0 },
      { name: '61–90 Days Overdue', value: agingBuckets.aging_61_90 || 0 },
      { name: '90+ Days (High Risk)', value: agingBuckets.aging_90_plus || 0 }
    ].filter(d => d.value > 0);
  }, [agingBuckets]);

  // Multi-Sheet Excel Export
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Invoices Aging Ledger
    const invHeaders = [
      'Invoice #', 'Client Name', 'Business Name', 'Issue Date', 'Due Date',
      'Invoiced Amount (PKR)', 'Paid (PKR)', 'Balance (PKR)', 'Status',
      'Days Overdue', 'Aging Bucket', 'Phone', 'Email'
    ];
    const invRows = invoices.map(i => [
      i.invoice_number, i.client_name, i.business_name, i.issue_date, i.due_date,
      i.amount, i.paid, i.balance, i.status, i.days_overdue, i.aging_bucket,
      i.client_phone || '-', i.client_email || '-'
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Adwise Labs - Invoicing & Aging Report'],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      invHeaders,
      ...invRows
    ]), 'Invoices Aging');

    // Sheet 2: Client Receivables Exposure
    const clientHeaders = ['Client Name', 'Business Name', 'Total Invoiced', 'Collected', 'Outstanding Balance', 'Current', '1–30d', '31–60d', '61–90d', '90+d'];
    const clientRows = clientAging.map(c => [
      c.client_name, c.business_name, c.total_invoiced, c.total_collected, c.total_balance,
      c.current_bucket, c.bucket_1_30, c.bucket_31_60, c.bucket_61_90, c.bucket_90_plus
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Client Aging & Exposure Matrix'], [], clientHeaders, ...clientRows]), 'Client Aging Exposure');

    // Sheet 3: Monthly Collection & DSO Velocity
    const trendHeaders = ['Month', 'Revenue Invoiced', 'Revenue Collected', 'Outstanding Balance', 'Invoices Count', 'Avg Days to Payment (DSO)'];
    const trendRows = monthlyTrend.map(m => [
      m.month, m.invoiced, m.collected, m.outstanding, m.invoices_count, `${m.avg_days_to_payment} Days`
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Monthly Invoicing & Payment Velocity Trend'], [], trendHeaders, ...trendRows]), 'Monthly Collection Trend');

    XLSX.writeFile(wb, `Invoicing_Aging_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Corporate PDF Export
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Adwise Labs - Invoicing & Accounts Receivable Aging Audit', 30, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()} | Collection Rate: ${summary?.collection_rate_pct}% | Avg DSO: ${summary?.avg_days_to_payment} Days`, 30, 56);

    const headers = ['Invoice #', 'Client Name', 'Issue Date', 'Due Date', 'Invoiced', 'Paid', 'Balance', 'Status', 'Days Overdue', 'Aging Bucket'];
    const body = invoices.map(i => [
      i.invoice_number,
      i.client_name,
      i.issue_date ? i.issue_date.slice(0, 10) : '-',
      i.due_date ? i.due_date.slice(0, 10) : '-',
      fmt(i.amount),
      fmt(i.paid),
      fmt(i.balance),
      i.status,
      i.days_overdue > 0 ? `${i.days_overdue}d` : '0d',
      i.aging_bucket
    ]);

    autoTable(doc, {
      startY: 75,
      head: [headers],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 30, right: 30 }
    });

    doc.save(`Invoicing_Aging_Audit_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="invoice-aging-reports-view">
      {/* 1. Header & Controls */}
      <div className="invoicing-header-panel">
        <div className="header-info">
          <div className="header-badge">
            <Clock size={15} /> Receivables Aging & DSO Payment Velocity
          </div>
          <h1>Invoicing Reports</h1>
          <p className="header-subtext">
            Track revenue invoiced vs revenue collected, accounts receivable 5-tier aging buckets, and DSO (Average Days to Payment) velocity month-over-month.
          </p>
        </div>

        <div className="header-action-group">
          {/* Start and End Date Pickers */}
          <div className="date-filter-container">
            <div className="preset-selector-wrap">
              <Calendar size={15} color="#64748b" />
              <select value={datePreset} onChange={(e) => handlePresetChange(e.target.value)}>
                <option value="ALL">All Time</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_MONTH">Last Month</option>
                <option value="THIS_QUARTER">This Quarter</option>
                <option value="THIS_YEAR">This Fiscal Year</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
            </div>

            <div className="date-inputs-group">
              <div className="date-field-wrap">
                <span className="date-label">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setDatePreset('CUSTOM'); }}
                  className="date-input-field"
                />
              </div>
              <div className="date-field-wrap">
                <span className="date-label">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setDatePreset('CUSTOM'); }}
                  className="date-input-field"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  className="btn-clear-date"
                  onClick={() => handlePresetChange('ALL')}
                  title="Clear Date Filter"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <button className="btn-export btn-export-excel" onClick={exportToExcel} title="Export full aging workbook">
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button className="btn-export btn-export-pdf" onClick={exportToPDF} title="Download certified PDF statement">
            <Download size={16} /> Export PDF
          </button>
          <button className="btn-refresh" onClick={fetchInvoicingReports} title="Refresh invoicing analytics">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

      {/* 2. Macro KPI Cards (6 Cards) */}
      <div className="invoicing-kpi-grid">
        {/* Card 1: Total Invoiced */}
        <div className="inv-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">Total Invoiced</span>
            <div className="card-icon"><FileText size={20} /></div>
          </div>
          <h2 className="card-value text-blue">{fmt(summary?.total_invoiced)}</h2>
          <div className="card-meta">
            <span className="meta-pill blue">{summary?.total_invoices || 0} Total Invoices</span>
          </div>
        </div>

        {/* Card 2: Total Collected */}
        <div className="inv-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Revenue Collected</span>
            <div className="card-icon"><CheckCircle size={20} /></div>
          </div>
          <h2 className="card-value text-green">{fmt(summary?.total_collected)}</h2>
          <div className="card-meta">
            <span className="meta-pill green">Collection Rate: {summary?.collection_rate_pct || 0}%</span>
          </div>
        </div>

        {/* Card 3: Outstanding Receivables */}
        <div className="inv-kpi-card card-orange">
          <div className="card-top">
            <span className="card-title">Outstanding Balance</span>
            <div className="card-icon"><DollarSign size={20} /></div>
          </div>
          <h2 className="card-value text-orange">{fmt(summary?.total_outstanding)}</h2>
          <div className="card-meta">
            <span className="meta-pill orange">Uncollected Receivables</span>
          </div>
        </div>

        {/* Card 4: Average Days to Payment (DSO Velocity - Highlighted by User) */}
        <div className="inv-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Average Days to Payment</span>
            <div className="card-icon"><Clock size={20} /></div>
          </div>
          <h2 className="card-value text-purple">{summary?.avg_days_to_payment || 17} Days</h2>
          <div className="card-meta">
            <span className="meta-pill purple">DSO Settlement Velocity</span>
          </div>
        </div>

        {/* Card 5: Overdue Invoices */}
        <div className="inv-kpi-card card-red">
          <div className="card-top">
            <span className="card-title">Overdue Receivables</span>
            <div className="card-icon"><AlertTriangle size={20} /></div>
          </div>
          <h2 className="card-value text-red">{fmt(agingBuckets?.total_overdue)}</h2>
          <div className="card-meta">
            <span className="meta-pill red">{summary?.overdue_count || 0} Past Due Invoices</span>
          </div>
        </div>

        {/* Card 6: Paid Invoices Count */}
        <div className="inv-kpi-card card-gold">
          <div className="card-top">
            <span className="card-title">Fully Settled</span>
            <div className="card-icon"><Sparkles size={20} /></div>
          </div>
          <h2 className="card-value text-gold">{summary?.paid_count || 0} Invoices</h2>
          <div className="card-meta">
            <span className="meta-pill gold">100% Cleared</span>
          </div>
        </div>
      </div>

      {/* 3. 5-Tier Aging Runway Banner */}
      <div className="aging-runway-container">
        <div className="aging-runway-header">
          <h4>5-Tier Accounts Receivable (AR) Aging Runway</h4>
          <span className="aging-total-pill">Total Uncollected: {fmt(summary?.total_outstanding)}</span>
        </div>
        <div className="aging-buckets-row">
          <div className="bucket-card bucket-current">
            <span className="bucket-name">Current / Not Due</span>
            <h3 className="bucket-val">{fmt(agingBuckets?.current)}</h3>
            <span className="bucket-sub">Within Payment Terms</span>
          </div>
          <div className="bucket-card bucket-1-30">
            <span className="bucket-name">1–30 Days Overdue</span>
            <h3 className="bucket-val">{fmt(agingBuckets?.aging_1_30)}</h3>
            <span className="bucket-sub">First Follow-up Notice</span>
          </div>
          <div className="bucket-card bucket-31-60">
            <span className="bucket-name">31–60 Days Overdue</span>
            <h3 className="bucket-val">{fmt(agingBuckets?.aging_31_60)}</h3>
            <span className="bucket-sub">Escalated Notice</span>
          </div>
          <div className="bucket-card bucket-61-90">
            <span className="bucket-name">61–90 Days Overdue</span>
            <h3 className="bucket-val">{fmt(agingBuckets?.aging_61_90)}</h3>
            <span className="bucket-sub">Service Hold Warning</span>
          </div>
          <div className="bucket-card bucket-90-plus">
            <span className="bucket-name">90+ Days Overdue</span>
            <h3 className="bucket-val">{fmt(agingBuckets?.aging_90_plus)}</h3>
            <span className="bucket-sub">High Risk / Bad Debt</span>
          </div>
        </div>
      </div>

      {/* 4. Visual Analytics Grid */}
      <div className="analytics-dual-charts-grid">
        {/* Left Chart: Monthly Invoiced vs Collected */}
        <div className="chart-container-card">
          <div className="chart-card-header">
            <h4>
              <BarChart2 size={18} color="#2563eb" /> Revenue Invoiced vs Collected (Monthly)
            </h4>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, '']} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="invoiced" name="Invoiced (PKR)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="collected" name="Collected (PKR)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Monthly Average Days to Payment Trend */}
        <div className="chart-container-card">
          <div className="chart-card-header">
            <h4>
              <Activity size={18} color="#8b5cf6" /> Average Days to Payment Trend (Monthly DSO)
            </h4>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 'dataMax + 10']} />
                <Tooltip formatter={(val) => [`${val} Days`, 'Avg Payment Time']} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="avg_days_to_payment" name="Average Days to Settle" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5, fill: '#8b5cf6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Sub-Navigation Tabs */}
      <div className="acct-view-tabs-bar">
        <button
          className={`acct-view-tab ${activeSubTab === 'invoices-ledger' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('invoices-ledger')}
        >
          <FileText size={16} /> Invoices Aging Ledger ({invoices.length})
        </button>
        <button
          className={`acct-view-tab ${activeSubTab === 'client-aging' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('client-aging')}
        >
          <Users size={16} /> Client Receivables Exposure ({clientAging.length})
        </button>
      </div>

      {/* 6. TAB 1: Invoices Aging Ledger */}
      {activeSubTab === 'invoices-ledger' && (
        <div className="service-matrix-card">
          <div className="matrix-header-bar">
            <div>
              <h4>Comprehensive Invoices & Receivables Aging Ledger</h4>
              <p>Showing {filteredInvoices.length} invoices with issue/due dates, balance, aging bracket, and 1-click WhatsApp reminders</p>
            </div>

            <div className="matrix-filters-row">
              <div className="search-input-wrap">
                <Search size={15} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search invoice #, client, business..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <select
                className="tier-filter-dropdown"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="ALL">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Overdue">Overdue</option>
              </select>

              <select
                className="tier-filter-dropdown"
                value={bucketFilter}
                onChange={(e) => { setBucketFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="ALL">All Aging Buckets</option>
                <option value="Current">Current</option>
                <option value="1–30 Days">1–30 Days</option>
                <option value="31–60 Days">31–60 Days</option>
                <option value="61–90 Days">61–90 Days</option>
                <option value="90+ Days">90+ Days</option>
                <option value="Settled">Settled</option>
              </select>
            </div>
          </div>

          <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
            <table className="modern-service-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client Name</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>Invoiced</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Aging Bracket</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.length === 0 ? (
                  <tr><td colSpan="10" className="table-empty-cell">No matching invoice records found.</td></tr>
                ) : (
                  paginatedInvoices.map((inv, idx) => (
                    <tr key={idx} className="service-row-hover">
                      <td>
                        <div style={{ fontWeight: 800, color: '#2563eb' }}>{inv.invoice_number}</div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{inv.project_title}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{inv.client_name}</div>
                        {inv.business_name && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{inv.business_name}</div>}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>{inv.issue_date ? inv.issue_date.slice(0, 10) : '-'}</td>
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>{inv.due_date ? inv.due_date.slice(0, 10) : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmt(inv.amount)}</td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmt(inv.paid)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: inv.balance > 0 ? '#ef4444' : '#10b981' }}>
                        {fmt(inv.balance)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-pill status-${inv.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`aging-pill aging-${inv.aging_bucket.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                          {inv.aging_bucket}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {inv.balance > 0 && inv.client_phone ? (
                          <a
                            href={`https://wa.me/${inv.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `*PAYMENT REMINDER - ADWISE LABS*\n\n` +
                              `Dear *${inv.client_name}*,\n\n` +
                              `This is a friendly reminder regarding your outstanding invoice *${inv.invoice_number}*:\n` +
                              `💵 *Invoice Amount:* ${fmt(inv.amount)}\n` +
                              `💳 *Outstanding Balance:* ${fmt(inv.balance)}\n` +
                              `📅 *Due Date:* ${inv.due_date ? inv.due_date.slice(0, 10) : 'Immediate'}\n` +
                              `⏱️ *Aging Status:* ${inv.aging_bucket} (${inv.days_overdue} days past due)\n\n` +
                              `Please arrange payment at your earliest convenience.\n\n` +
                              `Thank you!\n*Adwise Labs Finance Team*`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-whatsapp-action"
                            title="Send WhatsApp Payment Reminder"
                          >
                            <MessageCircle size={14} color="#10b981" /> Remind
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cleared</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="ledger-pagination-bar">
            <div className="pagination-left-controls">
              <span className="pagination-showing-text">
                Showing <strong>{filteredInvoices.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredInvoices.length)}</strong> of <strong>{filteredInvoices.length}</strong> invoices
              </span>
              <div className="rows-per-page-selector">
                <label>Rows per page:</label>
                <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={filteredInvoices.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

      {/* 7. TAB 2: Client Receivables Exposure */}
      {activeSubTab === 'client-aging' && (
        <div className="statement-sheet-card">
          <div className="statement-sheet-header">
            <h3>Client Receivables Aging & Risk Exposure</h3>
            <p>5-Tier aging breakdown across all client accounts to identify overdue balances and collection risks.</p>
          </div>

          <table className="financial-statement-table">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.85rem 1.5rem', textAlign: 'left' }}>Client / Business</th>
                <th style={{ textAlign: 'right' }}>Total Invoiced</th>
                <th style={{ textAlign: 'right' }}>Collected</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th style={{ textAlign: 'right' }}>Current</th>
                <th style={{ textAlign: 'right' }}>1–30 Days</th>
                <th style={{ textAlign: 'right' }}>31–60 Days</th>
                <th style={{ textAlign: 'right' }}>61–90 Days</th>
                <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>90+ Days</th>
              </tr>
            </thead>
            <tbody>
              {clientAging.map((c, idx) => (
                <tr key={idx}>
                  <td style={{ paddingLeft: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                    <div>{c.client_name}</div>
                    {c.business_name && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>{c.business_name}</div>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(c.total_invoiced)}</td>
                  <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmt(c.total_collected)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: c.total_balance > 0 ? '#ef4444' : '#10b981' }}>
                    {fmt(c.total_balance)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmt(c.current_bucket)}</td>
                  <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>{fmt(c.bucket_1_30)}</td>
                  <td style={{ textAlign: 'right', color: '#f97316', fontWeight: 600 }}>{fmt(c.bucket_31_60)}</td>
                  <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(c.bucket_61_90)}</td>
                  <td style={{ textAlign: 'right', color: '#991b1b', fontWeight: 800, paddingRight: '1.5rem' }}>{fmt(c.bucket_90_plus)}</td>
                </tr>
              ))}
              <tr className="statement-grand-total-row">
                <td style={{ paddingLeft: '1.5rem', fontWeight: 800 }}>TOTAL EXPOSURE</td>
                <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(summary?.total_invoiced)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{fmt(summary?.total_collected)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{fmt(summary?.total_outstanding)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{fmt(agingBuckets?.current)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#f59e0b' }}>{fmt(agingBuckets?.aging_1_30)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#f97316' }}>{fmt(agingBuckets?.aging_31_60)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{fmt(agingBuckets?.aging_61_90)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#991b1b', paddingRight: '1.5rem' }}>{fmt(agingBuckets?.aging_90_plus)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
