const STORAGE_KEY = "heart-mechanic-mvp1-v1";
const BACKUP_VERSION = 1;
const MAP_TRANSITION_PLAYBACK_RATE = 2;

const relationshipTypes = ["Family", "Friend", "Ex-Partner", "Romantic", "Work", "Neighbour", "Mentor", "Community", "Other"];
const energeticOrientations = ["Grounded", "Activated", "Unclear"];
const currentStatuses = ["Active", "Distant", "Disconnected"];
const architectPlacements = ["Inner Counsel", "Knights", "Nobles", "Courtiers", "Villagers", "Out of Kingdom"];
const mechanicPlacements = ["Inner Counsel", "Knights", "Nobles", "Noble Fading", "Courtiers", "Villagers", "The Hold", "Out of Kingdom"];
const placements = architectPlacements;
const allPlacements = Array.from(new Set([...architectPlacements, ...mechanicPlacements]));
const knightStatuses = ["Active", "Rising"];
const nobleStatuses = ["Active", "Legacy"];
const placementDescriptions = {
  "": "Not placed yet. Leave someone here until the architecture becomes clear.",
  "Inner Counsel": "The closest, safest and most trusted people in the current map.",
  Knights: "Active supporters, allies and meaningful relationships with real presence.",
  Nobles: "People with significance, history or wisdom, but not necessarily daily access.",
  "Noble Fading": "Noble relationships that still matter, but are losing present alignment or access.",
  Courtiers: "People with some access, relevance or recurring contact, but less emotional authority.",
  Villagers: "Peripheral people who belong in the world of the map without needing central access.",
  "The Hold": "Unclear or unresolved relationships that need more time before a final placement.",
  "Out of Kingdom": "People who sit outside your current relational structure and require little or no access."
};
const placementSealAssets = {
  "": "./assets/seal-unmapped.png",
  "Inner Counsel": "./assets/seal-inner-counsel.png",
  Knights: "./assets/seal-knights.png",
  Nobles: "./assets/seal-nobles.png",
  "Noble Fading": "./assets/seal-noble-fading.png",
  Courtiers: "./assets/seal-courtiers.png",
  Villagers: "./assets/seal-villagers.png",
  "The Hold": "./assets/seal-hold.png",
  "Out of Kingdom": "./assets/seal-out-of-kingdom.png"
};

const sampleNames = [
  "Amara Stone",
  "Julian Vale",
  "Maya Chen",
  "Theo Marlow",
  "Noah Reed",
  "Priya Shah",
  "Daniel Cross",
  "Elena Brooks"
];

let state = loadState();
let pendingImport = [];
let activeCensusId = null;
let censusDrag = null;
let nameMode = "real";
let selectedSphereId = null;
let activeProfileId = null;
let activeProfileReturnRoute = "architect";
let currentRoute = "welcome";
let routeHistory = [];
let mapTransitionTimer = null;
let mirrorSignalStage = false;

const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll("[data-route]");
const manualForm = document.querySelector("#manual-form");
const foundationAddForm = document.querySelector("#foundation-add-form");
const architectAddForm = document.querySelector("#architect-add-form");
const censusCard = document.querySelector("#census-card");
const importPreviewDialog = document.querySelector("#import-preview-dialog");

function makeId() {
  return `c_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function defaultSeals() {
  return { mirror: false, witness: false, architect: false };
}

function inferSeals(contacts, savedSeals = {}) {
  const seals = { ...defaultSeals(), ...savedSeals };
  const members = contacts.filter((contact) => contact.censusStatus === "inside" || contact.includedInKingdom === true);
  const mirrorReady = members.length > 0 && members.every((contact) => contact.energeticOrientation);
  const witnessReady = members.length > 0 && members.every((contact) => contact.relationshipType && contact.energeticOrientation && contact.currentStatus);
  const architectReady = members.length > 0 && members.every((contact) => contact.placement);

  return {
    mirror: Boolean(seals.mirror) || mirrorReady,
    witness: Boolean(seals.witness) || (Boolean(seals.mirror) || mirrorReady) && witnessReady,
    architect: Boolean(seals.architect) || (Boolean(seals.witness) || witnessReady) && architectReady
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const contacts = (parsed.contacts || []).map(normalizeContact);
      return {
        contacts,
        censusHistory: parsed.censusHistory || [],
        lastSavedAt: parsed.lastSavedAt || "",
        seals: inferSeals(contacts, parsed.seals)
      };
    } catch (error) {
      console.warn("Could not load saved state", error);
    }
  }
  return { contacts: [], censusHistory: [], lastSavedAt: "", seals: defaultSeals() };
}

function saveState() {
  state.seals = { ...defaultSeals(), ...(state.seals || {}) };
  state.lastSavedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderLastSaved();
}

function saveAndRender() {
  saveState();
  renderAll();
}

function backupPayload() {
  return {
    app: "The Heart Mechanic Blueprint",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    contacts: state.contacts.map(normalizeContact),
    censusHistory: state.censusHistory || [],
    seals: { ...defaultSeals(), ...(state.seals || {}) },
    lastSavedAt: state.lastSavedAt || ""
  };
}

function exportProgress() {
  const payload = backupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `heart-mechanic-blueprint-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function restoreProgress(file) {
  if (!file) return;
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    window.alert("This backup file could not be read.");
    return;
  }

  if (!Array.isArray(parsed.contacts)) {
    window.alert("This does not look like a Heart Mechanic backup file.");
    return;
  }

  const confirmed = window.confirm("Restore this backup? This will replace the progress currently stored in this browser.");
  if (!confirmed) return;

  const contacts = parsed.contacts.map(normalizeContact);
  state = {
    contacts,
    censusHistory: Array.isArray(parsed.censusHistory) ? parsed.censusHistory : [],
    lastSavedAt: parsed.lastSavedAt || "",
    seals: inferSeals(contacts, parsed.seals)
  };
  saveAndRender();
  routeHistory = [];
  setRoute("welcome");
}

