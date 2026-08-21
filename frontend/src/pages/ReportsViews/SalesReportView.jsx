import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, CreditCard, Banknote, 
  FileText, Download, Filter, Calendar, Search, RefreshCw, 
  CheckCircle2, Clock, AlertTriangle, User, FileSpreadsheet, Eye, ArrowUpRight
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './SalesReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const STATUS_COLORS = {
  'Paid': '#10b981',
  'Partially Paid': '#3b82f6',
  'Unpaid': '#f59e0b',
  'Overdue': '#ef4444',
  'Due Passed': '#ef4444',
  'Draft': '#94a3b8',
  'Void': '#64748b'
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function SalesReportView() {
  const navigate = useNavigate();

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('all');
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientsList, setClientsList] = useState([]);
  const [salesData, setSalesData] = useState({
    invoices: [],
    summary: {
      gross_sales: 0,
      realized_revenue: 0,
      outstanding_ar: 0,
      total_expenses: 0,
      net_profit: 0,
      profit_margin: 0,
      collection_rate: 0,
      total_invoices: 0,
      avg_order_value: 0
    },
    trend: [],
    status_breakdown: [],
    top_clients: []
  });

  // Fetch Clients for Filter Dropdown
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await axios.get(`${API_URL}/clients`);
        setClientsList(res.data || []);
      } catch (err) {
        console.error('Failed to load clients list:', err);
      }
    };
    fetchClients();
  }, []);

  // Preset Date Calculator
  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    const now = new Date();
    let start = '';
    let end = '';

    if (preset === 'today') {
      const d = now.toISOString().split('T')[0];
      start = d;
      end = d;
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      start = past.toISOString().split('T')[0];
      end = now.toISOString().split('T')[0];
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      start = past.toISOString().split('T')[0];
      end = now.toISOString().split('T')[0];
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = firstDay.toISOString().split('T')[0];
      end = lastDay.toISOString().split('T')[0];
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      start = firstDay.toISOString().split('T')[0];
      end = lastDay.toISOString().split('T')[0];
    } else if (preset === 'this_year') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      start = firstDay.toISOString().split('T')[0];
      end = lastDay.toISOString().split('T')[0];
    } else {
      start = '';
      end = '';
    }

    setStartDate(start);
    setEndDate(end);
  };

  // Fetch Sales Report Data
  const fetchSalesReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedClient && selectedClient !== 'all') params.append('client_id', selectedClient);
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);

      const res = await axios.get(`${API_URL}/reports/sales?${params.toString()}`);
      
      // Fallback normalization in case backend sends array or old format
      if (Array.isArray(res.data)) {
        let gross = 0;
        let paid = 0;
        let bal = 0;
        res.data.forEach(i => {
          const a = parseFloat(i.amount || 0);
          const b = parseFloat(i.balance || 0);
          gross += a;
          bal += b;
          paid += (a - b);
        });
        setSalesData({
          invoices: res.data,
          summary: {
            gross_sales: gross,
            realized_revenue: paid,
            outstanding_ar: bal,
            total_expenses: 0,
            net_profit: paid,
            profit_margin: paid > 0 ? 100 : 0,
            collection_rate: gross > 0 ? (paid / gross * 100) : 0,
            total_invoices: res.data.length,
            avg_order_value: res.data.length > 0 ? (gross / res.data.length) : 0
          },
          trend: [],
          status_breakdown: [],
          top_clients: []
        });
      } else {
        setSalesData(res.data);
      }
    } catch (err) {
      console.error('Error loading sales report:', err);
      setError('Unable to load sales report. Please check server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesReport();
  }, [startDate, endDate, selectedClient, selectedStatus]);

  // Client-side Filtered Invoices
  const filteredInvoices = useMemo(() => {
    const list = salesData.invoices || [];
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(inv => 
      (inv.invoice_number && inv.invoice_number.toLowerCase().includes(term)) ||
      (inv.client_name && inv.client_name.toLowerCase().includes(term)) ||
      (inv.business_name && inv.business_name.toLowerCase().includes(term)) ||
      (inv.project_title && inv.project_title.toLowerCase().includes(term))
    );
  }, [salesData.invoices, searchTerm]);

  // Paginated Invoices
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage, itemsPerPage]);

  // Format Currency
  const fmt = (val) => {
    const n = Number(val || 0);
    return `PKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Export Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryRows = [
      { 'Sales Metric': 'Report Generated On', 'Value': new Date().toLocaleString() },
      { 'Sales Metric': 'Date Filter Period', 'Value': startDate && endDate ? `${startDate} to ${endDate}` : 'All Time' },
      { 'Sales Metric': 'Gross Invoiced Sales', 'Value': salesData.summary.gross_sales },
      { 'Sales Metric': 'Realized Cash Revenue', 'Value': salesData.summary.realized_revenue },
      { 'Sales Metric': 'Accounts Receivable (Balance Due)', 'Value': salesData.summary.outstanding_ar },
      { 'Sales Metric': 'Operating Expenses (Period)', 'Value': salesData.summary.total_expenses },
      { 'Sales Metric': 'Net Realized Profit', 'Value': salesData.summary.net_profit },
      { 'Sales Metric': 'Profit Margin (%)', 'Value': `${salesData.summary.profit_margin}%` },
      { 'Sales Metric': 'Collection Efficiency (%)', 'Value': `${salesData.summary.collection_rate}%` },
      { 'Sales Metric': 'Total Invoices Count', 'Value': salesData.summary.total_invoices },
      { 'Sales Metric': 'Average Invoice Value', 'Value': salesData.summary.avg_order_value }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // 2. Invoices Ledger Sheet
    const invoiceRows = (salesData.invoices || []).map(inv => ({
      'Invoice #': inv.invoice_number,
      'Client Name': inv.client_name || '-',
      'Business / Company': inv.business_name || '-',
      'Project': inv.project_title || 'Direct Sale',
      'Issue Date': inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : '-',
      'Due Date': inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-',
      'Total Amount (PKR)': parseFloat(inv.amount || 0),
      'Paid Amount (PKR)': parseFloat(inv.paid_amount || (inv.amount - inv.balance) || 0),
      'Balance Due (PKR)': parseFloat(inv.balance || 0),
      'Payment Status': inv.status || 'Unpaid'
    }));
    const wsInvoices = XLSX.utils.json_to_sheet(invoiceRows);
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Sales Transactions');

    // 3. Top Clients Sheet
    if ((salesData.top_clients || []).length > 0) {
      const topRows = salesData.top_clients.map((c, i) => ({
        'Rank': `#${i + 1}`,
        'Client Name': c.name,
        'Business': c.business || '-',
        'Invoices Count': c.invoices_count,
        'Gross Sales (PKR)': c.total_sales,
        'Paid Revenue (PKR)': c.total_paid,
        'Outstanding Balance (PKR)': c.total_balance
      }));
      const wsTop = XLSX.utils.json_to_sheet(topRows);
      XLSX.utils.book_append_sheet(wb, wsTop, 'Top Customers');
    }

    XLSX.writeFile(wb, `Executive_Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export PDF
  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');

    // Header Branding
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 28, 'F');

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('EXECUTIVE SALES & REVENUE REPORT', 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toLocaleDateString()} | Filter: ${startDate && endDate ? `${startDate} to ${endDate}` : 'All Time'}`, 14, 24);

    // Summary Section
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text('1. Financial Performance Summary', 14, 38);

    const summaryTableData = [
      ['Gross Invoiced Sales', fmt(salesData.summary.gross_sales), 'Realized Cash Revenue', fmt(salesData.summary.realized_revenue)],
      ['Accounts Receivable (A/R)', fmt(salesData.summary.outstanding_ar), 'Direct Period Expenses', fmt(salesData.summary.total_expenses)],
      ['Net Realized Profit', fmt(salesData.summary.net_profit), 'Profit Margin', `${salesData.summary.profit_margin}%`],
      ['Total Invoices Count', `${salesData.summary.total_invoices} Invoices`, 'Collection Rate', `${salesData.summary.collection_rate}%`]
    ];

    autoTable(doc, {
      startY: 42,
      body: summaryTableData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: [30, 41, 59] },
      headStyles: { fillColor: [241, 245, 249] }
    });

    // Invoices Ledger Section
    const nextY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text('2. Itemized Sales Ledger', 14, nextY);

    const invoiceTableHeaders = [['Inv #', 'Client / Business', 'Issue Date', 'Amount', 'Paid', 'Balance', 'Status']];
    const invoiceTableRows = (salesData.invoices || []).slice(0, 40).map(inv => [
      inv.invoice_number,
      inv.client_name || inv.business_name || 'N/A',
      inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : '-',
      `PKR ${parseFloat(inv.amount || 0).toLocaleString()}`,
      `PKR ${parseFloat(inv.paid_amount || (inv.amount - inv.balance) || 0).toLocaleString()}`,
      `PKR ${parseFloat(inv.balance || 0).toLocaleString()}`,
      inv.status || 'Unpaid'
    ]);

    autoTable(doc, {
      startY: nextY + 4,
      head: invoiceTableHeaders,
      body: invoiceTableRows,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2.5 }
    });

    doc.save(`Sales_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="professional-sales-report fade-in">
      {/* 1. Header & Controls Bar */}
      <div className="sales-header-panel">
        <div className="header-info">
          <div className="header-title-wrapper">
            <div className="header-badge">
              <Banknote size={18} /> Financial Sales Intelligence
            </div>
            <h1>Executive Sales & Revenue Report</h1>
          </div>
          <p className="header-subtext">
            Real-time multi-dimensional tracking of billed revenue, realized collections, accounts receivable, and net profitability.
          </p>
        </div>

        <div className="header-action-group">
          <button className="btn-export btn-export-excel" onClick={handleExportExcel} title="Export multi-sheet Excel Workbook">
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button className="btn-export btn-export-pdf" onClick={handleExportPDF} title="Download Corporate PDF Report">
            <Download size={16} /> Export PDF
          </button>
          <button className="btn-refresh" onClick={fetchSalesReport} title="Refresh data">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Comprehensive Filter Toolbar */}
      <div className="sales-filter-card">
        <div className="preset-pill-row">
          <span className="filter-row-label">Timeframe:</span>
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'this_year', label: 'This Year' }
          ].map(btn => (
            <button
              key={btn.id}
              className={`preset-btn ${selectedPreset === btn.id ? 'active' : ''}`}
              onClick={() => handlePresetChange(btn.id)}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="filter-controls-grid">
          {/* Custom Date Pickers */}
          <div className="filter-field">
            <label><Calendar size={14} /> Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedPreset('custom');
              }} 
            />
          </div>

          <div className="filter-field">
            <label><Calendar size={14} /> End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedPreset('custom');
              }} 
            />
          </div>

          {/* Client Filter */}
          <div className="filter-field">
            <label><User size={14} /> Filter by Client</label>
            <select 
              value={selectedClient} 
              onChange={(e) => {
                setSelectedClient(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Clients ({clientsList.length})</option>
              {clientsList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name} {c.business_name ? `(${c.business_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-field">
            <label><Filter size={14} /> Invoice Status</label>
            <select 
              value={selectedStatus} 
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Overdue">Overdue</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

      {/* 3. Executive KPI Metric Cards (6 Cards) */}
      <div className="sales-kpi-grid">
        {/* Gross Sales */}
        <div className="sales-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">Gross Invoiced Sales</span>
            <div className="card-icon"><FileText size={20} /></div>
          </div>
          <div className="card-body">
            <h2 className="card-value">{fmt(salesData.summary.gross_sales)}</h2>
            <div className="card-meta">
              <span className="meta-pill blue">{salesData.summary.total_invoices} Billed Invoices</span>
            </div>
          </div>
        </div>

        {/* Realized Revenue */}
        <div className="sales-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Realized Cash Revenue</span>
            <div className="card-icon"><Banknote size={20} /></div>
          </div>
          <div className="card-body">
            <h2 className="card-value text-green">{fmt(salesData.summary.realized_revenue)}</h2>
            <div className="card-meta">
              <span className="meta-pill green">
                <CheckCircle2 size={12} /> {salesData.summary.collection_rate}% Collected
              </span>
            </div>
          </div>
        </div>

        {/* Accounts Receivable */}
        <div className="sales-kpi-card card-orange">
          <div className="card-top">
            <span className="card-title">Accounts Receivable (A/R)</span>
            <div className="card-icon"><Clock size={20} /></div>
          </div>
          <div className="card-body">
            <h2 className="card-value text-orange">{fmt(salesData.summary.outstanding_ar)}</h2>
            <div className="card-meta">
              <span className="meta-pill orange">Outstanding Due</span>
            </div>
          </div>
        </div>

        {/* Direct Expenses */}
        <div className="sales-kpi-card card-red">
          <div className="card-top">
            <span className="card-title">Period Operating Expenses</span>
            <div className="card-icon"><CreditCard size={20} /></div>
          </div>
          <div className="card-body">
            <h2 className="card-value text-red">{fmt(salesData.summary.total_expenses)}</h2>
            <div className="card-meta">
              <span className="meta-pill red">Outflow</span>
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="sales-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Net Realized Profit</span>
            <div className="card-icon">
              {salesData.summary.net_profit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
          </div>
          <div className="card-body">
            <h2 className={`card-value ${salesData.summary.net_profit >= 0 ? 'text-purple' : 'text-red'}`}>
              {fmt(salesData.summary.net_profit)}
            </h2>
            <div className="card-meta">
              <span className={`meta-pill ${salesData.summary.net_profit >= 0 ? 'purple' : 'red'}`}>
                {salesData.summary.profit_margin}% Margin
              </span>
            </div>
          </div>
        </div>

        {/* Average Deal Size */}
        <div className="sales-kpi-card card-teal">
          <div className="card-top">
            <span className="card-title">Avg. Invoice Value (AOV)</span>
            <div className="card-icon"><DollarSign size={20} /></div>
          </div>
          <div className="card-body">
            <h2 className="card-value">{fmt(salesData.summary.avg_order_value)}</h2>
            <div className="card-meta">
              <span className="meta-pill teal">Per Transaction</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Interactive Analytics Visualizations */}
      <div className="sales-charts-row">
        {/* Trend Area Chart */}
        <div className="sales-chart-card chart-main">
          <div className="chart-header">
            <div>
              <h3>Sales Trend & Realization Curve</h3>
              <p className="chart-subtitle">Monthly comparison of Billed Sales vs Realized Cash Inflow vs Outflow</p>
            </div>
          </div>
          <div className="chart-container-box">
            {(salesData.trend || []).length === 0 ? (
              <div className="empty-chart-state">
                <FileText size={32} />
                <p>No historical trend records found for the selected timeframe.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={salesData.trend} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} 
                  />
                  <Tooltip 
                    formatter={(val) => [`PKR ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, '']}
                    contentStyle={{ background: '#1e293b', borderRadius: '8px', color: '#fff', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area type="monotone" dataKey="invoiced" name="Gross Invoiced" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorGross)" />
                  <Area type="monotone" dataKey="paid" name="Realized Cash" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRealized)" />
                  <Area type="monotone" dataKey="balance" name="Balance Due" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorBal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Distribution Donut */}
        <div className="sales-chart-card chart-donut">
          <div className="chart-header">
            <div>
              <h3>Payment Status Distribution</h3>
              <p className="chart-subtitle">Invoice distribution by realization status</p>
            </div>
          </div>
          <div className="donut-body">
            {(salesData.status_breakdown || []).length === 0 ? (
              <div className="empty-chart-state">
                <Clock size={32} />
                <p>No status records found.</p>
              </div>
            ) : (
              <>
                <div style={{ width: '100%', height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={salesData.status_breakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="count"
                        nameKey="status"
                      >
                        {salesData.status_breakdown.map((entry, idx) => (
                          <Cell 
                            key={`status-cell-${idx}`} 
                            fill={STATUS_COLORS[entry.status] || PIE_COLORS[idx % PIE_COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val, name, entry) => [
                          `${val} Invoices (PKR ${Number(entry.payload.total_amount || 0).toLocaleString()})`, 
                          name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="donut-legend-list">
                  {salesData.status_breakdown.map((s, idx) => (
                    <div key={idx} className="legend-row">
                      <div className="legend-label">
                        <span 
                          className="legend-dot" 
                          style={{ background: STATUS_COLORS[s.status] || PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        <span>{s.status}</span>
                      </div>
                      <span className="legend-value">{s.count} ({fmt(s.total_amount)})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 5. Top Revenue Clients Section */}
      {(salesData.top_clients || []).length > 0 && (
        <div className="top-clients-card">
          <div className="section-title-bar">
            <h3><ArrowUpRight size={18} className="text-green" /> Top Performing Customers</h3>
            <span className="section-meta">Top revenue contributors in current timeframe</span>
          </div>
          <div className="top-clients-grid">
            {salesData.top_clients.map((client, idx) => {
              const pct = salesData.summary.gross_sales > 0 
                ? ((client.total_sales / salesData.summary.gross_sales) * 100).toFixed(1) 
                : 0;
              return (
                <div key={idx} className="top-client-item">
                  <div className="top-client-header">
                    <span className="top-rank-badge">#{idx + 1}</span>
                    <div className="top-client-names">
                      <h4 className="client-name">{client.name}</h4>
                      <span className="client-business">{client.business || 'Individual Account'}</span>
                    </div>
                  </div>
                  <div className="top-client-stats">
                    <div className="stat-line">
                      <span className="label">Total Billed:</span>
                      <span className="val font-bold">{fmt(client.total_sales)}</span>
                    </div>
                    <div className="stat-line">
                      <span className="label">Paid / Collected:</span>
                      <span className="val text-green">{fmt(client.total_paid)}</span>
                    </div>
                  </div>
                  <div className="revenue-share-bar">
                    <div className="bar-fill" style={{ width: `${pct}%` }}></div>
                  </div>
                  <span className="share-text">{pct}% of gross revenue</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Detailed Itemized Sales Ledger Table */}
      <div className="sales-ledger-card">
        <div className="ledger-header">
          <div>
            <h3>Itemized Sales Transactions Ledger</h3>
            <p className="ledger-subtext">Showing {filteredInvoices.length} transactions across filtered criteria</p>
          </div>
          <div className="search-bar-wrap">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search by invoice #, client, business, or project..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="modern-sales-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client / Account</th>
                <th>Project</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th className="text-right">Invoiced (PKR)</th>
                <th className="text-right">Collected (PKR)</th>
                <th className="text-right">Balance Due (PKR)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="table-loading-cell">
                    <div className="loading-state"><RefreshCw className="spinner" size={24} /> Loading sales transactions...</div>
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan="10" className="table-empty-cell">
                    No sales transactions match the specified filters.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => {
                  const amt = parseFloat(inv.amount || 0);
                  const bal = parseFloat(inv.balance || 0);
                  const paid = amt - bal;
                  const statusClass = (inv.status || 'unpaid').toLowerCase().replace(/\s+/g, '-');

                  return (
                    <tr key={inv.invoice_id} className="sales-table-row">
                      <td className="font-mono font-bold text-primary">
                        {inv.invoice_number}
                      </td>
                      <td>
                        <div className="client-cell-info">
                          <span className="client-main-name">{inv.client_name || 'Anonymous Client'}</span>
                          {inv.business_name && <span className="client-sub-name">{inv.business_name}</span>}
                        </div>
                      </td>
                      <td>
                        {inv.project_title ? (
                          <span className="project-tag">{inv.project_title}</span>
                        ) : (
                          <span className="text-muted">Direct Sale</span>
                        )}
                      </td>
                      <td>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : '-'}</td>
                      <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</td>
                      <td className="text-right font-bold">{fmt(amt)}</td>
                      <td className="text-right font-medium text-green">{fmt(paid)}</td>
                      <td className={`text-right font-bold ${bal > 0 ? 'text-red' : 'text-green'}`}>
                        {fmt(bal)}
                      </td>
                      <td>
                        <span className={`sales-status-badge status-${statusClass}`}>
                          {inv.status || 'Unpaid'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn-view-invoice"
                          onClick={() => navigate(`/invoices/edit/${inv.invoice_id}`)}
                          title="View / Edit Invoice"
                        >
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {paginatedInvoices.length > 0 && (
              <tfoot>
                <tr className="table-summary-footer">
                  <td colSpan="5" className="font-bold">Page Summary ({paginatedInvoices.length} Invoices)</td>
                  <td className="text-right font-bold">
                    {fmt(paginatedInvoices.reduce((acc, i) => acc + parseFloat(i.amount || 0), 0))}
                  </td>
                  <td className="text-right font-bold text-green">
                    {fmt(paginatedInvoices.reduce((acc, i) => acc + (parseFloat(i.amount || 0) - parseFloat(i.balance || 0)), 0))}
                  </td>
                  <td className="text-right font-bold text-red">
                    {fmt(paginatedInvoices.reduce((acc, i) => acc + parseFloat(i.balance || 0), 0))}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Enterprise Pagination Bar */}
        <div className="ledger-pagination-bar">
          <div className="pagination-left-controls">
            <span className="pagination-showing-text">
              Showing <strong>{filteredInvoices.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredInvoices.length)}</strong> of <strong>{filteredInvoices.length}</strong> invoices
            </span>
            <div className="rows-per-page-selector">
              <label>Rows per page:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="pagination-right-controls">
            <Pagination 
              currentPage={currentPage}
              totalItems={filteredInvoices.length}
              itemsPerPage={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
