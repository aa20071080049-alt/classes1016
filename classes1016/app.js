'use strict';

(() => {
  const STORAGE_KEY = 'daily-rhythm-v2';
  const dateFormatter = new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const today = localDateString();
  const state = {
    events: [], todos: [], selectedDate: today, todoFilter: 'all', activeTab: 'events', toastTimer: null
  };
  const ui = {
    date: $('#today-date'), dateFilter: $('#event-filter-date'), eventList: $('#schedule-list'),
    todoList: $('#todo-list'), eventCount: $('#schedule-count'), todoCount: $('#todo-count'),
    heroEventCount: $('#hero-event-count'), heroTodoCount: $('#hero-todo-count'), heroDoneCount: $('#hero-done-count'),
    eventDateLabel: $('#event-date-label'), todoSummary: $('#todo-summary'),
    eventPanel: $('#events-panel'), todoPanel: $('#todos-panel'), modal: $('#item-modal'),
    form: $('#item-form'), toast: $('#toast'), quickForm: $('#quick-event-form')
  };

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function createId() {
    return window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function showToast(message) {
    $('#toast-message').textContent = message;
    ui.toast.classList.add('show');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => ui.toast.classList.remove('show'), 2500);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        events: state.events, todos: state.todos, selectedDate: state.selectedDate,
        todoFilter: state.todoFilter, activeTab: state.activeTab
      }));
      return true;
    } catch (error) {
      console.error('無法保存行程資料。', error);
      showToast('瀏覽器儲存空間無法使用，資料可能無法保留。');
      return false;
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state.events = Array.isArray(saved.events) ? saved.events : [];
        state.todos = Array.isArray(saved.todos) ? saved.todos : [];
        state.selectedDate = typeof saved.selectedDate === 'string' ? saved.selectedDate : today;
        state.todoFilter = ['all', 'active', 'done'].includes(saved.todoFilter) ? saved.todoFilter : 'all';
        state.activeTab = saved.activeTab === 'todos' ? 'todos' : 'events';
        return;
      }
    } catch (error) {
      console.warn('無法讀取已保存的行程資料，將載入範例。', error);
      showToast('讀取舊資料時發生問題，已載入範例資料。');
    }

    state.events = [
      { id: createId(), title: '晨間例行會議', date: today, time: '09:00', category: '工作', place: '線上會議', note: '和團隊同步本週進度。' },
      { id: createId(), title: '午餐・巷口小食堂', date: today, time: '12:30', category: '生活', place: '巷口小食堂', note: '和雅婷一起吃飯。' },
      { id: createId(), title: '專案提案討論', date: today, time: '15:00', category: '工作', place: '會議室 B', note: '記得帶簡報。' }
    ];
    state.todos = [
      { id: createId(), title: '完成提案簡報', description: '預計 14:30 前完成', status: 'progress' },
      { id: createId(), title: '回覆客戶郵件', description: '確認合作時程與細節', status: 'pending' },
      { id: createId(), title: '預約下週健康檢查', description: '已完成，記得確認時間', status: 'done' }
    ];
    saveState();
  }

  function formatDateLabel(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return dateFormatter.format(new Date(year, month - 1, day));
  }

  function renderHeader() {
    const completed = state.todos.filter((todo) => todo.status === 'done').length;
    const remaining = state.todos.length - completed;
    ui.date.textContent = formatDateLabel(state.selectedDate);
    ui.dateFilter.value = state.selectedDate;
    ui.eventDateLabel.textContent = state.selectedDate === today ? '今天的安排' : formatDateLabel(state.selectedDate);
    ui.heroEventCount.textContent = state.events.filter((event) => event.date === state.selectedDate).length;
    ui.heroTodoCount.textContent = remaining;
    ui.heroDoneCount.textContent = completed;
    ui.todoSummary.textContent = remaining ? `還有 ${remaining} 件待完成，慢慢來也很好。` : '太棒了，所有待辦都完成了！';
    $('#hero-message').textContent = state.selectedDate === today
      ? '從一個小計畫開始，讓每件重要的事都有自己的位置。'
      : '查看每天的安排，讓每件重要的事都有自己的位置。';
  }


  function renderEvents() {
    const items = state.events.filter((event) => event.date === state.selectedDate)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    ui.eventCount.textContent = items.length;
    if (!items.length) {
      const message = state.selectedDate < today ? '換個日期看看，或新增一筆行程。' : '這一天還沒有安排，留點空白也很好。';
      ui.eventList.innerHTML = emptyState('☀️', '目前沒有行程', message,
        '<button class="primary-button" type="button" data-add="event" style="margin:12px auto 0">＋ 新增行程</button>');
      return;
    }
    const now = new Date().toTimeString().slice(0, 5);
    ui.eventList.innerHTML = items.map((event) => {
      const description = [event.place, event.note].filter(Boolean).join(' · ') || '尚未新增備註';
      const isPast = event.date < today || (event.date === today && event.time && event.time < now);
      const isNext = event.date === today && event.time && !isPast && items.every((other) =>
        other.id === event.id || (other.time && other.time <= now));
      return `<article class="schedule-item${isPast ? ' is-past' : ''}${isNext ? ' is-next' : ''}">
        <time class="time" datetime="${escapeHTML(event.time || '00:00')}">${escapeHTML(event.time || '未設定')}</time>
        <span class="timeline-mark" aria-hidden="true"></span>
        <div class="schedule-content"><h3 class="event-title">${escapeHTML(event.title)}</h3><p class="event-meta">${escapeHTML(description)}</p></div>
        <span class="event-tag">${escapeHTML(event.category || '行程')}</span>
        <div class="row-actions">
          <button class="icon-button" type="button" data-edit="event" data-id="${escapeHTML(event.id)}" aria-label="編輯${escapeHTML(event.title)}" title="編輯">✎</button>
          <button class="icon-button danger" type="button" data-delete="event" data-id="${escapeHTML(event.id)}" aria-label="刪除${escapeHTML(event.title)}" title="刪除">⌫</button>
        </div>
      </article>`;
    }).join('');
  }

  function renderTodos() {
    const filtered = state.todos.filter((todo) => {
      if (state.todoFilter === 'active') return todo.status !== 'done';
      if (state.todoFilter === 'done') return todo.status === 'done';
      return true;
    });
    ui.todoCount.textContent = state.todos.length;
    $$('.filter-button').forEach((button) => {
      const active = button.dataset.filter === state.todoFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (!filtered.length) {
      const icon = state.todoFilter === 'done' ? '🌱' : '✨';
      const title = state.todoFilter === 'done' ? '還沒有完成的待辦'
        : state.todoFilter === 'active' ? '太好了，沒有待辦事項' : '清單還是空的';
      const message = state.todoFilter === 'active' ? '要不要新增一件接下來想做的事？' : '把想完成的小事記下來，輕鬆安排。';
      ui.todoList.innerHTML = emptyState(icon, title, message,
        '<button class="primary-button" type="button" data-add="todo" style="margin:12px auto 0">＋ 新增待辦</button>');
      return;
    }
    const statuses = { pending: '尚未開始', progress: '進行中', done: '已完成' };
    const icons = { pending: '☷', progress: '✎', done: '✓' };
    ui.todoList.innerHTML = filtered.map((todo) => `<article class="todo-item${todo.status === 'done' ? ' is-done' : ''}">
      <button class="todo-toggle" type="button" data-toggle-todo="${escapeHTML(todo.id)}" aria-pressed="${todo.status === 'done'}" aria-label="${todo.status === 'done' ? '標記為未完成' : '標記為已完成'}：${escapeHTML(todo.title)}">${todo.status === 'done' ? '✓' : ''}</button>
      <span class="todo-icon" aria-hidden="true">${icons[todo.status] || '☷'}</span>
      <div class="todo-copy"><h3 class="todo-title">${escapeHTML(todo.title)}</h3><p class="todo-detail">${escapeHTML(todo.description || '沒有備註')}</p></div>
      <span class="status status-${todo.status}">${statuses[todo.status] || '尚未開始'}</span>
      <div class="row-actions">
        <button class="icon-button" type="button" data-edit="todo" data-id="${escapeHTML(todo.id)}" aria-label="編輯${escapeHTML(todo.title)}" title="編輯">✎</button>
        <button class="icon-button danger" type="button" data-delete="todo" data-id="${escapeHTML(todo.id)}" aria-label="刪除${escapeHTML(todo.title)}" title="刪除">⌫</button>
      </div>
    </article>`).join('');
  }

  function render() {
    renderHeader();
    renderEvents();
    renderTodos();
    const showTodos = state.activeTab === 'todos';
    ui.eventPanel.hidden = showTodos;
    ui.todoPanel.hidden = !showTodos;
    $('#events-tab').classList.toggle('active', !showTodos);
    $('#todos-tab').classList.toggle('active', showTodos);
    $('#events-tab').setAttribute('aria-selected', String(!showTodos));
    $('#todos-tab').setAttribute('aria-selected', String(showTodos));
  }

  function setTab(tab) {
    state.activeTab = tab;
    saveState();
    render();
  }

  function setTodoFilter(filter) {
    state.todoFilter = filter;
    saveState();
    renderTodos();
    renderHeader();
  }

  function openModal(kind, item = null) {
    const isEditing = Boolean(item);
    const isEvent = kind === 'event';
    ui.form.reset();
    $('#modal-error').textContent = '';
    $('#item-kind').value = kind;
    $('#item-id').value = item ? item.id : '';
    $('#modal-title').textContent = isEditing ? (isEvent ? '編輯行程' : '編輯待辦') : (isEvent ? '新增行程' : '新增待辦');
    $('#modal-description').textContent = isEditing ? '調整一下內容，讓計畫更貼近現在。'
      : (isEvent ? '把重要的安排記下來，為時間留個位置。' : '把想完成的小事寫下來，慢慢完成就好。');
    $('#item-title-label').innerHTML = `${isEvent ? '行程名稱' : '待辦事項'} <span aria-hidden="true">*</span>`;
    $('#item-title').placeholder = isEvent ? '例如：專案討論會' : '例如：整理本週工作計畫';
    $('#item-date-field').hidden = !isEvent;
    $('#item-time-field').hidden = !isEvent;
    $('#item-category-field').hidden = !isEvent;
    $('#item-place-field').hidden = !isEvent;
    $('#item-note-field').hidden = !isEvent;
    $('#item-description-field').hidden = isEvent;
    $('#item-status-field').hidden = isEvent || !isEditing;
    if (item) {
      $('#item-title').value = item.title || '';
      if (isEvent) {
        $('#item-date').value = item.date || state.selectedDate;
        $('#item-time').value = item.time || '';
        $('#item-category').value = item.category || '工作';
        $('#item-place').value = item.place || '';
        $('#item-note').value = item.note || '';
      } else {
        $('#item-description').value = item.description || '';
        $('#item-status').value = item.status || 'pending';
      }
    } else if (isEvent) {
      $('#item-date').value = state.selectedDate;
      $('#item-time').value = '09:00';
      $('#item-category').value = '工作';
    } else {
      $('#item-status').value = 'pending';
    }
    ui.modal.classList.add('open');
    ui.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => $('#item-title').focus());
  }

  function closeModal() {
    ui.modal.classList.remove('open');
    ui.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function findItem(kind, id) {
    return (kind === 'event' ? state.events : state.todos).find((item) => item.id === id);
  }


  function submitModal(event) {
    event.preventDefault();
    const kind = $('#item-kind').value;
    const id = $('#item-id').value;
    const title = $('#item-title').value.trim();
    const error = $('#modal-error');
    if (!title) {
      error.textContent = kind === 'event' ? '請填寫行程名稱。' : '請填寫待辦事項。';
      $('#item-title').focus();
      return;
    }
    if (kind === 'event' && !$('#item-date').value) {
      error.textContent = '請選擇行程日期。';
      $('#item-date').focus();
      return;
    }
    if (kind === 'event') {
      const eventData = {
        id: id || createId(), title, date: $('#item-date').value, time: $('#item-time').value,
        category: $('#item-category').value, place: $('#item-place').value.trim(), note: $('#item-note').value.trim()
      };
      const index = state.events.findIndex((item) => item.id === id);
      if (index >= 0) state.events[index] = eventData;
      else state.events.push(eventData);
      state.selectedDate = eventData.date;
      showToast(index >= 0 ? '行程已更新 ✨' : '行程新增完成 ✨');
    } else {
      const todoData = {
        id: id || createId(), title, description: $('#item-description').value.trim(),
        status: $('#item-status').value || 'pending'
      };
      const index = state.todos.findIndex((item) => item.id === id);
      if (index >= 0) state.todos[index] = todoData;
      else state.todos.unshift(todoData);
      showToast(index >= 0 ? '待辦事項已更新 ✨' : '待辦事項新增完成 ✨');
    }
    saveState();
    closeModal();
    render();
  }

  function deleteItem(kind, id) {
    const item = findItem(kind, id);
    if (!item) return;
    const kindName = kind === 'event' ? '行程' : '待辦事項';
    if (!window.confirm(`確定要刪除「${item.title}」這筆${kindName}嗎？`)) return;
    if (kind === 'event') state.events = state.events.filter((entry) => entry.id !== id);
    else state.todos = state.todos.filter((entry) => entry.id !== id);
    saveState();
    render();
    showToast(`${kindName}已刪除`);
  }

  function toggleTodo(id) {
    const todo = state.todos.find((entry) => entry.id === id);
    if (!todo) return;
    todo.status = todo.status === 'done' ? 'pending' : 'done';
    saveState();
    render();
    showToast(todo.status === 'done' ? '做得好，完成一件小事！' : '已更新待辦狀態');
  }

  function submitQuickEvent(event) {
    event.preventDefault();
    const formData = new FormData(ui.quickForm);
    const title = String(formData.get('title') || '').trim();
    if (!title) {
      $('#quick-event-name').focus();
      return;
    }
    state.events.push({
      id: createId(), title, date: String(formData.get('date') || today),
      time: String(formData.get('time') || ''), category: '工作',
      place: String(formData.get('place') || '').trim(), note: String(formData.get('note') || '').trim()
    });
    state.selectedDate = String(formData.get('date') || today);
    state.activeTab = 'events';
    saveState();
    render();
    ui.quickForm.reset();
    $('#quick-event-date').value = state.selectedDate;
    $('#quick-event-time').value = '09:00';
    showToast('行程新增完成 ✨');
  }

  function bindEvents() {
    $('#events-tab').addEventListener('click', () => setTab('events'));
    $('#todos-tab').addEventListener('click', () => setTab('todos'));
    $('#today-button').addEventListener('click', () => {
      state.selectedDate = today;
      setTab('events');
    });
    ui.dateFilter.addEventListener('change', () => {
      if (!ui.dateFilter.value) return;
      state.selectedDate = ui.dateFilter.value;
      saveState();
      render();
    });
    $$('[data-add]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.add)));
    $$('.filter-button').forEach((button) => button.addEventListener('click', () => setTodoFilter(button.dataset.filter)));
    ui.eventList.addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-edit="event"]');
      const deleteButton = event.target.closest('[data-delete="event"]');
      if (editButton) openModal('event', findItem('event', editButton.dataset.id));
      if (deleteButton) deleteItem('event', deleteButton.dataset.id);
    });
    ui.todoList.addEventListener('click', (event) => {
      const toggleButton = event.target.closest('[data-toggle-todo]');
      const editButton = event.target.closest('[data-edit="todo"]');
      const deleteButton = event.target.closest('[data-delete="todo"]');
      if (toggleButton) toggleTodo(toggleButton.dataset.toggleTodo);
      if (editButton) openModal('todo', findItem('todo', editButton.dataset.id));
      if (deleteButton) deleteItem('todo', deleteButton.dataset.id);
    });
    ui.form.addEventListener('submit', submitModal);
    ui.quickForm.addEventListener('submit', submitQuickEvent);
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-cancel').addEventListener('click', closeModal);
    ui.modal.addEventListener('click', (event) => { if (event.target === ui.modal) closeModal(); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && ui.modal.classList.contains('open')) closeModal();
    });
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        const saved = JSON.parse(event.newValue || '{}');
        state.events = Array.isArray(saved.events) ? saved.events : [];
        state.todos = Array.isArray(saved.todos) ? saved.todos : [];
        render();
        showToast('資料已在另一個分頁更新');
      } catch (error) {
        console.warn('同步其他分頁資料失敗。', error);
      }
    });
  }

  ui.date.textContent = formatDateLabel(today);
  ui.dateFilter.value = today;
  $('#quick-event-date').value = today;
  $('#quick-event-time').value = '09:00';
  loadState();
  bindEvents();
  render();
})();

