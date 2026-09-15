import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Edit, Trash2, Download, Upload, X, Package, Layers, Tag, DollarSign } from 'lucide-react';
import './ItemsList.css';

export default function ItemsList() {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_price: '',
    unit: '',
    group_name: '',
    tax_rate: '0.00'
  });

  const [importJson, setImportJson] = useState('');

  useEffect(() => {
    fetchItems();
    fetchGroups();
  }, [selectedGroup]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/products', {
        params: { search, group_name: selectedGroup }
      });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await axios.get('/api/products/groups');
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchItems();
  };

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      default_price: '',
      unit: '',
      group_name: selectedGroup !== 'All' ? selectedGroup : '',
      tax_rate: '0.00'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      default_price: item.default_price || '',
      unit: item.unit || '',
      group_name: item.group_name || '',
      tax_rate: item.tax_rate !== undefined ? String(item.tax_rate) : '0.00'
    });
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Item description/name is required.');
      return;
    }
    if (formData.default_price === '' || isNaN(parseFloat(formData.default_price))) {
      alert('Please enter a valid rate/price.');
      return;
    }

    try {
      if (editingItem) {
        await axios.put(`/api/products/${editingItem.id}`, formData);
      } else {
        await axios.post('/api/products', formData);
      }
      setIsModalOpen(false);
      fetchItems();
      fetchGroups();
    } catch (err) {
      console.error('Error saving item:', err);
      alert(err.response?.data?.error || 'Failed to save item template');
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete item "${name}"?`)) return;
    try {
      await axios.delete(`/api/products/${id}`);
      fetchItems();
      fetchGroups();
    } catch (err) {
      console.error('Error deleting item:', err);
      alert(err.response?.data?.error || 'Failed to delete item');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItemIds(items.map(i => i.id));
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleToggleSelectItem = (id) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedItemIds.length} selected items?`)) return;
    try {
      for (const id of selectedItemIds) {
        await axios.delete(`/api/products/${id}`);
      }
      setSelectedItemIds([]);
      fetchItems();
      fetchGroups();
    } catch (err) {
      alert('Failed to delete selected items.');
    }
  };

  const handleExportCSV = () => {
    if (items.length === 0) return alert('No items to export.');
    const headers = ['Description', 'Long Description', 'Rate', 'Unit', 'Tax %', 'Group Name'];
    const rows = items.map(i => [
      `"${(i.name || '').replace(/"/g, '""')}"`,
      `"${(i.description || '').replace(/"/g, '""')}"`,
      i.default_price || 0,
      `"${i.unit || ''}"`,
      i.tax_rate || 0,
      `"${i.group_name || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Items_Inventory_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importJson.trim()) return alert('Please enter CSV or JSON items data.');
    try {
      let parsed = [];
      try {
        parsed = JSON.parse(importJson);
      } catch (err) {
        // Fallback: parse basic CSV
        const lines = importJson.split('\n').map(l => l.trim()).filter(Boolean);
        parsed = lines.map(l => {
          const parts = l.split(',');
          return {
            name: parts[0] ? parts[0].replace(/^"|"$/g, '') : '',
            description: parts[1] ? parts[1].replace(/^"|"$/g, '') : '',
            default_price: parts[2] ? parseFloat(parts[2]) || 0 : 0,
            unit: parts[3] ? parts[3].replace(/^"|"$/g, '') : '',
            group_name: parts[4] ? parts[4].replace(/^"|"$/g, '') : ''
          };
        });
      }

      await axios.post('/api/products/import', { items: parsed });
      setIsImportModalOpen(false);
      setImportJson('');
      fetchItems();
      fetchGroups();
      alert('Items imported successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to import items');
    }
  };

  return (
    <div className="items-page-container">
      {/* HEADER */}
      <div className="items-header">
        <div className="items-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1>Items Inventory</h1>
            <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', fontWeight: '800', padding: '0.25rem 0.65rem', borderRadius: '12px' }}>
              {filteredItems.length} {filteredItems.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>
          <p>Create and manage reusable item templates for Quotations & Invoices</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary-item" onClick={handleOpenCreateModal}>
            <Plus size={16} /> New Item
          </button>
          <button type="button" className="btn-secondary-item" onClick={() => setIsImportModalOpen(true)}>
            <Upload size={16} /> Import Items
          </button>
          <button type="button" className="btn-secondary-item" onClick={handleExportCSV}>
            <Download size={16} /> Export CSV
          </button>
          {selectedItemIds.length > 0 && (
            <button type="button" className="btn-secondary-item" onClick={handleBulkDelete} style={{ color: '#ef4444', borderColor: '#fca5a5' }}>
              <Trash2 size={16} /> Delete Selected ({selectedItemIds.length})
            </button>
          )}
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="items-actions-bar">
        <div className="items-action-left" style={{ flex: 1, maxWidth: '500px' }}>
          <form onSubmit={handleSearchSubmit} className="items-search-box" style={{ width: '100%' }}>
            <Search size={16} className="items-search-icon" />
            <input
              type="text"
              placeholder="Search items by name, group, or detail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        </div>

        <div className="items-action-right">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', backgroundColor: '#ffffff' }}
          >
            <option value="All">All Groups ({items.length})</option>
            {groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div className="items-table-card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading items inventory...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <Package size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>No Item Templates Found</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Create reusable item templates to quickly build professional Invoices and Quotations.</p>
            <button type="button" className="btn-primary-item" onClick={handleOpenCreateModal}>
              <Plus size={16} /> Add First Item
            </button>
          </div>
        ) : (
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedItemIds.length === items.length && items.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ width: '25%' }}>Description</th>
                <th style={{ width: '35%' }}>Long Description</th>
                <th style={{ width: '15%' }}>Rate</th>
                <th style={{ width: '10%' }}>Unit</th>
                <th style={{ width: '15%' }}>Group Name</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item.id)}
                      onChange={() => handleToggleSelectItem(item.id)}
                    />
                  </td>
                  <td>
                    <div className="item-name-cell">{item.name}</div>
                  </td>
                  <td>
                    <div className="item-desc-cell">{item.description || '—'}</div>
                  </td>
                  <td>
                    <div className="item-rate-cell">
                      Rs {Number(item.default_price || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.unit || '—'}</span>
                  </td>
                  <td>
                    {item.group_name ? (
                      <span className="item-group-badge">{item.group_name}</span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>General</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#0284c7', padding: '0.2rem' }}
                        title="Edit Item Template"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '0.2rem' }}
                        title="Delete Item Template"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="items-modal-overlay">
          <div className="items-modal">
            <div className="items-modal-header">
              <h3>{editingItem ? 'Edit Item Template' : 'New Item Template'}</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div className="items-modal-body">
                <div className="items-field-group">
                  <label>Description / Item Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Business Website Development"
                    required
                  />
                </div>

                <div className="items-field-group">
                  <label>Long Description (Scope & Details)</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    rows="3"
                    placeholder="e.g. Responsive Design, WhatsApp Integration, SEO Optimization..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="items-field-group">
                    <label>Rate / Price (PKR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      name="default_price"
                      value={formData.default_price}
                      onChange={handleFormChange}
                      placeholder="e.g. 25000.00"
                      required
                    />
                  </div>

                  <div className="items-field-group">
                    <label>Unit (e.g. Pages, Books, Nos, Hours)</label>
                    <input
                      type="text"
                      name="unit"
                      value={formData.unit}
                      onChange={handleFormChange}
                      placeholder="e.g. Pages / Books"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="items-field-group">
                    <label>Group Name (Category)</label>
                    <input
                      type="text"
                      name="group_name"
                      value={formData.group_name}
                      onChange={handleFormChange}
                      placeholder="e.g. Printing / Development / Design"
                    />
                  </div>

                  <div className="items-field-group">
                    <label>Default Tax %</label>
                    <input
                      type="number"
                      step="0.01"
                      name="tax_rate"
                      value={formData.tax_rate}
                      onChange={handleFormChange}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="items-modal-footer">
                <button
                  type="button"
                  className="btn-secondary-item"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-item"
                >
                  {editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="items-modal-overlay">
          <div className="items-modal">
            <div className="items-modal-header">
              <h3>Import Item Templates</h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleImportSubmit}>
              <div className="items-modal-body">
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                  Paste CSV lines (Format: <code>Description, Long Description, Rate, Unit, Group</code>) or JSON array of items:
                </p>
                <div className="items-field-group">
                  <textarea
                    rows="8"
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    placeholder={`"Bill Book", "200 Pages - NCR Book - 10 Books", 8500, "Books", "Printing"\n"Website Development", "Full responsive design", 25000, "Project", "Development"`}
                    style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  />
                </div>
              </div>
              <div className="items-modal-footer">
                <button
                  type="button"
                  className="btn-secondary-item"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-item"
                >
                  Import Items
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
