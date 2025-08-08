/*
  Main application script for the lock logger PWA.
  Built with React via CDN to keep the bundle simple.
*/
(function () {
  const { useState, useEffect, useMemo } = React;

  // Default initial state
  const defaultState = {
    lockables: [
      { id: 'casa', name: 'Casa', icon: '🏠', color: '#0ea5e9' },
      { id: 'auto', name: 'Auto', icon: '🚗', color: '#0ea5e9' },
      { id: 'oficina', name: 'Oficina', icon: '🏢', color: '#0ea5e9' },
    ],
    entries: [],
    prefs: {
      theme: 'system',
      confirmNote: false,
      quickNoteSuggestions: ['Salí apurado', 'Doble chequeo', 'Con alarma'],
    },
  };

  /**
   * Hook to persist state to localStorage
   */
  function useLocalStorage(key, defaultValue) {
    const [state, setState] = useState(() => {
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
      } catch {
        return defaultValue;
      }
    });
    useEffect(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    }, [key, state]);
    return [state, setState];
  }

  /**
   * Compute a readable text color (black or white) for a given hex background color.
   */
  function readableTextColor(hex) {
    try {
      const c = hex.replace('#', '');
      const r = parseInt(c.slice(0, 2), 16);
      const g = parseInt(c.slice(2, 4), 16);
      const b = parseInt(c.slice(4, 6), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 140 ? '#18181b' : '#ffffff';
    } catch {
      return '#ffffff';
    }
  }

  /**
   * Generate a simple UUID (not RFC compliant but sufficient for local use).
   */
  function uid() {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Format a date as dd/mm/yyyy hh:mm
   */
  function formatDateTime(date) {
    return date.toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  function App() {
    // Persistent state
    const [state, setState] = useLocalStorage('lockLoggerData', defaultState);
    // Search term for history
    const [filter, setFilter] = useState('');

    // Derived dark mode based on preferences and system
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark =
      state.prefs.theme === 'dark' ||
      (state.prefs.theme === 'system' && prefersDark);

    // Apply dark class to body and update meta theme-color
    useEffect(() => {
      document.body.classList.toggle('dark', isDark);
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute(
          'content',
          isDark ? state.lockables[0]?.color || '#18181b' : state.lockables[0]?.color || '#fafafa'
        );
      }
    }, [isDark, state.lockables]);

    /**
     * Record a new entry for a lockable. Optionally with a note.
     */
    function recordEntry(lockable) {
      let note;
      if (state.prefs.confirmNote) {
        note = window.prompt('Nota opcional:', '');
      }
      const entry = {
        id: uid(),
        lockableId: lockable.id,
        tsISO: new Date().toISOString(),
        note: note || undefined,
      };
      setState((prev) => ({
        ...prev,
        entries: [entry, ...prev.entries].slice(0, 200), // cap to 200 for performance
      }));
    }

    /**
     * Add a new lockable via prompts (emoji, name, color).
     */
    function addLockable() {
      const name = window.prompt('Nombre del elemento (ej. Departamento, Bici):');
      if (!name) return;
      const icon = window.prompt('Emoji para el elemento (ej. 🏠):', '🔒');
      if (!icon) return;
      const color = window.prompt('Color en hex (ej. #0ea5e9):', '#0ea5e9');
      const id = uid();
      const newLockable = { id, name, icon, color };
      setState((prev) => ({
        ...prev,
        lockables: [...prev.lockables, newLockable],
      }));
    }

    /**
     * Undo the most recent entry.
     */
    function undoLast() {
      setState((prev) => ({
        ...prev,
        entries: prev.entries.slice(1),
      }));
    }

    /**
     * Export data as JSON file.
     */
    function exportData() {
      const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lock-logger-data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    /**
     * Import data from file input.
     */
    function importData(ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          // Basic validation
          if (!Array.isArray(data.lockables) || !Array.isArray(data.entries)) {
            throw new Error('Formato inválido');
          }
          setState({
            lockables: data.lockables.map((l) => ({
              id: String(l.id || uid()),
              name: String(l.name || 'Sin nombre'),
              icon: String(l.icon || '🔒'),
              color: String(l.color || '#0ea5e9'),
            })),
            entries: data.entries.map((e) => ({
              id: String(e.id || uid()),
              lockableId: String(e.lockableId || data.lockables[0]?.id || 'casa'),
              tsISO: new Date(e.tsISO || new Date()).toISOString(),
              note: e.note ? String(e.note) : undefined,
            })),
            prefs: {
              theme: ['system', 'light', 'dark'].includes(data.prefs?.theme)
                ? data.prefs.theme
                : 'system',
              confirmNote: !!data.prefs?.confirmNote,
              quickNoteSuggestions: Array.isArray(data.prefs?.quickNoteSuggestions)
                ? data.prefs.quickNoteSuggestions.map(String)
                : ['Salí apurado', 'Doble chequeo', 'Con alarma'],
            },
          });
        } catch (err) {
          alert('No se pudo importar: ' + err.message);
        }
      };
      reader.readAsText(file);
      // reset the input so the same file can be imported again later
      ev.target.value = '';
    }

    /**
     * Share the last entry via Web Share API or clipboard.
     */
    function shareLast() {
      if (state.entries.length === 0) {
        alert('No hay registros aún.');
        return;
      }
      const last = state.entries[0];
      const lock = state.lockables.find((l) => l.id === last.lockableId);
      const msg = `Último registro: ${lock ? lock.name : last.lockableId} a las ${formatDateTime(
        new Date(last.tsISO)
      )}`;
      if (navigator.share) {
        navigator
          .share({
            title: '¿Cerré con llave?',
            text: msg,
          })
          .catch(() => {
            // fallback to clipboard
            navigator.clipboard
              .writeText(msg)
              .then(() => alert('Copiado al portapapeles'))
              .catch(() => {});
          });
      } else if (navigator.clipboard) {
        navigator.clipboard
          .writeText(msg)
          .then(() => alert('Copiado al portapapeles'))
          .catch(() => {});
      } else {
        alert(msg);
      }
    }

    /**
     * Compute streak: number of consecutive days with at least one entry.
     */
    const streak = useMemo(() => {
      if (state.entries.length === 0) return 0;
      const daysWithEntry = new Set(
        state.entries.map((e) => {
          const d = new Date(e.tsISO);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
      );
      let count = 0;
      let date = new Date();
      date.setHours(0, 0, 0, 0);
      while (daysWithEntry.has(date.getTime())) {
        count++;
        date.setDate(date.getDate() - 1);
      }
      return count;
    }, [state.entries]);

    /**
     * Compute last 7 days of entries for bar chart.
     */
    const last7 = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // bucket counts by day
      const buckets = {};
      state.entries.forEach((e) => {
        const d = new Date(e.tsISO);
        d.setHours(0, 0, 0, 0);
        const key = d.getTime();
        buckets[key] = (buckets[key] || 0) + 1;
      });
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.getTime();
        const label = d.toLocaleDateString('es-AR', { weekday: 'short' });
        result.push({ label, count: buckets[key] || 0 });
      }
      return result;
    }, [state.entries]);

    /**
     * Filtered entries based on search term.
     */
    const filteredEntries = useMemo(() => {
      const term = filter.trim().toLowerCase();
      if (!term) return state.entries;
      return state.entries.filter((e) => {
        const lock = state.lockables.find((l) => l.id === e.lockableId);
        const name = lock ? lock.name.toLowerCase() : '';
        const note = (e.note || '').toLowerCase();
        return name.includes(term) || note.includes(term);
      });
    }, [filter, state.entries, state.lockables]);

    /**
     * Update theme preference
     */
    function updateTheme(theme) {
      setState((prev) => ({
        ...prev,
        prefs: { ...prev.prefs, theme },
      }));
    }

    /**
     * JSX rendering
     */
    return React.createElement(
      'div',
      { className: 'container' },
      // Title
      React.createElement('h1', null, '¿Cerré con llave?'),
      // Theme selector
      React.createElement(
        'div',
        { className: 'theme-toggle' },
        React.createElement('label', null, 'Tema:'),
        React.createElement(
          'select',
          {
            value: state.prefs.theme,
            onChange: (e) => updateTheme(e.target.value),
          },
          React.createElement('option', { value: 'system' }, 'Automático'),
          React.createElement('option', { value: 'light' }, 'Claro'),
          React.createElement('option', { value: 'dark' }, 'Oscuro')
        )
      ),
      // Lockables buttons
      React.createElement(
        'div',
        { className: 'lockables' },
        state.lockables.map((lock) =>
          React.createElement(
            'button',
            {
              key: lock.id,
              className: 'lockable-button',
              style: {
                backgroundColor: lock.color,
                color: readableTextColor(lock.color),
              },
              onClick: () => recordEntry(lock),
            },
            `${lock.icon}  ${lock.name}`
          )
        )
      ),
      // Floating add button
      React.createElement(
        'button',
        {
          className: 'fab',
          onClick: addLockable,
          title: 'Agregar elemento',
        },
        '+'
      ),
      // Controls: undo, export, import, share
      React.createElement(
        'div',
        { className: 'controls' },
        React.createElement(
          'button',
          {
            onClick: undoLast,
            disabled: state.entries.length === 0,
            style: { opacity: state.entries.length === 0 ? 0.5 : 1 },
          },
          'Deshacer'
        ),
        React.createElement(
          'button',
          { onClick: exportData },
          'Exportar'
        ),
        React.createElement(
          'label',
          { style: { flex: '1 1 calc(50% - 0.5rem)' } },
          React.createElement('input', {
            type: 'file',
            accept: 'application/json',
            onChange: importData,
          }),
          React.createElement(
            'span',
            {
              style: {
                display: 'inline-block',
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                backgroundColor: 'var(--primary)',
                color: 'white',
                textAlign: 'center',
                cursor: 'pointer',
              },
            },
            'Importar'
          )
        ),
        React.createElement(
          'button',
          { onClick: shareLast },
          'Compartir'
        )
      ),
      // Stats section
      React.createElement(
        'div',
        { className: 'stats' },
        React.createElement('h2', null, `Racha: ${streak} día${streak === 1 ? '' : 's'}`),
        React.createElement(
          'div',
          { className: 'bar-container' },
          last7.map((d) =>
            React.createElement(
              'div',
              { key: d.label, className: 'bar' },
              React.createElement('div', {
                style: {
                  height: `${d.count * 20}px`,
                  width: '100%',
                  backgroundColor: 'var(--primary)',
                  borderRadius: '0.25rem 0.25rem 0 0',
                  transition: 'height 0.3s ease',
                },
              }),
              React.createElement(
                'div',
                { className: 'bar-label' },
                d.label
              )
            )
          )
        )
      ),
      // History search and list
      React.createElement(
        'div',
        { className: 'history' },
        React.createElement('h2', null, 'Historial'),
        React.createElement('input', {
          className: 'search-input',
          type: 'search',
          placeholder: 'Buscar...',
          value: filter,
          onChange: (e) => setFilter(e.target.value),
        }),
        filteredEntries.length === 0
          ? React.createElement('p', null, 'Sin registros.')
          : filteredEntries.map((e) => {
              const lock = state.lockables.find((l) => l.id === e.lockableId);
              return React.createElement(
                'div',
                { key: e.id, className: 'history-entry' },
                React.createElement(
                  'div',
                  null,
                  React.createElement('strong', null, lock ? `${lock.icon} ${lock.name}` : e.lockableId),
                  ' — ',
                  formatDateTime(new Date(e.tsISO))
                ),
                e.note
                  ? React.createElement('div', { style: { fontSize: '0.85rem', opacity: 0.8 } }, e.note)
                  : null
              );
            })
      )
    );
  }

  // Register service worker for PWA install
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./service-worker.js')
        .catch((err) => console.error('SW registration failed', err));
    });
  }

  // Render the app
  ReactDOM.render(React.createElement(App), document.getElementById('root'));
})();