import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Banknote, Users, CheckCircle, Clock, Plus, Search, 
  Printer, Edit, Trash2, CreditCard, Building2, X, Calendar, ArrowDownRight, FileText, Wallet
} from 'lucide-react';
import Pagination from '../components/Pagination';
import './Payroll.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function Payroll() {
  // Month selection state (default to current YYYY-MM e.g., '2026-07')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrolls, setPayrolls] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [banks, setBanks] = useState([]);
  const [accountBalances, setAccountBalances] = useState({
    cashInHand: 0,
    totalNetBalance: 0,
    bankTotals: {}
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Toolbar & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('payroll'); // 'payroll' or 'advances'

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modals
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedPayrollToPay, setSelectedPayrollToPay] = useState(null);
  const [payFormData, setPayFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    bank_name: '',
    notes: ''
  });

  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceFormData, setAdvanceFormData] = useState({
    user_id: '',
    amount: '',
    advance_date: new Date().toISOString().split('T')[0],
    payment_method: 'Cash',
    bank_name: '',
    notes: ''
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState(null);
  const [editFormData, setEditFormData] = useState({
    base_salary: 0,
    overtime_allowance: 0,
    bonus: 0,
    advance_salary: 0,
    tax_deduction: 0,
    other_deductions: 0,
    notes: ''
  });

  const [isBaseSalariesModalOpen, setIsBaseSalariesModalOpen] = useState(false);
  const [baseSalariesData, setBaseSalariesData] = useState([]);

  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [payslipItem, setPayslipItem] = useState(null);

  // Fetch Data
  useEffect(() => {
    fetchPayrollData();
    fetchAdvancesData();
    fetchEmployees();
    fetchBanks();
  }, [selectedMonth]);

  const fetchPayrollData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/payroll?month=${selectedMonth}`);
      setPayrolls(res.data.payrolls || []);
      if (res.data.accounts) {
        setAccountBalances(res.data.accounts);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching payroll:', err);
      setError('Failed to load payroll records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvancesData = async () => {
    try {
      const res = await axios.get(`${API_URL}/payroll/advances?month=${selectedMonth}`);
      setAdvances(res.data || []);
    } catch (err) {
      console.error('Error fetching salary advances:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/payroll/employees`);
      setEmployees(res.data || []);
      if (res.data.length > 0) {
        setAdvanceFormData(prev => ({ ...prev, user_id: res.data[0].id }));
      }
      setBaseSalariesData(res.data.map(e => ({ user_id: e.id, name: e.name, role: e.role, base_salary: e.base_salary })));
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await axios.get(`${API_URL}/banks`);
      setBanks(res.data || []);
      if (res.data.length > 0) {
        setPayFormData(prev => ({ ...prev, bank_name: res.data[0].name }));
        setAdvanceFormData(prev => ({ ...prev, bank_name: res.data[0].name }));
      }
    } catch (err) {
      console.error('Error fetching banks:', err);
    }
  };

  const showTempMessage = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Generate Monthly Payroll
  const handleGeneratePayroll = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/payroll/generate`, { month: selectedMonth });
      showTempMessage(res.data.message || 'Generated monthly payroll successfully');
      fetchPayrollData();
    } catch (err) {
      console.error('Error generating payroll:', err);
      setError('Failed to generate monthly payroll.');
      setLoading(false);
    }
  };

  // Record Salary Advance
  const handleIssueAdvance = async (e) => {
    e.preventDefault();
    if (!advanceFormData.user_id || !advanceFormData.amount || parseFloat(advanceFormData.amount) <= 0) {
      alert('Please select an employee and enter a valid advance amount');
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/payroll/advances`, {
        ...advanceFormData,
        month: selectedMonth
      });
      showTempMessage(res.data.message || 'Salary advance issued and synced to Cashbook!');
      setIsAdvanceModalOpen(false);
      fetchPayrollData();
      fetchAdvancesData();
    } catch (err) {
      console.error('Error issuing advance:', err);
      alert(err.response?.data?.error || 'Failed to issue salary advance');
    }
  };

  // Delete Salary Advance
  const handleDeleteAdvance = async (id) => {
    if (!window.confirm('Are you sure you want to delete this salary advance entry? Its cashbook expense payment will also be deleted.')) {
      return;
    }
    try {
      await axios.delete(`${API_URL}/payroll/advances/${id}`);
      showTempMessage('Salary advance deleted');
      fetchPayrollData();
      fetchAdvancesData();
    } catch (err) {
      console.error('Error deleting advance:', err);
      alert('Failed to delete salary advance');
    }
  };

  // Process Salary Payment
  const openPayModal = (item) => {
    setSelectedPayrollToPay(item);
    setPayFormData({
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Bank Transfer',
      bank_name: banks.length > 0 ? banks[0].name : '',
      notes: item.notes || ''
    });
    setIsPayModalOpen(true);
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!selectedPayrollToPay) return;

    try {
      const res = await axios.post(`${API_URL}/payroll/${selectedPayrollToPay.id}/pay`, payFormData);
      showTempMessage(res.data.message || 'Payment processed & logged in Cashbook!');
      setIsPayModalOpen(false);
      fetchPayrollData();
    } catch (err) {
      console.error('Error processing payment:', err);
      alert(err.response?.data?.error || 'Failed to process payment');
    }
  };

  // Edit Item (Bonus, Allowance, Advances, Deductions)
  const openEditModal = (item) => {
    setEditingPayroll(item);
    setEditFormData({
      base_salary: item.base_salary,
      overtime_allowance: item.overtime_allowance || 0,
      bonus: item.bonus || 0,
      advance_salary: item.advance_salary || 0,
      tax_deduction: item.tax_deduction || 0,
      other_deductions: item.other_deductions || 0,
      notes: item.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingPayroll) return;

    try {
      await axios.put(`${API_URL}/payroll/${editingPayroll.id}`, editFormData);
      showTempMessage('Payroll item updated successfully');
      setIsEditModalOpen(false);
      fetchPayrollData();
    } catch (err) {
      console.error('Error updating payroll item:', err);
      alert('Failed to update payroll item');
    }
  };

  // Base Salaries Management
  const handleBaseSalaryChange = (userId, val) => {
    setBaseSalariesData(prev => prev.map(item => 
      item.user_id === userId ? { ...item, base_salary: val } : item
    ));
  };

  const handleSaveBaseSalaries = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/payroll/base-salaries`, { salaries: baseSalariesData });
      showTempMessage('Base salaries updated successfully');
      setIsBaseSalariesModalOpen(false);
      fetchEmployees();
      fetchPayrollData();
    } catch (err) {
      console.error('Error updating base salaries:', err);
      alert('Failed to update base salaries');
    }
  };

  // Delete Payroll Item
  const handleDeletePayroll = async (id) => {
    if (!window.confirm('Are you sure you want to delete this payroll record? If paid, its corresponding cashbook entry will also be deleted.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/payroll/${id}`);
      showTempMessage('Payroll record deleted');
      fetchPayrollData();
    } catch (err) {
      console.error('Error deleting payroll:', err);
      alert('Failed to delete payroll record');
    }
  };

  // Filtered Payrolls
  const filteredPayrolls = payrolls.filter(item => {
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = item.employee_name && item.employee_name.toLowerCase().includes(term);
      const matchEmail = item.employee_email && item.employee_email.toLowerCase().includes(term);
      const matchRole = item.employee_role && item.employee_role.toLowerCase().includes(term);
      if (!matchName && !matchEmail && !matchRole) return false;
    }
    return true;
  });

  const currentPayrolls = filteredPayrolls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Summary Metrics
  const totalPayrollSum = payrolls.reduce((sum, item) => sum + parseFloat(item.net_salary || 0), 0);
  const totalPaidSum = payrolls.filter(item => item.status === 'Paid').reduce((sum, item) => sum + parseFloat(item.net_salary || 0), 0);
  const totalAdvancesSum = payrolls.reduce((sum, item) => sum + parseFloat(item.advance_salary || 0), 0);
  const totalPendingSum = totalPayrollSum - totalPaidSum;

  // Real-time calculation for Edit Modal
  const editGross = parseFloat(editFormData.base_salary || 0) + parseFloat(editFormData.overtime_allowance || 0) + parseFloat(editFormData.bonus || 0);
  const editTotalDeductions = parseFloat(editFormData.advance_salary || 0) + parseFloat(editFormData.tax_deduction || 0) + parseFloat(editFormData.other_deductions || 0);
  const editNet = Math.max(0, editGross - editTotalDeductions);

  return (
    <div className="payroll-container">
      {/* Header Actions */}
      <div className="payroll-header-section" style={{ justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
        <div className="payroll-actions">
          <button className="btn-secondary-payroll" onClick={() => setIsAdvanceModalOpen(true)}>
            <ArrowDownRight size={18} color="#dc2626" /> Issue Salary Advance
          </button>
          <button className="btn-secondary-payroll" onClick={() => setIsBaseSalariesModalOpen(true)}>
            <Building2 size={18} /> Manage Base Salaries
          </button>
          <button className="btn-primary-payroll" onClick={handleGeneratePayroll}>
            <Plus size={18} /> Generate {selectedMonth} Payroll
          </button>
        </div>
      </div>

      {successMessage && (
        <div style={{ background: '#dcfce7', color: '#15803d', padding: '0.85rem 1.25rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #bbf7d0', fontWeight: 600 }}>
          ✓ {successMessage}
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.85rem 1.25rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #fecaca', fontWeight: 600 }}>
          ⚠ {error}
        </div>
      )}

      {/* SECTION 1: PAYROLL SUMMARY CARDS */}
      <div className="payroll-stats-grid">
        <div className="payroll-stat-card">
          <div className="payroll-stat-icon indigo">
            <Banknote size={24} />
          </div>
          <div className="payroll-stat-info">
            <p>NET PAYABLE ({selectedMonth})</p>
            <h3>PKR {totalPayrollSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
        </div>

        <div className="payroll-stat-card">
          <div className="payroll-stat-icon green">
            <CheckCircle size={24} />
          </div>
          <div className="payroll-stat-info">
            <p>PAID SALARIES</p>
            <h3 style={{ color: '#16a34a' }}>PKR {totalPaidSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
        </div>

        <div className="payroll-stat-card">
          <div className="payroll-stat-icon red">
            <ArrowDownRight size={24} />
          </div>
          <div className="payroll-stat-info">
            <p>SALARY ADVANCES PAID</p>
            <h3 style={{ color: '#dc2626' }}>PKR {totalAdvancesSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
        </div>

        <div className="payroll-stat-card">
          <div className="payroll-stat-icon purple">
            <Clock size={24} />
          </div>
          <div className="payroll-stat-info">
            <p>PENDING PAYOUT</p>
            <h3 style={{ color: '#b45309' }}>PKR {totalPendingSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
        </div>
      </div>

      {/* SECTION 2: LIVE CASH IN HAND & BANK ACCOUNT CARDS */}
      <h4 style={{ margin: '1.5rem 0 0.75rem 0', color: '#475569', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Live Account & Cash Balances
      </h4>

      <div className="payroll-stats-grid" style={{ marginBottom: '2rem' }}>
        {/* CASH IN HAND CARD */}
        <div className="payroll-stat-card" style={{ border: '1px solid #bbf7d0', background: '#f0fdf4' }}>
          <div className="payroll-stat-icon green" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <Wallet size={24} />
          </div>
          <div className="payroll-stat-info">
            <p style={{ color: '#166534' }}>CASH IN HAND BALANCE</p>
            <h3 style={{ color: accountBalances.cashInHand < 0 ? '#dc2626' : '#15803d' }}>
              PKR {accountBalances.cashInHand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        {/* DYNAMIC BANK CARDS */}
        {banks.map(b => {
          const bBal = accountBalances.bankTotals?.[b.name] || 0;
          return (
            <div className="payroll-stat-card" key={b.id} style={{ border: '1px solid #cbd5e1', background: '#ffffff' }}>
              <div className="payroll-stat-icon indigo" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                <Building2 size={24} />
              </div>
              <div className="payroll-stat-info">
                <p style={{ color: '#475569' }}>{b.name.toUpperCase()} BALANCE</p>
                <h3 style={{ color: bBal < 0 ? '#dc2626' : '#0f172a' }}>
                  PKR {bBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar & Tabs */}
      <div className="payroll-toolbar">
        <div className="payroll-filters-left">
          <div style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem' }}>
            <button 
              className={`btn-secondary-payroll ${activeTab === 'payroll' ? 'active' : ''}`}
              style={{ background: activeTab === 'payroll' ? '#0f172a' : '#f8fafc', color: activeTab === 'payroll' ? '#fff' : '#475569', border: 'none' }}
              onClick={() => setActiveTab('payroll')}
            >
              <FileText size={16} /> Monthly Payroll Sheet
            </button>
            <button 
              className={`btn-secondary-payroll ${activeTab === 'advances' ? 'active' : ''}`}
              style={{ background: activeTab === 'advances' ? '#0f172a' : '#f8fafc', color: activeTab === 'advances' ? '#fff' : '#475569', border: 'none' }}
              onClick={() => setActiveTab('advances')}
            >
              <ArrowDownRight size={16} /> Salary Advances Log ({advances.length})
            </button>
          </div>

          <div className="month-picker-container">
            <Calendar size={16} color="#64748b" />
            <label>Month:</label>
            <input 
              type="month" 
              className="month-picker-input"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {activeTab === 'payroll' && (
            <>
              <div className="payroll-search-box">
                <Search size={16} color="#64748b" />
                <input 
                  type="text" 
                  placeholder="Search by employee name, email, role..." 
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <select 
                value={statusFilter} 
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '0.85rem', outline: 'none' }}
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: PAYROLL SHEET */}
      {activeTab === 'payroll' && (
        <div className="payroll-table-container">
          <table className="modern-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Base Salary</th>
                <th>Allowances / Bonus (+)</th>
                <th>Gross Salary</th>
                <th>Salary Advance (-)</th>
                <th>Taxes / Other (-)</th>
                <th>Net Payable</th>
                <th>Status</th>
                <th>Payment Info</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="empty-state">Loading payroll records...</td>
                </tr>
              ) : currentPayrolls.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-state">
                    No payroll records found for {selectedMonth}. Click <strong>"Generate {selectedMonth} Payroll"</strong> above to populate monthly salaries.
                  </td>
                </tr>
              ) : (
                currentPayrolls.map(item => {
                  const gross = (parseFloat(item.gross_salary) || (parseFloat(item.base_salary || 0) + parseFloat(item.overtime_allowance || 0) + parseFloat(item.bonus || 0)));
                  const allowances = parseFloat(item.overtime_allowance || 0) + parseFloat(item.bonus || 0);
                  const adv = parseFloat(item.advance_salary || 0);
                  const otherDeds = parseFloat(item.tax_deduction || 0) + parseFloat(item.other_deductions || 0) + (parseFloat(item.deductions || 0) - adv);

                  return (
                    <tr key={item.id}>
                      <td className="fw-600">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                            {item.employee_name ? item.employee_name.charAt(0).toUpperCase() : 'E'}
                          </div>
                          <div>
                            <div>{item.employee_name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>{item.employee_role}</div>
                          </div>
                        </div>
                      </td>
                      <td>PKR {parseFloat(item.base_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="text-success">+ PKR {allowances.toFixed(2)}</td>
                      <td style={{ fontWeight: 700, color: '#334155' }}>PKR {gross.toFixed(2)}</td>
                      <td className="text-danger" style={{ fontWeight: adv > 0 ? 700 : 400 }}>
                        {adv > 0 ? `- PKR ${adv.toFixed(2)}` : 'PKR 0.00'}
                      </td>
                      <td className="text-danger">{otherDeds > 0 ? `- PKR ${otherDeds.toFixed(2)}` : 'PKR 0.00'}</td>
                      <td style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                        PKR {parseFloat(item.net_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        {item.status === 'Paid' ? (
                          <span className="status-badge-paid">
                            <CheckCircle size={14} /> Paid
                          </span>
                        ) : (
                          <span className="status-badge-pending">
                            <Clock size={14} /> Pending
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {item.status === 'Paid' ? (
                          <div>
                            <div><strong>{item.payment_method}</strong> ({item.bank_name || 'Cash'})</div>
                            <div style={{ fontSize: '0.72rem' }}>{item.payment_date ? new Date(item.payment_date).toLocaleDateString() : ''}</div>
                          </div>
                        ) : (
                          <span>Unprocessed</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {item.status !== 'Paid' && (
                            <button 
                              className="action-btn-pay" 
                              onClick={() => openPayModal(item)}
                              title="Process Salary Payment"
                            >
                              <CreditCard size={14} /> Pay
                            </button>
                          )}
                          <button 
                            className="action-btn-slip" 
                            onClick={() => {
                              setPayslipItem(item);
                              setIsPayslipModalOpen(true);
                            }}
                            title="View / Print Payslip"
                          >
                            <Printer size={14} /> Payslip
                          </button>
                          <button 
                            style={{ border: 'none', background: '#f1f5f9', color: '#334155', padding: '0.35rem 0.5rem', borderRadius: '6px', cursor: 'pointer' }}
                            onClick={() => openEditModal(item)}
                            title="Edit Earnings/Deductions"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            style={{ border: 'none', background: '#fee2e2', color: '#ef4444', padding: '0.35rem 0.5rem', borderRadius: '6px', cursor: 'pointer' }}
                            onClick={() => handleDeletePayroll(item.id)}
                            title="Delete Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <Pagination 
            currentPage={currentPage}
            totalItems={filteredPayrolls.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* TAB 2: SALARY ADVANCES LOG */}
      {activeTab === 'advances' && (
        <div className="payroll-table-container">
          <table className="modern-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Advance Date</th>
                <th>Employee Name</th>
                <th>Advance Amount</th>
                <th>Payment Mode</th>
                <th>Bank Account</th>
                <th>Notes / Reason</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {advances.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No salary advances issued for {selectedMonth}. Click <strong>"Issue Salary Advance"</strong> above to record an advance payment.
                  </td>
                </tr>
              ) : (
                advances.map(adv => (
                  <tr key={adv.id}>
                    <td>{new Date(adv.advance_date).toLocaleDateString()}</td>
                    <td className="fw-600">{adv.employee_name}</td>
                    <td className="text-danger fw-600">PKR {parseFloat(adv.amount).toFixed(2)}</td>
                    <td>{adv.payment_method}</td>
                    <td>{adv.bank_name || 'Cash'}</td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{adv.notes || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        style={{ border: 'none', background: '#fee2e2', color: '#ef4444', padding: '0.35rem 0.5rem', borderRadius: '6px', cursor: 'pointer' }}
                        onClick={() => handleDeleteAdvance(adv.id)}
                        title="Delete Advance Entry"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: ISSUE SALARY ADVANCE */}
      {isAdvanceModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>Issue Salary Advance</h3>
              <button className="close-btn" onClick={() => setIsAdvanceModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleIssueAdvance}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label>Select Employee *</label>
                  <select 
                    required
                    value={advanceFormData.user_id}
                    onChange={e => setAdvanceFormData({ ...advanceFormData, user_id: e.target.value })}
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role}) - Base Salary: PKR {parseFloat(emp.base_salary || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Advance Amount (PKR) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    placeholder="e.g. 500"
                    value={advanceFormData.amount}
                    onChange={e => setAdvanceFormData({ ...advanceFormData, amount: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Advance Date *</label>
                  <input 
                    type="date" 
                    required 
                    value={advanceFormData.advance_date}
                    onChange={e => setAdvanceFormData({ ...advanceFormData, advance_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Payment Method *</label>
                  <select 
                    value={advanceFormData.payment_method}
                    onChange={e => setAdvanceFormData({ ...advanceFormData, payment_method: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online Transfer</option>
                  </select>
                  {advanceFormData.payment_method === 'Cash' && (
                    <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600, marginTop: '0.2rem', display: 'block' }}>
                      ✓ Available Cash in Hand: PKR {accountBalances.cashInHand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                {advanceFormData.payment_method !== 'Cash' && (
                  <div className="form-group">
                    <label>Bank Account *</label>
                    <select 
                      value={advanceFormData.bank_name}
                      onChange={e => setAdvanceFormData({ ...advanceFormData, bank_name: e.target.value })}
                    >
                      {banks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                    {advanceFormData.bank_name && (
                      <span style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600, marginTop: '0.2rem', display: 'block' }}>
                        ✓ Available Bank Balance: PKR {(accountBalances.bankTotals?.[advanceFormData.bank_name] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Notes / Purpose</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Mid-month emergency advance"
                    value={advanceFormData.notes}
                    onChange={e => setAdvanceFormData({ ...advanceFormData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary-payroll" onClick={() => setIsAdvanceModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary-payroll" style={{ background: '#dc2626' }}>
                  <ArrowDownRight size={18} /> Confirm Advance & Sync to Cashbook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROCESS SALARY PAYMENT */}
      {isPayModalOpen && selectedPayrollToPay && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Process Remaining Salary Payment</h3>
              <button className="close-btn" onClick={() => setIsPayModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleProcessPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Employee: <strong>{selectedPayrollToPay.employee_name}</strong></div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Month: <strong>{selectedPayrollToPay.month}</strong></div>
                  <div style={{ fontSize: '0.85rem', color: '#dc2626', marginTop: '0.2rem' }}>
                    Already Taken Advance: PKR {parseFloat(selectedPayrollToPay.advance_salary || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '1.25rem', color: '#16a34a', fontWeight: 800, marginTop: '0.4rem' }}>
                    Net Payable Salary: PKR {parseFloat(selectedPayrollToPay.net_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="form-group">
                  <label>Payment Date *</label>
                  <input 
                    type="date" 
                    required 
                    value={payFormData.payment_date}
                    onChange={e => setPayFormData({ ...payFormData, payment_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Payment Method *</label>
                  <select 
                    value={payFormData.payment_method}
                    onChange={e => setPayFormData({ ...payFormData, payment_method: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online Transfer</option>
                  </select>
                  {payFormData.payment_method === 'Cash' && (
                    <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 600, marginTop: '0.2rem', display: 'block' }}>
                      ✓ Available Cash in Hand: PKR {accountBalances.cashInHand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                {payFormData.payment_method !== 'Cash' && (
                  <div className="form-group">
                    <label>Bank Account *</label>
                    <select 
                      value={payFormData.bank_name}
                      onChange={e => setPayFormData({ ...payFormData, bank_name: e.target.value })}
                    >
                      {banks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                    {payFormData.bank_name && (
                      <span style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600, marginTop: '0.2rem', display: 'block' }}>
                        ✓ Available Bank Balance: PKR {(accountBalances.bankTotals?.[payFormData.bank_name] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Notes / Remarks</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Final salary payout Ref #12345"
                    value={payFormData.notes}
                    onChange={e => setPayFormData({ ...payFormData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary-payroll" onClick={() => setIsPayModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary-payroll" style={{ background: '#10b981' }}>
                  <CreditCard size={18} /> Confirm & Sync to Cashbook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT PAYROLL ITEM (EARNINGS & DEDUCTIONS) */}
      {isEditModalOpen && editingPayroll && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3>Detailed Salary Breakdown ({editingPayroll.employee_name})</h3>
              <button className="close-btn" onClick={() => setIsEditModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* EARNINGS */}
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e293b', fontSize: '0.9rem', textTransform: 'uppercase' }}>EARNINGS</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label>Base Salary (PKR)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editFormData.base_salary}
                        onChange={e => setEditFormData({ ...editFormData, base_salary: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Overtime (PKR)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editFormData.overtime_allowance}
                        onChange={e => setEditFormData({ ...editFormData, overtime_allowance: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Bonus (PKR)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editFormData.bonus}
                        onChange={e => setEditFormData({ ...editFormData, bonus: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, marginTop: '0.5rem', color: '#0f172a', fontSize: '0.88rem' }}>
                    Total Gross Salary: PKR {editGross.toFixed(2)}
                  </div>
                </div>

                {/* DEDUCTIONS */}
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: '#991b1b', fontSize: '0.9rem', textTransform: 'uppercase' }}>DEDUCTIONS</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label style={{ color: '#991b1b' }}>Advance Salary (PKR)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editFormData.advance_salary}
                        onChange={e => setEditFormData({ ...editFormData, advance_salary: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ color: '#991b1b' }}>Tax (PKR)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editFormData.tax_deduction}
                        onChange={e => setEditFormData({ ...editFormData, tax_deduction: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ color: '#991b1b' }}>Other (PKR)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editFormData.other_deductions}
                        onChange={e => setEditFormData({ ...editFormData, other_deductions: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, marginTop: '0.5rem', color: '#991b1b', fontSize: '0.88rem' }}>
                    Total Deductions: PKR {editTotalDeductions.toFixed(2)}
                  </div>
                </div>

                {/* NET SALARY RESULT */}
                <div style={{ padding: '0.85rem 1.25rem', background: '#ecfdf5', border: '1.5px solid #10b981', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#065f46' }}>CALCULATED NET SALARY:</span>
                  <span style={{ fontWeight: 800, color: '#047857', fontSize: '1.2rem' }}>PKR {editNet.toFixed(2)}</span>
                </div>

                <div className="form-group">
                  <label>Notes / Reason</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Overtime bonus, Advance deduction"
                    value={editFormData.notes}
                    onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary-payroll" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary-payroll">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: BASE SALARIES MODAL */}
      {isBaseSalariesModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3>Manage Default Employee Base Salaries</h3>
              <button className="close-btn" onClick={() => setIsBaseSalariesModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveBaseSalaries}>
              <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="modern-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th>Default Base Salary (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baseSalariesData.map(emp => (
                      <tr key={emp.user_id}>
                        <td className="fw-600">{emp.name}</td>
                        <td>{emp.role}</td>
                        <td>
                          <input 
                            type="number"
                            step="0.01"
                            style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', width: '150px' }}
                            value={emp.base_salary}
                            onChange={e => handleBaseSalaryChange(emp.user_id, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary-payroll" onClick={() => setIsBaseSalariesModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary-payroll">Save Base Salaries</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: PRINTABLE PAYSLIP MODAL */}
      {isPayslipModalOpen && payslipItem && (() => {
        const base = parseFloat(payslipItem.base_salary || 0);
        const overtime = parseFloat(payslipItem.overtime_allowance || 0);
        const bonus = parseFloat(payslipItem.bonus || 0);
        const gross = parseFloat(payslipItem.gross_salary || (base + overtime + bonus));

        const advance = parseFloat(payslipItem.advance_salary || 0);
        const tax = parseFloat(payslipItem.tax_deduction || 0);
        const otherDeductions = parseFloat(payslipItem.other_deductions || 0);
        const totalDeductions = parseFloat(payslipItem.deductions || (advance + tax + otherDeductions));
        const net = parseFloat(payslipItem.net_salary || (gross - totalDeductions));

        return (
          <div className="modal-overlay">
            <div className="payslip-modal-content">
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Salary Payslip Preview</h3>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn-primary-payroll" onClick={() => window.print()}>
                    <Printer size={18} /> Print Payslip
                  </button>
                  <button className="btn-secondary-payroll" onClick={() => setIsPayslipModalOpen(false)}>
                    <X size={18} /> Close
                  </button>
                </div>
              </div>

              {/* Printable Payslip Container */}
              <div className="payslip-document" id="printable-payslip">
                <div className="payslip-header">
                  <div className="payslip-company">
                    <h2>ADWISE LABS</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Sales Agent & Media Management System</p>
                  </div>
                  <div className="payslip-title-box">
                    <h3>PAYSLIP</h3>
                    <p>For the Month of <strong>{payslipItem.month}</strong></p>
                  </div>
                </div>

                <div className="payslip-employee-grid">
                  <div className="payslip-emp-row">
                    <span className="label">Employee Name:</span>
                    <span className="value">{payslipItem.employee_name}</span>
                  </div>
                  <div className="payslip-emp-row">
                    <span className="label">Employee Email:</span>
                    <span className="value">{payslipItem.employee_email}</span>
                  </div>
                  <div className="payslip-emp-row">
                    <span className="label">Designation/Role:</span>
                    <span className="value">{payslipItem.employee_role}</span>
                  </div>
                  <div className="payslip-emp-row">
                    <span className="label">Payment Status:</span>
                    <span className="value" style={{ color: payslipItem.status === 'Paid' ? '#16a34a' : '#b45309', fontWeight: 800 }}>
                      {payslipItem.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="payslip-emp-row">
                    <span className="label">Payment Date:</span>
                    <span className="value">{payslipItem.payment_date ? new Date(payslipItem.payment_date).toLocaleDateString() : 'Pending'}</span>
                  </div>
                  <div className="payslip-emp-row">
                    <span className="label">Payment Method:</span>
                    <span className="value">{payslipItem.payment_method || '-'} ({payslipItem.bank_name || 'Cash'})</span>
                  </div>
                </div>

                <div className="payslip-table-grid">
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '0.95rem' }}>EARNINGS</h4>
                    <table className="payslip-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th style={{ textAlign: 'right' }}>Amount (PKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Base Salary</td>
                          <td style={{ textAlign: 'right' }}>{base.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td>Overtime / Allowance</td>
                          <td style={{ textAlign: 'right' }}>{overtime.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td>Performance Bonus</td>
                          <td style={{ textAlign: 'right' }}>{bonus.toFixed(2)}</td>
                        </tr>
                        <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                          <td>TOTAL GROSS SALARY</td>
                          <td style={{ textAlign: 'right' }}>{gross.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '0.95rem' }}>DEDUCTIONS</h4>
                    <table className="payslip-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th style={{ textAlign: 'right' }}>Amount (PKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Advance Salary Deduction</td>
                          <td style={{ textAlign: 'right' }}>{advance.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td>Income Tax</td>
                          <td style={{ textAlign: 'right' }}>{tax.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td>Other Deductions / Penalties</td>
                          <td style={{ textAlign: 'right' }}>{otherDeductions.toFixed(2)}</td>
                        </tr>
                        <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                          <td>TOTAL DEDUCTIONS</td>
                          <td style={{ textAlign: 'right' }}>{totalDeductions.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="payslip-net-box">
                  <div>
                    <h4>NET PAYABLE SALARY</h4>
                    <span style={{ fontSize: '0.8rem', color: '#047857' }}>Total Gross Salary minus Total Deductions</span>
                  </div>
                  <h2>PKR {net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                </div>

                {payslipItem.notes && (
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                    <strong>Notes:</strong> {payslipItem.notes}
                  </div>
                )}

                <div className="payslip-signatures">
                  <div className="payslip-sig-line">Employee Signature</div>
                  <div className="payslip-sig-line">Authorized Signatory (Adwise)</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
