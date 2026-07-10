import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, parseApiError } from '../api';
import { useAuth } from '../auth/useAuth';
import { ActivityIcon } from '../icons';
import {
  PAGE_EDITOR_PAGES,
  DEFAULT_OVERVIEW_HEADER,
  DEFAULT_OVERVIEW_WIDGETS,
  PROJECT_STATUS_OPTIONS,
  getTableColumns,
  sumBy,
  computeCustomWidgetValue,
  renderCustomGraphVisualization,
  getBuiltinOverviewKpi,
  getOverviewSettingsRows,
  getOverviewHeaderConfig,
  getOverviewWidgetRows,
  settingsRowsFromOverviewConfig,
  getEditablePageSettingsRows,
  getEditablePageHeaderConfig,
  getEditablePageCardRows,
  getEditablePageOptions,
  getEditablePageFieldRows,
  settingsRowsFromEditablePageConfig
} from '../utils/dashboardHelpers';

function PageEditor({ data, onDataSaved, onClose }) {
  const { authFetch } = useAuth();
  const [selectedPage, setSelectedPage] = useState('overview');
  const [headerDraft, setHeaderDraft] = useState(DEFAULT_OVERVIEW_HEADER);
  const [widgetsDraft, setWidgetsDraft] = useState(DEFAULT_OVERVIEW_WIDGETS);
  const [pageCardsDraft, setPageCardsDraft] = useState([]);
  const [pageOptionsDraft, setPageOptionsDraft] = useState({});
  const [pageFieldsDraft, setPageFieldsDraft] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState({ type: 'header' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [editorUndoStack, setEditorUndoStack] = useState([]);
  const [aiLoadingTarget, setAiLoadingTarget] = useState('');

  const settingsRows = useMemo(() => (
    selectedPage === 'overview'
      ? getOverviewSettingsRows(data)
      : getEditablePageSettingsRows(data, selectedPage)
  ), [data, selectedPage]);
  const isOverviewEditor = selectedPage === 'overview';
  const sourceTables = useMemo(() => (
    Object.entries(data)
      .filter(([, rows]) => Array.isArray(rows) && rows.some((row) => row && typeof row === 'object' && !Array.isArray(row)))
      .map(([table]) => table)
      .filter((table) => table !== 'Page Settings')
  ), [data]);

  useEffect(() => {
    if (selectedPage === 'overview') {
      setHeaderDraft(getOverviewHeaderConfig(settingsRows));
      setWidgetsDraft(getOverviewWidgetRows(settingsRows));
      setPageCardsDraft([]);
      setPageOptionsDraft({});
      setPageFieldsDraft([]);
    } else {
      setHeaderDraft(getEditablePageHeaderConfig(settingsRows, selectedPage));
      setPageCardsDraft(getEditablePageCardRows(settingsRows, selectedPage));
      setPageOptionsDraft(getEditablePageOptions(settingsRows, selectedPage));
      setPageFieldsDraft(getEditablePageFieldRows(settingsRows, selectedPage));
    }
    setSelectedBlock({ type: 'header' });
    setIsInspectorOpen(false);
    setEditorUndoStack([]);
    setMessage('');
    setError('');
  }, [selectedPage, settingsRows]);

  const createEditorSnapshot = () => ({
    headerDraft: { ...headerDraft },
    widgetsDraft: widgetsDraft.map((widget) => ({ ...widget })),
    pageCardsDraft: pageCardsDraft.map((card) => ({ ...card })),
    pageOptionsDraft: { ...pageOptionsDraft },
    pageFieldsDraft: pageFieldsDraft.map((field) => ({ ...field })),
    selectedBlock: { ...selectedBlock }
  });

  const pushEditorUndo = () => {
    const snapshot = createEditorSnapshot();
    setEditorUndoStack((currentStack) => [...currentStack.slice(-11), snapshot]);
    setMessage('');
    setError('');
  };

  const restoreEditorSnapshot = (snapshot) => {
    setHeaderDraft(snapshot.headerDraft);
    setWidgetsDraft(snapshot.widgetsDraft);
    setPageCardsDraft(snapshot.pageCardsDraft);
    setPageOptionsDraft(snapshot.pageOptionsDraft);
    setPageFieldsDraft(snapshot.pageFieldsDraft);
    setSelectedBlock(snapshot.selectedBlock);
    setIsInspectorOpen(false);
  };

  const undoEditorChange = () => {
    const snapshot = editorUndoStack[editorUndoStack.length - 1];
    if (!snapshot) return;
    restoreEditorSnapshot(snapshot);
    setEditorUndoStack((currentStack) => currentStack.slice(0, -1));
    setMessage('Last page edit undone.');
    setError('');
  };

  const updateWidget = (widgetId, patch) => {
    pushEditorUndo();
    setWidgetsDraft((currentWidgets) => currentWidgets.map((widget) => (
      widget.id === widgetId ? { ...widget, ...patch } : widget
    )));
  };

  const moveWidget = (widgetId, direction) => {
    pushEditorUndo();
    setWidgetsDraft((currentWidgets) => {
      const index = currentWidgets.findIndex((widget) => widget.id === widgetId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= currentWidgets.length) return currentWidgets;
      const nextWidgets = [...currentWidgets];
      const [movedWidget] = nextWidgets.splice(index, 1);
      nextWidgets.splice(targetIndex, 0, movedWidget);
      return nextWidgets.map((widget, widgetIndex) => ({ ...widget, order: widgetIndex + 1 }));
    });
  };

  const updatePageCard = (cardId, patch) => {
    pushEditorUndo();
    setPageCardsDraft((currentCards) => currentCards.map((card) => (
      card.id === cardId ? { ...card, ...patch } : card
    )));
  };

  const movePageCard = (cardId, direction) => {
    pushEditorUndo();
    setPageCardsDraft((currentCards) => {
      const index = currentCards.findIndex((card) => card.id === cardId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= currentCards.length) return currentCards;
      const nextCards = [...currentCards];
      const [movedCard] = nextCards.splice(index, 1);
      nextCards.splice(targetIndex, 0, movedCard);
      return nextCards.map((card, cardIndex) => ({ ...card, order: cardIndex + 1 }));
    });
  };

  const updatePageField = (fieldId, patch) => {
    pushEditorUndo();
    setPageFieldsDraft((currentFields) => currentFields.map((field) => (
      field.id === fieldId ? { ...field, ...patch } : field
    )));
  };

  const updatePageOptions = (patch) => {
    pushEditorUndo();
    setPageOptionsDraft((draft) => ({ ...draft, ...patch }));
  };

  const movePageField = (fieldId, direction) => {
    pushEditorUndo();
    setPageFieldsDraft((currentFields) => {
      const index = currentFields.findIndex((field) => field.id === fieldId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= currentFields.length) return currentFields;
      const nextFields = [...currentFields];
      const [movedField] = nextFields.splice(index, 1);
      nextFields.splice(targetIndex, 0, movedField);
      return nextFields.map((field, fieldIndex) => ({ ...field, order: fieldIndex + 1 }));
    });
  };

  const removeCustomWidget = (widgetId) => {
    pushEditorUndo();
    setWidgetsDraft((currentWidgets) => currentWidgets.filter((widget) => widget.id !== widgetId));
  };

  const addOverviewWidget = async () => {
    pushEditorUndo();
    const newWidget = {
      id: `custom-${Date.now()}`,
      type: 'custom-kpi',
      label: 'New KPI Card',
      enabled: true,
      order: widgetsDraft.length + 1,
      sourceTable: 'Projects',
      metric: 'count',
      field: '',
      filterField: '',
      filterValue: '',
      note: ''
    };
    setWidgetsDraft((currentWidgets) => [...currentWidgets, newWidget]);
    setSelectedBlock({ type: 'kpi', id: newWidget.id });
    setIsInspectorOpen(false);
    setMessage('New KPI card added. Edit the settings in the side panel.');
  };

  const addGraphCard = () => {
    pushEditorUndo();
    const newCard = {
      id: `graph-${Date.now()}`,
      type: 'custom-graph',
      label: 'New Graph Card',
      enabled: true,
      order: pageCardsDraft.length + 1,
      sourceTable: 'Projects',
      metric: 'count',
      field: '',
      filterField: '',
      filterValue: '',
      graphType: 'bar',
      groupField: 'Status',
      note: ''
    };
    setPageCardsDraft((currentCards) => [...currentCards, newCard]);
    setSelectedBlock({ type: 'summary-card', id: newCard.id });
    setIsInspectorOpen(false);
    setMessage('New graph card added. Edit the settings in the side panel.');
  };

  const fetchAutofillSuggestion = async (title) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new Error('Type a title first, then use AI autofill.');
    }

    const response = await authFetch(`${API_BASE_URL}/api/admin/page-editor/autofill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmedTitle })
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, 'Could not autofill card settings.'));
    }

    return response.json();
  };

  const applyWidgetSuggestion = (widgetId, suggestion) => {
    pushEditorUndo();
    setWidgetsDraft((currentWidgets) => currentWidgets.map((widget) => (
      widget.id === widgetId ? {
        ...widget,
        label: suggestion.label || widget.label,
        sourceTable: suggestion.source_table || widget.sourceTable,
        metric: suggestion.metric || widget.metric,
        field: suggestion.field || '',
        filterField: suggestion.filter_field || '',
        filterValue: suggestion.filter_value || '',
        note: suggestion.note || widget.note
      } : widget
    )));
  };

  const applyCardSuggestion = (cardId, suggestion) => {
    pushEditorUndo();
    setPageCardsDraft((currentCards) => currentCards.map((card) => (
      card.id === cardId ? {
        ...card,
        label: suggestion.label || card.label,
        sourceTable: suggestion.source_table || card.sourceTable,
        metric: suggestion.metric || card.metric,
        field: suggestion.field || '',
        filterField: suggestion.filter_field || '',
        filterValue: suggestion.filter_value || '',
        graphType: suggestion.graph_type || card.graphType || 'bar',
        groupField: suggestion.group_field || card.groupField || '',
        note: suggestion.note || card.note
      } : card
    )));
  };

  const previewSummary = useMemo(() => {
    const projects = data.Projects || [];
    const employees = data.Employees || [];
    const departments = data.Departments || [];
    const tasks = data.Tasks || [];
    const completedTasks = tasks.filter((task) => task.Status === 'Completed').length;
    const totalBudget = sumBy(departments, (department) => department['Annual Budget SAR']);
    const totalSpend = sumBy(projects, (project) => project['Actual Spend SAR']);
    return {
      departments,
      employees,
      projects,
      avgProgress: projects.length ? sumBy(projects, (project) => project['Progress %']) / projects.length : 0,
      openTasks: tasks.length - completedTasks,
      blockedTasks: tasks.filter((task) => task.Status === 'Blocked').length,
      budgetUtilization: totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0,
      totalSpend
    };
  }, [data]);

  const savePageSettings = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const existingRows = Array.isArray(data['Page Settings']) ? data['Page Settings'] : [];
      const pageRows = selectedPage === 'overview'
        ? settingsRowsFromOverviewConfig(headerDraft, widgetsDraft)
        : settingsRowsFromEditablePageConfig(selectedPage, headerDraft, pageCardsDraft, pageOptionsDraft, pageFieldsDraft);
      const nextRows = [
        ...existingRows.filter((row) => row?.Page !== selectedPage),
        ...pageRows
      ];
      const response = await authFetch(`${API_BASE_URL}/api/admin/dashboard-data/Page%20Settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: nextRows })
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Could not save page settings.'));
      }

      const payload = await response.json();
      onDataSaved(payload.data);
      setMessage(`${PAGE_EDITOR_PAGES.find((page) => page.value === selectedPage)?.label || 'Page'} settings saved.`);
    } catch (err) {
      setError(err.message || 'Could not save page settings.');
    } finally {
      setSaving(false);
    }
  };

  const selectedPageLabel = PAGE_EDITOR_PAGES.find((page) => page.value === selectedPage)?.label || 'Page';
  const selectedCard = selectedBlock.type === 'summary-card'
    ? pageCardsDraft.find((card) => card.id === selectedBlock.id)
    : null;
  const selectedWidget = selectedBlock.type === 'kpi'
    ? widgetsDraft.find((widget) => widget.id === selectedBlock.id)
    : null;
  const selectedField = selectedBlock.type === 'field'
    ? pageFieldsDraft.find((field) => field.id === selectedBlock.id)
    : null;
  const selectedWidgetColumns = selectedWidget?.sourceTable ? getTableColumns(data[selectedWidget.sourceTable] || []) : [];
  const selectedCardColumns = selectedCard?.sourceTable ? getTableColumns(data[selectedCard.sourceTable] || []) : [];

  const updateHeaderDraft = (patch) => {
    pushEditorUndo();
    setHeaderDraft((draft) => ({ ...draft, ...patch }));
  };

  const renderBlockSettings = () => {
    if (selectedBlock.type === 'header') {
      return (
        <div className="edit-mode-panel-section">
          <span className="admin-eyebrow">Page Header</span>
          <label className="admin-form-field">
            <span>Title</span>
            <input value={headerDraft.title} onChange={(event) => updateHeaderDraft({ title: event.target.value })} />
          </label>
          <label className="admin-form-field">
            <span>Subtitle</span>
            <input value={headerDraft.subtitle} onChange={(event) => updateHeaderDraft({ subtitle: event.target.value })} />
          </label>
          {selectedPage === 'projects' && (
            <label className="admin-form-field">
              <span>Default status filter</span>
              <select value={pageOptionsDraft.defaultStatus || 'All'} onChange={(event) => updatePageOptions({ defaultStatus: event.target.value })}>
                {PROJECT_STATUS_OPTIONS.map((statusOption) => (
                  <option value={statusOption} key={statusOption}>{statusOption === 'All' ? 'All Statuses' : statusOption}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      );
    }

    if (selectedWidget) {
      const widgetIndex = widgetsDraft.findIndex((widget) => widget.id === selectedWidget.id);
      return (
        <div className="edit-mode-panel-section">
          <span className="admin-eyebrow">KPI Card</span>
          <label className="admin-form-field">
            <span>Card title</span>
            <input value={selectedWidget.label} onChange={(event) => updateWidget(selectedWidget.id, { label: event.target.value })} />
          </label>
          <label className="edit-mode-toggle-row">
            <input type="checkbox" checked={selectedWidget.enabled} onChange={(event) => updateWidget(selectedWidget.id, { enabled: event.target.checked })} />
            <span>Show on page</span>
          </label>
          <div className="edit-mode-button-row">
            <button type="button" className="admin-secondary-btn admin-table-action-btn" onClick={() => moveWidget(selectedWidget.id, -1)} disabled={widgetIndex === 0}>Move left</button>
            <button type="button" className="admin-secondary-btn admin-table-action-btn" onClick={() => moveWidget(selectedWidget.id, 1)} disabled={widgetIndex === widgetsDraft.length - 1}>Move right</button>
            {selectedWidget.type === 'custom-kpi' && (
              <button type="button" className="admin-danger-btn admin-table-action-btn" onClick={() => removeCustomWidget(selectedWidget.id)}>Delete</button>
            )}
          </div>
          {selectedWidget.type === 'custom-kpi' ? (
            <>
              <div className="edit-mode-button-row">
                <button
                  type="button"
                  className="admin-secondary-btn"
                  onClick={async () => {
                    setAiLoadingTarget(selectedWidget.id);
                    setMessage('');
                    setError('');
                    try {
                      const suggestion = await fetchAutofillSuggestion(selectedWidget.label || 'New KPI Card');
                      applyWidgetSuggestion(selectedWidget.id, suggestion);
                      setMessage('AI filled the KPI card. Review the settings before saving.');
                    } catch (err) {
                      setError(err.message || 'Could not autofill KPI settings.');
                    } finally {
                      setAiLoadingTarget('');
                    }
                  }}
                  disabled={aiLoadingTarget === selectedWidget.id}
                >
                  {aiLoadingTarget === selectedWidget.id ? 'Filling...' : 'Autofill with AI'}
                </button>
              </div>
              <div className="page-editor-two-col">
                <label className="admin-form-field">
                  <span>Source table</span>
                  <select
                    value={selectedWidget.sourceTable || 'Projects'}
                    onChange={(event) => updateWidget(selectedWidget.id, {
                      sourceTable: event.target.value,
                      field: '',
                      filterField: ''
                    })}
                  >
                    {sourceTables.map((table) => <option key={table} value={table}>{table}</option>)}
                  </select>
                </label>
                <label className="admin-form-field">
                  <span>Metric</span>
                  <select value={selectedWidget.metric || 'count'} onChange={(event) => updateWidget(selectedWidget.id, { metric: event.target.value })}>
                    <option value="count">Count records</option>
                    <option value="sum">Sum field</option>
                    <option value="average">Average field</option>
                  </select>
                </label>
              </div>
              {selectedWidget.metric !== 'count' && (
                <label className="admin-form-field">
                  <span>Metric field</span>
                  <select value={selectedWidget.field || ''} onChange={(event) => updateWidget(selectedWidget.id, { field: event.target.value })}>
                    <option value="">Select field</option>
                    {selectedWidgetColumns.map((column) => <option key={column} value={column}>{column}</option>)}
                  </select>
                </label>
              )}
              <div className="page-editor-two-col">
                <label className="admin-form-field">
                  <span>Filter field</span>
                  <select value={selectedWidget.filterField || ''} onChange={(event) => updateWidget(selectedWidget.id, { filterField: event.target.value })}>
                    <option value="">No filter</option>
                    {selectedWidgetColumns.map((column) => <option key={column} value={column}>{column}</option>)}
                  </select>
                </label>
                <label className="admin-form-field">
                  <span>Filter value</span>
                  <input value={selectedWidget.filterValue || ''} onChange={(event) => updateWidget(selectedWidget.id, { filterValue: event.target.value })} placeholder="High or IT" />
                </label>
              </div>
              <label className="admin-form-field">
                <span>Note</span>
                <input value={selectedWidget.note || ''} onChange={(event) => updateWidget(selectedWidget.id, { note: event.target.value })} placeholder="Optional helper text" />
              </label>
            </>
          ) : (
            <div className="edit-mode-note">Built-in cards use dashboard formulas. You can rename, hide, and move them here.</div>
          )}
        </div>
      );
    }

    if (selectedCard) {
      const cardIndex = pageCardsDraft.findIndex((card) => card.id === selectedCard.id);
      return (
        <div className="edit-mode-panel-section">
          <span className="admin-eyebrow">Graph Card</span>
          <label className="admin-form-field">
            <span>Card title</span>
            <input value={selectedCard.label} onChange={(event) => updatePageCard(selectedCard.id, { label: event.target.value })} />
          </label>
          <label className="edit-mode-toggle-row">
            <input type="checkbox" checked={selectedCard.enabled} onChange={(event) => updatePageCard(selectedCard.id, { enabled: event.target.checked })} />
            <span>Show on page</span>
          </label>
          <div className="edit-mode-button-row">
            <button type="button" className="admin-secondary-btn admin-table-action-btn" onClick={() => movePageCard(selectedCard.id, -1)} disabled={cardIndex === 0}>Move left</button>
            <button type="button" className="admin-secondary-btn admin-table-action-btn" onClick={() => movePageCard(selectedCard.id, 1)} disabled={cardIndex === pageCardsDraft.length - 1}>Move right</button>
            {selectedCard.type === 'custom-graph' && (
              <button
                type="button"
                className="admin-danger-btn admin-table-action-btn"
                onClick={() => {
                  pushEditorUndo();
                  setPageCardsDraft((currentCards) => currentCards.filter((card) => card.id !== selectedCard.id));
                  setSelectedBlock({ type: 'header' });
                  setIsInspectorOpen(false);
                  setMessage('Graph card deleted.');
                }}
              >
                Delete
              </button>
            )}
          </div>
          {selectedCard.type === 'custom-graph' ? (
            <>
              <div className="edit-mode-button-row">
                <button
                  type="button"
                  className="admin-secondary-btn"
                  onClick={async () => {
                    setAiLoadingTarget(selectedCard.id);
                    setMessage('');
                    setError('');
                    try {
                      const suggestion = await fetchAutofillSuggestion(selectedCard.label || 'New Graph Card');
                      applyCardSuggestion(selectedCard.id, suggestion);
                      setMessage('AI filled the graph card. Review the settings before saving.');
                    } catch (err) {
                      setError(err.message || 'Could not autofill graph settings.');
                    } finally {
                      setAiLoadingTarget('');
                    }
                  }}
                  disabled={aiLoadingTarget === selectedCard.id}
                >
                  {aiLoadingTarget === selectedCard.id ? 'Filling...' : 'Autofill with AI'}
                </button>
              </div>
              <div className="page-editor-two-col">
                <label className="admin-form-field">
                  <span>Source table</span>
                  <select
                    value={selectedCard.sourceTable || 'Projects'}
                    onChange={(event) => updatePageCard(selectedCard.id, {
                      sourceTable: event.target.value,
                      field: '',
                      filterField: '',
                      groupField: ''
                    })}
                  >
                    {sourceTables.map((table) => <option key={table} value={table}>{table}</option>)}
                  </select>
                </label>
                <label className="admin-form-field">
                  <span>Metric</span>
                  <select value={selectedCard.metric || 'count'} onChange={(event) => updatePageCard(selectedCard.id, { metric: event.target.value })}>
                    <option value="count">Count records</option>
                    <option value="sum">Sum field</option>
                    <option value="average">Average field</option>
                  </select>
                </label>
              </div>
              <div className="page-editor-two-col">
                <label className="admin-form-field">
                  <span>Graph type</span>
                  <select value={selectedCard.graphType || 'bar'} onChange={(event) => updatePageCard(selectedCard.id, { graphType: event.target.value })}>
                    <option value="bar">Bar</option>
                    <option value="donut">Donut</option>
                    <option value="stacked">Stacked</option>
                    <option value="line">Line</option>
                  </select>
                </label>
                <label className="admin-form-field">
                  <span>Group by field</span>
                  <select value={selectedCard.groupField || ''} onChange={(event) => updatePageCard(selectedCard.id, { groupField: event.target.value })}>
                    <option value="">Auto detect</option>
                    {selectedCardColumns.map((column) => <option key={column} value={column}>{column}</option>)}
                  </select>
                </label>
              </div>
              {selectedCard.metric !== 'count' && (
                <label className="admin-form-field">
                  <span>Metric field</span>
                  <select value={selectedCard.field || ''} onChange={(event) => updatePageCard(selectedCard.id, { field: event.target.value })}>
                    <option value="">Select field</option>
                    {selectedCardColumns.map((column) => <option key={column} value={column}>{column}</option>)}
                  </select>
                </label>
              )}
              <div className="page-editor-two-col">
                <label className="admin-form-field">
                  <span>Filter field</span>
                  <select value={selectedCard.filterField || ''} onChange={(event) => updatePageCard(selectedCard.id, { filterField: event.target.value })}>
                    <option value="">No filter</option>
                    {selectedCardColumns.map((column) => <option key={column} value={column}>{column}</option>)}
                  </select>
                </label>
                <label className="admin-form-field">
                  <span>Filter value</span>
                  <input value={selectedCard.filterValue || ''} onChange={(event) => updatePageCard(selectedCard.id, { filterValue: event.target.value })} placeholder="High, IT, etc." />
                </label>
              </div>
              <label className="admin-form-field">
                <span>Note</span>
                <input value={selectedCard.note || ''} onChange={(event) => updatePageCard(selectedCard.id, { note: event.target.value })} placeholder="Optional helper text" />
              </label>
            </>
          ) : (
            <div className="edit-mode-note">This is a built-in graph card. You can rename, hide, and move it here.</div>
          )}
        </div>
      );
    }

    if (selectedField) {
      const fieldIndex = pageFieldsDraft.findIndex((field) => field.id === selectedField.id);
      return (
        <div className="edit-mode-panel-section">
          <span className="admin-eyebrow">{selectedPage === 'projects' ? 'Project Field' : 'Table Column'}</span>
          <label className="admin-form-field">
            <span>Label</span>
            <input value={selectedField.label} onChange={(event) => updatePageField(selectedField.id, { label: event.target.value })} />
          </label>
          <label className="edit-mode-toggle-row">
            <input type="checkbox" checked={selectedField.enabled} onChange={(event) => updatePageField(selectedField.id, { enabled: event.target.checked })} />
            <span>Show on page</span>
          </label>
          <div className="edit-mode-button-row">
            <button type="button" className="admin-secondary-btn admin-table-action-btn" onClick={() => movePageField(selectedField.id, -1)} disabled={fieldIndex === 0}>Move left</button>
            <button type="button" className="admin-secondary-btn admin-table-action-btn" onClick={() => movePageField(selectedField.id, 1)} disabled={fieldIndex === pageFieldsDraft.length - 1}>Move right</button>
          </div>
        </div>
      );
    }

    return (
      <div className="edit-mode-panel-section">
        <span className="admin-eyebrow">Selection</span>
        <p className="edit-mode-note">Select a block in the preview to edit it.</p>
      </div>
    );
  };

  return (
    <div className="edit-mode">
      <section className="edit-mode-topbar glass-card">
        <div>
          <span className="admin-eyebrow">Admin editing mode</span>
          <h2>{selectedPageLabel}</h2>
          <p>Editing a preview copy. Changes apply to the live page only after saving.</p>
        </div>
        <div className="admin-command-actions">
          <select className="filter-select" value={selectedPage} onChange={(event) => setSelectedPage(event.target.value)}>
            {PAGE_EDITOR_PAGES.map((page) => (
              <option key={page.value} value={page.value} disabled={page.disabled}>
                {page.label}{page.disabled ? ' - later' : ''}
              </option>
            ))}
          </select>
          <button className="admin-secondary-btn" type="button" onClick={undoEditorChange} disabled={!editorUndoStack.length}>
            Undo
          </button>
          <button className="admin-secondary-btn" type="button" onClick={onClose}>Back</button>
          <button className="admin-primary-btn" type="button" onClick={savePageSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Page'}
          </button>
        </div>
      </section>

      {(message || error) && (
        <div className={`status-banner ${error ? 'warning' : 'success'}`}>
          {error || message}
        </div>
      )}

      <div className="edit-mode-workspace">
        <section className="edit-mode-canvas">
          <button
            type="button"
            className={`edit-mode-block edit-mode-header-block ${selectedBlock.type === 'header' ? 'selected' : ''}`}
            onClick={() => {
              setSelectedBlock({ type: 'header' });
              setIsInspectorOpen(true);
            }}
          >
            <span className="edit-mode-block-label">Header</span>
            <h1>{headerDraft.title}</h1>
            <p>{headerDraft.subtitle}</p>
          </button>

          <div className="edit-mode-section-toolbar">
            <div>
              <span className="admin-eyebrow">{isOverviewEditor ? 'KPI Cards' : 'Graph Cards'}</span>
              <strong>{isOverviewEditor ? 'Dashboard cards' : 'Summary section'}</strong>
            </div>
            <div className="edit-mode-button-row">
              <button className="admin-secondary-btn admin-table-action-btn" type="button" onClick={selectedPage === 'overview' ? addOverviewWidget : undefined} disabled={!isOverviewEditor}>
                Add Card
              </button>
              {selectedPage === 'projects' && (
                <button className="admin-secondary-btn admin-table-action-btn" type="button" onClick={addGraphCard}>
                  Add Graph
                </button>
              )}
            </div>
          </div>

          {isOverviewEditor ? (
            <div className="overview-kpi-grid page-editor-kpi-preview">
              {widgetsDraft.map((widget) => {
                const card = widget.type === 'builtin-kpi'
                  ? getBuiltinOverviewKpi(widget, previewSummary)
                  : {
                      label: widget.label,
                      value: computeCustomWidgetValue(widget, data),
                      note: widget.note || `${widget.metric || 'count'} from ${widget.sourceTable || 'table'}`
                    };
                if (!card) return null;

                return (
                  <button
                    type="button"
                    className={`edit-mode-block glass-card overview-kpi-card ${widget.enabled ? '' : 'is-hidden'} ${selectedBlock.type === 'kpi' && selectedBlock.id === widget.id ? 'selected' : ''}`}
                    key={widget.id}
                    onClick={() => {
                      setSelectedBlock({ type: 'kpi', id: widget.id });
                      setIsInspectorOpen(true);
                    }}
                  >
                    <span className="edit-mode-block-label">{widget.enabled ? 'KPI' : 'Hidden KPI'}</span>
                    <span className="kpi-label">{card.label}</span>
                    <span className={`kpi-value ${card.ai ? 'chatbot-kpi-value' : ''}`}>{card.value}</span>
                    <span className="overview-kpi-note">{card.note}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="portfolio-summary-grid page-editor-summary-preview">
              {pageCardsDraft.map((card) => (
                <button
                  type="button"
                  className={`edit-mode-block glass-card summary-card ${card.enabled ? '' : 'is-hidden'} ${selectedBlock.type === 'summary-card' && selectedBlock.id === card.id ? 'selected' : ''}`}
                  key={card.id}
                  onClick={() => {
                    setSelectedBlock({ type: 'summary-card', id: card.id });
                    setIsInspectorOpen(true);
                  }}
                >
                  <span className="edit-mode-block-label">{card.enabled ? 'Graph Card' : 'Hidden Graph'}</span>
                  <div className="summary-card-title">
                    <ActivityIcon />
                    <span>{card.label}</span>
                  </div>
                  <div className="summary-card-content">
                    {card.type === 'custom-graph' ? renderCustomGraphVisualization(card, data) : (
                      <div className="page-editor-chart-placeholder">
                        <span>{card.id === 'recentUpdates' ? 'Recent activity list' : 'Existing graph card'}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="edit-mode-section-toolbar">
            <div>
              <span className="admin-eyebrow">{selectedPage === 'departments' ? 'Table' : 'Fields'}</span>
              <strong>{selectedPage === 'departments' ? 'Department columns' : 'Visible content fields'}</strong>
            </div>
          </div>

          <div className="edit-mode-field-strip">
            {(isOverviewEditor ? widgetsDraft : pageFieldsDraft).map((field) => (
              <button
                type="button"
                className={`edit-mode-field-pill ${field.enabled ? '' : 'is-hidden'} ${selectedBlock.type === 'field' && selectedBlock.id === field.id ? 'selected' : ''}`}
                key={field.id}
                onClick={() => {
                  if (isOverviewEditor) return;
                  setSelectedBlock({ type: 'field', id: field.id });
                  setIsInspectorOpen(true);
                }}
                disabled={isOverviewEditor}
              >
                {field.label}
              </button>
            ))}
          </div>
        </section>

        {isInspectorOpen && (
          <div className="admin-slide-backdrop edit-mode-drawer-backdrop" onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsInspectorOpen(false);
            }
          }}>
            <aside className="admin-slide-panel edit-mode-inspector">
              <div className="admin-slide-header">
                <div>
                  <span className="admin-eyebrow">Settings</span>
                  <h3>{selectedBlock.type === 'header' ? 'Page Header' : selectedBlock.type === 'summary-card' ? 'Graph Card' : selectedBlock.type === 'kpi' ? 'KPI Card' : 'Field'}</h3>
                </div>
                <button className="admin-slide-close" type="button" onClick={() => setIsInspectorOpen(false)}>×</button>
              </div>
              <div className="edit-mode-drawer-body">
                {renderBlockSettings()}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export default PageEditor;
