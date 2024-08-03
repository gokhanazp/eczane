require("dotenv").config();
const express = require("express");
const expressSession = require("express-session");
const cors = require("cors");
const ejsLayouts = require("express-ejs-layouts");
const path = require("path");
const flash = require("connect-flash");
const cookieParser = require("cookie-parser");
const indexRouter = require("./routes/indexRouter");

const PORT = 3000;
const corsOptions = {
  origin: "localhost",
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
app.use(cookieParser());
app.use(
  expressSession({
    resave: false,
    saveUninitialized: false,
    secret: process.env.EXPRESS_SESSION_SECRET,
  })
);

app.use("/", indexRouter);

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
