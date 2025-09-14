const Keyv = require("keyv");

// VERCEL SERVERLESS İÇİN MEMORY-ONLY CACHE - TOKEN TASARRUFU
// File cache Vercel'de çalışmıyor, sürekli API çağrısı yapıyordu
const cacheInstance = new Keyv({
  // Memory-only cache (Vercel serverless uyumlu)
  ttl: 24 * 60 * 60 * 1000, // 24 saat default TTL
});

const CacheNames = {
  PHARMACIES: "pharmacies",
  DAILY_PHARMACIES: "dailyPharmacies",
};

const cacheManage = {
  getCache: async cacheName => {
    try {
      const value = await cacheInstance.get(cacheName);
      if (value) {
        console.log(`✅ Cache hit: ${cacheName}`);
      } else {
        console.log(`❌ Cache miss: ${cacheName}`);
      }
      return value;
    } catch (error) {
      console.error(`❌ Cache get error (${cacheName}):`, error.message);
      return null; // Cache hatası durumunda null döner, API çağrısı yapılır
    }
  },
  setCache: async (cacheName, value, ttl = null) => {
    try {
      await cacheInstance.set(cacheName, value, ttl);
      console.log(`💾 Cache set: ${cacheName} (TTL: ${ttl ? Math.round(ttl/1000) + 's' : 'default'})`);
      return value;
    } catch (error) {
      console.error(`❌ Cache set error (${cacheName}):`, error.message);
      return value; // Cache yazma hatası olsa da veriyi döner
    }
  },
  deleteCache: async cacheName => {
    try {
      await cacheInstance.delete(cacheName);
      console.log(`🗑️ Cache deleted: ${cacheName}`);
    } catch (error) {
      console.error(`❌ Cache delete error (${cacheName}):`, error.message);
    }
  },
};

module.exports = { cacheManage, CacheNames };
