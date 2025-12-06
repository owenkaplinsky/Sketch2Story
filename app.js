const PROJECTS_KEY = "storyboardProjects";
const panels = [];
const scenes = [];

const form = document.getElementById("panelForm");
const list = document.getElementById("panels");
const uploadTrigger = document.getElementById("uploadTrigger");
const uploadInput = document.getElementById("uploadInput");
const settingsTrigger = document.getElementById("settingsTrigger");
const modal = document.querySelector("[data-modal]");
const modalInput = document.querySelector("[data-prompt-input]");
const modalSubmit = document.querySelector("[data-modal-submit]");
const modalCancel = document.querySelector("[data-modal-cancel]");
const settingsModal = document.querySelector("[data-settings-modal]");
const settingsSave = document.querySelector("[data-settings-save]");
const settingsCancel = document.querySelector("[data-settings-cancel]");
const settingsAspectInputs = document.querySelectorAll("input[name='settingsAspect']");
const apiTokenInput = document.getElementById("apiTokenInput");
const openaiTokenInput = document.getElementById("openaiTokenInput");
const tabs = document.querySelectorAll("[data-tab]");
const tabPanels = document.querySelectorAll("[data-tab-panel]");
const sceneForm = document.getElementById("sceneForm");
const sceneTitleInput = document.getElementById("sceneTitle");
const sceneDescriptionInput = document.getElementById("sceneDescription");
const scenesList = document.getElementById("scenesList");
const sceneModal = document.querySelector("[data-scene-modal]");
const sceneModalTrigger = document.getElementById("sceneModalTrigger");
const sceneModalCancel = document.querySelector("[data-scene-cancel]");
const sceneModalSave = document.querySelector("[data-scene-save]");
const convertSceneSelect = document.getElementById("convertSceneSelect");
const projectTitleEl = document.getElementById("projectTitle");

const colorChoices = ["#121826", "#0f9ed5", "#eb5757", "#35a05c", "#7a7f8c", "#f2c94c"];
const OPENAI_MODEL = "gpt-5.1";
const PROJECT_ID = new URLSearchParams(window.location.search).get("project") || "default";
let aspect = localStorage.getItem("aspectChoice") || "16:9";
document.body.dataset.aspect = aspect;
document.documentElement.style.setProperty("--canvas-aspect", aspect.replace(":", " / "));
const STORAGE_KEY = `storyboardPanels:${PROJECT_ID}`;
const SCENE_STORAGE_KEY = `storyboardScenes:${PROJECT_ID}`;

let dragState = {
  draggingId: null,
  overId: null,
  draggingEl: null,
  dragImage: null,
};
let gapControls = null;
let currentGapIndex = null;
let convertTargetPanel = null;
const BRIA_ENDPOINT = "https://engine.prod.bria-api.com/v2/image/generate";

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const panel = createPanel("draw");

  panels.push(panel);
  addPanelCard(panel);
  renumberPanels();
  savePanels();
});

// Settings for aspect and tokens will be handled in the settings modal.

uploadTrigger?.addEventListener("click", () => {
  uploadInput?.click();
});

uploadInput?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const imageUrl = URL.createObjectURL(file);
  const panel = createPanel("image", { imageUrl });
  panels.push(panel);
  addPanelCard(panel);
  renumberPanels();
  uploadInput.value = "";
  savePanels();
});

modalCancel?.addEventListener("click", closeModal);

modalSubmit?.addEventListener("click", async () => {
  if (!convertTargetPanel) return;
  const details = modalInput.value.trim();
  await convertPanelToImage(convertTargetPanel, details);
  closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal?.classList.contains("active")) {
    closeModal();
  }
  if (event.key === "Escape" && sceneModal?.classList.contains("active")) {
    closeSceneModal();
  }
});

settingsTrigger?.addEventListener("click", () => {
  populateSettingsModal();
  settingsModal?.classList.add("active");
});

settingsCancel?.addEventListener("click", () => {
  settingsModal?.classList.remove("active");
});

