(() => {
  'use strict';

  const DB_NAME = 'RoboCallsDB';
  const DB_VERSION = 4;
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
    'Spoke full message',
    'Refused - Hung up'
  ];

  const tbody = document.getElementById('outcomes');
  const goalInput = document.getElementById('goal');
  const countDisplay = document.getElementById('count');
  const remainingDisplay = document.getElementById('remaining');
  const blockCountDisplay = document.getElementById('blockCount');
  const newBlockCheck = document.getElementById('newBlockCheck');
  const message = document.getElementById('message');
  const dateButton = document.getElementById('dateButton');
  const datePicker = document.getElementById('datePicker');
  const doneButton = document.getElementById('doneButton');
  const removeLastButton = document.getElementById('removeLastButton');
  const keepLitCheck = document.getElementById('keepLitCheck');
  const pausedCheck = document.getElementById('pausedCheck');
  const resetButton = document.getElementById('resetButton');
  const listButton = document.getElementById('listButton');
  const backButton = document.getElementById('backButton');
  const mainScreen = document.getElementById('mainScreen');
  const listScreen = document.getElementById('listScreen');
  const historyHead = document.getElementById('historyHead');
  const historyBody = document.getElementById('historyBody');
  const elapsedDisplay = document.getElementById('elapsed');

  let db;
  let counts = labels.map(() => 0);
  let selectedIndex = null;
  let lastCountIndex = null;
  let lastCountWasRemoved = false;
  let resetTimer = null;
  let currentDate = localDateString(new Date());
  let goal = 0;
  let blockCount = 30;
  let saving = false;
  let elapsedSeconds = 0;
  let elapsedInterval = null;
  let timerStopped = false;
  let keepLit = false;
  let timerPaused = false;
  let wakeLock = null;

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
      request.onupgradeneeded = (event) => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'date' });
        } else if (event.oldVersion < 3) {
          const store = request.transaction.objectStore(STORE);
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const record = cursor.value;
            if (Array.isArray(record.counts) && record.counts.length >= 11) {
              record.counts.splice(8, 1);
              record.total = record.counts.reduce((sum, n) => sum + (Number(n) || 0), 0);
              cursor.update(record);
            }
            cursor.continue();
          };
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
      time: elapsedSeconds,
      blockCount,
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
        elapsedSeconds = Number.isInteger(record.time) && record.time >= 0 ? record.time : 0;
        blockCount = Number.isInteger(record.blockCount) && record.blockCount >= 0 && record.blockCount <= 30 ? record.blockCount : 30;
      } else {
        counts = labels.map(() => 0);
        goal = 0;
        elapsedSeconds = 0;
        blockCount = 30;
      }
      blockCountDisplay.textContent = `Block Count: ${blockCount}`;
      newBlockCheck.checked = true;
      goalInput.value = String(goal);
      renderRows();
      elapsedDisplay.textContent = formatElapsed(elapsedSeconds);
      timerStopped = false;
      if (elapsedInterval) clearInterval(elapsedInterval);
      elapsedInterval = null;
      message.textContent = '';
      if (!timerPaused) startElapsedTimer();
    } catch (error) {
      message.textContent = 'Could not load this day’s counts.';
      console.error(error);
      renderRows();
    }
  }

  function totalCount() {
    return counts.reduce((sum, n) => sum + n, 0);
  }

  function formatPercent(value, total) {
    return `${total > 0 ? (value * 100 / total).toFixed(1) : '0.0'}%`;
  }

  function updatePercentages() {
    const total = totalCount();
    counts.forEach((value, i) => {
      const element = document.getElementById(`percent-${i}`);
      if (element) element.textContent = formatPercent(value, total);
    });
  }

  function showGoalReachedPopup() {
    window.alert('The RoboCall app says:\nGoal reached!');
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
    blockCountDisplay.textContent = `Block Count: ${blockCount}`;
    goalInput.disabled = total > 0;
    updatePercentages();
    if (total >= goal) {
      message.textContent = '';
      saveWithMessage();
    } else {
      message.textContent = '';
    }
  }

  function resetStyling() {
    document.querySelectorAll('.count, .percent-value, .outcome-label').forEach(el => {
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

      const percentCell = document.createElement('td');
      percentCell.className = 'percent-col';
      const percent = document.createElement('span');
      percent.className = 'percent-value';
      percent.id = `percent-${i}`;
      percent.textContent = formatPercent(counts[i], totalCount());
      percentCell.appendChild(percent);

      const labelCell = document.createElement('td');
      labelCell.className = 'outcome-label';
      labelCell.textContent = label;
      tr.append(radioCell, countCell, labelCell, percentCell);
      tbody.appendChild(tr);
    });
    updateProgress();
  }

  async function recordOutcome(index, radio) {
    if (pausedCheck.checked) {
      pausedCheck.checked = false;
      timerPaused = false;
      if (!timerStopped) startElapsedTimer();
    }
    if (resetTimer) clearTimeout(resetTimer);
    resetStyling();
    document.querySelectorAll('input[name="outcome"]').forEach(el => {
      if (el !== radio) el.checked = false;
    });
    newBlockCheck.checked = false;
    selectedIndex = index;
    lastCountIndex = index;
    lastCountWasRemoved = false;
    counts[index] += 1;
    const previousTotal = totalCount() - 1;
    blockCount = Math.max(0, blockCount - 1);
    blockCountDisplay.textContent = `Block Count: ${blockCount}`;
    if (blockCount === 0) window.alert('The RoboCalls app says:\nGet a new block');
    const countElement = document.getElementById(`count-${index}`);
    countElement.textContent = String(counts[index]);
    countElement.classList.add('highlight');
    const outcomeElement = countElement.closest('tr').querySelector('.outcome-label');
    outcomeElement.classList.add('highlight');
    const percentElement = document.getElementById(`percent-${index}`);
    percentElement.classList.add('highlight');
    updateProgress();
    if (previousTotal < goal && totalCount() >= goal) showGoalReachedPopup();
    await saveWithMessage();

    resetTimer = setTimeout(() => {
      radio.checked = false;
      selectedIndex = null;
      resetTimer = null;
    }, 2000);
  }

  newBlockCheck.addEventListener('change', async () => {
    if (newBlockCheck.checked) {
      blockCount = 30;
      blockCountDisplay.textContent = 'Block Count: 30';
      await saveWithMessage();
    }
  });

  goalInput.addEventListener('input', () => {
    const n = Number(goalInput.value);
    if (goalInput.value !== '' && (!Number.isInteger(n) || n < 0 || n > 999)) {
      goalInput.setCustomValidity('Enter an integer from 0 through 999.');
    } else {
      goalInput.setCustomValidity('');
      goal = goalInput.value === '' ? 0 : n;
      updateProgress();
      if (totalCount() < goal && !timerPaused && !elapsedInterval) {
        timerStopped = false;
        startElapsedTimer();
      }
    }
  });

  goalInput.addEventListener('blur', () => {
    goal = validGoalOrZero();
    goalInput.value = String(goal);
    goalInput.setCustomValidity('');
    updateProgress();
    if (totalCount() < goal && !timerPaused && !elapsedInterval) {
      timerStopped = false;
      startElapsedTimer();
    }
  });

  const confirmDialog = document.getElementById('confirmDialog');
  const confirmYes = document.getElementById('confirmYes');
  const confirmNo = document.getElementById('confirmNo');
  let pendingConfirmAction = null;
  function askConfirmation(action) {
    pendingConfirmAction = action;
    confirmDialog.hidden = false;
  }
  function closeConfirmation(confirmed) {
    confirmDialog.hidden = true;
    const action = pendingConfirmAction;
    pendingConfirmAction = null;
    if (confirmed && action) action();
  }
  confirmYes.addEventListener('click', () => closeConfirmation(true));
  confirmNo.addEventListener('click', () => closeConfirmation(false));

  doneButton.addEventListener('click', () => askConfirmation(async () => {
    stopElapsedTimer();
    goal = validGoalOrZero();
    goalInput.value = String(goal);
    await saveWithMessage();
    message.textContent = totalCount() >= goal ? '' : 'Counts saved for this day.';
  }));


  removeLastButton.addEventListener('click', async () => {
    if (pausedCheck.checked) {
      pausedCheck.checked = false;
      timerPaused = false;
      if (!timerStopped) startElapsedTimer();
    }
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
    const removedRow = countElement.closest('tr');
    removedRow.querySelector('.outcome-label').classList.add('removed');
    document.getElementById(`percent-${lastCountIndex}`).classList.add('removed');
    updatePercentages();
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



  function formatElapsed(n) {
    return [Math.floor(n/3600), Math.floor((n%3600)/60), n%60].map(v=>String(v).padStart(2,'0')).join(':');
  }
  function startElapsedTimer() {
    if (elapsedInterval || timerStopped || timerPaused) return;
    elapsedInterval=setInterval(()=>{ elapsedSeconds++; elapsedDisplay.textContent=formatElapsed(elapsedSeconds); },1000);
  }
  function stopElapsedTimer() {
    timerStopped=true;
    if(elapsedInterval) clearInterval(elapsedInterval);
    elapsedInterval=null;
  }
  function resetElapsedTimer() {
    if(elapsedInterval) clearInterval(elapsedInterval);
    elapsedInterval=null; elapsedSeconds=0; timerStopped=false;
    elapsedDisplay.textContent='00:00:00'; startElapsedTimer();
  }

  pausedCheck.addEventListener('change', () => {
    timerPaused = pausedCheck.checked;
    if (timerPaused) {
      if (elapsedInterval) clearInterval(elapsedInterval);
      elapsedInterval = null;
    } else {
      startElapsedTimer();
    }
  });
  async function buildHistoryTable() {
    historyHead.replaceChildren(); historyBody.replaceChildren();
    const records=await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly'), req=tx.objectStore(STORE).getAll();
      req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error);
    }).catch(e=>{console.error(e);return [];});
    records.sort((a,b)=>b.date.localeCompare(a.date));
    const hr=document.createElement('tr');
    const rh=document.createElement('th'); rh.className='sticky-radio'; rh.textContent='Radio';
    const oh=document.createElement('th'); oh.className='sticky-outcome'; oh.textContent='Outcome';
    hr.append(rh,oh);
    records.forEach(r=>{
      const th=document.createElement('th');th.className='history-date';
      const date=new Date(`${r.date}T12:00:00`);
      const weekday=document.createElement('div');weekday.textContent=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
      const dayMonth=document.createElement('div');dayMonth.textContent=`${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`;
      const savedTime=document.createElement('div');savedTime.className='saved-time';savedTime.textContent=formatElapsed(Number.isInteger(r.time) && r.time >= 0 ? r.time : 0);
      const savedGoal = Number.isInteger(r.goal) && r.goal >= 0 ? r.goal : 0;
      const savedCount = Number.isInteger(r.total) ? r.total : (Array.isArray(r.counts) ? r.counts.reduce((sum,n)=>sum+(Number(n)||0),0) : 0);
      const goalLine=document.createElement('div');goalLine.className='history-goal';goalLine.textContent=`Goal: ${savedGoal}`;
      const countLine=document.createElement('div');countLine.className='history-total';countLine.textContent=`Count: ${savedCount}`;
      countLine.style.color = savedCount < savedGoal ? '#d00000' : '#168a36';
      th.append(weekday,dayMonth,savedTime,goalLine,countLine);hr.appendChild(th);
    });
    historyHead.appendChild(hr);
    labels.forEach((label,i)=>{
      const tr=document.createElement('tr');
      const rc=document.createElement('td');rc.className='sticky-radio';
      const radio=document.createElement('input');radio.type='radio';radio.name='historyOutcome';radio.setAttribute('aria-label',`Select ${label}`);rc.appendChild(radio);
      const oc=document.createElement('td');oc.className='sticky-outcome';oc.textContent=label;tr.append(rc,oc);
      records.forEach(r=>{const td=document.createElement('td');td.className='history-date';td.textContent=String(Number.isInteger(r.counts?.[i])?r.counts[i]:0);tr.appendChild(td);});
      historyBody.appendChild(tr);
    });
  }
  listButton.addEventListener('click',async()=>{mainScreen.hidden=true;listScreen.hidden=false;listButton.classList.add('active');await buildHistoryTable();});
  backButton.addEventListener('click',()=>{listScreen.hidden=true;mainScreen.hidden=false;listButton.classList.remove('active');renderRows();});
  resetButton.addEventListener('click',()=>askConfirmation(async()=>{
    counts=labels.map(()=>0); selectedIndex=null; lastCountIndex=null; lastCountWasRemoved=false;
    blockCount=30; blockCountDisplay.textContent='Block Count: 30'; newBlockCheck.checked=true;
    if(resetTimer)clearTimeout(resetTimer); resetTimer=null;
    document.querySelectorAll('input[name="outcome"]').forEach(el=>el.checked=false);
    resetStyling(); renderRows(); resetElapsedTimer(); await saveWithMessage();
    message.textContent='Counters reset.';
  }));

  async function setKeepLit(enabled) {
    keepLit = enabled;
    if (keepLit) {
      if ('wakeLock' in navigator && navigator.wakeLock?.request) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => { wakeLock = null; });
        } catch (error) {
          message.textContent = 'Keep Lit is checked, but this browser could not prevent screen sleep.';
          console.warn('Wake Lock request failed:', error);
        }
      } else {
        message.textContent = 'Keep Lit is checked, but this browser does not support screen wake lock.';
      }
    } else if (wakeLock) {
      try { await wakeLock.release(); } catch (error) { console.warn(error); }
      wakeLock = null;
    }
  }

  keepLitCheck.addEventListener('change', () => setKeepLit(keepLitCheck.checked));

  async function reacquireWakeLock() {
    if (document.visibilityState === 'visible' && keepLitCheck.checked && !wakeLock && 'wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch (error) {
        console.warn('Could not reacquire screen wake lock:', error);
      }
    }
  }
  document.addEventListener('visibilitychange', reacquireWakeLock);
  window.addEventListener('focus', reacquireWakeLock);

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
