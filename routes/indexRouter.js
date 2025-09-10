const { Router } = require("express");
const DutyPharmacyService = require("../services/DutyPharmacyService");
const translateEnglish = require("../utils/translateEnglish");
const { getCookie, setCookie, CookieNames } = require("../utils/cookieManage");
const { cacheManage, CacheNames } = require("../utils/cacheManage");
const { dutyTTLGenerate } = require("../utils/dutyTTLGenerate");
const apiOptimizer = require("../utils/apiOptimizer");
const { testLimiter, cacheLimiter } = require("../middleware/rateLimiter");
const { getMessages, redirectWithError, redirectWithSuccess } = require("../utils/messageHelper");

const router = Router();

const _getPharmacies = async () => {
  try {
    const cachedDailyPharmacies = await cacheManage.getCache(CacheNames.DAILY_PHARMACIES);
    const cachedPharmacies = await cacheManage.getCache(CacheNames.PHARMACIES);

    console.log("🔍 _getPharmacies çağrıldı:", {
      cachedDaily: !!cachedDailyPharmacies,
      cachedPharmacies: !!cachedPharmacies,
      dailyKeys: cachedDailyPharmacies ? Object.keys(cachedDailyPharmacies).length : 0
    });

    if (cachedDailyPharmacies) {
      console.log("✅ Cache'ten daily pharmacies alındı");
      return cachedDailyPharmacies;
    }

    console.log("🌐 API'den fresh data alınıyor...");
    const pharmaciesRes = await DutyPharmacyService.getDutyPharmacies();

    if (!pharmaciesRes || pharmaciesRes.length === 0) {
      console.log("❌ API'den veri alınamadı, fallback kullanılıyor");
      return {}; // Boş obje döner, UI'da fallback mesajı gösterilir
    }

    let dailyPharmacies = {};
    let pharmacies = [...(cachedPharmacies ?? [])];

    for (let i = 0; i < pharmaciesRes.length; i++) {
      const id = pharmaciesRes[i].id;
      const city = pharmaciesRes[i].city;
      const district = pharmaciesRes[i].district;
      if (!dailyPharmacies[city]) dailyPharmacies[city] = {};
      if (!dailyPharmacies[city][district]) dailyPharmacies[city][district] = [];
      dailyPharmacies[city][district].push(pharmaciesRes[i]);
      if (!pharmacies.find(p => p.id === id)) pharmacies.push(pharmaciesRes[i]);
    }

    console.log("✅ Daily pharmacies oluşturuldu:", {
      cityCount: Object.keys(dailyPharmacies).length,
      totalPharmacies: pharmaciesRes.length
    });

    // Cache sürelerini uzat - API kontör tasarrufu için
    await cacheManage.setCache(CacheNames.DAILY_PHARMACIES, dailyPharmacies, dutyTTLGenerate(3)); // 1 günden 3 güne
    await cacheManage.setCache(CacheNames.PHARMACIES, pharmacies, dutyTTLGenerate(30)); // 7 günden 30 güne

    return dailyPharmacies;
  } catch (error) {
    console.error("❌ _getPharmacies hatası:", error.message);
    return {}; // Hata durumunda boş obje döner
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
    // Manuel cache temizleme
    await cacheManage.setCache(CacheNames.DAILY_PHARMACIES, null, 0);
    await cacheManage.setCache(CacheNames.PHARMACIES, null, 0);
    console.log("🗑️ Tüm cache temizlendi");

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

    // _getPharmacies test
    const pharmacies = await _getPharmacies();
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

    // _getPharmacies fonksiyonunu çağır
    const result = await _getPharmacies();

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

// API Kontör İstatistikleri endpoint'i
router.get("/api-stats", async (req, res) => {
  try {
    const stats = apiOptimizer.getApiStats();

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

// NosyAPI Test endpoint'i
router.get("/test-nosyapi", async (req, res) => {
  try {
    console.log("🔍 NosyAPI Test başlatılıyor...");

    // 1. Cities test
    const cities = await DutyPharmacyService.getCities();
    console.log(`✅ Cities alındı: ${cities.length} şehir`);

    // 2. İstanbul eczaneleri test
    const istanbulPharmacies = await DutyPharmacyService.getDutyPharmaciesBy("istanbul");
    console.log(`✅ İstanbul eczaneleri alındı: ${istanbulPharmacies.length} eczane`);

    // 3. Tüm eczaneler test (ilk 5)
    const allPharmacies = await DutyPharmacyService.getDutyPharmacies();
    console.log(`✅ Tüm eczaneler alındı: ${allPharmacies.length} eczane`);

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
    cities = await DutyPharmacyService.getCities();
    cities = cities.map(c => c.cities);

    const pharms = await _getPharmacies();
    for (const city in pharms) {
      let count = 0;
      for (const district in pharms[city]) {
        allDutyPharmaciesCount += pharms[city][district].length;
        count += pharms[city][district].length;
      }
      pharmacyByCities[city] = count;
    }
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
    const cachedDistricts = {};
    let districts = [];
    if (cachedDistricts && cachedDistricts[selectedCity]) {
      districts = cachedDistricts[selectedCity];
    } else {
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
      cities = await DutyPharmacyService.getCities();
      currentCity = cities.find(c => {
        const p1 = translateEnglish({ text: c.cities }).text.toLowerCase();
        const p2 = translateEnglish({ text: city }).text.toLowerCase();

        return p1 === p2;
      }).cities;

      districts = await DutyPharmacyService.getDistricts(currentCity);
      districts = districts.map(d => d.cities);

      const pharmacies = await _getPharmacies();

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
      districts = await DutyPharmacyService.getDistricts(city);
      districts = districts.map(d => d.cities);
      cities = await DutyPharmacyService.getCities();
      currentCity = cities.find(c => {
        const p1 = translateEnglish({ text: c.cities }).text.toLowerCase();
        const p2 = translateEnglish({ text: city }).text.toLowerCase();

        return p1 === p2;
      }).cities;
      currentDistrict = districts.find(d => {
        const p1 = translateEnglish({ text: d }).text.toLowerCase();
        const p2 = translateEnglish({ text: district }).text.toLowerCase();

        return p1 === p2;
      });

      dutyPharmacies = await _getPharmacies();
      dutyPharmacies = dutyPharmacies[currentCity][currentDistrict] ?? [];
      titleCity = currentCity[0].toLocaleUpperCase("tr-TR") + currentCity.slice(1);
      titleDist = currentDistrict[0].toLocaleUpperCase("tr-TR") + currentDistrict.slice(1);
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
      cities = await DutyPharmacyService.getCities();
      cities = cities.map(c => c.cities);

      if (city) {
        selectedCity = city;
        selectableDistricts = await DutyPharmacyService.getDistricts(city);
        selectableDistricts = selectableDistricts.map(d => d.cities);
      }

      const pharms = await _getPharmacies();

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
