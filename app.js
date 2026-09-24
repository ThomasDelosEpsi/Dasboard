// ====== Config IA (optionnel) ======
const OPENAI_API_KEY = ""; // <-- Mets ta clé API ici si tu veux utiliser l'IA
const OPENAI_MODEL = "gpt-4.1-mini"; // ou un autre modèle compatible

// ====== Clés de stockage ======
const STORAGE_KEYS = {
  TASKS: "pp_tasks",
  JOURNAL: "pp_journal",
  TIMER_MINUTES: "pp_timer_minutes"
};

let tasks = loadData(STORAGE_KEYS.TASKS);
let journalEntries = loadData(STORAGE_KEYS.JOURNAL);
let lastGeneratedMail = null;

// Chrono
let timerInterval = null;
let timerRemaining = 0; // en secondes
let timerRunning = false;

// ====== Utilitaires stockage ======
function loadData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erreur de lecture storage", key, e);
    return [];
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Erreur de sauvegarde storage", key, e);
  }
}

// ====== Date du jour ======
function updateTodayLabel() {
  const el = document.getElementById("todayLabel");
  const now = new Date();
  el.textContent = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

// ====== Tâches ======
function renderTasks() {
  const container = document.getElementById("taskList");
  container.innerHTML = "";

  if (!tasks.length) {
    container.innerHTML = '<p class="muted small">Aucune tâche pour l’instant.</p>';
    return;
  }

  const priorityOrder = { Urgent: 1, Important: 2, Normal: 3, Faible: 4 };
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
  });

  for (const task of sorted) {
    const div = document.createElement("div");
    div.className = "task" + (task.done ? " done" : "");
    div.dataset.id = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => toggleTaskDone(task.id));

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.style.display = "flex";
    meta.style.alignItems = "center";
    meta.style.gap = "4px";

    const pill = document.createElement("span");
    pill.className = "pill priority-" + task.priority;
    pill.textContent = task.priority;
    meta.appendChild(pill);

    if (task.project) {
      const small = document.createElement("small");
      small.textContent = task.project;
      meta.appendChild(small);
    }

    const textContainer = document.createElement("div");
    textContainer.style.flex = "1";
    textContainer.appendChild(title);
    textContainer.appendChild(meta);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "danger";
    deleteBtn.textContent = "×";
    deleteBtn.title = "Supprimer la tâche";
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    div.appendChild(checkbox);
    div.appendChild(textContainer);
    div.appendChild(deleteBtn);

    container.appendChild(div);
  }
}

function addTask() {
  const titleInput = document.getElementById("taskTitle");
  const prioritySelect = document.getElementById("taskPriority");
  const projectInput = document.getElementById("taskProject");

  const title = titleInput.value.trim();
  if (!title) return;

  const task = {
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    title,
    priority: prioritySelect.value,
    project: projectInput.value.trim() || "",
    done: false
  };

  tasks.push(task);
  saveData(STORAGE_KEYS.TASKS, tasks);
  titleInput.value = "";
  projectInput.value = "";
  renderTasks();
}

function toggleTaskDone(id) {
  tasks = tasks.map(t => (t.id === id ? { ...t, done: !t.done } : t));
  saveData(STORAGE_KEYS.TASKS, tasks);
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveData(STORAGE_KEYS.TASKS, tasks);
  renderTasks();
}

// ====== Journal ======
function renderJournal() {
  const container = document.getElementById("journalList");
  container.innerHTML = "";

  if (!journalEntries.length) {
    container.innerHTML = '<p class="muted small">Pas encore de notes pour aujourd’hui.</p>';
    return;
  }

  const sorted = [...journalEntries].sort((a, b) => a.createdAt - b.createdAt);

  for (const entry of sorted) {
    const div = document.createElement("div");
    div.className = "journal-entry";

    const time = document.createElement("time");
    time.textContent = new Date(entry.createdAt).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const text = document.createElement("div");
    text.textContent = entry.text;

    div.appendChild(time);
    div.appendChild(text);
    container.appendChild(div);
  }
}

