import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SparklesIcon, SearchIcon, InfoIcon } from './icons';
import { API_BASE_URL, parseApiError } from './api';
import { useAuth } from './auth/useAuth';

const SUGGESTED_QUERIES = [
  "How many departments are active, and what is the total annual budget?",
  "Which projects are marked 'At Risk' and what are their actual spends vs budgets?",
  "Summarize key accomplishments and blockers from the weekly updates.",
  "Identify data contradictions or integrity issues in the database.",
  "List the employees managed by Sara Alharbi and their roles.",
  "Analyze the progress and budgets of projects under the 'Finance' department."
];

export default function Chatbot({ initialQuery, clearInitialQuery }) {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'model',
      content: "Marhaban! I am **PROJEX AI**, your executive dashboard assistant.\n\nI have access to the complete workforce, project, meeting, and update records for the organization. Ask me any question, ask for project calculations, or seek insights about operational data!"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online', 'offline', 'missing_key'
  const chatEndRef = useRef(null);
  const handledInitialQueryRef = useRef('');
  const [randomSuggestion, setRandomSuggestion] = useState('');

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * SUGGESTED_QUERIES.length);
    setRandomSuggestion(SUGGESTED_QUERIES[randomIndex]);
  }, []);

  // Keep a ref to the latest messages state to avoid stale closures in the async handleSend function
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Health check to verify backend connection and API key configuration
  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`);
      if (res.ok) {
        const data = await res.json();
        if (data.api_key_configured) {
          setBackendStatus('online');
        } else {
          setBackendStatus('missing_key');
        }
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
    // Re-check every 10 seconds in case they configure the key or start the backend
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = useCallback(async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    if (!textToSend) setInput('');

    // Append user message using latest state from messagesRef
    const updatedMessages = [...messagesRef.current, { role: 'user', content: query }];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const response = await authFetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: updatedMessages.slice(1, -1) // Exclude initial greeting and current message from API history
        })
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, `Server error: ${response.status}`));
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'model', content: data.response }]);
    } catch (err) {
      console.error(err);
      let errorMsg = "Sorry, I couldn't reach the backend AI server. Make sure the FastAPI backend is running locally at `http://127.0.0.1:8000`.";
      if (backendStatus === 'missing_key') {
        errorMsg = "API key issue: Please add your `GEMINI_API_KEY` to the `backend/.env` file and restart the FastAPI server.";
      } else if (err.message) {
        errorMsg = `Error: ${err.message}`;
      }
      setMessages(prev => [...prev, { role: 'model', content: errorMsg, isError: true }]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, backendStatus, input]);

  // Listen for initial queries sent from parent triggers (like the Overview Task card)
  useEffect(() => {
    if (initialQuery && initialQuery !== handledInitialQueryRef.current) {
      handledInitialQueryRef.current = initialQuery;
      handleSend(initialQuery);
      if (clearInitialQuery) {
        clearInitialQuery();
      }
    }
  }, [clearInitialQuery, handleSend, initialQuery]);

  // Custom Inline Formatter for Bold & Code snippets
  const formatInline = (str) => {
    let escaped = str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Bold: **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Inline code: `code`
    escaped = escaped.replace(/`(.*?)`/g, '<code>$1</code>');
    
    return escaped;
  };

  // Custom Markdown & Table Parser
  const renderMarkdown = (text) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements = [];
    let currentList = [];
    let currentTable = null;
    let tableHeaderProcessed = false;

    const pushList = (key) => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`ul-${key}`} className="chat-bullet-list">
            {currentList.map((item, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    const pushTable = (key) => {
      if (currentTable) {
        elements.push(
          <div key={`table-wrapper-${key}`} className="chat-table-wrapper">
            <table className="chat-data-table">
              <thead>
                <tr>
                  {currentTable.headers.map((h, idx) => (
                    <th key={idx} dangerouslySetInnerHTML={{ __html: formatInline(h) }} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentTable.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} dangerouslySetInnerHTML={{ __html: formatInline(cell) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        currentTable = null;
        tableHeaderProcessed = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Check if it's a markdown table row (starts and ends with |)
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        pushList(index);
        
        const cells = trimmed
          .split('|')
          .map(c => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        
        const isSeparator = cells.every(c => c.match(/^:?-+:?$/));
        
        if (isSeparator) {
          tableHeaderProcessed = true;
        } else {
          if (!currentTable) {
            currentTable = { headers: cells, rows: [] };
          } else if (!tableHeaderProcessed) {
            currentTable.headers = cells;
          } else {
            currentTable.rows.push(cells);
          }
        }
        return;
      } else {
        pushTable(index);
      }

      // Check if it's a bullet point
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        currentList.push(trimmed.substring(2));
        return;
      } else {
        pushList(index);
      }

      // Check for headers
      if (trimmed.startsWith('### ')) {
        elements.push(<h3 key={index} className="chat-h3" dangerouslySetInnerHTML={{ __html: formatInline(trimmed.substring(4)) }} />);
      } else if (trimmed.startsWith('## ')) {
        elements.push(<h2 key={index} className="chat-h2" dangerouslySetInnerHTML={{ __html: formatInline(trimmed.substring(3)) }} />);
      } else if (trimmed.startsWith('# ')) {
        elements.push(<h1 key={index} className="chat-h1" dangerouslySetInnerHTML={{ __html: formatInline(trimmed.substring(2)) }} />);
      } else if (trimmed === '') {
        elements.push(<div key={index} className="chat-spacing" />);
      } else {
        elements.push(
          <p key={index} className="chat-p" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        );
      }
    });

    pushList('final');
    pushTable('final');

    return elements;
  };

  return (
    <div className="chat-container glass-card">
      {/* Connection / Status Banner */}
      {backendStatus === 'offline' && (
        <div className="status-banner warning">
          <InfoIcon className="banner-icon" />
          <span>
            <strong>AI Server Offline:</strong> The backend server is not running. Please start it by running 
            <code>backend/venv/bin/python backend/main.py</code> or 
            <code>venv/bin/uvicorn main:app --reload</code> in the backend folder.
          </span>
          <button className="retry-btn" onClick={checkHealth}>Retry</button>
        </div>
      )}
      {backendStatus === 'missing_key' && (
        <div className="status-banner warning">
          <InfoIcon className="banner-icon" />
          <span>
            <strong>Gemini API Key Missing:</strong> The backend is online but could not find the API key. 
            Please add your <code>GEMINI_API_KEY=your_key_here</code> to <code>backend/.env</code> and restart the server.
          </span>
          <button className="retry-btn" onClick={checkHealth}>Check Key</button>
        </div>
      )}
      {backendStatus === 'online' && (
        <div className="status-banner success">
          <SparklesIcon className="banner-icon pulse" />
          <span><strong>PROJEX AI Online:</strong> Powered by Gemini 2.5 Flash. Ask anything about the dashboard data.</span>
        </div>
      )}

      {/* Messages Window */}
      <div className="chat-messages-window">
        {messages.map((msg, index) => (
          <div key={index} className={`chat-bubble-wrapper ${msg.role} ${msg.isError ? 'error-bubble' : ''}`}>
            <div className="chat-avatar">
              {msg.role === 'user' ? 'U' : <SparklesIcon className="avatar-sparkle" />}
            </div>
            <div className="chat-bubble-content">
              <div className="chat-bubble-meta">
                {msg.role === 'user' ? 'You' : 'PROJEX AI'}
              </div>
              <div className="chat-bubble-text">
                {renderMarkdown(msg.content)}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble-wrapper model loading-bubble">
            <div className="chat-avatar">
              <SparklesIcon className="avatar-sparkle pulse" />
            </div>
            <div className="chat-bubble-content">
              <div className="chat-bubble-meta">PROJEX AI is searching dashboard records...</div>
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Prompts Area */}
      {messages.length === 1 && !loading && randomSuggestion && (
        <div className="suggested-queries-section" style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--pink-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Try asking:</span>
          <button 
            type="button"
            className="suggested-query-btn"
            style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
            onClick={() => handleSend(randomSuggestion)}
          >
            "{randomSuggestion}"
          </button>
        </div>
      )}

      {/* Input Form */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }} 
        className="chat-input-form"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            backendStatus === 'online' 
              ? "Ask about budgets, employees, tasks, weekly updates..." 
              : "Backend connection required to query..."
          }
          className="chat-input-field"
          disabled={loading || backendStatus === 'offline'}
        />
        <button 
          type="submit" 
          className="chat-send-btn"
          disabled={loading || !input.trim() || backendStatus === 'offline'}
        >
          <SearchIcon className="chat-send-icon" />
          <span>Ask AI</span>
        </button>
      </form>
    </div>
  );
}
