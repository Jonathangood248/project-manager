// ============================================================
// database.js – The Data Layer
// ============================================================
// This file is responsible for EVERYTHING related to saving
// and loading data. It talks to a SQLite database, which is
// just a single file on your computer (data/projects.db).
//
// Think of this file like a librarian:
//   - It sets up the filing system (creates tables)
//   - It knows how to file new items (create)
//   - It knows how to find items (read)
//   - It knows how to update existing items (update)
//   - It knows how to remove items (delete)
//
// These four operations – Create, Read, Update, Delete – are
// called "CRUD" and they're the backbone of almost every app.
// ============================================================

// "require" is how Node.js imports code from a package.
// Here we're importing the "better-sqlite3" package, which
// lets us talk to a SQLite database using JavaScript.
const Database = require('better-sqlite3');

// "path" is a built-in Node.js tool for working with file paths.
// It helps us build file paths that work on any operating system.
const path = require('path');

// "fs" stands for "file system" – another built-in Node.js tool.
// We use it here to make sure the "data" folder exists.
const fs = require('fs');

// ── Make sure the "data" folder exists ─────────────────────
// The database file will live inside a folder called "data".
// If that folder doesn't exist yet, we create it.
// __dirname is a special variable that means "the folder this
// file lives in". So we're saying: "look in the same folder
// as this file, then go into a subfolder called data".
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// ── Open (or create) the database ─────────────────────────
// This line opens the database file. If it doesn't exist yet,
// SQLite automatically creates it for us. The file will be at:
//   project-manager/data/projects.db
const db = new Database(path.join(dataDir, 'projects.db'));

// ── Performance setting ───────────────────────────────────
// WAL mode makes the database faster and more reliable.
// You don't need to understand this yet – just know it's
// a best practice for SQLite.
db.pragma('journal_mode = WAL');

// ============================================================
// TABLE SETUP (runs once when the app starts)
// ============================================================
// "Tables" are like spreadsheets inside the database.
// We need two tables:
//   1. "projects" – stores each project (like "Work", "Personal")
//   2. "tasks" – stores each task, linked to a project
//
// "CREATE TABLE IF NOT EXISTS" means: "make this table, but
// only if it doesn't already exist" – so it's safe to run
// every time the app starts.

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);
// ↑ The "projects" table has three columns:
//   - id: a unique number assigned automatically (1, 2, 3...)
//   - name: the project's name (like "Work" or "Personal")
//   - created_at: the date/time the project was created

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'To Do',
    priority TEXT DEFAULT 'Medium',
    due_date TEXT,
    notes TEXT,
    parent_task_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
  )
`);

// ── Migrate existing tasks table if needed ────────────────
// If the database was created before the pro features update,
// the tasks table won't have the "priority" or "parent_task_id"
// columns. We check for them and add them if missing.
const taskColumns = db.pragma('table_info(tasks)').map(c => c.name);
if (!taskColumns.includes('priority')) {
  db.exec(`ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'Medium'`);
}
if (!taskColumns.includes('parent_task_id')) {
  db.exec(`ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE`);
}
// ↑ The "tasks" table has nine columns:
//   - id: unique number for each task
//   - project_id: which project this task belongs to
//   - title: the task's name (like "Buy groceries")
//   - status: "To Do", "In Progress", or "Done"
//   - priority: "Low", "Medium", or "High"
//   - due_date: when the task is due (optional)
//   - notes: any extra details (optional)
//   - parent_task_id: if this is a subtask, points to parent task
//   - created_at: when the task was created
//   - FOREIGN KEY: this links each task to a project.
//     "ON DELETE CASCADE" means if you delete a project,
//     all its tasks get deleted too (no orphan tasks).
//   - The parent_task_id also has CASCADE, so deleting a parent
//     task deletes all its subtasks.

// ── Labels table ──────────────────────────────────────────
// This table stores all available labels/tags.
db.exec(`
  CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL
  )