function addJournalEntry() {
  const input = document.getElementById("journalInput");
  const text = input.value.trim();
  if (!text) return;

  const entry = {
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    text,
    createdAt: Date.now()
  };

  journalEntries.push(entry);
  saveData(STORAGE_KEYS.JOURNAL, journalEntries);
  input.value = "";
  renderJournal();
}

// ====== Génération du mail (mode simple) ======
function generateMailContentSimple() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const doneTasks = tasks.filter(t => t.done);
  const pendingTasks = tasks.filter(t => !t.done);
  const notes = [...journalEntries].sort((a, b) => a.createdAt - b.createdAt);

  let body = "";
  body += "Bonjour,\n\n";
  body += "Voici mon récapitulatif pour le " + dateStr + " :\n\n";

  body += "1) Tâches terminées\n";
  if (doneTasks.length) {
    for (const t of doneTasks) {
      const proj = t.project ? " [" + t.project + "]" : "";
      body += "- " + t.title + proj + " (" + t.priority + ")\n";
    }
  } else {
    body += "- Aucune tâche marquée comme terminée.\n";
  }
  body += "\n";

  body += "2) Tâches en cours / à poursuivre\n";
  if (pendingTasks.length) {
    for (const t of pendingTasks) {
      const proj = t.project ? " [" + t.project + "]" : "";
      body += "- " + t.title + proj + " (" + t.priority + ")\n";
    }
  } else {
    body += "- Rien en attente pour le moment.\n";
  }
  body += "\n";

  body += "3) Événements / notes de la journée\n";
  if (notes.length) {
    for (const n of notes) {
      const time = new Date(n.createdAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
      });
      body += "- [" + time + "] " + n.text + "\n";
    }
  } else {
    body += "- Pas de notes spécifiques.\n";
  }

  body += "\nCordialement,\n";
  body += "[À compléter]";

  const subject = "Compte-rendu " + dateStr;
  return { subject, body };
}

// ====== Génération du mail (IA via API) ======
function buildStructuredSummary() {
  const now = new Date();
  return {
    date: now.toISOString(),
    dateHuman: now.toLocaleDateString("fr-FR"),
    tasks: tasks,
    journal: journalEntries
  };
}

async function generateMailContentWithAI() {
  if (!OPENAI_API_KEY) {
    throw new Error("Aucune clé API configurée");
  }

  const summary = buildStructuredSummary();
  const { subject } = generateMailContentSimple(); // on garde un sujet simple

  const systemPrompt =
    "Tu es un assistant qui rédige des mails professionnels concis en français. " +
    "Tu reçois les tâches et notes de la journée d'une personne et tu dois produire " +
    "un mail structuré et poli, adapté à un manager interne.";

  const userPrompt =
    "Voici les informations structurées de ma journée (tâches et journal) sous forme JSON :\n\n" +
    JSON.stringify(summary, null, 2) +
    "\n\nRédige un mail professionnel de compte-rendu de fin de journée, en tutoiement neutre " +
    "ou vouvoiement léger (au choix), sans ajouter de choses inventées. " +
    "Le mail doit être directement prêt à envoyer (sans placeholder).";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error("Erreur API (" + response.status + ")");
  }

  const data = await response.json();
  const body = (data.choices?.[0]?.message?.content || "").trim();
  if (!body) {
    throw new Error("Réponse IA vide");
  }

  return { subject, body };
}

// ====== UI mail ======
function updateMailPreview(subject, body) {
  const preview = document.getElementById("mailPreview");
  preview.value = "Objet : " + subject + "\n\n" + body;
}

async function onGenerateMailClick() {
  const useAi = document.getElementById("useAiCheckbox").checked;
  const preview = document.getElementById("mailPreview");
  const mailBtn = document.getElementById("openMailClientBtn");

  preview.value = useAi
    ? "Génération du mail par IA en cours..."
    : "Génération du mail en cours...";

  let result;
  try {
    if (useAi) {
      result = await generateMailContentWithAI();
    } else {
      result = generateMailContentSimple();
    }
  } catch (err) {
    console.error(err);
    // fallback simple si IA KO
    result = generateMailContentSimple();
  }

  lastGeneratedMail = result;
  updateMailPreview(result.subject, result.body);
  mailBtn.disabled = false;
}

