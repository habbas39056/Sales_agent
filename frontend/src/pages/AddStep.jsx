import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FileText, Plus, ExternalLink, Calendar, Trash2 } from 'lucide-react';
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

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const pRes = await axios.get(`/api/projects/${id}`);
      setProject(pRes.data);
      
      const sRes = await axios.get('/api/users/specialists');
      setSpecialists(sRes.data);
    } catch (error) {
      console.error('Failed to fetch data', error);
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
              <div className="payment-box">
                <p className="payment-notice">
                  THE PROJECT'S DEFAULT INVOICE WILL BE AUTOMATICALLY LINKED WHEN YOU SAVE THIS MILESTONE.
                </p>
                {project.invoice ? (
                  <div className="invoice-display">
                    <div className="inv-icon"><FileText size={20} /></div>
                    <div className="inv-details">
                      <strong>{project.invoice.invoice_number}</strong>
                      <span>Rs. {project.invoice.amount} ({project.invoice.status.toLowerCase()})</span>
                    </div>
                    <button className="btn-inv-link"><ExternalLink size={18} /></button>
                  </div>
                ) : (
                  <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>No invoice currently linked to this project.</p>
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
