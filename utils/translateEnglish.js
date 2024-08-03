function translateEnglish(params) {
  for (const param in params) {
    params[param] = params[param]
      .replace(/ç/g, "c")
      .replace(/Ç/g, "C")
      .replace(/ğ/g, "g")
      .replace(/Ğ/g, "G")
      .replace(/ı/g, "i")
      .replace(/İ/g, "I")
      .replace(/ö/g, "o")
      .replace(/Ö/g, "O")
      .replace(/ş/g, "s")
      .replace(/Ş/g, "S")
      .replace(/ü/g, "u")
      .replace(/Ü/g, "U");
  }

  return params;
}

module.exports = translateEnglish;
