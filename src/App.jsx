import React, { useState, useMemo, useEffect } from 'react';
import initialData from './data.json';
import Chatbot from './Chatbot';
import AuthModal from './auth/AuthModal';
import { useAuth } from './auth/useAuth';
import { API_BASE_URL } from './api';
import {
  DashboardIcon,
  ProjectsIcon,
  UsersIcon,
  DepartmentIcon,
  ActivityIcon,
  ShieldAlertIcon,
  SearchIcon,
  CheckCircleIcon,
  InfoIcon,
  SparklesIcon,
  SunIcon,
  MoonIcon
} from './icons';
import MainHeader from './components/layout/MainHeader';
import Sidebar from './components/layout/Sidebar';
import {
  formatExcelDate,
  formatSAR,
  PROTECTED_TABS,
  TAB_LABELS,
  PROJECT_STATUS_OPTIONS,
  STATUS_ORDER,
  TASK_STATUS_ORDER,
  HEALTH_ORDER,
  RISK_ORDER,
  STATUS_COLOR_CLASS,
  countBy,
  sumBy,
  computeCustomWidgetValue,
  renderCustomGraphVisualization,
  getBuiltinOverviewKpi,
  getIdNumber,
  getOverviewSettingsRows,
  getOverviewHeaderConfig,
  getOverviewWidgetRows,
  getEditablePageSettingsRows,
  getEditablePageHeaderConfig,
  getEditablePageCardRows,
  getEditablePageOptions,
  getEditablePageFieldRows,
  isPageItemEnabled,
  getPageItemLabel,
  getPageItemOrder,
  getEnabledFieldIds,
  renderDepartmentFieldValue,
  getInitials,
  ADMIN_ACTIVITY_KEY,
  readAdminActivity,
  buildDonutGradient
} from './utils/dashboardHelpers';
import AdminManagement from './admin/AdminManagement';
function App() {
  const { user, isAuthenticated, logout, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(initialData);
  const [dataError, setDataError] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [initialChatQuery, setInitialChatQuery] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [requestedTab, setRequestedTab] = useState(null);
  const [resetEmail, setResetEmail] = useState('');
  const [profileDraft, setProfileDraft] = useState({ fullName: '', bio: '', avatarColor: 'pink' });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [adminActivity, setAdminActivity] = useState(() => readAdminActivity());
  const [isAdminPageEditorOpen, setIsAdminPageEditorOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('projex-theme');
    if (saved) return saved;
    return 'dark';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('projex-theme', theme);
  }, [theme]);

  React.useEffect(() => {
    if (!isAuthenticated && PROTECTED_TABS.has(activeTab)) {
      setActiveTab('overview');
      setIsChatOpen(false);
    }
  }, [activeTab, isAuthenticated]);

  const isAdmin = isAuthenticated && user?.role === 'admin';

  const profileStorageKey = user?.id ? `projex-profile-preferences-${user.id}` : '';
  const avatarColorOptions = [
    { value: 'pink', label: 'Pink' },
    { value: 'blue', label: 'Blue' },
    { value: 'green', label: 'Green' },
    { value: 'amber', label: 'Amber' },
    { value: 'slate', label: 'Slate' }
  ];

  React.useEffect(() => {
    if (!user) return;

    let savedPreferences = {};
    try {
      savedPreferences = JSON.parse(localStorage.getItem(`projex-profile-preferences-${user.id}`) || '{}');
    } catch {
      savedPreferences = {};
    }

    setProfileDraft({
      fullName: user.fullName || '',
      bio: savedPreferences.bio || '',
      avatarColor: savedPreferences.avatarColor || 'pink'
    });
    setProfileMessage('');
    setProfileError('');
  }, [user]);

  React.useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('overview');
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard-data`);
        if (!response.ok) {
          throw new Error('Live dashboard data is unavailable.');
        }
        const nextData = await response.json();
        setDashboardData(nextData);
        setDataError('');
      } catch {
        setDashboardData(initialData);
        setDataError('Using bundled dashboard data because the backend data API is unavailable.');
      }
    };

    loadDashboardData();
  }, []);

  const openAuth = (mode = 'login', tab = null) => {
    setAuthMode(mode);
    setRequestedTab(tab);
    setAuthOpen(true);
  };

  const handleTabRequest = (tab) => {
    if (PROTECTED_TABS.has(tab) && !isAuthenticated) {
      openAuth('login', tab);
      return;
    }
    if (tab === 'admin' && !isAdmin) {
      setActiveTab('overview');
      return;
    }
    setActiveTab(tab);
  };

  const handleProtectedChatOpen = () => {
    if (!isAuthenticated) {
      openAuth('login', 'chatbot');
      return;
    }
    setIsChatOpen(true);
  };

  const handleAuthSuccess = (authenticatedUser) => {
    const targetTab = requestedTab;
    setAuthOpen(false);
    setRequestedTab(null);
    setResetEmail('');
    if (targetTab) {
      setActiveTab(targetTab === 'admin' && authenticatedUser?.role !== 'admin' ? 'overview' : targetTab);
    } else if (authenticatedUser?.role === 'admin') {
      setActiveTab('admin');
    }
  };

  const handleLogout = () => {
    logout();
    setActiveTab('overview');
    setIsChatOpen(false);
  };

  const updateProfileDraft = (field, value) => {
    setProfileDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
    setProfileMessage('');
    setProfileError('');
  };

  const saveProfileSettings = async (event) => {
    event.preventDefault();
    if (!profileDraft.fullName.trim()) {
      setProfileError('Name cannot be empty.');
      return;
    }

    setProfileSaving(true);
    setProfileMessage('');
    setProfileError('');
    try {
      await updateProfile({ fullName: profileDraft.fullName });
      if (profileStorageKey) {
        localStorage.setItem(profileStorageKey, JSON.stringify({
          bio: profileDraft.bio.trim(),
          avatarColor: profileDraft.avatarColor
        }));
      }
      setProfileDraft((currentDraft) => ({
        ...currentDraft,
        fullName: profileDraft.fullName.trim(),
        bio: profileDraft.bio.trim()
      }));
      setProfileMessage('Profile updated.');
    } catch (err) {
      setProfileError(err.message || 'Could not update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const openPasswordReset = () => {
    if (!user?.email) return;
    setResetEmail(user.email);
    setAuthMode('login');
    setRequestedTab(null);
    setAuthOpen(true);
  };

  const handleAdminActivity = (activities) => {
    setAdminActivity((currentActivities) => {
      const nextActivities = [...activities, ...currentActivities].slice(0, 30);
      localStorage.setItem(ADMIN_ACTIVITY_KEY, JSON.stringify(nextActivities));
      return nextActivities;
    });
  };

  // Load datasets
  const data = dashboardData;
  const projects = useMemo(() => data.Projects || [], [data]);
  const employees = useMemo(() => data.Employees || [], [data]);
  const departments = useMemo(() => data.Departments || [], [data]);
  const tasks = useMemo(() => data.Tasks || [], [data]);
  const weeklyUpdates = useMemo(() => data.WeeklyUpdates || data['Weekly Updates'] || [], [data]);
  const activityLog = useMemo(() => data.ActivityLog || data['Activity Log'] || [], [data]);

  // Filter States
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('All');
  const [deptSearch, setDeptSearch] = useState('');
  const [activityImpactFilter, setActivityImpactFilter] = useState('All');
  const [activitySearch, setActivitySearch] = useState('');
  const [overviewDepartmentFilter, setOverviewDepartmentFilter] = useState('All');

  const projectStats = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let atRisk = 0;
    let onHold = 0;
    let planning = 0;
    let notStarted = 0;
    let totalBudget = 0;
    let totalSpend = 0;
    let riskHigh = 0;
    let riskMedium = 0;
    let riskLow = 0;
    
    projects.forEach(p => {
      if (p.Status === 'Completed') completed++;
      else if (p.Status === 'In Progress') inProgress++;
      else if (p.Status === 'At Risk') atRisk++;
      else if (p.Status === 'On Hold') onHold++;
      else if (p.Status === 'Planning') planning++;
      else if (p.Status === 'Not Started') notStarted++;
      
      totalBudget += Number(p['Budget SAR'] || 0);
      totalSpend += Number(p['Actual Spend SAR'] || 0);
      
      const risk = p['Risk Level'];
      if (risk === 'High') riskHigh++;
      else if (risk === 'Medium') riskMedium++;
      else riskLow++;
    });
    
    const total = projects.length || 1;
    
    return {
      total,
      completed,
      inProgress,
      atRisk,
      onHold,
      planning,
      notStarted,
      totalBudget,
      totalSpend,
      utilization: totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0,
      riskHigh,
      riskMedium,
      riskLow
    };
  }, [projects]);

  const workforceStats = useMemo(() => {
    let entryCount = 0;
    let midCount = 0;
    let seniorCount = 0;
    
    let riyadhCount = 0;
    let jeddahCount = 0;
    let otherCount = 0;
    
    employees.forEach(e => {
      const lvl = e.Level || '';
      if (lvl === 'Associate') {
        entryCount++;
      } else if (lvl === 'Specialist' || lvl === 'Senior Specialist') {
        midCount++;
      } else {
        seniorCount++;
      }
      
      const dept = departments.find(d => d['Department ID'] === e['Department ID']);
      const loc = dept ? dept.Location : 'Riyadh';
      if (loc.includes('Riyadh')) {
        riyadhCount++;
      } else if (loc.includes('Jeddah')) {
        jeddahCount++;
      } else {
        otherCount++;
      }
    });
    
    const deptCounts = departments.map(d => {
      const count = employees.filter(e => e['Department ID'] === d['Department ID']).length;
      return {
        name: d['Department Name'],
        count
      };
    });
    deptCounts.sort((a, b) => b.count - a.count);
    const topDepts = deptCounts.slice(0, 4);
    
    const totalEmployees = employees.length || 1;
    
    return {
      totalEmployees,
      entryCount,
      midCount,
      seniorCount,
      riyadhCount,
      jeddahCount,
      otherCount,
      topDepts
    };
  }, [employees, departments]);

  const recentPortfolioUpdates = useMemo(() => (
    [
      ...adminActivity
        .filter((activity) => activity.table === 'Projects')
        .map((activity) => ({
          id: activity.id,
          title: activity.title,
          meta: `${activity.action} project${activity.meta ? ` · ${activity.meta}` : ''}`,
          badge: activity.action
        })),
      ...projects
      .slice()
      .sort((a, b) => getIdNumber(b['Project ID']) - getIdNumber(a['Project ID']))
      .map((project) => ({
        id: project['Project ID'],
        title: project['Project Name'],
        meta: `${project.Department || 'No department'} · ${project.Status || 'No status'}`,
        badge: project['Risk Level'] || project.Priority || 'Project'
      }))
    ].slice(0, 4)
  ), [adminActivity, projects]);

  const recentWorkforceUpdates = useMemo(() => {
    const activityUpdates = adminActivity
      .filter((activity) => ['Employees', 'Departments'].includes(activity.table))
      .map((activity) => ({
        id: activity.id,
        title: activity.title,
        meta: `${activity.action} ${activity.table === 'Employees' ? 'employee' : 'department'}${activity.meta ? ` · ${activity.meta}` : ''}`,
        badge: activity.action
      }));

    const recentEmployees = employees
      .slice()
      .sort((a, b) => getIdNumber(b['Employee ID']) - getIdNumber(a['Employee ID']))
      .slice(0, 2)
      .map((employee) => ({
        id: employee['Employee ID'],
        title: employee['Employee Name'],
        meta: `${employee.Department || 'No department'} · ${employee['Job Title'] || 'Employee'}`,
        badge: 'Employee'
      }));

    const recentDepartments = departments
      .slice()
      .sort((a, b) => getIdNumber(b['Department ID']) - getIdNumber(a['Department ID']))
      .slice(0, 2)
      .map((department) => ({
        id: department['Department ID'],
        title: department['Department Name'],
        meta: `${department.Location || 'No location'} · ${department.Director || 'No director'}`,
        badge: 'Department'
      }));

    return [...activityUpdates, ...recentEmployees, ...recentDepartments].slice(0, 4);
  }, [adminActivity, departments, employees]);

  const overviewOptions = useMemo(() => ({
    departments: departments.map(d => d['Department Name']).sort()
  }), [departments]);

  const overviewSummary = useMemo(() => {
    const filteredProjectsForOverview = projects.filter(p => {
      const matchDepartment = overviewDepartmentFilter === 'All' || p.Department === overviewDepartmentFilter;
      return matchDepartment;
    });

    const projectIds = new Set(filteredProjectsForOverview.map(p => p['Project ID']));
    const filterByDepartment = (item) => overviewDepartmentFilter === 'All' || item.Department === overviewDepartmentFilter;
    const filterByProject = (item) => overviewDepartmentFilter === 'All' || projectIds.has(item['Project ID']);

    const filteredTasksForOverview = tasks.filter(t => filterByDepartment(t) && filterByProject(t));
    const filteredUpdatesForOverview = weeklyUpdates.filter(u => filterByDepartment(u) && filterByProject(u));
    const filteredActivityForOverview = activityLog.filter(a => filterByDepartment(a) && filterByProject(a));
    const filteredEmployeesForOverview = employees.filter(e => (
      overviewDepartmentFilter === 'All' || e.Department === overviewDepartmentFilter
    ));
    const filteredDepartmentsForOverview = departments.filter(d => (
      overviewDepartmentFilter === 'All' || d['Department Name'] === overviewDepartmentFilter
    ));

    const totalBudget = sumBy(filteredDepartmentsForOverview, d => d['Annual Budget SAR']);
    const totalSpend = sumBy(filteredProjectsForOverview, p => p['Actual Spend SAR']);
    const totalEstimatedHours = sumBy(filteredTasksForOverview, t => t['Estimated Hours']);
    const totalActualHours = sumBy(filteredTasksForOverview, t => t['Actual Hours']);
    const completedTasks = filteredTasksForOverview.filter(t => t.Status === 'Completed').length;
    const avgProgress = filteredProjectsForOverview.length
      ? sumBy(filteredProjectsForOverview, p => p['Progress %']) / filteredProjectsForOverview.length
      : 0;

    const departmentRows = filteredDepartmentsForOverview.map(d => {
      const departmentProjects = filteredProjectsForOverview.filter(p => p.Department === d['Department Name']);
      const departmentEmployees = filteredEmployeesForOverview.filter(e => e.Department === d['Department Name']);
      const budget = Number(d['Annual Budget SAR'] || 0);
      const spend = sumBy(departmentProjects, p => p['Actual Spend SAR']);

      return {
        name: d['Department Name'],
        projects: departmentProjects.length,
        employees: departmentEmployees.length,
        budget,
        spend,
        utilization: budget > 0 ? (spend / budget) * 100 : 0
      };
    }).filter(row => row.projects || row.employees || row.budget).sort((a, b) => b.budget - a.budget);

    const topDepartmentsByBudget = departmentRows.slice(0, 6);
    const maxDepartmentBudget = Math.max(...topDepartmentsByBudget.map(row => row.budget), 1);

    const activityTypes = countBy(filteredActivityForOverview, a => a['Activity Type'])
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const nextDeadlines = filteredProjectsForOverview
      .slice()
      .sort((a, b) => Number(a['Target End Date'] || 0) - Number(b['Target End Date'] || 0))
      .slice(0, 5);

    const taskCompletionRate = filteredTasksForOverview.length
      ? (completedTasks / filteredTasksForOverview.length) * 100
      : 0;

    const progressTrendRaw = Object.values(filteredUpdatesForOverview.reduce((acc, update) => {
      const week = update['Week Starting'];
      if (!acc[week]) acc[week] = { week, total: 0, count: 0 };
      acc[week].total += Number(update['Progress %'] || 0);
      acc[week].count++;
      return acc;
    }, {}))
      .sort((a, b) => Number(a.week) - Number(b.week))
      .slice(-10)
      .map(item => ({
        week: item.week,
        label: formatExcelDate(item.week),
        progress: item.count ? item.total / item.count : 0
      }));

    const progressTrend = progressTrendRaw.map((item, index) => {
      const x = progressTrendRaw.length > 1 ? 34 + (index * (352 / (progressTrendRaw.length - 1))) : 210;
      const y = 184 - (item.progress * 1.55);
      return { ...item, x, y };
    });

    const progressLinePoints = progressTrend.map(point => `${point.x},${point.y}`).join(' ');
    const progressAreaPoints = progressTrend.length
      ? `34,190 ${progressLinePoints} ${progressTrend[progressTrend.length - 1].x},190`
      : '';

    const employeeRows = departmentRows
      .slice()
      .sort((a, b) => b.employees - a.employees)
      .slice(0, 6);
    const maxEmployees = Math.max(...employeeRows.map(row => row.employees), 1);
    const statusCounts = countBy(filteredProjectsForOverview, p => p.Status, STATUS_ORDER);
    const riskCounts = countBy(filteredProjectsForOverview, p => p['Risk Level'], RISK_ORDER);
    const maxRiskCount = Math.max(...riskCounts.map(item => item.count), 1);

    return {
      projects: filteredProjectsForOverview,
      tasks: filteredTasksForOverview,
      updates: filteredUpdatesForOverview,
      activities: filteredActivityForOverview,
      employees: filteredEmployeesForOverview,
      departments: filteredDepartmentsForOverview,
      totalBudget,
      totalSpend,
      totalEstimatedHours,
      totalActualHours,
      avgProgress,
      taskCompletionRate,
      openTasks: filteredTasksForOverview.length - completedTasks,
      blockedTasks: filteredTasksForOverview.filter(t => t.Status === 'Blocked').length,
      highRiskProjects: filteredProjectsForOverview.filter(p => p['Risk Level'] === 'High').length,
      budgetUtilization: totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0,
      statusCounts,
      taskStatusCounts: countBy(filteredTasksForOverview, t => t.Status, TASK_STATUS_ORDER),
      healthCounts: countBy(filteredUpdatesForOverview, u => u.Health, HEALTH_ORDER),
      riskCounts,
      maxRiskCount,
      statusDonutGradient: buildDonutGradient(statusCounts, filteredProjectsForOverview.length),
      departmentRows,
      topDepartmentsByBudget,
      maxDepartmentBudget,
      progressTrend,
      progressLinePoints,
      progressAreaPoints,
      employeeRows,
      maxEmployees,
      activityTypes,
      nextDeadlines
    };
  }, [
    activityLog,
    departments,
    employees,
    overviewDepartmentFilter,
    projects,
    tasks,
    weeklyUpdates
  ]);

  const overviewSettingsRows = useMemo(() => getOverviewSettingsRows(data), [data]);
  const overviewHeaderConfig = useMemo(() => getOverviewHeaderConfig(overviewSettingsRows), [overviewSettingsRows]);
  const overviewKpiWidgets = useMemo(() => getOverviewWidgetRows(overviewSettingsRows), [overviewSettingsRows]);
  const visibleOverviewKpiCards = useMemo(() => (
    overviewKpiWidgets
      .filter((widget) => widget.enabled)
      .map((widget) => {
        if (widget.type === 'builtin-kpi') {
          const card = getBuiltinOverviewKpi(widget, overviewSummary);
          return card ? { ...card, id: widget.id, type: widget.type } : null;
        }

        return {
          id: widget.id,
          type: widget.type,
          label: widget.label,
          value: computeCustomWidgetValue(widget, data),
          note: widget.note || `${widget.metric || 'count'} from ${widget.sourceTable || 'table'}`
        };
      })
      .filter(Boolean)
  ), [data, overviewKpiWidgets, overviewSummary]);

  const projectSettingsRows = useMemo(() => getEditablePageSettingsRows(data, 'projects'), [data]);
  const projectHeaderConfig = useMemo(() => getEditablePageHeaderConfig(projectSettingsRows, 'projects'), [projectSettingsRows]);
  const projectSummaryCards = useMemo(() => getEditablePageCardRows(projectSettingsRows, 'projects'), [projectSettingsRows]);
  const projectPageOptions = useMemo(() => getEditablePageOptions(projectSettingsRows, 'projects'), [projectSettingsRows]);
  const projectCardFields = useMemo(() => getEditablePageFieldRows(projectSettingsRows, 'projects'), [projectSettingsRows]);
  const visibleProjectFieldIds = useMemo(() => getEnabledFieldIds(projectCardFields), [projectCardFields]);
  const projectCustomCards = useMemo(() => projectSummaryCards.filter((card) => card.type === 'custom-graph'), [projectSummaryCards]);

  const departmentSettingsRows = useMemo(() => getEditablePageSettingsRows(data, 'departments'), [data]);
  const departmentHeaderConfig = useMemo(() => getEditablePageHeaderConfig(departmentSettingsRows, 'departments'), [departmentSettingsRows]);
  const departmentSummaryCards = useMemo(() => getEditablePageCardRows(departmentSettingsRows, 'departments'), [departmentSettingsRows]);
  const departmentTableFields = useMemo(() => getEditablePageFieldRows(departmentSettingsRows, 'departments'), [departmentSettingsRows]);

  useEffect(() => {
    if (activeTab === 'projects' && projectPageOptions.defaultStatus) {
      setProjectStatusFilter(projectPageOptions.defaultStatus);
    }
  }, [activeTab, projectPageOptions.defaultStatus]);


  // -------------------------------------------------------------
  // DATA HYGIENE CONFLICT DETECTOR
  // -------------------------------------------------------------
  const hygieneIssues = useMemo(() => {
    const list = [];
    
    // Project ID lookup
    const projectMap = {};
    projects.forEach(p => {
      projectMap[p['Project ID']] = p;
    });

    // 1. Projects marked Completed but have incomplete tasks
    projects.forEach(p => {
      if (p.Status === 'Completed') {
        const incompleteTasks = tasks.filter(t => t['Project ID'] === p['Project ID'] && t.Status !== 'Completed');
        if (incompleteTasks.length > 0) {
          list.push({
            type: 'Completed Project with Active Tasks',
            project: `${p['Project ID']} - ${p['Project Name']}`,
            status: p.Status,
            desc: `Project is marked completed, but has ${incompleteTasks.length} unfinished tasks (e.g. ${incompleteTasks.slice(0, 2).map(t => `${t['Task ID']} [${t.Status}]`).join(', ')}).`
          });
        }
      }
    });

    // 2. Projects marked Not Started but have active tasks
    projects.forEach(p => {
      if (p.Status === 'Not Started') {
        const activeTasks = tasks.filter(t => t['Project ID'] === p['Project ID'] && t.Status !== 'Not Started' && t.Status !== 'Backlog');
        if (activeTasks.length > 0) {
          list.push({
            type: 'Not Started Project with Active Tasks',
            project: `${p['Project ID']} - ${p['Project Name']}`,
            status: p.Status,
            desc: `Project has not started, but work has commenced on ${activeTasks.length} tasks (e.g. ${activeTasks.slice(0, 2).map(t => `${t['Task ID']} [${t.Status}]`).join(', ')}).`
          });
        }
      }
    });

    return list;
  }, [projects, tasks]);

  // -------------------------------------------------------------
  // RENDERING TABS
  // -------------------------------------------------------------

  // Filtered Lists
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = p['Project Name'].toLowerCase().includes(projectSearch.toLowerCase()) || 
                          p['Owner'].toLowerCase().includes(projectSearch.toLowerCase()) ||
                          p['Project ID'].toLowerCase().includes(projectSearch.toLowerCase());
      const matchStatus = projectStatusFilter === 'All' || p.Status === projectStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, projectSearch, projectStatusFilter]);

  const filteredDepts = useMemo(() => {
    return departments.filter(d => {
      return d['Department Name'].toLowerCase().includes(deptSearch.toLowerCase()) ||
             d['Director'].toLowerCase().includes(deptSearch.toLowerCase());
    });
  }, [departments, deptSearch]);

  const filteredActivities = useMemo(() => {
    return activityLog.filter(l => {
      const matchSearch = l['Employee'].toLowerCase().includes(activitySearch.toLowerCase()) ||
                          l['Project'].toLowerCase().includes(activitySearch.toLowerCase()) ||
                          l['Activity Type'].toLowerCase().includes(activitySearch.toLowerCase());
      const matchImpact = activityImpactFilter === 'All' || l.Impact === activityImpactFilter;
      return matchSearch && matchImpact;
    });
  }, [activityLog, activitySearch, activityImpactFilter]);

  const navItems = [
    { tab: 'overview', label: TAB_LABELS.overview, icon: DashboardIcon },
    { tab: 'profile', label: TAB_LABELS.profile, icon: UsersIcon },
    ...(isAdmin ? [{ tab: 'admin', label: TAB_LABELS.admin, icon: ShieldAlertIcon }] : []),
    { tab: 'projects', label: TAB_LABELS.projects, icon: ProjectsIcon },
    { tab: 'departments', label: TAB_LABELS.departments, icon: DepartmentIcon },
    { tab: 'activity', label: TAB_LABELS.activity, icon: ActivityIcon },
    { tab: 'hygiene', label: TAB_LABELS.hygiene, icon: ShieldAlertIcon, count: hygieneIssues.length },
    { tab: 'chatbot', label: TAB_LABELS.chatbot, icon: SparklesIcon }
  ];

  if (activeTab === 'chatbot') {
    return (
      <div className="app-container">
        <div className="chatbot-page-container">
          <header className="chatbot-page-header">
            <div className="chatbot-page-header-left">
              <button 
                className="chatbot-back-btn" 
                onClick={() => setActiveTab('overview')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                <span>Back to Dashboard</span>
              </button>
              <div className="chatbot-page-header-title">
                <SparklesIcon className="logo-icon animate-pulse-pink" />
                <div>
                  <h1 className="page-title" style={{ fontSize: '20px', margin: 0 }}>PROJEX AI Intelligence</h1>
                  <p className="page-subtitle" style={{ fontSize: '12px', margin: 0, color: 'var(--text-muted)' }}>
                    Interact with the organization dataset powered by Gemini 2.5 Flash.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="header-meta" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                className="theme-toggle-btn"
                style={{ width: 'auto', padding: '8px 12px' }}
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
          
          <div className="chatbot-page-body">
            <Chatbot initialQuery={initialChatQuery} clearInitialQuery={() => setInitialChatQuery('')} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${isSidebarExpanded ? '' : 'sidebar-collapsed'} ${isAdminPageEditorOpen ? 'editing-active' : ''}`}>
      <Sidebar
        activeTab={activeTab}
        handleLogout={handleLogout}
        handleTabRequest={handleTabRequest}
        isAuthenticated={isAuthenticated}
        isSidebarExpanded={isSidebarExpanded}
        navItems={navItems}
        openAuth={openAuth}
        setIsChatOpen={setIsChatOpen}
        setIsSidebarExpanded={setIsSidebarExpanded}
        user={user}
      />

      {/* Main Workspace */}
      <main className="main-workspace">
        <MainHeader
          activeTab={activeTab}
          departmentHeaderConfig={departmentHeaderConfig}
          isAuthenticated={isAuthenticated}
          overviewHeaderConfig={overviewHeaderConfig}
          projectHeaderConfig={projectHeaderConfig}
          setTheme={setTheme}
          theme={theme}
          user={user}
        />

        {dataError && (
          <div className="status-banner warning" style={{ marginBottom: '24px' }}>
            {dataError}
          </div>
        )}

        {/* -------------------- ADMIN MANAGEMENT -------------------- */}
        {activeTab === 'admin' && isAdmin && (
          <AdminManagement
            data={dashboardData}
            onDataSaved={setDashboardData}
            onAdminActivity={handleAdminActivity}
            onPageEditorStateChange={setIsAdminPageEditorOpen}
          />
        )}

        {/* -------------------- TAB 1: OVERVIEW -------------------- */}
        {activeTab === 'overview' && (
          <div className="overview-page">
            <div className="overview-filter-panel glass-card">
              <div className="overview-filter-copy">
                <span className="overview-filter-label">Excel summary filters</span>
                <strong>{overviewSummary.projects.length} projects in view</strong>
              </div>
              <div className="overview-filter-controls">
                <select value={overviewDepartmentFilter} onChange={(e) => setOverviewDepartmentFilter(e.target.value)} className="filter-select">
                  <option value="All">All departments</option>
                  {overviewOptions.departments.map(dept => (
                    <option value={dept} key={dept}>{dept}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="overview-reset-btn"
                  onClick={() => {
                    setOverviewDepartmentFilter('All');
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

	            <div className="overview-kpi-grid">
	              {visibleOverviewKpiCards.map((card) => {
	                const content = (
	                  <>
	                    <span className="kpi-label">{card.label}</span>
	                    <span className={`kpi-value ${card.ai ? 'chatbot-kpi-value' : ''}`}>{card.value}</span>
	                    <span className="overview-kpi-note">{card.note}</span>
	                  </>
	                );

	                if (card.ai) {
	                  return (
	                    <button type="button" className="glass-card overview-kpi-card overview-ai-card" onClick={handleProtectedChatOpen} key={card.id}>
	                      {content}
	                    </button>
	                  );
	                }

	                return (
	                  <div className={`glass-card overview-kpi-card ${card.accent ? 'accent-pink' : ''}`} key={card.id}>
	                    {content}
	                  </div>
	                );
	              })}
	            </div>

            <div className="overview-chart-grid">
              <div className="glass-card overview-chart-card overview-chart-wide">
                <h3 className="block-title"><ActivityIcon /> Project Progress Trend</h3>
                <div className="overview-line-chart">
                  <svg viewBox="0 0 420 220" role="img" aria-label="Project progress trend">
                    <line x1="34" y1="30" x2="34" y2="190" className="chart-axis" />
                    <line x1="34" y1="190" x2="394" y2="190" className="chart-axis" />
                    {[25, 50, 75, 100].map(value => (
                      <g key={value}>
                        <line x1="34" y1={184 - (value * 1.55)} x2="394" y2={184 - (value * 1.55)} className="chart-gridline" />
                        <text x="8" y={188 - (value * 1.55)} className="chart-label">{value}%</text>
                      </g>
                    ))}
                    {overviewSummary.progressAreaPoints && (
                      <polygon points={overviewSummary.progressAreaPoints} className="chart-area" />
                    )}
                    {overviewSummary.progressLinePoints && (
                      <polyline points={overviewSummary.progressLinePoints} className="chart-line" />
                    )}
                    {overviewSummary.progressTrend.map((point, index) => (
                      <g key={`${point.week}-${index}`}>
                        <circle cx={point.x} cy={point.y} r="4" className="chart-point" />
                        {(index === 0 || index === overviewSummary.progressTrend.length - 1) && (
                          <text x={point.x} y="210" textAnchor="middle" className="chart-label">{point.label}</text>
                        )}
                      </g>
                    ))}
                  </svg>
                </div>
                <div className="overview-chart-footnote">Average weekly project progress from the Weekly Updates sheet</div>
              </div>

              <div className="glass-card overview-chart-card">
                <h3 className="block-title"><ProjectsIcon /> Project Status</h3>
                <div className="overview-donut-row">
                  <div className="overview-donut" style={{ background: overviewSummary.statusDonutGradient }}>
                    <div>
                      <strong>{overviewSummary.projects.length}</strong>
                      <span>Projects</span>
                    </div>
                  </div>
                  <div className="overview-mini-list">
                    {overviewSummary.statusCounts.map(({ label, count }) => (
                      <div key={label} className="overview-mini-row">
                        <span><i className={`legend-dot ${STATUS_COLOR_CLASS[label] || 'pink'}`}></i>{label}</span>
                        <strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-card overview-chart-card">
                <h3 className="block-title"><DepartmentIcon /> Budget vs Spend</h3>
                <div className="overview-donut-row">
                  <div
                    className="overview-donut overview-budget-donut"
                    style={{
                      background: `conic-gradient(
                        var(--pink-primary) 0% ${Math.min(overviewSummary.budgetUtilization, 100)}%,
                        var(--blue) ${Math.min(overviewSummary.budgetUtilization, 100)}% 100%
                      )`
                    }}
                  >
                    <div>
                      <strong>{overviewSummary.budgetUtilization.toFixed(1)}%</strong>
                      <span>Spent</span>
                    </div>
                  </div>
                  <div className="overview-mini-list">
                    <div className="overview-mini-row overview-money-row">
                      <span><i className="legend-dot blue"></i>Total:</span>
                      <strong>{formatSAR(overviewSummary.totalBudget)}</strong>
                    </div>
                    <div className="overview-mini-row overview-money-row">
                      <span><i className="legend-dot pink"></i>Spent:</span>
                      <strong>{formatSAR(overviewSummary.totalSpend)}</strong>
                    </div>
                    <div className="overview-mini-row overview-money-row">
                      <span><i className="legend-dot green"></i>Remaining:</span>
                      <strong>{formatSAR(Math.max(overviewSummary.totalBudget - overviewSummary.totalSpend, 0))}</strong>
                    </div>
                    {overviewSummary.totalSpend > overviewSummary.totalBudget && (
                      <div className="overview-mini-row overview-money-row">
                        <span><i className="legend-dot red"></i>Over Budget:</span>
                        <strong>{formatSAR(overviewSummary.totalSpend - overviewSummary.totalBudget)}</strong>
                      </div>
                    )}
                  </div>
                </div>
                <div className="overview-chart-footnote">Updates with the selected department filter</div>
              </div>

              <div className="glass-card overview-chart-card">
	                <h3 className="block-title"><ShieldAlertIcon /> Projects by Risk</h3>
	                <div className="overview-risk-chart">
	                  <div className="overview-risk-y-axis">
	                    {[
	                      overviewSummary.maxRiskCount,
	                      Math.ceil(overviewSummary.maxRiskCount / 2),
	                      0
	                    ].filter((value, index, ticks) => ticks.indexOf(value) === index).map(value => (
	                      <span key={value}>{value}</span>
	                    ))}
	                  </div>
	                  <div className="overview-risk-plot">
	                    {overviewSummary.riskCounts.map(({ label, count }) => {
	                      return (
	                        <div className="overview-risk-bar-item" key={label}>
	                          <strong>{count}</strong>
	                          <div className="overview-risk-bar-track">
	                            <div
	                              className={`overview-risk-bar ${STATUS_COLOR_CLASS[label] || 'pink'}`}
	                              style={{ height: `${Math.max((count / overviewSummary.maxRiskCount) * 100, count ? 8 : 0)}%` }}
	                            ></div>
	                          </div>
	                          <span className="overview-risk-x-label">{label}</span>
	                        </div>
	                      );
	                    })}
                  </div>
                </div>
                <div className="overview-chart-footnote">Y-axis is number of projects. X-axis is risk level.</div>
                      </div>

              <div className="glass-card overview-chart-card">
                <h3 className="block-title"><UsersIcon /> Employees by Department</h3>
                <div className="overview-horizontal-bars">
                  {overviewSummary.employeeRows.map(row => (
                    <div className="overview-single-bar-row" key={row.name}>
                      <div className="overview-bar-row-header">
                        <span title={row.name}>{row.name}</span>
                        <strong>{row.employees}</strong>
                      </div>
                      <div className="bar-list-track">
                        <div className="bar-list-fill green" style={{ width: `${(row.employees / overviewSummary.maxEmployees) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="overview-detail-grid">
              <div className="glass-card overview-section-card">
                <h3 className="block-title"><DepartmentIcon /> Department Summary</h3>
                <div className="overview-table-wrap">
                  <table className="custom-table overview-table">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Projects</th>
                        <th>Employees</th>
                        <th>Annual Budget</th>
                        <th>Utilization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewSummary.departmentRows.slice(0, 8).map(row => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{row.projects}</td>
                          <td>{row.employees}</td>
                          <td>{formatSAR(row.budget)}</td>
                          <td>{row.utilization.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass-card overview-section-card">
                <h3 className="block-title"><ActivityIcon /> Activity & Deadlines</h3>
                <div className="overview-split-list">
                  <div>
                    <h4>Top activity types</h4>
                    {overviewSummary.activityTypes.map(item => (
                      <div className="overview-list-row" key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4>Next target dates</h4>
                    {overviewSummary.nextDeadlines.map(project => (
                      <div className="overview-list-row" key={project['Project ID']}>
                        <span title={project['Project Name']}>{project['Project Name']}</span>
                        <strong>{formatExcelDate(project['Target End Date'])}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- PROFILE -------------------- */}
        {activeTab === 'profile' && isAuthenticated && (
          <div className="profile-page">
            <section className="glass-card profile-hero">
              <div className={`profile-avatar profile-avatar-${profileDraft.avatarColor}`} aria-label={`${user.fullName} profile picture`}>
                {getInitials(user.fullName)}
              </div>
              <div className="profile-main">
                <span className="profile-eyebrow">Signed in account</span>
                <h2>{user.fullName}</h2>
                <p>{user.email}</p>
                {profileDraft.bio && <p className="profile-bio-preview">{profileDraft.bio}</p>}
              </div>
              <span className="profile-status-badge">Active</span>
            </section>

            <section className="profile-info-grid">
              <div className="glass-card profile-info-card">
                <span className="profile-info-label">Name</span>
                <strong>{user.fullName}</strong>
              </div>
              <div className="glass-card profile-info-card">
                <span className="profile-info-label">Email</span>
                <strong>{user.email}</strong>
              </div>
              <div className="glass-card profile-info-card">
                <span className="profile-info-label">Role</span>
                <strong>{user.role || 'User'}</strong>
              </div>
            </section>

            <section className="profile-settings-grid">
              <form className="glass-card profile-settings-card" onSubmit={saveProfileSettings}>
                <div className="profile-card-heading">
                  <div>
                    <span className="profile-eyebrow">Identity</span>
                    <h3>Profile Settings</h3>
                  </div>
                  <button className="admin-primary-btn" type="submit" disabled={profileSaving}>
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>

                {(profileMessage || profileError) && (
                  <div className={`status-banner ${profileError ? 'warning' : 'success'}`}>
                    {profileError || profileMessage}
                  </div>
                )}

                <label className="profile-field">
                  <span>Name</span>
                  <input
                    value={profileDraft.fullName}
                    onChange={(event) => updateProfileDraft('fullName', event.target.value)}
                    placeholder="Your full name"
                  />
                </label>

                <label className="profile-field">
                  <span>Bio</span>
                  <textarea
                    value={profileDraft.bio}
                    onChange={(event) => updateProfileDraft('bio', event.target.value.slice(0, 220))}
                    placeholder="Add a short bio for your profile."
                    rows="4"
                  />
                </label>

                <div className="profile-field">
                  <span>Avatar color</span>
                  <div className="profile-color-grid">
                    {avatarColorOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`profile-color-option profile-color-${option.value} ${profileDraft.avatarColor === option.value ? 'active' : ''}`}
                        onClick={() => updateProfileDraft('avatarColor', option.value)}
                        aria-label={`Use ${option.label} avatar color`}
                      >
                        <span></span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              <aside className="glass-card profile-actions-card">
                <div className="profile-card-heading">
                  <div>
                    <span className="profile-eyebrow">Security</span>
                    <h3>Account Actions</h3>
                  </div>
                </div>
                <button className="admin-secondary-btn profile-action-btn" type="button" onClick={openPasswordReset}>
                  Reset Password
                </button>
                <button className="admin-danger-btn profile-action-btn" type="button" onClick={handleLogout}>
                  Logout
                </button>
              </aside>
            </section>
          </div>
        )}

        {/* -------------------- TAB 2: PROJECTS PORTFOLIO -------------------- */}
        {activeTab === 'projects' && (
          <div>
            <div className="portfolio-summary-grid">
              {/* CARD 1: PROJECT STATUS DONUT */}
              {isPageItemEnabled(projectSummaryCards, 'statusDistribution') && (
              <div className="glass-card summary-card" style={{ order: getPageItemOrder(projectSummaryCards, 'statusDistribution') }}>
                <div className="summary-card-title">
                  <ProjectsIcon />
                  <span>{getPageItemLabel(projectSummaryCards, 'statusDistribution', 'Project Status Distribution')}</span>
                </div>
                <div className="summary-card-content">
                  {/* Conic Gradient Donut */}
                  <div 
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '50%',
                      background: `conic-gradient(
                        var(--green) 0% ${(projectStats.completed / projectStats.total) * 100}%, 
                        var(--pink-primary) ${(projectStats.completed / projectStats.total) * 100}% ${((projectStats.completed + projectStats.inProgress) / projectStats.total) * 100}%, 
                        var(--red) ${((projectStats.completed + projectStats.inProgress) / projectStats.total) * 100}% ${((projectStats.completed + projectStats.inProgress + projectStats.atRisk) / projectStats.total) * 100}%, 
                        var(--amber) ${((projectStats.completed + projectStats.inProgress + projectStats.atRisk) / projectStats.total) * 100}% ${((projectStats.completed + projectStats.inProgress + projectStats.atRisk + projectStats.onHold) / projectStats.total) * 100}%, 
                        var(--blue) ${((projectStats.completed + projectStats.inProgress + projectStats.atRisk + projectStats.onHold) / projectStats.total) * 100}% ${((projectStats.completed + projectStats.inProgress + projectStats.atRisk + projectStats.onHold + projectStats.planning) / projectStats.total) * 100}%, 
                        var(--text-dark) ${((projectStats.completed + projectStats.inProgress + projectStats.atRisk + projectStats.onHold + projectStats.planning) / projectStats.total) * 100}% 100%
                      )`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                      flexShrink: 0
                    }}
                  >
                    <div 
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-sidebar)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'var(--font-heading)' }}>
                        {projectStats.total}
                      </span>
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                        Total
                      </span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="donut-legend" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', paddingLeft: '16px' }}>
                    <div className="donut-legend-item" style={{ justifyContent: 'flex-start', gap: '6px' }}>
                      <span className="legend-label-wrapper">
                        <span className="legend-dot" style={{ backgroundColor: 'var(--pink-primary)' }}></span>
                        Active
                      </span>
                      <span className="legend-value" style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({projectStats.inProgress})</span>
                    </div>
                    <div className="donut-legend-item" style={{ justifyContent: 'flex-start', gap: '6px' }}>
                      <span className="legend-label-wrapper">
                        <span className="legend-dot" style={{ backgroundColor: 'var(--green)' }}></span>
                        Completed
                      </span>
                      <span className="legend-value" style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({projectStats.completed})</span>
                    </div>
                    <div className="donut-legend-item" style={{ justifyContent: 'flex-start', gap: '6px' }}>
                      <span className="legend-label-wrapper">
                        <span className="legend-dot" style={{ backgroundColor: 'var(--red)' }}></span>
                        At Risk
                      </span>
                      <span className="legend-value" style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({projectStats.atRisk})</span>
                    </div>
                    <div className="donut-legend-item" style={{ justifyContent: 'flex-start', gap: '6px' }}>
                      <span className="legend-label-wrapper">
                        <span className="legend-dot" style={{ backgroundColor: 'var(--amber)' }}></span>
                        On Hold
                      </span>
                      <span className="legend-value" style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({projectStats.onHold})</span>
                    </div>
                    <div className="donut-legend-item" style={{ justifyContent: 'flex-start', gap: '6px' }}>
                      <span className="legend-label-wrapper">
                        <span className="legend-dot" style={{ backgroundColor: 'var(--blue)' }}></span>
                        Planning
                      </span>
                      <span className="legend-value" style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({projectStats.planning})</span>
                    </div>
                    <div className="donut-legend-item" style={{ justifyContent: 'flex-start', gap: '6px' }}>
                      <span className="legend-label-wrapper">
                        <span className="legend-dot" style={{ backgroundColor: 'var(--text-dark)' }}></span>
                        Not Started
                      </span>
                      <span className="legend-value" style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({projectStats.notStarted})</span>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* CARD 2: FINANCIAL HEALTH */}
              {isPageItemEnabled(projectSummaryCards, 'financialHealth') && (
              <div className="glass-card summary-card" style={{ order: getPageItemOrder(projectSummaryCards, 'financialHealth') }}>
                <div className="summary-card-title">
                  <span style={{ color: 'var(--green)' }}>●</span>
                  <span>{getPageItemLabel(projectSummaryCards, 'financialHealth', 'Financial Health (Budget vs Spend)')}</span>
                </div>
                <div className="summary-card-content">
                  <div className="financial-content">
                    <div className="financial-row">
                      <div>
                        <div className="financial-label">Total Portfolio Budget</div>
                        <div className="financial-val">{formatSAR(projectStats.totalBudget)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="financial-label">Actual Spent</div>
                        <div className="financial-val" style={{ color: projectStats.utilization > 95 ? 'var(--red)' : 'var(--text-main)' }}>
                          {formatSAR(projectStats.totalSpend)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="progress-bar-wrapper">
                        <div 
                          className="progress-bar-fill" 
                          style={{ 
                            width: `${Math.min(projectStats.utilization, 100)}%`,
                            background: projectStats.utilization > 90 ? 'var(--red)' : 'var(--pink-gradient)',
                            boxShadow: projectStats.utilization > 90 ? '0 0 10px rgba(239, 68, 68, 0.4)' : '0 0 10px rgba(255, 46, 147, 0.4)'
                          }}
                        ></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        <span>Utilization Rate: {projectStats.utilization.toFixed(1)}%</span>
                        <span>{formatSAR(projectStats.totalBudget - projectStats.totalSpend)} left</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* CARD 3: RISK PROFILE */}
              {isPageItemEnabled(projectSummaryCards, 'riskProfile') && (
              <div className="glass-card summary-card" style={{ order: getPageItemOrder(projectSummaryCards, 'riskProfile') }}>
                <div className="summary-card-title">
                  <ShieldAlertIcon style={{ color: 'var(--red)' }} />
                  <span>{getPageItemLabel(projectSummaryCards, 'riskProfile', 'Portfolio Risk Profile')}</span>
                </div>
                <div className="summary-card-content">
                  <div className="stacked-bar-container">
                    <div className="stacked-bar">
                      <div 
                        className="stacked-segment" 
                        style={{ 
                          width: `${(projectStats.riskHigh / projectStats.total) * 100}%`, 
                          backgroundColor: 'var(--red)' 
                        }}
                        title={`High Risk: ${projectStats.riskHigh} projects`}
                      ></div>
                      <div 
                        className="stacked-segment" 
                        style={{ 
                          width: `${(projectStats.riskMedium / projectStats.total) * 100}%`, 
                          backgroundColor: 'var(--amber)' 
                        }}
                        title={`Medium Risk: ${projectStats.riskMedium} projects`}
                      ></div>
                      <div 
                        className="stacked-segment" 
                        style={{ 
                          width: `${(projectStats.riskLow / projectStats.total) * 100}%`, 
                          backgroundColor: 'var(--green)' 
                        }}
                        title={`Low Risk: ${projectStats.riskLow} projects`}
                      ></div>
                    </div>

                    <div className="stacked-legend">
                      <div className="stacked-legend-item">
                        <span className="stacked-legend-label">
                          <span className="legend-dot" style={{ backgroundColor: 'var(--red)' }}></span>
                          High
                        </span>
                        <span className="stacked-legend-val">{projectStats.riskHigh}</span>
                      </div>
                      <div className="stacked-legend-item">
                        <span className="stacked-legend-label">
                          <span className="legend-dot" style={{ backgroundColor: 'var(--amber)' }}></span>
                          Medium
                        </span>
                        <span className="stacked-legend-val">{projectStats.riskMedium}</span>
                      </div>
                      <div className="stacked-legend-item">
                        <span className="stacked-legend-label">
                          <span className="legend-dot" style={{ backgroundColor: 'var(--green)' }}></span>
                          Low
                        </span>
                        <span className="stacked-legend-val">{projectStats.riskLow}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {isPageItemEnabled(projectSummaryCards, 'recentUpdates') && (
              <div className="glass-card summary-card" style={{ order: getPageItemOrder(projectSummaryCards, 'recentUpdates') }}>
                <div className="summary-card-title">
                  <ActivityIcon />
                  <span>{getPageItemLabel(projectSummaryCards, 'recentUpdates', 'Recent Portfolio Updates')}</span>
                </div>
                <div className="summary-card-content summary-recent-content">
                  {recentPortfolioUpdates.map((item) => (
                    <div className="summary-recent-item" key={item.id}>
                      <div>
                        <span className="summary-recent-id">{item.id}</span>
                        <strong>{item.title}</strong>
                        <p>{item.meta}</p>
                      </div>
                      <span className="summary-recent-badge">{item.badge}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {projectCustomCards.map((card) => (
                <div className="glass-card summary-card" key={card.id} style={{ order: card.order }}>
                  <div className="summary-card-title">
                    <ActivityIcon />
                    <span>{card.label}</span>
                  </div>
                  <div className="summary-card-content">
                    {renderCustomGraphVisualization(card, data)}
                    {card.note && <p className="project-graph-note">{card.note}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="filters-bar">
              <div className="search-input-wrapper">
                <SearchIcon />
                <input 
                  type="text" 
                  placeholder="Search project ID, name, owner..." 
                  value={projectSearch} 
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="search-input"
                />
              </div>

              <select 
                value={projectStatusFilter} 
                onChange={(e) => setProjectStatusFilter(e.target.value)}
                className="filter-select"
              >
                {PROJECT_STATUS_OPTIONS.map((statusOption) => (
                  <option value={statusOption} key={statusOption}>{statusOption === 'All' ? 'All Statuses' : statusOption}</option>
                ))}
              </select>
            </div>

            <div className="projects-grid">
              {filteredProjects.map(p => {
                let badgeClass = 'pink';
                if (p.Status === 'Completed') badgeClass = 'green';
                if (p.Status === 'At Risk') badgeClass = 'red';
                if (p.Status === 'On Hold') badgeClass = 'amber';
                if (p.Status === 'Planning' || p.Status === 'Not Started') badgeClass = 'blue';

                const progress = p['Progress %'] || 0;

                return (
                  <div key={p['Project ID']} className="glass-card project-card">
                    <div className="project-card-header">
                      <span className="project-id-badge">{p['Project ID']}</span>
                      <span className={`badge ${badgeClass}`}>{p.Status}</span>
                    </div>

                    <h3 className="project-name">{p['Project Name']}</h3>

                    <div className="project-meta-row">
                      {visibleProjectFieldIds.has('department') && (
                        <div className="project-meta-item" style={{ order: getPageItemOrder(projectCardFields, 'department') }}>
                          <span className="project-meta-label">{getPageItemLabel(projectCardFields, 'department', 'Dept')}</span>
                          <span className="project-meta-val" title={p.Department}>{p.Department.split(' ')[0]}</span>
                        </div>
                      )}
                      {visibleProjectFieldIds.has('risk') && (
                        <div className="project-meta-item" style={{ order: getPageItemOrder(projectCardFields, 'risk') }}>
                          <span className="project-meta-label">{getPageItemLabel(projectCardFields, 'risk', 'Risk Level')}</span>
                          <span className={`project-meta-val ${p['Risk Level'] === 'High' ? 'text-red' : ''}`}>{p['Risk Level']}</span>
                        </div>
                      )}
                      {visibleProjectFieldIds.has('budget') && (
                        <div className="project-meta-item" style={{ order: getPageItemOrder(projectCardFields, 'budget') }}>
                          <span className="project-meta-label">{getPageItemLabel(projectCardFields, 'budget', 'Budget')}</span>
                          <span className="project-meta-val" style={{ fontSize: '11px' }}>{formatSAR(p['Budget SAR'])}</span>
                        </div>
                      )}
                      {visibleProjectFieldIds.has('theme') && (
                        <div className="project-meta-item" style={{ order: getPageItemOrder(projectCardFields, 'theme') }}>
                          <span className="project-meta-label">{getPageItemLabel(projectCardFields, 'theme', 'Theme')}</span>
                          <span className="project-meta-val" title={p['Strategic Theme']}>{p['Strategic Theme']}</span>
                        </div>
                      )}
                    </div>

                    {visibleProjectFieldIds.has('progress') && (
                    <div className="project-progress-section" style={{ order: getPageItemOrder(projectCardFields, 'progress') }}>
                      <div className="project-progress-header">
                        <span className="project-progress-lbl">{getPageItemLabel(projectCardFields, 'progress', 'Project Completion')}</span>
                        <span className="project-progress-pct">{progress}%</span>
                      </div>
                      <div className="project-progress-bar">
                        <div className={`project-progress-fill ${badgeClass}`} style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                    )}

                    {(visibleProjectFieldIds.has('owner') || visibleProjectFieldIds.has('dueDate')) && (
                    <div className="project-card-footer">
                      {visibleProjectFieldIds.has('owner') && (
                      <div className="project-owner" style={{ order: getPageItemOrder(projectCardFields, 'owner') }}>
                        <div className="project-owner-avatar">
                          {p.Owner.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="project-owner-name">{p.Owner}</span>
                      </div>
                      )}
                      {visibleProjectFieldIds.has('dueDate') && (
                        <span style={{ order: getPageItemOrder(projectCardFields, 'dueDate') }}>{getPageItemLabel(projectCardFields, 'dueDate', 'Due')}: {formatExcelDate(p['Target End Date'])}</span>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* -------------------- TAB 3: WORKFORCES -------------------- */}
        {activeTab === 'departments' && (
          <div>
            <div className="portfolio-summary-grid">
              {/* CARD 1: HEADCOUNT DISTRIBUTION BY DEPT */}
              {isPageItemEnabled(departmentSummaryCards, 'departmentStaffing') && (
              <div className="glass-card summary-card" style={{ minHeight: '210px', order: getPageItemOrder(departmentSummaryCards, 'departmentStaffing') }}>
                <div className="summary-card-title">
                  <UsersIcon />
                  <span>{getPageItemLabel(departmentSummaryCards, 'departmentStaffing', 'Department staffing (Top 4)')}</span>
                </div>
                <div className="summary-card-content" style={{ flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                  {workforceStats.topDepts.map(d => (
                    <div key={d.name} className="department-progress-row">
                      <div className="department-progress-info">
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{d.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{d.count} staff</span>
                      </div>
                      <div className="department-progress-bar-bg">
                        <div 
                          className="department-progress-bar-fill" 
                          style={{ width: `${(d.count / workforceStats.totalEmployees) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* CARD 2: WORKFORCE LOCATIONS */}
              {isPageItemEnabled(departmentSummaryCards, 'workforceLocations') && (
              <div className="glass-card summary-card" style={{ minHeight: '210px', order: getPageItemOrder(departmentSummaryCards, 'workforceLocations') }}>
                <div className="summary-card-title">
                  <span>📍</span>
                  <span>{getPageItemLabel(departmentSummaryCards, 'workforceLocations', 'Workforce Locations')}</span>
                </div>
                <div className="summary-card-content">
                  {/* Conic Gradient Donut for locations */}
                  <div 
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '50%',
                      background: `conic-gradient(
                        var(--pink-primary) 0% ${(workforceStats.riyadhCount / workforceStats.totalEmployees) * 100}%, 
                        var(--green) ${(workforceStats.riyadhCount / workforceStats.totalEmployees) * 100}% ${((workforceStats.riyadhCount + workforceStats.jeddahCount) / workforceStats.totalEmployees) * 100}%, 
                        var(--blue) ${((workforceStats.riyadhCount + workforceStats.jeddahCount) / workforceStats.totalEmployees) * 100}% 100%
                      )`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                      flexShrink: 0
                    }}
                  >
                    <div 
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-sidebar)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', fontFamily: 'var(--font-heading)' }}>
                        {workforceStats.totalEmployees}
                      </span>
                      <span style={{ fontSize: '7px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                        Staff
                      </span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="donut-legend">
                    <div className="donut-legend-item">
                      <span className="legend-label-wrapper">
                        <span className="legend-dot" style={{ backgroundColor: 'var(--pink-primary)' }}></span>
                        Riyadh
                      </span>
                      <span className="legend-value">{workforceStats.riyadhCount}</span>
                    </div>
                    <div className="donut-legend-item">
                      <span className="legend-label-wrapper">
                        <span className="legend-dot" style={{ backgroundColor: 'var(--green)' }}></span>
                        Jeddah
                      </span>
                      <span className="legend-value">{workforceStats.jeddahCount}</span>
                    </div>
                    <div className="donut-legend-item">
                      <span className="legend-label-wrapper">
                        <span className="legend-dot" style={{ backgroundColor: 'var(--blue)' }}></span>
                        Other (NEOM/etc)
                      </span>
                      <span className="legend-value">{workforceStats.otherCount}</span>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* CARD 3: SENIORITY PROFILE */}
              {isPageItemEnabled(departmentSummaryCards, 'seniorityMix') && (
              <div className="glass-card summary-card" style={{ minHeight: '210px', order: getPageItemOrder(departmentSummaryCards, 'seniorityMix') }}>
                <div className="summary-card-title">
                  <ShieldAlertIcon style={{ color: 'var(--pink-primary)' }} />
                  <span>{getPageItemLabel(departmentSummaryCards, 'seniorityMix', 'Seniority Mix Profile')}</span>
                </div>
                <div className="summary-card-content">
                  <div className="stacked-bar-container" style={{ gap: '18px' }}>
                    <div className="stacked-bar" style={{ height: '16px', borderRadius: '8px' }}>
                      <div 
                        className="stacked-segment" 
                        style={{ 
                          width: `${(workforceStats.seniorCount / workforceStats.totalEmployees) * 100}%`, 
                          backgroundColor: 'var(--red)' 
                        }}
                        title={`Leadership/Mgmt: ${workforceStats.seniorCount} staff`}
                      ></div>
                      <div 
                        className="stacked-segment" 
                        style={{ 
                          width: `${(workforceStats.midCount / workforceStats.totalEmployees) * 100}%`, 
                          backgroundColor: 'var(--pink-primary)' 
                        }}
                        title={`Specialists: ${workforceStats.midCount} staff`}
                      ></div>
                      <div 
                        className="stacked-segment" 
                        style={{ 
                          width: `${(workforceStats.entryCount / workforceStats.totalEmployees) * 100}%`, 
                          backgroundColor: 'var(--green)' 
                        }}
                        title={`Associates: ${workforceStats.entryCount} staff`}
                      ></div>
                    </div>

                    <div className="stacked-legend">
                      <div className="stacked-legend-item">
                        <span className="stacked-legend-label">
                          <span className="legend-dot" style={{ backgroundColor: 'var(--red)' }}></span>
                          Leadership
                        </span>
                        <span className="stacked-legend-val">{workforceStats.seniorCount}</span>
                      </div>
                      <div className="stacked-legend-item">
                        <span className="stacked-legend-label">
                          <span className="legend-dot" style={{ backgroundColor: 'var(--pink-primary)' }}></span>
                          Specialists
                        </span>
                        <span className="stacked-legend-val">{workforceStats.midCount}</span>
                      </div>
                      <div className="stacked-legend-item">
                        <span className="stacked-legend-label">
                          <span className="legend-dot" style={{ backgroundColor: 'var(--green)' }}></span>
                          Associates
                        </span>
                        <span className="stacked-legend-val">{workforceStats.entryCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {isPageItemEnabled(departmentSummaryCards, 'recentUpdates') && (
              <div className="glass-card summary-card" style={{ minHeight: '210px', order: getPageItemOrder(departmentSummaryCards, 'recentUpdates') }}>
                <div className="summary-card-title">
                  <ActivityIcon />
                  <span>{getPageItemLabel(departmentSummaryCards, 'recentUpdates', 'Recent Workforce Updates')}</span>
                </div>
                <div className="summary-card-content summary-recent-content">
                  {recentWorkforceUpdates.map((item) => (
                    <div className="summary-recent-item" key={`${item.badge}-${item.id}`}>
                      <div>
                        <span className="summary-recent-id">{item.id}</span>
                        <strong>{item.title}</strong>
                        <p>{item.meta}</p>
                      </div>
                      <span className="summary-recent-badge">{item.badge}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>

            <div className="filters-bar">
              <div className="search-input-wrapper">
                <SearchIcon />
                <input 
                  type="text" 
                  placeholder="Search department, director..." 
                  value={deptSearch} 
                  onChange={(e) => setDeptSearch(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    {departmentTableFields.filter((field) => field.enabled).map((field) => (
                      <th key={field.id}>{field.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDepts.map(d => {
                    // Match current data from projects and employees
                    const deptProjCount = projects.filter(p => p['Department ID'] === d['Department ID']).length;
                    const deptEmpCount = employees.filter(e => e['Department ID'] === d['Department ID']).length;

                    return (
                      <tr key={d['Department ID']}>
                        {departmentTableFields.filter((field) => field.enabled).map((field) => (
                          <td key={field.id}>{renderDepartmentFieldValue(d, field.id, deptProjCount, deptEmpCount)}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------- TAB 4: AUDIT TRAIL -------------------- */}
        {activeTab === 'activity' && (
          <div>
            <div className="filters-bar">
              <div className="search-input-wrapper">
                <SearchIcon />
                <input 
                  type="text" 
                  placeholder="Search log by employee, action, project..." 
                  value={activitySearch} 
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="search-input"
                />
              </div>

              <select 
                value={activityImpactFilter} 
                onChange={(e) => setActivityImpactFilter(e.target.value)}
                className="filter-select"
              >
                <option value="All">All Impact Levels</option>
                <option value="High">High Impact</option>
                <option value="Medium">Medium Impact</option>
                <option value="Low">Low Impact</option>
              </select>
            </div>

            <div className="timeline">
              {filteredActivities.slice(0, 100).map(l => {
                let impactClass = 'low';
                if (l.Impact === 'High') impactClass = 'high';
                if (l.Impact === 'Medium') impactClass = 'med';

                return (
                  <div key={l['Activity ID']} className="timeline-item">
                    <div className={`timeline-dot ${impactClass}`}></div>
                    
                    <div className="timeline-card">
                      <div className="timeline-info">
                        <div className="timeline-actor-row">
                          <span className="timeline-actor">{l.Employee}</span>
                          <span className="timeline-action">{l['Activity Type']}</span>
                          {l.Project && (
                            <span>
                              under <span className="timeline-target">{l.Project}</span>
                            </span>
                          )}
                        </div>
                        
                        <div className="timeline-meta-row">
                          <span className="timeline-time">{formatExcelDate(l.Timestamp)}</span>
                          <span>•</span>
                          <span>Dept: {l.Department}</span>
                          <span>•</span>
                          <span className="timeline-source-badge">via {l.Source}</span>
                        </div>
                      </div>

                      <span className={`badge ${l.Impact === 'High' ? 'red' : l.Impact === 'Medium' ? 'amber' : 'green'}`}>
                        {l.Impact} Impact
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredActivities.length > 100 && (
              <p style={{ color: 'var(--text-dark)', textAlign: 'center', marginTop: '24px', fontSize: '13px' }}>
                Showing first 100 of {filteredActivities.length} logs.
              </p>
            )}
          </div>
        )}

        {/* -------------------- TAB 5: INTEGRITY ALERTS -------------------- */}
        {activeTab === 'hygiene' && (
          <div>
            <div className="info-card">
              <InfoIcon />
              <div>
                <strong>Continuous Data Integrity Audit:</strong> This panel monitors structural inconsistencies 
                and logical contradictions between worksheets in the portfolio dataset. Discrepancies are highlighted 
                below to maintain database hygiene.
              </div>
            </div>

            {/* Resolved Section (Cleaned) */}
            <div className="glass-card" style={{ marginBottom: '24px' }}>
              <h3 className="block-title" style={{ color: 'var(--green)' }}><CheckCircleIcon /> Resolved Spreadsheet Inconsistencies</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                The following structural discrepancies have been automatically cleaned and aligned inside the source spreadsheet:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="clean-badge">
                  <CheckCircleIcon />
                  56 Task conflicts (where status was "Not Started" but completion progress was &gt;0%) successfully reset to 0%.
                </div>
                <div className="clean-badge">
                  <CheckCircleIcon />
                  Dashboard "Open Tasks" count formula (B7) updated to ignore blank rows (corrected value: 285).
                </div>
              </div>
            </div>

            {/* Unresolved Sections (Logical contradictions remaining - Option C choice) */}
            <div className="quality-grid">
              <div className="glass-card">
                <h3 className="block-title" style={{ color: 'var(--red)' }}><ShieldAlertIcon /> Project vs Task Inconsistencies</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
                  The projects below are marked <strong>"Completed"</strong> at the portfolio level, but still contain unfinished deliverables on the task sheets:
                </p>

                <div className="issue-list">
                  {hygieneIssues.map((issue, idx) => (
                    <div key={idx} className="issue-item">
                      <div className="issue-header">
                        <span className="issue-tag">{issue.type}</span>
                        <span className="badge red">{issue.status}</span>
                      </div>
                      <span className="issue-desc">{issue.project}</span>
                      <span className="issue-detail">{issue.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card">
                <h3 className="block-title" style={{ color: 'var(--amber)' }}><InfoIcon /> Metric Synchronization Gaps</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
                  A comparison between Projects reported progress and calculated average task completion percentages reveals substantial differences:
                </p>

                <div className="issue-list">
                  <div className="issue-item">
                    <div className="issue-header">
                      <span className="issue-tag">Progress Drift</span>
                      <span className="badge amber">Out of Sync</span>
                    </div>
                    <span className="issue-desc">Project P002 (Customer Mobile App Revamp)</span>
                    <span className="issue-detail">Portfolio reports 100% progress, but average completion of related tasks is 43% (57% deviation).</span>
                  </div>
                  <div className="issue-item">
                    <div className="issue-header">
                      <span className="issue-tag">Progress Drift</span>
                      <span className="badge amber">Out of Sync</span>
                    </div>
                    <span className="issue-desc">Project P011 (Executive KPI Cockpit)</span>
                    <span className="issue-detail">Portfolio reports 0% progress, but average completion of related tasks is 72% (-72% deviation).</span>
                  </div>
                  <div className="issue-item">
                    <div className="issue-header">
                      <span className="issue-tag">Progress Drift</span>
                      <span className="badge amber">Out of Sync</span>
                    </div>
                    <span className="issue-desc">Project P021 (Internal Knowledge Base)</span>
                    <span className="issue-detail">Portfolio reports 100% progress, but average completion of related tasks is 55% (45% deviation).</span>
                  </div>
                  <div className="issue-item">
                    <div className="issue-header">
                      <span className="issue-tag">Progress Drift</span>
                      <span className="badge amber">Out of Sync</span>
                    </div>
                    <span className="issue-desc">Project P003 (ERP Finance Automation)</span>
                    <span className="issue-detail">Portfolio reports 8% progress, but average completion of related tasks is 57% (-49% deviation).</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- TAB 6: FULLSCREEN CHATBOT -------------------- */}
        {activeTab === 'chatbot' && (
          <Chatbot initialQuery={initialChatQuery} clearInitialQuery={() => setInitialChatQuery('')} />
        )}

      </main>

      {/* Backdrop Overlay */}
      <div 
        className={`chat-backdrop ${isChatOpen ? 'open' : ''}`} 
        onClick={() => setIsChatOpen(false)}
      />

      {/* Slide-out Drawer */}
      <div className={`chat-drawer ${isChatOpen ? 'open' : ''}`}>
        <div className="chat-drawer-header">
          <div className="chat-drawer-title">
            <SparklesIcon className="drawer-logo-icon" />
            <span>PROJEX AI Intelligence</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="chat-drawer-maximize" 
              onClick={() => {
                handleTabRequest('chatbot');
                setIsChatOpen(false);
              }}
              title="Open full screen"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'color 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
            <button className="chat-drawer-close" onClick={() => setIsChatOpen(false)}>×</button>
          </div>
        </div>
        <div className="chat-drawer-body">
          <Chatbot initialQuery={initialChatQuery} clearInitialQuery={() => setInitialChatQuery('')} />
        </div>
      </div>

      <AuthModal
        isOpen={authOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        onClose={() => {
          setAuthOpen(false);
          setRequestedTab(null);
          setResetEmail('');
        }}
        onAuthenticated={handleAuthSuccess}
        requestedLabel={requestedTab ? TAB_LABELS[requestedTab] : ''}
        resetEmail={resetEmail}
      />
    </div>
  );
}

export default App;
