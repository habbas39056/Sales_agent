import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  CreditCard, DollarSign, TrendingDown, TrendingUp, AlertTriangle, CheckCircle,
  Clock, Download, Search, RefreshCw, BarChart2, PieChart as PieChartIcon,
  ChevronRight, X, Phone, Mail, FolderKanban, FileText, ArrowUpRight,
  Briefcase, Activity, Calendar, Tag, ShieldCheck, Layers, Repeat,
  FileSpreadsheet, ArrowDownRight, Wallet, Building, Table
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Pagination from '../../components/Pagination';
import './ExpenseReportView.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#eab308', '#64748b'];

const getCategoryColor = (name) => {
  if (!name) return '#64748b';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
};

const DONUT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b'];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function ExpenseReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Server Data
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [byClient, setByClient] = useState([]);
  const [byProject, setByProject] = useState([]);
  const [byEmployee, setByEmployee] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [annualMatrix, setAnnualMatrix] = useState(null);

  // Active View Tab (matrix, transactions, categories, attribution, employees)
  const [activeViewTab, setActiveViewTab] = useState('matrix');

  // Annual Matrix Controls
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [excludeBillable, setExcludeBillable] = useState(false);

  // Filters
  const [activePreset, setActivePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedNature, setSelectedNature] = useState('all');
  const [selectedMode, setSelectedMode] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // 360 Voucher Detail Modal
  const [selectedVoucherId, setSelectedVoucherId] = useState(null);
  const [voucherDetail, setVoucherDetail] = useState(null);
  const [loadingVoucher, setLoadingVoucher] = useState(false);

  const fetchExpenseReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (selectedYear) params.append('year', selectedYear);

      const res = await axios.get(`${API_URL}/reports/expenses?${params.toString()}`);
      setExpenses(res.data.expenses || []);
      setSummary(res.data.summary || null);
      setByCategory(res.data.by_category || []);
      setByClient(res.data.by_client || []);
      setByProject(res.data.by_project || []);
      setByEmployee(res.data.by_employee || []);
      setMonthlyTrend(res.data.monthly_trend || []);
      setPaymentModes(res.data.payment_modes || []);
      setAnnualMatrix(res.data.annual_matrix || null);
    } catch (err) {
      console.error('Error fetching expense report:', err);
      setError(err.response?.data?.error || 'Failed to load corporate expense report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenseReport();
  }, [startDate, endDate, selectedYear]);

  // Apply Timeframe Preset
  const applyPreset = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'thisMonth') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'lastMonth') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(last.toISOString().slice(0, 10));
    } else if (preset === 'thisYear') {
      const first = new Date(now.getFullYear(), 0, 1);
      setStartDate(first.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    }
  };

  // Open 360 Voucher Detail Modal
  const openVoucher360 = async (voucherId) => {
    setSelectedVoucherId(voucherId);
    setLoadingVoucher(true);
    try {
      const res = await axios.get(`${API_URL}/reports/expenses/${voucherId}/details`);
      setVoucherDetail(res.data);
    } catch (err) {
      console.error('Failed to load voucher details:', err);
    } finally {
      setLoadingVoucher(false);
    }
  };

  const closeVoucher360 = () => {
    setSelectedVoucherId(null);
    setVoucherDetail(null);
  };

  // Dynamic Category Options
  const categoryOptions = useMemo(() => {
    const set = new Set(expenses.map(e => e.category).filter(Boolean));
    return Array.from(set);
  }, [expenses]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    let result = [...expenses];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e =>
        (e.description && e.description.toLowerCase().includes(term)) ||
        (e.category && e.category.toLowerCase().includes(term)) ||
        (e.client && e.client.toLowerCase().includes(term)) ||
        (e.bank && e.bank.toLowerCase().includes(term)) ||
        (e.reference && e.reference.toLowerCase().includes(term)) ||
        (e.mode && e.mode.toLowerCase().includes(term))
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter(e => e.category === selectedCategory);
    }

    if (selectedNature === 'recurring') {
      result = result.filter(e => e.expense_type === 'Recurring');
    } else if (selectedNature === 'onetime') {
      result = result.filter(e => e.expense_type === 'One-Time');
    } else if (selectedNature === 'reimbursable') {
      result = result.filter(e => e.reimbursability === 'Reimbursable');
    } else if (selectedNature === 'non_reimbursable') {
      result = result.filter(e => e.reimbursability === 'Non-Reimbursable');
    }

    if (selectedMode !== 'all') {
      result = result.filter(e => e.mode === selectedMode);
    }

    result.sort((a, b) => {
      if (sortBy === 'amount_desc') return b.payment_amount - a.payment_amount;
      if (sortBy === 'amount_asc') return a.payment_amount - b.payment_amount;
      if (sortBy === 'date_desc') return new Date(b.date || b.created_at) - new Date(a.date || a.created_at);
      if (sortBy === 'date_asc') return new Date(a.date || a.created_at) - new Date(b.date || b.created_at);
      if (sortBy === 'category_asc') return (a.category || '').localeCompare(b.category || '');
      return 0;
    });

    return result;
  }, [expenses, searchTerm, selectedCategory, selectedNature, selectedMode, sortBy]);

  // Paginated Expenses
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(start, start + itemsPerPage);
  }, [filteredExpenses, currentPage, itemsPerPage]);

  // Filtered Totals
  const filteredTotals = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => ({
      total_payments: acc.total_payments + e.payment_amount,
      total_receipts: acc.total_receipts + e.receipt_amount,
      count: acc.count + 1
    }), { total_payments: 0, total_receipts: 0, count: 0 });
  }, [filteredExpenses]);

  // Format PKR
  const fmt = (val) => {
    const n = Number(val || 0);
    return `Rs ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Matrix Chart Data (Billable vs Non-Billable by Category)
  const nonBillableChartData = useMemo(() => {
    return (annualMatrix?.matrix || []).map(r => ({
      name: r.category_name,
      amount: r.total_year
    })).filter(r => r.amount > 0);
  }, [annualMatrix]);

  const billableChartData = useMemo(() => {
    return (byClient || []).map(c => ({
      name: c.client_name,
      amount: c.total_amount
    }));
  }, [byClient]);

  // Export to Excel (Includes 12-Month Pivot Matrix Sheet!)
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: 12-Month Category Pivot Matrix (Exact user format!)
    if (annualMatrix) {
      const matrixHeaders = ['Category', ...MONTH_NAMES, `Year (${annualMatrix.year})`];
      const matrixDataRows = (annualMatrix.matrix || []).map(row => [
        row.category_name,
        ...row.monthly_values.map(v => v > 0 ? v : 0),
        row.total_year
      ]);

      matrixDataRows.push([
        'Net Amount (Subtotal)',
        ...(annualMatrix.monthly_subtotals || []).map(v => v > 0 ? v : 0),
        annualMatrix.annual_grand_total
      ]);
      matrixDataRows.push(['Total Tax', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      matrixDataRows.push([
        'Total',
        ...(annualMatrix.monthly_subtotals || []).map(v => v > 0 ? v : 0),
        annualMatrix.annual_grand_total
      ]);

      const wsMatrix = XLSX.utils.aoa_to_sheet([
        [`Adwise Labs - 12-Month Expense Category Matrix (${annualMatrix.year})`],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        matrixHeaders,
        ...matrixDataRows
      ]);
      XLSX.utils.book_append_sheet(wb, wsMatrix, '12-Month Category Matrix');
    }

    // Sheet 2: Executive Summary
    const summaryRows = [
      ['Adwise Labs - Corporate Expense Intelligence & Spend Management Report'],
      ['Generated On', new Date().toLocaleString()],
      ['Timeframe', `${startDate || 'All Time'} to ${endDate || 'Present'}`],
      [''],
      ['Macro Spend Metric', 'Value (PKR)'],
      ['Total Cash Outflow / Expenses', summary?.total_expenses || 0],
      ['Total Cash Receipts & Inflows', summary?.total_receipts || 0],
      ['Net Cash Flow', summary?.net_cash_flow || 0],
      ['Recurring Fixed Commitments', summary?.recurring_burn || 0],
      ['One-Time Variable Outlays', summary?.onetime_burn || 0],
      ['Reimbursable Client / Project Costs', summary?.reimbursable_total || 0],
      ['Non-Reimbursable Internal OpEx', summary?.non_reimbursable_total || 0],
      ['Total Spend Transactions', summary?.total_transactions || 0],
      ['Average Transaction Size', summary?.avg_transaction_size || 0],
      ['Top Spending Category', summary?.top_spending_category || 'N/A']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // Sheet 3: Expense Transaction Ledger
    const ledgerRows = filteredExpenses.map((e, idx) => ({
      '#': idx + 1,
      'Date': e.date ? new Date(e.date).toLocaleDateString() : 'N/A',
      'Category': e.category,
      'Description': e.description,
      'Payee / Client': e.client,
      'Payment Mode': e.mode,
      'Bank': e.bank,
      'Reference': e.reference,
      'Expense Nature': e.expense_type,
      'Reimbursability': e.reimbursability,
      'Payment Outflow (PKR)': e.payment_amount,
      'Receipt Inflow (PKR)': e.receipt_amount
    }));
    const wsLedger = XLSX.utils.json_to_sheet(ledgerRows);
    XLSX.utils.book_append_sheet(wb, wsLedger, 'Expense Ledger');

    // Sheet 4: Spend by Category
    const catRows = (byCategory || []).map(c => ({
      'Category Name': c.category_name,
      'Total Spend (PKR)': c.total_amount,
      'Percentage of Total (%)': `${c.percentage}%`,
      'Transaction Count': c.transaction_count,
      'Average Spend (PKR)': c.avg_ticket,
      'Recurring Spend (PKR)': c.recurring_amount,
      'One-Time Spend (PKR)': c.onetime_amount
    }));
    const wsCat = XLSX.utils.json_to_sheet(catRows);
    XLSX.utils.book_append_sheet(wb, wsCat, 'Spend by Category');

    XLSX.writeFile(wb, `Corporate_Expense_Report_${selectedYear}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to PDF (Includes 12-Month Matrix Layout!)
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'pt', 'a4');

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(`12-Month Corporate Expense Category Matrix (${selectedYear})`, 30, 40);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()} | Exclude Billable: ${excludeBillable ? 'Yes' : 'No'}`, 30, 55);

    if (annualMatrix) {
      const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const headers = ['Category', ...shortMonths, `Year (${selectedYear})`];
      
      const body = (annualMatrix.matrix || []).map(r => [
        r.category_name,
        ...r.monthly_values.map(v => v > 0 ? `Rs ${v.toLocaleString()}` : 'Rs 0.00'),
        `Rs ${r.total_year.toLocaleString()}`
      ]);

      body.push([
        'Net Amount (Subtotal)',
        ...(annualMatrix.monthly_subtotals || []).map(v => v > 0 ? `Rs ${v.toLocaleString()}` : 'Rs 0.00'),
        `Rs ${annualMatrix.annual_grand_total.toLocaleString()}`
      ]);
      body.push([
        'Total Tax',
        'Rs 0.00', 'Rs 0.00', 'Rs 0.00', 'Rs 0.00', 'Rs 0.00', 'Rs 0.00',
        'Rs 0.00', 'Rs 0.00', 'Rs 0.00', 'Rs 0.00', 'Rs 0.00', 'Rs 0.00',
        'Rs 0.00'
      ]);
      body.push([
        'Total',
        ...(annualMatrix.monthly_subtotals || []).map(v => v > 0 ? `Rs ${v.toLocaleString()}` : 'Rs 0.00'),
        `Rs ${annualMatrix.annual_grand_total.toLocaleString()}`
      ]);

      autoTable(doc, {
        startY: 70,
        head: [headers],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5 },
        bodyStyles: { fontSize: 6, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 30, right: 30 }
      });
    }

    doc.save(`12_Month_Expense_Matrix_${selectedYear}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="professional-expense-report">
      {/* 1. Header Panel */}
      <div className="expense-header-panel">
        <div className="header-info">
          <div className="header-badge">
            <CreditCard size={15} /> Spend Intelligence & Cost Control
          </div>
          <h1>Corporate Expense & Spend Reports</h1>
          <p className="header-subtext">
            Comprehensive multi-dimensional expenditure tracking: 12-month category pivot matrix, recurring commitments, project attribution, and spend analytics.
          </p>
        </div>

        <div className="header-action-group">
          <button className="btn-export btn-export-excel" onClick={exportToExcel} title="Export multi-sheet Excel workbook">
            <FileSpreadsheet size={16} /> Export Excel (.xlsx)
          </button>
          <button className="btn-export btn-export-pdf" onClick={exportToPDF} title="Download corporate PDF statement">
            <Download size={16} /> Export PDF (.pdf)
          </button>
          <button className="btn-refresh" onClick={fetchExpenseReport} title="Refresh live data">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Macro Spend KPI Cards (7 Metrics) */}
      <div className="expense-kpi-grid">
        {/* Card 1: Total Cash Outflow */}
        <div className="expense-kpi-card card-red">
          <div className="card-top">
            <span className="card-title">Total Cash Outflow (Spend)</span>
            <div className="card-icon"><TrendingDown size={20} /></div>
          </div>
          <h2 className="card-value text-red">{fmt(summary?.total_expenses || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill red">
              <ArrowDownRight size={12} /> {summary?.total_transactions || 0} Transactions
            </span>
          </div>
        </div>

        {/* Card 2: Recurring Fixed Commitments */}
        <div className="expense-kpi-card card-blue">
          <div className="card-top">
            <span className="card-title">Recurring Commitments</span>
            <div className="card-icon"><Repeat size={20} /></div>
          </div>
          <h2 className="card-value text-blue">{fmt(summary?.recurring_burn || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill blue">
              Salaries, SaaS, Rent, Utilities
            </span>
          </div>
        </div>

        {/* Card 3: One-Time Variable Outlays */}
        <div className="expense-kpi-card card-orange">
          <div className="card-top">
            <span className="card-title">One-Time / Variable Outlays</span>
            <div className="card-icon"><Layers size={20} /></div>
          </div>
          <h2 className="card-value text-orange">{fmt(summary?.onetime_burn || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill orange">
              Repairs, Hardware, Campaigns
            </span>
          </div>
        </div>

        {/* Card 4: Reimbursable Client / Project Costs */}
        <div className="expense-kpi-card card-green">
          <div className="card-top">
            <span className="card-title">Reimbursable Client Costs</span>
            <div className="card-icon"><Briefcase size={20} /></div>
          </div>
          <h2 className="card-value text-green">{fmt(summary?.reimbursable_total || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill green">
              Pass-Through Billable
            </span>
          </div>
        </div>

        {/* Card 5: Non-Reimbursable Internal OpEx */}
        <div className="expense-kpi-card card-purple">
          <div className="card-top">
            <span className="card-title">Internal Operating OpEx</span>
            <div className="card-icon"><Building size={20} /></div>
          </div>
          <h2 className="card-value text-purple">{fmt(summary?.non_reimbursable_total || 0)}</h2>
          <div className="card-meta">
            <span className="meta-pill purple">
              Core Agency Overhead
            </span>
          </div>
        </div>

        {/* Card 6: Average Spend Per Ticket */}
        <div className="expense-kpi-card card-teal">
          <div className="card-top">
            <span className="card-title">Average Transaction Size</span>
            <div className="card-icon"><Wallet size={20} /></div>
          </div>
          <h2 className="card-value text-teal">{fmt(Math.round(summary?.avg_transaction_size || 0))}</h2>
          <div className="card-meta">
            <span className="meta-pill teal">
              Avg Ticket Size
            </span>
          </div>
        </div>

        {/* Card 7: Top Spending Driver */}
        <div className="expense-kpi-card card-pink">
          <div className="card-top">
            <span className="card-title">Top Burn Driver</span>
            <div className="card-icon"><Tag size={20} /></div>
          </div>
          <h2 className="card-value" style={{ fontSize: '1.2rem' }}>{summary?.top_spending_category || 'N/A'}</h2>
          <div className="card-meta">
            <span className="meta-pill red">
              Highest Spend Sector
            </span>
          </div>
        </div>
      </div>

      {/* 3. Multi-View Navigation Tabs */}
      <div className="view-tabs-bar">
        <button
          className={`view-tab-btn ${activeViewTab === 'matrix' ? 'active' : ''}`}
          onClick={() => setActiveViewTab('matrix')}
        >
          <Table size={16} /> 12-Month Category Matrix ({selectedYear})
        </button>
        <button
          className={`view-tab-btn ${activeViewTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveViewTab('transactions')}
        >
          <FileText size={16} /> Expense Transactions ({filteredExpenses.length})
        </button>
        <button
          className={`view-tab-btn ${activeViewTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveViewTab('categories')}
        >
          <Tag size={16} /> Spend by Category ({byCategory.length})
        </button>
        <button
          className={`view-tab-btn ${activeViewTab === 'attribution' ? 'active' : ''}`}
          onClick={() => setActiveViewTab('attribution')}
        >
          <Briefcase size={16} /> Project & Client Attribution
        </button>
        <button
          className={`view-tab-btn ${activeViewTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveViewTab('employees')}
        >
          <Building size={16} /> Employee & Payroll Disbursements
        </button>
      </div>

      {/* 4. TAB 1: 12-Month Category Matrix View (Matching Screenshot Exact Design!) */}
      {activeViewTab === 'matrix' && (
        <div className="matrix-view-container">
          {/* Matrix Controls Top Bar */}
          <div className="matrix-controls-bar">
            <div className="matrix-left-controls">
              <div className="matrix-export-icons">
                <button className="icon-btn-export" onClick={exportToExcel} title="Export to Excel">
                  <FileSpreadsheet size={17} color="#10b981" />
                </button>
                <button className="icon-btn-export" onClick={exportToPDF} title="Export to PDF">
                  <Download size={17} color="#ef4444" />
                </button>
              </div>

              <div className="year-selector-wrap">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="matrix-year-select"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                  <option value={2023}>2023</option>
                </select>
              </div>
            </div>

            <div className="matrix-right-controls">
              <button className="btn-detailed-report" onClick={() => setActiveViewTab('transactions')}>
                Detailed Report
              </button>
            </div>
          </div>

          {/* Exclude Billable Checkbox */}
          <div className="matrix-checkbox-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={excludeBillable}
                onChange={(e) => setExcludeBillable(e.target.checked)}
              />
              <span>Exclude Billable Expenses</span>
            </label>
          </div>

          {/* 12-Month Matrix Pivot Table */}
          <div className="matrix-table-card">
            <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
              <table className="annual-matrix-table">
                <thead>
                  <tr>
                    <th className="th-category">Category</th>
                    {MONTH_NAMES.map(m => (
                      <th key={m} className="th-month">{m}</th>
                    ))}
                    <th className="th-year">Year ({selectedYear})</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="14" className="table-loading-cell">
                        <RefreshCw size={24} className="spinning" />
                        <p style={{ marginTop: '0.5rem' }}>Loading annual expense matrix for {selectedYear}...</p>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {(annualMatrix?.matrix || []).map((row, idx) => (
                        <tr key={idx} className="matrix-row">
                          <td className="td-category-name">{row.category_name}</td>
                          {row.monthly_values.map((val, mIdx) => (
                            <td key={mIdx} className="td-month-val">
                              {fmt(val)}
                            </td>
                          ))}
                          <td className="td-year-total">{fmt(row.total_year)}</td>
                        </tr>
                      ))}

                      {/* Net Amount (Subtotal) */}
                      <tr className="matrix-subtotal-row">
                        <td className="td-category-name font-bold">Net Amount (Subtotal)</td>
                        {(annualMatrix?.monthly_subtotals || new Array(12).fill(0)).map((s, mIdx) => (
                          <td key={mIdx} className="td-month-val font-bold">
                            {fmt(s)}
                          </td>
                        ))}
                        <td className="td-year-total font-bold">{fmt(annualMatrix?.annual_grand_total || 0)}</td>
                      </tr>

                      {/* Total Tax */}
                      <tr className="matrix-tax-row">
                        <td className="td-category-name">Total Tax</td>
                        {MONTH_NAMES.map((_, mIdx) => (
                          <td key={mIdx} className="td-month-val">Rs 0.00</td>
                        ))}
                        <td className="td-year-total">Rs 0.00</td>
                      </tr>

                      {/* Total */}
                      <tr className="matrix-total-row">
                        <td className="td-category-name font-bold">Total</td>
                        {(annualMatrix?.monthly_subtotals || new Array(12).fill(0)).map((s, mIdx) => (
                          <td key={mIdx} className="td-month-val font-bold">
                            {fmt(s)}
                          </td>
                        ))}
                        <td className="td-year-total font-bold text-red">{fmt(annualMatrix?.annual_grand_total || 0)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dual Charts Section (Matching Screenshot Bottom Charts!) */}
          <div className="matrix-bottom-charts-grid">
            {/* Chart 1: Not billable expenses by categories */}
            <div className="matrix-chart-card">
              <div className="chart-header">
                <h4>Not billable expenses by categories</h4>
              </div>
              <div style={{ height: '240px' }}>
                {nonBillableChartData.length === 0 ? (
                  <div className="empty-chart-state">No non-billable category data.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nonBillableChartData} margin={{ top: 15, right: 20, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        interval={0}
                        tickFormatter={(name) => name.length > 12 ? `${name.substring(0, 12)}...` : name}
                      />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, 'Outflow']} />
                      <Bar dataKey="amount" fill="#f87171" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Billable expenses by categories */}
            <div className="matrix-chart-card">
              <div className="chart-header">
                <h4>Billable expenses by categories</h4>
              </div>
              <div style={{ height: '240px' }}>
                {billableChartData.length === 0 ? (
                  <div className="empty-chart-state">No billable category data.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={billableChartData} margin={{ top: 15, right: 20, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        interval={0}
                        tickFormatter={(name) => name.length > 12 ? `${name.substring(0, 12)}...` : name}
                      />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, 'Billable']} />
                      <Bar dataKey="amount" fill="#34d399" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: Detailed Expense Transaction Ledger */}
      {activeViewTab === 'transactions' && (
        <>
          {/* Multi-Dimensional Filter Toolbar */}
          <div className="expense-filter-card">
            {/* Preset Pill Row */}
            <div className="preset-pill-row">
              <span className="filter-row-label">Timeframe:</span>
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7days', label: 'Last 7 Days' },
                { id: '30days', label: 'Last 30 Days' },
                { id: 'thisMonth', label: 'This Month' },
                { id: 'lastMonth', label: 'Last Month' },
                { id: 'thisYear', label: 'This Year' }
              ].map(p => (
                <button
                  key={p.id}
                  className={`preset-btn ${activePreset === p.id ? 'active' : ''}`}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Filter Controls Grid */}
            <div className="filter-controls-grid">
              <div className="filter-field">
                <label><Calendar size={13} /> Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setActivePreset('custom'); }}
                />
              </div>

              <div className="filter-field">
                <label><Calendar size={13} /> End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setActivePreset('custom'); }}
                />
              </div>

              <div className="filter-field">
                <label><Tag size={13} /> Category</label>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  <option value="all">All Expense Categories</option>
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="filter-field">
                <label><Repeat size={13} /> Nature & Class</label>
                <select value={selectedNature} onChange={(e) => setSelectedNature(e.target.value)}>
                  <option value="all">All Natures & Classes</option>
                  <option value="recurring">Recurring Fixed Commitments</option>
                  <option value="onetime">One-Time Variable Outlays</option>
                  <option value="reimbursable">Reimbursable (Client Attributed)</option>
                  <option value="non_reimbursable">Non-Reimbursable (Internal OpEx)</option>
                </select>
              </div>

              <div className="filter-field">
                <label><CreditCard size={13} /> Payment Mode</label>
                <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)}>
                  <option value="all">All Payment Modes</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="Credit Card">Credit Card</option>
                </select>
              </div>

              <div className="filter-field">
                <label><Activity size={13} /> Sort Expenses By</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="amount_desc">Highest Payment Amount</option>
                  <option value="amount_asc">Lowest Payment Amount</option>
                  <option value="date_desc">Most Recent Date</option>
                  <option value="date_asc">Oldest Date</option>
                  <option value="category_asc">Category (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transactions Table Card */}
          <div className="expense-ledger-card">
            <div className="ledger-header">
              <div>
                <h3>Expense Transaction Ledger</h3>
                <p className="ledger-subtext">Showing {filteredExpenses.length} spend records verified against database payments</p>
              </div>

              <div className="search-bar-wrap">
                <Search size={16} color="#64748b" />
                <input
                  type="text"
                  placeholder="Search descriptions, categories, clients, banks..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>

            {error && <div className="error-banner"><AlertTriangle size={18} /> {error}</div>}

            <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
              <table className="modern-expense-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Payee / Client</th>
                    <th>Payment Mode</th>
                    <th>Bank / Ref</th>
                    <th style={{ textAlign: 'center' }}>Nature</th>
                    <th style={{ textAlign: 'center' }}>Class</th>
                    <th style={{ textAlign: 'right' }}>Payment Amount</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="table-loading-cell">
                        <RefreshCw size={24} className="spinning" />
                        <p style={{ marginTop: '0.5rem' }}>Analyzing corporate expense records...</p>
                      </td>
                    </tr>
                  ) : paginatedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="table-empty-cell">
                        No expense records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedExpenses.map((exp) => (
                      <tr
                        key={exp.id}
                        className="expense-table-row clickable-row"
                        onClick={() => openVoucher360(exp.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {exp.date ? new Date(exp.date).toLocaleDateString() : '-'}
                        </td>

                        <td>
                          <span
                            className="exp-category-tag"
                            style={{
                              background: `${getCategoryColor(exp.category)}15`,
                              color: getCategoryColor(exp.category),
                              borderColor: `${getCategoryColor(exp.category)}30`
                            }}
                          >
                            {exp.category}
                          </span>
                        </td>

                        <td style={{ maxWidth: '280px', fontWeight: 500 }}>
                          {exp.description}
                          {exp.linked_project && (
                            <span className="linked-project-pill">
                              <FolderKanban size={11} /> {exp.linked_project}
                            </span>
                          )}
                        </td>

                        <td style={{ fontWeight: 600, color: exp.is_employee_payee ? '#8b5cf6' : '#0f172a' }}>
                          {exp.client || '-'}
                        </td>

                        <td>
                          <span className={`mode-badge mode-${(exp.mode || 'cash').replace(/\s+/g, '-').toLowerCase()}`}>
                            {exp.mode}
                          </span>
                        </td>

                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          <div>{exp.bank || '-'}</div>
                          {exp.reference && exp.reference !== '-' && (
                            <div className="ref-text">Ref: {exp.reference}</div>
                          )}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <span className={`nature-badge ${exp.expense_type === 'Recurring' ? 'nature-recurring' : 'nature-onetime'}`}>
                            {exp.expense_type}
                          </span>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <span className={`reimb-badge ${exp.reimbursability === 'Reimbursable' ? 'reimb-yes' : 'reimb-no'}`}>
                            {exp.reimbursability}
                          </span>
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                          {fmt(exp.payment_amount)}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn-view-voucher"
                            onClick={(e) => { e.stopPropagation(); openVoucher360(exp.id); }}
                            title="View Voucher 360"
                          >
                            Voucher <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {filteredExpenses.length > 0 && !loading && (
                  <tfoot>
                    <tr className="table-summary-footer">
                      <td colSpan="8" style={{ fontWeight: 800 }}>
                        Filtered Outflow Totals ({filteredExpenses.length} records)
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                        {fmt(filteredTotals.total_payments)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination */}
            <div className="ledger-pagination-bar">
              <div className="pagination-left-controls">
                <span className="pagination-showing-text">
                  Showing <strong>{filteredExpenses.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredExpenses.length)}</strong> of <strong>{filteredExpenses.length}</strong> transactions
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
                  totalItems={filteredExpenses.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* 6. TAB 3: Spend by Category Breakdown */}
      {activeViewTab === 'categories' && (
        <div className="expense-ledger-card">
          <div className="ledger-header">
            <div>
              <h3>Category-wise Expenditure & Pareto Analysis</h3>
              <p className="ledger-subtext">Highest burn categories sorted by total capital deployed</p>
            </div>
          </div>
          <div className="table-responsive-wrapper">
            <table className="modern-expense-table">
              <thead>
                <tr>
                  <th>Category Sector</th>
                  <th style={{ textAlign: 'right' }}>Total Spend</th>
                  <th style={{ textAlign: 'center' }}>% of Total Burn</th>
                  <th style={{ textAlign: 'center' }}>Transactions</th>
                  <th style={{ textAlign: 'right' }}>Average Ticket</th>
                  <th style={{ textAlign: 'right' }}>Recurring Outlay</th>
                  <th style={{ textAlign: 'right' }}>One-Time Outlay</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.length === 0 ? (
                  <tr><td colSpan="7" className="table-empty-cell">No categories found.</td></tr>
                ) : (
                  byCategory.map((cat, idx) => (
                    <tr key={idx}>
                      <td>
                        <span
                          className="exp-category-tag"
                          style={{
                            background: `${getCategoryColor(cat.category_name)}15`,
                            color: getCategoryColor(cat.category_name)
                          }}
                        >
                          {cat.category_name}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                        {fmt(cat.total_amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                          <span style={{ fontWeight: 700 }}>{cat.percentage}%</span>
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${cat.percentage}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{cat.transaction_count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(cat.avg_ticket)}</td>
                      <td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>{fmt(cat.recurring_amount)}</td>
                      <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>{fmt(cat.onetime_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. TAB 4: Project & Client Direct Cost Attribution */}
      {activeViewTab === 'attribution' && (
        <div className="expense-ledger-card">
          <div className="ledger-header">
            <div>
              <h3>Project & Client Direct Cost Attribution</h3>
              <p className="ledger-subtext">Pass-through and direct costs attributed to client deliverables</p>
            </div>
          </div>
          <div className="table-responsive-wrapper">
            <table className="modern-expense-table">
              <thead>
                <tr>
                  <th>Client / Entity</th>
                  <th style={{ textAlign: 'right' }}>Total Attributed Expense</th>
                  <th style={{ textAlign: 'center' }}>Transactions</th>
                  <th>Reimbursable Nature</th>
                </tr>
              </thead>
              <tbody>
                {byClient.length === 0 ? (
                  <tr><td colSpan="4" className="table-empty-cell">No client attributed expenses recorded.</td></tr>
                ) : (
                  byClient.map((c, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700 }}>{c.client_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                        {fmt(c.total_amount)}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.count}</td>
                      <td>
                        <span className="reimb-badge reimb-yes">Reimbursable Client Cost</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. TAB 5: Employee & Payroll Disbursements */}
      {activeViewTab === 'employees' && (
        <div className="expense-ledger-card">
          <div className="ledger-header">
            <div>
              <h3>Staff & Payroll Disbursement Ledger</h3>
              <p className="ledger-subtext">Cash disbursements to employees for base salaries, advances, and travel</p>
            </div>
          </div>
          <div className="table-responsive-wrapper">
            <table className="modern-expense-table">
              <thead>
                <tr>
                  <th>Employee / Payee Name</th>
                  <th style={{ textAlign: 'right' }}>Total Disbursed</th>
                  <th style={{ textAlign: 'center' }}>Transactions</th>
                  <th>Disbursement Type</th>
                </tr>
              </thead>
              <tbody>
                {byEmployee.length === 0 ? (
                  <tr><td colSpan="4" className="table-empty-cell">No employee disbursements recorded.</td></tr>
                ) : (
                  byEmployee.map((emp, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700 }}>{emp.employee_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#8b5cf6' }}>
                        {fmt(emp.total_amount)}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{emp.count}</td>
                      <td>
                        <span className="nature-badge nature-recurring">Payroll / Advance</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. 360° Expense Voucher Modal */}
      {selectedVoucherId && (
        <div className="expense-modal-overlay" onClick={closeVoucher360}>
          <div className="expense-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <div className="modal-voucher-header">
                <div className="modal-icon-badge">
                  <FileText size={22} />
                </div>
                <div>
                  <h2 className="modal-voucher-title">Expense Voucher #{voucherDetail?.id || selectedVoucherId}</h2>
                  <p className="modal-voucher-sub">
                    {voucherDetail?.date ? new Date(voucherDetail.date).toLocaleDateString() : 'N/A'} • {voucherDetail?.mode || 'Cash'}
                  </p>
                </div>
              </div>

              <button className="btn-close-modal" onClick={closeVoucher360}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-content">
              {loadingVoucher ? (
                <div className="modal-loading">
                  <RefreshCw size={30} className="spinning" />
                  <p>Loading expense voucher details...</p>
                </div>
              ) : (
                <div className="voucher-details-grid">
                  <div className="voucher-highlight-card">
                    <span className="voucher-amount-label">Payment Amount Paid Out</span>
                    <h1 className="voucher-amount-value">{fmt(voucherDetail?.payment_amount || 0)}</h1>
                  </div>

                  <div className="voucher-info-section">
                    <h4>Voucher Specifications</h4>
                    <div className="voucher-spec-rows">
                      <div className="spec-row">
                        <span className="spec-label">Description:</span>
                        <span className="spec-val">{voucherDetail?.description || '-'}</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Category:</span>
                        <span className="spec-val">{voucherDetail?.category || 'General & Miscellaneous'}</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Payee / Client:</span>
                        <span className="spec-val">{voucherDetail?.client || 'General Operational'}</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Payment Mode:</span>
                        <span className="spec-val">{voucherDetail?.mode || 'Cash'}</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Bank Account:</span>
                        <span className="spec-val">{voucherDetail?.bank || '-'}</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Reference / Check #:</span>
                        <span className="spec-val">{voucherDetail?.reference || '-'}</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Recorded At:</span>
                        <span className="spec-val">{voucherDetail?.created_at ? new Date(voucherDetail.created_at).toLocaleString() : '-'}</span>
                      </div>
                    </div>
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
