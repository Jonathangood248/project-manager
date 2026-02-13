// ============================================================
// server.js – The Main Engine
// ============================================================
// This is the "brain" of your app. When you run this file,
// it starts a web server on your computer. That server:
//   1. Serves your HTML/CSS/JS files to the browser
//   2. Handles "API requests" – when your frontend asks for
//      data (like "give me all projects"), the server talks
//      to the database and sends back the answer.
//
// Think of it like a restaurant:
//   - The browser is the customer
//   - server.js is the waiter
//   - database.js is the kitchen
//   - The customer (browser) asks the waiter (server) for
//     something, the waiter tells the kitchen (database),
//     and brings back the result.
// ============================================================

// ── Import the tools we need ──────────────────────────────
const express = require('express');         // The web server framework
const path = require('path');               // For working with file paths
const database = require('./database');     // Our database functions

// ── Create the app ────────────────────────────────────────
// express() creates a new web server application.
const app = express();

// ── Choose a port number ──────────────────────────────────
// A "port" is like a door number on your computer. We're using
// door 3000, so the app will be at: http://localhost:3000
const PORT = 3000;

// ── Middleware Setup ──────────────────────────────────────
// "Middleware" are helpers that process every request before
// it reaches your code. Think of them as security guards or
// receptionists at the front door.

// This tells Express to understand JSON data sent from the browser.
// When the frontend sends data (like a new task), it arrives as
// JSON – this middleware translates it so we can use it.
app.use(express.json());

// This tells Express to serve files from the "public" folder.
// Any file in "public/" (like index.html, style.css, app.js)
// will be automatically available in the browser.
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// API ROUTES – PROJECTS
// ============================================================
// API routes are like a menu of things the frontend can ask for.
// Each route has:
//   - A METHOD (GET, POST, PUT, DELETE) – what kind of action
//   - A PATH (like /api/projects) – which "endpoint" to call
//
// Common methods:
//   GET    = "Give me data" (reading)
//   POST   = "Here's new data, save it" (creating)
//   PUT    = "Here's updated data" (updating)
//   DELETE = "Remove this data" (deleting)

