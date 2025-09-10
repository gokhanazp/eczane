require("dotenv").config();
const express = require("express");
const expressSession = require("express-session");
const cors = require("cors");
const ejsLayouts = require("express-ejs-layouts");
const path = require("path");
const flash = require("connect-flash");
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
app.set("views", "views");
app.set("view engine", "ejs");
app.use(ejsLayouts);
app.set("layout", "layouts/main");

app.use(flash());
app.use(express.static(path.join(__dirname, "/public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors(corsOptions));
// Environment variables with strong fallbacks
const COOKIE_SECRET = process.env.COOKIE_SECRET || "nöbetçi-eczane-cookie-secret-2024-production-key";
const SESSION_SECRET = process.env.EXPRESS_SESSION_SECRET || "nöbetçi-eczane-session-secret-2024-production-key-vercel-deployment";

// Debug environment variables
console.log("🔑 Environment Check:");
console.log("- NODE_ENV:", process.env.NODE_ENV);
console.log("- COOKIE_SECRET exists:", !!process.env.COOKIE_SECRET);
console.log("- SESSION_SECRET exists:", !!process.env.EXPRESS_SESSION_SECRET);
console.log("- Using COOKIE_SECRET:", COOKIE_SECRET.substring(0, 10) + "...");
console.log("- Using SESSION_SECRET:", SESSION_SECRET.substring(0, 10) + "...");

app.use(cookieParser(COOKIE_SECRET));

// Session middleware with error handling
try {
  app.use(
    expressSession({
      resave: false,
      saveUninitialized: false,
      secret: SESSION_SECRET,
      cookie: {
        secure: false, // HTTP için false (Vercel HTTPS otomatik handle eder)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 saat
      }
    })
  );
  console.log("✅ Session middleware başarıyla yüklendi");
} catch (error) {
  console.error("❌ Session middleware hatası:", error.message);
  // Session olmadan devam et
}

app.use("/", indexRouter);
app.use("*", (req, res) => {
  res.status(404).render("error", {
    title: "404 - Sayfa Bulunamadı",
  });
});

const start = () => {
  try {
    app.listen(PORT, () => {
      console.log("server running...");
    });
  } catch (error) {
    console.log(error);
  }
};

start();
