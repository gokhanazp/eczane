require("dotenv").config();
const express = require("express");
const cors = require("cors");
const ejsLayouts = require("express-ejs-layouts");
const path = require("path");
const cookieParser = require("cookie-parser");
const indexRouter = require("./routes/indexRouter");

const PORT = process.env.PORT || 8888;
const corsOptions = {
  origin: [
    "http://localhost:8888",
    "https://turkiyenobetcieczane.com",
    /\.vercel\.app$/
  ],
  methods: "GET",
  preflightContinue: false,
};

const app = express();

// Views directory için multiple path denemeleri (Vercel uyumlu)
const viewsPaths = [
  path.join(__dirname, "views"),
  path.join(process.cwd(), "views"),
  "./views",
  "views"
];

let viewsPath = viewsPaths[0];
for (const testPath of viewsPaths) {
  try {
    const fs = require('fs');
    if (fs.existsSync(testPath)) {
      viewsPath = testPath;
      console.log(`✅ Views directory bulundu: ${viewsPath}`);
      break;
    }
  } catch (e) {
    console.log(`❌ Views path test edildi: ${testPath}`);
  }
}

app.set("views", viewsPath);
app.set("view engine", "ejs");
console.log(`🎯 Views path set edildi: ${viewsPath}`);
app.use(ejsLayouts);
app.set("layout", "layouts/main");

app.use(express.static(path.join(__dirname, "/public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors(corsOptions));

// Simple cookie parser without secret (Vercel uyumlu)
app.use(cookieParser());

console.log("✅ Middleware yüklendi (Session ve Flash kaldırıldı)");

app.use("/", indexRouter);
app.use("*", (req, res) => {
  res.status(404).render("error", {
    title: "404 - Sayfa Bulunamadı",
  });
});

// Startup cache preloading
const preloadCache = async () => {
  try {
    console.log("🚀 Startup cache preloading başlatılıyor...");
    const startTime = Date.now();

    // DutyPharmacyService'i import et
    const DutyPharmacyService = require("./services/DutyPharmacyService");
    const { cacheManage, CacheNames } = require("./utils/cacheManage");
    const { dutyTTLGenerate } = require("./utils/dutyTTLGenerate");

    // Cache kontrolü
    const cachedData = await cacheManage.getCache(CacheNames.DAILY_PHARMACIES);

    if (cachedData) {
      console.log("✅ Cache zaten mevcut, preload gerekmiyor");
      return;
    }

    console.log("📡 API'den veri preload ediliyor... (TEK SEFERLIK TOKEN KULLANIMI)");

    // TEK API ÇAĞRISI - PARALEL
    const [pharmaciesRes, citiesRes] = await Promise.all([
      DutyPharmacyService.getDutyPharmacies(),
      DutyPharmacyService.getCities()
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

      // Cache'e kaydet - SÜPER UZUN CACHE
      await Promise.all([
        cacheManage.setCache(CacheNames.DAILY_PHARMACIES, dailyPharmacies, dutyTTLGenerate(7)), // 7 gün
        cacheManage.setCache(CacheNames.PHARMACIES, pharmaciesRes, dutyTTLGenerate(30)), // 30 gün
        cacheManage.setCache("cities_cache", citiesRes, dutyTTLGenerate(90)) // 90 gün
      ]);

      const loadTime = Date.now() - startTime;
      console.log(`✅ Startup cache preload tamamlandı! (${loadTime}ms)`);
      console.log(`📊 ${Object.keys(dailyPharmacies).length} şehir, ${pharmaciesRes.length} eczane yüklendi`);
    } else {
      console.log("❌ Startup preload başarısız - API'den veri alınamadı");
    }
  } catch (error) {
    console.error("❌ Startup cache preload hatası:", error.message);
  }
};

const start = async () => {
  try {
    // Server'ı başlat
    app.listen(PORT, () => {
      console.log(`🚀 Server ${PORT} portunda çalışıyor...`);
    });

    // Hemen cache preload et (daha hızlı)
    preloadCache(); // Hemen başlat, setTimeout yok

  } catch (error) {
    console.log("❌ Server başlatma hatası:", error);
  }
};

start();
