const DEFAULT_SETTINGS = {
  urlMatch: "1FAIpQLScESH6cTuLj9Bb9gbMavsPe6Zod-aewo0RU6_3eIDFFMPVwVA",
  autoFill: false,
  answers: {}
};

const els = {
  status: document.querySelector("#status"),
  urlMatch: document.querySelector("#urlMatch"),
  autoFill: document.querySelector("#autoFill"),
  answers: document.querySelector("#answers"),
  detect: document.querySelector("#detect"),
  save: document.querySelector("#save"),
  fill: document.querySelector("#fill")
};

init();

async function init() {
  const settings = await getSettings();
  render(settings);

  els.detect.addEventListener("click", detectQuestions);
  els.save.addEventListener("click", saveSettings);
  els.fill.addEventListener("click", fillForm);
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    answers: stored.answers || {}
  };
}

function render(settings) {
  els.urlMatch.value = settings.urlMatch || "";
  els.autoFill.checked = Boolean(settings.autoFill);
  els.answers.value = JSON.stringify(settings.answers || {}, null, 2);
}

async function saveSettings() {
  try {
    const answers = parseAnswers();
    await chrome.storage.sync.set({
      urlMatch: els.urlMatch.value.trim(),
      autoFill: els.autoFill.checked,
      answers
    });
    setStatus("Saved.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function detectQuestions() {
  const tab = await getActiveTab();
  if (!tab?.id) return setStatus("Open the Google Form tab first.", true);

  const response = await sendMessage(tab.id, { type: "DETECT_QUESTIONS" });
  if (!response?.ok) return setStatus(response?.error || "Could not detect questions.", true);

  const current = safeJson(els.answers.value, {});
  const merged = {};
  for (const question of response.questions) {
    merged[question.title] = current[question.title] ?? "";
  }
  els.answers.value = JSON.stringify(merged, null, 2);
  setStatus(`Detected ${response.questions.length} question(s). Add answers, then Save.`);
}

async function fillForm() {
  try {
    const answers = parseAnswers();
    await chrome.storage.sync.set({
      urlMatch: els.urlMatch.value.trim(),
      autoFill: els.autoFill.checked,
      answers
    });

    const tab = await getActiveTab();
    if (!tab?.id) return setStatus("Open the Google Form tab first.", true);

    const response = await sendMessage(tab.id, {
      type: "FILL_FORM",
      answers
    });

    if (!response?.ok) return setStatus(response?.error || "Could not fill the form.", true);
    setStatus(`Filled ${response.filled} field(s). ${response.missed} answer(s) were not matched.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function parseAnswers() {
  const parsed = safeJson(els.answers.value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Answers JSON must be an object.");
  }
  return parsed;
}

function safeJson(value, fallback = null) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return fallback;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function sendMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.style.borderColor = isError ? "#d93025" : "#d9dee7";
  els.status.style.color = isError ? "#b3261e" : "#46515f";
}
