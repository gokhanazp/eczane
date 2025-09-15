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

// STATİK VERİ YÖNETİMİ utils/staticDataManager.js'te yapılıyor

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

// Export sadece app - getStaticData utils/staticDataManager.js'te

start();
