const cacheManager = require("cache-manager");

const memoryCache = cacheManager.caching({
  store: "memory",
});

const CacheNames = {
  PHARMACIES: {
    name: "pharmacies",
  },
  DISTRICTS: {
    name: "districts",
  },
};

const cacheManage = {
  getCache: async cacheName => {
    return memoryCache.get(key);
  },
  setCache: async (cacheName, value) => {
    return memoryCache.set(key, value, { ttl: 60 * 60 * 24 });
  },
};

module.exports = { cacheManage, CacheNames };
