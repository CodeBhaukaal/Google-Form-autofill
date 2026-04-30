# Google Form Auto Filler Extension

Chrome/Edge extension for auto-filling this Google Form:

`https://docs.google.com/forms/d/e/1FAIpQLScESH6cTuLj9Bb9gbMavsPe6Zod-aewo0RU6_3eIDFFMPVwVA/viewform`

## Install

1. Open Chrome or Edge.
2. Go to `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder: `g:\py\google_form_ex`.

## Use

1. Open the Google Form.
2. Click the extension icon.
3. Click **Detect Questions**.
4. Fill the generated JSON values.
5. Click **Save**.
6. Click **Fill Form**.

Example JSON:

```json
{
  "Name": "Rahul Kumar",
  "Email": "rahul@example.com",
  "Gender": "Male",
  "Skills": ["Python", "JavaScript"],
  "Address": "Delhi"
}
```

For radio buttons and dropdowns, the answer text should match the visible option text. For checkboxes, use an array of selected options.

## Auto-fill

Enable **Auto-fill when this form opens** in the popup. The extension will fill saved answers automatically when the matching Google Form URL opens.

It does not auto-submit the form. Review the answers, then submit manually.
