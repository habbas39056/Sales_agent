import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, User } from 'lucide-react';
import axios from 'axios';
import './Header.css';

export default function Header() {
  const location = useLocation();

  let title = '';
  let subtitle = '';

  if (location.pathname === '/expenses') {
    title = 'Expense';
    subtitle = 'Manage your project dashboard and performance';
  } else if (location.pathname === '/dashboard') {
    title = 'Dashboard';
    subtitle = 'Welcome back, here is your overview';
  } else if (location.pathname === '/clients') {
    title = 'Client Management';
    subtitle = "Manage your agency's clients";
  } else if (location.pathname === '/team') {
    title = 'Team Management';
    subtitle = "Manage your agency's internal team";
  } else if (location.pathname === '/invoices') {
    title = 'Invoice Management';
    subtitle = 'Track and manage all invoices';
  } else if (location.pathname === '/projects') {
    title = 'Project Management';
    subtitle = 'Track all active projects';
  }

  return (
    <header className="top-header">
      <div className="header-left">
        {title && (
          <div className="header-titles">
            <h1 style={{ margin: '0 0 0.2rem 0', fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>{title}</h1>
            {subtitle && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{subtitle}</p>}
          </div>
        )}
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div className="header-search">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Search everything..." />
        </div>
        
        <div className="header-actions">
          {location.pathname === '/expenses' && (
            <button className="btn-danger" style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }} onClick={async () => {
              if(window.confirm("Are you sure you want to wipe all expense data? This cannot be undone.")) {
                try {
                  await axios.delete('/api/expenses/wipe');
                  window.location.reload();
                } catch(e) {
                  alert('Failed to wipe data');
                }
              }
            }}>Wipe Data</button>
          )}

          <button className="header-icon-btn">
            <Bell size={20} />
            <span className="notification-dot"></span>
          </button>
          
          <div className="user-profile">
            <div className="avatar" style={{ fontWeight: 'bold' }}>
              A
            </div>
            <div className="user-info">
              <span className="user-name">Admin User</span>
              <span className="user-role">Administrator</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