settingsSave?.addEventListener("click", () => {
  const selectedAspect = [...settingsAspectInputs].find((input) => input.checked)?.value || "16:9";
  aspect = selectedAspect;
  document.body.dataset.aspect = aspect;
  document.documentElement.style.setProperty("--canvas-aspect", aspect.replace(":", " / "));
  localStorage.setItem("aspectChoice", aspect);
  resizeAllCanvases();

  const briaTokenVal = apiTokenInput?.value || "";
  localStorage.setItem("briaApiToken", briaTokenVal);

  const openaiTokenVal = openaiTokenInput?.value || "";
  localStorage.setItem("openaiApiToken", openaiTokenVal);

  settingsModal?.classList.remove("active");
  savePanels();
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab || "panels"));
});

sceneModalTrigger?.addEventListener("click", () => openSceneModal());

sceneModalCancel?.addEventListener("click", () => closeSceneModal());
sceneModal?.addEventListener("click", (event) => {
  if (event.target === sceneModal) closeSceneModal();
});

sceneForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = (sceneTitleInput?.value || "").trim();
  const description = (sceneDescriptionInput?.value || "").trim();
  const scene = createScene({ title, description });
  scenes.push(scene);
  renderScenes();
  saveScenes();
  sceneForm.reset();
  closeSceneModal();
});

function populateSettingsModal() {
  const savedAspect = localStorage.getItem("aspectChoice") || aspect;
  settingsAspectInputs.forEach((input) => {
    input.checked = input.value === savedAspect;
  });
  if (apiTokenInput) {
    apiTokenInput.value = localStorage.getItem("briaApiToken") || apiTokenInput.value || "";
  }
  if (openaiTokenInput) {
    openaiTokenInput.value = localStorage.getItem("openaiApiToken") || openaiTokenInput.value || "";
  }
}

populateSettingsModal();
loadPanelsFromStorage();
loadScenesFromStorage();
refreshSceneSelect();
setupGapControls();
if (tabs.length) {
  activateTab("panels");
}
initializeProjectTitle();

function createPanel(mode, extras = {}) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `panel-${Date.now()}`,
    title: "",
    notes: "",
    mode,
    drawing: extras.drawing || null,
    imageUrl: extras.imageUrl || null,
  };
}

function addPanelCard(panel, index, total) {
  if (!list) return;
  if (list.classList.contains("empty-state")) {
    list.classList.remove("empty-state");
    list.innerHTML = "";
  }

  const card = document.createElement("article");
  card.className = "panel-card";
  card.dataset.id = panel.id;

  card.innerHTML = `
    <div class="panel-head">
      <p class="eyebrow">Panel ${panels.length}</p>
      <div class="head-actions">
        ${
          panel.mode === "draw"
            ? `<button class="secondary small" type="button" data-convert="${panel.id}">Convert to Image</button>`
            : ""
        }
        <button class="remove" type="button" data-remove="${panel.id}">Remove</button>
      </div>
    </div>
    <input class="title-input" type="text" placeholder="Add title" value="${panel.title}">
    ${
      panel.mode === "image"
        ? `<div class="canvas-wrap image-mode">
             <div class="toolbar-spacer" aria-hidden="true"></div>
             <div class="image-wrap"><img src="${panel.imageUrl}" alt="Uploaded panel image"></div>
           </div>`
        : `<div class="canvas-wrap">
            <div class="toolbar">
              <div class="swatches">
                ${colorChoices
                  .map(
                    (color, index) =>
                      `<button type="button" class="color-swatch" data-color="${color}" aria-label="Use ${color}" style="background:${color};${
                        index === 0 ? "box-shadow: 0 0 0 2px #fff, 0 0 0 3px " + color : ""
                      }"></button>`
                  )
                  .join("")}
              </div>
              <label class="brush-range">
                Brush
                <input type="range" min="2" max="16" value="4" data-brush>
                <span data-brush-value>4</span>px
              </label>
              <button class="clear" type="button" data-clear>Clear</button>
            </div>
            <canvas></canvas>
          </div>`
    }
    <textarea class="notes-input" placeholder="Notes, beats, or camera cues">${panel.notes}</textarea>
  `;

  const removeButton = card.querySelector("[data-remove]");
  removeButton?.addEventListener("click", () => requestPanelRemoval(panel));

  const convertButton = card.querySelector("[data-convert]");
  convertButton?.addEventListener("click", () => openModal(panel));

  const titleInput = card.querySelector(".title-input");
  titleInput?.addEventListener("input", (event) => {
    panel.title = event.target.value;
    savePanels();
  });

  const notesInput = card.querySelector(".notes-input");
  notesInput?.addEventListener("input", (event) => {
    panel.notes = event.target.value;
    savePanels();
  });

  list.appendChild(card);

  const canvas = card.querySelector("canvas");
  if (canvas && panel.mode === "draw") setupCanvas(canvas, card, panel);

  const dragHandle = card.querySelector(".panel-head");
  if (dragHandle) setupDrag(card, dragHandle, panel.id);
}