function openMailClient() {
  const data = lastGeneratedMail || generateMailContentSimple();
  const mailto =
    "mailto:?subject=" +
    encodeURIComponent(data.subject) +
    "&body=" +
    encodeURIComponent(data.body);

  window.location.href = mailto;
}

// ====== Chrono ======
function initTimer() {
  const minutesInput = document.getElementById("timerMinutes");
  const saved = localStorage.getItem(STORAGE_KEYS.TIMER_MINUTES);
  if (saved) {
    minutesInput.value = parseInt(saved, 10) || 25;
  }

  timerRemaining = (parseInt(minutesInput.value, 10) || 25) * 60;
  updateTimerDisplay();

  minutesInput.addEventListener("change", () => {
    let minutes = parseInt(minutesInput.value, 10);
    if (!minutes || minutes < 1) minutes = 1;
    if (minutes > 180) minutes = 180;
    minutesInput.value = minutes;
    localStorage.setItem(STORAGE_KEYS.TIMER_MINUTES, String(minutes));
    if (!timerRunning) {
      timerRemaining = minutes * 60;
      updateTimerDisplay();
    }
  });
}

function updateTimerDisplay() {
  const display = document.getElementById("timerDisplay");
  const minutes = Math.floor(timerRemaining / 60);
  const seconds = timerRemaining % 60;
  display.textContent =
    String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function startPauseTimer() {
  const statusEl = document.getElementById("timerStatus");
  const btn = document.getElementById("startPauseTimerBtn");

  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    btn.textContent = "Reprendre";
    statusEl.textContent = "En pause.";
    return;
  }

  if (timerRemaining <= 0) {
    const minutesInput = document.getElementById("timerMinutes");
    const minutes = parseInt(minutesInput.value, 10) || 25;
    timerRemaining = minutes * 60;
  }

  timerRunning = true;
  btn.textContent = "Pause";
  statusEl.textContent = "En cours...";

  timerInterval = setInterval(() => {
    timerRemaining -= 1;
    if (timerRemaining <= 0) {
      timerRemaining = 0;
      clearInterval(timerInterval);
      timerRunning = false;
      btn.textContent = "Recommencer";
      statusEl.textContent = "Terminé !";
      try {
        // petit feedback simple
        window.alert("Le temps est écoulé 👌");
      } catch (_) {}
    }
    updateTimerDisplay();
  }, 1000);
}

function resetTimer() {
  const minutesInput = document.getElementById("timerMinutes");
  const statusEl = document.getElementById("timerStatus");
  const btn = document.getElementById("startPauseTimerBtn");

  clearInterval(timerInterval);
  timerRunning = false;
  timerRemaining = (parseInt(minutesInput.value, 10) || 25) * 60;
  updateTimerDisplay();
  btn.textContent = "Démarrer";
  statusEl.textContent = "Prêt.";
}

// ====== Init ======
document.addEventListener("DOMContentLoaded", () => {
  updateTodayLabel();
  renderTasks();
  renderJournal();
  initTimer();

  // Tâches
  document.getElementById("addTaskBtn").addEventListener("click", addTask);
  document.getElementById("taskTitle").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  });

  // Journal
  document.getElementById("addJournalBtn").addEventListener("click", addJournalEntry);
  document.getElementById("journalInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addJournalEntry();
    }
  });

  // Mail
  document
    .getElementById("generateMailBtn")
    .addEventListener("click", () => onGenerateMailClick());
  document
    .getElementById("openMailClientBtn")
    .addEventListener("click", openMailClient);

  // Chrono
  document
    .getElementById("startPauseTimerBtn")
    .addEventListener("click", startPauseTimer);
  document
    .getElementById("resetTimerBtn")
    .addEventListener("click", resetTimer);
});
