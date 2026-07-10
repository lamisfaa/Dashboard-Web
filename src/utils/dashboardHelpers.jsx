/* eslint-disable react-refresh/only-export-components */
// Utility helper functions
export const formatExcelDate = (serial) => {
  if (!serial || isNaN(serial)) return 'N/A';
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date = new Date(utc_value * 1000);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const parseDateLikeValue = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (!isNaN(value)) {
    const serial = Number(value);
    if (serial <= 0 || serial > 2958465) return null;
    const utcDays = Math.floor(serial - 25569);
    return new Date(utcDays * 86400 * 1000);
  }

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const toDateInputValue = (value) => {
  const date = parseDateLikeValue(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
};

export const dateInputToExcelSerial = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (isNaN(date.getTime())) return '';
  return Math.round(date.getTime() / 86400000 + 25569);
};

export const formatAdminCellValue = (column, value) => {
  if (ADMIN_DATE_COLUMNS.has(column)) {
    const date = parseDateLikeValue(value);
    if (date) {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }

  return normalizeCellValue(value);
};

export const formatSAR = (value) => {
  if (value === undefined || value === null) return '0 SAR';
  return Number(value).toLocaleString('en-US') + ' SAR';
};

export const PROTECTED_TABS = new Set(['profile', 'projects', 'departments', 'activity', 'hygiene', 'chatbot', 'admin']);

export const TAB_LABELS = {
  overview: 'Overview',
  profile: 'Profile',
  admin: 'Admin Control',
  projects: 'Portfolio Grid',
  departments: 'Workforces',
  activity: 'Audit Trail',
  hygiene: 'Integrity Alerts',
  chatbot: 'PROJEX AI Chat'
};

export const ADMIN_TABLES = [
  'Projects',
  'Departments',
  'Employees',
  'Tasks',
  'Meetings',
  'Weekly Updates',
  'Activity Log',
  'Dashboard',
  'Lists',
  'Page Settings'
];

export const PAGE_EDITOR_PAGES = [
  { value: 'overview', label: 'Overview' },
  { value: 'projects', label: 'Portfolio Grid' },
  { value: 'departments', label: 'Workforces' },
  { value: 'activity', label: 'Activity Trail', disabled: true }
];

export const DEFAULT_OVERVIEW_HEADER = {
  title: 'Executive Portfolio Overview',
  subtitle: 'Portfolio KPIs, budget spent, and organization status.'
};

export const DEFAULT_OVERVIEW_WIDGETS = [
  { id: 'departments', type: 'builtin-kpi', label: 'Departments', enabled: true, order: 1 },
  { id: 'projects', type: 'builtin-kpi', label: 'Projects', enabled: true, order: 2 },
  { id: 'openTasks', type: 'builtin-kpi', label: 'Open Tasks', enabled: true, order: 3 },
  { id: 'budgetUsed', type: 'builtin-kpi', label: 'Budget Used', enabled: true, order: 4 },
  { id: 'aiChatbot', type: 'builtin-kpi', label: 'AI Chatbot', enabled: true, order: 5 }
];

export const PAGE_EDITABLE_DEFAULTS = {
  projects: {
    header: {
      title: 'Project Portfolio Grid',
      subtitle: 'Explore all active and planned projects.'
    },
    cards: [
      { id: 'statusDistribution', label: 'Project Status Distribution', enabled: true, order: 1 },
      { id: 'financialHealth', label: 'Financial Health (Budget vs Spend)', enabled: true, order: 2 },
      { id: 'riskProfile', label: 'Portfolio Risk Profile', enabled: true, order: 3 },
      { id: 'recentUpdates', label: 'Recent Portfolio Updates', enabled: true, order: 4 }
    ],
    options: {
      defaultStatus: 'All'
    },
    fields: [
      { id: 'department', label: 'Department', enabled: true, order: 1 },
      { id: 'risk', label: 'Risk Level', enabled: true, order: 2 },
      { id: 'budget', label: 'Budget', enabled: true, order: 3 },
      { id: 'theme', label: 'Strategic Theme', enabled: true, order: 4 },
      { id: 'progress', label: 'Project Completion', enabled: true, order: 5 },
      { id: 'owner', label: 'Owner', enabled: true, order: 6 },
      { id: 'dueDate', label: 'Due Date', enabled: true, order: 7 }
    ]
  },
  departments: {
    header: {
      title: 'Department Directory & Workforces',
      subtitle: 'View the headcount distribution and organizational scope.'
    },
    cards: [
      { id: 'departmentStaffing', label: 'Department staffing (Top 4)', enabled: true, order: 1 },
      { id: 'workforceLocations', label: 'Workforce Locations', enabled: true, order: 2 },
      { id: 'seniorityMix', label: 'Seniority Mix Profile', enabled: true, order: 3 },
      { id: 'recentUpdates', label: 'Recent Workforce Updates', enabled: true, order: 4 }
    ],
    options: {},
    fields: [
      { id: 'departmentId', label: 'Dept ID', enabled: true, order: 1 },
      { id: 'departmentName', label: 'Department Name', enabled: true, order: 2 },
      { id: 'director', label: 'Director', enabled: true, order: 3 },
      { id: 'location', label: 'Location', enabled: true, order: 4 },
      { id: 'staffCount', label: 'Staff Count', enabled: true, order: 5 },
      { id: 'allocatedBudget', label: 'Allocated Budget', enabled: true, order: 6 },
      { id: 'projectCount', label: 'Project Count', enabled: true, order: 7 }
    ]
  }
};

export const PROJECT_STATUS_OPTIONS = ['All', 'In Progress', 'Completed', 'Planning', 'At Risk', 'On Hold', 'Not Started'];

export const ADMIN_DATE_COLUMNS = new Set([
  'Start Date',
  'Target End Date',
  'Due Date',
  'Week Starting',
  'Hire Date'
]);

export const getTableColumns = (rows) => {
  const columns = [];
  rows.forEach((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return;
    Object.keys(row).forEach((key) => {
      if (!columns.includes(key)) columns.push(key);
    });
  });
  return columns;
};

export const normalizeCellValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const ADMIN_PRIMARY_KEYS = {
  Projects: 'Project ID',
  Departments: 'Department ID',
  Employees: 'Employee ID',
  Tasks: 'Task ID',
  Meetings: 'Meeting ID',
  'Weekly Updates': 'Update ID',
  'Activity Log': 'Activity ID'
};

export const ADMIN_LIST_COLUMN_MAP = {
  Status: 'Statuses',
  Priority: 'Priorities',
  'Risk Level': 'Risk Levels',
  Health: 'Health',
  'Meeting Type': 'Meeting Types'
};

export const collectOptions = (rows, column) => {
  const values = new Set();
  rows.forEach((row) => {
    const value = row?.[column];
    if (value !== null && value !== undefined && String(value).trim()) {
      values.add(String(value));
    }
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

export const getListOptions = (data, listColumn) => collectOptions(data.Lists || [], listColumn);

export const getAdminFieldOptions = (column, selectedTable, data) => {
  if (ADMIN_PRIMARY_KEYS[selectedTable] === column) return [];

  if (ADMIN_LIST_COLUMN_MAP[column]) {
    return getListOptions(data, ADMIN_LIST_COLUMN_MAP[column]);
  }

  if (column === 'Department ID') return collectOptions(data.Departments || [], 'Department ID');
  if (column === 'Department') return collectOptions(data.Departments || [], 'Department Name');
  if (column === 'Project ID') return collectOptions(data.Projects || [], 'Project ID');
  if (column === 'Project') return collectOptions(data.Projects || [], 'Project Name');
  if (['Employee ID', 'Owner ID', 'Assigned To ID', 'Organizer ID'].includes(column)) {
    return collectOptions(data.Employees || [], 'Employee ID');
  }
  if (['Employee', 'Owner', 'Assigned To', 'Organizer', 'Director', 'Manager'].includes(column)) {
    return collectOptions(data.Employees || [], 'Employee Name');
  }

  const existingOptions = collectOptions(data[selectedTable] || [], column);
  const dropdownColumns = new Set([
    'Location',
    'Location/Channel',
    'Employment Status',
    'Level',
    'Division',
    'Impact',
    'Source',
    'Activity Type',
    'Strategic Theme'
  ]);

  if (dropdownColumns.has(column) || existingOptions.length <= 8) {
    return existingOptions;
  }

  return [];
};

export const normalizeLookupValue = (value) => String(value ?? '').trim().toLowerCase();

export const findRowByColumn = (rows, column, value) => {
  const normalizedValue = normalizeLookupValue(value);
  if (!normalizedValue) return null;
  return rows.find((row) => normalizeLookupValue(row?.[column]) === normalizedValue) || null;
};

export const setLinkedValue = (row, column, value) => {
  if (Object.prototype.hasOwnProperty.call(row, column) && value !== undefined && value !== null) {
    row[column] = value;
  }
};

export const applyDepartmentLink = (row, department) => {
  if (!department) return;
  setLinkedValue(row, 'Department ID', department['Department ID']);
  setLinkedValue(row, 'Department', department['Department Name']);
  setLinkedValue(row, 'Location', department.Location);
};

export const applyProjectLink = (row, project) => {
  if (!project) return;
  setLinkedValue(row, 'Project ID', project['Project ID']);
  setLinkedValue(row, 'Project', project['Project Name']);
  setLinkedValue(row, 'Department ID', project['Department ID']);
  setLinkedValue(row, 'Department', project.Department);
};

export const applyEmployeeLink = (row, employee, idColumn, nameColumn, includeOrgContext = false) => {
  if (!employee) return;
  setLinkedValue(row, idColumn, employee['Employee ID']);
  setLinkedValue(row, nameColumn, employee['Employee Name']);
  setLinkedValue(row, 'Employee Name', employee['Employee Name']);
  if (includeOrgContext) {
    setLinkedValue(row, 'Department ID', employee['Department ID']);
    setLinkedValue(row, 'Department', employee.Department);
    setLinkedValue(row, 'Location', employee.Location);
  }
};

export const EMPLOYEE_ID_TO_NAME_COLUMN = {
  'Employee ID': 'Employee',
  'Owner ID': 'Owner',
  'Assigned To ID': 'Assigned To',
  'Organizer ID': 'Organizer'
};

export const EMPLOYEE_NAME_TO_ID_COLUMN = {
  Employee: 'Employee ID',
  Owner: 'Owner ID',
  'Assigned To': 'Assigned To ID',
  Organizer: 'Organizer ID'
};

export const applyAdminRowAutomation = (row, changedColumn, changedValue, data) => {
  const nextRow = { ...row, [changedColumn]: changedValue };

  if (changedColumn === 'Department ID') {
    applyDepartmentLink(nextRow, findRowByColumn(data.Departments || [], 'Department ID', changedValue));
  }

  if (changedColumn === 'Department') {
    applyDepartmentLink(nextRow, findRowByColumn(data.Departments || [], 'Department Name', changedValue));
  }

  if (changedColumn === 'Project ID') {
    applyProjectLink(nextRow, findRowByColumn(data.Projects || [], 'Project ID', changedValue));
  }

  if (changedColumn === 'Project') {
    applyProjectLink(nextRow, findRowByColumn(data.Projects || [], 'Project Name', changedValue));
  }

  if (changedColumn === 'Employee ID' && Object.prototype.hasOwnProperty.call(nextRow, 'Employee Name')) {
    applyEmployeeLink(
      nextRow,
      findRowByColumn(data.Employees || [], 'Employee ID', changedValue),
      'Employee ID',
      'Employee Name',
      true
    );
  } else if (EMPLOYEE_ID_TO_NAME_COLUMN[changedColumn]) {
    applyEmployeeLink(
      nextRow,
      findRowByColumn(data.Employees || [], 'Employee ID', changedValue),
      changedColumn,
      EMPLOYEE_ID_TO_NAME_COLUMN[changedColumn],
      changedColumn === 'Employee ID'
    );
  }

  if (changedColumn === 'Employee Name') {
    applyEmployeeLink(
      nextRow,
      findRowByColumn(data.Employees || [], 'Employee Name', changedValue),
      'Employee ID',
      'Employee Name',
      true
    );
  } else if (EMPLOYEE_NAME_TO_ID_COLUMN[changedColumn]) {
    applyEmployeeLink(
      nextRow,
      findRowByColumn(data.Employees || [], 'Employee Name', changedValue),
      EMPLOYEE_NAME_TO_ID_COLUMN[changedColumn],
      changedColumn,
      changedColumn === 'Employee'
    );
  }

  return nextRow;
};

export const buildEmptyAdminRow = (columns, selectedTable, rows) => {
  const row = columns.reduce((nextRow, column) => ({ ...nextRow, [column]: '' }), {});
  const primaryKey = ADMIN_PRIMARY_KEYS[selectedTable];
  if (!primaryKey || !columns.includes(primaryKey)) return row;

  const existingIds = collectOptions(rows, primaryKey);
  const prefix = existingIds[0]?.match(/^[A-Za-z]+/)?.[0] || '';
  const maxNumber = existingIds.reduce((max, value) => {
    const number = Number(String(value).match(/\d+$/)?.[0] || 0);
    return Math.max(max, number);
  }, 0);
  const width = existingIds[0]?.match(/\d+$/)?.[0]?.length || 3;
  row[primaryKey] = `${prefix}${String(maxNumber + 1).padStart(width, '0')}`;
  return row;
};

export const STATUS_ORDER = ['In Progress', 'Completed', 'At Risk', 'Planning', 'On Hold', 'Not Started'];
export const TASK_STATUS_ORDER = ['Completed', 'In Progress', 'Blocked', 'Backlog', 'Not Started'];
export const HEALTH_ORDER = ['Green', 'Amber', 'Red'];
export const RISK_ORDER = ['High', 'Medium', 'Low'];

export const STATUS_COLOR_CLASS = {
  Completed: 'green',
  'In Progress': 'pink',
  'At Risk': 'red',
  'On Hold': 'amber',
  Planning: 'blue',
  'Not Started': 'blue',
  Blocked: 'red',
  Backlog: 'amber',
  Green: 'green',
  Amber: 'amber',
  Red: 'red',
  High: 'red',
  Medium: 'amber',
  Low: 'green'
};

export const CHART_COLOR_VAR = {
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  blue: 'var(--blue)',
  pink: 'var(--pink-primary)'
};

export const countBy = (items, getter, order = []) => {
  const counts = {};
  items.forEach((item) => {
    const key = getter(item) || 'Unassigned';
    counts[key] = (counts[key] || 0) + 1;
  });

  const ordered = order
    .filter((key) => counts[key] !== undefined)
    .map((key) => ({ label: key, count: counts[key] }));

  const rest = Object.entries(counts)
    .filter(([key]) => !order.includes(key))
    .map(([label, count]) => ({ label, count }));

  return [...ordered, ...rest];
};

export const sumBy = (items, getter) => items.reduce((sum, item) => sum + Number(getter(item) || 0), 0);

export const normalizeMatchText = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const getTextAcronym = (value) => normalizeMatchText(value)
  .split(' ')
  .filter(Boolean)
  .map((word) => word[0])
  .join('');

export const matchesWidgetFilter = (cellValue, filterValue) => {
  const cellText = normalizeMatchText(cellValue);
  const filterText = normalizeMatchText(filterValue);

  if (!filterText) return true;
  if (cellText === filterText) return true;
  if (getTextAcronym(cellValue) === filterText) return true;
  if (cellText.includes(filterText) || filterText.includes(cellText)) return true;

  const filterTokens = filterText.split(' ').filter(Boolean);
  return filterTokens.length > 0 && filterTokens.every((token) => (
    cellText.split(' ').some((word) => word.startsWith(token))
  ));
};

export const filterRowsForWidget = (rows, filterField, filterValue) => {
  if (!filterField || !filterValue) return rows;
  return rows.filter((row) => matchesWidgetFilter(row?.[filterField], filterValue));
};

export const computeCustomWidgetValue = (widget, data) => {
  const rows = Array.isArray(data[widget.sourceTable]) ? data[widget.sourceTable] : [];
  const filteredRows = filterRowsForWidget(rows, widget.filterField, widget.filterValue);

  if (widget.metric === 'sum') {
    return formatSAR(sumBy(filteredRows, (row) => row[widget.field]));
  }

  if (widget.metric === 'average') {
    if (!filteredRows.length) return '0';
    const average = sumBy(filteredRows, (row) => row[widget.field]) / filteredRows.length;
    return Number.isInteger(average) ? String(average) : average.toFixed(1);
  }

  return String(filteredRows.length);
};

export const GRAPH_COLOR_SEQUENCE = [
  'var(--pink-primary)',
  'var(--blue)',
  'var(--green)',
  'var(--amber)',
  'var(--red)',
  'var(--text-dark)'
];

export const getGraphGroupField = (card, rows) => {
  if (card.groupField) return card.groupField;
  if (!rows.length) return '';

  const preferredFields = ['Status', 'Risk Level', 'Priority', 'Department', 'Department Name', 'Location', 'Health', 'Level', 'Type'];
  const rowColumns = Object.keys(rows[0] || {});
  return preferredFields.find((field) => rowColumns.includes(field)) || rowColumns[0] || '';
};

export const getCustomGraphSeries = (card, data) => {
  const rows = Array.isArray(data[card.sourceTable]) ? data[card.sourceTable] : [];
  const filteredRows = filterRowsForWidget(rows, card.filterField, card.filterValue);
  const groupField = getGraphGroupField(card, filteredRows);

  if (!groupField) {
    return { groupField: '', series: [], total: 0 };
  }

  const groupedRows = new Map();
  filteredRows.forEach((row) => {
    const key = String(row?.[groupField] ?? 'Unassigned').trim() || 'Unassigned';
    const bucket = groupedRows.get(key) || [];
    bucket.push(row);
    groupedRows.set(key, bucket);
  });

  const series = Array.from(groupedRows.entries()).map(([label, groupRows]) => {
    let value = 0;
    if (card.metric === 'sum') {
      value = sumBy(groupRows, (row) => row[card.field]);
    } else if (card.metric === 'average') {
      value = groupRows.length ? sumBy(groupRows, (row) => row[card.field]) / groupRows.length : 0;
    } else {
      value = groupRows.length;
    }

    return { label, value: Number(value) || 0 };
  }).sort((a, b) => b.value - a.value);

  return {
    groupField,
    series,
    total: series.reduce((sum, item) => sum + item.value, 0)
  };
};

export const renderCustomGraphVisualization = (card, data) => {
  const { series, total } = getCustomGraphSeries(card, data);
  const graphType = card.graphType || 'bar';

  if (!series.length) {
    return (
      <div className="project-graph-empty">
        Select a group field and filters to build this chart.
      </div>
    );
  }

  if (graphType === 'donut') {
    let cursor = 0;
    const gradientParts = series.map((item, index) => {
      const start = cursor;
      const pct = total > 0 ? (item.value / total) * 100 : 0;
      const end = cursor + pct;
      cursor = end;
      const color = GRAPH_COLOR_SEQUENCE[index % GRAPH_COLOR_SEQUENCE.length];
      return `${color} ${start}% ${end}%`;
    });

    return (
      <div className="project-graph-shell">
        <div className="project-graph-donut" style={{ background: `conic-gradient(${gradientParts.join(', ')})` }}>
          <div>
            <strong>{Math.round(total)}</strong>
            <span>{card.groupField || 'Groups'}</span>
          </div>
        </div>
        <div className="project-graph-legend">
          {series.slice(0, 6).map((item, index) => (
            <div className="project-graph-legend-row" key={item.label}>
              <span className="legend-label-wrapper">
                <span className="legend-dot" style={{ backgroundColor: GRAPH_COLOR_SEQUENCE[index % GRAPH_COLOR_SEQUENCE.length] }}></span>
                {item.label}
              </span>
              <strong>{Number.isInteger(item.value) ? item.value : item.value.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (graphType === 'stacked') {
    const maxValue = Math.max(...series.map((item) => item.value), 1);
    return (
      <div className="project-graph-shell">
        <div className="project-stacked-bar">
          {series.slice(0, 6).map((item, index) => (
            <div
              key={item.label}
              className="project-stacked-segment"
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: GRAPH_COLOR_SEQUENCE[index % GRAPH_COLOR_SEQUENCE.length]
              }}
              title={`${item.label}: ${item.value}`}
            />
          ))}
        </div>
        <div className="project-graph-legend">
          {series.slice(0, 6).map((item, index) => (
            <div className="project-graph-legend-row" key={item.label}>
              <span className="legend-label-wrapper">
                <span className="legend-dot" style={{ backgroundColor: GRAPH_COLOR_SEQUENCE[index % GRAPH_COLOR_SEQUENCE.length] }}></span>
                {item.label}
              </span>
              <strong>{Number.isInteger(item.value) ? item.value : item.value.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (graphType === 'line') {
    const width = 320;
    const height = 150;
    const maxValue = Math.max(...series.map((item) => item.value), 1);
    const points = series.map((item, index) => {
      const x = series.length > 1 ? 20 + (index * ((width - 40) / (series.length - 1))) : width / 2;
      const y = height - 18 - ((item.value / maxValue) * (height - 36));
      return { ...item, x, y };
    });
    const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');

    return (
      <div className="project-graph-shell">
        <svg viewBox={`0 0 ${width} ${height}`} className="project-graph-svg" role="img" aria-label={card.label}>
          <line x1="20" y1={height - 20} x2={width - 20} y2={height - 20} className="chart-axis" />
          <line x1="20" y1="18" x2="20" y2={height - 20} className="chart-axis" />
          <polyline points={linePoints} className="chart-line" />
          {points.map((point, index) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="4" className="chart-point" />
              {index < 4 && (
                <text x={point.x} y={height - 4} textAnchor="middle" className="chart-label">
                  {point.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    );
  }

  const width = 320;
  const height = 160;
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const barWidth = Math.max((width - 40) / Math.max(series.length, 1) - 10, 18);
  return (
    <div className="project-graph-shell">
      <svg viewBox={`0 0 ${width} ${height}`} className="project-graph-svg" role="img" aria-label={card.label}>
        <line x1="20" y1={height - 20} x2={width - 20} y2={height - 20} className="chart-axis" />
        <line x1="20" y1="18" x2="20" y2={height - 20} className="chart-axis" />
        {series.slice(0, 5).map((item, index) => {
          const x = 28 + index * (barWidth + 10);
          const barHeight = ((item.value / maxValue) * (height - 48)) || 0;
          return (
            <g key={item.label}>
              <rect
                x={x}
                y={height - 20 - barHeight}
                width={barWidth}
                height={Math.max(barHeight, 4)}
                rx="4"
                fill={GRAPH_COLOR_SEQUENCE[index % GRAPH_COLOR_SEQUENCE.length]}
              />
              <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" className="chart-label">
                {item.label}
              </text>
              <text x={x + barWidth / 2} y={height - 24 - barHeight} textAnchor="middle" className="chart-label">
                {Number.isInteger(item.value) ? item.value : item.value.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const getBuiltinOverviewKpi = (widget, summary) => {
  const label = widget.label;
  if (widget.id === 'departments') {
    return {
      label,
      value: summary.departments.length,
      note: `${summary.employees.length} employees`
    };
  }
  if (widget.id === 'projects') {
    return {
      label,
      value: summary.projects.length,
      note: `${summary.avgProgress.toFixed(1)}% average progress`,
      accent: true
    };
  }
  if (widget.id === 'openTasks') {
    return {
      label,
      value: summary.openTasks,
      note: `${summary.blockedTasks} blocked`
    };
  }
  if (widget.id === 'budgetUsed') {
    return {
      label,
      value: `${summary.budgetUtilization.toFixed(1)}%`,
      note: `${formatSAR(summary.totalSpend)} spent of annual budget`
    };
  }
  if (widget.id === 'aiChatbot') {
    return {
      label,
      value: 'Ask Projex AI',
      note: 'Query the same dataset',
      ai: true
    };
  }

  return null;
};

export const getIdNumber = (value) => Number(String(value || '').match(/\d+$/)?.[0] || 0);

export const normalizeSettingBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

export const buildDefaultOverviewSettings = () => ([
  {
    Page: 'overview',
    Type: 'header',
    Key: 'title',
    Value: DEFAULT_OVERVIEW_HEADER.title
  },
  {
    Page: 'overview',
    Type: 'header',
    Key: 'subtitle',
    Value: DEFAULT_OVERVIEW_HEADER.subtitle
  },
  ...DEFAULT_OVERVIEW_WIDGETS.map((widget) => ({
    Page: 'overview',
    Type: widget.type,
    'Widget ID': widget.id,
    Label: widget.label,
    Enabled: String(widget.enabled),
    'Sort Order': widget.order,
    Metric: '',
    'Source Table': '',
    Field: '',
    'Filter Field': '',
    'Filter Value': '',
    Note: ''
  }))
]);

export const getOverviewSettingsRows = (data) => {
  const rows = data['Page Settings'];
  return Array.isArray(rows) && rows.some((row) => row?.Page === 'overview')
    ? rows
    : buildDefaultOverviewSettings();
};

export const getOverviewHeaderConfig = (settingsRows) => {
  const overviewRows = settingsRows.filter((row) => row?.Page === 'overview' && row?.Type === 'header');
  return {
    title: overviewRows.find((row) => row.Key === 'title')?.Value || DEFAULT_OVERVIEW_HEADER.title,
    subtitle: overviewRows.find((row) => row.Key === 'subtitle')?.Value || DEFAULT_OVERVIEW_HEADER.subtitle
  };
};

export const getOverviewWidgetRows = (settingsRows) => (
  settingsRows
    .filter((row) => row?.Page === 'overview' && ['builtin-kpi', 'custom-kpi'].includes(row.Type))
    .map((row, index) => ({
      id: row['Widget ID'] || `widget-${index}`,
      type: row.Type,
      label: row.Label || 'Untitled',
      enabled: normalizeSettingBool(row.Enabled, true),
      order: Number(row['Sort Order'] || index + 1),
      sourceTable: row['Source Table'] || '',
      metric: row.Metric || '',
      field: row.Field || '',
      filterField: row['Filter Field'] || '',
      filterValue: row['Filter Value'] || '',
      note: row.Note || ''
    }))
    .sort((a, b) => a.order - b.order)
);

export const settingsRowsFromOverviewConfig = (header, widgets) => ([
  {
    Page: 'overview',
    Type: 'header',
    Key: 'title',
    Value: header.title
  },
  {
    Page: 'overview',
    Type: 'header',
    Key: 'subtitle',
    Value: header.subtitle
  },
  ...widgets.map((widget, index) => ({
    Page: 'overview',
    Type: widget.type,
    'Widget ID': widget.id,
    Label: widget.label,
    Enabled: String(Boolean(widget.enabled)),
    'Sort Order': index + 1,
    'Source Table': widget.sourceTable || '',
    Metric: widget.metric || '',
    Field: widget.field || '',
    'Filter Field': widget.filterField || '',
    'Filter Value': widget.filterValue || '',
    Note: widget.note || ''
  }))
]);

export const buildDefaultPageSettings = (page) => {
  const defaults = PAGE_EDITABLE_DEFAULTS[page];
  if (!defaults) return [];

  return [
    {
      Page: page,
      Type: 'header',
      Key: 'title',
      Value: defaults.header.title
    },
    {
      Page: page,
      Type: 'header',
      Key: 'subtitle',
      Value: defaults.header.subtitle
    },
    ...defaults.cards.map((card) => ({
      Page: page,
      Type: 'summary-card',
      'Widget ID': card.id,
      Label: card.label,
      Enabled: String(card.enabled),
      'Sort Order': card.order,
      Value: '',
      Note: '',
      'Source Table': '',
      Metric: '',
      Field: '',
      'Filter Field': '',
      'Filter Value': '',
      'Graph Type': '',
      'Group Field': ''
    })),
    ...Object.entries(defaults.options).map(([key, value]) => ({
      Page: page,
      Type: 'option',
      Key: key,
      Value: value
    })),
    ...defaults.fields.map((field) => ({
      Page: page,
      Type: 'field',
      'Widget ID': field.id,
      Label: field.label,
      Enabled: String(field.enabled),
      'Sort Order': field.order
    }))
  ];
};

export const getEditablePageSettingsRows = (data, page) => {
  const rows = data['Page Settings'];
  return Array.isArray(rows) && rows.some((row) => row?.Page === page)
    ? rows
    : buildDefaultPageSettings(page);
};

export const getEditablePageHeaderConfig = (settingsRows, page) => {
  const defaults = PAGE_EDITABLE_DEFAULTS[page]?.header || { title: TAB_LABELS[page] || '', subtitle: '' };
  const headerRows = settingsRows.filter((row) => row?.Page === page && row?.Type === 'header');
  return {
    title: headerRows.find((row) => row.Key === 'title')?.Value || defaults.title,
    subtitle: headerRows.find((row) => row.Key === 'subtitle')?.Value || defaults.subtitle
  };
};

export const getEditablePageCardRows = (settingsRows, page) => {
  const defaultCards = PAGE_EDITABLE_DEFAULTS[page]?.cards || [];
  const rows = settingsRows.filter((row) => row?.Page === page && ['summary-card', 'custom-graph'].includes(row?.Type));
  const mergedCards = defaultCards.map((card, index) => {
    const saved = rows.find((row) => row['Widget ID'] === card.id);
    return {
      id: card.id,
      type: saved?.Type || 'summary-card',
      label: saved?.Label || card.label,
      enabled: normalizeSettingBool(saved?.Enabled, card.enabled),
      order: Number(saved?.['Sort Order'] || card.order || index + 1)
    };
  });

  rows
    .filter((row) => row?.Type === 'custom-graph' && row['Widget ID'])
    .forEach((row, index) => {
      mergedCards.push({
        id: row['Widget ID'],
        type: 'custom-graph',
        label: row.Label || 'Untitled graph',
        enabled: normalizeSettingBool(row.Enabled, true),
        order: Number(row['Sort Order'] || defaultCards.length + index + 1),
        sourceTable: row['Source Table'] || '',
        metric: row.Metric || 'count',
        field: row.Field || '',
        filterField: row['Filter Field'] || '',
        filterValue: row['Filter Value'] || '',
        graphType: row['Graph Type'] || 'bar',
        groupField: row['Group Field'] || '',
        note: row.Note || ''
      });
    });

  return mergedCards.sort((a, b) => a.order - b.order);
};

export const getEditablePageOptions = (settingsRows, page) => {
  const defaults = PAGE_EDITABLE_DEFAULTS[page]?.options || {};
  const optionRows = settingsRows.filter((row) => row?.Page === page && row?.Type === 'option');
  return {
    ...defaults,
    ...Object.fromEntries(optionRows.map((row) => [row.Key, row.Value]))
  };
};

export const getEditablePageFieldRows = (settingsRows, page) => {
  const defaultFields = PAGE_EDITABLE_DEFAULTS[page]?.fields || [];
  const rows = settingsRows.filter((row) => row?.Page === page && row?.Type === 'field');
  const mergedFields = defaultFields.map((field, index) => {
    const saved = rows.find((row) => row['Widget ID'] === field.id);
    return {
      id: field.id,
      label: saved?.Label || field.label,
      enabled: normalizeSettingBool(saved?.Enabled, field.enabled),
      order: Number(saved?.['Sort Order'] || field.order || index + 1)
    };
  });

  return mergedFields.sort((a, b) => a.order - b.order);
};

export const settingsRowsFromEditablePageConfig = (page, header, cards, options, fields) => [
  {
    Page: page,
    Type: 'header',
    Key: 'title',
    Value: header.title
  },
  {
    Page: page,
    Type: 'header',
    Key: 'subtitle',
    Value: header.subtitle
  },
  ...cards.map((card, index) => ({
    Page: page,
    Type: card.type || 'summary-card',
    'Widget ID': card.id,
    Label: card.label,
    Enabled: String(Boolean(card.enabled)),
    'Sort Order': index + 1,
    Value: '',
    Note: card.note || '',
    'Source Table': card.sourceTable || '',
    Metric: card.metric || '',
    Field: card.field || '',
    'Filter Field': card.filterField || '',
    'Filter Value': card.filterValue || '',
    'Graph Type': card.graphType || '',
    'Group Field': card.groupField || ''
  })),
  ...Object.entries(options || {}).map(([key, value]) => ({
    Page: page,
    Type: 'option',
    Key: key,
    Value: value
  })),
  ...fields.map((field, index) => ({
    Page: page,
    Type: 'field',
    'Widget ID': field.id,
    Label: field.label,
    Enabled: String(Boolean(field.enabled)),
    'Sort Order': index + 1
  }))
];

export const getPageItem = (items, id) => items.find((item) => item.id === id);
export const isPageItemEnabled = (items, id) => getPageItem(items, id)?.enabled !== false;
export const getPageItemLabel = (items, id, fallback) => getPageItem(items, id)?.label || fallback;
export const getPageItemOrder = (items, id) => getPageItem(items, id)?.order || 99;
export const getEnabledFieldIds = (fields) => new Set(fields.filter((field) => field.enabled).map((field) => field.id));

export const renderDepartmentFieldValue = (department, fieldId, deptProjCount, deptEmpCount) => {
  if (fieldId === 'departmentId') {
    return <span className="project-id-badge">{department['Department ID']}</span>;
  }
  if (fieldId === 'departmentName') {
    return <span style={{ fontWeight: '600' }}>{department['Department Name']}</span>;
  }
  if (fieldId === 'director') return department.Director;
  if (fieldId === 'location') return department.Location;
  if (fieldId === 'staffCount') return `${deptEmpCount} employees`;
  if (fieldId === 'allocatedBudget') return formatSAR(department['Annual Budget SAR']);
  if (fieldId === 'projectCount') {
    return (
      <span className={`badge ${deptProjCount > 0 ? 'pink' : 'blue'}`}>
        {deptProjCount} active projects
      </span>
    );
  }
  return '';
};

export const getInitials = (name = '') => {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

  return initials || 'U';
};

export const cloneAdminRows = (rows) => rows.map((row) => ({ ...row }));

export const ADMIN_ACTIVITY_KEY = 'projex-admin-recent-activity';

export const readAdminActivity = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_ACTIVITY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const buildDonutGradient = (items, total) => {
  if (!total) return 'conic-gradient(var(--border-color) 0% 100%)';

  let cursor = 0;
  const segments = items.map(({ label, count }) => {
    const start = cursor;
    const end = cursor + (count / total) * 100;
    cursor = end;
    const color = CHART_COLOR_VAR[STATUS_COLOR_CLASS[label]] || 'var(--pink-primary)';
    return `${color} ${start}% ${end}%`;
  });

  return `conic-gradient(${segments.join(', ')})`;
};