function removePanel(id) {
  const idx = panels.findIndex((panel) => panel.id === id);
  if (idx !== -1) {
    const [removed] = panels.splice(idx, 1);
    if (removed?.imageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(removed.imageUrl);
    }
  }

  const card = list?.querySelector(`[data-id="${id}"]`);
  card?.remove();
  renumberPanels();
  savePanels();

  if (list && !list.children.length) {
    list.classList.add("empty-state");
    list.innerHTML = `<p class="empty-copy">No panels yet. Add one to start sketching.</p>`;
  }
}

function renumberPanels() {
  const cards = list?.querySelectorAll(".panel-card");
  cards?.forEach((card, index) => {
    const label = card.querySelector(".panel-head .eyebrow");
    if (label) {
      label.textContent = `Panel ${index + 1}`;
    }
  });
}

function setupCanvas(canvas, card, panel) {
  const ctx = canvas.getContext("2d");
  const state = {
    color: colorChoices[0],
    brush: 4,
  };

  resizeCanvas(canvas, ctx, state);

  let drawing = false;
  let last = null;

  const brushInput = card.querySelector("[data-brush]");
  const brushValue = card.querySelector("[data-brush-value]");
  if (brushInput && brushValue) {
    brushInput.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      state.brush = value;
      ctx.lineWidth = value;
      brushValue.textContent = value.toString();
    });
  }

  const swatches = card.querySelectorAll(".color-swatch");
  swatches.forEach((button) => {
    button.addEventListener("click", () => {
      swatches.forEach((b) => (b.style.boxShadow = ""));
      state.color = button.dataset.color || colorChoices[0];
      ctx.strokeStyle = state.color;
      button.style.boxShadow = `0 0 0 2px #fff, 0 0 0 3px ${ctx.strokeStyle}`;
    });
  });

  const clearButton = card.querySelector("[data-clear]");
  clearButton?.addEventListener("click", () => {
    resizeCanvas(canvas, ctx, state, true);
    if (panel) panel.drawing = null;
    savePanels();
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    drawing = true;
    last = getPos(event, canvas);
    drawPoint(last);
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    event.preventDefault();
    const pos = getPos(event, canvas);
    drawLine(last, pos);
    last = pos;
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
    canvas.addEventListener(type, (event) => {
      drawing = false;
      last = null;
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      saveDrawing(panel, canvas);
      savePanels();
    });
  });

  function drawPoint(pos) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  function drawLine(from, to) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  if (panel.drawing) {
    restoreDrawing(panel, ctx, canvas);
  }
}

function getPos(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function resizeCanvas(canvas, ctx, state, shouldClear = false) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = state.color;
  ctx.lineWidth = state.brush;

  if (shouldClear) return;
}

