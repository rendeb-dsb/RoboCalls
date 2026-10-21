(() => {
  'use strict';

  const DB_NAME = 'RoboCallsDB';
  const DB_VERSION = 1;
  const STORE = 'outcomes';
  const labels = [
    'Voice mail left',
    'Offline',
    'Mailbox full',
    'Mailbox not set up',
    'Challenge call',
    'No robocalls',
    'Moved',
    'Skip',
    "Number doesn't match caller",
    'Spoke full message',
    'Refused - Hung up'
  ];

  const tbody = document.getElementById('outcomes');
  const goalInput = document.getElementById('goal');
  const countDisplay = document.getElementById('count');
  const remainingDisplay = document.getElementById('remaining');
  const message = document.getElementById('message');

  let db;
  let counts = labels.map(() => 0);
  let resetTimer = null;
  let activeRadio = null;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => { db = request.result; resolve(); };
      request.onerror = () => reject(request.error);
    });
  }

  function loadCounts() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => {
        const stored = request.result || [];
        counts = labels.map((_, i) => {
          const row = stored.find(item => item.id === i);
          return row && Number.isInteger(row.count) && row.count >= 0 ? row.count : 0;
        });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  function saveAllCounts() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      counts.forEach((count, id) => store.put({ id, label: labels[id], count }));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function renderRows() {
    tbody.replaceChildren();
    labels.forEach((label, i) => {
      const tr = document.createElement('tr');

      const radioCell = document.createElement('td');
      radioCell.className = 'radio-cell';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'outcome';
      radio.value = String(i);
      radio.setAttribute('aria-label', `Record ${label}`);
      radio.addEventListener('change', () => recordOutcome(i, radio));
      radioCell.appendChild(radio);

      const countCell = document.createElement('td');
      countCell.className = 'count-col';
      const count = document.createElement('span');
      count.className = 'count';
      count.id = `count-${i}`;
      count.textContent = String(counts[i]);
      countCell.appendChild(count);

      const labelCell = document.createElement('td');
      labelCell.className = 'outcome-label';
      labelCell.textContent = label;

      tr.append(radioCell, countCell, labelCell);
      tbody.appendChild(tr);
    });
    updateProgress();
  }

  function getGoal() {
    const n = Number(goalInput.value);
    return Number.isInteger(n) && n >= 0 && n < 1000 ? n : 0;
  }

  function updateProgress() {
    const total = counts.reduce((sum, n) => sum + n, 0);
    const goal = getGoal();
    countDisplay.textContent = `Count: ${total}`;
    remainingDisplay.textContent = `Remaining: ${Math.max(0, goal - total)}`;
    message.textContent = total >= goal ? 'Goal reached!' : '';
  }

  async function recordOutcome(index, radio) {
    if (resetTimer) clearTimeout(resetTimer);
    if (activeRadio && activeRadio !== radio) activeRadio.checked = false;
    activeRadio = radio;
    counts[index] += 1;
    const countElement = document.getElementById(`count-${index}`);
    countElement.textContent = String(counts[index]);
    countElement.classList.add('highlight');
    updateProgress();

    try {
      await saveAllCounts();
    } catch (error) {
      message.textContent = 'Could not save the count. Please try again.';
      console.error(error);
    }

    resetTimer = setTimeout(() => {
      radio.checked = false;
      activeRadio = null;
      resetTimer = null;
    }, 2000);
  }

  function clearAllCounts() {
    counts = labels.map(() => 0);
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = null;
    if (activeRadio) activeRadio.checked = false;
    activeRadio = null;
    renderRows();
    saveAllCounts().catch(error => {
      message.textContent = 'Could not save the reset. Please try again.';
      console.error(error);
    });
  }

  goalInput.addEventListener('input', () => {
    const raw = goalInput.value;
    if (raw !== '' && (!Number.isInteger(Number(raw)) || Number(raw) < 0 || Number(raw) > 999)) {
      goalInput.setCustomValidity('Enter an integer from 0 through 999.');
    } else {
      goalInput.setCustomValidity('');
    }
    updateProgress();
  });

  goalInput.addEventListener('blur', () => {
    if (goalInput.value === '' || !Number.isInteger(Number(goalInput.value)) || Number(goalInput.value) < 0 || Number(goalInput.value) > 999) {
      goalInput.value = '0';
    }
    goalInput.setCustomValidity('');
    clearAllCounts();
  });

  async function start() {
    try {
      await openDatabase();
      await loadCounts();
      renderRows();
    } catch (error) {
      message.textContent = 'IndexedDB is unavailable. Please open this app in a supported browser.';
      console.error(error);
      renderRows();
    }
  }

  start();
})();
