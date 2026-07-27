chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "IRCTC_AUTO_FILL") {
    return false;
  }

  fillPassengers(message.payload)
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({
        ok: false,
        message: error?.message || "Passenger fill karte waqt error aa gaya."
      });
    });

  return true;
});

async function fillPassengers(payload) {
  const passengers = parsePassengers(payload?.rawText || "");

  if (!passengers.length) {
    return {
      ok: false,
      message: "Koi valid passenger line nahi mili. Format rakhiye: RAMESH 43 M"
    };
  }

  const defaults = payload?.defaults || {};
  const berthAssignments = getBerthAssignments(passengers, defaults.berthChoice);
  await ensurePassengerForms(passengers.length);

  const forms = getPassengerForms();
  if (!forms.length) {
    return {
      ok: false,
      message: "Passenger form page par detect nahi hua."
    };
  }

  for (let index = 0; index < passengers.length; index += 1) {
    const passenger = passengers[index];
    const form = forms[index];

    if (!form) {
      throw new Error(`Passenger form ${index + 1} tak nahi ban paya.`);
    }

    await fillPassengerForm(form, passenger, defaults, berthAssignments[index]);
  }

  fillContactDetails(defaults);

  return {
    ok: true,
    message: `${passengers.length} passenger auto-fill ho gaye.`
  };
}

function parsePassengers(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parsePassengerLine)
    .filter(Boolean);
}

function parsePassengerLine(line) {
  const cleaned = line
    .replace(/^\d+\s*[\.\)\-]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  const match = cleaned.match(/^(.*\S)\s+(\d{1,3})\s+(M|F|T|MALE|FEMALE|TRANSGENDER)$/i);
  if (!match) {
    return null;
  }

  const [, name, age, genderToken] = match;
  const gender = normalizeGender(genderToken);

  if (!gender) {
    return null;
  }

  return {
    name: name.trim(),
    age: age.trim(),
    gender
  };
}

function normalizeGender(value) {
  const upper = value.toUpperCase();
  if (upper === "M" || upper === "MALE") {
    return "M";
  }
  if (upper === "F" || upper === "FEMALE") {
    return "F";
  }
  if (upper === "T" || upper === "TRANSGENDER") {
    return "T";
  }
  return "";
}

async function ensurePassengerForms(requiredCount) {
  let forms = getPassengerForms();

  while (forms.length < requiredCount) {
    const addPassengerLink = findAddPassengerLink();
    if (!addPassengerLink) {
      throw new Error("'+ Add Passenger' button nahi mila.");
    }

    addPassengerLink.click();
    await wait(500);
    forms = getPassengerForms();
  }
}

function getPassengerForms() {
  return Array.from(document.querySelectorAll("app-passenger")).filter((form) => {
    return form.querySelector('[formcontrolname="passengerAge"]');
  });
}

function findAddPassengerLink() {
  const clickableNodes = Array.from(document.querySelectorAll("a, button, span"));
  return clickableNodes.find((node) => {
    const text = node.textContent?.replace(/\s+/g, " ").trim() || "";
    return text.includes("+ Add Passenger");
  }) || null;
}

async function fillPassengerForm(form, passenger, defaults, berthChoice) {
  const nameInput =
    form.querySelector('p-autocomplete[formcontrolname="passengerName"] input') ||
    form.querySelector('p-autocomplete input[placeholder="Name"]') ||
    form.querySelector('p-autocomplete input[placeholder*="Full Name"]') ||
    form.querySelector('input[formcontrolname="passengerName"]') ||
    form.querySelector('input[placeholder*="Full Name"]') ||
    form.querySelector('input[placeholder="Name"]');

  const ageInput = form.querySelector('input[formcontrolname="passengerAge"]');
  const genderSelect = form.querySelector('select[formcontrolname="passengerGender"]');
  const nationalitySelect = form.querySelector('select[formcontrolname="passengerNationality"]');
  const berthSelect = form.querySelector('select[formcontrolname="passengerBerthChoice"]');

  if (!nameInput || !ageInput || !genderSelect) {
    throw new Error("Passenger fields expected format me nahi mile.");
  }

  setNativeValue(nameInput, passenger.name);
  fireTextEvents(nameInput);
  await wait(100);

  setNativeValue(ageInput, passenger.age);
  fireTextEvents(ageInput);

  setSelectValue(genderSelect, passenger.gender);

  if (nationalitySelect && defaults.nationality !== undefined) {
    setSelectValue(nationalitySelect, defaults.nationality);
  }

  if (berthSelect && berthChoice !== undefined && hasSelectOption(berthSelect, berthChoice)) {
    setSelectValue(berthSelect, berthChoice);
  }
}

function hasSelectOption(select, value) {
  if (value === "") {
    return true;
  }

  return Array.from(select.options).some((option) => option.value === value);
}

function getBerthAssignments(passengers, berthChoice) {
  if (berthChoice !== "AUTO") {
    return passengers.map(() => berthChoice);
  }

  const rankedPassengers = passengers
    .map((passenger, index) => ({
      index,
      age: Number.parseInt(passenger.age, 10) || 0
    }))
    .sort((left, right) => right.age - left.age || left.index - right.index);

  const autoSequence = ["LB", "LB", "MB", "MB", "SL", "SU"];
  const assignments = passengers.map(() => "");

  rankedPassengers.forEach((passenger, rank) => {
    assignments[passenger.index] = autoSequence[rank] || "";
  });

  return assignments;
}

function fillContactDetails(defaults) {
  const mobileNumber = String(defaults.mobileNumber || "")
    .replace(/\D/g, "")
    .slice(0, 10);

  if (!mobileNumber) {
    return;
  }

  const mobileInput =
    document.querySelector('input[formcontrolname="mobileNumber"]') ||
    document.querySelector("#mobileNumber") ||
    document.querySelector('input[name="mobileNumber"]');

  if (!mobileInput) {
    return;
  }

  setNativeValue(mobileInput, mobileNumber);
  fireTextEvents(mobileInput);
}

function setNativeValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  descriptor?.set?.call(element, value);
}

function fireTextEvents(element) {
  ["input", "change", "blur"].forEach((eventName) => {
    element.dispatchEvent(new Event(eventName, { bubbles: true }));
  });
}

function setSelectValue(select, value) {
  if (value === undefined) {
    return;
  }

  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  descriptor?.set?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
  select.dispatchEvent(new Event("blur", { bubbles: true }));
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