function renderLastSaved() {
  const label = document.querySelector("#last-saved-label");
  if (!label) return;
  if (!state.lastSavedAt) {
    label.textContent = "Not saved yet";
    return;
  }
  const saved = new Date(state.lastSavedAt);
  label.textContent = `Last saved ${saved.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
}

function normalizeContact(contact) {
  const status = contact.censusStatus || (typeof contact.includedInKingdom === "boolean" ? (contact.includedInKingdom ? "inside" : "outside") : "outside");
  return {
    id: contact.id || makeId(),
    name: (contact.name || "Unnamed Contact").trim() || "Unnamed Contact",
    censusStatus: ["inside", "outside", "skipped", "candidate"].includes(status) ? status : "outside",
    includedInKingdom: status === "inside" ? true : status === "outside" ? false : null,
    relationshipType: contact.relationshipType || "",
    energeticOrientation: normalizeEnergeticOrientation(contact.energeticOrientation),
    castName: contact.castName || "",
    currentStatus: contact.currentStatus || "",
    placement: allPlacements.includes(contact.placement) ? contact.placement : "",
    knightStatus: knightStatuses.includes(contact.knightStatus) ? contact.knightStatus : "Active",
    nobleStatus: nobleStatuses.includes(contact.nobleStatus) ? contact.nobleStatus : "Active"
  };
}

function normalizeEnergeticOrientation(value) {
  if (energeticOrientations.includes(value)) return value;
  if (value === "Expansive" || value === "Draining") return "Unclear";
  return "";
}

function contactSignature(contact) {
  return normalizeContact(contact).name.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueIncomingContacts(contacts) {
  const existing = new Set(state.contacts.map(contactSignature));
  const seen = new Set();
  return contacts.map(normalizeContact).filter((contact) => {
    const signature = contactSignature(contact);
    if (existing.has(signature) || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function kingdomContacts() {
  return state.contacts.filter((contact) => contact.censusStatus === "inside" || contact.includedInKingdom === true);
}

function outsideContacts() {
  return state.contacts.filter((contact) => contact.censusStatus === "outside" || contact.includedInKingdom === false);
}

function skippedContacts() {
  return state.contacts.filter((contact) => contact.censusStatus === "skipped");
}

function candidateContacts() {
  return state.contacts.filter((contact) => contact.censusStatus === "candidate");
}

function isMirrorReady() {
  const members = kingdomContacts();
  return members.length > 0 && members.every((contact) => contact.energeticOrientation);
}

function isWitnessReady() {
  const members = kingdomContacts();
  return members.length > 0 && members.every((contact) => contact.relationshipType && contact.energeticOrientation && contact.currentStatus);
}

function isArchitectReady() {
  const members = kingdomContacts();
  return members.length > 0 && members.every((contact) => contact.placement);
}

function isWeek1Complete() {
  return Boolean(state.seals?.mirror) || isMirrorReady();
}

function isWeek2Complete() {
  return Boolean(state.seals?.witness) || (isWeek1Complete() && isWitnessReady());
}

function isWeek3Complete() {
  return Boolean(state.seals?.architect) || (isWeek2Complete() && isArchitectReady());
}

function markSeal(seal) {
  state.seals = { ...defaultSeals(), ...(state.seals || {}), [seal]: true };
  saveState();
}

function setRoute(route, trackHistory = true) {
  if (route === "mirror-complete" && !isMirrorReady() && !state.seals?.mirror) route = "census";
  if (route === "witness-complete" && !isWitnessReady() && !state.seals?.witness) route = "foundation";
  if (route === "architect-complete" && !isArchitectReady() && !state.seals?.architect) route = "architect";
  if (route === "person-profile" && !activeProfileId) route = "architect";
  if (route === "foundation" && !isWeek1Complete()) route = "census";
  if (route === "architect" && !isWeek2Complete()) route = "foundation";
  if (route === "mechanic" && !isWeek3Complete()) route = "architect";
  if (route === "mirror-complete" && isMirrorReady()) markSeal("mirror");
  if (route === "witness-complete" && isWitnessReady()) markSeal("witness");
  if (route === "architect-complete" && isArchitectReady()) markSeal("architect");
  if (trackHistory && route !== currentRoute) {
    routeHistory.push(currentRoute);
  }
  currentRoute = route;
  views.forEach((view) => view.classList.toggle("active", view.id === route));
  const mapLab = document.querySelector("#map-lab");
  if (mapLab && route === "map-lab") resetMapTransition();
  if (mapLab && route !== "map-lab") clearMapTransitionTimer();
  renderTopBack();
  if (route === "census") renderCensusCard();
  if (route === "person-profile") renderProfile();
}

function clearMapTransitionTimer() {
  if (!mapTransitionTimer) return;
  window.clearTimeout(mapTransitionTimer);
  mapTransitionTimer = null;
}

function resetMapTransition() {
  const mapLab = document.querySelector("#map-lab");
  const video = document.querySelector("[data-map-transition-video]");
  if (!mapLab || !video) return;

  clearMapTransitionTimer();
  mapLab.classList.remove("map-revealed", "map-transition-complete");

  video.pause();
  video.currentTime = 0;
  video.playbackRate = MAP_TRANSITION_PLAYBACK_RATE;
  video.onended = () => {
    mapLab.classList.add("map-transition-complete");
  };

  window.requestAnimationFrame(() => {
    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        mapLab.classList.add("map-transition-complete");
      });
    }
  });
}

function revealMapView() {
  clearMapTransitionTimer();
  document.querySelector("#map-lab")?.classList.add("map-revealed");
}

function goBack() {
  const fallback = currentRoute === "welcome" ? "welcome" : "welcome";
  const previousRoute = routeHistory.pop() || fallback;
  setRoute(previousRoute, false);
}

function renderTopBack() {
  const button = document.querySelector("#top-back");
  if (!button) return;
  button.hidden = currentRoute === "welcome";
}

function displayName(contact) {
  return nameMode === "cast" && contact.castName ? contact.castName : contact.name;
}

function miniSphere(contact) {
  return `
    <img class="relationship-symbol mini-seal" src="${placementSealFor(contact)}" alt="" aria-hidden="true" />
  `;
}

function placementSealFor(contact) {
  if (contact?.placement === "Knights" && contact?.knightStatus === "Rising") return "./assets/seal-knight-rising.png";
  if (contact?.placement === "Nobles" && contact?.nobleStatus === "Legacy") return "./assets/seal-noble-legacy.png";
  return placementSealAssets[contact?.placement || ""] || placementSealAssets[""];
}

function placementSealMarkup(contact, className = "mini-seal") {
  return `<img class="relationship-symbol ${className}" src="${placementSealFor(contact)}" alt="" aria-hidden="true" />`;
}

function renderProgress() {
  const data = [
    ["Week 1", "Mirror Lens", isWeek1Complete() ? "Complete" : "Build the first map"],
    ["Week 2", "Witness Lens", isWeek2Complete() ? "Complete" : isWeek1Complete() ? "Ready" : "Locked until Mirror Lens is complete"],
    ["Week 3", "Architect Lens", isWeek3Complete() ? "Complete" : isWeek2Complete() ? "Ready" : "Locked until Witness Lens is complete"],
    ["Week 4", "The Mechanic", "Locked"],
    ["Week 5", "Oracle", "Locked"],
    ["Week 6", "Sovereignty", "Locked"]
  ];

  const progress = document.querySelector("#week-progress");
  if (progress) {
    progress.innerHTML = data
      .map(([week, title, status]) => `
        <article class="progress-card">
          <strong>${week}</strong>
          <span>${title}</span>
          <span>${status}</span>
        </article>
      `)
      .join("");
  }

  setStatus("#week-1-status", weekStatusText(1), isWeek1Complete());
  setStatus("#week-2-status", isWeek2Complete() ? "Witness Lens complete" : isWeek1Complete() ? "Ready" : "Locked", isWeek2Complete(), !isWeek1Complete());
  setStatus("#week-3-status", isWeek3Complete() ? "Kingdom Structure complete" : isWeek2Complete() ? "Ready" : "Locked", isWeek3Complete(), !isWeek2Complete());
  setStatus("#week-4-status", isWeek3Complete() ? "Ready" : "Locked", false, !isWeek3Complete());
  renderTopBack();
}

function weekStatusText(week) {
  if (week === 1) {
    const members = kingdomContacts();
    if (!members.length) return "Not started";
    if (isWeek1Complete()) return "Saved Mirror Lens complete";
    return `${members.length} saved locally`;
  }
  return "";
}

function setStatus(selector, text, complete, locked = false) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("complete", complete);
  element.classList.toggle("locked", locked);
}

function renderCensusCard() {
  if (!censusCard) return;
  const [contact] = candidateContacts();
  activeCensusId = contact ? contact.id : null;
  const selected = candidateContacts().length;
  const refined = kingdomContacts().length + skippedContacts().length;
  document.querySelector("#census-count").textContent = selected ? `${selected} selected` : "0 selected";
  document.querySelector("[data-census-back]").disabled = !state.censusHistory.length;
  document.querySelector("#refine-guidance").textContent = getRefineGuidance(selected, refined);

  if (!contact) {
    censusCard.classList.remove("drag-left", "drag-right", "drag-skip");
    censusCard.innerHTML = `
      <div>
        <div class="sphere-avatar">HM</div>
        <h3>${getEmptyCensusTitle(selected, refined)}</h3>
        <p>${getEmptyCensusMessage(selected, refined)}</p>
      </div>
    `;
    return;
  }

  censusCard.classList.remove("drag-left", "drag-right", "drag-skip");
  censusCard.style.transform = "";
  censusCard.style.opacity = "";
  censusCard.innerHTML = `
    <div>
      <div class="sphere-avatar">${escapeHtml(initials(contact.name))}</div>
      <p class="eyebrow">Selected for review</p>
      <h3>${escapeHtml(contact.name)}</h3>
      <p>Only keep them In if they are active in your life now, or significant to your past, good or bad.</p>
    </div>
    <span class="skip-cue">Skip</span>
  `;
}

function getRefineGuidance(selected, refined) {
  if (!state.contacts.length) return "Add the first people who come to mind. Use the phone list only if you need help remembering.";
  if (selected > 0) {
    return "Congratulations, first scan completed. Now we refine: keep only people who are active now, or significant to your past.";
  }
  if (refined > 0) {
    return "Refinement pass complete for now. You can select more names from the list if anyone else carries significance.";
  }
  return "If you imported a phone list, scan it lightly and tap only the names that carry charge. Everyone else stays Out for now.";
}

function getEmptyCensusTitle(selected, refined) {
  if (!state.contacts.length) return "Add contacts";
  if (selected > 0) return "Ready to refine";
  if (refined > 0) return "Refinement clear";
  return "First scan";
}

function getEmptyCensusMessage(selected, refined) {
  if (!state.contacts.length) return "Start with the obvious names. This map is allowed to be incomplete.";
  if (selected > 0) return "Your selected names will appear here one by one.";
  if (refined > 0) return "You can select more significant names from the list, or continue when the population feels true enough.";
  return "Tap significant names below if they emerge. Irrelevant contacts are left Out for this MVP.";
}

function decideCensus(decision) {
  const contact = state.contacts.find((item) => item.id === activeCensusId);
  if (!contact) return;
  const status = decision === "skip" ? "skipped" : decision;
  state.censusHistory.push(contact.id);
  contact.censusStatus = status;
  contact.includedInKingdom = status === "inside" ? true : status === "outside" ? false : null;
  if (status !== "inside") {
    contact.relationshipType = "";
    contact.energeticOrientation = "";
    contact.castName = "";
    contact.currentStatus = "";
    contact.placement = "";
  }
  saveState();
  animateCensus(status === "inside" ? "right" : status === "outside" ? "left" : "skip");
}

function animateCensus(direction) {
  const transform = {
    right: "translateX(110%) rotate(8deg)",
    left: "translateX(-110%) rotate(-8deg)",
    skip: "translateY(55%) scale(0.96)"
  };
  censusCard.style.transform = transform[direction] || transform.right;
  censusCard.style.opacity = "0";
  window.setTimeout(renderAll, 180);
}

function undoLastCensusDecision() {
  while (state.censusHistory.length) {
    const contactId = state.censusHistory.pop();
    const contact = state.contacts.find((item) => item.id === contactId);
    if (!contact) continue;
    contact.censusStatus = "candidate";
    contact.includedInKingdom = null;
    contact.relationshipType = "";
    contact.energeticOrientation = "";
    contact.castName = "";
    contact.currentStatus = "";
    contact.placement = "";
    saveAndRender();
    setRoute("census");
    return;
  }
  saveAndRender();
}

function renderPopulation() {
  const total = state.contacts.length;
  const inside = kingdomContacts().length;
  const outside = outsideContacts().length;
  const skipped = skippedContacts().length;
  const selected = candidateContacts().length;
  document.querySelector("#population-summary").textContent = total
    ? `${inside} in the map. ${outside} outside for now. ${selected} waiting. ${skipped} skipped.`
    : "No imported contacts yet.";

  document.querySelector("#memory-bank-panel").style.display = total > inside ? "block" : "none";

  document.querySelector("#population-list").innerHTML = total
    ? state.contacts.filter((contact) => contact.censusStatus !== "inside" && contact.includedInKingdom !== true).map((contact) => `
      <article class="person-row ${contact.censusStatus === "candidate" ? "selected" : ""}" data-toggle-candidate="${contact.id}">
        ${miniSphere(contact)}
        <div class="person-main">
          <strong>${escapeHtml(contact.name)}</strong>
          <span>${censusLabel(contact)}</span>
        </div>
        <div class="row-actions">
          <button type="button" data-add-to-map="${contact.id}">Add to Map</button>
          <button type="button" data-delete="${contact.id}">Delete</button>
        </div>
      </article>
    `).join("") || `<div class="empty-state">No background names waiting. Your active map is above.</div>`
    : `<div class="empty-state">Import contacts only if you want a memory aid.</div>`;
}

function censusLabel(contact) {
  if (contact.censusStatus === "inside" || contact.includedInKingdom === true) return "In";
  if (contact.censusStatus === "outside" || contact.includedInKingdom === false) return "Out";
  if (contact.censusStatus === "candidate") return "Waiting";
  if (contact.censusStatus === "skipped") return "Skipped";
  return "Out";
}

function renderMirrorOverview() {
  const members = kingdomContacts();
  const remaining = members.filter((contact) => !contact.energeticOrientation).length;
  const mirrorPanel = document.querySelector("#mirror-stage-panel");
  const beginSignalsButton = document.querySelector("[data-begin-signals]");
  const shouldShowSignals = mirrorSignalStage || members.some((contact) => contact.energeticOrientation) || isWeek1Complete();
  if (mirrorPanel) mirrorPanel.hidden = !shouldShowSignals;
  if (beginSignalsButton) {
    beginSignalsButton.disabled = !members.length;
    beginSignalsButton.textContent = shouldShowSignals ? "Mirror Signals Open" : "Continue to Mirror Signals";
  }
  document.querySelector("#mirror-count").textContent = `${members.length} mapped`;
  const overview = document.querySelector("#mirror-overview");
  overview.innerHTML = members.length
    ? `
      <div class="overview-header mirror-header">
        <span>Name</span>
        <span>Energetic Orientation</span>
        <span></span>
      </div>
      ${members.map((contact) => `
        <article class="overview-row mirror-row">
          <div class="overview-name">
            ${miniSphere(contact)}
            <strong>${escapeHtml(contact.name)}</strong>
          </div>
          <div class="pill-group" role="group" aria-label="Energetic orientation for ${escapeAttribute(contact.name)}">
            ${energeticOrientations.map((orientation) => `
              <button type="button" class="tag-pill ${contact.energeticOrientation === orientation ? "active" : ""}" data-contact-field="${contact.id}" data-field="energeticOrientation" data-value="${orientation}">
                ${orientation}
              </button>
            `).join("")}
          </div>
          <button type="button" class="text-button" data-remove-from-map="${contact.id}">Move out</button>
        </article>
      `).join("")}
    `
    : `<div class="empty-state">Add the first person above. The Mirror Lens will appear here.</div>`;

  document.querySelector("#mirror-completion").innerHTML = renderMirrorCompletion(members.length, remaining);
}

function renderMirrorCompletion(total, remaining) {
  if (!total) {
    return `
      <p>Add your first people, then mark the energetic orientation for each one.</p>
      <button class="primary-action" type="button" disabled>Complete Week 1</button>
    `;
  }

  if (remaining) {
    return `
      <p>${remaining} ${remaining === 1 ? "person still needs" : "people still need"} an energetic orientation before Week 2 opens.</p>
      <button class="primary-action" type="button" disabled>Complete Week 1</button>
    `;
  }

  return `
    <p>Mirror Lens complete. You have named the first emotional signal for ${total} ${total === 1 ? "person" : "people"}.</p>
    <button class="primary-action" type="button" data-route="mirror-complete">Complete Week 1</button>
  `;
}

function renderMirrorComplete() {
  const total = kingdomContacts().length;
  const summary = document.querySelector("#mirror-complete-summary");
  if (!summary) return;
  summary.textContent = `You have named the first emotional signal for ${total} ${total === 1 ? "person" : "people"}.`;
}

function renderFoundation() {
  const gate = document.querySelector("#foundation-gate");
  const list = document.querySelector("#foundation-list");
  gate.classList.toggle("active", !isWeek1Complete());
  gate.textContent = "Week 2 unlocks after every mapped person has an energetic orientation in the Mirror Lens.";

  document.querySelectorAll("[data-name-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nameMode === nameMode);
  });

  const members = kingdomContacts();
  if (!isWeek1Complete()) {
    document.querySelector(".witness-overview-panel").style.display = "none";
    document.querySelector("#witness-completion").innerHTML = "";
    list.innerHTML = "";
    return;
  }
  document.querySelector(".witness-overview-panel").style.display = "block";
  renderWitnessOverview();

  list.innerHTML = "";
}

function renderWitnessOverview() {
  const members = kingdomContacts();
  const remaining = members.filter((contact) => !contact.relationshipType || !contact.energeticOrientation || !contact.currentStatus).length;
  document.querySelector("#witness-count").textContent = `${members.length} people`;
  document.querySelector("#witness-overview").innerHTML = members.length
    ? `
      <div class="overview-header witness-header">
        <span class="sticky-name-cell">Real Name</span>
        <span>Private Cast Name</span>
        <span>Relationship</span>
        <span>Energy</span>
        <span>Current Status</span>
      </div>
      ${members.map((contact) => `
        <article class="overview-row witness-row">
          <div class="overview-name sticky-name-cell">
            ${miniSphere(contact)}
            <strong>${escapeHtml(contact.name)}</strong>
          </div>
          <input data-foundation="${contact.id}" data-field="castName" value="${escapeAttribute(contact.castName)}" placeholder="Athena" />
          <select data-foundation="${contact.id}" data-field="relationshipType">
            <option value="">Choose</option>
            ${relationshipTypes.map((type) => `<option value="${type}" ${contact.relationshipType === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
          <select data-foundation="${contact.id}" data-field="energeticOrientation">
            <option value="">Choose</option>
            ${energeticOrientations.map((type) => `<option value="${type}" ${contact.energeticOrientation === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
          <div class="pill-group status-group">
            ${currentStatuses.map((status) => `
              <button type="button" class="tag-pill ${contact.currentStatus === status ? "active" : ""}" data-contact-field="${contact.id}" data-field="currentStatus" data-value="${status}">
                ${status}
              </button>
            `).join("")}
          </div>
        </article>
      `).join("")}
    `
    : `<div class="empty-state">No people mapped yet.</div>`;

  document.querySelector("#witness-completion").innerHTML = renderWitnessCompletion(members.length, remaining);
}

function renderWitnessCompletion(total, remaining) {
  if (!total) {
    return `
      <p>Add people to the map before completing the Witness Lens.</p>
      <button class="primary-action" type="button" disabled>Complete Week 2</button>
    `;
  }

  if (remaining) {
    return `
      <p>${remaining} ${remaining === 1 ? "person still needs" : "people still need"} energy, relationship type and current status before Week 3 opens.</p>
      <button class="primary-action" type="button" disabled>Complete Week 2</button>
    `;
  }

  return `
    <p>Witness Lens complete. You have named the relational context for ${total} ${total === 1 ? "person" : "people"}.</p>
    <button class="primary-action" type="button" data-route="witness-complete">Complete Week 2</button>
  `;
}

function renderWitnessComplete() {
  const total = kingdomContacts().length;
  const summary = document.querySelector("#witness-complete-summary");
  if (!summary) return;
  summary.textContent = `You have named the relational context for ${total} ${total === 1 ? "person" : "people"}.`;
}

function renderArchitect() {
  const gate = document.querySelector("#architect-gate");
  const workspace = document.querySelector("#architect-workspace");
  const members = kingdomContacts();
  gate.classList.toggle("active", !isWeek2Complete());
  gate.textContent = "Week 3 unlocks after every Kingdom member has a relationship type, energetic orientation and current status.";
  workspace.style.display = isWeek2Complete() ? "grid" : "none";

  if (!isWeek2Complete()) {
    document.querySelector("#architect-completion").innerHTML = "";
    return;
  }

  const unplaced = members.filter((contact) => !contact.placement || !architectPlacements.includes(contact.placement));
  document.querySelector("#structure-progress").textContent = `${members.length - unplaced.length} placed`;
  document.querySelector("#placement-guidance").textContent = selectedSphereId
    ? "Now tap a placement column, or drag the selected person into place."
    : "Drag a person into a column. Use Open to edit their identity, energy, relationship, status or placement without going back to Week 2.";
  const columns = ["Unplaced", ...architectPlacements];
  document.querySelector("#placement-columns").innerHTML = columns.map((placement) => {
    const people = placement === "Unplaced" ? unplaced : sortPlacementPeople(members.filter((contact) => contact.placement === placement), placement);
    const placementValue = placement === "Unplaced" ? "" : placement;
    return `
      <section class="placement-column ${placementValue ? "" : "unplaced-column"}" data-placement="${placementValue}">
        <header>
          <div>
            <h3>${placement}</h3>
            <p>${escapeHtml(placementDescriptions[placementValue] || "")}</p>
          </div>
          <span>${people.length}</span>
        </header>
        <div class="placement-card-list">
          ${people.map((contact) => placementCardMarkup(contact)).join("") || `<div class="empty-state">No one here yet.</div>`}
        </div>
      </section>
    `;
  }).join("");

  document.querySelector("#architect-completion").innerHTML = renderArchitectCompletion(members.length, unplaced.length);
}

function renderArchitectCompletion(total, remaining) {
  if (!total) {
    return `
      <p>Add people to the map before completing the Architect Lens.</p>
      <button class="primary-action" type="button" disabled>Complete Week 3</button>
    `;
  }

  if (remaining) {
    return `
      <p>${remaining} ${remaining === 1 ? "person still needs" : "people still need"} a placement before your first Kingdom Map is sealed.</p>
      <button class="primary-action" type="button" disabled>Complete Week 3</button>
    `;
  }

  return `
    <p>Architect Lens complete. You have placed ${total} ${total === 1 ? "person" : "people"} into your first Kingdom Map.</p>
    <button class="primary-action" type="button" data-route="architect-complete">Complete Week 3</button>
  `;
}

function renderArchitectComplete() {
  const total = kingdomContacts().length;
  const summary = document.querySelector("#architect-complete-summary");
  if (!summary) return;
  summary.textContent = `You now have your first Kingdom Map with ${total} ${total === 1 ? "person" : "people"} placed inside the structure.`;
}

function placementCardMarkup(contact, options = {}) {
  const showOpen = options.showOpen !== false;
  const selected = selectedSphereId === contact.id ? "selected" : "";
  const premium = options.premium ? "premium-placement-person" : "";
  const sealClass = options.premium ? "premium-placement-seal" : "placement-seal";
  const secondary = [
    contact.relationshipType,
    contact.energeticOrientation,
    contact.currentStatus,
    contact.castName ? `Cast: ${contact.castName}` : ""
  ].filter(Boolean).join(" · ");
  return `
    <article class="placement-person ${premium} ${selected} ${contact.placement === "Nobles" && contact.nobleStatus === "Legacy" ? "noble-legacy-card" : ""} ${contact.placement === "Noble Fading" ? "noble-fading-card" : ""} ${contact.placement === "Knights" && contact.knightStatus === "Rising" ? "knight-rising-card" : ""}" data-contact="${contact.id}" draggable="true">
      ${placementSealMarkup(contact, sealClass)}
      <div class="person-main">
        <strong>${escapeHtml(displayName(contact))}</strong>
        <span>${escapeHtml(secondary || "No details added")}</span>
      </div>
      ${showOpen ? `<button class="placement-open-btn" type="button" data-open-profile="${contact.id}">Open</button>` : ""}
    </article>
  `;
}

function renderProfile() {
  const shell = document.querySelector("#profile-shell");
  if (!shell) return;

  const contact = state.contacts.find((item) => item.id === activeProfileId);
  const returnRoute = activeProfileReturnRoute === "mechanic" ? "mechanic" : "architect";
  const returnLabel = returnRoute === "mechanic" ? "Back to Mechanic Map" : "Back to Architect Lens";
  const profilePlacements = returnRoute === "mechanic" ? mechanicPlacements : architectPlacements;
  if (!contact) {
    shell.innerHTML = `
      <div class="panel profile-panel">
        <p class="eyebrow">Person profile</p>
        <h2>No profile selected.</h2>
        <button class="secondary-action" data-route="${returnRoute}">${returnLabel}</button>
      </div>
    `;
    return;
  }

  shell.innerHTML = `
    <div class="profile-hero panel">
      <div>
        <p class="eyebrow">Person profile</p>
        <h2 id="profile-title">${escapeHtml(displayName(contact))}</h2>
        <p>Edit the details for this person without leaving the architecture of the map.</p>
      </div>
      ${placementSealMarkup(contact, "profile-placement-seal")}
    </div>

    <div class="profile-grid">
      <div class="panel profile-panel">
        <div class="panel-title">
          <h3>Identity</h3>
          <p>Use the real name for clarity and the cast name for session conversation.</p>
        </div>
        <label>
          <span>Real Name</span>
          <input data-profile="${contact.id}" data-field="name" value="${escapeAttribute(contact.name)}" />
        </label>
        <label>
          <span>Private Cast Name</span>
          <input data-profile="${contact.id}" data-field="castName" value="${escapeAttribute(contact.castName)}" placeholder="Athena" />
        </label>
      </div>

      <div class="panel profile-panel">
        <div class="panel-title">
          <h3>Witness Details</h3>
          <p>The current relational context from Week 2.</p>
        </div>
        <label>
          <span>Relationship</span>
          <select data-profile="${contact.id}" data-field="relationshipType">
            <option value="">Choose</option>
            ${relationshipTypes.map((type) => `<option value="${type}" ${contact.relationshipType === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Energetic Orientation</span>
          <select data-profile="${contact.id}" data-field="energeticOrientation">
            <option value="">Choose</option>
            ${energeticOrientations.map((type) => `<option value="${type}" ${contact.energeticOrientation === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Current Status</span>
          <select data-profile="${contact.id}" data-field="currentStatus">
            <option value="">Choose</option>
            ${currentStatuses.map((status) => `<option value="${status}" ${contact.currentStatus === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
      </div>

      <div class="panel profile-panel">
        <div class="panel-title">
          <h3>Architect Placement</h3>
          <p>Move them without dragging if a placement becomes clear here.</p>
        </div>
        <label>
          <span>Placement</span>
          <select data-profile="${contact.id}" data-field="placement">
            <option value="">Unplaced</option>
            ${profilePlacements.map((placement) => `<option value="${placement}" ${contact.placement === placement ? "selected" : ""}>${placement}</option>`).join("")}
          </select>
        </label>
        ${contact.placement === "Knights" ? `
          <label>
            <span>Knight Status</span>
            <select data-profile="${contact.id}" data-field="knightStatus">
              ${knightStatuses.map((status) => `<option value="${status}" ${contact.knightStatus === status ? "selected" : ""}>Knight ${status}</option>`).join("")}
            </select>
          </label>
        ` : ""}
        ${returnRoute === "mechanic" && contact.placement === "Nobles" ? `
          <label>
            <span>Noble Status</span>
            <select data-profile="${contact.id}" data-field="nobleStatus">
              ${nobleStatuses.map((status) => `<option value="${status}" ${contact.nobleStatus === status ? "selected" : ""}>Noble ${status}</option>`).join("")}
            </select>
          </label>
        ` : ""}
      </div>
    </div>

    <div class="week-actions profile-actions">
      <button class="secondary-action" data-route="${returnRoute}">${returnLabel}</button>
      <button class="text-button" type="button" data-delete-profile="${contact.id}">Delete Person</button>
    </div>
  `;
}

function sortPlacementPeople(people, placement) {
  return [...people].sort((first, second) => displayName(first).localeCompare(displayName(second)));
}

function placementClassName(placement) {
  return (placement || "unplaced").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderMechanic() {
  const gate = document.querySelector("#mechanic-gate");
  const workspace = document.querySelector("#mechanic-workspace");
  if (!gate || !workspace) return;

  gate.classList.toggle("active", !isWeek3Complete());
  gate.textContent = "Week 4 opens after your first Kingdom Map is complete.";
  workspace.style.display = isWeek3Complete() ? "block" : "none";

  if (!isWeek3Complete()) return;

  const members = kingdomContacts();
  const unplaced = members.filter((contact) => !contact.placement);
  const placed = members.length - unplaced.length;
  document.querySelector("#mechanic-count").textContent = `${placed} placed`;

  const columns = ["Unplaced", ...mechanicPlacements];
  document.querySelector("#mechanic-columns").innerHTML = columns.map((placement, index) => {
    const people = placement === "Unplaced" ? unplaced : sortPlacementPeople(members.filter((contact) => contact.placement === placement), placement);
    const placementValue = placement === "Unplaced" ? "" : placement;
    return `
      <section class="placement-column mechanic-column mechanic-zone-${placementClassName(placementValue)} ${placementValue ? "" : "unplaced-column"}" data-placement="${placementValue}">
        <header>
          <div>
            <span class="column-index">${String(index + 1).padStart(2, "0")}</span>
            <h3>${placement}</h3>
            <p>${escapeHtml(placementDescriptions[placementValue] || "")}</p>
          </div>
          <span class="column-count">${people.length}</span>
        </header>
        <div class="placement-card-list">
          ${people.map((contact) => placementCardMarkup(contact, { premium: true })).join("") || `<div class="empty-state">No one here yet.</div>`}
        </div>
      </section>
    `;
  }).join("");
}

function renderImportPreview() {
  const count = pendingImport.length;
  document.querySelector("#import-preview-title").textContent = `${count} contact${count === 1 ? "" : "s"} detected`;
  document.querySelector("#import-preview-subtitle").textContent = count
    ? "Use this as a memory aid. These names stay Out unless you tap them later."
    : "No new names were found. They may already be in your map, or the file may not contain readable names.";
  document.querySelector("[data-confirm-import]").disabled = count === 0;
  document.querySelector("#import-preview-list").innerHTML = count
    ? pendingImport.map((contact) => `
          <article class="preview-contact">
            ${miniSphere(contact)}
            <div class="person-main">
              <strong>${escapeHtml(contact.name)}</strong>
              <span>Added as background memory aid</span>
            </div>
          </article>
    `).join("")
    : `<div class="empty-state">No new contacts to import.</div>`;
}

function parseAirtablePaste(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line, index) => {
      const cells = line.includes("\t") ? line.split("\t") : line.split(",");
      const firstCell = (cells[0] || "").trim().replace(/^"|"$/g, "");
      if (index === 0 && /^(name|full name|person|contact)$/i.test(firstCell)) return null;
      return normalizeContact({ name: firstCell || "Unnamed Contact", censusStatus: "outside" });
    })
    .filter(Boolean);
}

function renderAll() {
  renderProgress();
  renderLastSaved();
  renderCensusCard();
  renderMirrorOverview();
  renderMirrorComplete();
  renderPopulation();
  renderFoundation();
  renderWitnessComplete();
  renderArchitect();
  renderArchitectComplete();
  renderMechanic();
  renderProfile();
}

function addManualContact(name) {
  const incoming = uniqueIncomingContacts([{ name, censusStatus: "inside", includedInKingdom: true }]);
  if (!incoming.length) return;
  state.contacts.push(...incoming);
  saveAndRender();
}

function addArchitectContact(name) {
  const incoming = uniqueIncomingContacts([{
    name,
    censusStatus: "inside",
    includedInKingdom: true,
    relationshipType: "Other",
    energeticOrientation: "Unclear",
    currentStatus: "Active"
  }]);
  if (!incoming.length) return;
  state.contacts.push(...incoming);
  saveAndRender();
}

function loadSamples() {
  const incoming = uniqueIncomingContacts(sampleNames.map((name) => ({ name, censusStatus: "inside", includedInKingdom: true })));
  state.contacts.push(...incoming);
  saveAndRender();
  setRoute("census");
}

function parseContactFile(fileName, text) {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".vcf") || /BEGIN:VCARD/i.test(text)) return parseVcf(text);
  return parseCsv(text);
}

function parseCsv(text) {
  const rows = parseCsvRows(text).filter((row) => row.some(Boolean));
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const nameIndexes = ["name", "full name", "fullname", "first name", "firstname", "last name", "lastname"];
  return rows.slice(1).map((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
    const name = record.name || record.fullname || record["full name"] || [record.firstname || record["first name"], record.lastname || record["last name"]].filter(Boolean).join(" ");
    const fallback = row[headers.findIndex((header) => nameIndexes.includes(header))] || row[0] || "Unnamed Contact";
    return normalizeContact({ name: name || fallback || "Unnamed Contact", censusStatus: "outside" });
  });
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  rows.push(row);
  return rows;
}

function parseVcf(text) {
  return text
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .split(/BEGIN:VCARD/i)
    .slice(1)
    .map((chunk) => chunk.split(/END:VCARD/i)[0])
    .map(parseVcardBlock)
    .filter(Boolean);
}

function parseVcardBlock(block) {
  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const fullName = vcardValue(lines, "FN");
  const nameParts = parseStructuredName(vcardValue(lines, "N"));
  return normalizeContact({
    name: fullName || [nameParts.firstName, nameParts.lastName].filter(Boolean).join(" ") || "Unnamed Contact",
    censusStatus: "outside"
  });
}

function vcardValue(lines, propertyName) {
  const prefix = propertyName.toUpperCase();
  const line = lines.find((item) => item.toUpperCase().startsWith(`${prefix}:`) || item.toUpperCase().startsWith(`${prefix};`));
  if (!line) return "";
  const separatorIndex = line.indexOf(":");
  if (separatorIndex === -1) return "";
  const rawValue = line.slice(separatorIndex + 1);
  const value = /ENCODING=QUOTED-PRINTABLE/i.test(line) ? decodeQuotedPrintable(rawValue) : rawValue;
  return decodeVcardText(value);
}

function parseStructuredName(value) {
  const [lastName = "", firstName = ""] = value.split(";").map(decodeVcardText);
  return { firstName, lastName };
}

function decodeVcardText(value = "") {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function decodeQuotedPrintable(value = "") {
  try {
    const bytes = value
      .replace(/=\r?\n/g, "")
      .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return decodeURIComponent(bytes.split("").map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
  } catch (error) {
    return value.replace(/=\r?\n/g, "");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => setRoute(button.dataset.route));
});

document.querySelectorAll("[data-load-samples]").forEach((button) => {
  button.addEventListener("click", loadSamples);
});

document.querySelector("#top-back").addEventListener("click", goBack);
document.querySelectorAll("[data-export-progress]").forEach((button) => {
  button.addEventListener("click", exportProgress);
});
document.querySelector("#restore-backup-input").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  await restoreProgress(file);
  event.target.value = "";
});

manualForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#manual-name");
  addManualContact(input.value);
  input.value = "";
});

foundationAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#foundation-add-name");
  if (!input.value.trim()) return;
  addManualContact(input.value);
  input.value = "";
});

architectAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#architect-add-name");
  if (!input.value.trim()) return;
  addArchitectContact(input.value);
  input.value = "";
});

document.querySelector("#contact-file-input").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const text = await file.text();
  pendingImport = uniqueIncomingContacts(parseContactFile(file.name, text));
  event.target.value = "";
  renderImportPreview();
  importPreviewDialog.showModal();
});

document.querySelector("[data-preview-paste]").addEventListener("click", () => {
  const pasteInput = document.querySelector("#airtable-paste");
  pendingImport = uniqueIncomingContacts(parseAirtablePaste(pasteInput.value));
  renderImportPreview();
  importPreviewDialog.showModal();
});

document.querySelector("[data-confirm-import]").addEventListener("click", () => {
  state.contacts.push(...pendingImport);
  document.querySelector("#airtable-paste").value = "";
  pendingImport = [];
  importPreviewDialog.close();
  saveAndRender();
  setRoute(isWeek1Complete() ? currentRoute : "census", false);
});

document.querySelector("[data-cancel-import]").addEventListener("click", () => {
  pendingImport = [];
  importPreviewDialog.close();
});

document.querySelectorAll("[data-reset]").forEach((button) => {
  button.addEventListener("click", () => {
    const confirmed = window.confirm("Reset this map and clear the saved session on this browser?");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { contacts: [], censusHistory: [], lastSavedAt: "", seals: defaultSeals() };
    routeHistory = [];
    mirrorSignalStage = false;
    saveAndRender();
    setRoute("census");
  });
});

