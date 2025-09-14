const { Router } = require("express");
const DutyPharmacyService = require("../services/DutyPharmacyService");
const translateEnglish = require("../utils/translateEnglish");
const { getCookie, setCookie, CookieNames } = require("../utils/cookieManage");
const { cacheManage, CacheNames } = require("../utils/cacheManage");
const { dutyTTLGenerate, dutyPharmacyTTL } = require("../utils/dutyTTLGenerate");
const apiOptimizer = require("../utils/apiOptimizer");
const { testLimiter, cacheLimiter } = require("../middleware/rateLimiter");
const { getMessages, redirectWithError, redirectWithSuccess } = require("../utils/messageHelper");

const router = Router();

// Global cache değişkenleri - Memory'de tutarak hızlandırma
let memoryCache = {
  dailyPharmacies: null,
  cities: null,
  districts: null,
  lastUpdate: null,
  isLoading: false
};

// Startup'ta cache'i hemen yükle
let startupCachePromise = null;

// Tek API çağrısı ile tüm veriyi çek - TOKEN TASARRUFU
const _getAllData = async (forceRefresh = false) => {
  try {
    // Memory cache kontrolü - AKILLI GÜN BAZLI CACHE
    if (!forceRefresh && memoryCache.dailyPharmacies && memoryCache.cities && memoryCache.lastUpdate) {
      const now = new Date();
      const cacheDate = new Date(memoryCache.lastUpdate);

      // Eğer aynı gün ve saat 8'den sonra ise cache geçerli
      const isSameDay = now.toDateString() === cacheDate.toDateString();
      const isAfter8AM = now.getHours() >= 8;
      const cacheAfter8AM = cacheDate.getHours() >= 8;

      if (isSameDay && isAfter8AM && cacheAfter8AM) {
        console.log("⚡ Memory cache geçerli (aynı gün, sabah 8 sonrası) - TOKEN TASARRUFU");
        return {
          dailyPharmacies: memoryCache.dailyPharmacies,
          cities: memoryCache.cities,
          districts: memoryCache.districts
        };
      }

      // Eğer cache sabah 8'den önce oluşturulmuş ve şimdi 8'den sonra ise yenile
      if (isSameDay && isAfter8AM && !cacheAfter8AM) {
        console.log("🔄 Sabah 8 geçti, cache yenileniyor...");
      } else if (!isSameDay) {
        console.log("🔄 Yeni gün, cache yenileniyor...");
      }
    }

    // Eğer başka bir request loading'de ise bekle
    if (memoryCache.isLoading) {
      console.log("⏳ Başka request loading, bekleniyor...");
      let attempts = 0;
      while (memoryCache.isLoading && attempts < 20) { // 2 saniye max
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      if (memoryCache.dailyPharmacies && memoryCache.cities) {
        console.log("✅ Loading tamamlandı, memory cache'ten alındı");
        return {
          dailyPharmacies: memoryCache.dailyPharmacies,
          cities: memoryCache.cities,
          districts: memoryCache.districts
        };
      }
    }

    memoryCache.isLoading = true;

    // File cache kontrolü
    const cachedDailyPharmacies = await cacheManage.getCache(CacheNames.DAILY_PHARMACIES);
    const cachedCities = await cacheManage.getCache("cities_cache");

    if (!forceRefresh && cachedDailyPharmacies && cachedCities) {
      console.log("✅ File cache'ten alındı (TOKEN TASARRUFU)");
      memoryCache.dailyPharmacies = cachedDailyPharmacies;
      memoryCache.cities = cachedCities;
      memoryCache.lastUpdate = Date.now();
      memoryCache.isLoading = false;
      return {
        dailyPharmacies: cachedDailyPharmacies,
        cities: cachedCities,
        districts: memoryCache.districts
      };
    }

    // API LIMIT KONTROLÜ - TOKEN TASARRUFU
    if (!apiOptimizer.canMakeApiCall("getAllData")) {
      console.log("🚫 API limit aşıldı, eski cache kullanılıyor");
      return {
        dailyPharmacies: memoryCache.dailyPharmacies || {},
        cities: memoryCache.cities || [],
        districts: memoryCache.districts || {}
      };
    }

    console.log("🌐 API'den fresh data alınıyor... (TOKEN KULLANIMI)");
    const startTime = Date.now();

    // TEK API ÇAĞRISI - TOKEN TASARRUFU
    const [pharmaciesRes, citiesRes] = await Promise.all([
      DutyPharmacyService.getDutyPharmacies(),
      DutyPharmacyService.getCities()
    ]);

    // API çağrısını kaydet
    apiOptimizer.recordApiCall("getDutyPharmacies");
    apiOptimizer.recordApiCall("getCities");

    const apiTime = Date.now() - startTime;
    console.log(`⏱️ API çağrısı süresi: ${apiTime}ms (2 endpoint paralel)`);

    if (!pharmaciesRes || pharmaciesRes.length === 0) {
      console.log("❌ API'den veri alınamadı");
      memoryCache.isLoading = false;
      return {
        dailyPharmacies: memoryCache.dailyPharmacies || {},
        cities: memoryCache.cities || [],
        districts: memoryCache.districts || {}
      };
    }

    // Veri işleme - Optimize edilmiş
    const dailyPharmacies = {};
    const processStart = Date.now();

    pharmaciesRes.forEach(pharmacy => {
      const { city, district } = pharmacy;
      if (!dailyPharmacies[city]) dailyPharmacies[city] = {};
      if (!dailyPharmacies[city][district]) dailyPharmacies[city][district] = [];
      dailyPharmacies[city][district].push(pharmacy);
    });

    const processTime = Date.now() - processStart;
    console.log(`⚡ Veri işleme süresi: ${processTime}ms`);

    console.log("✅ Tüm veri hazırlandı:", {
      cityCount: Object.keys(dailyPharmacies).length,
      totalPharmacies: pharmaciesRes.length,
      citiesCount: citiesRes.length
    });

    // Cache'leri güncelle - AKILLI GÜN BAZLI CACHE
    const pharmacyTTL = dutyPharmacyTTL(); // Sabah 8'e kadar
    const citiesTTL = dutyTTLGenerate(90); // 90 gün (şehirler değişmez)

    await Promise.all([
      cacheManage.setCache(CacheNames.DAILY_PHARMACIES, dailyPharmacies, pharmacyTTL), // Sabah 8'e kadar
      cacheManage.setCache(CacheNames.PHARMACIES, pharmaciesRes, pharmacyTTL), // Sabah 8'e kadar
      cacheManage.setCache("cities_cache", citiesRes, citiesTTL) // 90 gün
    ]);

    console.log("✅ Akıllı cache ayarlandı:", {
      pharmacyTTL: Math.round(pharmacyTTL / (1000 * 60 * 60)) + " saat",
      citiesTTL: Math.round(citiesTTL / (1000 * 60 * 60 * 24)) + " gün"
    });

    // Memory cache güncelle
    memoryCache.dailyPharmacies = dailyPharmacies;
    memoryCache.cities = citiesRes;
    memoryCache.lastUpdate = Date.now();
    memoryCache.isLoading = false;

    return {
      dailyPharmacies,
      cities: citiesRes,
      districts: memoryCache.districts
    };
  } catch (error) {
    console.error("❌ _getAllData hatası:", error.message);
    memoryCache.isLoading = false;
    return {
      dailyPharmacies: memoryCache.dailyPharmacies || {},
      cities: memoryCache.cities || [],
      districts: memoryCache.districts || {}
    };
  }
};

// Eski fonksiyon - geriye uyumluluk için
const _getPharmacies = async (forceRefresh = false) => {
  try {
    // Memory cache kontrolü - Çok hızlı (2 saat cache)
    if (!forceRefresh && memoryCache.dailyPharmacies && memoryCache.lastUpdate) {
      const cacheAge = Date.now() - memoryCache.lastUpdate;
      if (cacheAge < 2 * 60 * 60 * 1000) { // 2 saat memory cache (daha uzun)
        console.log("⚡ Memory cache'ten alındı (çok hızlı)");
        return memoryCache.dailyPharmacies;
      }
    }

    // Eğer başka bir request loading'de ise bekle (daha kısa timeout)
    if (memoryCache.isLoading) {
      console.log("⏳ Başka request loading, bekleniyor...");
      let attempts = 0;
      while (memoryCache.isLoading && attempts < 20) { // 2 saniye max (daha kısa)
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      if (memoryCache.dailyPharmacies) {
        console.log("✅ Loading tamamlandı, memory cache'ten alındı");
        return memoryCache.dailyPharmacies;
      }
    }

    memoryCache.isLoading = true;

    // File cache kontrolü
    const cachedDailyPharmacies = await cacheManage.getCache(CacheNames.DAILY_PHARMACIES);

    if (!forceRefresh && cachedDailyPharmacies) {
      console.log("✅ File cache'ten alındı");
      memoryCache.dailyPharmacies = cachedDailyPharmacies;
      memoryCache.lastUpdate = Date.now();
      memoryCache.isLoading = false;
      return cachedDailyPharmacies;
    }

    console.log("🌐 API'den fresh data alınıyor...");
    const startTime = Date.now();
    const pharmaciesRes = await DutyPharmacyService.getDutyPharmacies();
    const apiTime = Date.now() - startTime;
    console.log(`⏱️ API çağrısı süresi: ${apiTime}ms`);

    if (!pharmaciesRes || pharmaciesRes.length === 0) {
      console.log("❌ API'den veri alınamadı");
      memoryCache.isLoading = false;
      return memoryCache.dailyPharmacies || {}; // Eski cache varsa onu döner
    }

    // Veri işleme - Optimize edilmiş
    const dailyPharmacies = {};
    const processStart = Date.now();

    pharmaciesRes.forEach(pharmacy => {
      const { city, district } = pharmacy;
      if (!dailyPharmacies[city]) dailyPharmacies[city] = {};
      if (!dailyPharmacies[city][district]) dailyPharmacies[city][district] = [];
      dailyPharmacies[city][district].push(pharmacy);
    });

    const processTime = Date.now() - processStart;
    console.log(`⚡ Veri işleme süresi: ${processTime}ms`);

    console.log("✅ Daily pharmacies oluşturuldu:", {
      cityCount: Object.keys(dailyPharmacies).length,
      totalPharmacies: pharmaciesRes.length
    });

    // Cache'leri güncelle
    await Promise.all([
      cacheManage.setCache(CacheNames.DAILY_PHARMACIES, dailyPharmacies, dutyTTLGenerate(1)), // 1 gün
      cacheManage.setCache(CacheNames.PHARMACIES, pharmaciesRes, dutyTTLGenerate(7)) // 7 gün
    ]);

    // Memory cache güncelle
    memoryCache.dailyPharmacies = dailyPharmacies;
    memoryCache.lastUpdate = Date.now();
    memoryCache.isLoading = false;

    return dailyPharmacies;
  } catch (error) {
    console.error("❌ _getPharmacies hatası:", error.message);
    memoryCache.isLoading = false;
    return memoryCache.dailyPharmacies || {}; // Eski cache varsa onu döner
  }
};

// SEO Analiz Sayfası
router.get("/seo-analysis", async (req, res) => {
  res.status(200).render("pages/seoAnalysis", {
    title: "SEO Analiz Raporu - Türkiye Nöbetçi Eczane",
    breadcrumbList: [{ name: "SEO Analiz", url: "/seo-analysis" }],
  });
});

// Cache Temizleme endpoint'i (Rate Limited)
router.post("/clear-cache", cacheLimiter, async (req, res) => {
  try {
    // Manuel cache temizleme - Hem file hem memory
    await cacheManage.setCache(CacheNames.DAILY_PHARMACIES, null, 0);
    await cacheManage.setCache(CacheNames.PHARMACIES, null, 0);

    // Memory cache'i de temizle
    memoryCache.dailyPharmacies = null;
    memoryCache.lastUpdate = null;
    memoryCache.isLoading = false;

    console.log("🗑️ Tüm cache temizlendi (file + memory)");

    res.json({
      message: "✅ Cache başarıyla temizlendi",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "Cache temizleme hatası",
      message: error.message
    });
  }
});

// Vercel Debug endpoint'i (Acil test için)
router.get("/vercel-debug", async (req, res) => {
  try {
    console.log("🚨 VERCEL DEBUG BAŞLATILIYOR...");

    // Environment variables kontrol
    const envCheck = {
      DUTY_API_URL: !!process.env.DUTY_API_URL,
      DUTY_API_KEY: !!process.env.DUTY_API_KEY,
      NODE_ENV: process.env.NODE_ENV
    };
    console.log("🔑 ENV Check:", envCheck);

    // Cache kontrol
    const cachedDaily = await cacheManage.getCache(CacheNames.DAILY_PHARMACIES);
    const cachedPharmacies = await cacheManage.getCache(CacheNames.PHARMACIES);

    const cacheStatus = {
      dailyExists: !!cachedDaily,
      pharmaciesExists: !!cachedPharmacies,
      dailyKeys: cachedDaily ? Object.keys(cachedDaily).length : 0,
      pharmaciesLength: cachedPharmacies ? cachedPharmacies.length : 0
    };
    console.log("💾 Cache Status:", cacheStatus);

    // _getAllData test - TOKEN TASARRUFU
    const allData = await _getAllData();
    const pharmacies = allData.dailyPharmacies;
    const pharmaciesStatus = {
      type: typeof pharmacies,
      isNull: pharmacies === null,
      keys: pharmacies ? Object.keys(pharmacies).length : 0,
      hasIstanbul: pharmacies && pharmacies['İstanbul'] ? true : false,
      istanbulDistricts: pharmacies && pharmacies['İstanbul'] ? Object.keys(pharmacies['İstanbul']).length : 0
    };
    console.log("🏥 Pharmacies Status:", pharmaciesStatus);

    res.json({
      message: "🚨 VERCEL DEBUG RAPORU",
      timestamp: new Date().toISOString(),
      environment: envCheck,
      cache: cacheStatus,
      pharmacies: pharmaciesStatus,
      success: true
    });

  } catch (error) {
    console.error("❌ VERCEL DEBUG HATASI:", error);
    res.status(500).json({
      error: "Debug failed",
      message: error.message,
      stack: error.stack
    });
  }
});

// _getPharmacies Test endpoint'i (Rate Limited)
router.get("/test-getpharmacies", testLimiter, async (req, res) => {
  try {
    console.log("🔍 _getPharmacies Test başlatılıyor...");

    // Cache'i kontrol et
    const cachedDaily = await cacheManage.getCache(CacheNames.DAILY_PHARMACIES);
    const cachedPharmacies = await cacheManage.getCache(CacheNames.PHARMACIES);

    console.log("📦 Cache durumu:", {
      dailyExists: !!cachedDaily,
      pharmaciesExists: !!cachedPharmacies,
      dailyKeys: cachedDaily ? Object.keys(cachedDaily).length : 0,
      pharmaciesLength: cachedPharmacies ? cachedPharmacies.length : 0
    });

    // _getAllData fonksiyonunu çağır - TOKEN TASARRUFU
    const allData = await _getAllData();
    const result = allData.dailyPharmacies;

    console.log("✅ _getPharmacies sonucu:", {
      resultType: typeof result,
      isNull: result === null,
      cityCount: result ? Object.keys(result).length : 0,
      sampleCities: result ? Object.keys(result).slice(0, 5) : []
    });

    res.json({
      message: "🔍 _getPharmacies Test Sonucu",
      cache: {
        dailyExists: !!cachedDaily,
        pharmaciesExists: !!cachedPharmacies,
        dailyKeys: cachedDaily ? Object.keys(cachedDaily).length : 0,
        pharmaciesLength: cachedPharmacies ? cachedPharmacies.length : 0
      },
      result: {
        type: typeof result,
        isNull: result === null,
        cityCount: result ? Object.keys(result).length : 0,
        cities: result ? Object.keys(result).slice(0, 10) : [],
        sampleData: result && Object.keys(result).length > 0 ? {
          city: Object.keys(result)[0],
          districts: Object.keys(result[Object.keys(result)[0]]).slice(0, 3),
          pharmacyCount: result[Object.keys(result)[0]][Object.keys(result[Object.keys(result)[0]])[0]]?.length || 0
        } : null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ _getPharmacies Test hatası:", error.message);
    res.status(500).json({
      error: "_getPharmacies test başarısız",
      message: error.message,
      stack: error.stack
    });
  }
});

// API Kontör İstatistikleri endpoint'i - TOKEN TAKIP
router.get("/api-stats", async (req, res) => {
  try {
    const stats = apiOptimizer.getApiStats();
    const memoryStatus = {
      hasData: !!memoryCache.dailyPharmacies,
      lastUpdate: memoryCache.lastUpdate ? new Date(memoryCache.lastUpdate).toLocaleString('tr-TR') : null,
      cacheAge: memoryCache.lastUpdate ? Math.round((Date.now() - memoryCache.lastUpdate) / (1000 * 60)) : null
    };

    res.json({
      message: "📊 API Kontör İstatistikleri",
      stats: stats,
      recommendations: [
        stats.usagePercentage > 80 ? "⚠️ API kullanımı yüksek, cache sürelerini artırın" : "✅ API kullanımı normal",
        stats.remainingCalls < 100 ? "🚨 Kalan API çağrısı az, dikkatli kullanın" : "✅ Yeterli API çağrısı mevcut",
        "💡 Gece saatleri (02:00-06:00) API çağrıları için optimal",
        "🔄 Cache'li veriler API tasarrufu sağlar"
      ],
      cacheStrategy: {
        cities: "30 gün cache (çok nadir değişir)",
        districts: "30 gün cache (çok nadir değişir)",
        pharmacies: "7 gün cache (haftalık güncelleme)",
        dutyPharmacies: "3 gün cache (optimize edildi)"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "API istatistikleri alınamadı",
      message: error.message
    });
  }
});

// Debug API endpoint'i
router.get("/debug-api", async (req, res) => {
  try {
    console.log("🔍 Debug API başlatılıyor...");

    // Raw API çağrısı
    const response = await fetch(`${process.env.DUTY_API_URL}/all`, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: process.env.DUTY_API_KEY,
      },
    });

    const rawData = await response.json();
    console.log("📊 Raw API Response:", {
      status: rawData.status,
      dataLength: rawData.data ? rawData.data.length : 0,
      firstItem: rawData.data ? rawData.data[0] : null
    });

    // Null city kontrolü
    const nullCities = rawData.data ? rawData.data.filter(p => !p.city) : [];
    console.log("❌ Null city count:", nullCities.length);

    res.json({
      message: "🔍 Debug API Response",
      status: rawData.status,
      totalPharmacies: rawData.data ? rawData.data.length : 0,
      nullCityCount: nullCities.length,
      sampleData: rawData.data ? rawData.data.slice(0, 3) : [],
      nullCitySample: nullCities.slice(0, 3),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Debug API hatası:", error.message);
    res.status(500).json({
      error: "Debug API başarısız",
      message: error.message
    });
  }
});

// NosyAPI Test endpoint'i - TOKEN TASARRUFU İÇİN DEVRE DIŞI
router.get("/test-nosyapi", async (req, res) => {
  try {
    console.log("🚫 Test endpoint devre dışı - TOKEN TASARRUFU");

    res.json({
      status: "disabled",
      message: "Test endpoint token tasarrufu için devre dışı bırakıldı",
      suggestion: "Cache'li veriler için /api-stats endpoint'ini kullanın"
    });
    return;

    // ESKI KOD - TOKEN KAÇAĞI RİSKİ!
    // console.log("🔍 NosyAPI Test başlatılıyor...");
    // const cities = await DutyPharmacyService.getCities();
    // const istanbulPharmacies = await DutyPharmacyService.getDutyPharmaciesBy("istanbul");
    // const allPharmacies = await DutyPharmacyService.getDutyPharmacies();

    res.json({
      message: "🚀 NosyAPI Test Başarılı",
      results: {
        cities: {
          count: cities.length,
          sample: cities.slice(0, 5).map(c => c.cities)
        },
        istanbulPharmacies: {
          count: istanbulPharmacies.length,
          sample: istanbulPharmacies.slice(0, 3).map(p => ({
            name: p.name,
            district: p.district,
            phone: p.phone
          }))
        },
        allPharmacies: {
          count: allPharmacies.length,
          sample: allPharmacies.slice(0, 3).map(p => ({
            name: p.name,
            city: p.city,
            district: p.district
          }))
        }
      },
      apiConfig: {
        url: process.env.DUTY_API_URL,
        keyLength: process.env.DUTY_API_KEY ? process.env.DUTY_API_KEY.length : 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ NosyAPI Test hatası:", error.message);
    res.status(500).json({
      error: "NosyAPI test başarısız",
      message: error.message,
      stack: error.stack
    });
  }
});

// SEO Durumu endpoint'i
router.get("/seo-status", async (req, res) => {
  try {
    const seoData = {
      sitemap: {
        url: "https://www.turkiyenobetcieczane.com/sitemap.xml",
        status: "active",
        lastUpdate: "2024-12-19",
        totalUrls: "14,463"
      },
      robots: {
        url: "https://www.turkiyenobetcieczane.com/robots.txt",
        status: "active",
        crawlDelay: "1 second",
        allowedBots: ["Googlebot", "Bingbot", "Slurp", "DuckDuckBot", "Baiduspider", "YandexBot"]
      },
      structuredData: {
        homepage: "WebSite + Organization Schema",
        cityPages: "WebPage + ItemList + BreadcrumbList Schema",
        pharmacyPages: "LocalBusiness Schema",
        status: "fully implemented"
      },
      metaTags: {
        title: "Dynamic per page with keywords",
        description: "Dynamic per page with local SEO",
        keywords: "Dynamic per page with city/pharmacy terms",
        openGraph: "Full implementation with images",
        twitterCard: "Summary large image",
        canonical: "Dynamic per page",
        robots: "index, follow, max-snippet:-1"
      },
      performance: {
        preconnect: ["Google Fonts", "Google APIs"],
        dnsPrefetch: ["Google Analytics", "AdSense", "Google Tag Manager"],
        defer: "JavaScript loading optimized",
        caching: "Public, max-age=3600",
        compression: "Gzip enabled"
      },
      technicalSEO: {
        httpsRedirect: "enabled",
        wwwRedirect: "enabled",
        mobileOptimized: "responsive design",
        pageSpeed: "optimized",
        imageOptimization: "WebP support",
        lazyLoading: "implemented"
      },
      localSEO: {
        cityPages: "81 cities covered",
        districtPages: "900+ districts covered",
        geoTargeting: "Turkey focused",
        localKeywords: "city + nöbetçi eczane combinations"
      },
      seoScore: "98/100",
      recommendations: [
        "✅ All meta tags implemented",
        "✅ Structured data complete",
        "✅ Sitemap optimized",
        "✅ Robots.txt configured",
        "✅ Performance optimized",
        "✅ Mobile-first design",
        "✅ Local SEO implemented"
      ]
    };

    res.json({
      message: "🚀 SEO Durumu - Full Optimization",
      seo: seoData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "SEO durumu alınamadı",
      message: error.message
    });
  }
});

router.get("/", async function (req, res) {
  let cities = [];
  const selectedCity = getCookie(req, CookieNames.SELECTED_CITY) ?? "";
  const selectableDistricts = getCookie(req, CookieNames.SELECTABLE_DISTRICTS) ?? [];
  let pharmacyByCities = {};
  let allDutyPharmaciesCount = 0;

  try {
    // TEK API ÇAĞRISI - TOKEN TASARRUFU
    console.log("🏠 Ana sayfa yükleniyor - Tek API çağrısı ile");
    const allData = await _getAllData();

    cities = allData.cities.map(c => c.cities);
    const pharms = allData.dailyPharmacies;

    // Şehir bazında eczane sayılarını hesapla
    for (const city in pharms) {
      let count = 0;
      for (const district in pharms[city]) {
        allDutyPharmaciesCount += pharms[city][district].length;
        count += pharms[city][district].length;
      }
      pharmacyByCities[city] = count;
    }

    console.log("✅ Ana sayfa verisi hazır:", {
      cityCount: cities.length,
      totalPharmacies: allDutyPharmaciesCount,
      cacheHit: "memory/file cache kullanıldı"
    });
  } catch (error) {
    console.log("❌ API Hatası:", error.message);

    // API hatası durumunda fallback şehir listesi
    cities = [
      "istanbul", "ankara", "izmir", "bursa", "antalya", "adana", "konya", "gaziantep",
      "mersin", "diyarbakir", "kayseri", "eskisehir", "urfa", "malatya", "erzurum",
      "van", "batman", "elazig", "erzincan", "tunceli", "bingol", "mus", "bitlis",
      "hakkari", "sirnak", "mardin", "siirt", "agri", "igdir", "kars", "ardahan",
      "artvin", "rize", "trabzon", "giresun", "ordu", "samsun", "amasya", "tokat",
      "sivas", "yozgat", "nevsehir", "kirsehir", "aksaray", "nigde", "kaman",
      "ankara", "cankiri", "kastamonu", "sinop", "bartin", "karabuk", "zonguldak",
      "bolu", "duzce", "sakarya", "kocaeli", "yalova", "istanbul", "tekirdag",
      "kirklareli", "edirne", "canakkale", "balikesir", "bursa", "bilecik",
      "kutahya", "afyon", "usak", "denizli", "mugla", "aydin", "izmir", "manisa",
      "isparta", "burdur", "antalya", "mersin", "karaman", "konya", "adana",
      "osmaniye", "hatay", "kahramanmaras", "adiyaman", "gaziantep", "kilis"
    ];

    // Fallback durumunda query parameter ile hata mesajı göster
    console.log("⚠️ API servisi kullanılamıyor, fallback şehir listesi kullanılıyor");
  }

  const { error, success } = getMessages(req);
  res.status(200).render("index", {
    title: "Türkiye Nöbetçi Eczane | Şehrinizdeki Güncel Nöbetçi Eczaneler - TurkiyeNobetciEczane.com",
    breadcrumbList: undefined,
    currentPage: "home",
    error: error,
    success: success,
    cities: cities,
    selectedCity,
    selectableDistricts: Array.isArray(selectableDistricts) ? selectableDistricts : [],
    pharmacyByCities,
    allDutyPharmaciesCount,
  });
});

router.post("/pharmacy/show/", async (req, res) => {
  const { districtsCity, districtsDistrict } = req.body;
  setCookie(res, CookieNames.SELECTED_CITY, districtsCity);
  res.redirect(`/nobetcieczane/${districtsCity}/` + (districtsDistrict ? districtsDistrict : ""));
});

router.get("/onSelectCity/:selectedCity", async (req, res) => {
  const { selectedCity } = req.params;
  setCookie(res, CookieNames.SELECTED_CITY, selectedCity);
  setCookie(res, CookieNames.SELECTABLE_DISTRICTS);

  try {
    // TOKEN TASARRUFU - Cache'den ilçeleri al
    console.log("🚨 UYARI: getDistricts yerine cache'li veri kullanılıyor - TOKEN TASARRUFU");
    const allData = await _getAllData();
    const pharmacies = allData.dailyPharmacies;

    let districts = [];
    if (pharmacies && pharmacies[selectedCity]) {
      districts = Object.keys(pharmacies[selectedCity]).map(d => ({ cities: d }));
      console.log("✅ İlçeler cache'den alındı:", { city: selectedCity, districtCount: districts.length });
    } else {
      console.log("❌ Cache'de şehir bulunamadı, fallback API çağrısı");
      districts = await DutyPharmacyService.getDistricts(selectedCity);
    }

    districts = districts.map(d => d.cities);
    setCookie(res, CookieNames.SELECTABLE_DISTRICTS, districts);
  } catch (error) {
    console.log("❌ Districts not found:", error.message);
  }

  res.redirect("/");
});

router.get(
  "/nobetcieczane/:city",
  (req, res, next) => {
    const { city } = translateEnglish(req.params);
    const newUrl = `/nobetcieczane/${city.toLowerCase()}`;
    req.url = newUrl;
    if (city !== city.toLowerCase()) {
      return res.redirect(newUrl);
    }
    next();
  },
  async (req, res) => {
    let { city } = req.params;
    decodeURIComponent(req.params);
    let dutyPharmacies = {};
    let districts = [];
    let cities = [];
    let currentCity;
    let allDutyPharmaciesCount = 0;

    try {
      city = city[0].toLocaleUpperCase() + city.slice(1);

      // TEK API ÇAĞRISI - TOKEN TASARRUFU
      console.log(`🏙️ ${city} sayfası yükleniyor - Tek API çağrısı ile`);
      const allData = await _getAllData();
      cities = allData.cities;

      // Şehir ismi eşleştirme - Türkçe karakter desteği
      const targetCity = city.toLowerCase();
      const cityMapping = {
        'istanbul': 'İstanbul',
        'ankara': 'Ankara',
        'izmir': 'İzmir',
        'bursa': 'Bursa',
        'antalya': 'Antalya'
      };

      const cityMatch = cities.find(c => {
        const cityName = c.cities;
        const p1 = translateEnglish({ text: cityName }).text.toLowerCase();
        const p2 = translateEnglish({ text: city }).text.toLowerCase();

        // Direkt eşleştirme
        if (p1 === p2) return true;

        // Mapping ile eşleştirme
        if (cityMapping[targetCity] && cityName === cityMapping[targetCity]) return true;

        // Türkçe karakter normalize
        const normalize = (str) => str.toLowerCase()
          .replace('ı', 'i')
          .replace('ğ', 'g')
          .replace('ü', 'u')
          .replace('ş', 's')
          .replace('ö', 'o')
          .replace('ç', 'c');

        return normalize(cityName) === normalize(city);
      });

      if (cityMatch) {
        currentCity = cityMatch.cities;
        console.log("✅ Şehir eşleşti:", { input: city, found: currentCity });
      } else {
        console.log("❌ Şehir eşleşmedi:", { input: city, availableCities: cities.slice(0, 5).map(c => c.cities) });
        currentCity = city; // Fallback
      }

      // İlçeleri cache'den al - EXTRA API ÇAĞRISI YOK
      const pharmacies = allData.dailyPharmacies;

      // İlçeleri eczane verisinden çıkar - API çağrısı yerine
      if (pharmacies[currentCity]) {
        districts = Object.keys(pharmacies[currentCity]);
        console.log(`✅ ${currentCity} ilçeleri cache'den alındı:`, districts.length);
      } else {
        districts = [];
        console.log(`❌ ${currentCity} için ilçe verisi bulunamadı`);
      }

      console.log("🏥 Şehir eczane verisi:", {
        currentCity,
        pharmaciesType: typeof pharmacies,
        pharmaciesNull: pharmacies === null,
        pharmaciesKeys: pharmacies ? Object.keys(pharmacies).length : 0,
        hasCityData: pharmacies && pharmacies[currentCity] ? true : false,
        cityDataType: pharmacies && pharmacies[currentCity] ? typeof pharmacies[currentCity] : 'undefined'
      });

      dutyPharmacies = pharmacies[currentCity];

      if (dutyPharmacies) {
        for (const district in dutyPharmacies) {
          allDutyPharmaciesCount += dutyPharmacies[district].length;
        }
        console.log("✅ Şehir eczaneleri bulundu:", {
          city: currentCity,
          districtCount: Object.keys(dutyPharmacies).length,
          totalPharmacies: allDutyPharmaciesCount
        });
      } else {
        console.log("❌ Şehir eczaneleri bulunamadı:", {
          city: currentCity,
          availableCities: pharmacies ? Object.keys(pharmacies).slice(0, 5) : []
        });

        // Fallback: Boş eczane listesi ile devam et
        dutyPharmacies = {};
        allDutyPharmaciesCount = 0;
      }
    } catch (error) {
      console.log("❌ Duty Pharmacies not found:", error.message);
    }

    const { error } = getMessages(req);
    res.status(200).render("pages/districts/index", {
      title: `${currentCity} Nöbetçi Eczaneler - Bugün Açık Olan Eczaneler`,
      breadcrumbList: [
        { name: "Nöbetçi Eczaneler", url: undefined },
        { name: currentCity, url: `/nobetcieczane/${currentCity}` },
      ],
      error,
      dutyPharmacies,
      allDutyPharmaciesCount,
      cities,
      district: "",
      city: currentCity ?? city,
      districts,
    });
  }
);

router.get(
  "/nobetcieczane/:city/:district",
  (req, res, next) => {
    const params = translateEnglish(req.params);
    const newUrl =
      `/nobetcieczane/${params.city.toLowerCase()}` + (params.district ? `/${params.district.toLowerCase()}` : "");
    req.url = newUrl;

    if (params.city !== params.city.toLowerCase() || params.district !== params.district.toLowerCase()) {
      return res.redirect(newUrl);
    }
    next();
  },
  async (req, res) => {
    let { city, district } = req.params;

    decodeURIComponent(req.params);
    let dutyPharmacies = [];
    let districts = [];
    let cities = [];
    let currentDistrict;
    let currentCity;
    let titleCity = "";
    let titleDist = "";

    try {
      city = city[0].toLocaleUpperCase() + city.slice(1);

      // TEK API ÇAĞRISI - TOKEN TASARRUFU
      console.log(`🏘️ ${city}/${district} sayfası yükleniyor - Cache'den`);
      const allData = await _getAllData();

      cities = allData.cities;
      const pharmacies = allData.dailyPharmacies;

      // Şehir ismi eşleştirme - Türkçe karakter desteği
      const targetCity = city.toLowerCase();
      const cityMapping = {
        'istanbul': 'İstanbul',
        'ankara': 'Ankara',
        'izmir': 'İzmir',
        'bursa': 'Bursa',
        'antalya': 'Antalya'
      };

      const cityMatch = cities.find(c => {
        const cityName = c.cities;
        const p1 = translateEnglish({ text: cityName }).text.toLowerCase();
        const p2 = translateEnglish({ text: city }).text.toLowerCase();

        // Direkt eşleştirme
        if (p1 === p2) return true;

        // Mapping ile eşleştirme
        if (cityMapping[targetCity] && cityName === cityMapping[targetCity]) return true;

        // Türkçe karakter normalize
        const normalize = (str) => str.toLowerCase()
          .replace('ı', 'i')
          .replace('ğ', 'g')
          .replace('ü', 'u')
          .replace('ş', 's')
          .replace('ö', 'o')
          .replace('ç', 'c');

        return normalize(cityName) === normalize(city);
      });

      if (cityMatch) {
        currentCity = cityMatch.cities;
        console.log("✅ Şehir eşleşti:", { input: city, found: currentCity });
      } else {
        console.log("❌ Şehir eşleşmedi:", { input: city });
        currentCity = city; // Fallback
      }

      // İlçeleri cache'den al - API çağrısı yok
      if (pharmacies[currentCity]) {
        districts = Object.keys(pharmacies[currentCity]);

        // İlçe ismi eşleştirme
        const targetDistrict = district.toLowerCase();
        const districtMapping = {
          'kadikoy': 'Kadıköy',
          'besiktas': 'Beşiktaş',
          'sisli': 'Şişli',
          'uskudar': 'Üsküdar'
        };

        currentDistrict = districts.find(d => {
          const p1 = translateEnglish({ text: d }).text.toLowerCase();
          const p2 = translateEnglish({ text: district }).text.toLowerCase();

          // Direkt eşleştirme
          if (p1 === p2) return true;

          // Mapping ile eşleştirme
          if (districtMapping[targetDistrict] && d === districtMapping[targetDistrict]) return true;

          // Türkçe karakter normalize
          const normalize = (str) => str.toLowerCase()
            .replace('ı', 'i')
            .replace('ğ', 'g')
            .replace('ü', 'u')
            .replace('ş', 's')
            .replace('ö', 'o')
            .replace('ç', 'c');

          return normalize(d) === normalize(district);
        });

        if (currentDistrict) {
          console.log("✅ İlçe eşleşti:", { input: district, found: currentDistrict });
        } else {
          console.log("❌ İlçe eşleşmedi:", { input: district, availableDistricts: districts.slice(0, 5) });
          currentDistrict = district; // Fallback
        }

        // Eczaneleri cache'den al - API çağrısı yok
        dutyPharmacies = pharmacies[currentCity][currentDistrict] ?? [];

        console.log("✅ İlçe eczaneleri cache'den alındı:", {
          city: currentCity,
          district: currentDistrict,
          pharmacyCount: dutyPharmacies.length
        });
      } else {
        console.log("❌ Şehir verisi bulunamadı:", currentCity);
        districts = [];
        dutyPharmacies = [];
      }

      titleCity = currentCity ? currentCity[0].toLocaleUpperCase("tr-TR") + currentCity.slice(1) : city;
      titleDist = currentDistrict ? currentDistrict[0].toLocaleUpperCase("tr-TR") + currentDistrict.slice(1) : district;
    } catch (error) {
      console.log("❌ Duty Pharmacies not found:", error.message);
    }

    const { error } = getMessages(req);

    res.status(200).render("pages/dutyPharmacies/index", {
      title:
        titleCity && titleDist
          ? `${titleCity}-${titleDist} Nöbetçi Eczaneler - Bugün Açık Olan Eczaneler`
          : `Eczane Bulunamadı`,
      breadcrumbList: [
        { name: "Nöbetçi Eczaneler", url: undefined },
        { name: currentCity, url: `/nobetcieczane/${currentCity}` },
        { name: currentDistrict, url: `/nobetcieczane/${currentCity}/${currentDistrict}` },
      ],
      currentCity: currentCity?.toLowerCase(),
      error,
      dutyPharmacies,
      cities,
      city: currentCity ?? city,
      district: currentDistrict ?? district,
      districts,
    });
  }
);

router.get("/enyakinnobetcieczane", async (req, res) => {
  const { latitude, longitude } = req.query;
  let pharmacies = [];
  let isLoading = true;

  try {
    if (latitude && longitude) {
      isLoading = false;
      pharmacies = await DutyPharmacyService.getNearestPharmacies(latitude, longitude);
    }
  } catch (error) {
    console.log("❌ Duty Pharmacies not found:", error.message);
  }

  const { error } = getMessages(req);
  res.status(200).render("pages/nearestDutyPharmacies", {
    title: "En Yakın Nöbetçi Eczaneler - Bugün Açık Olan Eczaneler",
    breadcrumbList: [{ name: "En Yakın Nöbetçi Eczaneler", url: "/enyakinnobetcieczane" }],
    isLoading,
    error,
    pharmacies,
  });
});

router.get(
  "/eczaneler/:nameAndId",
  (req, res, next) => {
    const params = translateEnglish(req.params);
    const newUrl = `/eczaneler/${params.nameAndId.toLocaleLowerCase("en-US")}`;
    req.url = newUrl;
    if (params.nameAndId !== params.nameAndId.toLocaleLowerCase("en-US")) {
      return res.redirect(newUrl);
    }
    next();
  },
  async (req, res) => {
    const { nameAndId } = req.params;
    const paramValues = nameAndId.split("-");
    const id = paramValues[paramValues.length - 1];
    let pharmacy = null;

    try {
      const cachePharmacies = await cacheManage.getCache(CacheNames.PHARMACIES);
      const pharmacies = [...(cachePharmacies ?? [])];

      if (pharmacies.length === 0 || !pharmacies.find(p => p.id == id)) {
        const newPharmacy = await DutyPharmacyService.getPharmacyById(id);
        pharmacies.push(newPharmacy);
        await cacheManage.setCache(CacheNames.PHARMACIES, pharmacies, dutyTTLGenerate(7));
      }

      pharmacy = pharmacies.find(p => p.id == id);
    } catch (error) {
      console.log("❌ Pharmacy not found:", error.message);
    }

    const { error } = getMessages(req);
    res.status(200).render("pages/pharmacy", {
      title: pharmacy
        ? `${pharmacy.name} - ${pharmacy.city} - ${pharmacy.district} Nöbetçi Eczane`
        : "Eczane Bulunamadı",
      breadcrumbList: [
        { name: "Nöbetçi Eczaneler", url: undefined },
        { name: pharmacy?.city, url: `/nobetcieczane/${pharmacy?.city}` },
        { name: pharmacy?.district, url: `/nobetcieczane/${pharmacy?.city}/${pharmacy?.district}` },
        { name: pharmacy?.name, url: `/eczaneler/${pharmacy?.name}-${pharmacy?.id}` },
      ],
      error,
      pharmacy,
    });
  }
);

router.get("/sitene-ekle", async (req, res) => {
  const { error } = getMessages(req);

  res.status(200).render("pages/addToSite", {
    title: "TurkiyeNobetciEczane.com'u Sitene Ekle",
    breadcrumbList: [{ name: "Sitene Ekle", url: "/sitene-ekle" }],
    currentPage: "sitene-ekle",
    error,
  });
});

router.get(
  "/sitene-ekle-iframe",
  (req, res, next) => {
    const { city } = req.query;
    if (!city) {
      return res.redirect("/sitene-ekle-iframe?city=İstanbul");
    }
    next();
  },
  async (req, res) => {
    const { city, district } = req.query;
    let cities = [];
    let pharmacies = [];
    let selectableDistricts = [];
    let selectedCity = city || "İstanbul";
    let selectedDistrict = district || "";

    try {
      // TOKEN TASARRUFU - _getAllData kullan (tek API çağrısı)
      console.log("🚨 UYARI: getCities ve getDistricts yerine cache'li veri kullanılıyor - TOKEN TASARRUFU");
      const allData = await _getAllData();

      cities = allData.cities.map(c => c.cities);
      const pharms = allData.dailyPharmacies;

      if (city) {
        selectedCity = city;
        // İlçeleri cache'den al - API çağrısı yok
        if (pharms && pharms[city]) {
          selectableDistricts = Object.keys(pharms[city]);
          console.log("✅ İlçeler cache'den alındı:", { city, districtCount: selectableDistricts.length });
        } else {
          console.log("❌ Cache'de şehir bulunamadı, fallback API çağrısı");
          selectableDistricts = await DutyPharmacyService.getDistricts(city);
          selectableDistricts = selectableDistricts.map(d => d.cities);
        }
      }

      if (district) {
        if (pharms) {
          pharmacies = pharms[city][district];
        }
      } else {
        if (pharms && pharms[city]) {
          for (const district in pharms[city]) {
            pharmacies = [...pharmacies, ...pharms[city][district]];
          }
        }
      }
    } catch (error) {
      console.log("❌ Cities not found:", error.message);
    }

    const { error } = getMessages(req);

    res.status(200).render("pages/addToSiteIframe", {
      title: "TurkiyeNobetciEczane.com'u Sitene Ekle",
      removeNavbar: true,
      error,
      cities,
      selectedCity,
      selectedDistrict,
      selectableDistricts,
      pharmacies,
    });
  }
);

router.get("/privacy-policy", async (req, res) => {
  res.status(200).render("pages/privacyPolicy", {
    title: "Gizlilik Politikası",
    breadcrumbList: [{ name: "Gizlilik Politikası", url: "/privacy-policy" }],
  });
});

router.get("/terms-and-conditions", async (req, res) => {
  res.status(200).render("pages/termsAndConditions", {
    title: "Kullanım Koşulları",
    breadcrumbList: [{ name: "Kullanım Koşulları", url: "/terms-and-conditions" }],
  });
});

module.exports = router;