`);

// ── Task-Label junction table ────────────────────────────
// This table connects tasks to labels (many-to-many relationship).
// A task can have multiple labels, and a label can be on multiple tasks.
db.exec(`
  CREATE TABLE IF NOT EXISTS task_labels (
    task_id INTEGER NOT NULL,
    label_id INTEGER NOT NULL,
    PRIMARY KEY (task_id, label_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
  )
`);

// Enable foreign key enforcement (SQLite has this off by default)
db.pragma('foreign_keys = ON');

// ============================================================
// PROJECT OPERATIONS (CRUD)
// ============================================================

// ── Get ALL projects ──────────────────────────────────────
// Returns a list of every project in the database.
// "prepare" creates a reusable query. "all()" runs it and
// returns all matching rows as an array (a list).
function getAllProjects() {
  const stmt = db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
  return stmt.all();
}

// ── Get ONE project by its ID ─────────────────────────────
// Returns a single project, or undefined if it doesn't exist.
// "get()" returns just one row instead of a list.
// The "?" is a placeholder – we fill it in with the id value.
// This prevents "SQL injection" (a type of security attack).
function getProjectById(id) {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
  return stmt.get(id);
}

// ── Create a NEW project ──────────────────────────────────
// Takes a name (like "Work") and adds it to the database.
// "run()" executes the query and returns info about what happened.
// "lastInsertRowid" gives us the ID of the newly created project.
function createProject(name) {
  const stmt = db.prepare('INSERT INTO projects (name) VALUES (?)');
  const result = stmt.run(name);
  return { id: result.lastInsertRowid, name };
}

// ── Update a project's name ───────────────────────────────
// Changes the name of an existing project.
// "changes" tells us how many rows were affected (should be 1).
function updateProject(id, name) {
  const stmt = db.prepare('UPDATE projects SET name = ? WHERE id = ?');
  const result = stmt.run(name, id);
  return result.changes > 0;
}

// ── Delete a project ──────────────────────────────────────
// Removes a project AND all its tasks (because of CASCADE).
function deleteProject(id) {
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================================
// TASK OPERATIONS (CRUD)
// ============================================================

// ── Get all tasks for a specific project ──────────────────
// Returns every task that belongs to the given project.
function getTasksByProject(projectId) {
  const stmt = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC');
  return stmt.all(projectId);
}

// ── Get ONE task by its ID ────────────────────────────────
function getTaskById(id) {
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
  return stmt.get(id);
}

// ── Create a NEW task ─────────────────────────────────────
// Adds a task to a specific project.
// We provide the project_id so the database knows which
// project this task belongs to.
function createTask(projectId, title, status = 'To Do', dueDate = null, notes = null, priority = 'Medium', parentTaskId = null) {
  const stmt = db.prepare(
    'INSERT INTO tasks (project_id, title, status, due_date, notes, priority, parent_task_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(projectId, title, status, dueDate, notes, priority, parentTaskId);
  return {
    id: result.lastInsertRowid,
    project_id: projectId,
    title,
    status,
    due_date: dueDate,
    notes,
    priority,
    parent_task_id: parentTaskId
  };
}

// ── Update an existing task ───────────────────────────────
// Changes any or all fields of a task.
function updateTask(id, title, status, dueDate, notes, priority = 'Medium') {
  const stmt = db.prepare(
    'UPDATE tasks SET title = ?, status = ?, due_date = ?, notes = ?, priority = ? WHERE id = ?'
  );
  const result = stmt.run(title, status, dueDate, notes, priority, id);
  return result.changes > 0;
}

// ── Delete a task ─────────────────────────────────────────
function deleteTask(id) {
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ── Get subtasks for a parent task ───────────────────────
function getSubtasks(parentTaskId) {
  const stmt = db.prepare('SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at DESC');
  return stmt.all(parentTaskId);
}

// ============================================================
// LABEL OPERATIONS
// ============================================================

// ── Get all labels ────────────────────────────────────────
function getAllLabels() {
  const stmt = db.prepare('SELECT * FROM labels ORDER BY name');
  return stmt.all();
}

// ── Create a new label ────────────────────────────────────
function createLabel(name, color) {
  const stmt = db.prepare('INSERT INTO labels (name, color) VALUES (?, ?)');
  const result = stmt.run(name, color);
  return { id: result.lastInsertRowid, name, color };
}

// ── Delete a label ────────────────────────────────────────
function deleteLabel(id) {
  const stmt = db.prepare('DELETE FROM labels WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ── Get labels for a specific task ───────────────────────
function getTaskLabels(taskId) {
  const stmt = db.prepare(`
    SELECT l.* FROM labels l
    JOIN task_labels tl ON l.id = tl.label_id
    WHERE tl.task_id = ?
  `);
  return stmt.all(taskId);
}

// ── Add a label to a task ─────────────────────────────────
function addLabelToTask(taskId, labelId) {
  const stmt = db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)');
  const result = stmt.run(taskId, labelId);
  return result.changes > 0;
}

// ── Remove a label from a task ────────────────────────────
function removeLabelFromTask(taskId, labelId) {
  const stmt = db.prepare('DELETE FROM task_labels WHERE task_id = ? AND label_id = ?');
  const result = stmt.run(taskId, labelId);
  return result.changes > 0;
}

// ============================================================
// EXPORT EVERYTHING
// ============================================================
// "module.exports" makes these functions available to other
// files. When server.js does require('./database'), it gets
// this object with all these functions attached.
module.exports = {
  db,
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getTasksByProject,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getSubtasks,
  getAllLabels,
  createLabel,
  deleteLabel,
  getTaskLabels,
  addLabelToTask,
  removeLabelFromTask
};