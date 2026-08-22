import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Printer, Edit } from 'lucide-react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import TermsTemplateSelector from '../components/TermsTemplateSelector';
import './QuotationsList.css'; // Reuse existing styles

export default function CreateQuotation() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [products, setProducts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [banks, setBanks] = useState([]);
  const [isEditingInvNum, setIsEditingInvNum] = useState(false);
  const [isEditingBillFrom, setIsEditingBillFrom] = useState(false);
  const [isManualClient, setIsManualClient] = useState(false);
  const [activeTab, setActiveTab] = useState('quotation');
        
  const [formData, setFormData] = useState({
    quotation_number: `QT-${Date.now()}`,
    client_id: '',
    manual_client_name: '',
    manual_client_business: '',
    manual_client_email: '',
    manual_client_phone: '',
    manual_client_address: '',
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

  useEffect(() => {
    fetchDropdowns();
  }, [id]);

  const fetchDropdowns = async () => {
    try {

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
        const invRes = await axios.get(`/api/quotations/${id}`);
        const inv = invRes.data;
        if (inv.manual_client_name && !inv.client_id) {
          setIsManualClient(true);
        }
        setFormData({
          quotation_number: inv.quotation_number,
          client_id: inv.client_id || '',
          manual_client_name: inv.manual_client_name || '',
          manual_client_business: inv.manual_client_business || inv.business_name || '',
          manual_client_email: inv.manual_client_email || inv.client_email || '',
          manual_client_phone: inv.manual_client_phone || '',
          manual_client_address: inv.manual_client_address || inv.physical_address || '',
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
            category: item.category || 'SERVICE',
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

  const fetchData = fetchDropdowns;

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

  
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_id && !formData.manual_client_name) {
      alert("Please select an existing client or enter a client name manually.");
      return;
    }
    if (formData.items.length === 0) {
      alert("Please add at least one line item.");
      return;
    }
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const dataToSend = {
      ...formData,
      created_by: user ? user.id : null
    };
    try {
      if (id) {
        await axios.put(`/api/quotations/${id}`, dataToSend);
      } else {
        await axios.post('/api/quotations', dataToSend);
      }
      navigate('/quotations');
    } catch (error) {
      console.error('Failed to save quotation:', error);
      alert(error.response?.data?.error || 'Error saving quotation.');
    }
  };

  
  
      
  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '2rem' }}>
      <div className="quotation-editor-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* TOP TABS */}
        <div className="quotation-editor-tabs print-hide">
          <div 
            className={`quotation-editor-tab ${activeTab === 'quotation' ? 'active' : ''}`}
            onClick={() => setActiveTab('quotation')}
            style={{ cursor: 'pointer' }}
          >
            Quotation
          </div>
          
        </div>

        {activeTab === 'quotation' && (
          <form onSubmit={handleSubmit}>
          {/* HEADER ACTIONS */}
          <div className="quotation-editor-header">
            {id && (
              <span className={`quotation-badge-${formData.status ? formData.status.toLowerCase() : 'draft'}`}>{formData.status || 'DRAFT'}</span>
            )}
            <div className="quotation-editor-actions print-hide">
              <button type="button" className="btn-icon-outline" onClick={() => window.print()}>
                <Printer size={16} />
              </button>
              <button type="button" className="btn-purple" style={{ padding: '0.5rem' }} onClick={() => setIsEditingInvNum(!isEditingInvNum)} title="Edit Quotation Number">
                <Edit size={16} />
              </button>

            </div>
          </div>

          {isEditingInvNum ? (
            <input 
              type="text"
              name="quotation_number"
              value={formData.quotation_number}
              onChange={handleInputChange}
              className="quotation-editor-title"
              style={{ background: 'transparent', border: '1px dashed #cbd5e1', width: 'auto', outline: 'none' }}
              autoFocus
              onBlur={() => setIsEditingInvNum(false)}
            />
          ) : (
            <h1 className="quotation-editor-title">{formData.quotation_number}</h1>
          )}

          {/* BILLING GRID */}
          <div className="quotation-editor-grid">
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', paddingRight: '0.5rem' }}>
                <div className="bill-to-label" style={{ margin: 0 }}>BILL TO</div>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsManualClient(!isManualClient);
                    if (!isManualClient) {
                      setFormData(prev => ({ ...prev, client_id: '' }));
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-color, #4f46e5)',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  {isManualClient ? '🔍 Search Existing Clients' : '✍️ Write Client Manually'}
                </button>
              </div>
              
              {!isManualClient ? (
                <div className="bill-to-row" style={{ minWidth: '300px', flexDirection: 'column', alignItems: 'stretch' }}>
                  <CreatableSelect
                    options={(clients || []).map(c => ({ value: c.id, label: `${c.full_name} (${c.business_name || 'Individual'})`, client: c }))}
                    value={(() => {
                      if (formData.client_id) {
                        const found = (clients || []).find(c => String(c.id) === String(formData.client_id));
                        return found ? { value: found.id, label: `${found.full_name} (${found.business_name || 'Individual'})` } : null;
                      }
                      if (formData.manual_client_name) {
                        return { value: 'custom', label: `✍️ ${formData.manual_client_name}` };
                      }
                      return null;
                    })()}
                    onChange={(selectedOption) => {
                      if (!selectedOption) {
                        setFormData(prev => ({ 
                          ...prev, 
                          client_id: '', 
                          manual_client_name: '',
                          manual_client_business: '',
                          manual_client_email: '',
                          manual_client_address: '' 
                        }));
                      } else if (selectedOption.__isNew__ || selectedOption.value === 'custom') {
                        setFormData(prev => ({ 
                          ...prev, 
                          client_id: '', 
                          manual_client_name: selectedOption.label.replace(/^✍️\s*/, ''),
                          manual_client_business: '',
                          manual_client_email: '',
                          manual_client_address: '' 
                        }));
                      } else {
                        const c = selectedOption.client || (clients || []).find(cli => String(cli.id) === String(selectedOption.value));
                        setFormData(prev => ({ 
                          ...prev, 
                          client_id: selectedOption.value, 
                          manual_client_name: c ? c.full_name : '',
                          manual_client_business: c ? c.business_name || '' : '',
                          manual_client_email: c ? c.email || '' : '',
                          manual_client_address: c ? c.physical_address || '' : ''
                        }));
                      }
                    }}
                    onCreateOption={(inputValue) => {
                      setFormData(prev => ({
                        ...prev,
                        client_id: '',
                        manual_client_name: inputValue
                      }));
                    }}
                    placeholder="Search or type client name..."
                    formatCreateLabel={(inputValue) => `✍️ Use "${inputValue}" as custom client`}
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

                  {/* If custom client name typed, allow adding optional details */}
                  {!formData.client_id && formData.manual_client_name && (
                    <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', background: '#f8fafc', padding: '0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>Manual Client Details:</span>
                      <input 
                        type="text" 
                        placeholder="Business / Company (Optional)" 
                        value={formData.manual_client_business || ''} 
                        onChange={e => setFormData({ ...formData, manual_client_business: e.target.value })}
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      />
                      <input 
                        type="email" 
                        placeholder="Client Email (Optional)" 
                        value={formData.manual_client_email || ''} 
                        onChange={e => setFormData({ ...formData, manual_client_email: e.target.value })}
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Address / Location (Optional)" 
                        value={formData.manual_client_address || ''} 
                        onChange={e => setFormData({ ...formData, manual_client_address: e.target.value })}
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="bill-to-row" style={{ minWidth: '300px', flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <input 
                      type="text" 
                      name="manual_client_name"
                      placeholder="Client Name / Contact Person *" 
                      value={formData.manual_client_name || ''} 
                      onChange={e => setFormData({ ...formData, manual_client_name: e.target.value })}
                      required
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem', fontWeight: '700', border: '1px solid #94a3b8', borderRadius: '6px' }}
                    />
                    <input 
                      type="text" 
                      name="manual_client_business"
                      placeholder="Business / Company Name (Optional)" 
                      value={formData.manual_client_business || ''} 
                      onChange={e => setFormData({ ...formData, manual_client_business: e.target.value })}
                      style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                    <input 
                      type="email" 
                      name="manual_client_email"
                      placeholder="Email Address (Optional)" 
                      value={formData.manual_client_email || ''} 
                      onChange={e => setFormData({ ...formData, manual_client_email: e.target.value })}
                      style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                    <input 
                      type="text" 
                      name="manual_client_phone"
                      placeholder="Phone / WhatsApp Number (Optional)" 
                      value={formData.manual_client_phone || ''} 
                      onChange={e => setFormData({ ...formData, manual_client_phone: e.target.value })}
                      style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                    <textarea 
                      name="manual_client_address"
                      placeholder="Physical Address (Optional)" 
                      value={formData.manual_client_address || ''} 
                      onChange={e => setFormData({ ...formData, manual_client_address: e.target.value })}
                      rows={2}
                      style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}

              <div className="bill-to-row">
                <label>Quotation Date:</label>
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
                <label>Expiry Date:</label>
                <input 
                  type="date" 
                  name="expiry_date" 
                  value={formData.expiry_date || ''} 
                  onChange={handleInputChange} 
                  required 
                  className="bill-to-input"
                />
              </div>
            </div>
          </div>

          {/* TABLE */}
          <table className="quotation-table-modern">
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
              <div className="totals-label">Total</div>
              <div className="totals-value" style={{ color: 'var(--accent-color)' }}>PKR {calculateSubTotal().toFixed(2)}</div>
            </div>
          </div>

          {/* TERMS & CONDITIONS FOR THIS SPECIFIC QUOTATION */}
          <TermsTemplateSelector 
            name="terms_and_conditions"
            value={formData.terms_and_conditions || ''}
            onChange={handleInputChange}
            label="Terms & Conditions (Specific to this Quotation)"
            placeholder="Enter or select terms and conditions for this quotation..."
          />

          <div className="bottom-actions print-hide">
            <button type="button" className="btn-cancel-text" onClick={() => navigate('/quotations')}>Cancel</button>
            <button type="submit" className="btn-purple" style={{ padding: '0.75rem 2rem' }}>Save Quotation</button>
          </div>

        </form>
        )}

      {/* PRINT-ONLY QUOTATION TEMPLATE */}
      <div className="print-only-layout">
        {(() => {
          const selectedClient = clients.find(c => String(c.id) === String(formData.client_id)) || {};
          const clientName = selectedClient.full_name || formData.manual_client_name || 'Select or Enter Client';
          const businessName = selectedClient.business_name || formData.manual_client_business || '';
          const address = selectedClient.physical_address || formData.manual_client_address || '';
          const email = selectedClient.email || formData.manual_client_email || '';
          const phone = selectedClient.whatsapp_number || selectedClient.phone || formData.manual_client_phone || '';

          return (
            <div className={`quotation-document is-unpaid`} id="printable-quotation" style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
              
              <div className="quotation-stamp">
                QUOTATION
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <img src="/Adwise-Labs-Primary-Logo.png" alt="Adwise Labs Logo" style={{ maxWidth: '220px', height: 'auto', display: 'block' }} />
                  </div>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Quotation {formData.quotation_number}</h2>
                  
                  <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Quotation To,</div>
                    <div>{clientName}</div>
                    {businessName && <div>{businessName}</div>}
                    {address && <div style={{ maxWidth: '250px' }}>{address}</div>}
                    {email && <div>{email}</div>}
                    {phone && <div>{phone}</div>}
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

              <table className="quotation-table" style={{ border: '1px solid #000', marginBottom: '2rem', width: '100%', borderCollapse: 'collapse' }}>
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
                    <td style={{ border: '1px solid #000', padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 'bold' }}>PKR {calculateSubTotal().toFixed(2)}</td>
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
              {formData.terms_and_conditions && (
                <div className="terms-page-break">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
                    <img src="/Adwise-Labs-Primary-Logo.png" alt="Adwise Labs Logo" style={{ maxWidth: '180px', height: 'auto' }} />
                    <h2 style={{ fontSize: '1.3rem', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Terms & Conditions</h2>
                  </div>
                  
                  <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                    {formData.terms_and_conditions}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
    </div>
  );
}