function resizeAllCanvases() {
  const cards = list?.querySelectorAll(".panel-card");
  cards?.forEach((card) => {
    const canvas = card.querySelector("canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const brush = Number(card.querySelector("[data-brush]")?.value || 4);
    const color =
      card.querySelector(".color-swatch[style*='box-shadow']")?.dataset.color || colorChoices[0];
    const panelId = card.dataset.id;
    const panel = panels.find((p) => p.id === panelId);
    if (panel?.mode !== "draw") return;
    resizeCanvas(canvas, ctx, { color, brush }, true);
    if (panel?.drawing) restoreDrawing(panel, ctx, canvas);
  });
}

function setupDrag(card, handle, id) {
  handle.draggable = true;

  handle.addEventListener("dragstart", (event) => {
    dragState.draggingId = id;
    dragState.draggingEl = card;
    event.dataTransfer?.setData("text/plain", id);
    const clone = card.cloneNode(true);
    clone.classList.add("drag-image");
    clone.style.width = `${card.clientWidth}px`;
    clone.style.position = "absolute";
    clone.style.top = "-9999px";
    clone.style.left = "-9999px";
    document.body.appendChild(clone);
    dragState.dragImage = clone;
    const offsetX = event.offsetX || card.clientWidth / 2;
    const offsetY = event.offsetY || 20;
    event.dataTransfer?.setDragImage(clone, offsetX, offsetY);
    card.classList.add("dragging");
  });

  handle.addEventListener("dragend", () => {
    dragState.draggingId = null;
    dragState.overId = null;
    if (dragState.draggingEl) {
      dragState.draggingEl.classList.remove("dragging");
    }
    if (dragState.dragImage) {
      dragState.dragImage.remove();
    }
    dragState.draggingEl = null;
    dragState.dragImage = null;
    syncPanelsFromDom();
    renumberPanels();
    savePanels();
  });

  card.addEventListener("dragover", (event) => handleCardDragOver(event, card));
  card.addEventListener("dragleave", () => {});
  card.addEventListener("drop", handleDrop);
}

function handleCardDragOver(event, card) {
  event.preventDefault();
  const dragging = dragState.draggingEl;
  if (!dragging || dragging === card) return;
  if (!list) return;
  const rect = card.getBoundingClientRect();
  const isAfter = event.clientY > rect.top + rect.height / 2;
  if (isAfter) {
    list.insertBefore(dragging, card.nextSibling);
  } else {
    list.insertBefore(dragging, card);
  }
}

function handleDrop(event) {
  event.preventDefault();
  if (!dragState.draggingId) return;
  syncPanelsFromDom();
  renumberPanels();
  savePanels();
}

function saveDrawing(panel, canvas) {
  if (panel.mode !== "draw") return;
  panel.drawing = canvas.toDataURL("image/png");
}

function restoreDrawing(panel, ctx, canvas) {
  if (!panel.drawing) return;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
  };
  img.src = panel.drawing;
}

function rerenderPanels() {
  if (!list) return;
  const gc = gapControls;
  if (gc && gc.parentNode === list) {
    list.removeChild(gc);
  }
  list.innerHTML = "";
  if (!panels.length) {
    list.classList.add("empty-state");
    list.innerHTML = `<p class="empty-copy">No panels yet. Add one to start sketching.</p>`;
    return;
  }
  list.classList.remove("empty-state");
  panels.forEach((panel, idx) => addPanelCard(panel, idx, panels.length));
  if (gc) {
    list.appendChild(gc);
  }
  renumberPanels();
  updateGapControls();
}

function syncPanelsFromDom() {
  if (!list) return;
  const ids = [...list.querySelectorAll(".panel-card")].map((el) => el.dataset.id);
  const ordered = [];
  ids.forEach((id) => {
    const found = panels.find((p) => p.id === id);
    if (found) ordered.push(found);
  });
  panels.length = 0;
  ordered.forEach((p) => panels.push(p));
}

