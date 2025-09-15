/**
 * STATİK VERİ YÖNETİCİSİ - GÜNLÜK TEK API ÇAĞRISI SİSTEMİ
 * API'ye günde sadece 1 kez gider, gün boyunca statik veri servis eder
 * SÜPER TOKEN TASARRUFU: Günlük 2-3 token, gün boyunca 0 token
 */

// DİREKT API ÇAĞRISI - SERVICE BYPASS
const DutyPharmacyModel = require("../models/dutyPharmacyModel");

const DUTY_API_URL = process.env.DUTY_API_URL || "https://www.nosyapi.com/apiv2/service/pharmacies-on-duty";
const DUTY_API_KEY = process.env.DUTY_API_KEY || "Bearer e2rrwkbgS9GJ16zL7yOCRlkoKcIfFT12sLunWqUlPM8kCITjueH1keEj3UT7";

const baseHeaders = {
  "Authorization": DUTY_API_KEY,
  "Content-Type": "application/json",
};

// GLOBAL STATİK VERİ DEPOSU
let DAILY_STATIC_DATA = null;
let LAST_FETCH_DATE = null;
let IS_FETCHING = false;

class StaticDataManager {
  constructor() {
    this.data = null;
    this.lastFetchDate = null;
    this.isFetching = false;
  }

  /**
   * GÜNLÜK VERİ ÇEKİMİ - API'YE SADECE 1 KEZ GİDER
   */
  async fetchDailyData() {
    try {
      console.log("🌅 GÜNLÜK VERİ ÇEKİMİ BAŞLATIYOR - TEK API ÇAĞRISI");
      const startTime = Date.now();

      IS_FETCHING = true;

      console.log("📡 API'den günlük veri çekiliyor... (GÜNDE SADECE 1 KEZ)");
      console.log("🚨 TOKEN HARCAMA: Günlük veri çekimi başlatılıyor - 2-3 TOKEN");
      console.log("💰 Bu günlük tek API çağrısı - sonraki tüm istekler 0 TOKEN");

      // DİREKT API ÇAĞRISI - SERVICE BYPASS (TOKEN TASARRUFU)
      console.log("🚨 DİREKT API ÇAĞRISI - SERVICE BYPASS YAPILIYOR");

      const [pharmaciesRes, citiesRes] = await Promise.all([
        // Direkt eczane API çağrısı
        fetch(`${DUTY_API_URL}/all`, {
          method: "GET",
          headers: baseHeaders,
        }).then(async (response) => {
          const resJson = await response.json();
          if (resJson.status !== "success") {
            throw new Error(`Failed to fetch duty pharmacies: ${resJson.message}`);
          }
          // Kıbrıs filtrele
          resJson.data = resJson.data.filter(pharmacy => pharmacy.city && !pharmacy.city.startsWith("Kıbrıs"));
          return resJson.data.map(pharmacy => DutyPharmacyModel.fromJson(pharmacy));
        }),

        // Direkt şehir API çağrısı
        fetch(`${DUTY_API_URL}/cities`, {
          method: "GET",
          headers: baseHeaders,
        }).then(async (response) => {
          const resJson = await response.json();
          if (resJson.status !== "success") {
            throw new Error(`Failed to fetch cities: ${resJson.message}`);
          }
          // Kıbrıs filtrele
          resJson.data = resJson.data.filter(city => city.cities && !city.cities.startsWith("Kıbrıs"));
          return resJson.data;
        })
      ]);

      if (pharmaciesRes && pharmaciesRes.length > 0) {
        // Veri işleme
        const dailyPharmacies = {};
        pharmaciesRes.forEach(pharmacy => {
          const { city, district } = pharmacy;
          if (!dailyPharmacies[city]) dailyPharmacies[city] = {};
          if (!dailyPharmacies[city][district]) dailyPharmacies[city][district] = [];
          dailyPharmacies[city][district].push(pharmacy);
        });

        // İlçe listesi oluştur
        const districts = {};
        Object.keys(dailyPharmacies).forEach(city => {
          districts[city] = Object.keys(dailyPharmacies[city]);
        });

        // STATİK VERİYE KAYDET - API'YE GİTMEYECEK
        DAILY_STATIC_DATA = {
          dailyPharmacies,
          cities: citiesRes,
          pharmacies: pharmaciesRes,
          districts,
          fetchTime: new Date(),
          fetchDate: new Date().toDateString(),
          totalPharmacies: pharmaciesRes.length,
          totalCities: Object.keys(dailyPharmacies).length
        };
        
        LAST_FETCH_DATE = new Date().toDateString();
        IS_FETCHING = false;

        const loadTime = Date.now() - startTime;
        console.log(`✅ GÜNLÜK VERİ ÇEKİMİ TAMAMLANDI! (${loadTime}ms)`);
        console.log(`📊 ${Object.keys(dailyPharmacies).length} şehir, ${pharmaciesRes.length} eczane statik veriye kaydedildi`);
        console.log(`🗓️ Sonraki çekim: Yarın sabah (otomatik)`);
        console.log(`⏰ Çekim zamanı: ${DAILY_STATIC_DATA.fetchTime.toLocaleString('tr-TR')}`);
        
        return DAILY_STATIC_DATA;
      } else {
        console.log("❌ Günlük veri çekimi başarısız - API'den veri alınamadı");
        IS_FETCHING = false;
        return null;
      }
    } catch (error) {
      console.error("❌ Günlük veri çekimi hatası:", error.message);
      IS_FETCHING = false;
      return null;
    }
  }

