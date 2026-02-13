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

  // Task modal elements
  const taskModal = 'task-modal';
  const taskModalTitle = document.getElementById('task-modal-title');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskStatusInput = document.getElementById('task-status-input');
  const taskDueInput = document.getElementById('task-due-input');
  const taskNotesInput = document.getElementById('task-notes-input');
  const taskSaveBtn = document.getElementById('task-modal-save');
  const taskCancelBtn = document.getElementById('task-modal-cancel');

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

  // ── Load and display tasks ────────────────────────────
  async function loadTasks() {
    try {
      const tasks = await apiRequest(`/api/projects/${projectId}/tasks`);
      renderTasks(tasks);
    } catch (error) {
      showToast('Failed to load tasks', 'error');
    }
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
      const titleClass = task.status === 'Done' ? 'task-title done' : 'task-title';
      const overdue = task.status !== 'Done' && isOverdue(task.due_date);
      const dueDateHtml = task.due_date
        ? `<span class="due-date ${overdue ? 'overdue' : ''}">${formatDate(task.due_date)}${overdue ? ' ⚠️' : ''}</span>`
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

  // ── Open modal for NEW task ────────────────────────────
  addTaskBtn.addEventListener('click', () => {
    editingTaskId = null;
    taskModalTitle.textContent = 'New Task';
    taskSaveBtn.textContent = 'Create';
    taskTitleInput.value = '';
    taskStatusInput.value = 'To Do';
    taskDueInput.value = '';
    taskNotesInput.value = '';
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
      editingTaskId = taskId;
      taskModalTitle.textContent = 'Edit Task';
      taskSaveBtn.textContent = 'Save';
      taskTitleInput.value = task.title || '';
      taskStatusInput.value = task.status || 'To Do';
      taskDueInput.value = task.due_date || '';
      taskNotesInput.value = task.notes || '';
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
      due_date: taskDueInput.value || null,
      notes: taskNotesInput.value.trim() || null
    };

    try {
      if (editingTaskId) {
        await apiRequest(`/api/tasks/${editingTaskId}`, 'PUT', taskData);
        showToast('Task updated');
      } else {
        await apiRequest(`/api/projects/${projectId}/tasks`, 'POST', taskData);
        showToast('Task created');
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
  loadTasks();
}