async function convertPanelToImage(panel, details) {
  const card = list?.querySelector(`[data-id="${panel.id}"]`);
  const canvas = card?.querySelector("canvas");
  if (!canvas) {
    alert("No sketch found to convert.");
    return;
  }

  const apiToken = (apiTokenInput?.value || localStorage.getItem("briaApiToken") || "").trim();
  if (!apiToken) {
    alert("Enter your Bria api_token before converting.");
    apiTokenInput?.focus();
    return;
  }
  const openaiToken = (openaiTokenInput?.value || localStorage.getItem("openaiApiToken") || "").trim();
  if (!openaiToken) {
    alert("Enter your OpenAI API key in Settings before converting.");
    return;
  }

  const dataUrl = canvas.toDataURL("image/png");
  const sceneId = convertSceneSelect?.value || "";
  if (!sceneId) {
    alert("Select a scene before generating.");
    return;
  }
  const scene = scenes.find((s) => s.id === sceneId);
  const sceneContext = scene
    ? `Scene title: ${scene.title || "Untitled scene"}; Description: ${scene.description || "No description provided."}`
    : "";
  const userPrompt = details || "Generate a storyboard frame based on this layout.";
  const combinedPrompt = sceneContext ? `${sceneContext}\n${userPrompt}` : userPrompt;

  const neighbors = getNeighborImages(panel.id);
  const images = [{ label: "sketch", url: dataUrl }];
  if (neighbors.left) images.push({ label: "left", url: neighbors.left });
  if (neighbors.right) images.push({ label: "right", url: neighbors.right });

  const prompt = await rewritePrompt(combinedPrompt, images, openaiToken);
  if (!prompt) {
    alert("Prompt rewrite failed; please try again.");
    return;
  }
  const finalPrompt = prompt;
  alert(`RESPONSE\n\n---\n\n${finalPrompt}`);

  try {
    const response = await fetch(BRIA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", api_token: apiToken },
      body: JSON.stringify({
        prompt: finalPrompt,
        aspect_ratio: aspect,
      }),
    });

    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.warn("Failed to parse Bria response as JSON", err);
      }
    }
    if (!response.ok) {
      const msg = data?.error || `Failed to generate image (${response.status})`;
      throw new Error(msg);
    }

    const generated = data?.result?.image_url || data?.image_url;
    if (generated) {
      panel.mode = "image";
      panel.imageUrl = generated;
      panel.drawing = null;
      rerenderPanels();
      savePanels();
      alert(`RESPONSE\n\n---\n\n${text || ""}`);
      return;
    }

    const statusUrl = data?.status_url;
    if (statusUrl) {
      const polled = await pollStatus(statusUrl, apiToken);
      const finalUrl = polled?.data?.result?.image_url || polled?.data?.image_url;
      if (finalUrl) {
        panel.mode = "image";
        panel.imageUrl = finalUrl;
        panel.drawing = null;
        rerenderPanels();
        savePanels();
        alert(`RESPONSE\n\n---\n\n${polled.text || ""}`);
        return;
      }
      alert(`RESPONSE\n\n---\n\n${polled.text || ""}`);
      throw new Error("Polling completed without an image_url.");
    }

  alert(`RESPONSE\n\n---\n\n${text || ""}`);
  } catch (error) {
    console.error(error);
    alert(
      `${error.message || "Conversion failed."}\nVerify your api_token, network access, and try again.`
    );
  }
}

async function pollStatus(statusUrl, apiToken, maxTries = 25, delayMs = 1200) {
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const res = await fetch(statusUrl, {
        headers: { api_token: apiToken },
      });
      const text = await res.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (err) {
          console.warn("Failed to parse status response", err);
        }
      }

      const state = data?.result?.state || data?.state;
      const imageUrl = data?.result?.image_url || data?.image_url;

      if (imageUrl) return { data, text };
      if (state === "failed" || state === "error" || res.status >= 400) {
        throw new Error(`Status check failed (${res.status}): ${text}`);
      }
      // continue polling for pending states
    } catch (err) {
      console.error("Polling error:", err);
      if (attempt === maxTries) {
        throw err;
      }
    }
  }
  throw new Error("Polling timed out without receiving an image.");
}

function initializeProjectTitle() {
  if (!projectTitleEl) return;
  const { project } = getProjectMeta();
  const title = project?.title?.trim() || "Untitled project";
  setProjectTitle(title);

  projectTitleEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      projectTitleEl.blur();
    }
  });

  projectTitleEl.addEventListener("blur", () => {
    const newTitle = (projectTitleEl.textContent || "").trim();
    saveProjectTitle(newTitle || "Untitled project");
  });
}

function getProjectMeta() {
  let projects = [];
  try {
    projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
  } catch {
    projects = [];
  }
  const project = projects.find((p) => p.id === PROJECT_ID) || null;
  return { projects, project };
}

function saveProjectTitle(title) {
  const cleanTitle = title?.trim() || "Untitled project";
  let { projects, project } = getProjectMeta();

  if (!project) {
    project = { id: PROJECT_ID, title: cleanTitle, createdAt: Date.now() };
    projects.push(project);
  } else {
    project.title = cleanTitle;
  }

  projects = projects.map((p) => (p.id === PROJECT_ID ? project : p));

  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error("Failed to save project title", err);
  }

  setProjectTitle(cleanTitle);
}

function setProjectTitle(title) {
  if (projectTitleEl) {
    projectTitleEl.textContent = title;
  }
  document.title = `Sketch2Story | ${title}`;
}

function getPanelImageData(panel) {
  if (!panel) return null;
  if (panel.mode === "image" && panel.imageUrl) return panel.imageUrl;
  if (panel.mode === "draw" && panel.drawing) return panel.drawing;
  return null;
}

