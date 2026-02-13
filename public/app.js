// ============================================================
// app.js – Frontend Interactivity
// ============================================================
// This file runs IN THE BROWSER (not on the server).
// It handles everything the user interacts with:
//   - Fetching data from the server's API
//   - Displaying projects and tasks on the page
//   - Handling button clicks, form submissions, etc.
//   - Opening/closing modals (pop-up dialogs)
//   - Showing toast notifications
//
// This one file handles BOTH the index.html page (projects)
// and the project.html page (tasks). It detects which page
// it's on and runs the appropriate code.
// ============================================================

// ── Theme Management ───────────────────────────────────────

// Load saved theme or default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Update theme toggle icon
function updateThemeIcon() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  const currentTheme = document.documentElement.getAttribute('data-theme');
  const icon = themeToggle.querySelector('.theme-icon');
  icon.textContent = currentTheme === 'light' ? '🌙' : '☀️';
}

// Toggle theme function
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon();
}

// Initialize theme toggle button (when DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
  updateThemeIcon();

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
});

// ── Utility Functions ──────────────────────────────────────

/**
 * Show a toast notification (a small message that appears
 * at the bottom-right and disappears after 3 seconds).
 * 
 * @param {string} message - What to show
 * @param {string} type - "success" or "error"
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Remove the toast after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * Open a modal (pop-up dialog).
 * "modal-overlay" is the dark background behind the popup.
 * Adding the "active" class makes it visible.
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('active');
  // Focus the first input inside the modal
  const firstInput = modal.querySelector('input, textarea, select');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
}

/**
 * Close a modal by removing the "active" class.
 */
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

/**
 * Make an API request to our server.
 * This is a helper that wraps the built-in "fetch" function
 * to make it easier to use.
 * 
 * @param {string} url - The API endpoint (e.g. "/api/projects")
 * @param {string} method - GET, POST, PUT, or DELETE
 * @param {object} body - Data to send (for POST/PUT)
 * @returns {object} The response data
 */
async function apiRequest(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

/**
 * Format a date string to a more readable format.
 * Turns "2024-03-15" into "Mar 15, 2024"
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Check if a date is in the past (overdue).
 */
function isOverdue(dateString) {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateString + 'T00:00:00');
  return due < today;
}

/**
 * Get the CSS class name for a status.
 * Converts "To Do" to "todo", "In Progress" to "in-progress", etc.
 */
function statusClass(status) {
  if (status === 'To Do') return 'todo';
  if (status === 'In Progress') return 'in-progress';
  if (status === 'Done') return 'done';
  return 'todo';
}

/**
 * Get the CSS class name for a priority.
 */
function priorityClass(priority) {
  if (priority === 'High') return 'high';
  if (priority === 'Low') return 'low';
  return 'medium';
}

