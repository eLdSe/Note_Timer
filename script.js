// ─── NAVIGATION ───────────────────────────────────────────
function showPage(page) {
    document
        .querySelectorAll(".page")
        .forEach((p) => p.classList.remove("active"));
    document
        .querySelectorAll(".nav-tab")
        .forEach((t) => t.classList.remove("active"));
    document.getElementById("page-" + page).classList.add("active");
    event.target.classList.add("active");
}

// ─── NOTES ────────────────────────────────────────────────
let notes = JSON.parse(localStorage.getItem("focus_notes") || "[]");
let currentNoteId = null;
let saveTimeout = null;

function genId() {
    return Date.now() + Math.random().toString(36).slice(2);
}

function newNote() {
    const note = {
        id: genId(),
        title: "",
        content: "",
        updatedAt: new Date().toISOString(),
    };
    notes.unshift(note);
    saveNotes();
    openNote(note.id);
    renderNotesList();
    setTimeout(() => document.getElementById("note-title").focus(), 50);
}

function openNote(id) {
    currentNoteId = id;
    let note = notes.find((n) => n.id === id);
    if (!note) return
    document.getElementById("empty-state").style.display = "none";
    document.getElementById("editor-content").style.display = "flex";
    document.getElementById("note-title").value = note.title;
    document.getElementById("note-content").value = note.content;
    updateCharCount();
    renderNotesList();
}

function saveCurrentNote() {
    if (!currentNoteId) {
        newNote();
        return
    };
    const note = notes.find((n) => n.id === currentNoteId);
    if (!note) return;
    note.title = document.getElementById("note-title").value;
    note.content = document.getElementById("note-content").value;
    note.updatedAt = new Date().toISOString();
    // Move to top
    notes = [note, ...notes.filter((n) => n.id !== note.id)];
    saveNotes();
    showSaveIndicator();
    renderNotesList();
}

function deleteNote(id, e) {
    e.stopPropagation();
    notes = notes.filter((n) => n.id !== id);
    saveNotes();
    if (currentNoteId === id) {
        currentNoteId = null;
        document.getElementById("empty-state").style.display = "flex";
        document.getElementById("editor-content").style.display = "none";
    }
    renderNotesList();
}

function saveNotes() {
    localStorage.setItem("focus_notes", JSON.stringify(notes));
}

function showSaveIndicator() {
    const el = document.getElementById("save-indicator");
    el.classList.add("show");
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => el.classList.remove("show"), 1500);
}

function updateCharCount() {
    const c = document.getElementById("note-content").value.length;
    document.getElementById("char-count").textContent = c + " символов";
}

function renderNotesList() {
    const q = document.getElementById("search-input").value.toLowerCase();
    const container = document.getElementById("notes-list");
    const filtered = notes.filter(
        (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q),
    );
    if (filtered.length === 0) {
        container.innerHTML =
            '<div style="color:var(--text-muted);font-size:.82rem;text-align:center;padding:20px;">Заметок нет</div>';
        return;
    }
    container.innerHTML = filtered
        .map((note) => {
            const d = new Date(note.updatedAt);
            const dateStr =
                d.toLocaleDateString("ru", { day: "numeric", month: "short" }) +
                " " +
                d.toLocaleTimeString("ru", {
                    hour: "2-digit",
                    minute: "2-digit",
                });
            return `
      <div class="note-item ${note.id === currentNoteId ? "active" : ""}" onclick="openNote('${note.id}')">
        <button class="note-delete" onclick="deleteNote('${note.id}', event)">✕</button>
        <div class="note-item-title">${note.title || "Без названия"}</div>
        <div class="note-item-preview">${note.content.slice(0, 60) || "Пустая заметка"}</div>
        <div class="note-item-date">${dateStr}</div>
      </div>`;
        })
        .join("");
}

