import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileText, Plus, ExternalLink, Calendar, Trash2, Edit, CreditCard } from 'lucide-react';
import './AddStep.css';

export default function AddStep() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [specialists, setSpecialists] = useState([]);
  const [attachments, setAttachments] = useState([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'Pending',
    assignee_id: '',
    deadline: '',
    requires_client_form: false,
    client_form_schema: [],
    requires_payment: false,
    allow_revision: false
  });

  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [savingInvoice, setSavingInvoice] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const pRes = await axios.get(`/api/projects/${id}`);
      setProject(pRes.data);
      if (pRes.data && pRes.data.invoice && pRes.data.invoice.id) {
        const invRes = await axios.get(`/api/invoices/${pRes.data.invoice.id}`);
        setInvoiceItems(invRes.data.items || []);
      }
      
      const sRes = await axios.get('/api/users/specialists');
      setSpecialists(sRes.data);
    } catch (error) {
      console.error('Failed to fetch data', error);
    }
  };

  const handleAddInvoiceItem = () => {
    setInvoiceItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const handleUpdateInvoiceItem = (index, field, value) => {
    const updated = [...invoiceItems];
    updated[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
      const qty = Number(field === 'quantity' ? value : updated[index].quantity) || 0;
      const price = Number(field === 'unit_price' ? value : updated[index].unit_price) || 0;
      updated[index].total = qty * price;
    }
    setInvoiceItems(updated);
  };

  const handleRemoveInvoiceItem = (index) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveInvoiceItems = async () => {
    if (!project.invoice || !project.invoice.id) return;
    setSavingInvoice(true);
    try {
      const invRes = await axios.get(`/api/invoices/${project.invoice.id}`);
      const inv = invRes.data;

      await axios.put(`/api/invoices/${project.invoice.id}`, {
        client_id: inv.client_id,
        project_id: inv.project_id,
        agent_id: inv.agent_id,
        commission_amount: inv.commission_amount,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        terms_and_conditions: inv.terms_and_conditions,
        items: invoiceItems
      });

      setIsEditingInvoice(false);
      fetchData();
    } catch(err) {
      console.error('Failed to save inline invoice items', err);
      alert('Failed to save items');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const addFormField = () => {
    setFormData({
      ...formData,
      client_form_schema: [...formData.client_form_schema, { label: '', type: 'Short Text' }]
    });
  };

  const updateFormField = (index, field, value) => {
    const newSchema = [...formData.client_form_schema];
    newSchema[index][field] = value;
    setFormData({ ...formData, client_form_schema: newSchema });
  };

  const removeFormField = (index) => {
    const newSchema = [...formData.client_form_schema];
    newSchema.splice(index, 1);
    setFormData({ ...formData, client_form_schema: newSchema });
  };

  const handleSave = async () => {
    if (!formData.title) return alert('Title is required');
    try {
      const fd = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'client_form_schema') {
          fd.append(key, JSON.stringify(formData[key]));
        } else {
          fd.append(key, formData[key]);
        }
      });
      attachments.forEach(file => {
        fd.append('attachments', file);
      });

      await axios.post(`/api/projects/${id}/steps`, fd, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      navigate(`/projects/${id}`);
    } catch (error) {
      console.error('Save failed', error);
      alert('Failed to save step');
    }
  };

  if (!project) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div className="add-step-container">
      <div className="add-step-header">
        <button className="btn-cancel" onClick={() => navigate(`/projects/${id}`)}>Cancel</button>
        <h2>Create Milestone</h2>
        <button className="btn-save-step" onClick={handleSave}>Save Milestone</button>
      </div>

      <div className="add-step-grid">
        <div className="as-col-left">
          
          <div className="as-card">
            <h3>BASIC DETAILS</h3>
            <div className="form-group">
              <label className="as-label">MILESTONE TITLE</label>
              <input 
                type="text" 
                name="title" 
                className="as-input" 
                placeholder="e.g. Initial Consultation" 
                value={formData.title}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label className="as-label">DESCRIPTION</label>
              <textarea 
                name="description" 
                className="as-textarea" 
                placeholder="Describe what needs to be done..."
                rows="4"
                value={formData.description}
                onChange={handleInputChange}
              ></textarea>
            </div>

            <div className="form-group" style={{marginTop: '2rem'}}>
              <label className="as-label">ATTACHMENTS (PDF, Images) - Up to 5</label>
              <div className="attachment-upload-area">
                <input 
                  type="file" 
                  multiple
                  onChange={(e) => setAttachments(prev => [...prev, ...Array.from(e.target.files)])} 
                  id="step-attachments"
                  style={{ display: 'none' }}
                />
                <label htmlFor="step-attachments" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                  <div className="plus-icon"><Plus size={24} /></div>
                  <span style={{ color: '#4f46e5', fontWeight: '700', fontSize: '0.95rem' }}>Click to select files</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>or drag and drop here</span>
                </label>
              </div>
              {attachments.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {attachments.map((file, idx) => (
                    <div key={idx} className="attachment-file-pill">
                      <FileText size={16} color="#4f46e5" />
                      <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`as-card ${!formData.requires_client_form ? 'compact-card' : ''}`}>
            <div className="card-toggle-header">
              <div className="card-title-with-icon">
                <div className="icon-box blue"><FileText size={18} /></div>
                <h3>CLIENT INFORMATION FORM</h3>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  name="requires_client_form" 
                  checked={formData.requires_client_form}
                  onChange={handleInputChange}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {formData.requires_client_form && (
              <div className="client-form-builder">
                {formData.client_form_schema.map((field, idx) => (
                  <div key={idx} className="form-builder-row">
                    <div className="fb-group">
                      <label>FIELD LABEL</label>
                      <input 
                        type="text" 
                        value={field.label} 
                        onChange={(e) => updateFormField(idx, 'label', e.target.value)}
                        placeholder="e.g. Passport Number"
                      />
                    </div>
                    <div className="fb-group">
                      <label>INPUT TYPE</label>
                      <select 
                        value={field.type} 
                        onChange={(e) => updateFormField(idx, 'type', e.target.value)}
                      >
                        <option value="Short Text">Short Text</option>
                        <option value="Long Text">Long Text</option>
                        <option value="File Upload">File Upload</option>
                        <option value="Date">Date</option>
                      </select>
                    </div>
                    <button className="btn-remove-field" onClick={() => removeFormField(idx)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button className="btn-add-question" onClick={addFormField}>
                  <Plus size={16} /> ADD QUESTION TO FORM
                </button>
              </div>
            )}
          </div>

          <div className={`as-card ${!formData.requires_payment ? 'compact-card' : ''}`}>
            <div className="card-toggle-header">
              <div className="card-title-with-icon">
                <div className="icon-box green"><FileText size={18} /></div>
                <h3>PAYMENTS & BILLING</h3>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  name="requires_payment" 
                  checked={formData.requires_payment}
                  onChange={handleInputChange}
                />
                <span className="slider round green-slider"></span>
              </label>
            </div>
            
            {formData.requires_payment && (
              <div className="payment-box" style={{ background: '#ecfdf5', padding: '1rem', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                <div style={{ textAlign: 'center', color: '#059669', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  USING PROJECT'S DEFAULT INVOICE
                </div>

                {project.invoice ? (
                  <div>
                    {/* Top card bar with Pencil & External Link icons matching reference design */}
                    <div style={{ background: 'white', border: '1px solid #d1fae5', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: '#e0e7ff', color: '#4f46e5', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.95rem', color: '#1e293b', display: 'block' }}>#{project.invoice.invoice_number}</strong>
                          <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: '600' }}>
                            Rs. {Number(project.invoice.amount).toLocaleString()} ({project.invoice.status.toLowerCase()})
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {/* Pencil Icon -> Toggle inline item editor */}
                        <button 
                          type="button"
                          title="Edit items inline"
                          style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                          onClick={() => setIsEditingInvoice(prev => !prev)}
                        >
                          <Edit size={16} />
                        </button>

                        {/* External Link Icon -> Open full invoice edit page */}
                        <button 
                          type="button"
                          title="Open whole invoice editor"
                          style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', width: '34px', height: '34px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                          onClick={() => navigate(`/invoices/edit/${project.invoice.id}`)}
                        >
                          <ExternalLink size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Inline Item Editor Drawer matching reference mockup */}
                    {isEditingInvoice && (
                      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.75rem', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '0.5rem 0.25rem' }}>#</th>
                                <th style={{ padding: '0.5rem 0.25rem' }}>Item</th>
                                <th style={{ padding: '0.5rem 0.25rem', width: '60px' }}>Qty</th>
                                <th style={{ padding: '0.5rem 0.25rem', width: '80px' }}>Rate</th>
                                <th style={{ padding: '0.5rem 0.25rem', width: '90px', textAlign: 'right' }}>Amount</th>
                                <th style={{ padding: '0.5rem 0.25rem', width: '30px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoiceItems.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '0.5rem 0.25rem', fontWeight: 'bold', color: '#64748b' }}>{idx + 1}</td>
                                  <td style={{ padding: '0.5rem 0.25rem' }}>
                                    <input 
                                      type="text" 
                                      value={item.description}
                                      onChange={(e) => handleUpdateInvoiceItem(idx, 'description', e.target.value)}
                                      placeholder="Item description"
                                      style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.82rem' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.5rem 0.25rem' }}>
                                    <input 
                                      type="number" 
                                      value={item.quantity}
                                      onChange={(e) => handleUpdateInvoiceItem(idx, 'quantity', e.target.value)}
                                      style={{ width: '100%', padding: '0.35rem 0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.82rem', textAlign: 'center' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.5rem 0.25rem' }}>
                                    <input 
                                      type="number" 
                                      value={item.unit_price}
                                      onChange={(e) => handleUpdateInvoiceItem(idx, 'unit_price', e.target.value)}
                                      style={{ width: '100%', padding: '0.35rem 0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.82rem', textAlign: 'right' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: '700', color: '#1e293b' }}>
                                    {(Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString()}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                    <button 
                                      type="button" 
                                      onClick={() => handleRemoveInvoiceItem(idx)}
                                      style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0 }}
                                      onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                                      onMouseOut={(e) => e.currentTarget.style.color = '#cbd5e1'}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Add Item Button */}
                        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                          <button 
                            type="button" 
                            onClick={handleAddInvoiceItem}
                            style={{ background: '#f8fafc', border: '1px dashed #4f46e5', color: '#4f46e5', borderRadius: '8px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', width: '100%' }}
                          >
                            + ADD ITEM
                          </button>
                        </div>

                        {/* Total & Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1e293b' }}>
                            Total: Rs. {invoiceItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0).toLocaleString()}
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              type="button" 
                              onClick={() => setIsEditingInvoice(false)}
                              style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                            <button 
                              type="button" 
                              disabled={savingInvoice}
                              onClick={handleSaveInvoiceItems}
                              style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', padding: '0.4rem 1.25rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                            >
                              {savingInvoice ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>No invoice currently linked to this project.</p>
                )}
              </div>
            )}
          </div>



        </div>

        <div className="as-col-right">
          <div className="as-card">
            <h3>WORKFLOW INFO</h3>
            <div className="form-group">
              <label className="as-label">CURRENT STATUS</label>
              <select name="status" className="as-select" value={formData.status} onChange={handleInputChange}>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="form-group">
              <label className="as-label">ASSIGN SPECIALIST</label>
              <select name="assignee_id" className="as-select" value={formData.assignee_id} onChange={handleInputChange}>
                <option value="">Unassigned</option>
                {specialists.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="as-label">DEADLINE</label>
              <div className="date-input-wrapper">
                <input 
                  type="date" 
                  name="deadline" 
                  className="as-input" 
                  value={formData.deadline}
                  onChange={handleInputChange}
                />
                <Calendar size={16} className="date-icon" />
              </div>
            </div>
          </div>

          <div className={`as-card ${!formData.allow_revision ? 'compact-card' : ''}`}>
            <div className="card-toggle-header">
              <div className="card-title-with-icon">
                <h3>CLIENT REVISION OPTION</h3>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  name="allow_revision" 
                  checked={formData.allow_revision}
                  onChange={handleInputChange}
                />
                <span className="slider round blue-slider"></span>
              </label>
            </div>
            {formData.allow_revision && (
              <p className="payment-notice" style={{marginTop: '1rem'}}>
                The client will see a "Revision Required" button on this step. Submitting it will consume one revision cycle from the project.
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
