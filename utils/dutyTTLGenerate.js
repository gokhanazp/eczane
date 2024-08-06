module.exports.dutyTTLGenerate = function () {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  const diff = tomorrow - now;
  console.log("TTL:", diff);
  return diff;
};
