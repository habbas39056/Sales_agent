import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Plus, Settings, Check, BookmarkPlus, Trash2, Edit2, X } from 'lucide-react';
import './TermsTemplateSelector.css';

export default function TermsTemplateSelector({ 
  value = '', 
  onChange, 
  name = 'terms_and_conditions',
  placeholder = 'Specify terms and conditions for this invoice...',
  label = 'Terms & Conditions (Specific to this Invoice)'
}) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isCreatingNewInManage, setIsCreatingNewInManage] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');

  // Form fields for saving/creating
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Editing
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('/api/terms-templates');
      setTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to fetch terms templates:', err);
    }
  };

  // Distinct list of categories for auto-suggestions
  const existingCategories = Array.from(new Set(
    ['Social Media', 'Development', 'Marketing', 'Design', 'Video Production', 'General', ...templates.map(t => t.category).filter(Boolean)]
  ));

  const customTemplates = templates.filter(t => !t.is_default || t.is_default === 0 || t.is_default === '0' || t.is_default === false);
  const presetTemplates = templates.filter(t => t.is_default === 1 || t.is_default === '1' || t.is_default === true);

  const applyTemplate = (templateContent, templateId) => {
    setSelectedTemplateId(templateId || '');
    if (!value || value.trim() === '') {
      onChange({ target: { name, value: templateContent } });
      return;
    }

    if (window.confirm('Would you like to REPLACE your existing terms with this template?\n\n(Click Cancel if you want to APPEND instead)')) {
      onChange({ target: { name, value: templateContent } });
    } else {
      const combined = `${value.trim()}\n\n${templateContent.trim()}`;
      onChange({ target: { name, value: combined } });
    }
  };

  const handleDropdownChange = (e) => {
    const tId = e.target.value;
    setSelectedTemplateId(tId);
    if (!tId) return;
    const found = templates.find(t => String(t.id) === String(tId));
    if (found) {
      applyTemplate(found.content, found.id);
    }
  };

  const handleOpenSaveModal = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setNewTemplateContent(value || '');
    setNewTemplateTitle('');
    setNewTemplateCategory('');
    setIsSaveModalOpen(true);
  };

  const handleSaveAsTemplate = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!newTemplateTitle || !newTemplateTitle.trim()) {
      alert('Please enter a Template Title.');
      return;
    }

    const contentToSave = (newTemplateContent !== undefined && newTemplateContent !== null && newTemplateContent !== '')
      ? newTemplateContent.trim()
      : (value ? value.trim() : '');

    if (!contentToSave) {
      alert('Template content cannot be empty. Please write your terms content.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await axios.post('/api/terms-templates', {
        title: newTemplateTitle.trim(),
        category: newTemplateCategory.trim() || 'General',
        content: contentToSave
      });

      const created = res.data.template;
      setIsSaveModalOpen(false);
      setIsCreatingNewInManage(false);
      setNewTemplateTitle('');
      setNewTemplateCategory('');
      setNewTemplateContent('');

      // Refresh templates list from backend
      const freshRes = await axios.get('/api/terms-templates');
      setTemplates(freshRes.data || []);

      // Automatically apply the new template
      if (created && created.id) {
        setSelectedTemplateId(String(created.id));
        onChange({ target: { name, value: contentToSave } });
      }

      setSaveSuccessMsg(`Template "${newTemplateTitle.trim()}" saved and selected!`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to save template:', err);
      alert(err.response?.data?.error || 'Failed to save template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTemplate = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!editingTemplate || !editTitle.trim() || !editContent.trim()) {
      alert('Title and Content are required.');
      return;
    }

    setIsSaving(true);
    try {
      await axios.put(`/api/terms-templates/${editingTemplate.id}`, {
        title: editTitle.trim(),
        category: editCategory.trim() || 'General',
        content: editContent.trim()
      });
      setEditingTemplate(null);
      const freshRes = await axios.get('/api/terms-templates');
      setTemplates(freshRes.data || []);
      setSaveSuccessMsg('Template updated successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to update template:', err);
      alert(err.response?.data?.error || 'Failed to update template.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await axios.delete(`/api/terms-templates/${id}`);
      const freshRes = await axios.get('/api/terms-templates');
      setTemplates(freshRes.data || []);
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Failed to delete template.');
    }
  };

  const filteredTemplates = filterCategory === 'All' 
    ? templates 
    : templates.filter(t => t.category === filterCategory);

  return (
    <div className="terms-template-selector-container">
      {saveSuccessMsg && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Check size={16} /> {saveSuccessMsg}
        </div>
      )}

      <div className="terms-header-row">
        <label className="terms-main-label">
          <FileText size={16} className="terms-label-icon" />
          {label}
        </label>
        
        <div className="terms-header-actions">
          {/* GROUPED DROPDOWN */}
          <div className="terms-dropdown-wrapper">
            <select 
              value={selectedTemplateId} 
              onChange={handleDropdownChange}
              className="terms-dropdown-select"
            >
              <option value="">⚡ Select a Preset Template...</option>
              {customTemplates.length > 0 && (
                <optgroup label="✨ My Custom Templates">
                  {customTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      ★ {t.title} ({t.category || 'General'})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="📦 Standard Presets">
                {presetTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.category || 'General'})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button 
            type="button" 
            className="terms-btn-action" 
            onClick={handleOpenSaveModal}
            title="Save current terms or write a new reusable template"
          >
            <BookmarkPlus size={14} />
            <span>Save As Template</span>
          </button>

          <button 
            type="button" 
            className="terms-btn-action" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsManageModalOpen(true);
              setIsCreatingNewInManage(false);
              setEditingTemplate(null);
            }}
            title="Manage and create templates & categories"
          >
            <Settings size={14} />
            <span>Manage Templates</span>
          </button>
        </div>
      </div>

      {/* TEXTAREA */}
      <textarea 
        name={name}
        value={value}
        onChange={onChange}
        rows="5"
        placeholder={placeholder}
        className="terms-main-textarea"
      />

      {/* DATALIST FOR CATEGORIES */}
      <datalist id="terms-category-options">
        {existingCategories.map(cat => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      {/* SAVE AS TEMPLATE MODAL */}
      {isSaveModalOpen && (
        <div className="terms-modal-overlay" onClick={() => setIsSaveModalOpen(false)}>
          <div className="terms-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="terms-modal-header">
              <h3>Save Terms & Conditions Template</h3>
              <button type="button" className="terms-modal-close" onClick={() => setIsSaveModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#1e293b' }}>
                    Template Title *
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Social Media Retainer (VIP)" 
                    value={newTemplateTitle}
                    onChange={e => setNewTemplateTitle(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#1e293b' }}>
                    Category (Choose or Type New)
                  </label>
                  <input 
                    type="text" 
                    list="terms-category-options"
                    placeholder="e.g. Social Media, Performance Marketing"
                    value={newTemplateCategory}
                    onChange={e => setNewTemplateCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem', color: '#1e293b' }}>
                  Terms & Conditions Content *
                </label>
                <textarea 
                  placeholder="1. Clause one...\n2. Clause two..."
                  value={newTemplateContent}
                  onChange={e => setNewTemplateContent(e.target.value)}
                  rows="7"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontFamily: 'inherit', color: '#334155', resize: 'vertical', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div className="terms-modal-actions">
                <button type="button" onClick={() => setIsSaveModalOpen(false)} className="terms-btn-cancel">
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveAsTemplate} 
                  disabled={isSaving}
                  className="terms-btn-submit"
                >
                  {isSaving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE TEMPLATES MODAL */}
      {isManageModalOpen && (
        <div className="terms-modal-overlay" onClick={() => { setIsManageModalOpen(false); setEditingTemplate(null); setIsCreatingNewInManage(false); }}>
          <div className="terms-modal-card wide" onClick={e => e.stopPropagation()}>
            <div className="terms-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>Manage Terms & Conditions Templates</h3>
                {!isCreatingNewInManage && !editingTemplate && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsCreatingNewInManage(true);
                      setNewTemplateTitle('');
                      setNewTemplateCategory('');
                      setNewTemplateContent('');
                    }}
                    style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> Add New Template
                  </button>
                )}
              </div>
              <button type="button" className="terms-modal-close" onClick={() => { setIsManageModalOpen(false); setEditingTemplate(null); setIsCreatingNewInManage(false); }}>
                <X size={18} />
              </button>
            </div>

            {/* CREATE NEW TEMPLATE FORM */}
            {isCreatingNewInManage ? (
              <div style={{ marginTop: '0.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#4f46e5' }}>Create New Template</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>Template Title *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Influencer Marketing Retainer"
                      value={newTemplateTitle}
                      onChange={e => setNewTemplateTitle(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                      autoFocus
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>Category (Choose or Type New)</label>
                    <input 
                      type="text" 
                      list="terms-category-options"
                      placeholder="e.g. Influencer Marketing"
                      value={newTemplateCategory}
                      onChange={e => setNewTemplateCategory(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>Terms & Conditions Content *</label>
                  <textarea 
                    placeholder="1. Clause one...\n2. Clause two...\n3. Clause three..."
                    value={newTemplateContent}
                    onChange={e => setNewTemplateContent(e.target.value)}
                    rows="8"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div className="terms-modal-actions">
                  <button type="button" onClick={() => setIsCreatingNewInManage(false)} className="terms-btn-cancel">Back to List</button>
                  <button 
                    type="button" 
                    onClick={handleSaveAsTemplate} 
                    disabled={isSaving}
                    className="terms-btn-submit"
                  >
                    {isSaving ? 'Creating...' : 'Create Template'}
                  </button>
                </div>
              </div>
            ) : editingTemplate ? (
              /* EDIT TEMPLATE FORM */
              <div style={{ marginTop: '0.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#4f46e5' }}>Editing: {editingTemplate.title}</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>Template Title *</label>
                    <input 
                      type="text" 
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>Category (Choose or Type New)</label>
                    <input 
                      type="text" 
                      list="terms-category-options"
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>Content *</label>
                  <textarea 
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows="8"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div className="terms-modal-actions">
                  <button type="button" onClick={() => setEditingTemplate(null)} className="terms-btn-cancel">Back</button>
                  <button 
                    type="button" 
                    onClick={handleUpdateTemplate} 
                    disabled={isSaving}
                    className="terms-btn-submit"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              /* TEMPLATES LIST */
              <div>
                <div className="terms-manage-list">
                  {templates.map(t => (
                    <div key={t.id} className="terms-manage-item">
                      <div className="terms-manage-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <strong>{t.title}</strong>
                          <span className="terms-category-pill">{t.category || 'General'}</span>
                          {t.is_default ? (
                            <span className="terms-default-pill">Preset</span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '6px', fontWeight: '700' }}>Custom</span>
                          )}
                        </div>
                        <p className="terms-manage-preview">{t.content}</p>
                      </div>
                      <div className="terms-manage-actions">
                        <button 
                          type="button" 
                          className="terms-btn-icon" 
                          title="Edit Template"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingTemplate(t);
                            setEditTitle(t.title);
                            setEditCategory(t.category || 'General');
                            setEditContent(t.content);
                          }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          type="button" 
                          className="terms-btn-icon delete" 
                          title="Delete Template"
                          onClick={(e) => handleDeleteTemplate(t.id, e)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {templates.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      No templates found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