function insertText(before, after) {
    const ta = document.getElementById("note-content");
    const start = ta.selectionStart,
        end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    const replacement = before + selected + after;
    ta.setRangeText(replacement, start, end, "end");
    ta.focus();
    saveCurrentNote();
}

renderNotesList();

// ─── TIMER ────────────────────────────────────────────────
const CIRCUMFERENCE = 2 * Math.PI * 120; // 753.98

let timerMode = "pomodoro";
let currentPhase = "work"; // work | break | longbreak
let pomodoroCount = 0;
let timerInterval = null;
let isRunning = false;
let totalSeconds = 0;
let remainingSeconds = 0;

let stats = JSON.parse(localStorage.getItem("focus_stats") || "{}");
const today = new Date().toDateString();
if (stats.date !== today) {
    stats = { date: today, pomodoros: 0, minutes: 0, breaks: 0, streak: 0 };
}

function getWorkTime() {
    return parseInt(document.getElementById("work-time").value) * 60;
}
function getBreakTime() {
    return parseInt(document.getElementById("break-time").value) * 60;
}
function getLongBreakTime() {
    return parseInt(document.getElementById("long-break-time").value) * 60;
}

function setMode(mode) {
    if (isRunning) return;
    timerMode = mode;
    document
        .querySelectorAll(".mode-tab")
        .forEach((t) => t.classList.remove("active"));
    event.target.classList.add("active");

    const settings = document.getElementById("timer-settings");
    settings.style.display = mode === "pomodoro" ? "flex" : "none";

    if (mode === "pomodoro") {
        currentPhase = "work";
        pomodoroCount = 0;
        totalSeconds = getWorkTime();
    } else if (mode === "focus") {
        totalSeconds = 90 * 60;
    } else {
        totalSeconds = 10 * 60;
    }
    remainingSeconds = totalSeconds;
    updateDisplay();
    updateRing();
}

function applySettings() {
    if (!isRunning) {
        totalSeconds = getWorkTime();
        remainingSeconds = totalSeconds;
        currentPhase = "work";
        updateDisplay();
        updateRing();
    }
}

function toggleTimer() {
    if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        document.getElementById("start-btn").textContent = "ПРОДОЛЖИТЬ";
    } else {
        isRunning = true;
        document.getElementById("start-btn").textContent = "ПАУЗА";
        timerInterval = setInterval(tick, 1000);
    }
}

function tick() {
    if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        isRunning = false;
        onPhaseComplete();
        return;
    }
    remainingSeconds--;
    updateDisplay();
    updateRing();
}

function onPhaseComplete() {
    // Таймер остановлен
    clearInterval(timerInterval);
    isRunning = false;
    document.getElementById("start-btn").textContent = "СТАРТ";

    // Просто уведомление о завершении таймера
    notify("⏰ Таймер завершён!", "Время, чтобы сделать паузу или продолжить работу.");
    playBeep();

    if (timerMode === "pomodoro") {
        pomodoroCount++;
        if (pomodoroCount === 4) {
            pomodoroCount = 0;
            currentPhase = "longbreak";
            totalSeconds = getLongBreakTime();
        } else {
            currentPhase = "break";
            totalSeconds = getBreakTime();
        }
    } else if (timerMode === "focus") {
        totalSeconds = 90 * 60;
    } else {
        totalSeconds = 10 * 60;
    }
    remainingSeconds = totalSeconds;
    updateDisplay();
    updateRing();
}

function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    document.getElementById("start-btn").textContent = "СТАРТ";
    if (timerMode === "pomodoro") {
        currentPhase = "work";
        totalSeconds = getWorkTime();
    } else if (timerMode === "focus") {
        totalSeconds = 90 * 60;
    } else {
        totalSeconds = 10 * 60;
    }
    remainingSeconds = totalSeconds;
    updateDisplay();
    updateRing();
}

