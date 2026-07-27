const FORM_ID = "1FAIpQLScESH6cTuLj9Bb9gbMavsPe6Zod-aewo0RU6_3eIDFFMPVwVA";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  run(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

bootstrapAutoFill();

async function bootstrapAutoFill() {
  const settings = await chrome.storage.sync.get({
    urlMatch: FORM_ID,
    autoFill: false,
    answers: {}
  });

  if (!settings.autoFill) return;
  if (settings.urlMatch && !location.href.includes(settings.urlMatch)) return;

  await waitForQuestions();
  fillGoogleForm(settings.answers || {});
}

async function run(message) {
  if (message.type === "DETECT_QUESTIONS") {
    await waitForQuestions();
    return { ok: true, questions: getQuestions().map(questionSummary) };
  }

  if (message.type === "FILL_FORM") {
    await waitForQuestions();
    const result = fillGoogleForm(message.answers || {});
    return { ok: true, ...result };
  }

  return { ok: false, error: "Unknown command." };
}

function fillGoogleForm(answers) {
  const questions = getQuestions();
  let filled = 0;
  let missed = 0;

  for (const [answerKey, answerValue] of Object.entries(answers)) {
    if (answerValue === "" || answerValue == null) continue;

    const question = findQuestion(questions, answerKey);
    if (!question) {
      missed += 1;
      continue;
    }

    if (fillQuestion(question, answerValue)) {
      filled += 1;
    } else {
      missed += 1;
    }
  }

  return { filled, missed };
}

function getQuestions() {
  return [...document.querySelectorAll("div[role='listitem']")]
    .map((element) => ({
      element,
      title: getQuestionTitle(element),
      text: normalize(element.innerText)
    }))
    .filter((question) => question.title || question.text);
}

function questionSummary(question) {
  return {
    title: question.title || question.text.slice(0, 80),
    type: getQuestionType(question.element)
  };
}

function getQuestionTitle(questionElement) {
  const titleElement =
    questionElement.querySelector(".M7eMe") ||
    questionElement.querySelector("[role='heading']") ||
    questionElement.querySelector(".HoXoMd");

  return normalize(titleElement?.innerText || "");
}

function findQuestion(questions, answerKey) {
  const normalizedKey = normalize(answerKey);
  return (
    questions.find((question) => normalize(question.title) === normalizedKey) ||
    questions.find((question) => normalize(question.title).includes(normalizedKey)) ||
    questions.find((question) => question.text.includes(normalizedKey))
  );
}

function fillQuestion(question, answerValue) {
  const element = question.element;
  const answers = Array.isArray(answerValue) ? answerValue : [answerValue];

  if (fillText(element, String(answerValue))) return true;
  if (fillRadio(element, String(answerValue))) return true;
  if (fillCheckboxes(element, answers.map(String))) return true;
  if (fillDropdown(element, String(answerValue))) return true;

  return false;
}

function fillText(questionElement, value) {
  const input = questionElement.querySelector("input[type='text'], input[type='email'], input[type='number'], textarea");
  if (!input) return false;

  input.focus();
  setNativeValue(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();
  return true;
}

function fillRadio(questionElement, value) {
  const radios = [...questionElement.querySelectorAll("[role='radio']")];
  if (!radios.length) return false;

  const target = radios.find((radio) => optionMatches(radio, value));
  if (!target) return false;

  target.click();
  return true;
}

function fillCheckboxes(questionElement, values) {
  const checkboxes = [...questionElement.querySelectorAll("[role='checkbox']")];
  if (!checkboxes.length) return false;

  let changed = false;
  for (const value of values) {
    const target = checkboxes.find((checkbox) => optionMatches(checkbox, value));
    if (target && target.getAttribute("aria-checked") !== "true") {
      target.click();
      changed = true;
    }
  }

  return changed;
}

function fillDropdown(questionElement, value) {
  const listbox = questionElement.querySelector("[role='listbox']");
  if (!listbox) return false;

  listbox.click();

  const options = [...document.querySelectorAll("[role='option']")];
  const target = options.find((option) => optionMatches(option, value));
  if (!target) {
    document.body.click();
    return false;
  }

  target.click();
  return true;
}

function optionMatches(optionElement, value) {
  const optionText = normalize(optionElement.getAttribute("aria-label") || optionElement.innerText || "");
  const wanted = normalize(value);
  return optionText === wanted || optionText.includes(wanted);
}

function getQuestionType(questionElement) {
  if (questionElement.querySelector("textarea")) return "paragraph";
  if (questionElement.querySelector("input[type='text'], input[type='email'], input[type='number']")) return "text";
  if (questionElement.querySelector("[role='radio']")) return "radio";
  if (questionElement.querySelector("[role='checkbox']")) return "checkbox";
  if (questionElement.querySelector("[role='listbox']")) return "dropdown";
  return "unknown";
}

function normalize(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\*/g, "")
    .trim()
    .toLowerCase();
}

function setNativeValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor.set.call(element, value);
}

function waitForQuestions() {
  return new Promise((resolve) => {
    if (document.querySelector("div[role='listitem']")) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector("div[role='listitem']")) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 5000);
  });
}
