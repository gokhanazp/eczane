/**
 * API Kontör Optimizasyon Yardımcıları
 * API çağrılarını minimize etmek ve kontör tasarrufu sağlamak için
 */

const { cacheManage, CacheNames } = require("./cacheManage");
const { dutyTTLGenerate } = require("./dutyTTLGenerate");

class ApiOptimizer {
  constructor() {
    // API çağrı sayacı
    this.apiCallCount = 0;
    this.dailyApiLimit = 1000; // Günlük API limit
    this.lastResetDate = new Date().toDateString();
  }

  /**
   * API çağrı sayacını kontrol et ve sıfırla
   */
  checkAndResetDailyCounter() {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.apiCallCount = 0;
      this.lastResetDate = today;
      console.log("🔄 Günlük API sayacı sıfırlandı");
    }
  }

  /**
   * API çağrısı yapılmadan önce kontrol et
   * @param {string} endpoint - API endpoint adı
   * @returns {boolean} API çağrısı yapılabilir mi?
   */
  canMakeApiCall(endpoint) {
    this.checkAndResetDailyCounter();
    
    if (this.apiCallCount >= this.dailyApiLimit) {
      console.warn(`⚠️ Günlük API limiti aşıldı: ${this.apiCallCount}/${this.dailyApiLimit}`);
      return false;
    }
    
    return true;
  }

  /**
   * API çağrısı yapıldığını kaydet
   * @param {string} endpoint - API endpoint adı
   */
  recordApiCall(endpoint) {
    this.apiCallCount++;
    console.log(`📊 API çağrısı kaydedildi: ${endpoint} (${this.apiCallCount}/${this.dailyApiLimit})`);
  }

  /**
   * Cache'ten veri al, yoksa API çağrısı yap
   * @param {string} cacheKey - Cache anahtarı
   * @param {Function} apiFunction - API çağrı fonksiyonu
   * @param {number} cacheDays - Cache süresi (gün)
   * @returns {Promise<any>} Veri
   */
  async getWithCache(cacheKey, apiFunction, cacheDays = 7) {
    try {
      // Önce cache'i kontrol et
      const cachedData = await cacheManage.getCache(cacheKey);
      if (cachedData) {
        console.log(`✅ Cache'ten alındı: ${cacheKey}`);
        return cachedData;
      }

      // API limiti kontrol et
      if (!this.canMakeApiCall(cacheKey)) {
        throw new Error("Günlük API limiti aşıldı");
      }

      // API çağrısı yap
      console.log(`🌐 API çağrısı yapılıyor: ${cacheKey}`);
      const data = await apiFunction();
      this.recordApiCall(cacheKey);

      // Cache'e kaydet
      await cacheManage.setCache(cacheKey, data, dutyTTLGenerate(cacheDays));
      console.log(`💾 Cache'e kaydedildi: ${cacheKey} (${cacheDays} gün)`);

      return data;
    } catch (error) {
      console.error(`❌ API Optimizer hatası (${cacheKey}):`, error.message);
      throw error;
    }
  }

  /**
   * API kullanım istatistiklerini getir
   * @returns {Object} İstatistikler
   */
  getApiStats() {
    this.checkAndResetDailyCounter();
    
    return {
      dailyApiCalls: this.apiCallCount,
      dailyLimit: this.dailyApiLimit,
      remainingCalls: this.dailyApiLimit - this.apiCallCount,
      usagePercentage: Math.round((this.apiCallCount / this.dailyApiLimit) * 100),
      lastResetDate: this.lastResetDate,
      status: this.apiCallCount >= this.dailyApiLimit ? "LIMIT_EXCEEDED" : "ACTIVE"
    };
  }

  /**
   * Cache stratejisini optimize et
   * @param {string} dataType - Veri tipi (cities, pharmacies, districts)
   * @returns {number} Önerilen cache süresi (gün)
   */
  getOptimalCacheDuration(dataType) {
    const strategies = {
      cities: 30,        // Şehirler çok nadir değişir
      districts: 30,     // İlçeler çok nadir değişir
      pharmacies: 7,     // Eczane bilgileri haftalık güncellenebilir
      dutyPharmacies: 1, // Nöbetçi eczaneler günlük değişir
      nearestPharmacies: 0.5, // En yakın eczaneler 12 saat cache
      pharmacyDetails: 30 // Eczane detayları aylık cache
    };

    return strategies[dataType] || 7;
  }

  /**
   * Yoğun saatlerde API kullanımını azalt
   * @returns {boolean} API çağrısı yapılabilir mi?
   */
  isOptimalApiTime() {
    const hour = new Date().getHours();
    
    // Gece saatleri (02:00-06:00) optimal
    if (hour >= 2 && hour <= 6) {
      return true;
    }
    
    // Yoğun saatler (09:00-18:00) kısıtlı
    if (hour >= 9 && hour <= 18) {
      return this.apiCallCount < (this.dailyApiLimit * 0.7); // %70 limit
    }
    
    return true;
  }

  /**
   * Batch API çağrıları için optimize et
   * @param {Array} requests - API istekleri
   * @param {number} batchSize - Batch boyutu
   * @returns {Promise<Array>} Sonuçlar
   */
  async batchApiCalls(requests, batchSize = 5) {
    const results = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      // Batch'i paralel çalıştır
      const batchResults = await Promise.allSettled(
        batch.map(request => request())
      );
      
      results.push(...batchResults);
      
      // Batch'ler arası bekleme (rate limiting)
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}

module.exports = new ApiOptimizer();
