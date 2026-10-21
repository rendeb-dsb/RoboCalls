(() => {
  'use strict';

  const DB_NAME = 'RoboCallsDB';
  const DB_VERSION = 2;
  const STORE = 'dailyRecords';
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
  const dateButton = document.getElementById('dateButton');
  const datePicker = document.getElementById('datePicker');
  const doneButton = document.getElementById('doneButton');
  const removeLastButton = document.getElementById('removeLastButton');

  let db;
  let counts = labels.map(() => 0);
  let selectedIndex = null;
  let lastCountIndex = null;
  let lastCountWasRemoved = false;
  let resetTimer = null;
  let currentDate = localDateString(new Date());
  let goal = 0;
  let saving = false;

  function localDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function prettyDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'date' });
        }
      };
      request.onsuccess = () => { db = request.result; resolve(); };
      request.onerror = () => reject(request.error);
    });
  }

  function readDay(date) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(date);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  function writeDay() {
    const record = {
      date: currentDate,
      goal,
      counts: [...counts],
      total: counts.reduce((sum, n) => sum + n, 0),
      updatedAt: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function saveWithMessage() {
    try {
      saving = true;
      await writeDay();
      saving = false;
    } catch (error) {
      saving = false;
      message.textContent = 'Could not save today’s counts. Please try again.';
      console.error(error);
    }
  }

  async function loadDay(date) {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = null;
    selectedIndex = null;
    lastCountIndex = null;
    lastCountWasRemoved = false;
    currentDate = date;
    dateButton.textContent = prettyDate(currentDate);
    datePicker.value = currentDate;
    try {
      const record = await readDay(currentDate);
      if (record) {
        counts = labels.map((_, i) => Number.isInteger(record.counts?.[i]) && record.counts[i] >= 0 ? record.counts[i] : 0);
        goal = Number.isInteger(record.goal) && record.goal >= 0 && record.goal <= 999 ? record.goal : 0;
      } else {
        counts = labels.map(() => 0);
        goal = 0;
      }
      goalInput.value = String(goal);
      renderRows();
      message.textContent = totalCount() >= goal ? 'Goal reached!' : '';
    } catch (error) {
      message.textContent = 'Could not load this day’s counts.';
      console.error(error);
      renderRows();
    }
  }

  function totalCount() {
    return counts.reduce((sum, n) => sum + n, 0);
  }

  function validGoalOrZero() {
    const n = Number(goalInput.value);
    if (goalInput.value === '' || !Number.isInteger(n) || n < 0 || n > 999) return 0;
    return n;
  }

  function updateProgress() {
    const total = totalCount();
    countDisplay.textContent = `Count: ${total}`;
    remainingDisplay.textContent = `Remaining: ${Math.max(0, goal - total)}`;
    if (total >= goal) {
      message.textContent = 'Goal reached!';
      saveWithMessage();
    } else {
      message.textContent = '';
    }
  }

  function resetStyling() {
    document.querySelectorAll('.count').forEach(el => {
      el.classList.remove('highlight', 'removed');
      el.style.color = '';
      el.style.fontWeight = '';
    });
    document.querySelectorAll('.outcome-label').forEach(el => {
      el.style.color = '';
      el.style.fontWeight = '';
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
      radio.checked = selectedIndex === i;
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

  async function recordOutcome(index, radio) {
    if (resetTimer) clearTimeout(resetTimer);
    resetStyling();
    document.querySelectorAll('input[name="outcome"]').forEach(el => {
      if (el !== radio) el.checked = false;
    });
    selectedIndex = index;
    lastCountIndex = index;
    lastCountWasRemoved = false;
    counts[index] += 1;
    const countElement = document.getElementById(`count-${index}`);
    countElement.textContent = String(counts[index]);
    countElement.classList.add('highlight');
    updateProgress();
    await saveWithMessage();

    resetTimer = setTimeout(() => {
      radio.checked = false;
      selectedIndex = null;
      resetTimer = null;
    }, 2000);
  }

  goalInput.addEventListener('input', () => {
    const n = Number(goalInput.value);
    if (goalInput.value !== '' && (!Number.isInteger(n) || n < 0 || n > 999)) {
      goalInput.setCustomValidity('Enter an integer from 0 through 999.');
    } else {
      goalInput.setCustomValidity('');
      goal = goalInput.value === '' ? 0 : n;
      updateProgress();
    }
  });

  goalInput.addEventListener('blur', async () => {
    if (goalInput.value === '' || !Number.isInteger(Number(goalInput.value)) || Number(goalInput.value) < 0 || Number(goalInput.value) > 999) {
      goalInput.value = '0';
    }
    goal = validGoalOrZero();
    goalInput.setCustomValidity('');
    // Per the original requirement, leaving Goal clears all outcome counters.
    counts = labels.map(() => 0);
    selectedIndex = null;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = null;
    renderRows();
    await saveWithMessage();
  });

  doneButton.addEventListener('click', async () => {
    goal = validGoalOrZero();
    goalInput.value = String(goal);
    await saveWithMessage();
    message.textContent = totalCount() >= goal ? 'Goal reached!' : 'Counts saved for this day.';
  });


  removeLastButton.addEventListener('click', async () => {
    if (lastCountIndex === null || lastCountWasRemoved || counts[lastCountIndex] <= 0) {
      message.textContent = 'There is no recent count to remove.';
      return;
    }
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = null;
    selectedIndex = null;
    document.querySelectorAll('input[name="outcome"]').forEach(el => { el.checked = false; });
    resetStyling();
    counts[lastCountIndex] = Math.max(0, counts[lastCountIndex] - 1);
    const countElement = document.getElementById(`count-${lastCountIndex}`);
    countElement.textContent = String(counts[lastCountIndex]);
    countElement.classList.add('removed');
    lastCountWasRemoved = true;
    updateProgress();
    await saveWithMessage();
    if (totalCount() < goal) message.textContent = 'Last count removed.';
  });

  dateButton.addEventListener('click', () => {
    datePicker.style.pointerEvents = 'auto';
    datePicker.style.opacity = '1';
    datePicker.style.width = 'auto';
    datePicker.style.height = 'auto';
    datePicker.showPicker?.();
    datePicker.focus();
  });

  datePicker.addEventListener('change', async () => {
    if (datePicker.value) {
      await loadDay(datePicker.value);
    }
    datePicker.style.pointerEvents = 'none';
    datePicker.style.opacity = '0';
    datePicker.style.width = '1px';
    datePicker.style.height = '1px';
  });

  datePicker.addEventListener('blur', () => {
    datePicker.style.pointerEvents = 'none';
    datePicker.style.opacity = '0';
    datePicker.style.width = '1px';
    datePicker.style.height = '1px';
  });

  async function start() {
    try {
      await openDatabase();
      await loadDay(currentDate);
    } catch (error) {
      message.textContent = 'IndexedDB is unavailable. Please open this app in a supported browser.';
      console.error(error);
      renderRows();
    }
  }
  start();
})();