document.addEventListener("click", (event) => {
  const beginSignals = event.target.closest("[data-begin-signals]");
  if (beginSignals) {
    mirrorSignalStage = true;
    renderMirrorOverview();
    document.querySelector("#mirror-stage-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const revealMap = event.target.closest("[data-reveal-map]");
  if (revealMap) {
    revealMapView();
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    setRoute(routeButton.dataset.route);
    return;
  }

  const openProfile = event.target.closest("[data-open-profile]");
  if (openProfile) {
    activeProfileId = openProfile.dataset.openProfile;
    activeProfileReturnRoute = currentRoute === "mechanic" ? "mechanic" : "architect";
    setRoute("person-profile");
    return;
  }

  const deleteProfile = event.target.closest("[data-delete-profile]");
  if (deleteProfile) {
    state.contacts = state.contacts.filter((contact) => contact.id !== deleteProfile.dataset.deleteProfile);
    state.censusHistory = state.censusHistory.filter((id) => id !== deleteProfile.dataset.deleteProfile);
    activeProfileId = null;
    saveAndRender();
    setRoute(activeProfileReturnRoute === "mechanic" ? "mechanic" : "architect");
    return;
  }

  const decision = event.target.closest("[data-census-decision]");
  if (decision) decideCensus(decision.dataset.censusDecision);

  const back = event.target.closest("[data-census-back]");
  if (back) undoLastCensusDecision();

  const contactField = event.target.closest("[data-contact-field]");
  if (contactField) {
    const contact = state.contacts.find((item) => item.id === contactField.dataset.contactField);
    if (contact) {
      contact[contactField.dataset.field] = contactField.dataset.value;
      saveAndRender();
    }
    return;
  }

  const addToMap = event.target.closest("[data-add-to-map]");
  if (addToMap) {
    const contact = state.contacts.find((item) => item.id === addToMap.dataset.addToMap);
    if (contact) {
      contact.censusStatus = "inside";
      contact.includedInKingdom = true;
      saveAndRender();
    }
    return;
  }

  const removeFromMap = event.target.closest("[data-remove-from-map]");
  if (removeFromMap) {
    const contact = state.contacts.find((item) => item.id === removeFromMap.dataset.removeFromMap);
    if (contact) {
      contact.censusStatus = "outside";
      contact.includedInKingdom = false;
      contact.relationshipType = "";
      contact.energeticOrientation = "";
      contact.castName = "";
      contact.currentStatus = "";
      contact.placement = "";
      saveAndRender();
    }
    return;
  }

  const remove = event.target.closest("[data-delete]");
  if (remove) {
    state.contacts = state.contacts.filter((contact) => contact.id !== remove.dataset.delete);
    state.censusHistory = state.censusHistory.filter((id) => id !== remove.dataset.delete);
    saveAndRender();
    return;
  }

  const toggleCandidate = event.target.closest("[data-toggle-candidate]");
  if (toggleCandidate) {
    const contact = state.contacts.find((item) => item.id === toggleCandidate.dataset.toggleCandidate);
    if (contact) {
      const nextStatus = contact.censusStatus === "candidate" ? "outside" : "candidate";
      contact.censusStatus = nextStatus;
      contact.includedInKingdom = null;
      if (nextStatus !== "candidate") {
        contact.relationshipType = "";
        contact.energeticOrientation = "";
        contact.castName = "";
        contact.currentStatus = "";
        contact.placement = "";
      }
      saveAndRender();
    }
  }

  const nameToggle = event.target.closest("[data-name-mode]");
  if (nameToggle) {
    nameMode = nameToggle.dataset.nameMode;
    renderAll();
  }

  const placementPerson = event.target.closest(".placement-person");
  if (placementPerson) {
    if (event.target.closest("[data-open-profile]")) return;
    selectedSphereId = selectedSphereId === placementPerson.dataset.contact ? null : placementPerson.dataset.contact;
    if (currentRoute === "mechanic") renderMechanic();
    else renderArchitect();
  }

  const placementColumn = event.target.closest(".placement-column");
  if (placementColumn && selectedSphereId && !placementPerson) {
    const contact = state.contacts.find((item) => item.id === selectedSphereId);
    if (contact) {
      contact.placement = placementColumn.dataset.placement;
      selectedSphereId = null;
      saveAndRender();
    }
  }
});

document.addEventListener("input", (event) => {
  const profileField = event.target.closest("[data-profile]");
  if (profileField) {
    const contact = state.contacts.find((item) => item.id === profileField.dataset.profile);
    if (!contact) return;
    contact[profileField.dataset.field] = profileField.value;
    saveState();
    return;
  }

  const field = event.target.closest("[data-foundation]");
  if (!field) return;
  const contact = state.contacts.find((item) => item.id === field.dataset.foundation);
  if (!contact) return;
  contact[field.dataset.field] = field.value;
  saveState();
});

document.addEventListener("change", (event) => {
  const profileField = event.target.closest("[data-profile]");
  if (profileField) {
    const contact = state.contacts.find((item) => item.id === profileField.dataset.profile);
    if (!contact) return;
    contact[profileField.dataset.field] = profileField.value;
    saveAndRender();
    return;
  }

  const mechanicField = event.target.closest("[data-mechanic]");
  if (mechanicField) {
    const contact = state.contacts.find((item) => item.id === mechanicField.dataset.mechanic);
    if (!contact) return;
    contact[mechanicField.dataset.field] = mechanicField.value;
    saveAndRender();
    return;
  }

  const field = event.target.closest("[data-foundation]");
  if (!field) return;
  const contact = state.contacts.find((item) => item.id === field.dataset.foundation);
  if (!contact) return;
  contact[field.dataset.field] = field.value;
  saveAndRender();
});

if (censusCard) {
  censusCard.addEventListener("pointerdown", (event) => {
    if (!activeCensusId) return;
    censusDrag = { x: event.clientX, y: event.clientY };
    censusCard.setPointerCapture(event.pointerId);
  });

  censusCard.addEventListener("pointermove", (event) => {
    if (!censusDrag) return;
    const dx = event.clientX - censusDrag.x;
    const dy = event.clientY - censusDrag.y;
    censusCard.classList.toggle("drag-right", dx > 42 && Math.abs(dx) > Math.abs(dy));
    censusCard.classList.toggle("drag-left", dx < -42 && Math.abs(dx) > Math.abs(dy));
    censusCard.classList.toggle("drag-skip", Math.abs(dy) > 54 && Math.abs(dy) > Math.abs(dx));
    censusCard.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-8, Math.min(8, dx / 28))}deg)`;
  });

  censusCard.addEventListener("pointerup", (event) => {
    if (!censusDrag) return;
    const dx = event.clientX - censusDrag.x;
    const dy = event.clientY - censusDrag.y;
    censusDrag = null;
    censusCard.classList.remove("drag-left", "drag-right", "drag-skip");
    if (Math.abs(dy) > 82 && Math.abs(dy) > Math.abs(dx)) decideCensus("skip");
    else if (dx > 82) decideCensus("inside");
    else if (dx < -82) decideCensus("outside");
    else censusCard.style.transform = "";
  });
}

document.addEventListener("keydown", (event) => {
  if (!document.querySelector("#census").classList.contains("active")) return;
  if (event.key === "ArrowRight") decideCensus("inside");
  if (event.key === "ArrowLeft") decideCensus("outside");
  if (event.key === "ArrowDown" || event.key === " ") decideCensus("skip");
});

document.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".placement-person");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.contact);
});

document.addEventListener("dragover", (event) => {
  const column = event.target.closest(".placement-column");
  if (!column) return;
  event.preventDefault();
  column.classList.add("drag-over");
});

document.addEventListener("dragleave", (event) => {
  const column = event.target.closest(".placement-column");
  if (column) column.classList.remove("drag-over");
});

document.addEventListener("drop", (event) => {
  const column = event.target.closest(".placement-column");
  if (!column) return;
  event.preventDefault();
  column.classList.remove("drag-over");
  const contact = state.contacts.find((item) => item.id === event.dataTransfer.getData("text/plain"));
  if (!contact) return;
  contact.placement = column.dataset.placement;
  selectedSphereId = null;
  saveAndRender();
});

renderAll();
