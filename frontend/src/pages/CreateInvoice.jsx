import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Printer, Edit } from 'lucide-react';
import Select from 'react-select';
import './InvoiceManagement.css'; // Reuse existing styles

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [products, setProducts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [banks, setBanks] = useState([]);
  const [isEditingInvNum, setIsEditingInvNum] = useState(false);
  const [isEditingBillFrom, setIsEditingBillFrom] = useState(false);
  const [activeTab, setActiveTab] = useState('invoice');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    transaction_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    bank: '',
    notes: ''
  });
  
  const [formData, setFormData] = useState({
    invoice_number: `INV-${Date.now()}`,
    client_id: '',
    project_id: '',
    agent_id: '',
    discount: 0,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    terms_and_conditions: '1. Payment is due within the specified due date.\n2. Late payments may incur an additional 10% fee.\n3. Revisions are subject to the agreed terms.',
    bill_from_name: 'Adwise Labs',
    bill_from_address: 'A-205 / II Saba Ave, DHA Karachi Phase VIII Zone A Phase VIII\nDefence Housing Authority\nKarachi Sindh\n76500',
    items: []
  });

  const [termsAndConditions, setTermsAndConditions] = useState('');

  useEffect(() => {
    fetchDropdowns();
  }, [id]);

  const fetchDropdowns = async () => {
    try {
      axios.get('/api/settings').then(res => {
        if (res.data && res.data.terms_and_conditions) {
          setTermsAndConditions(res.data.terms_and_conditions);
        }
      }).catch(err => console.error(err));

      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      let queryParams = '';
      if (user) {
        queryParams = `?user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
      }

      const [cliRes, projRes, prodRes, agentRes, banksRes] = await Promise.all([
        axios.get(`/api/clients${queryParams}`),
        axios.get('/api/projects'),
        axios.get('/api/products'),
        axios.get('/api/users'),
        axios.get('/api/banks')
      ]);
      setClients(cliRes.data);
      setProjects(projRes.data);
      setProducts(prodRes.data);
      setAgents(agentRes.data);
      setBanks(banksRes.data);
      
      if (id) {
        const invRes = await axios.get(`/api/invoices/${id}`);
        const inv = invRes.data;
        setFormData({
          invoice_number: inv.invoice_number,
          client_id: inv.client_id,
          project_id: inv.project_id || '',
          agent_id: inv.agent_id || '',
          discount: inv.discount || 0,
          issue_date: inv.issue_date ? new Date(inv.issue_date).toISOString().split('T')[0] : '',
          due_date: inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : '',
          terms_and_conditions: inv.terms_and_conditions,
          bill_from_name: inv.bill_from_name || 'Adwise Labs',
          bill_from_address: inv.bill_from_address || 'A-205 / II Saba Ave, DHA Karachi Phase VIII Zone A Phase VIII\nDefence Housing Authority\nKarachi Sindh\n76500',
          items: inv.items.map(item => ({
            description: item.description,
            details: item.details || '',
            category: 'SERVICE', // Default mapping
            quantity: item.quantity,
            unit: item.unit || '',
            unit_price: item.unit_price
          }))
        });
        setPayments(inv.payments || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', details: '', category: 'SERVICE', quantity: 1, unit: '', unit_price: 0 }]
    });
  };

  const addProductFromCatalog = (product) => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: product.name, details: product.description || '', category: 'SERVICE', quantity: 1, unit: '', unit_price: product.default_price }]
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateSubTotal = () => {
    return formData.items.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  const calculateTotal = () => {
    const subTotal = calculateSubTotal();
    return subTotal - (parseFloat(formData.discount) || 0);
  };

  const calculateCommission = () => {
    if (!formData.agent_id) return 0;
    const selectedAgent = agents.find(a => String(a.id) === String(formData.agent_id));
    if (!selectedAgent || !selectedAgent.commission_percentage) return 0;
    
    const commPct = parseFloat(selectedAgent.commission_percentage) || 0;
    const serviceTotal = formData.items
      .filter(item => item.category === 'SERVICE')
      .reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      
    return (serviceTotal * commPct) / 100;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      alert("Please add at least one line item.");
      return;
    }
    const commission_amount = calculateCommission();
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const dataToSend = {
      ...formData,
      commission_amount,
      created_by: user ? user.id : null
    };
    try {
      if (id) {
        await axios.put(`/api/invoices/${id}`, dataToSend);
      } else {
        await axios.post('/api/invoices', dataToSend);
      }
      navigate('/invoices');
    } catch (error) {
      console.error('Failed to save invoice:', error);
      alert(error.response?.data?.error || 'Error saving invoice.');
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    try {
      await axios.post(`/api/invoices/${id}/payments`, paymentForm);
      setShowPaymentModal(false);
      setPaymentForm({
        amount: '',
        transaction_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Bank Transfer',
        notes: ''
      });
      fetchData(); // Refresh to get updated payments and balance
    } catch (error) {
      console.error('Failed to record payment:', error);
      alert(error.response?.data?.error || 'Error recording payment.');
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const invoiceTotal = calculateTotal();
  const remainingBalance = Math.max(0, invoiceTotal - totalPaid);

  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '2rem' }}>
      <div className="invoice-editor-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* TOP TABS */}
        <div className="invoice-editor-tabs print-hide">
          <div 
            className={`invoice-editor-tab ${activeTab === 'invoice' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoice')}
            style={{ cursor: 'pointer' }}
          >
            Invoice
          </div>
          {id && (
            <div 
              className={`invoice-editor-tab ${activeTab === 'payments' ? 'active' : ''}`}
              onClick={() => setActiveTab('payments')}
              style={{ cursor: 'pointer' }}
            >
              Payments
            </div>
          )}
        </div>

        {activeTab === 'invoice' && (
          <form onSubmit={handleSubmit}>
          {/* HEADER ACTIONS */}
          <div className="invoice-editor-header">
            <span className="invoice-badge-unpaid">UNPAID</span>
            <div className="invoice-editor-actions print-hide">
              <button type="button" className="btn-icon-outline" onClick={() => window.print()}>
                <Printer size={16} />
              </button>
              <button type="button" className="btn-purple" style={{ padding: '0.5rem' }} onClick={() => setIsEditingInvNum(!isEditingInvNum)} title="Edit Invoice Number">
                <Edit size={16} />
              </button>
              {id && (
                <button type="button" className="btn-green" onClick={() => setShowPaymentModal(true)}>
                  <Plus size={16} /> Payment
                </button>
              )}
            </div>
          </div>

          {isEditingInvNum ? (
            <input 
              type="text"
              name="invoice_number"
              value={formData.invoice_number}
              onChange={handleInputChange}
              className="invoice-editor-title"
              style={{ background: 'transparent', border: '1px dashed #cbd5e1', width: 'auto', outline: 'none' }}
              autoFocus
              onBlur={() => setIsEditingInvNum(false)}
            />
          ) : (
            <h1 className="invoice-editor-title">{formData.invoice_number}</h1>
          )}

          {/* BILLING GRID */}
          <div className="invoice-editor-grid">
            <div className="bill-from-box" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="bill-from-label" style={{ margin: 0 }}>BILL FROM</div>
                {!isEditingBillFrom && (
                  <button type="button" className="btn-icon" onClick={() => setIsEditingBillFrom(true)} style={{ padding: '0.2rem' }}>
                    <Edit size={14} />
                  </button>
                )}
              </div>
              
              {isEditingBillFrom ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    type="text"
                    name="bill_from_name"
                    value={formData.bill_from_name}
                    onChange={handleInputChange}
                    style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#0f172a', padding: '0.2rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  />
                  <textarea
                    name="bill_from_address"
                    value={formData.bill_from_address}
                    onChange={handleInputChange}
                    rows="4"
                    style={{ fontSize: '0.85rem', color: '#334155', padding: '0.2rem', border: '1px solid #cbd5e1', borderRadius: '4px', resize: 'vertical' }}
                  />
                  <button type="button" className="btn-success" onClick={() => setIsEditingBillFrom(false)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', alignSelf: 'flex-start' }}>Done</button>
                </div>
              ) : (
                <>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.1rem' }}>{formData.bill_from_name}</h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {formData.bill_from_address}
                  </p>
                </>
              )}
            </div>

            <div className="bill-to-section">
              <div style={{ textAlign: 'right', paddingRight: '0.5rem' }}>
                <div className="bill-to-label">BILL TO</div>
              </div>
              
              <div className="bill-to-row" style={{ minWidth: '300px' }}>
                <Select
                  options={clients.map(c => ({ value: c.id, label: `${c.full_name} (${c.business_name || 'Individual'})` }))}
                  value={formData.client_id ? { 
                    value: formData.client_id, 
                    label: clients.find(c => c.id === formData.client_id) 
                      ? `${clients.find(c => c.id === formData.client_id).full_name} (${clients.find(c => c.id === formData.client_id).business_name || 'Individual'})` 
                      : 'Select Client...' 
                  } : null}
                  onChange={(selectedOption) => handleInputChange({ target: { name: 'client_id', value: selectedOption ? selectedOption.value : '' } })}
                  placeholder="Select Client..."
                  isSearchable={true}
                  isClearable={true}
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      backgroundColor: '#eff6ff',
                      borderColor: state.isFocused ? 'var(--primary-color)' : 'transparent',
                      fontWeight: '700',
                      boxShadow: 'none',
                      padding: '2px',
                      '&:hover': {
                        borderColor: '#cbd5e1'
                      }
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'var(--accent-color)',
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
              </div>

              <div className="bill-to-row">
                <label>Invoice Date:</label>
                <input 
                  type="date" 
                  name="issue_date" 
                  value={formData.issue_date} 
                  onChange={handleInputChange} 
                  required 
                  className="bill-to-input"
                />
              </div>

              <div className="bill-to-row">
                <label>Due Date:</label>
                <input 
                  type="date" 
                  name="due_date" 
                  value={formData.due_date} 
                  onChange={handleInputChange} 
                  required 
                  className="bill-to-input"
                />
              </div>

              <div className="bill-to-row">
                <label>Sale Agent:</label>
                <select 
                  name="agent_id"
                  value={formData.agent_id}
                  onChange={handleInputChange}
                  className="bill-to-input"
                  required
                >
                  <option value="">Select Agent... (Required)</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.commission_percentage || 0}%)</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* TABLE */}
          <table className="invoice-table-modern">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ width: '30%' }}>ITEM</th>
                <th style={{ width: '15%' }}>CATEGORY</th>
                <th style={{ width: '8%', textAlign: 'center' }}>QTY</th>
                <th style={{ width: '15%', textAlign: 'center' }}>RATE</th>
                <th style={{ width: '15%', textAlign: 'right' }}>AMOUNT</th>
                <th className="print-hide" style={{ width: '40px', textAlign: 'center' }}>
                  <button type="button" onClick={addItem} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: '0 auto' }}>
                    <Plus size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {formData.items.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Click + to add a line item</td>
                </tr>
              )}
              {formData.items.map((item, index) => (
                <tr key={index}>
                  <td style={{ color: '#94a3b8', fontWeight: 'bold' }}>{index + 1}</td>
                  <td>
                    <input 
                      type="text" 
                      placeholder="Item name" 
                      value={item.description} 
                      onChange={(e) => updateItem(index, 'description', e.target.value)} 
                      required 
                      className="border-bottom"
                      style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.95rem', marginBottom: '0.5rem' }}
                    />
                    <textarea 
                      placeholder="Add detailed product description..." 
                      value={item.details || ''} 
                      onChange={(e) => updateItem(index, 'details', e.target.value)} 
                      rows="2"
                      style={{ 
                        marginTop: '0.25rem', 
                        width: '100%', 
                        fontSize: '0.85rem', 
                        color: '#475569', 
                        resize: 'vertical', 
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '0.6rem 0.75rem',
                        fontFamily: 'inherit',
                        transition: 'all 0.2s ease',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                        lineHeight: '1.4'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--primary-color)';
                        e.target.style.backgroundColor = '#ffffff';
                        e.target.style.boxShadow = '0 0 0 3px rgba(3, 105, 161, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.backgroundColor = '#f8fafc';
                        e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.02)';
                      }}
                    />
                  </td>
                  <td>
                    <div className="category-toggle">
                      <span 
                        className={item.category === 'SERVICE' ? 'active' : ''}
                        onClick={() => updateItem(index, 'category', 'SERVICE')}
                      >
                        SERVICE
                      </span>
                      <span 
                        className={item.category === 'OTHER' ? 'active' : ''}
                        onClick={() => updateItem(index, 'category', 'OTHER')}
                      >
                        OTHER
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="number" 
                      min="1" 
                      value={item.quantity} 
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)} 
                      required 
                      style={{ textAlign: 'center' }}
                    />
                    <input
                      type="text"
                      placeholder="unit (e.g. pc)"
                      value={item.unit || ''}
                      onChange={(e) => updateItem(index, 'unit', e.target.value)}
                      style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', width: '100%', borderBottom: '1px dashed #cbd5e1' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="number" 
                      value={item.unit_price} 
                      onChange={(e) => updateItem(index, 'unit_price', e.target.value)} 
                      min="0" 
                      step="0.01" 
                      required 
                      style={{ textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>PKR {(item.quantity * item.unit_price).toFixed(2)}
                  </td>
                  <td className="print-hide" style={{ textAlign: 'center' }}>
                    <button type="button" onClick={() => removeItem(index)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* TOTALS */}
          <div className="totals-section">
            <div className="totals-grid">
              <div className="totals-label">Sub Total</div>
              <div className="totals-value">PKR {calculateSubTotal().toFixed(2)}</div>

              <div className="totals-label">Discount</div>
              <div>
                <input 
                  type="number" 
                  name="discount"
                  value={formData.discount}
                  onChange={handleInputChange}
                  className="totals-input" 
                  placeholder="0" 
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="totals-divider"></div>

              <div className="totals-label">Total</div>
              <div className="totals-value" style={{ color: 'var(--accent-color)' }}>PKR {invoiceTotal.toFixed(2)}</div>

              <div className="totals-label" style={{ color: '#10b981' }}>Paid Amount</div>
              <div className="totals-value" style={{ color: '#10b981' }}>PKR {totalPaid.toFixed(2)}</div>
              
              <div className="totals-label" style={{ color: '#ef4444' }}>Balance Due</div>
              <div className="totals-value" style={{ color: '#ef4444' }}>PKR {remainingBalance.toFixed(2)}</div>

              <div className="agent-commission">
                <label>
                  <input type="radio" style={{ margin: 0, accentColor: 'var(--accent-color)' }} checked readOnly />
                  {formData.agent_id ? 'Agent Commission' : 'Agent Commission (Select Agent)'}
                  {formData.agent_id && agents.find(a => String(a.id) === String(formData.agent_id)) && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                      ({agents.find(a => String(a.id) === String(formData.agent_id)).commission_percentage || 0}%)
                    </span>
                  )}
                </label>
                <div style={{ fontWeight: '800', color: 'var(--accent-color)' }}>PKR {calculateCommission().toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="bottom-actions print-hide">
            <button type="button" className="btn-cancel-text" onClick={() => navigate('/invoices')}>Cancel</button>
            <button type="submit" className="btn-purple" style={{ padding: '0.75rem 2rem' }}>Save Update</button>
          </div>

        </form>
        )}

        {activeTab === 'payments' && (
          <div className="payments-tab-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ flex: 1, backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Invoice Total</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a' }}>PKR {invoiceTotal.toFixed(2)}</div>
              </div>
              <div style={{ flex: 1, backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Paid</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#10b981' }}>PKR {totalPaid.toFixed(2)}</div>
              </div>
              <div style={{ flex: 1, backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Remaining Balance</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#ef4444' }}>PKR {remainingBalance.toFixed(2)}</div>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.25rem 0', textTransform: 'uppercase' }}>Transaction History</h2>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, fontWeight: '600', textTransform: 'uppercase' }}>All payment logs recorded for this invoice</p>
                </div>
                <button type="button" className="btn-purple" onClick={() => setShowPaymentModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '8px' }}>
                  <Plus size={16} /> Record Payment
                </button>
              </div>

              {payments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                  <div style={{ width: '64px', height: '64px', backgroundColor: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>No Payments Recorded</h3>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', margin: 0 }}>Click the record button to log a payment.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <tr>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Payment #</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Payment Mode</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>{p.transaction_id || `PAY-${p.id}`}</td>
                        <td style={{ padding: '1rem', color: '#0f172a', fontSize: '0.9rem', fontWeight: '600' }}>{p.payment_method}</td>
                        <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem', fontWeight: '600' }}>{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td style={{ padding: '1rem', color: '#10b981', fontSize: '0.9rem', fontWeight: '800', textAlign: 'right' }}>PKR {parseFloat(p.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {showPaymentModal && (
        <div className="reports-modal-overlay">
          <div className="reports-modal-content" style={{ maxWidth: '800px', backgroundColor: '#fff', padding: '2rem' }}>
            <div className="modal-header" style={{ marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Record Payment for {formData.invoice_number}</h2>
              <button className="btn-close" onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>

            <form onSubmit={handlePaymentSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>* Amount Received</label>
                  <input 
                    type="number" 
                    value={paymentForm.amount} 
                    onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} 
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required 
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', color: '#64748b' }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Transaction ID</label>
                  <input 
                    type="text" 
                    value={paymentForm.transaction_id} 
                    onChange={e => setPaymentForm({...paymentForm, transaction_id: e.target.value})} 
                    placeholder="TXN-XXXXXX"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', color: '#64748b' }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>* Payment Date</label>
                  <input 
                    type="date" 
                    value={paymentForm.payment_date} 
                    onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})} 
                    required 
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}
                  />
                </div>
                <div className="form-group" style={{ gridRow: 'span 2' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Leave a Note</label>
                  <textarea 
                    value={paymentForm.notes} 
                    onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} 
                    placeholder="Admin Note"
                    style={{ width: '100%', height: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', color: '#64748b', minHeight: '120px', resize: 'none' }}
                  ></textarea>
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>* Payment Mode</label>
                  <select 
                    value={paymentForm.payment_method} 
                    onChange={e => setPaymentForm({...paymentForm, payment_method: e.target.value})} 
                    required
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {paymentForm.payment_method === 'Bank Transfer' && (
                  <div className="form-group">
                    <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>* Select Bank</label>
                    <select 
                      value={paymentForm.bank} 
                      onChange={e => setPaymentForm({...paymentForm, bank: e.target.value})} 
                      required
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}
                    >
                      <option value="">- Choose a Bank -</option>
                      {banks.map(b => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', marginBottom: '1rem' }}>Payments Received</h3>
                <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                      <tr>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Payment #</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Payment Mode</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Bank</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Date</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic', fontWeight: '600', fontSize: '0.9rem' }}>No payments recorded yet.</td>
                        </tr>
                      ) : (
                        payments.map((pay, i) => (
                          <tr key={pay.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#334155', fontWeight: '600' }}>{pay.id}</td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#64748b' }}>{pay.payment_method}</td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#64748b' }}>{pay.payment_method === 'Bank Transfer' ? (pay.bank || 'Not Specified') : '-'}</td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#64748b' }}>{new Date(pay.payment_date).toLocaleDateString()}</td>
                            <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontSize: '0.85rem', fontWeight: '800' }}>PKR {parseFloat(pay.amount).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowPaymentModal(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#34d399', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* PRINT-ONLY INVOICE TEMPLATE */}
      <div className="print-only-layout">
        {(() => {
          const selectedClient = clients.find(c => String(c.id) === String(formData.client_id)) || {};
          let invoiceStatus = 'UNPAID';
          if (totalPaid >= invoiceTotal && invoiceTotal > 0) invoiceStatus = 'PAID';
          else if (formData.due_date && new Date(formData.due_date) < new Date() && totalPaid < invoiceTotal) invoiceStatus = 'OVERDUE';

          return (
            <div className={`invoice-document ${invoiceStatus === 'PAID' ? 'is-paid' : 'is-unpaid'}`} id="printable-invoice" style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
              
              <div className="invoice-stamp">
                {invoiceStatus}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <img src="/Adwise-Labs-Primary-Logo.png" alt="Adwise Labs Logo" style={{ maxWidth: '220px', height: 'auto', display: 'block' }} />
                  </div>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Invoice {formData.invoice_number}</h2>
                  
                  <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Invoice To,</div>
                    <div>{selectedClient.full_name || 'Select Client'}</div>
                    {selectedClient.business_name && <div>{selectedClient.business_name}</div>}
                    {selectedClient.physical_address && <div style={{ maxWidth: '250px' }}>{selectedClient.physical_address}</div>}
                    <div>{selectedClient.email || ''}</div>
                  </div>
                </div>
                
                <div style={{ flex: 1, textAlign: 'right', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Date: {formData.issue_date ? new Date(formData.issue_date).toLocaleDateString() : ''}</div>
                  <div style={{ letterSpacing: '2px', marginBottom: '1rem' }}>******************************</div>
                  
                  <div style={{ fontWeight: 'bold' }}>Account Title: Adwise labs</div>
                  <div style={{ fontWeight: 'bold' }}>Bank Al Falah</div>
                  <div style={{ fontWeight: 'bold' }}>Account Number: 56395002519988</div>
                  <div style={{ fontWeight: 'bold' }}>info@adwiselabs.com</div>
                  <div style={{ fontWeight: 'bold' }}>www.adwiselabs.com</div>
                </div>
              </div>

              <table className="invoice-table" style={{ border: '1px solid #000', marginBottom: '2rem', width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'left', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Description</th>
                    <th style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'center', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Qty</th>
                    <th style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'center', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Rate</th>
                    <th style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', backgroundColor: 'transparent', color: '#000', fontWeight: 'bold' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem' }}>
                        <div>{item.description}</div>
                        {item.details && <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{item.details}</div>}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'center' }}>{item.quantity} {item.unit}</td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'center' }}>PKR {Number(item.unit_price).toFixed(2)}</td>
                      <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right' }}>PKR {(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>Sub Total</td>
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {calculateTotal().toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>Total Paid</td>
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {totalPaid.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>Total Amount Receivable</td>
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {remainingBalance.toFixed(2)}</td>
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
              {termsAndConditions && (
                <div className="terms-page-break">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
                    <img src="/Adwise-Labs-Primary-Logo.png" alt="Adwise Labs Logo" style={{ maxWidth: '180px', height: 'auto' }} />
                    <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Terms & Conditions</h2>
                  </div>
                  
                  <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {termsAndConditions}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
