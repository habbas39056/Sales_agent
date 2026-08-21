import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FileSpreadsheet, Download, RefreshCw, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, DollarSign, CreditCard, Clock, ShieldCheck,
  Activity, ArrowUpRight, ArrowDownRight, Layers, PieChart as PieChartIcon,
  BarChart2, FileText, ChevronRight, MessageCircle, MessageSquare, Mail, Building, Wallet,
  Calendar, Percent, HelpCircle, Search, Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './AccountingReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const AGING_COLORS = {
  current: '#10b981',
  aging_1_30: '#f59e0b',
  aging_31_60: '#f97316',
  aging_61_90: '#ef4444',
  aging_90_plus: '#991b1b'
};

export default function AccountingReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Server Data
  const [summary, setSummary] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [receivablesAr, setReceivablesAr] = useState(null);
  const [payablesAp, setPayablesAp] = useState(null);
  const [trialBalance, setTrialBalance] = useState(null);

  // Active Main Tab
  // 'statements' | 'receivables' | 'payables' | 'trial-balance' | 'ratios'
  const [activeTab, setActiveTab] = useState('statements');

  // Statements sub-tab: 'pnl' | 'balance-sheet' | 'cash-flow'
  const [statementSubTab, setStatementSubTab] = useState('pnl');

  // Date Range Filters
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Search & Pagination for AR & AP sub-tables
  const [arSearchTerm, setArSearchTerm] = useState('');
  const [arPage, setArPage] = useState(1);
  const [arItemsPerPage, setArItemsPerPage] = useState(10);

  const [apSearchTerm, setApSearchTerm] = useState('');
  const [apPage, setApPage] = useState(1);
  const [apItemsPerPage, setApItemsPerPage] = useState(10);

  // Apply Date Preset
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

  const fetchAccountingData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/reports/accounting`, {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined
        }
      });
      setSummary(res.data.summary || null);
      setPnl(res.data.pnl_statement || null);
      setBalanceSheet(res.data.balance_sheet || null);
      setCashFlow(res.data.cash_flow_statement || null);
      setReceivablesAr(res.data.receivables_ar || null);
      setPayablesAp(res.data.payables_ap || null);
      setTrialBalance(res.data.trial_balance || null);
    } catch (err) {
      console.error('Error loading accounting data:', err);
      setError(err.response?.data?.error || 'Failed to load comprehensive accounting records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountingData();
  }, [startDate, endDate]);

  // Format Currency PKR
  const fmt = (val) => {
    const n = Number(val || 0);
    return `Rs ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Generate Automated WhatsApp Payment Reminder Message
  const getWhatsAppReminderUrl = (client) => {
    if (!client.client_phone) return '#';
    const cleanPhone = client.client_phone.replace(/[^0-9]/g, '');
    const msg = `*PAYMENT REMINDER - ADWISE LABS*\n\n` +
      `Dear *${client.client_name}*,\n\n` +
      `This is an automated notification regarding your pending invoice balance with Adwise Labs:\n\n` +
      `📌 *Total Outstanding Balance:* Rs. ${Number(client.total_balance || 0).toLocaleString()}\n` +
      (client.aging_90_plus > 0 ? `⚠️ *Overdue (90+ Days):* Rs. ${Number(client.aging_90_plus).toLocaleString()}\n` : '') +
      (client.aging_31_60 > 0 ? `⚠️ *Overdue (31–60 Days):* Rs. ${Number(client.aging_31_60).toLocaleString()}\n` : '') +
      (client.aging_1_30 > 0 ? `⚠️ *Overdue (1–30 Days):* Rs. ${Number(client.aging_1_30).toLocaleString()}\n` : '') +
      (client.current_due > 0 ? `ℹ️ *Current Due:* Rs. ${Number(client.current_due).toLocaleString()}\n` : '') +
      `\nPlease clear the outstanding payment at your earliest convenience. If you have already processed this transaction, kindly ignore this message.\n\n` +
      `Best regards,\n*Adwise Labs Finance & Accounts*`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  // Filtered Client AR List
  const filteredClientAr = useMemo(() => {
    const list = receivablesAr?.client_matrix || [];
    if (!arSearchTerm.trim()) return list;
    const term = arSearchTerm.toLowerCase();
    return list.filter(c =>
      (c.client_name && c.client_name.toLowerCase().includes(term)) ||
      (c.business_name && c.business_name.toLowerCase().includes(term)) ||
      (c.client_email && c.client_email.toLowerCase().includes(term))
    );
  }, [receivablesAr, arSearchTerm]);

  const paginatedClientAr = useMemo(() => {
    const start = (arPage - 1) * arItemsPerPage;
    return filteredClientAr.slice(start, start + arItemsPerPage);
  }, [filteredClientAr, arPage, arItemsPerPage]);

  // Filtered AP List
  const filteredPayables = useMemo(() => {
    const list = payablesAp?.payables_ledger || [];
    if (!apSearchTerm.trim()) return list;
    const term = apSearchTerm.toLowerCase();
    return list.filter(p =>
      (p.payee_name && p.payee_name.toLowerCase().includes(term)) ||
      (p.obligation_type && p.obligation_type.toLowerCase().includes(term)) ||
      (p.role && p.role.toLowerCase().includes(term))
    );
  }, [payablesAp, apSearchTerm]);

  const paginatedPayables = useMemo(() => {
    const start = (apPage - 1) * apItemsPerPage;
    return filteredPayables.slice(start, start + apItemsPerPage);
  }, [filteredPayables, apPage, apItemsPerPage]);

  // Chart Data: AR Aging Buckets
  const arAgingChartData = useMemo(() => {
    const b = receivablesAr?.buckets;
    if (!b) return [];
    return [
      { name: 'Current', amount: b.current, fill: AGING_COLORS.current },
      { name: '1–30 Days', amount: b.aging_1_30, fill: AGING_COLORS.aging_1_30 },
      { name: '31–60 Days', amount: b.aging_31_60, fill: AGING_COLORS.aging_31_60 },
      { name: '61–90 Days', amount: b.aging_61_90, fill: AGING_COLORS.aging_61_90 },
      { name: '90+ Days', amount: b.aging_90_plus, fill: AGING_COLORS.aging_90_plus }
    ];
  }, [receivablesAr]);

  // Chart Data: AP Aging Buckets
  const apAgingChartData = useMemo(() => {
    const b = payablesAp?.buckets;
    if (!b) return [];
    return [
      { name: '1–7 Days (Now)', amount: b.immediate_1_7d, fill: '#ef4444' },
      { name: '8–30 Days', amount: b.upcoming_8_30d, fill: '#f59e0b' },
      { name: '31–60 Days', amount: b.aging_31_60, fill: '#f97316' },
      { name: '61–90 Days', amount: b.aging_61_90, fill: '#dc2626' },
      { name: '90+ Days', amount: b.aging_90_plus, fill: '#991b1b' }
    ];
  }, [payablesAp]);

  // Export to Multi-Sheet Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Profit & Loss Statement
    const pnlRows = [
      ['Adwise Labs - Profit & Loss (Income Statement)'],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Account Line Item', 'Amount (PKR)', 'Margin / %'],
      ['1. GROSS REVENUE & INFLOWS'],
      ['Total Invoiced Revenue', pnl?.revenue.total_billed_revenue || 0, '100%'],
      ['Total Collected Cash Receipts', pnl?.revenue.total_collected_revenue || 0, '-'],
      ['Uncollected Receivables', pnl?.revenue.uncollected_receivables || 0, '-'],
      [],
      ['2. COST OF GOODS SOLD (COGS)'],
      ['Direct Project & Reimbursable Costs', pnl?.cogs.direct_project_costs || 0, '-'],
      ['GROSS PROFIT', pnl?.gross_profit || 0, `${pnl?.gross_profit_margin || 0}%`],
      [],
      ['3. OPERATING EXPENSES (OpEx)'],
      ...(pnl?.operating_expenses.categories || []).map(c => [c.category_name, c.amount, `${c.percentage}%`]),
      ['TOTAL OPERATING EXPENSES', pnl?.operating_expenses.total_opex || 0, '-'],
      [],
      ['4. NET OPERATING PROFIT / (LOSS)', pnl?.net_operating_income || 0, `${pnl?.net_profit_margin || 0}%`]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pnlRows), 'Profit & Loss');

    // Sheet 2: Balance Sheet
    const bsRows = [
      ['Adwise Labs - Balance Sheet (Statement of Financial Position)'],
      [`As of: ${new Date().toLocaleDateString()}`],
      [],
      ['Assets & Liabilities', 'Amount (PKR)'],
      ['1. CURRENT ASSETS'],
      ['Cash & Liquid Bank Accounts', balanceSheet?.assets.current_assets.cash_and_banks || 0],
      ['Accounts Receivable (Trade Debtors)', balanceSheet?.assets.current_assets.accounts_receivable || 0],
      ['TOTAL CURRENT ASSETS', balanceSheet?.assets.current_assets.total_current_assets || 0],
      ['TOTAL ASSETS', balanceSheet?.assets.total_assets || 0],
      [],
      ['2. CURRENT LIABILITIES'],
      ['Accounts Payable & Obligations', balanceSheet?.liabilities.current_liabilities.accounts_payable || 0],
      ['Pending Staff Payroll Obligations', balanceSheet?.liabilities.current_liabilities.pending_payroll_obligations || 0],
      ['TOTAL LIABILITIES', balanceSheet?.liabilities.total_liabilities || 0],
      [],
      ['3. EQUITY & RETAINED SURPLUS'],
      ['Retained Earnings / Surplus', balanceSheet?.equity.retained_earnings || 0],
      ['TOTAL LIABILITIES & EQUITY', (balanceSheet?.liabilities.total_liabilities || 0) + (balanceSheet?.equity.total_equity || 0)]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bsRows), 'Balance Sheet');

    // Sheet 3: Receivables (AR) Aging Ledger
    const arHeaders = ['Client Name', 'Business Name', 'Total Invoiced (PKR)', 'Total Paid (PKR)', 'Outstanding Balance (PKR)', 'Current', '1–30d', '31–60d', '61–90d', '90+d', 'Collection Rate %'];
    const arData = (receivablesAr?.client_matrix || []).map(c => [
      c.client_name, c.business_name, c.total_invoiced, c.total_paid, c.total_balance,
      c.current_due, c.aging_1_30, c.aging_31_60, c.aging_61_90, c.aging_90_plus, `${c.collection_rate}%`
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Accounts Receivable (AR) 5-Tier Aging Ledger'], [], arHeaders, ...arData]), 'AR Aging Ledger');

    // Sheet 4: Accounts Payable (AP) Obligations
    const apHeaders = ['Obligation ID', 'Obligation Type', 'Payee / Employee', 'Role / Department', 'Amount Due (PKR)', 'Due Date', 'Aging Bucket', 'Status'];
    const apData = (payablesAp?.payables_ledger || []).map(p => [
      p.id, p.obligation_type, p.payee_name, p.role || '-', p.amount_due, p.due_date, p.aging_bucket, p.status
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Accounts Payable (AP) & Obligations Ledger'], [], apHeaders, ...apData]), 'AP Obligations Ledger');

    // Sheet 5: Trial Balance
    const tbHeaders = ['Account Code', 'Account Name', 'Account Class', 'Debit (PKR)', 'Credit (PKR)'];
    const tbData = (trialBalance?.accounts || []).map(a => [a.code, a.name, a.type, a.debit, a.credit]);
    tbData.push(['TOTALS', '', '', trialBalance?.total_debits || 0, trialBalance?.total_credits || 0]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Trial Balance (Double-Entry Ledger)'], [], tbHeaders, ...tbData]), 'Trial Balance');

    XLSX.writeFile(wb, `Finance_Accounting_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to Corporate PDF Statement
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Adwise Labs - Certified Corporate Accounting & Financial Report', 30, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()} | Financial Position & Aging Audit`, 30, 56);

    // Summary Box
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Liquid Cash: ${fmt(summary?.total_liquid_cash)} | AR: ${fmt(summary?.total_receivables)} | AP: ${fmt(summary?.total_payables)} | Working Capital: ${fmt(summary?.net_working_capital)}`, 30, 75);

    // AR Aging Table
    const headers = ['Client Name', 'Total Invoiced', 'Total Paid', 'Total Balance', 'Current', '1–30d', '31–60d', '90+d', 'Rate %'];
    const body = (receivablesAr?.client_matrix || []).map(c => [
      c.client_name,
      fmt(c.total_invoiced),
      fmt(c.total_paid),
      fmt(c.total_balance),
      fmt(c.current_due),
      fmt(c.aging_1_30),
      fmt(c.aging_31_60),
      fmt(c.aging_90_plus),
      `${c.collection_rate}%`
    ]);

    autoTable(doc, {
      startY: 95,
      head: [headers],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 30, right: 30 }
    });

    doc.save(`Accounting_Financial_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="professional-accounting-report">
      {/* 1. Header Panel */}
      <div className="accounting-header-panel">
        <div className="header-info">
          <div className="header-badge">
            <Building size={15} /> Certified Accounting & Corporate Governance
          </div>
          <h1>Finance & Accounting Suite</h1>
          <p className="header-subtext">
            Complete institutional accounting: P&L Statement, Balance Sheet, Cash Flow, 5-Tier Receivables Aging (AR), and deep Payables (AP) Obligations Intelligence.
          </p>
        </div>

        <div className="header-action-group">
          {/* Date Presets & Date Pickers */}
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

          <button className="btn-export btn-export-excel" onClick={exportToExcel} title="Export full workbook">
            <FileSpreadsheet size={16} /> Export Excel (.xlsx)
          </button>
          <button className="btn-export btn-export-pdf" onClick={exportToPDF} title="Download certified PDF statement">
            <Download size={16} /> Export PDF (.pdf)
          </button>
          <button className="btn-refresh" onClick={fetchAccountingData} title="Refresh accounting data">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

      {/* 2. Macro Accounting KPI Grid (6 Cards) */}
      <div className="accounting-kpi-grid">
        {/* Card 1: Total Liquid Cash */}
        <div className="acct-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Total Liquid Cash</span>
            <div className="card-icon"><Wallet size={20} /></div>
          </div>
          <h2 className="card-value text-green">{fmt(summary?.total_liquid_cash || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill green">
              <CheckCircle size={12} /> Cash & Bank Balances
            </span>
          </div>
        </div>

        {/* Card 2: Accounts Receivable (AR) */}
        <div className="acct-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">Accounts Receivable (AR)</span>
            <div className="card-icon"><ArrowDownRight size={20} /></div>
          </div>
          <h2 className="card-value text-blue">{fmt(summary?.total_receivables || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill blue">
              Unpaid Invoices Owed
            </span>
          </div>
        </div>

        {/* Card 3: Accounts Payable (AP) */}
        <div className="acct-kpi-card card-red">
          <div className="card-top">
            <span className="card-title">Accounts Payable (AP)</span>
            <div className="card-icon"><ArrowUpRight size={20} /></div>
          </div>
          <h2 className="card-value text-red">{fmt(summary?.total_payables || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill red">
              Pending Payroll & Vendors
            </span>
          </div>
        </div>

        {/* Card 4: Net Working Capital */}
        <div className="acct-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Net Working Capital</span>
            <div className="card-icon"><Layers size={20} /></div>
          </div>
          <h2 className="card-value text-purple">{fmt(summary?.net_working_capital || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill purple">
              Liquid Assets minus AP
            </span>
          </div>
        </div>

        {/* Card 5: Current & Quick Ratio */}
        <div className="acct-kpi-card card-teal">
          <div className="card-top">
            <span className="card-title">Current / Quick Ratio</span>
            <div className="card-icon"><ShieldCheck size={20} /></div>
          </div>
          <h2 className="card-value text-teal">{summary?.current_ratio || 0}x</h2>
          <div className="card-meta">
            <span className="meta-pill teal">
              Solvency: Quick {summary?.quick_ratio || 0}x
            </span>
          </div>
        </div>

        {/* Card 6: Cash Runway */}
        <div className="acct-kpi-card card-orange">
          <div className="card-top">
            <span className="card-title">Cash Buffer Runway</span>
            <div className="card-icon"><Activity size={20} /></div>
          </div>
          <h2 className="card-value text-orange">{summary?.cash_buffer_runway_months || 0} Mo</h2>
          <div className="card-meta">
            <span className="meta-pill orange">
              OpEx Burn Coverage
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Navigation Tabs */}
      <div className="acct-view-tabs-bar">
        <button
          className={`acct-view-tab ${activeTab === 'statements' ? 'active' : ''}`}
          onClick={() => setActiveTab('statements')}
        >
          <FileText size={16} /> Financial Statements (P&L, Balance Sheet, Cash Flow)
        </button>
        <button
          className={`acct-view-tab ${activeTab === 'receivables' ? 'active' : ''}`}
          onClick={() => setActiveTab('receivables')}
        >
          <ArrowDownRight size={16} /> Accounts Receivable & 5 Aging Buckets ({receivablesAr?.outstanding_invoices.length || 0})
        </button>
        <button
          className={`acct-view-tab ${activeTab === 'payables' ? 'active' : ''}`}
          onClick={() => setActiveTab('payables')}
        >
          <ArrowUpRight size={16} /> Accounts Payable & Obligations ({payablesAp?.payables_ledger.length || 0})
        </button>
        <button
          className={`acct-view-tab ${activeTab === 'trial-balance' ? 'active' : ''}`}
          onClick={() => setActiveTab('trial-balance')}
        >
          <Layers size={16} /> Trial Balance & General Ledger
        </button>
      </div>

      {/* 4. TAB 1: Financial Statements (P&L, Balance Sheet, Cash Flow) */}
      {activeTab === 'statements' && (
        <div className="statements-container">
          {/* Sub-tab Switcher */}
          <div className="statement-subtabs">
            <button
              className={`subtab-btn ${statementSubTab === 'pnl' ? 'active' : ''}`}
              onClick={() => setStatementSubTab('pnl')}
            >
              📊 Profit & Loss (Income Statement)
            </button>
            <button
              className={`subtab-btn ${statementSubTab === 'balance-sheet' ? 'active' : ''}`}
              onClick={() => setStatementSubTab('balance-sheet')}
            >
              ⚖️ Balance Sheet (Financial Position)
            </button>
            <button
              className={`subtab-btn ${statementSubTab === 'cash-flow' ? 'active' : ''}`}
              onClick={() => setStatementSubTab('cash-flow')}
            >
              💧 Cash Flow Statement
            </button>
          </div>

          {/* Statement View 1: Profit & Loss */}
          {statementSubTab === 'pnl' && (
            <div className="statement-sheet-card">
              <div className="statement-sheet-header">
                <h3>Profit & Loss Statement (Income Statement)</h3>
                <p>Period: Verified Year-to-Date Performance</p>
              </div>

              <table className="financial-statement-table">
                <tbody>
                  {/* Revenue Section */}
                  <tr className="statement-section-header">
                    <td colSpan="2">1. GROSS REVENUE</td>
                    <td style={{ textAlign: 'right' }}>Amount (PKR)</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '2rem' }}>Gross Billed Agency Revenue (Invoices)</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(pnl?.revenue.total_billed_revenue)}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '2rem', color: '#64748b' }}>- Total Collected Receipts</td>
                    <td></td>
                    <td style={{ textAlign: 'right', color: '#10b981' }}>{fmt(pnl?.revenue.total_collected_revenue)}</td>
                  </tr>
                  <tr className="statement-subtotal-row">
                    <td>TOTAL REVENUE</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{fmt(pnl?.revenue.total_billed_revenue)}</td>
                  </tr>

                  {/* COGS Section */}
                  <tr className="statement-section-header">
                    <td colSpan="2">2. COST OF GOODS SOLD (COGS)</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '2rem' }}>Direct Project Costs & Reimbursables</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>{fmt(pnl?.cogs.direct_project_costs)}</td>
                  </tr>
                  <tr className="statement-subtotal-row">
                    <td>GROSS PROFIT</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>Margin: {pnl?.gross_profit_margin}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(pnl?.gross_profit)}</td>
                  </tr>

                  {/* OpEx Section */}
                  <tr className="statement-section-header">
                    <td colSpan="2">3. OPERATING EXPENDITURES (OpEx)</td>
                    <td></td>
                  </tr>
                  {(pnl?.operating_expenses.categories || []).map((cat, idx) => (
                    <tr key={idx}>
                      <td style={{ paddingLeft: '2rem' }}>{cat.category_name}</td>
                      <td style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>{cat.percentage}% of OpEx</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>{fmt(cat.amount)}</td>
                    </tr>
                  ))}
                  <tr className="statement-subtotal-row">
                    <td>TOTAL OPERATING EXPENSES</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{fmt(pnl?.operating_expenses.total_opex)}</td>
                  </tr>

                  {/* Net Operating Income */}
                  <tr className="statement-grand-total-row">
                    <td style={{ fontWeight: 800, fontSize: '1rem' }}>NET OPERATING INCOME / (LOSS)</td>
                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' }}>Net Margin: {pnl?.net_profit_margin}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.15rem', color: (pnl?.net_operating_income || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                      {fmt(pnl?.net_operating_income)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Statement View 2: Balance Sheet */}
          {statementSubTab === 'balance-sheet' && (
            <div className="statement-sheet-card">
              <div className="statement-sheet-header">
                <h3>Balance Sheet (Statement of Financial Position)</h3>
                <p>Assets = Liabilities + Equity (Balanced Double-Entry)</p>
              </div>

              <table className="financial-statement-table">
                <tbody>
                  {/* Assets */}
                  <tr className="statement-section-header">
                    <td colSpan="2">1. CURRENT ASSETS</td>
                    <td style={{ textAlign: 'right' }}>Amount (PKR)</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '2rem' }}>Cash & Bank Account Balances</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{fmt(balanceSheet?.assets.current_assets.cash_and_banks)}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '2rem' }}>Accounts Receivable (Trade Debtors)</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>{fmt(balanceSheet?.assets.current_assets.accounts_receivable)}</td>
                  </tr>
                  <tr className="statement-subtotal-row">
                    <td>TOTAL CURRENT ASSETS</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmt(balanceSheet?.assets.current_assets.total_current_assets)}</td>
                  </tr>
                  <tr className="statement-grand-total-row" style={{ background: '#f8fafc' }}>
                    <td style={{ fontWeight: 800 }}>TOTAL ASSETS</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{fmt(balanceSheet?.assets.total_assets)}</td>
                  </tr>

                  {/* Liabilities */}
                  <tr className="statement-section-header">
                    <td colSpan="2">2. CURRENT LIABILITIES</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '2rem' }}>Accounts Payable (Trade Creditors)</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>{fmt(balanceSheet?.liabilities.current_liabilities.accounts_payable)}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '2rem' }}>Pending Staff Payroll Obligations</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>{fmt(balanceSheet?.liabilities.current_liabilities.pending_payroll_obligations)}</td>
                  </tr>
                  <tr className="statement-subtotal-row">
                    <td>TOTAL CURRENT LIABILITIES</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{fmt(balanceSheet?.liabilities.total_liabilities)}</td>
                  </tr>

                  {/* Equity */}
                  <tr className="statement-section-header">
                    <td colSpan="2">3. EQUITY & RETAINED SURPLUS</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '2rem' }}>Retained Surplus / Net Working Capital</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#8b5cf6' }}>{fmt(balanceSheet?.equity.retained_earnings)}</td>
                  </tr>
                  <tr className="statement-grand-total-row">
                    <td style={{ fontWeight: 800 }}>TOTAL LIABILITIES & EQUITY</td>
                    <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 700 }}>
                      <CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Balanced
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {fmt((balanceSheet?.liabilities.total_liabilities || 0) + (balanceSheet?.equity.total_equity || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Statement View 3: Cash Flow Statement */}
          {statementSubTab === 'cash-flow' && (
            <div className="statement-sheet-card">
              <div className="statement-sheet-header">
                <h3>Cash Flow Statement (Direct Method)</h3>
                <p>Tracking actual cash receipts, disbursements, and net cash generation</p>
              </div>

              <table className="financial-statement-table">
                <tbody>
                  <tr className="statement-section-header">
                    <td colSpan="2">1. CASH FLOWS FROM OPERATING ACTIVITIES</td>
                    <td style={{ textAlign: 'right' }}>Amount (PKR)</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '2rem' }}>Cash Receipts from Clients & Collections</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{fmt(cashFlow?.operating_activities.cash_receipts_from_clients)}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '2rem' }}>Cash Payments for Operations & Staff</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>-{fmt(cashFlow?.operating_activities.cash_payments_for_operations)}</td>
                  </tr>
                  <tr className="statement-subtotal-row">
                    <td>NET CASH GENERATED FROM OPERATING ACTIVITIES</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: (cashFlow?.operating_activities.net_cash_from_operations || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                      {fmt(cashFlow?.operating_activities.net_cash_from_operations)}
                    </td>
                  </tr>

                  <tr className="statement-grand-total-row">
                    <td style={{ fontWeight: 800 }}>ENDING CASH & LIQUID BANK POSITION</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>
                      {fmt(cashFlow?.ending_cash_position)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 2: Accounts Receivable (AR) & 5-Tier Aging Buckets */}
      {activeTab === 'receivables' && (
        <div className="ar-aging-view-container">
          {/* 5 Aging Buckets Summary Row */}
          <div className="aging-buckets-grid">
            <div className="bucket-card bucket-current">
              <span className="bucket-name">Current (Not Due)</span>
              <h3 className="bucket-val">{fmt(receivablesAr?.buckets.current)}</h3>
              <span className="bucket-sub">In Good Standing</span>
            </div>
            <div className="bucket-card bucket-1-30">
              <span className="bucket-name">1–30 Days Overdue</span>
              <h3 className="bucket-val">{fmt(receivablesAr?.buckets.aging_1_30)}</h3>
              <span className="bucket-sub">Follow-up Due</span>
            </div>
            <div className="bucket-card bucket-31-60">
              <span className="bucket-name">31–60 Days Overdue</span>
              <h3 className="bucket-val">{fmt(receivablesAr?.buckets.aging_31_60)}</h3>
              <span className="bucket-sub">Attention Required</span>
            </div>
            <div className="bucket-card bucket-61-90">
              <span className="bucket-name">61–90 Days Overdue</span>
              <h3 className="bucket-val">{fmt(receivablesAr?.buckets.aging_61_90)}</h3>
              <span className="bucket-sub">High Priority</span>
            </div>
            <div className="bucket-card bucket-90-plus">
              <span className="bucket-name">90+ Days Overdue</span>
              <h3 className="bucket-val">{fmt(receivablesAr?.buckets.aging_90_plus)}</h3>
              <span className="bucket-sub">Critical / Bad Debt Risk</span>
            </div>
          </div>

          {/* AR Aging Bar Chart */}
          <div className="ar-chart-card">
            <div className="chart-header">
              <h4>
                <BarChart2 size={17} color="#2563eb" /> Accounts Receivable Aging Distribution (PKR)
              </h4>
            </div>
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arAgingChartData} margin={{ top: 15, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, 'Owed Balance']} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {arAgingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Client-wise Receivables Aging Matrix Table */}
          <div className="ar-table-card">
            <div className="table-header-bar">
              <div>
                <h4>Client-wise Receivables Aging Ledger</h4>
                <p>Showing {filteredClientAr.length} clients with invoice receivables</p>
              </div>

              <div className="search-bar-wrap">
                <Search size={16} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search client, business name..."
                  value={arSearchTerm}
                  onChange={(e) => { setArSearchTerm(e.target.value); setArPage(1); }}
                />
              </div>
            </div>

            <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
              <table className="modern-ar-table">
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th style={{ textAlign: 'right' }}>Total Invoiced</th>
                    <th style={{ textAlign: 'right' }}>Total Paid</th>
                    <th style={{ textAlign: 'right' }}>Balance Owed</th>
                    <th style={{ textAlign: 'right' }}>Current</th>
                    <th style={{ textAlign: 'right' }}>1–30d</th>
                    <th style={{ textAlign: 'right' }}>31–60d</th>
                    <th style={{ textAlign: 'right' }}>90+d</th>
                    <th style={{ textAlign: 'center' }}>Collection Rate</th>
                    <th style={{ textAlign: 'center' }}>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClientAr.length === 0 ? (
                    <tr><td colSpan="10" className="table-empty-cell">No client receivables records.</td></tr>
                  ) : (
                    paginatedClientAr.map((c, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.client_name}</div>
                          {c.business_name && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.business_name}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(c.total_invoiced)}</td>
                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmt(c.total_paid)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>{fmt(c.total_balance)}</td>
                        <td style={{ textAlign: 'right', color: '#10b981' }}>{fmt(c.current_due)}</td>
                        <td style={{ textAlign: 'right', color: '#f59e0b' }}>{fmt(c.aging_1_30)}</td>
                        <td style={{ textAlign: 'right', color: '#f97316' }}>{fmt(c.aging_31_60)}</td>
                        <td style={{ textAlign: 'right', color: '#991b1b', fontWeight: 700 }}>{fmt(c.aging_90_plus)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`rate-pill ${c.collection_rate >= 80 ? 'rate-high' : (c.collection_rate >= 50 ? 'rate-mid' : 'rate-low')}`}>
                            {c.collection_rate}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            {c.client_phone && (
                              <a
                                href={getWhatsAppReminderUrl(c)}
                                target="_blank"
                                rel="noreferrer"
                                className="icon-contact-btn icon-whatsapp-btn"
                                title="Send WhatsApp Payment Notification"
                              >
                                <MessageCircle size={15} color="#10b981" />
                              </a>
                            )}
                            {c.client_email && (
                              <a
                                href={`mailto:${c.client_email}?subject=Payment%20Reminder%20for%20Outstanding%20Invoices&body=Dear%20${encodeURIComponent(c.client_name)},%0D%0A%0D%0APlease%20be%20reminded%20that%20you%20have%20an%20outstanding%20balance%20of%20Rs.%20${Number(c.total_balance || 0).toLocaleString()}%20with%20Adwise%20Labs.%0D%0A%0D%0AThank%20you,%0D%0AAdwise%20Labs%20Finance`}
                                className="icon-contact-btn"
                                title="Email Statement"
                              >
                                <Mail size={14} color="#2563eb" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="ledger-pagination-bar">
              <div className="pagination-left-controls">
                <span className="pagination-showing-text">
                  Showing <strong>{filteredClientAr.length === 0 ? 0 : (arPage - 1) * arItemsPerPage + 1}</strong> to <strong>{Math.min(arPage * arItemsPerPage, filteredClientAr.length)}</strong> of <strong>{filteredClientAr.length}</strong> clients
                </span>
                <div className="rows-per-page-selector">
                  <label>Rows per page:</label>
                  <select value={arItemsPerPage} onChange={(e) => { setArItemsPerPage(Number(e.target.value)); setArPage(1); }}>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
              <Pagination
                currentPage={arPage}
                totalItems={filteredClientAr.length}
                itemsPerPage={arItemsPerPage}
                onPageChange={setArPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 3: Accounts Payable (AP) & Obligations (CRITICAL) */}
      {activeTab === 'payables' && (
        <div className="ap-obligations-view-container">
          {/* AP 5-Tier Aging Buckets */}
          <div className="aging-buckets-grid">
            <div className="bucket-card bucket-ap-1-7">
              <span className="bucket-name">Immediate (1–7 Days)</span>
              <h3 className="bucket-val text-red">{fmt(payablesAp?.buckets.immediate_1_7d)}</h3>
              <span className="bucket-sub">Critical Outflow Due</span>
            </div>
            <div className="bucket-card bucket-ap-8-30">
              <span className="bucket-name">Upcoming (8–30 Days)</span>
              <h3 className="bucket-val">{fmt(payablesAp?.buckets.upcoming_8_30d)}</h3>
              <span className="bucket-sub">Monthly Run Commitments</span>
            </div>
            <div className="bucket-card bucket-31-60">
              <span className="bucket-name">31–60 Days Past Due</span>
              <h3 className="bucket-val">{fmt(payablesAp?.buckets.aging_31_60)}</h3>
              <span className="bucket-sub">Deferred Obligations</span>
            </div>
            <div className="bucket-card bucket-61-90">
              <span className="bucket-name">61–90 Days Past Due</span>
              <h3 className="bucket-val">{fmt(payablesAp?.buckets.aging_61_90)}</h3>
              <span className="bucket-sub">Pending Review</span>
            </div>
            <div className="bucket-card bucket-90-plus">
              <span className="bucket-name">90+ Days Past Due</span>
              <h3 className="bucket-val">{fmt(payablesAp?.buckets.aging_90_plus)}</h3>
              <span className="bucket-sub">Aged Payables</span>
            </div>
          </div>

          {/* Payables Intelligence Cards: Liquidity vs AP Obligations */}
          <div className="ap-liquidity-summary-row">
            <div className="liquidity-info-card">
              <div className="liq-icon"><ShieldCheck size={24} color="#10b981" /></div>
              <div>
                <h4>Total Liquid Cash on Hand</h4>
                <p className="liq-val text-green">{fmt(summary?.total_liquid_cash)}</p>
                <span className="liq-sub">Available across all verified bank accounts</span>
              </div>
            </div>

            <div className="liquidity-info-card">
              <div className="liq-icon"><AlertTriangle size={24} color="#ef4444" /></div>
              <div>
                <h4>Total Immediate Accounts Payable (AP)</h4>
                <p className="liq-val text-red">{fmt(summary?.total_payables)}</p>
                <span className="liq-sub">Pending staff payroll + vendor commitments</span>
              </div>
            </div>

            <div className="liquidity-info-card">
              <div className="liq-icon"><Activity size={24} color="#2563eb" /></div>
              <div>
                <h4>Solvency & Liquidity Coverage Multiple</h4>
                <p className="liq-val text-blue">{summary?.quick_ratio}x</p>
                <span className="liq-sub">Cash covers payables by {summary?.quick_ratio}x</span>
              </div>
            </div>
          </div>

          {/* Payables Detail Ledger Table */}
          <div className="ar-table-card">
            <div className="table-header-bar">
              <div>
                <h4>Accounts Payable & Staff Salary Obligations Ledger</h4>
                <p>Showing {filteredPayables.length} verified obligations awaiting payment</p>
              </div>

              <div className="search-bar-wrap">
                <Search size={16} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search payee, employee, obligation type..."
                  value={apSearchTerm}
                  onChange={(e) => { setApSearchTerm(e.target.value); setApPage(1); }}
                />
              </div>
            </div>

            <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
              <table className="modern-ar-table">
                <thead>
                  <tr>
                    <th>Obligation ID</th>
                    <th>Obligation Type</th>
                    <th>Payee / Employee Name</th>
                    <th>Role / Department</th>
                    <th>Target Month</th>
                    <th>Due Date</th>
                    <th style={{ textAlign: 'right' }}>Amount Due</th>
                    <th style={{ textAlign: 'center' }}>Aging Bucket</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayables.length === 0 ? (
                    <tr><td colSpan="9" className="table-empty-cell">No pending accounts payable obligations!</td></tr>
                  ) : (
                    paginatedPayables.map((p, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: '#64748b' }}>{p.id}</td>
                        <td>
                          <span className="obligation-tag">
                            {p.obligation_type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>{p.payee_name}</td>
                        <td style={{ color: '#64748b' }}>{p.role || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{p.reference_month || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{p.due_date}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                          {fmt(p.amount_due)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="ap-bucket-pill">
                            {p.aging_bucket}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-pill status-${p.status === 'Overdue' ? 'deficit' : 'surplus'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="ledger-pagination-bar">
              <div className="pagination-left-controls">
                <span className="pagination-showing-text">
                  Showing <strong>{filteredPayables.length === 0 ? 0 : (apPage - 1) * apItemsPerPage + 1}</strong> to <strong>{Math.min(apPage * apItemsPerPage, filteredPayables.length)}</strong> of <strong>{filteredPayables.length}</strong> obligations
                </span>
                <div className="rows-per-page-selector">
                  <label>Rows per page:</label>
                  <select value={apItemsPerPage} onChange={(e) => { setApItemsPerPage(Number(e.target.value)); setApPage(1); }}>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
              <Pagination
                currentPage={apPage}
                totalItems={filteredPayables.length}
                itemsPerPage={apItemsPerPage}
                onPageChange={setApPage}
              />
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB 4: Trial Balance & General Ledger */}
      {activeTab === 'trial-balance' && (
        <div className="statement-sheet-card">
          <div className="statement-sheet-header">
            <h3>Trial Balance (Double-Entry Financial Summary)</h3>
            <p>Verification of debit and credit balances across all active Chart of Accounts</p>
          </div>

          <table className="financial-statement-table">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.85rem 1.5rem', textAlign: 'left' }}>Account Code</th>
                <th style={{ textAlign: 'left' }}>Account Name</th>
                <th style={{ textAlign: 'center' }}>Account Class</th>
                <th style={{ textAlign: 'right' }}>Debit (PKR)</th>
                <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Credit (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {(trialBalance?.accounts || []).map((acct, idx) => (
                <tr key={idx}>
                  <td style={{ paddingLeft: '1.5rem', fontWeight: 700, color: '#64748b' }}>{acct.code}</td>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{acct.name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`acct-type-pill type-${acct.type.toLowerCase()}`}>
                      {acct.type}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: acct.debit > 0 ? 700 : 400, color: acct.debit > 0 ? '#0f172a' : '#94a3b8' }}>
                    {acct.debit > 0 ? fmt(acct.debit) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '1.5rem', fontWeight: acct.credit > 0 ? 700 : 400, color: acct.credit > 0 ? '#0f172a' : '#94a3b8' }}>
                    {acct.credit > 0 ? fmt(acct.credit) : '-'}
                  </td>
                </tr>
              ))}
              <tr className="statement-grand-total-row">
                <td colSpan="3" style={{ paddingLeft: '1.5rem', fontWeight: 800 }}>TRIAL BALANCE TOTALS</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>
                  {fmt(trialBalance?.total_debits)}
                </td>
                <td style={{ textAlign: 'right', paddingRight: '1.5rem', fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>
                  {fmt(trialBalance?.total_credits)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
