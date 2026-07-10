import React from 'react';
import { LockIcon, LogOutIcon, SparklesIcon } from '../../icons';
import { PROTECTED_TABS } from '../../utils/dashboardHelpers';

export default function Sidebar({
  activeTab,
  handleLogout,
  handleTabRequest,
  isAuthenticated,
  isSidebarExpanded,
  navItems,
  openAuth,
  setIsChatOpen,
  setIsSidebarExpanded,
  user
}) {
  return (
    <aside className="sidebar">
      <button
        className="logo-container logo-toggle-btn"
        type="button"
        onClick={() => setIsSidebarExpanded((expanded) => !expanded)}
        title={isSidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
        aria-label={isSidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
      >
        <SparklesIcon className="logo-icon" />
        <span className="logo-text">PROJEX</span>
      </button>

      <nav>
        <ul className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const locked = PROTECTED_TABS.has(item.tab) && !isAuthenticated;

            return (
              <li className="nav-item" key={item.tab}>
                <button
                  onClick={() => {
                    if (item.tab === 'chatbot') {
                      setIsChatOpen(false);
                    }
                    handleTabRequest(item.tab);
                  }}
                  className={`nav-button ${activeTab === item.tab ? 'active' : ''} ${locked ? 'locked' : ''}`}
                  title={!isSidebarExpanded ? item.label : undefined}
                >
                  <Icon />
                  <span className="nav-label">{item.label}</span>
                  {item.count > 0 && (
                    <span className="nav-count-badge">{item.count}</span>
                  )}
                  {locked && (
                    <LockIcon className="nav-lock-icon" aria-label="Login required" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <footer className="sidebar-footer">
        {isAuthenticated ? (
          <div className="account-card">
            <div className="account-meta">
              <span className="account-label">Signed in as</span>
              <span className="account-name">{user.fullName}</span>
              <span className="account-email">{user.email}</span>
            </div>
            <button className="logout-btn" type="button" onClick={handleLogout}>
              <LogOutIcon />
              Logout
            </button>
          </div>
        ) : (
          <div className="auth-sidebar-actions">
            <button className="auth-sidebar-primary" type="button" onClick={() => openAuth('login')}>
              Sign in
            </button>
            <button className="auth-sidebar-secondary" type="button" onClick={() => openAuth('signup')}>
              Create account
            </button>
            <div className="sidebar-version">PROJEX Dashboard v2.0</div>
          </div>
        )}
      </footer>
    </aside>
  );
}
