const PROJECTS_KEY = "storyboardProjects";

const projectsGrid = document.getElementById("projectsGrid");
const newProjectBtn = document.getElementById("newProjectBtn");
const newProjectModal = document.querySelector("[data-new-project-modal]");
const newProjectName = document.getElementById("newProjectName");
const newProjectSave = document.querySelector("[data-new-project-save]");
const newProjectCancel = document.querySelector("[data-new-project-cancel]");

const homeSettingsTrigger = document.getElementById("homeSettingsTrigger");
const apiSettingsModal = document.querySelector("[data-api-settings-modal]");
const homeApiTokenInput = document.getElementById("homeApiTokenInput");
const homeOpenaiTokenInput = document.getElementById("homeOpenaiTokenInput");
const apiSettingsSave = document.querySelector("[data-api-settings-save]");
const apiSettingsCancel = document.querySelector("[data-api-settings-cancel]");

const missingApiModal = document.querySelector("[data-missing-api-modal]");
const missingApiCancel = document.querySelector("[data-missing-api-cancel]");
const missingApiSettings = document.querySelector("[data-missing-api-settings]");

newProjectBtn?.addEventListener("click", openProjectModal);
newProjectCancel?.addEventListener("click", closeProjectModal);
newProjectSave?.addEventListener("click", createProject);

homeSettingsTrigger?.addEventListener("click", openApiSettingsModal);
apiSettingsCancel?.addEventListener("click", closeApiSettingsModal);
apiSettingsSave?.addEventListener("click", saveApiSettings);

missingApiCancel?.addEventListener("click", closeMissingApiModal);
missingApiSettings?.addEventListener("click", () => {
  closeMissingApiModal();
  openApiSettingsModal();
});

renderProjects();
loadApiSettings();

function openProjectModal() {
  const briaToken = localStorage.getItem("briaApiToken")?.trim() || "";
  const openaiToken = localStorage.getItem("openaiApiToken")?.trim() || "";
  
  if (!briaToken || !openaiToken) {
    openMissingApiModal();
    return;
  }
  
  newProjectModal?.classList.add("active");
  if (newProjectName) {
    newProjectName.value = "";
    newProjectName.focus();
  }
}

function closeProjectModal() {
  newProjectModal?.classList.remove("active");
}

function openMissingApiModal() {
  missingApiModal?.classList.add("active");
}

function closeMissingApiModal() {
  missingApiModal?.classList.remove("active");
}

function createProject() {
  const name =
    newProjectName?.value?.trim() ||
    `Project ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  if (!name) return;
  const project = {
    id: crypto.randomUUID ? crypto.randomUUID() : `proj-${Date.now()}`,
    title: name,
    createdAt: Date.now(),
  };
  const projects = loadProjects();
  projects.push(project);
  saveProjects(projects);
  closeProjectModal();
  renderProjects();
}

function renderProjects() {
  const projects = loadProjects().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!projects.length) {
    projectsGrid.innerHTML = `<p class="empty-copy">No projects yet. Create one to start sketching.</p>`;
    return;
  }
  projectsGrid.innerHTML = "";

  projects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "project-card";

    const thumb = getThumbnail(project.id);
    card.innerHTML = `
      <div class="project-thumb" style="background-image:url('${thumb}')"></div>
      <div class="project-divider"></div>
      <div class="project-body">
        <div class="project-title">${project.title}</div>
        <div class="project-meta">${new Date(project.createdAt).toLocaleString()}</div>
      </div>
      <button class="delete-project" type="button" data-id="${project.id}">✕</button>
    `;

    card.addEventListener("click", (event) => {
      if ((event.target).closest(".delete-project")) return;
      window.location.href = `project.html?project=${encodeURIComponent(project.id)}`;
    });

    card.querySelector(".delete-project")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const ok = window.confirm(`Delete project "${project.title}"? This cannot be undone.`);
      if (!ok) return;
      deleteProject(project.id);
      renderProjects();
    });

    projectsGrid.appendChild(card);
  });
}

function deleteProject(id) {
  const projects = loadProjects().filter((p) => p.id !== id);
  saveProjects(projects);
  localStorage.removeItem(`storyboardPanels:${id}`);
  localStorage.removeItem(`storyboardScenes:${id}`);
}

function getThumbnail(id) {
  try {
    const raw = localStorage.getItem(`storyboardPanels:${id}`);
    if (!raw) return placeholder();
    const parsed = JSON.parse(raw);
    if (!parsed.length) return placeholder();
    const first = parsed[0];
    return first.imageUrl || first.drawing || placeholder();
  } catch {
    return placeholder();
  }
}

function placeholder() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='270' viewBox='0 0 480 270'%3E%3Crect width='480' height='270' fill='%23f5f7fb'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2397a0b8' font-family='Arial' font-size='18'%3ENo panels yet%3C/text%3E%3C/svg%3E";
}

function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveProjects(list) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
}

function openApiSettingsModal() {
  apiSettingsModal?.classList.add("active");
  loadApiSettings();
}

function closeApiSettingsModal() {
  apiSettingsModal?.classList.remove("active");
}

function loadApiSettings() {
  if (homeApiTokenInput) {
    homeApiTokenInput.value = localStorage.getItem("briaApiToken") || "";
  }
  if (homeOpenaiTokenInput) {
    homeOpenaiTokenInput.value = localStorage.getItem("openaiApiToken") || "";
  }
}

function saveApiSettings() {
  const briaToken = homeApiTokenInput?.value?.trim() || "";
  const openaiToken = homeOpenaiTokenInput?.value?.trim() || "";

  localStorage.setItem("briaApiToken", briaToken);
  localStorage.setItem("openaiApiToken", openaiToken);

  closeApiSettingsModal();
}