// ── GET /api/projects ─────────────────────────────────────
// Returns a list of ALL projects.
// The frontend calls this when loading the main page.
app.get('/api/projects', (req, res) => {
  try {
    const projects = database.getAllProjects();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// ── GET /api/projects/:id ─────────────────────────────────
// Returns ONE specific project.
// ":id" is a placeholder – if you visit /api/projects/5,
// then req.params.id will be "5".
app.get('/api/projects/:id', (req, res) => {
  try {
    const project = database.getProjectById(Number(req.params.id));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ── POST /api/projects ────────────────────────────────────
// Creates a NEW project.
// The frontend sends the project name in the "body" of the request.
app.post('/api/projects', (req, res) => {
  try {
    const { name } = req.body;

    // Validation: make sure they sent a name
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = database.createProject(name.trim());
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ── PUT /api/projects/:id ─────────────────────────────────
// Updates an existing project's name.
app.put('/api/projects/:id', (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const success = database.updateProject(Number(req.params.id), name.trim());
    if (!success) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ id: Number(req.params.id), name: name.trim() });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// ── DELETE /api/projects/:id ──────────────────────────────
// Deletes a project AND all its tasks.
app.delete('/api/projects/:id', (req, res) => {
  try {
    const success = database.deleteProject(Number(req.params.id));
    if (!success) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ============================================================
// API ROUTES – TASKS
// ============================================================

// ── GET /api/projects/:projectId/tasks ────────────────────
// Returns all tasks for a specific project.
app.get('/api/projects/:projectId/tasks', (req, res) => {
  try {
    // First, make sure the project exists
    const project = database.getProjectById(Number(req.params.projectId));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const tasks = database.getTasksByProject(Number(req.params.projectId));
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// ── POST /api/projects/:projectId/tasks ───────────────────
// Creates a new task in a specific project.
app.post('/api/projects/:projectId/tasks', (req, res) => {
  try {
    const projectId = Number(req.params.projectId);

    // Make sure the project exists
    const project = database.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { title, status, due_date, notes, priority, parent_task_id } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const task = database.createTask(
      projectId,
      title.trim(),
      status || 'To Do',
      due_date || null,
      notes || null,
      priority || 'Medium',
      parent_task_id || null
    );
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// ── PUT /api/tasks/:id ────────────────────────────────────
// Updates an existing task.
app.put('/api/tasks/:id', (req, res) => {
  try {
    const taskId = Number(req.params.id);

    // Make sure the task exists first
    const existingTask = database.getTaskById(taskId);
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Use existing values as fallback if not all fields are sent
    const title = req.body.title !== undefined ? req.body.title.trim() : existingTask.title;
    const status = req.body.status !== undefined ? req.body.status : existingTask.status;
    const due_date = req.body.due_date !== undefined ? req.body.due_date : existingTask.due_date;
    const notes = req.body.notes !== undefined ? req.body.notes : existingTask.notes;
    const priority = req.body.priority !== undefined ? req.body.priority : existingTask.priority;

    if (!title || title === '') {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const success = database.updateTask(taskId, title, status, due_date, notes, priority);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ id: taskId, title, status, due_date, notes, priority });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// ── DELETE /api/tasks/:id ─────────────────────────────────
// Deletes a single task.
app.delete('/api/tasks/:id', (req, res) => {
  try {
    const success = database.deleteTask(Number(req.params.id));
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ── GET /api/tasks/:id/subtasks ───────────────────────────
// Get all subtasks for a parent task.
app.get('/api/tasks/:id/subtasks', (req, res) => {
  try {
    const subtasks = database.getSubtasks(Number(req.params.id));
    res.json(subtasks);
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    res.status(500).json({ error: 'Failed to fetch subtasks' });
  }
});

// ============================================================
// API ROUTES – LABELS
// ============================================================

// ── GET /api/labels ───────────────────────────────────────
// Get all available labels.
app.get('/api/labels', (req, res) => {
  try {
    const labels = database.getAllLabels();
    res.json(labels);
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

// ── POST /api/labels ──────────────────────────────────────
// Create a new label.
app.post('/api/labels', (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Label name is required' });
    }

    if (!color || color.trim() === '') {
      return res.status(400).json({ error: 'Label color is required' });
    }

    const label = database.createLabel(name.trim(), color.trim());
    res.status(201).json(label);
  } catch (error) {
    console.error('Error creating label:', error);
    // Handle unique constraint violation
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Label already exists' });
    }
    res.status(500).json({ error: 'Failed to create label' });
  }
});

// ── DELETE /api/labels/:id ────────────────────────────────
// Delete a label.
app.delete('/api/labels/:id', (req, res) => {
  try {
    const success = database.deleteLabel(Number(req.params.id));
    if (!success) {
      return res.status(404).json({ error: 'Label not found' });
    }
    res.json({ message: 'Label deleted successfully' });
  } catch (error) {
    console.error('Error deleting label:', error);
    res.status(500).json({ error: 'Failed to delete label' });
  }
});

// ── GET /api/tasks/:id/labels ─────────────────────────────
// Get all labels for a specific task.
app.get('/api/tasks/:id/labels', (req, res) => {
  try {
    const labels = database.getTaskLabels(Number(req.params.id));
    res.json(labels);
  } catch (error) {
    console.error('Error fetching task labels:', error);
    res.status(500).json({ error: 'Failed to fetch task labels' });
  }
});

// ── POST /api/tasks/:taskId/labels/:labelId ───────────────
// Add a label to a task.
app.post('/api/tasks/:taskId/labels/:labelId', (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const labelId = Number(req.params.labelId);

    const success = database.addLabelToTask(taskId, labelId);
    res.json({ success, message: success ? 'Label added to task' : 'Label already on task' });
  } catch (error) {
    console.error('Error adding label to task:', error);
    res.status(500).json({ error: 'Failed to add label to task' });
  }
});

// ── DELETE /api/tasks/:taskId/labels/:labelId ─────────────
// Remove a label from a task.
app.delete('/api/tasks/:taskId/labels/:labelId', (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const labelId = Number(req.params.labelId);

    const success = database.removeLabelFromTask(taskId, labelId);
    if (!success) {
      return res.status(404).json({ error: 'Label not found on task' });
    }
    res.json({ message: 'Label removed from task' });
  } catch (error) {
    console.error('Error removing label from task:', error);
    res.status(500).json({ error: 'Failed to remove label from task' });
  }
});

// ============================================================
// CATCH-ALL ROUTE
// ============================================================
// If someone visits a URL that doesn't match any API route
// or static file, send them to the main page.
// This makes the app feel more like a real website.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// START THE SERVER
// ============================================================
// This is what actually turns the server "on".
// Once this runs, the app is live at http://localhost:3000
app.listen(PORT, () => {
  console.log('');
  console.log('  ✅ Project Manager is running!');
  console.log(`  🌐 Open your browser to: http://localhost:${PORT}`);
  console.log('');
  console.log('  Press Ctrl+C to stop the server.');
  console.log('');
});