function translateEnglish(params) {
  for (const param in params) {
    params[param] = params[param]
      .replace(/c/g, "c")
      .replace(/ç/g, "c")
      .replace(/C/g, "C")
      .replace(/Ç/g, "C")
      .replace(/g/g, "g")
      .replace(/ğ/g, "g")
      .replace(/G/g, "G")
      .replace(/Ğ/g, "G")
      .replace(/i/g, "i")
      .replace(/ı/g, "i")
      .replace("i̇", "i")
      .replace(/I/g, "I")
      .replace(/İ/g, "I")
      .replace(/o/g, "o")
      .replace(/ö/g, "o")
      .replace(/Ö/g, "O")
      .replace(/O/g, "O")
      .replace(/s/g, "s")
      .replace(/ş/g, "s")
      .replace(/S/g, "S")
      .replace(/Ş/g, "S")
      .replace(/u/g, "u")
      .replace(/ü/g, "u")
      .replace(/U/g, "U")
      .replace(/Ü/g, "U")
      .replace(/i̇/g, "i");
  }

  return params;
}

module.exports = translateEnglish;
