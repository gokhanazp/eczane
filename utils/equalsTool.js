const translateEnglish = require("./translateEnglish");

function equalsTool(a, b) {
  return (
    translateEnglish({ text: a }).text.toLowerCase().trim() === translateEnglish({ text: b }).text.toLowerCase().trim()
  );
}
