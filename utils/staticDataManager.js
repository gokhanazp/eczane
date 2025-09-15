/**
 * STATİK VERİ YÖNETİCİSİ - GÜNLÜK TEK API ÇAĞRISI SİSTEMİ
 * API'ye günde sadece 1 kez gider, gün boyunca statik veri servis eder
 * SÜPER TOKEN TASARRUFU: Günlük 2-3 token, gün boyunca 0 token
 */

// YENİ API SİSTEMİ - ECZANELER.ORG
const DutyPharmacyModel = require("../models/dutyPharmacyModel");

const NEW_API_URL = "https://api.eczaneler.org/api/v2";
const NEW_API_KEY = "JZFmSQp9hR6s4lUraieIj1tGA8cwvo0dzVBqEMxuCfY7XHKNDb";

const newApiHeaders = {
  "X-Api-Key": NEW_API_KEY,
  "Content-Type": "application/json",
};

// YENİ API - TÜM NÖBETÇI ECZANELER SAYFALAMA İLE
async function fetchAllPharmacies() {
  console.log("📄 Tüm nöbetçi eczaneler sayfalama ile çekiliyor...");
  let allPharmacies = [];
  let currentPage = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetch(`${NEW_API_URL}/pharmacies/sentry-pharmacies/${currentPage}`, {
        method: "GET",
        headers: newApiHeaders,
      });

      const resJson = await response.json();
      console.log(`🚨 API ÇAĞRISI: Sayfa ${currentPage} - ${resJson.data?.length || 0} eczane`);

      if (resJson.data && resJson.data.length > 0) {
        allPharmacies = allPharmacies.concat(resJson.data);

        // Sayfalama kontrolü
        hasMore = resJson.pagination?.has_more || false;
        currentPage++;

        console.log(`📊 Toplam eczane: ${allPharmacies.length}, Devam: ${hasMore ? 'Evet' : 'Hayır'}`);
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`❌ Sayfa ${currentPage} çekilemedi:`, error.message);
      hasMore = false;
    }
  }

  console.log(`✅ Toplam ${allPharmacies.length} nöbetçi eczane çekildi`);
  return allPharmacies;
}

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

      // YENİ API SİSTEMİ - ECZANELER.ORG
      console.log("🚨 YENİ API SİSTEMİ - ECZANELER.ORG ÇAĞRILIYOR");

      const [pharmaciesRes, citiesRes] = await Promise.all([
        // Tüm nöbetçi eczaneleri çek (sayfalama ile)
        fetchAllPharmacies(),

        // Şehirler listesini çek
        fetch(`${NEW_API_URL}/pharmacies/cities`, {
          method: "GET",
          headers: newApiHeaders,
        }).then(async (response) => {
          const resJson = await response.json();
          console.log("🚨 API ÇAĞRISI: Şehirler listesi çekiliyor");
          console.log("💰 Yeni API kullanımı: cities endpoint");

          if (!resJson.cities) {
            throw new Error(`API Error: Cities data not found`);
          }

          return resJson.cities;
        })
      ]);

      if (pharmaciesRes && pharmaciesRes.length > 0) {
        // YENİ API VERİ İŞLEME
        const dailyPharmacies = {};
        pharmaciesRes.forEach(pharmacy => {
          // Yeni API formatı: { city: "İstanbul", district: "Kadıköy", name: "...", ... }
          const city = pharmacy.city;
          const district = pharmacy.district;

          if (!city || !district) return; // Eksik veri atla

          if (!dailyPharmacies[city]) dailyPharmacies[city] = {};
          if (!dailyPharmacies[city][district]) dailyPharmacies[city][district] = [];

          // Yeni API formatını eski formata dönüştür
          const transformedPharmacy = {
            name: pharmacy.name,
            address: pharmacy.address,
            phone: pharmacy.phone || pharmacy.phone_formatted,
            city: pharmacy.city,
            district: pharmacy.district,
            coordinates: pharmacy.coordinates,
            workingHours: pharmacy.workingHours,
            is_sentry: pharmacy.is_sentry,
            sentry_date: pharmacy.sentry_date,
            updated_at: pharmacy.updated_at,
            note: pharmacy.note || ""
          };

          dailyPharmacies[city][district].push(transformedPharmacy);
        });

        // İlçe listesi oluştur
        const districts = {};
        Object.keys(dailyPharmacies).forEach(city => {
          districts[city] = Object.keys(dailyPharmacies[city]);
        });

        // YENİ API - ŞEHİRLER LİSTESİNİ ESKİ FORMATA DÖNÜŞTÜR
        const transformedCities = citiesRes.map(city => ({
          cities: city.name,
          slug: city.slug,
          pharmacy_count: city.pharmacy_count
        }));

        // STATİK VERİYE KAYDET - API'YE GİTMEYECEK
        DAILY_STATIC_DATA = {
          dailyPharmacies,
          cities: transformedCities,
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