/**
 * Escape HTML to prevent XSS (a type of security vulnerability).
 * If someone types <script> in a task title, this makes it safe.
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


// ============================================================
// DETECT WHICH PAGE WE'RE ON
// ============================================================
// We check the URL to figure out if we're on the main page
// (index.html) or a project page (project.html).

const currentPath = window.location.pathname;
const isProjectPage = currentPath.includes('project.html');

if (isProjectPage) {
  initProjectPage();
} else {
  initIndexPage();
}


// ============================================================
// INDEX PAGE (Projects List)
// ============================================================

function initIndexPage() {
  // ── Get references to HTML elements ────────────────────
  const projectsGrid = document.getElementById('projects-grid');
  const emptyState = document.getElementById('empty-state');
  const projectCount = document.getElementById('project-count');
  const addBtn = document.getElementById('add-project-btn');
  const modal = 'project-modal';
  const modalTitle = document.getElementById('project-modal-title');
  const nameInput = document.getElementById('project-name-input');
  const saveBtn = document.getElementById('project-modal-save');
  const cancelBtn = document.getElementById('project-modal-cancel');
  const confirmModal = 'confirm-modal';
  const confirmDeleteBtn = document.getElementById('confirm-delete');
  const confirmCancelBtn = document.getElementById('confirm-cancel');

  let editingProjectId = null;  // Track if we're editing
  let deletingProjectId = null; // Track which project to delete

  // ── Load and display all projects ───────────────────────
  async function loadProjects() {
    try {
      const projects = await apiRequest('/api/projects');

      // Load task stats for each project
      for (const project of projects) {
        const tasks = await apiRequest(`/api/projects/${project.id}/tasks`);
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'Done').length;
        project.taskCount = totalTasks;
        project.completedCount = completedTasks;
        project.progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      }

      renderProjects(projects);
    } catch (error) {
      showToast('Failed to load projects', 'error');
      console.error(error);
    }
  }

  // ── Render projects as cards ───────────────────────────
  function renderProjects(projects) {
    // Update the count badge
    const count = projects.length;
    projectCount.textContent = `${count} project${count !== 1 ? 's' : ''}`;

    // Show empty state or project grid
    if (count === 0) {
      projectsGrid.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    projectsGrid.style.display = 'grid';

    // Build the HTML for each project card
    projectsGrid.innerHTML = projects.map(project => `
      <div class="project-card" data-id="${project.id}">
        <div class="project-card-actions">
          <button class="icon-btn" onclick="event.stopPropagation(); editProject(${project.id}, '${escapeHtml(project.name).replace(/'/g, "\\'")}')" title="Rename">✏️</button>
          <button class="icon-btn danger" onclick="event.stopPropagation(); confirmDeleteProject(${project.id}, '${escapeHtml(project.name).replace(/'/g, "\\'")}')" title="Delete">🗑️</button>
        </div>
        <div class="project-card-name">${escapeHtml(project.name)}</div>
        <div class="project-card-stats">
          <div class="stat-row">
            <span class="stat-label">${project.completedCount} of ${project.taskCount} tasks</span>
            <span class="stat-value">${project.progressPercent}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${project.progressPercent}%"></div>
          </div>
        </div>
        <div class="project-card-meta">
          <span>Created ${formatDate(project.created_at)}</span>
        </div>
      </div>
    `).join('');

    // Add click handlers to navigate to project page
    projectsGrid.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => {
        const projectId = card.dataset.id;
        window.location.href = `project.html?id=${projectId}`;
      });
    });
  }

  // ── Open modal for NEW project ──────────────────────────
  addBtn.addEventListener('click', () => {
    editingProjectId = null;
    modalTitle.textContent = 'New Project';
    saveBtn.textContent = 'Create';
    nameInput.value = '';
    openModal(modal);
  });

  // ── Open modal for EDITING a project ───────────────────
  // (This function is called from the onclick in the HTML above.
  //  We attach it to "window" so it's accessible from inline HTML.)
  window.editProject = function(id, name) {
    editingProjectId = id;
    modalTitle.textContent = 'Rename Project';
    saveBtn.textContent = 'Save';
    nameInput.value = name;
    openModal(modal);
  };

  // ── Save project (create or update) ────────────────────
  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      showToast('Please enter a project name', 'error');
      return;
    }

    try {
      if (editingProjectId) {
        await apiRequest(`/api/projects/${editingProjectId}`, 'PUT', { name });
        showToast('Project renamed');
      } else {
        await apiRequest('/api/projects', 'POST', { name });
        showToast('Project created');
      }
      closeModal(modal);
      loadProjects();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // ── Cancel button closes modal ──────────────────────────
  cancelBtn.addEventListener('click', () => closeModal(modal));

  // ── Confirm delete ────────────────────────────────────
  window.confirmDeleteProject = function(id, name) {
    deletingProjectId = id;
    document.getElementById('confirm-message').textContent =
      `Are you sure you want to delete "${name}" and all its tasks? This cannot be undone.`;
    openModal(confirmModal);
  };

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!deletingProjectId) return;
    try {
      await apiRequest(`/api/projects/${deletingProjectId}`, 'DELETE');
      showToast('Project deleted');
      closeModal(confirmModal);
      loadProjects();
    } catch (error) {
      showToast(error.message, 'error');
    }
    deletingProjectId = null;
  });

  confirmCancelBtn.addEventListener('click', () => {
    closeModal(confirmModal);
    deletingProjectId = null;
  });

  // ── Close modals when clicking outside ──────────────────
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        editingProjectId = null;
        deletingProjectId = null;
      }
    });
  });

  // ── Handle Enter key in modal ──────────────────────────
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
    if (e.key === 'Escape') closeModal(modal);
  });

  // ── Initial load ───────────────────────────────────────
  loadProjects();
}


// ============================================================
// PROJECT PAGE (Task Table)
// ============================================================

function initProjectPage() {
  // ── Get the project ID from the URL ────────────────────
  // When you visit project.html?id=5, this extracts the "5".
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');

  if (!projectId) {
    window.location.href = 'index.html';
    return;
  }

  // ── Get references to HTML elements ────────────────────
  const projectName = document.getElementById('project-name');
  const projectDate = document.getElementById('project-date');
  const taskTableWrapper = document.getElementById('task-table-wrapper');
  const taskTableBody = document.getElementById('task-table-body');
  const emptyState = document.getElementById('empty-state');
  const loading = document.getElementById('loading');
  const taskCount = document.getElementById('task-count');
  const addTaskBtn = document.getElementById('add-task-btn');
  const editTitleBtn = document.getElementById('edit-title-btn');
  const manageLabelsBtn = document.getElementById('manage-labels-btn');

  // Filter and search elements
  const searchInput = document.getElementById('search-input');
  const filterStatus = document.getElementById('filter-status');
  const filterPriority = document.getElementById('filter-priority');
  const sortBy = document.getElementById('sort-by');
  const clearFiltersBtn = document.getElementById('clear-filters');

  // Task modal elements
  const taskModal = 'task-modal';
  const taskModalTitle = document.getElementById('task-modal-title');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskStatusInput = document.getElementById('task-status-input');
  const taskPriorityInput = document.getElementById('task-priority-input');
  const taskDueInput = document.getElementById('task-due-input');
  const taskNotesInput = document.getElementById('task-notes-input');
  const taskLabelsContainer = document.getElementById('task-labels-container');
  const taskSaveBtn = document.getElementById('task-modal-save');
  const taskCancelBtn = document.getElementById('task-modal-cancel');

  // Labels modal elements
  const labelsModal = 'labels-modal';
  const newLabelName = document.getElementById('new-label-name');
  const newLabelColor = document.getElementById('new-label-color');
  const createLabelBtn = document.getElementById('create-label-btn');
  const labelsList = document.getElementById('labels-list');
  const labelsCloseBtn = document.getElementById('labels-close-btn');

  // Rename modal elements
  const renameModal = 'rename-modal';
  const renameInput = document.getElementById('rename-input');
  const renameSaveBtn = document.getElementById('rename-save');
  const renameCancelBtn = document.getElementById('rename-cancel');

  // Confirm modal elements
  const confirmModal = 'confirm-modal';
  const confirmDeleteBtn = document.getElementById('confirm-delete');
  const confirmCancelBtn = document.getElementById('confirm-cancel');

  let editingTaskId = null;
  let deletingTaskId = null;
  let currentProject = null;
  let allLabels = [];
  let selectedLabelIds = [];
  let allTasks = []; // Store all tasks for filtering

  // ── Load project info ──────────────────────────────────
  async function loadProject() {
    try {
      currentProject = await apiRequest(`/api/projects/${projectId}`);
      projectName.textContent = currentProject.name;
      projectDate.textContent = `Created ${formatDate(currentProject.created_at)}`;
      document.title = `${currentProject.name} — Project Manager`;
      loading.style.display = 'none';
    } catch (error) {
      showToast('Project not found', 'error');
      setTimeout(() => window.location.href = 'index.html', 1500);
    }
  }

  // ── Load all labels ────────────────────────────────────
  async function loadLabels() {
    try {
      allLabels = await apiRequest('/api/labels');
    } catch (error) {
      showToast('Failed to load labels', 'error');
    }
  }

  // ── Load and display tasks ────────────────────────────
  async function loadTasks() {
    try {
      const tasks = await apiRequest(`/api/projects/${projectId}/tasks`);
      // Load labels for each task
      for (const task of tasks) {
        task.labels = await apiRequest(`/api/tasks/${task.id}/labels`);
      }
      allTasks = tasks;
      applyFiltersAndRender();
    } catch (error) {
      showToast('Failed to load tasks', 'error');
    }
  }

  // ── Apply filters and sorting ──────────────────────────
  function applyFiltersAndRender() {
    let filtered = [...allTasks];

    // Search filter
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchTerm) ||
        (task.notes && task.notes.toLowerCase().includes(searchTerm))
      );
    }

    // Status filter
    const statusFilter = filterStatus.value;
    if (statusFilter) {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Priority filter
    const priorityFilter = filterPriority.value;
    if (priorityFilter) {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    // Sorting
    const sortValue = sortBy.value;
    filtered.sort((a, b) => {
      switch (sortValue) {
        case 'created':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'created-asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'priority':
          const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
          return priorityOrder[a.priority || 'Medium'] - priorityOrder[b.priority || 'Medium'];
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    renderTasks(filtered);
  }

  // ── Render tasks in the table ──────────────────────────
  function renderTasks(tasks) {
    const count = tasks.length;
    taskCount.textContent = `${count} task${count !== 1 ? 's' : ''}`;

    if (count === 0) {
      taskTableWrapper.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    taskTableWrapper.style.display = 'block';

    taskTableBody.innerHTML = tasks.map(task => {
      const sc = statusClass(task.status);
      const pc = priorityClass(task.priority || 'Medium');
      const titleClass = task.status === 'Done' ? 'task-title done' : 'task-title';
      const overdue = task.status !== 'Done' && isOverdue(task.due_date);
      const dueDateHtml = task.due_date
        ? `<span class="due-date ${overdue ? 'overdue' : ''}">${formatDate(task.due_date)}${overdue ? ' ⚠️' : ''}</span>`
        : '<span class="due-date none">—</span>';

      const labelsHtml = task.labels && task.labels.length > 0
        ? task.labels.map(label =>
            `<span class="task-label-badge" style="background-color: ${label.color}20; color: ${label.color};">
              <span class="label-color-dot" style="background-color: ${label.color};"></span>
              ${escapeHtml(label.name)}
            </span>`
          ).join('')
        : '<span class="due-date none">—</span>';

      return `
        <tr data-id="${task.id}">
          <td>
            <span class="${titleClass}">${escapeHtml(task.title)}</span>
          </td>
          <td>
            <button class="status-badge ${sc}" onclick="cycleStatus(${task.id}, '${task.status}')">
              <span class="status-dot"></span>
              ${task.status}
            </button>
          </td>
          <td>
            <span class="priority-badge ${pc}">${task.priority || 'Medium'}</span>
          </td>
          <td><div class="task-labels">${labelsHtml}</div></td>
          <td>${dueDateHtml}</td>
          <td><span class="task-notes-preview">${escapeHtml(task.notes) || '<span class="due-date none">—</span>'}</span></td>
          <td>
            <div class="task-actions">
              <button class="icon-btn" onclick="editTask(${task.id})" title="Edit">✏️</button>
              <button class="icon-btn danger" onclick="confirmDeleteTask(${task.id}, '${escapeHtml(task.title).replace(/'/g, "\\'")}')" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ── Cycle through statuses by clicking the badge ────────
  window.cycleStatus = async function(taskId, currentStatus) {
    const cycle = {
      'To Do': 'In Progress',
      'In Progress': 'Done',
      'Done': 'To Do'
    };
    const newStatus = cycle[currentStatus];

    try {
      await apiRequest(`/api/tasks/${taskId}`, 'PUT', { status: newStatus });
      loadTasks();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // ── Render label checkboxes in task modal ─────────────
  function renderLabelCheckboxes() {
    if (allLabels.length === 0) {
      taskLabelsContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No labels yet. Click "🏷️ Labels" to create one.</p>';
      return;
    }

    taskLabelsContainer.innerHTML = allLabels.map(label => {
      const isChecked = selectedLabelIds.includes(label.id);
      return `
        <label class="label-checkbox ${isChecked ? 'checked' : ''}" style="background-color: ${label.color}20; color: ${label.color};">
          <input type="checkbox" value="${label.id}" ${isChecked ? 'checked' : ''} onchange="toggleLabel(${label.id})">
          <span class="label-color-dot" style="background-color: ${label.color};"></span>
          ${escapeHtml(label.name)}
        </label>
      `;
    }).join('');
  }

  // ── Toggle label selection ────────────────────────────
  window.toggleLabel = function(labelId) {
    const index = selectedLabelIds.indexOf(labelId);
    if (index > -1) {
      selectedLabelIds.splice(index, 1);
    } else {
      selectedLabelIds.push(labelId);
    }
    renderLabelCheckboxes();
  };

  // ── Open modal for NEW task ────────────────────────────
  addTaskBtn.addEventListener('click', () => {
    editingTaskId = null;
    selectedLabelIds = [];
    taskModalTitle.textContent = 'New Task';
    taskSaveBtn.textContent = 'Create';
    taskTitleInput.value = '';
    taskStatusInput.value = 'To Do';
    taskPriorityInput.value = 'Medium';
    taskDueInput.value = '';
    taskNotesInput.value = '';
    renderLabelCheckboxes();
    openModal(taskModal);
  });

  // ── Open modal for EDITING a task ──────────────────────
  window.editTask = async function(taskId) {
    try {
      const tasks = await apiRequest(`/api/projects/${projectId}/tasks`);
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        showToast('Task not found', 'error');
        return;
      }

      // Load task labels
      const taskLabels = await apiRequest(`/api/tasks/${taskId}/labels`);
      selectedLabelIds = taskLabels.map(l => l.id);

      editingTaskId = taskId;
      taskModalTitle.textContent = 'Edit Task';
      taskSaveBtn.textContent = 'Save';
      taskTitleInput.value = task.title || '';
      taskStatusInput.value = task.status || 'To Do';
      taskPriorityInput.value = task.priority || 'Medium';
      taskDueInput.value = task.due_date || '';
      taskNotesInput.value = task.notes || '';
      renderLabelCheckboxes();
      openModal(taskModal);
    } catch (error) {
      showToast('Could not load task', 'error');
    }
  };

  // ── Save task (create or update) ───────────────────────
  taskSaveBtn.addEventListener('click', async () => {
    const title = taskTitleInput.value.trim();
    if (!title) {
      showToast('Please enter a task title', 'error');
      return;
    }

    const taskData = {
      title,
      status: taskStatusInput.value,
      priority: taskPriorityInput.value,
      due_date: taskDueInput.value || null,
      notes: taskNotesInput.value.trim() || null
    };

    try {
      let taskId;
      if (editingTaskId) {
        await apiRequest(`/api/tasks/${editingTaskId}`, 'PUT', taskData);
        taskId = editingTaskId;

        // Remove all existing labels and add selected ones
        const existingLabels = await apiRequest(`/api/tasks/${taskId}/labels`);
        for (const label of existingLabels) {
          await apiRequest(`/api/tasks/${taskId}/labels/${label.id}`, 'DELETE');
        }

        showToast('Task updated');
      } else {
        const newTask = await apiRequest(`/api/projects/${projectId}/tasks`, 'POST', taskData);
        taskId = newTask.id;
        showToast('Task created');
      }

      // Add selected labels
      for (const labelId of selectedLabelIds) {
        await apiRequest(`/api/tasks/${taskId}/labels/${labelId}`, 'POST');
      }

      closeModal(taskModal);
      loadTasks();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  taskCancelBtn.addEventListener('click', () => closeModal(taskModal));

  // ── Rename project ────────────────────────────────────
  editTitleBtn.addEventListener('click', () => {
    renameInput.value = currentProject ? currentProject.name : '';
    openModal(renameModal);
  });

  renameSaveBtn.addEventListener('click', async () => {
    const name = renameInput.value.trim();
    if (!name) {
      showToast('Please enter a project name', 'error');
      return;
    }
    try {
      await apiRequest(`/api/projects/${projectId}`, 'PUT', { name });
      showToast('Project renamed');
      closeModal(renameModal);
      loadProject();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  renameCancelBtn.addEventListener('click', () => closeModal(renameModal));

  // ── Confirm delete task ────────────────────────────────
  window.confirmDeleteTask = function(taskId, taskTitle) {
    deletingTaskId = taskId;
    document.getElementById('confirm-message').textContent =
      `Are you sure you want to delete "${taskTitle}"? This cannot be undone.`;
    openModal(confirmModal);
  };

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!deletingTaskId) return;
    try {
      await apiRequest(`/api/tasks/${deletingTaskId}`, 'DELETE');
      showToast('Task deleted');
      closeModal(confirmModal);
      loadTasks();
    } catch (error) {
      showToast(error.message, 'error');
    }
    deletingTaskId = null;
  });

  confirmCancelBtn.addEventListener('click', () => {
    closeModal(confirmModal);
    deletingTaskId = null;
  });

  // ── Labels Management ──────────────────────────────────

  // Render labels list in management modal
  function renderLabelsList() {
    if (allLabels.length === 0) {
      labelsList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">No labels yet</p>';
      return;
    }

    labelsList.innerHTML = allLabels.map(label => `
      <div class="label-item">
        <span class="label-preview" style="background-color: ${label.color}20; color: ${label.color};">
          <span class="label-color-dot" style="background-color: ${label.color};"></span>
          ${escapeHtml(label.name)}
        </span>
        <button class="icon-btn danger" onclick="deleteLabel(${label.id}, '${escapeHtml(label.name).replace(/'/g, "\\'")}')" title="Delete">🗑️</button>
      </div>
    `).join('');
  }

  // Open labels management modal
  manageLabelsBtn.addEventListener('click', () => {
    renderLabelsList();
    openModal(labelsModal);
  });

  // Create new label
  createLabelBtn.addEventListener('click', async () => {
    const name = newLabelName.value.trim();
    const color = newLabelColor.value;

    if (!name) {
      showToast('Please enter a label name', 'error');
      return;
    }

    try {
      await apiRequest('/api/labels', 'POST', { name, color });
      showToast('Label created');
      newLabelName.value = '';
      newLabelColor.value = '#6c8cff';
      await loadLabels();
      renderLabelsList();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // Delete label
  window.deleteLabel = async function(labelId, labelName) {
    if (!confirm(`Delete label "${labelName}"? It will be removed from all tasks.`)) {
      return;
    }

    try {
      await apiRequest(`/api/labels/${labelId}`, 'DELETE');
      showToast('Label deleted');
      await loadLabels();
      renderLabelsList();
      renderLabelCheckboxes();
      loadTasks(); // Refresh tasks to update labels display
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Close labels modal
  labelsCloseBtn.addEventListener('click', () => {
    closeModal(labelsModal);
    renderLabelCheckboxes(); // Refresh in case labels were added
  });

  // Enter key in label name field
  newLabelName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createLabelBtn.click();
  });

  // ── Search and Filter Event Listeners ──────────────────

  // Real-time search
  searchInput.addEventListener('input', applyFiltersAndRender);

  // Filter dropdowns
  filterStatus.addEventListener('change', applyFiltersAndRender);
  filterPriority.addEventListener('change', applyFiltersAndRender);
  sortBy.addEventListener('change', applyFiltersAndRender);

  // Clear filters button
  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterStatus.value = '';
    filterPriority.value = '';
    sortBy.value = 'created';
    applyFiltersAndRender();
  });

  // ── Close modals when clicking outside ──────────────────
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        editingTaskId = null;
        deletingTaskId = null;
      }
    });
  });

  // ── Handle Enter key in modals ─────────────────────────
  taskTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') taskSaveBtn.click();
    if (e.key === 'Escape') closeModal(taskModal);
  });

  renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') renameSaveBtn.click();
    if (e.key === 'Escape') closeModal(renameModal);
  });

  // ── Keyboard shortcut: Escape closes any modal ─────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => {
        m.classList.remove('active');
      });
    }
  });

  // ── Initial load ───────────────────────────────────────
  loadProject();
  loadLabels();
  loadTasks();
}