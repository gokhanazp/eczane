const Keyv = require("keyv");
const { KeyvFile } = require("keyv-file");

const cacheInstance = new Keyv({
  store: new KeyvFile({
    filename: "./caches/cache.json",
    encode: JSON.stringify,
    decode: JSON.parse,
  }),
});

const CacheNames = {
  PHARMACIES: "pharmacies",
  DAILY_PHARMACIES: "dailyPharmacies",
};

const cacheManage = {
  getCache: async cacheName => {
    const value = await cacheInstance.get(cacheName);
    return value;
  },
  setCache: async (cacheName, value, ttl = null) => {
    await cacheInstance.set(cacheName, value, ttl);
    return value;
  },
  deleteCache: async cacheName => {
    await cacheInstance.delete(cacheName);
  },
};

module.exports = { cacheManage, CacheNames };