function updateDisplay() {
    const m = Math.floor(remainingSeconds / 60)
        .toString()
        .padStart(2, "0");
    const s = (remainingSeconds % 60).toString().padStart(2, "0");
    document.getElementById("timer-display").textContent = m + ":" + s;

    const labels = { work: "ФОКУС", break: "ПЕРЕРЫВ", longbreak: "ОТДЫХ" };
    const modeLabels = { focus: "ФОКУС", break: "ПЕРЕРЫВ" };
    document.getElementById("timer-label").textContent =
        timerMode === "pomodoro"
            ? labels[currentPhase] || "ФОКУС"
            : timerMode === "focus"
                ? "ГЛУБОКИЙ ФОКУС"
                : "ПЕРЕРЫВ";

    const ring = document.getElementById("ring");
    if (
        currentPhase === "break" ||
        currentPhase === "longbreak" ||
        timerMode === "break"
    ) {
        ring.classList.add("break");
    } else {
        ring.classList.remove("break");
    }
}

function updateRing() {
    const pct = totalSeconds > 0 ? remainingSeconds / totalSeconds : 1;
    const offset = CIRCUMFERENCE * (1 - pct);
    document.getElementById("ring").style.strokeDashoffset = offset;
}

function saveStats() {
    localStorage.setItem("focus_stats", JSON.stringify(stats));
}

function updateStats() {
    document.getElementById("stat-pomodoros").textContent =
        stats.pomodoros || 0;
    document.getElementById("stat-minutes").textContent =
        stats.minutes || 0;
    document.getElementById("stat-breaks").textContent =
        stats.breaks || 0;
    document.getElementById("stat-streak").textContent =
        stats.streak || 0;
}

// ─── TASKS ────────────────────────────────────────────────
let tasks = JSON.parse(localStorage.getItem("focus_tasks") || "[]");

function addTask() {
    const input = document.getElementById("task-input");
    const text = input.value.trim();
    if (!text) return;
    tasks.push({ id: genId(), text, done: false });
    input.value = "";
    saveTasks();
    renderTasks();
}

function toggleTask(id) {
    const t = tasks.find((t) => t.id === id);
    if (t) {
        t.done = !t.done;
        saveTasks();
        renderTasks();
    }
}

function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    renderTasks();
}

function saveTasks() {
    localStorage.setItem("focus_tasks", JSON.stringify(tasks));
}

function renderTasks() {
    const list = document.getElementById("tasks-list");
    if (tasks.length === 0) {
        list.innerHTML =
            '<div style="color:var(--text-muted);font-size:.82rem;text-align:center;padding:12px;">Задач нет</div>';
        return;
    }
    list.innerHTML = tasks
        .map(
            (t) => `
    <div class="task-row ${t.done ? "done" : ""}">
      <input type="checkbox" ${t.done ? "checked" : ""} onchange="toggleTask('${t.id}')">
      <label onclick="toggleTask('${t.id}')">${t.text}</label>
      <button class="task-del" onclick="deleteTask('${t.id}')">✕</button>
    </div>`,
        )
        .join("");
}

// ─── NOTIFY ───────────────────────────────────────────────
let notifTimeout;
function notify(title, msg) {
    const el = document.getElementById("notif");
    document.getElementById("notif-title").textContent = title;
    document.getElementById("notif-msg").textContent = msg;
    el.classList.add("show");
    clearTimeout(notifTimeout);
    notifTimeout = setTimeout(() => el.classList.remove("show"), 4000);
}

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 150, 300].forEach((delay) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime + delay / 1000);
            gain.gain.exponentialRampToValueAtTime(
                0.001,
                ctx.currentTime + delay / 1000 + 0.3,
            );
            osc.start(ctx.currentTime + delay / 1000);
            osc.stop(ctx.currentTime + delay / 1000 + 0.35);
        });
    } catch (e) { }
}

// ─── INIT ─────────────────────────────────────────────────
updateStats();
renderTasks();
totalSeconds = getWorkTime();
remainingSeconds = totalSeconds;
updateDisplay();
updateRing();