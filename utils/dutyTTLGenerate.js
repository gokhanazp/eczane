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
