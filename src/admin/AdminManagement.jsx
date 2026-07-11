import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, parseApiError } from '../api';
import { useAuth } from '../auth/useAuth';
import {
  toDateInputValue,
  dateInputToExcelSerial,
  formatAdminCellValue,
  ADMIN_TABLES,
  ADMIN_DATE_COLUMNS,
  getTableColumns,
  normalizeCellValue,
  ADMIN_PRIMARY_KEYS,
  getAdminFieldOptions,
  applyAdminRowAutomation,
  buildEmptyAdminRow,
  cloneAdminRows
} from '../utils/dashboardHelpers';
import PageEditor from './PageEditor';

function AdminManagement({ data, onDataSaved, onAdminActivity, onPageEditorStateChange }) {
  const { authFetch, user } = useAuth();
  const [selectedTable, setSelectedTable] = useState('Projects');
  const [draftRows, setDraftRows] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadingWorkbook, setDownloadingWorkbook] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [newRowDraft, setNewRowDraft] = useState({});
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [pendingActivities, setPendingActivities] = useState([]);
  const [isPageEditorOpen, setIsPageEditorOpen] = useState(false);

  const rows = useMemo(() => data[selectedTable] || [], [data, selectedTable]);
  const columns = useMemo(() => getTableColumns(draftRows), [draftRows]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/admin/users`);
      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Could not load users.'));
      }
      setUsers(await response.json());
    } catch (err) {
      setUsersError(err.message || 'Could not load users.');
    } finally {
      setUsersLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    setDraftRows(rows.map((row) => ({ ...row })));
    setMessage('');
    setError('');
    setIsAddPanelOpen(false);
    setEditingRowIndex(null);
    setUndoStack([]);
    setPendingActivities([]);
  }, [rows]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    onPageEditorStateChange?.(isPageEditorOpen);
    return () => onPageEditorStateChange?.(false);
  }, [isPageEditorOpen, onPageEditorStateChange]);

  if (isPageEditorOpen) {
    return (
      <PageEditor
        data={data}
        onDataSaved={onDataSaved}
        onClose={() => setIsPageEditorOpen(false)}
      />
    );
  }

  const openAddPanel = () => {
    const nextColumns = columns.length ? columns : getTableColumns(rows);
    setNewRowDraft(buildEmptyAdminRow(nextColumns, selectedTable, rows));
    setEditingRowIndex(null);
    setMessage('');
    setIsAddPanelOpen(true);
  };

  const openEditPanel = (rowIndex) => {
    setNewRowDraft({ ...draftRows[rowIndex] });
    setEditingRowIndex(rowIndex);
    setMessage('');
    setIsAddPanelOpen(true);
  };

  const closeRowPanel = () => {
    setIsAddPanelOpen(false);
    setEditingRowIndex(null);
    setNewRowDraft({});
  };

  const updateNewRowField = (column, value) => {
    setNewRowDraft((currentRow) => applyAdminRowAutomation(currentRow, column, value, data));
  };

  const pushUndoSnapshot = (label, previousRows) => {
    setUndoStack((currentStack) => [
      ...currentStack.slice(-9),
      {
        label,
        rows: cloneAdminRows(previousRows),
        pendingActivities
      }
    ]);
  };

  const getActivityTitle = (row) => (
    row?.['Project Name'] ||
    row?.['Employee Name'] ||
    row?.['Department Name'] ||
    row?.['Task Name'] ||
    row?.Outcome ||
    row?.['Activity Type'] ||
    row?.[ADMIN_PRIMARY_KEYS[selectedTable]] ||
    selectedTable
  );

  const queueAdminActivity = (action, row) => {
    const idColumn = ADMIN_PRIMARY_KEYS[selectedTable];
    setPendingActivities((currentActivities) => [
      {
        action,
        table: selectedTable,
        id: idColumn ? row?.[idColumn] : '',
        title: getActivityTitle(row),
        meta: row?.Department || row?.Location || row?.Status || '',
        createdAt: new Date().toISOString()
      },
      ...currentActivities
    ].slice(0, 12));
  };

  const undoLastAdminChange = () => {
    const lastSnapshot = undoStack[undoStack.length - 1];
    if (!lastSnapshot) return;

    setDraftRows(cloneAdminRows(lastSnapshot.rows));
    setPendingActivities(lastSnapshot.pendingActivities || []);
    setUndoStack((currentStack) => currentStack.slice(0, -1));
    setMessage(`${lastSnapshot.label} undone. Save the table to sync Excel.`);
    setError('');
    closeRowPanel();
  };

  const saveRowFromPanel = (event) => {
    event.preventDefault();
    const nextColumns = columns.length ? columns : getTableColumns(rows);
    const normalizedRow = nextColumns.reduce((row, column) => ({
      ...row,
      [column]: newRowDraft[column] ?? ''
    }), {});
    if (editingRowIndex === null) {
      pushUndoSnapshot('Add row', draftRows);
      setDraftRows((currentRows) => [normalizedRow, ...currentRows]);
      queueAdminActivity('Added', normalizedRow);
      setMessage(`New ${selectedTable} row added. Save the table to sync Excel.`);
    } else {
      pushUndoSnapshot('Edit row', draftRows);
      setDraftRows((currentRows) => currentRows.map((row, index) => (
        index === editingRowIndex ? normalizedRow : row
      )));
      queueAdminActivity('Updated', normalizedRow);
      setMessage(`${selectedTable} row updated. Save the table to sync Excel.`);
    }
    closeRowPanel();
  };

  const deleteRow = (rowIndex) => {
    const deletedRow = draftRows[rowIndex];
    pushUndoSnapshot('Delete row', draftRows);
    setDraftRows((currentRows) => currentRows.filter((_, index) => index !== rowIndex));
    queueAdminActivity('Deleted', deletedRow);
    setMessage(`${selectedTable} row deleted. Save the table to sync Excel.`);
  };

  const saveTable = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/admin/dashboard-data/${encodeURIComponent(selectedTable)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: draftRows })
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Could not save table.'));
      }

      const payload = await response.json();
      onDataSaved(payload.data);
      if (pendingActivities.length > 0) {
        onAdminActivity(pendingActivities);
      }
      setPendingActivities([]);
      setUndoStack([]);
      setMessage(`${selectedTable} saved to dashboard JSON and Excel.`);
    } catch (err) {
      setError(err.message || 'Could not save table.');
    } finally {
      setSaving(false);
    }
  };

  const downloadWorkbook = async () => {
    setDownloadingWorkbook(true);
    setError('');
    setMessage('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/admin/workbook`);
      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Could not download workbook.'));
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'sample_data.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setMessage('Downloaded the latest Excel workbook.');
    } catch (err) {
      setError(err.message || 'Could not download workbook.');
    } finally {
      setDownloadingWorkbook(false);
    }
  };

  const updateUser = async (targetUser, patch) => {
    setUsersError('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/admin/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Could not update user.'));
      }

      const updatedUser = await response.json();
      setUsers((currentUsers) => currentUsers.map((item) => (
        item.id === updatedUser.id ? updatedUser : item
      )));
    } catch (err) {
      setUsersError(err.message || 'Could not update user.');
    }
  };

  const deleteUser = async (targetUser) => {
    if (!window.confirm(`Delete ${targetUser.email}? This removes their login account.`)) return;
    setUsersError('');
    try {
      const response = await authFetch(`${API_BASE_URL}/api/admin/users/${targetUser.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Could not delete user.'));
      }

      setUsers((currentUsers) => currentUsers.filter((item) => item.id !== targetUser.id));
    } catch (err) {
      setUsersError(err.message || 'Could not delete user.');
    }
  };

  return (
    <div className="admin-page">
      <section className="glass-card admin-command-bar">
        <div>
          <span className="admin-eyebrow">Workbook control</span>
          <h2>Admin Management System</h2>
          <p>Changes save to the dashboard data file and the Excel workbook.</p>
        </div>
        <div className="admin-command-actions">
          <select
            className="filter-select"
            value={selectedTable}
            onChange={(event) => setSelectedTable(event.target.value)}
          >
            {ADMIN_TABLES.map((table) => (
              <option key={table} value={table}>{table}</option>
            ))}
          </select>
          <button className="admin-secondary-btn" type="button" onClick={openAddPanel}>
            Add
          </button>
          <button className="admin-secondary-btn" type="button" onClick={() => setIsPageEditorOpen(true)}>
            Edit Pages
          </button>
          <button className="admin-secondary-btn" type="button" onClick={undoLastAdminChange} disabled={undoStack.length === 0}>
            Undo
          </button>
          <button className="admin-secondary-btn" type="button" onClick={downloadWorkbook} disabled={downloadingWorkbook}>
            {downloadingWorkbook ? 'Downloading...' : 'Download Excel'}
          </button>
          <button className="admin-primary-btn" type="button" onClick={saveTable} disabled={saving}>
            {saving ? 'Saving...' : 'Save Table'}
          </button>
        </div>
      </section>

      {(message || error) && (
        <div className={`status-banner ${error ? 'warning' : 'success'}`}>
          {error || message}
        </div>
      )}

      <section className="glass-card admin-export-card">
        <div>
          <span className="admin-eyebrow">Live workbook</span>
          <h3>Excel export</h3>
          <p>Download the latest workbook after saving admin changes.</p>
        </div>
        <button className="admin-primary-btn" type="button" onClick={downloadWorkbook} disabled={downloadingWorkbook}>
          {downloadingWorkbook ? 'Downloading...' : 'Download Excel Sheet'}
        </button>
      </section>

      <section className="glass-card admin-table-card">
        <div className="admin-section-heading">
          <div>
            <h3>{selectedTable}</h3>
            <p>{draftRows.length} rows</p>
          </div>
        </div>
        <div className="admin-table-scroll">
          <table className="custom-table admin-edit-table">
            <thead>
              <tr>
                <th>Actions</th>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
	            <tbody>
	              {draftRows.map((row, rowIndex) => (
	                <tr key={`${selectedTable}-${rowIndex}`}>
	                  <td>
	                    <div className="admin-row-actions">
	                      <button className="admin-secondary-btn admin-table-action-btn" type="button" onClick={() => openEditPanel(rowIndex)}>
	                        Edit
	                      </button>
	                      <button className="admin-danger-btn admin-table-action-btn" type="button" onClick={() => deleteRow(rowIndex)}>
	                        Delete
	                      </button>
	                    </div>
	                  </td>
	                  {columns.map((column) => (
	                    <td key={column} title={normalizeCellValue(row[column])}>
	                      {formatAdminCellValue(column, row[column])}
	                    </td>
	                  ))}
	                </tr>
	              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isAddPanelOpen && (
        <div className="admin-slide-backdrop" role="presentation" onMouseDown={closeRowPanel}>
          <aside
            className="admin-slide-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-add-row-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-slide-header">
              <div>
                <span className="admin-eyebrow">{editingRowIndex === null ? 'Add record' : 'Edit record'}</span>
                <h3 id="admin-add-row-title">{selectedTable}</h3>
              </div>
              <button className="admin-slide-close" type="button" onClick={closeRowPanel} aria-label="Close record panel">
                ×
              </button>
            </div>

            <form className="admin-slide-form" onSubmit={saveRowFromPanel}>
              {columns.map((column) => {
                const options = getAdminFieldOptions(column, selectedTable, data);
                const value = normalizeCellValue(newRowDraft[column]);

	                return (
	                  <label className="admin-form-field" key={column}>
	                    <span>{column}</span>
	                    {ADMIN_DATE_COLUMNS.has(column) ? (
	                      <input
	                        type="date"
	                        value={toDateInputValue(value)}
	                        onChange={(event) => updateNewRowField(column, dateInputToExcelSerial(event.target.value))}
	                      />
	                    ) : options.length > 0 ? (
	                      <select
	                        value={value}
	                        onChange={(event) => updateNewRowField(column, event.target.value)}
	                      >
                        <option value="">Select {column}</option>
                        {options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={value}
                        onChange={(event) => updateNewRowField(column, event.target.value)}
                      />
                    )}
                  </label>
                );
              })}

              <div className="admin-slide-actions">
                <button className="admin-secondary-btn" type="button" onClick={closeRowPanel}>
                  Cancel
                </button>
                <button className="admin-primary-btn" type="submit">
                  {editingRowIndex === null ? 'Add Record' : 'Update Record'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      <section className="glass-card admin-users-card">
        <div className="admin-section-heading">
          <div>
            <h3>User Accounts</h3>
            <p>Promote users to admin, disable access, or delete accounts.</p>
          </div>
          <button className="admin-secondary-btn" type="button" onClick={loadUsers} disabled={usersLoading}>
            Refresh
          </button>
        </div>

        {usersError && <div className="status-banner warning">{usersError}</div>}

        <div className="admin-table-scroll">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => {
                const isSelf = account.id === user?.id;
                return (
                  <tr key={account.id}>
                    <td>{account.full_name}</td>
                    <td>{account.email}</td>
                    <td>
                      <select
                        className="admin-inline-select"
                        value={account.role}
                        disabled={isSelf}
                        onChange={(event) => updateUser(account, { role: event.target.value })}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="admin-inline-select"
                        value={account.is_active ? 'active' : 'disabled'}
                        disabled={isSelf}
                        onChange={(event) => updateUser(account, { is_active: event.target.value === 'active' })}
                      >
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </td>
                    <td>{account.auth_provider}</td>
                    <td>
                      <button
                        className="admin-danger-btn"
                        type="button"
                        disabled={isSelf}
                        onClick={() => deleteUser(account)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default AdminManagement;