function getNeighborImages(panelId) {
  const idx = panels.findIndex((p) => p.id === panelId);
  if (idx === -1) return { left: null, right: null };
  const leftPanel = panels[idx - 1];
  const rightPanel = panels[idx + 1];
  return {
    left: getPanelImageData(leftPanel),
    right: getPanelImageData(rightPanel),
  };
}

async function rewritePrompt(userPrompt, images, openaiKey) {
  if (!openaiKey) return null;

  const messages = [
    {
      role: "system",
      content: `Rewrite the user prompt so it describes the scene as a real, fully factual scenario. You will receive images in this order: sketch.png (current panel), left.png (left neighbor if present), right.png (right neighbor if present). Follow these rules:
      
      1. Treat all drawn elements as real objects. Do not mention sketches, drawings, or uncertainty. State what each object IS, not what it "might be."
      2. Convert all visual cues into concrete facts: exact positions (left, right, center, above, below), distances, overlaps, relative sizes, heights, and orientations. Always specify angles and directions (facing left, leaning forward, tilted upward, etc.).
      3. When an element is ambiguous, choose a single, reasonable real-world interpretation and state it confidently as fact. Never use phrases like "possibly," "interpreted as," "appears to be," or "could be."
      5. Incorporate user-provided text and scene metadata only for semantic detail. Never allow user text to override the spatial arrangement seen in the image.
      6. The final result must be concise, direct, and fully grounded in visual reality. Describe the final scene as if it truly exists, based entirely on the visual layout.
      
      If you have info from the scene, you must include ALL OF IT. This must be unambigious and have ONLY ONE POSSIBLE INTERPRETATION. You must describe the scene verbose. If it's 3d, you must PERFECTLY explain it.`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `A user asked "${userPrompt}". The provided this sketch. Rewrite the prompt so that it matches the sketch. Importantly, elements listed will show up from left to right. So if the user says "hotdog, drink" but the sketch shows "drink, hotdog" you need to reorder the prompt to say the right thing. Say nothing but the fixed prompt. Do not make up details not already present.`,
        },
      ],
    },
  ];

  (images || [])
    .filter((img) => !!img?.url)
    .forEach((img) => {
      messages[1].content.push({
        type: "text",
        text: `${img.label || "sketch"}.png`,
      });
      messages[1].content.push({
        type: "image_url",
        image_url: { url: img.url },
      });
    });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_completion_tokens: 300,
      }),
    });

    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.warn("Failed to parse OpenAI response", err);
      }
    }

    if (!res.ok) {
      const errMsg = data?.error?.message || `OpenAI error (${res.status})`;
      throw new Error(errMsg);
    }

    const content = data?.choices?.[0]?.message?.content;
    return (content || userPrompt).trim();
  } catch (error) {
    console.error("OpenAI prompt rewrite failed:", error);
    return null;
  }
}

function openSceneModal() {
  if (!sceneModal) return;
  sceneForm?.reset();
  sceneModal.classList.add("active");
  setTimeout(() => sceneTitleInput?.focus(), 0);
}

function closeSceneModal() {
  sceneModal?.classList.remove("active");
}

function activateTab(name) {
  if (!name) return;
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === name;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === name;
    panel.classList.toggle("active", isActive);
    panel.setAttribute("aria-hidden", isActive ? "false" : "true");
  });
}

