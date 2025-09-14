/**
 * @param {number} day - The number of days to add to the current date
 * @returns The time to live in milliseconds
 */
module.exports.dutyTTLGenerate = function (day = 1) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + day);
  tomorrow.setHours(9, 0, 1, 0);
  const diff = tomorrow.getTime() - now.getTime();
  return diff;
};

/**
 * Nöbetçi eczaneler için özel TTL - Sabah 8'e kadar cache
 * @returns The time to live in milliseconds until next 8 AM
 */
module.exports.dutyPharmacyTTL = function () {
  const now = new Date();
  const nextUpdate = new Date(now);

  // Eğer şu an saat 8'den önce ise, bugün saat 8'e kadar
  if (now.getHours() < 8) {
    nextUpdate.setHours(8, 0, 0, 0);
  } else {
    // Eğer saat 8'den sonra ise, yarın saat 8'e kadar
    nextUpdate.setDate(nextUpdate.getDate() + 1);
    nextUpdate.setHours(8, 0, 0, 0);
  }

  const diff = nextUpdate.getTime() - now.getTime();

  console.log(`🕰️ Nöbetçi eczane cache süresi: ${Math.round(diff / (1000 * 60 * 60))} saat (${nextUpdate.toLocaleString('tr-TR')} tarihine kadar)`);

  return diff;
};
