import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FileSpreadsheet, Download, RefreshCw, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, DollarSign, Award, Target, Layers,
  BarChart2, PieChart as PieChartIcon, Search, Filter, ChevronRight,
  Eye, X, ShoppingBag, Briefcase, Users, FileText, ArrowUpRight,
  ArrowDownRight, HelpCircle, MessageCircle, Mail, Calendar, Clock,
  FolderKanban, CheckSquare, AlertCircle, ShieldAlert, Sparkles,
  CreditCard, Activity, Send, Landmark, ShieldCheck, Zap
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './CashFlowReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const BANK_PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function CashFlowReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data from backend
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Sub-navigation: 'bank-accounts' | 'transactions-ledger'
  const [activeSubTab, setActiveSubTab] = useState('bank-accounts');

  // Date Range Filters
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filters for Transactions Ledger
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [bankFilter, setBankFilter] = useState('ALL');

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

  const fetchCashFlowReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/reports/cash-flow`, {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined
        }
      });
      setSummary(res.data.summary || null);
      setForecast(res.data.forecast || null);
      setBankAccounts(res.data.bank_accounts || []);
      setMonthlyTrend(res.data.monthly_trend || []);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error('Error fetching cash flow reports:', err);
      setError(err.response?.data?.error || 'Failed to load cash flow reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashFlowReports();
  }, [startDate, endDate]);

  // Format Currency PKR
  const fmt = (val) => {
    const n = Number(val || 0);
    return `Rs ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = (t.client && t.client.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.bank && t.bank.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
      const matchesBank = bankFilter === 'ALL' || t.bank === bankFilter;

      return matchesSearch && matchesType && matchesBank;
    });
  }, [transactions, searchTerm, typeFilter, bankFilter]);

  // Paginated Transactions
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  // Chart Data: Bank Accounts Allocation Donut
  const bankDonutData = useMemo(() => {
    return bankAccounts.map(b => ({
      name: b.bank_name,
      value: Math.max(0, b.net_balance)
    })).filter(b => b.value > 0);
  }, [bankAccounts]);

  // Multi-Sheet Excel Export
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Cash Flow Transactions
    const txHeaders = ['Transaction ID', 'Date', 'Party / Client', 'Description', 'Bank Account', 'Mode', 'Type', 'Amount (PKR)', 'Category'];
    const txRows = transactions.map(t => [
      t.id, t.date ? t.date.slice(0, 10) : '-', t.client, t.description, t.bank, t.mode, t.type, t.amount, t.category
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Adwise Labs - Cash Flow & Business Health Audit'],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      txHeaders,
      ...txRows
    ]), 'Cash Transactions');

    // Sheet 2: Bank Balances
    const bankHeaders = ['Bank Account', 'Total Inflows', 'Total Outflows', 'Net Liquid Balance', 'Transactions Count'];
    const bankRows = bankAccounts.map(b => [
      b.bank_name, b.total_in, b.total_out, b.net_balance, b.transaction_count
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Treasury & Bank Account Balances'], [], bankHeaders, ...bankRows]), 'Bank Balances');

    // Sheet 3: Monthly Cash Trend
    const trendHeaders = ['Month', 'Cash In (Inflow)', 'Cash Out (Outflow)', 'Net Cash Flow', 'Cumulative Bank Balance'];
    const trendRows = monthlyTrend.map(m => [
      m.month, m.cash_in, m.cash_out, m.net_flow, m.cumulative_balance
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Monthly Cash Flow Progression'], [], trendHeaders, ...trendRows]), 'Monthly Cash Flow');

    XLSX.writeFile(wb, `Cash_Flow_Business_Health_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Corporate PDF Export
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Adwise Labs - Cash Flow & Business Health Audit', 30, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()} | Cash Position: ${fmt(summary?.current_cash_position)} | Runway: ${summary?.cash_runway_months} Months`, 30, 56);

    const headers = ['Date', 'Party / Client', 'Description', 'Bank Account', 'Mode', 'Type', 'Amount'];
    const body = transactions.map(t => [
      t.date ? t.date.slice(0, 10) : '-',
      t.client,
      t.description.length > 35 ? t.description.slice(0, 32) + '…' : t.description,
      t.bank,
      t.mode,
      t.type,
      fmt(t.amount)
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

    doc.save(`Cash_Flow_Audit_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="cash-flow-reports-view">
      {/* 1. Header & Controls */}
      <div className="cashflow-header-panel">
        <div className="header-info">
          <div className="header-badge">
            <Activity size={15} /> Treasury Liquidity & Cash Runway Intelligence
          </div>
          <h1>Cash Flow & Business Health</h1>
          <p className="header-subtext">
            Monitor real liquid bank positions, monthly burn rate, cash runway, and the vital distinction between accounting profit vs. realized cash in the bank.
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

          <button className="btn-export btn-export-excel" onClick={exportToExcel} title="Export full cash workbook">
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button className="btn-export btn-export-pdf" onClick={exportToPDF} title="Download certified PDF statement">
            <Download size={16} /> Export PDF
          </button>
          <button className="btn-refresh" onClick={fetchCashFlowReports} title="Refresh cash flow analytics">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

      {/* 2. Macro Liquidity & Runway KPI Cards (6 Cards) */}
      <div className="cashflow-kpi-grid">
        {/* Card 1: Liquid Cash Position */}
        <div className="cf-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">Liquid Cash Position</span>
            <div className="card-icon"><Landmark size={20} /></div>
          </div>
          <h2 className="card-value text-blue">{fmt(summary?.current_cash_position)}</h2>
          <div className="card-meta">
            <span className="meta-pill blue">Available Bank Treasury</span>
          </div>
        </div>

        {/* Card 2: Cash In (Inflows) */}
        <div className="cf-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Total Cash In</span>
            <div className="card-icon"><ArrowUpRight size={20} /></div>
          </div>
          <h2 className="card-value text-green">{fmt(summary?.total_cash_in)}</h2>
          <div className="card-meta">
            <span className="meta-pill green">Deposits & Client Receipts</span>
          </div>
        </div>

        {/* Card 3: Cash Out (Outflows) */}
        <div className="cf-kpi-card card-red">
          <div className="card-top">
            <span className="card-title">Total Cash Out</span>
            <div className="card-icon"><ArrowDownRight size={20} /></div>
          </div>
          <h2 className="card-value text-red">{fmt(summary?.total_cash_out)}</h2>
          <div className="card-meta">
            <span className="meta-pill red">OpEx + Supplier + Payrolls</span>
          </div>
        </div>

        {/* Card 4: Net Cash Flow */}
        <div className="cf-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Net Cash Flow</span>
            <div className="card-icon"><DollarSign size={20} /></div>
          </div>
          <h2 className="card-value text-purple">{fmt(summary?.net_cash_flow)}</h2>
          <div className="card-meta">
            <span className="meta-pill purple">Net Inflow Retention</span>
          </div>
        </div>

        {/* Card 5: Monthly Burn Rate */}
        <div className="cf-kpi-card card-orange">
          <div className="card-top">
            <span className="card-title">Monthly Burn Rate</span>
            <div className="card-icon"><Activity size={20} /></div>
          </div>
          <h2 className="card-value text-orange">{fmt(summary?.monthly_burn_rate)}</h2>
          <div className="card-meta">
            <span className="meta-pill orange">Avg Monthly Outflow</span>
          </div>
        </div>

        {/* Card 6: Cash Runway (Months) */}
        <div className="cf-kpi-card card-gold">
          <div className="card-top">
            <span className="card-title">Cash Runway</span>
            <div className="card-icon"><Zap size={20} /></div>
          </div>
          <h2 className="card-value text-gold">{summary?.cash_runway_months || 0} Months</h2>
          <div className="card-meta">
            <span className="meta-pill gold">Operations Survival Runway</span>
          </div>
        </div>
      </div>

      {/* 3. Accrual Profit vs. Realized Bank Cash Realization Comparison Banner */}
      <div className="profit-vs-cash-banner">
        <div className="pvc-left-info">
          <div className="pvc-tag"><ShieldCheck size={16} /> Core Business Health Insight</div>
          <h3>Profit vs. Realized Bank Cash Realization</h3>
          <p>
            Profit on paper does not equal cash in the bank. Realized cash conversion tracks the percentage of billed earnings that have actually cleared your bank treasury.
          </p>
        </div>

        <div className="pvc-metric-boxes">
          <div className="pvc-box">
            <span className="pvc-label">Billed Revenue</span>
            <span className="pvc-val">{fmt(summary?.accrual_revenue)}</span>
            <span className="pvc-sub">Invoiced Value</span>
          </div>
          <div className="pvc-box highlight-green">
            <span className="pvc-label">Realized Cash</span>
            <span className="pvc-val text-green">{fmt(summary?.realized_cash_collected)}</span>
            <span className="pvc-sub">Cash In Bank ({summary?.cash_realization_rate_pct}%)</span>
          </div>
          <div className="pvc-box highlight-orange">
            <span className="pvc-label">Trapped Receivables</span>
            <span className="pvc-val text-orange">{fmt(summary?.trapped_receivables)}</span>
            <span className="pvc-sub">Uncollected Cash</span>
          </div>
        </div>
      </div>

      {/* 4. 90-Day Cash Forecast Runway */}
      <div className="forecast-runway-container">
        <div className="forecast-header">
          <h4>
            <Clock size={18} color="#2563eb" /> 90-Day Projected Cash Forecast (Expected Receipts − Expected Payments)
          </h4>
        </div>
        <div className="forecast-cards-row">
          <div className="forecast-card fc-30">
            <span className="fc-timeline">30-Day Outlook</span>
            <h3 className="fc-val">{fmt(forecast?.day_30)}</h3>
            <span className="fc-sub">Estimated Net Treasury Position</span>
          </div>
          <div className="forecast-card fc-60">
            <span className="fc-timeline">60-Day Outlook</span>
            <h3 className="fc-val">{fmt(forecast?.day_60)}</h3>
            <span className="fc-sub">With 85% Expected Collections</span>
          </div>
          <div className="forecast-card fc-90">
            <span className="fc-timeline">90-Day Outlook</span>
            <h3 className="fc-val">{fmt(forecast?.day_90)}</h3>
            <span className="fc-sub">Mid-Quarter Treasury Trajectory</span>
          </div>
        </div>
      </div>

      {/* 5. Visual Analytics Grid */}
      <div className="analytics-dual-charts-grid">
        {/* Left Chart: Monthly Cash In vs Cash Out vs Net Flow */}
        <div className="chart-container-card">
          <div className="chart-card-header">
            <h4>
              <BarChart2 size={18} color="#2563eb" /> Monthly Cash Inflows vs Outflows (PKR)
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
                <Bar dataKey="cash_in" name="Cash In (PKR)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="cash_out" name="Cash Out (PKR)" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="net_flow" name="Net Cash Flow (PKR)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Cumulative Bank Balance Progression */}
        <div className="chart-container-card">
          <div className="chart-card-header">
            <h4>
              <TrendingUp size={18} color="#8b5cf6" /> Cumulative Bank Balance Progression
            </h4>
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, 'Bank Balance']} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="cumulative_balance" name="Liquid Bank Position" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5, fill: '#8b5cf6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 6. Sub-Navigation Tabs */}
      <div className="acct-view-tabs-bar">
        <button
          className={`acct-view-tab ${activeSubTab === 'bank-accounts' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('bank-accounts')}
        >
          <Landmark size={16} /> Bank Accounts & Treasury Allocation ({bankAccounts.length})
        </button>
        <button
          className={`acct-view-tab ${activeSubTab === 'transactions-ledger' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('transactions-ledger')}
        >
          <FileText size={16} /> Cash In / Cash Out Transactions Ledger ({transactions.length})
        </button>
      </div>

      {/* 7. TAB 1: Bank Accounts & Treasury Allocation */}
      {activeSubTab === 'bank-accounts' && (
        <div className="statement-sheet-card">
          <div className="statement-sheet-header">
            <h3>Bank Accounts Liquidity & Treasury Summary</h3>
            <p>Liquid capital breakdown across verified bank accounts, digital wallets, and cash in hand.</p>
          </div>

          <table className="financial-statement-table">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.85rem 1.5rem', textAlign: 'left' }}>Bank / Account Name</th>
                <th style={{ textAlign: 'right' }}>Total Cash In (Inflows)</th>
                <th style={{ textAlign: 'right' }}>Total Cash Out (Outflows)</th>
                <th style={{ textAlign: 'right' }}>Net Liquid Balance</th>
                <th style={{ textAlign: 'center', paddingRight: '1.5rem' }}>Transaction Volume</th>
              </tr>
            </thead>
            <tbody>
              {bankAccounts.map((b, idx) => (
                <tr key={idx}>
                  <td style={{ paddingLeft: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Landmark size={16} color="#2563eb" />
                      {b.bank_name}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmt(b.total_in)}</td>
                  <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(b.total_out)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: b.net_balance >= 0 ? '#0f172a' : '#ef4444' }}>
                    {fmt(b.net_balance)}
                  </td>
                  <td style={{ textAlign: 'center', paddingRight: '1.5rem', color: '#64748b', fontWeight: 600 }}>
                    {b.transaction_count} Transactions
                  </td>
                </tr>
              ))}
              <tr className="statement-grand-total-row">
                <td style={{ paddingLeft: '1.5rem', fontWeight: 800 }}>TOTAL TREASURY LIQUIDITY</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{fmt(summary?.total_cash_in)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{fmt(summary?.total_cash_out)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>{fmt(summary?.current_cash_position)}</td>
                <td style={{ textAlign: 'center', paddingRight: '1.5rem', fontWeight: 700 }}>{transactions.length} Total Records</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 8. TAB 2: Cash In / Cash Out Transactions Ledger */}
      {activeSubTab === 'transactions-ledger' && (
        <div className="service-matrix-card">
          <div className="matrix-header-bar">
            <div>
              <h4>Comprehensive Cash In / Cash Out Transactions Ledger</h4>
              <p>Showing {filteredTransactions.length} inflows and disbursements across all operating bank accounts</p>
            </div>

            <div className="matrix-filters-row">
              <div className="search-input-wrap">
                <Search size={15} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search party, description, bank, category..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <select
                className="tier-filter-dropdown"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="ALL">All Cash Flows</option>
                <option value="Cash In">Cash In (Inflow)</option>
                <option value="Cash Out">Cash Out (Outflow)</option>
              </select>

              <select
                className="tier-filter-dropdown"
                value={bankFilter}
                onChange={(e) => { setBankFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="ALL">All Banks</option>
                {bankAccounts.map((b, i) => (
                  <option key={i} value={b.bank_name}>{b.bank_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
            <table className="modern-service-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Party / Client</th>
                  <th>Description</th>
                  <th>Bank Account</th>
                  <th>Payment Mode</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>Type</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.length === 0 ? (
                  <tr><td colSpan="8" className="table-empty-cell">No matching cash flow transaction records found.</td></tr>
                ) : (
                  paginatedTransactions.map((t, idx) => (
                    <tr key={idx} className="service-row-hover">
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>{t.date ? t.date.slice(0, 10) : '-'}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{t.client}</div>
                      </td>
                      <td style={{ fontSize: '0.825rem', color: '#334155' }}>{t.description || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Landmark size={14} color="#64748b" />
                          <span style={{ fontWeight: 600 }}>{t.bank}</span>
                        </div>
                      </td>
                      <td>
                        <span className="obligation-tag">{t.mode}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{t.category}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`cflow-pill ${t.type === 'Cash In' ? 'cflow-in' : 'cflow-out'}`}>
                          {t.type === 'Cash In' ? '+ Cash In' : '− Cash Out'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: t.type === 'Cash In' ? '#10b981' : '#ef4444' }}>
                        {t.type === 'Cash In' ? `+${fmt(t.receipt_amount)}` : `-${fmt(t.payment_amount)}`}
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
                Showing <strong>{filteredTransactions.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredTransactions.length)}</strong> of <strong>{filteredTransactions.length}</strong> transactions
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
              totalItems={filteredTransactions.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
