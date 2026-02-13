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
    due_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`);
// ↑ The "tasks" table has seven columns:
//   - id: unique number for each task
//   - project_id: which project this task belongs to
//   - title: the task's name (like "Buy groceries")
//   - status: "To Do", "In Progress", or "Done"
//   - due_date: when the task is due (optional)
//   - notes: any extra details (optional)
//   - created_at: when the task was created
//   - FOREIGN KEY: this links each task to a project.
//     "ON DELETE CASCADE" means if you delete a project,
//     all its tasks get deleted too (no orphan tasks).

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
function createTask(projectId, title, status = 'To Do', dueDate = null, notes = null) {
  const stmt = db.prepare(
    'INSERT INTO tasks (project_id, title, status, due_date, notes) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(projectId, title, status, dueDate, notes);
  return {
    id: result.lastInsertRowid,
    project_id: projectId,
    title,
    status,
    due_date: dueDate,
    notes
  };
}

// ── Update an existing task ───────────────────────────────
// Changes any or all fields of a task.
function updateTask(id, title, status, dueDate, notes) {
  const stmt = db.prepare(
    'UPDATE tasks SET title = ?, status = ?, due_date = ?, notes = ? WHERE id = ?'
  );
  const result = stmt.run(title, status, dueDate, notes, id);
  return result.changes > 0;
}

// ── Delete a task ─────────────────────────────────────────
function deleteTask(id) {
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
  const result = stmt.run(id);
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
  deleteTask
};