  /**
   * STATİK VERİ ALMA - API'YE HİÇ GİTMEZ
   */
  async getStaticData() {
    const today = new Date().toDateString();
    
    // Eğer şu anda çekim yapılıyorsa bekle
    if (IS_FETCHING) {
      console.log("⏳ Veri çekimi devam ediyor, bekleniyor...");
      // Maksimum 10 saniye bekle
      let waitCount = 0;
      while (IS_FETCHING && waitCount < 100) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
    }
    
    // Eğer bugün veri çekilmemişse veya veri yoksa çek
    if (!DAILY_STATIC_DATA || LAST_FETCH_DATE !== today) {
      console.log("🔄 Günlük veri güncelleme gerekiyor...");
      await this.fetchDailyData();
    }
    
    if (DAILY_STATIC_DATA) {
      console.log("✅ STATİK VERİDEN SUNULUYOR - 0 TOKEN HARCAMA");
      console.log(`📊 Veri durumu: ${DAILY_STATIC_DATA.totalCities} şehir, ${DAILY_STATIC_DATA.totalPharmacies} eczane`);
      console.log(`⏰ Çekim zamanı: ${DAILY_STATIC_DATA.fetchTime.toLocaleString('tr-TR')}`);
      return DAILY_STATIC_DATA;
    } else {
      console.log("❌ Statik veri mevcut değil - Boş veri döndürülüyor");
      return {
        dailyPharmacies: {},
        cities: [],
        pharmacies: [],
        districts: {},
        fetchTime: null,
        fetchDate: null,
        totalPharmacies: 0,
        totalCities: 0
      };
    }
  }

  /**
   * VERİ DURUMU BİLGİSİ
   */
  getDataStatus() {
    return {
      hasData: !!DAILY_STATIC_DATA,
      lastFetchDate: LAST_FETCH_DATE,
      isFetching: IS_FETCHING,
      fetchTime: DAILY_STATIC_DATA ? DAILY_STATIC_DATA.fetchTime : null,
      totalPharmacies: DAILY_STATIC_DATA ? DAILY_STATIC_DATA.totalPharmacies : 0,
      totalCities: DAILY_STATIC_DATA ? DAILY_STATIC_DATA.totalCities : 0
    };
  }

  /**
   * MANUEL VERİ YENİLEME (ACİL DURUM)
   */
  async forceRefresh() {
    console.log("🔄 MANUEL VERİ YENİLEME - ACİL DURUM");
    DAILY_STATIC_DATA = null;
    LAST_FETCH_DATE = null;
    return await this.fetchDailyData();
  }
}

// SINGLETON INSTANCE
const staticDataManager = new StaticDataManager();

module.exports = {
  staticDataManager,
  getStaticData: () => staticDataManager.getStaticData(),
  getDataStatus: () => staticDataManager.getDataStatus(),
  forceRefresh: () => staticDataManager.forceRefresh()
};