function createScene({ title = "", description = "" } = {}) {
  return {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `scene-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    description,
  };
}

function renderScenes() {
  if (!scenesList) return;
  scenesList.innerHTML = "";
  if (!scenes.length) {
    scenesList.classList.add("empty-state");
    scenesList.innerHTML = `<p class="empty-copy">No scenes yet. Add one to outline your story.</p>`;
    refreshSceneSelect();
    return;
  }
  scenesList.classList.remove("empty-state");
  scenes.forEach((scene, idx) => addSceneCard(scene, idx));
  refreshSceneSelect();
}

function addSceneCard(scene, index) {
  if (!scenesList) return;
  const card = document.createElement("article");
  card.className = "scene-card";
  card.dataset.id = scene.id;

  const head = document.createElement("div");
  head.className = "scene-head";

  const titleWrap = document.createElement("div");
  const label = document.createElement("p");
  label.className = "eyebrow";
  label.textContent = `Scene ${index + 1}`;
  const title = document.createElement("h3");
  title.className = "scene-title";
  title.textContent = scene.title || "Untitled scene";
  titleWrap.append(label, title);

  const actions = document.createElement("div");
  actions.className = "head-actions";
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove";
  removeButton.textContent = "Remove";
  actions.appendChild(removeButton);

  head.append(titleWrap, actions);

  const description = document.createElement("p");
  description.className = "scene-description";
  description.textContent = scene.description || "No description added.";

  card.append(head, description);
  scenesList.appendChild(card);

  removeButton.addEventListener("click", () => {
    const shouldConfirm =
      (scene.title && scene.title.trim().length > 0) ||
      (scene.description && scene.description.trim().length > 0);
    if (!shouldConfirm || window.confirm("Remove this scene?")) {
      removeScene(scene.id);
    }
  });
}

function removeScene(id) {
  const idx = scenes.findIndex((scene) => scene.id === id);
  if (idx !== -1) {
    scenes.splice(idx, 1);
  }
  renderScenes();
  saveScenes();
}

function saveScenes() {
  try {
    localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(scenes));
  } catch (error) {
    console.error("Failed to save scenes", error);
  }
}

function loadScenesFromStorage() {
  try {
    const raw = localStorage.getItem(SCENE_STORAGE_KEY);
    if (!raw) {
      renderScenes();
      return;
    }
    const parsed = JSON.parse(raw);
    scenes.length = 0;
    parsed.forEach((scene) => scenes.push(scene));
    renderScenes();
  } catch (error) {
    console.error("Failed to load scenes", error);
    renderScenes();
  }
}

function refreshSceneSelect() {
  if (!convertSceneSelect) return;
  const current = convertSceneSelect.value;
  convertSceneSelect.innerHTML = `<option value="">No scene</option>`;
  scenes.forEach((scene) => {
    const opt = document.createElement("option");
    opt.value = scene.id;
    opt.textContent = scene.title || "Untitled scene";
    convertSceneSelect.appendChild(opt);
  });
  if (current) {
    convertSceneSelect.value = current;
  }
}

function savePanels() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
  } catch (error) {
    console.error("Failed to save panels", error);
  }
  updateGapControls();
}

function loadPanelsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      rerenderPanels();
      return;
    }
    const parsed = JSON.parse(raw);
    panels.length = 0;
    parsed.forEach((p) => panels.push(p));
    rerenderPanels();
  } catch (error) {
    console.error("Failed to load panels", error);
    rerenderPanels();
  }
}

function insertBlankPanel(atIndex) {
  const idx = Math.max(0, Math.min(atIndex, panels.length));
  const panel = createPanel("draw");
  panels.splice(idx, 0, panel);
  rerenderPanels();
  renumberPanels();
  savePanels();
}

function setupGapControls() {
  if (!list) return;
  gapControls = document.createElement("div");
  gapControls.className = "gap-controls";
  gapControls.innerHTML = `
    <button class="insert-btn" type="button" data-gap-action="+">+</button>
    <button class="insert-btn" type="button" data-gap-action="loop">🔁</button>
  `;
  list.style.position = "relative";
  list.appendChild(gapControls);

  gapControls.querySelectorAll("[data-gap-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentGapIndex == null) return;
      insertBlankPanel(currentGapIndex);
    });
  });

  list.addEventListener("mousemove", handleGapHover);
  list.addEventListener("mouseleave", () => hideGapControls());
}

function handleGapHover(event) {
  if (!list || panels.length < 2) {
    hideGapControls();
    return;
  }
  const cards = [...list.querySelectorAll(".panel-card")].map((el) => ({
    el,
    rect: el.getBoundingClientRect(),
  }));
  const gaps = [];
  const gapOffset = 32;
  // Group cards into rows by vertical proximity
  const sorted = [...cards].sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
  const rows = [];
  const rowTolerance = sorted.length ? sorted[0].rect.height / 2 : 40;
  sorted.forEach((card) => {
    const centerY = (card.rect.top + card.rect.bottom) / 2;
    let row = rows.find((r) => Math.abs(r.centerY - centerY) <= rowTolerance);
    if (!row) {
      row = { centerY, cards: [] };
      rows.push(row);
    }
    row.cards.push(card);
    row.centerY = (row.centerY * (row.cards.length - 1) + centerY) / row.cards.length;
  });
  rows.forEach((row) => row.cards.sort((a, b) => a.rect.left - b.rect.left));

  rows.forEach((row, rowIdx) => {
    if (!row.cards.length) return;
    const isLastRow = rowIdx === rows.length - 1;
    const rowY = row.centerY;

    // gap before first in row (only if not the first row)
    if (rowIdx > 0) {
      const firstRect = row.cards[0].rect;
      gaps.push({
        centerX: firstRect.left - gapOffset,
        centerY: rowY,
        index: panels.findIndex((p) => p.id === row.cards[0].el.dataset.id),
      });
    }

    // gaps between cards in row
    row.cards.forEach((card, idx) => {
      if (idx === row.cards.length - 1) return;
      const rectA = card.rect;
      const rectB = row.cards[idx + 1].rect;
      const centerX = (rectA.right + rectB.left) / 2;
      gaps.push({
        centerX,
        centerY: (rectA.top + rectA.bottom + rectB.top + rectB.bottom) / 4,
        index: panels.findIndex((p) => p.id === row.cards[idx + 1].el.dataset.id),
      });
    });

    // gap after last in row if not last row
    if (!isLastRow) {
      const lastRect = row.cards[row.cards.length - 1].rect;
      gaps.push({
        centerX: lastRect.right + gapOffset,
        centerY: rowY,
        index:
          panels.findIndex((p) => p.id === row.cards[row.cards.length - 1].el.dataset.id) + 1,
      });
    }
  });

  let nearest = null;
  let minDist = Infinity;
  gaps.forEach((gap) => {
    const dx = event.clientX - gap.centerX;
    const dy = event.clientY - gap.centerY;
    const dist = Math.hypot(dx, dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = gap;
    }
  });

  const threshold = 100;
  if (!nearest || minDist > threshold) {
    hideGapControls();
    return;
  }

  currentGapIndex = nearest.index;
  const listRect = list.getBoundingClientRect();
  const left = nearest.centerX - listRect.left;
  const top = nearest.centerY - listRect.top;
  gapControls.style.display = "flex";
  gapControls.style.left = `${left}px`;
  gapControls.style.top = `${top}px`;
  gapControls.classList.add("active");
}

function hideGapControls() {
  currentGapIndex = null;
  if (gapControls) {
    gapControls.classList.remove("active");
    gapControls.style.display = "none";
  }
}

function updateGapControls() {
  if (!gapControls) return;
  if (panels.length < 2) {
    hideGapControls();
    gapControls.style.display = "none";
  } else {
    gapControls.style.display = "flex";
  }
}

function shouldConfirmRemoval(panel) {
  if (!panel) return false;
  if (panel.mode === "image") return true;
  const hasTitle = (panel.title || "").trim().length > 0;
  const hasNotes = (panel.notes || "").trim().length > 0;
  const hasDrawing = Boolean(panel.drawing);
  return hasTitle || hasNotes || hasDrawing;
}

function requestPanelRemoval(panel) {
  if (!panel) return;
  const needsConfirm = shouldConfirmRemoval(panel);
  if (!needsConfirm) {
    removePanel(panel.id);
    return;
  }

  const message =
    panel.mode === "image"
      ? "Remove this image panel? This action cannot be undone."
      : "Remove this panel? Its sketch and notes will be lost.";

  if (window.confirm(message)) {
    removePanel(panel.id);
  }
}

function openModal(panel) {
  convertTargetPanel = panel;
  modal?.classList.add("active");
  refreshSceneSelect();
  modalInput.value = panel?.notes || "";
  modalInput.focus();
}

function closeModal() {
  modal?.classList.remove("active");
  convertTargetPanel = null;
  modalInput.value = "";
}
// Allow dropping at the end of the list
list?.addEventListener("dragover", (event) => {
  const dragging = dragState.draggingEl;
  if (!dragging) return;
  const target = event.target;
  const isCard = target && target.closest && target.closest(".panel-card");
  if (!isCard && list.lastElementChild !== dragging) {
    list.appendChild(dragging);
  }
});

list?.addEventListener("drop", handleDrop);
