import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Bell, Search, User } from 'lucide-react';
import axios from 'axios';
import './Header.css';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        let url = `/api/search?q=${encodeURIComponent(searchQuery)}`;
        if (user) {
          url += `&user_id=${user.id}&role=${encodeURIComponent(user.role)}`;
        }
        const res = await axios.get(url);
        setSearchResults(res.data);
        setShowDropdown(true);
      } catch (e) {
        console.error('Search error:', e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [user, setUser] = useState(() => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  });

  useEffect(() => {
    const updateUserState = () => {
      const userStr = localStorage.getItem('user');
      setUser(userStr ? JSON.parse(userStr) : null);
    };

    window.addEventListener('user-updated', updateUserState);
    window.addEventListener('storage', updateUserState);
    return () => {
      window.removeEventListener('user-updated', updateUserState);
      window.removeEventListener('storage', updateUserState);
    };
  }, []);

  const userName = user?.name || user?.username || 'Admin User';
  const userRole = user?.username ? `@${user.username}` : (user?.role || 'Administrator');
  const userInitial = userName.charAt(0).toUpperCase();

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
  } else if (location.pathname === '/settings') {
    title = 'Settings & Configuration';
    subtitle = 'Manage company details, billing options, bank accounts, and security';
  } else if (location.pathname === '/commissions') {
    title = 'Commissions Dashboard';
    subtitle = 'Track agent performance and commission payouts';
  } else if (location.pathname === '/reports') {
    title = 'System Reports';
    subtitle = '360-degree view of clients and team performance';
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
        <div className="header-search" ref={searchRef} style={{ position: 'relative' }}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search everything..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => searchQuery.trim() && setShowDropdown(true)}
          />
          
          {showDropdown && searchResults && (
            <div className="search-dropdown" style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem',
              backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              border: '1px solid var(--border-color)', zIndex: 1000, maxHeight: '400px', overflowY: 'auto'
            }}>
              {Object.keys(searchResults).every(k => searchResults[k].length === 0) ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No results found.
                </div>
              ) : (
                <div style={{ padding: '0.5rem 0' }}>
                  {searchResults.clients && searchResults.clients.length > 0 && (
                    <div className="search-section">
                      <div style={{ padding: '0.25rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Clients</div>
                      {searchResults.clients.map(c => (
                        <Link to="/clients" key={c.id} style={{ display: 'block', padding: '0.5rem 1rem', textDecoration: 'none', color: 'var(--text-primary)', borderBottom: '1px solid #f1f5f9' }} onClick={() => setShowDropdown(false)} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <div style={{ fontWeight: '500' }}>{c.full_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.business_name} • {c.email}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {searchResults.invoices && searchResults.invoices.length > 0 && (
                    <div className="search-section">
                      <div style={{ padding: '0.25rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '0.5rem' }}>Invoices</div>
                      {searchResults.invoices.map(i => (
                        <Link to="/invoices" key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', textDecoration: 'none', color: 'var(--text-primary)', borderBottom: '1px solid #f1f5f9' }} onClick={() => setShowDropdown(false)} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <div style={{ fontWeight: '500' }}>{i.invoice_number}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{i.client_name}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {searchResults.projects && searchResults.projects.length > 0 && (
                    <div className="search-section">
                      <div style={{ padding: '0.25rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '0.5rem' }}>Projects</div>
                      {searchResults.projects.map(p => (
                        <Link to="/projects" key={p.id} style={{ display: 'block', padding: '0.5rem 1rem', textDecoration: 'none', color: 'var(--text-primary)', borderBottom: '1px solid #f1f5f9' }} onClick={() => setShowDropdown(false)} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <div style={{ fontWeight: '500' }}>{p.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.client_name}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
          
          <div className="user-profile" style={{ cursor: 'pointer' }} onClick={() => navigate('/settings')}>
            {user?.profile_image_url ? (
              <img 
                src={user.profile_image_url} 
                alt={userName} 
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-color)' }} 
              />
            ) : (
              <div className="avatar" style={{ fontWeight: 'bold' }}>
                {userInitial}
              </div>
            )}
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">{userRole}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
