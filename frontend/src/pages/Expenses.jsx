import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Download, Briefcase, CreditCard, DollarSign, X, Building2, FileText, AlertCircle, Search } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Select from 'react-select';
import './Expenses.css';
import './Modal.css';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [clients, setClients] = useState([]);
  const [banks, setBanks] = useState([]);
  const [summary, setSummary] = useState({ cashInHand: 0, otherExpenses: 0, totalNetBalance: 0, bankTotals: {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isManageBanksModalOpen, setIsManageBanksModalOpen] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    client: '',
    description: '',
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
  }, []);

  const fetchBanks = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/banks');
      setBanks(res.data);
    } catch (err) {
      console.error('Failed to fetch banks', err);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/reports/clients');
      setClients(res.data);
    } catch (err) {
      console.error('Failed to fetch clients', err);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/expenses');
      setExpenses(res.data.data);
      setSummary(res.data.summary);
    } catch (err) {
      console.error('Failed to fetch expenses', err);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/expenses/${editingId}`, formData);
      } else {
        await axios.post('http://localhost:5000/api/expenses', formData);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        client: '',
        description: '',
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
      mode: exp.mode || 'Cash',
      bank: exp.bank || '',
      reference: exp.reference || '',
      type: exp.receipt_amount > 0 ? 'receipt' : 'payment',
      amount: exp.receipt_amount > 0 ? exp.receipt_amount : exp.payment_amount
    });
    setIsModalOpen(true);
  };

  const handleWipeData = async () => {
    if (window.confirm("Are you sure you want to wipe all expense data? This cannot be undone.")) {
      try {
        await axios.delete('http://localhost:5000/api/expenses/wipe');
        fetchExpenses();
      } catch (err) {
        console.error('Error wiping data', err);
        alert('Failed to wipe data');
      }
    }
  };

  const handleCreateBank = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/banks', { name: newBankName });
      setNewBankName('');
      fetchBanks();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating bank');
    }
  };

  const handleDeleteBank = async (id) => {
    if (window.confirm("Delete this bank?")) {
      try {
        await axios.delete(`http://localhost:5000/api/banks/${id}`);
        fetchBanks();
      } catch (err) {
        alert(err.response?.data?.error || 'Error deleting bank');
      }
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Expense Report', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.text(`Cash in Hand: $${summary.cashInHand.toFixed(2)}`, 14, 40);
    doc.text(`Other Expenses: $${summary.otherExpenses.toFixed(2)}`, 14, 46);
    doc.text(`Total Net Balance: $${summary.totalNetBalance.toFixed(2)}`, 14, 52);

    const tableColumn = ["Date", "Client/Party", "Description", "Mode", "Bank", "Ref", "Receipt", "Payment", "Balance"];
    const tableRows = expenses.map(exp => [
      new Date(exp.date).toLocaleDateString(),
      exp.client,
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

  const filteredExpenses = expenses.filter(exp => 
    (exp.client && exp.client.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (exp.description && exp.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const clientOptions = clients.map(c => ({
    value: c.full_name,
    label: `${c.full_name} ${c.business_name ? `(${c.business_name})` : ''}`.trim()
  }));

  return (
    <div className="expenses-container modern-ui">
      <div className="expenses-controls">
        <h2>Expense</h2>
        <div className="controls-right">
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
            <p>OTHER EXPENSES</p>
            <h3>PKR {summary.otherExpenses?.toFixed(2) || '0.00'}</h3>
          </div>
        </div>
        <div className="expense-card" style={{ flex: '1 1 300px' }}>
          <div className="expense-card-icon bg-gray">
            <DollarSign size={24} />
          </div>
          <div className="expense-card-info">
            <p>TOTAL NET BALANCE</p>
            <h3>PKR {summary.totalNetBalance?.toFixed(2) || '0.00'}</h3>
          </div>
        </div>

        <div className="expense-card" style={{ flex: '1 1 300px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div className="expense-card-icon" style={{ backgroundColor: '#cffafe', color: '#0891b2' }}>
            <FileText size={24} />
          </div>
          <div className="expense-card-info">
            <p>TOTAL INVOICED</p>
            <h3 style={{ color: '#0891b2' }}>PKR {Number(summary.totalInvoiced || 0).toFixed(2)}</h3>
          </div>
        </div>

        <div className="expense-card" style={{ flex: '1 1 300px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div className="expense-card-icon" style={{ backgroundColor: '#ffe4e6', color: '#e11d48' }}>
            <AlertCircle size={24} />
          </div>
          <div className="expense-card-info">
            <p>UNPAID INVOICES</p>
            <h3 style={{ color: '#e11d48' }}>PKR {Number(summary.totalInvoiceBalance || 0).toFixed(2)}</h3>
          </div>
        </div>

        {/* Dynamic Bank Cards */}
        {banks.map(bank => {
          const bankBalance = summary.bankTotals?.[bank.name] || 0;
          return (
            <div className="expense-card" key={bank.id} style={{ flex: '1 1 300px' }}>
              <div className="expense-card-icon" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
                <Building2 size={24} />
              </div>
              <div className="expense-card-info">
                <p>{bank.name.toUpperCase()}</p>
                <h3 style={{ color: bankBalance < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>PKR {bankBalance.toFixed(2)}
                </h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expenses Table */}
      <div className="recent-orders-panel" style={{ marginTop: '2rem' }}>
        <div className="table-responsive-ref">
          <table className="ref-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>PARTY/CLIENT</th>
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
              {filteredExpenses.map(exp => (
                <tr key={exp.id}>
                  <td>{new Date(exp.date).toLocaleDateString()}</td>
                  <td style={{fontWeight: '600'}}>{exp.client}</td>
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
                        await axios.delete(`http://localhost:5000/api/expenses/${exp.id}`);
                        fetchExpenses();
                      }
                    }} title="Delete Entry"><X size={16} /></button>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan="10" className="empty-state" style={{textAlign: 'center', padding: '2rem'}}>No expenses found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                
                {formData.client && clients.find(c => c.full_name === formData.client) && (
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
                        PKR {Number(clients.find(c => c.full_name === formData.client).total_invoiced_amount || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Remaining Balance:</span>
                      <strong style={{ 
                        marginLeft: '0.5rem', 
                        color: Number(clients.find(c => c.full_name === formData.client).total_balance) > 0 ? 'var(--danger)' : 'var(--success)' 
                      }}>
                        PKR {Number(clients.find(c => c.full_name === formData.client).total_balance || 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                )}
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
    </div>
  );
}
