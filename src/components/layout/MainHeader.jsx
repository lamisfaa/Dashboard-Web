import React from 'react';
import { MoonIcon, SunIcon } from '../../icons';

export default function MainHeader({
  activeTab,
  departmentHeaderConfig,
  isAuthenticated,
  overviewHeaderConfig,
  projectHeaderConfig,
  setTheme,
  theme,
  user
}) {
  return (
    <header className={`header-container ${activeTab === 'overview' ? 'overview-header' : ''}`}>
      <div className="header-copy">
        <h1 className="page-title">
          {activeTab === 'overview' && (isAuthenticated ? `Hello, ${user.fullName}!` : overviewHeaderConfig.title)}
          {activeTab === 'profile' && 'User Profile'}
          {activeTab === 'admin' && 'Admin Management System'}
          {activeTab === 'projects' && projectHeaderConfig.title}
          {activeTab === 'departments' && departmentHeaderConfig.title}
          {activeTab === 'activity' && 'Operational Audit Trail'}
          {activeTab === 'hygiene' && 'Data Quality & Integrity Alerts'}
          {activeTab === 'chatbot' && 'PROJEX AI Intelligence'}
        </h1>
        <p className="page-subtitle">
          {activeTab === 'overview' && (isAuthenticated ? overviewHeaderConfig.title : overviewHeaderConfig.subtitle)}
          {activeTab === 'profile' && 'View your account identity and access details.'}
          {activeTab === 'admin' && 'Edit dashboard tables, sync Excel, and manage user access.'}
          {activeTab === 'projects' && projectHeaderConfig.subtitle}
          {activeTab === 'departments' && departmentHeaderConfig.subtitle}
          {activeTab === 'activity' && 'Real-time trace log of system changes and user events.'}
          {activeTab === 'hygiene' && 'Logical validation checks on data consistency.'}
          {activeTab === 'chatbot' && 'Interact with the organization dataset powered by Gemini 2.5 Flash.'}
        </p>
      </div>

      <div className="header-meta" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
          className="theme-toggle-btn"
          style={{ width: 'auto', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <SunIcon style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
          ) : (
            <MoonIcon style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
          )}
        </button>
        <div style={{ textAlign: 'right' }}>
          <div className="header-time">15:44 PM</div>
          <div className="header-date">Saturday, Jul 4, 2026</div>
        </div>
      </div>
    </header>
  );
}
