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

// GÜNLÜK TEK API ÇAĞRISI SİSTEMİ - SÜPER TOKEN TASARRUFU
let DAILY_STATIC_DATA = null; // Günlük statik veri
let LAST_FETCH_DATE = null; // Son çekme tarihi

const fetchDailyData = async () => {
  try {
    console.log("🌅 GÜNLÜK VERİ ÇEKİMİ BAŞLATIYOR - TEK API ÇAĞRISI");
    const startTime = Date.now();

    // DutyPharmacyService'i import et
    const DutyPharmacyService = require("./services/DutyPharmacyService");

    console.log("📡 API'den günlük veri çekiliyor... (GÜNDE SADECE 1 KEZ)");

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

      // STATİK VERİYE KAYDET - API'YE GİTMEYECEK
      DAILY_STATIC_DATA = {
        dailyPharmacies,
        cities: citiesRes,
        pharmacies: pharmaciesRes,
        fetchTime: new Date(),
        fetchDate: new Date().toDateString()
      };

      LAST_FETCH_DATE = new Date().toDateString();

      const loadTime = Date.now() - startTime;
      console.log(`✅ GÜNLÜK VERİ ÇEKİMİ TAMAMLANDI! (${loadTime}ms)`);
      console.log(`📊 ${Object.keys(dailyPharmacies).length} şehir, ${pharmaciesRes.length} eczane statik veriye kaydedildi`);
      console.log(`🗓️ Sonraki çekim: Yarın sabah 8:00`);

      return DAILY_STATIC_DATA;
    } else {
      console.log("❌ Günlük veri çekimi başarısız - API'den veri alınamadı");
      return null;
    }
  } catch (error) {
    console.error("❌ Günlük veri çekimi hatası:", error.message);
    return null;
  }
};

// STATİK VERİ ALMA FONKSİYONU - API'YE GİTMEZ
const getStaticData = async () => {
  const today = new Date().toDateString();

  // Eğer bugün veri çekilmemişse veya veri yoksa çek
  if (!DAILY_STATIC_DATA || LAST_FETCH_DATE !== today) {
    console.log("🔄 Günlük veri güncelleme gerekiyor...");
    await fetchDailyData();
  }

  if (DAILY_STATIC_DATA) {
    console.log("✅ STATİK VERİDEN SUNULUYOR - 0 TOKEN HARCAMA");
    return DAILY_STATIC_DATA;
  } else {
    console.log("❌ Statik veri mevcut değil");
    return {
      dailyPharmacies: {},
      cities: [],
      pharmacies: []
    };
  }
};

const start = async () => {
  try {
    // Server'ı başlat
    app.listen(PORT, () => {
      console.log(`🚀 Server ${PORT} portunda çalışıyor...`);
    });

    // GÜNLÜK VERİ ÇEKİMİ SİSTEMİ - VERCEL SERVERLESS UYUMLU
    console.log("🌅 Günlük veri çekimi sistemi aktif - SÜPER TOKEN TASARRUFU");
    console.log("📅 İlk veri çekimi: İlk istek geldiğinde");
    console.log("🔄 Sonraki çekimler: Günlük otomatik");

  } catch (error) {
    console.log("❌ Server başlatma hatası:", error);
  }
};

// STATİK VERİ FONKSİYONUNU EXPORT ET
module.exports = { app, getStaticData };

start();
