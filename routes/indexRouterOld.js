const { Router } = require("express");
const DutyPharmacyService = require("../services/DutyPharmacyService");
const DutyPharmacyRenderController = require("../controllers/DutyPharmacyRenderController");
const translateEnglish = require("../utils/translateEnglish");
const { getCookie, CookieNames, setCookie, clearCookie } = require("../utils/cookieManage");

const router = Router();

router.get("/", async function (req, res) {
  var cities = [];
  const selectedCity = getCookie(req, CookieNames.SELECTED_CITY) ?? "";
  const selectableDistricts = getCookie(req, CookieNames.SELECTABLE_DISTRICTS) ?? [];
  let cachedPharmacies = getCookie(req, CookieNames.PHARMACIES) ?? {};

  try {
    const citiesJson = await DutyPharmacyService.getCities();
    cities = citiesJson.result ?? [];

    if (cachedPharmacies && cachedPharmacies.length === cities.length) {
      cities.forEach((city, index) => {
        city.dutyPharmacies = cachedPharmacies[index];
      });
    } else {
      for (let index = 0; index < cities.length; index++) {
        const city = cities[index];
        if (!cachedPharmacies || !cachedPharmacies[city.text]) {
          const dutyPharmaciesJson = await DutyPharmacyService.getDutyPharmacies(city.text);
          const dutyPharmacies = dutyPharmaciesJson.result ?? [];

          cachedPharmacies = setCookie(res, CookieNames.PHARMACIES, {
            ...cachedPharmacies,
            [city.text]: dutyPharmacies,
          });
        }
      }
    }
  } catch (error) {
    req.flash("error", "Cities not found");
  }

  const pharmacyCountByCity = cities.map(city => {
    return {
      city: city.text,
      count: cachedPharmacies[city.text]?.length ?? 0,
    };
  });

  const error = req.flash("error");
  const success = req.flash("success");
  res.status(200).render("index", {
    title: "Home",
    cities: cities,
    error: error,
    success: success,
    selectedCity,
    selectableDistricts,
    pharmacyCountByCity,
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
    const cachedDistricts = getCookie(req, CookieNames.DISTRICTS);
    let districts = [];
    if (cachedDistricts && cachedDistricts[selectedCity]) {
      districts = cachedDistricts[selectedCity];
    } else {
      const districtsJSON = await DutyPharmacyService.getDistricts(selectedCity);
      districts = districtsJSON.result ?? [];
      if (districts) setCookie(res, CookieNames.DISTRICTS, { ...cachedDistricts, [selectedCity]: districts });
    }

    setCookie(res, CookieNames.SELECTABLE_DISTRICTS, districts);
  } catch (error) {
    req.flash("error", "Districts not found");
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
      return res.redirect(301, newUrl);
    }
    next();
  },
  async (req, res) => {
    const { city } = req.params;
    decodeURIComponent(req.params);
    let dutyPharmacies = [];
    let districts = [];
    let cities = { result: [] };
    const cachedDistricts = getCookie(req, CookieNames.DISTRICTS);
    const cachedPharmacies = getCookie(req, CookieNames.PHARMACIES);

    try {
      if (cachedPharmacies && cachedPharmacies[city]) {
        dutyPharmacies = cachedPharmacies[city];
      } else {
        const dutyPharmaciesJson = await DutyPharmacyService.getDutyPharmacies(city);
        dutyPharmacies = dutyPharmaciesJson.result ?? [];
        if (dutyPharmacies) setCookie(res, CookieNames.PHARMACIES, { ...cachedPharmacies, [city]: dutyPharmacies });
      }

      if (cachedDistricts && cachedDistricts[city]) {
        districts = cachedDistricts[city];
      } else {
        const districtsJson = await DutyPharmacyService.getDistricts(city);
        districts = districtsJson.result ?? [];
        if (districts) setCookie(res, CookieNames.DISTRICTS, { ...cachedDistricts, [city]: districts });
      }

      cities = await DutyPharmacyService.getCities();
    } catch (error) {
      req.flash("error", "Duty Pharmacies not found");
    }

    const currentCity = cities.result.find(c => {
      const p1 = translateEnglish({ text: c.text }).text.toLowerCase();
      const p2 = translateEnglish({ text: city }).text.toLowerCase();
      return p1 === p2;
    });

    const error = req.flash("error");
    res.status(200).render("pages/dutyPharmacies/index", {
      title: "Duty Pharmacies",
      error,
      dutyPharmacies,
      district: "",
      city: currentCity?.text ?? city,
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
      return res.redirect(301, newUrl);
    }
    next();
  },
  async (req, res) => {
    const { city, district = "" } = req.params;

    decodeURIComponent(req.params);
    let dutyPharmacies = [];
    let districts = [];
    let cities = { result: [] };
    let currentDistrict;
    const cachedDistricts = getCookie(req, CookieNames.DISTRICTS);
    const cachedPharmacies = getCookie(req, CookieNames.PHARMACIES);

    try {
      if (cachedDistricts && cachedDistricts[city]) {
        districts = cachedDistricts[city];
      } else {
        const districtsJson = await DutyPharmacyService.getDistricts(city);
        districts = districtsJson.result ?? [];
        if (districts) setCookie(res, CookieNames.DISTRICTS, { ...cachedDistricts, [city]: districts });
      }

      const p3 = translateEnglish({ text: district }).text.toLowerCase();
      for (let index = 0; index < districts.length; index++) {
        const element = districts[index];
        const p4 = translateEnglish({ text: element.text }).text.toLowerCase();

        if (p3 === p4) {
          currentDistrict = element.text;
          break;
        }
      }

      if (cachedPharmacies && cachedPharmacies[city]) {
        dutyPharmacies = cachedPharmacies[city];
      } else {
        const dutyPharmaciesJson = await DutyPharmacyService.getDutyPharmacies(city, currentDistrict);
        dutyPharmacies = dutyPharmaciesJson.result ?? [];
        if (dutyPharmacies) setCookie(res, CookieNames.PHARMACIES, { ...cachedPharmacies, [city]: dutyPharmacies });
      }

      cities = await DutyPharmacyService.getCities();
    } catch (error) {
      req.flash("error", "Duty Pharmacies not found");
    }

    let currentCity;
    const p1 = translateEnglish({ text: city }).text.toLowerCase();
    for (let index = 0; index < cities.result.length; index++) {
      const element = cities.result[index];
      const p2 = translateEnglish({ text: element.text }).text.toLowerCase();

      if (p1 === p2) {
        currentCity = element;
        break;
      }
    }

    const error = req.flash("error");
    res.status(200).render("pages/dutyPharmacies/index", {
      title: "Duty Pharmacies",
      error,
      dutyPharmacies,
      city: currentCity?.text ?? city,
      district: currentDistrict ?? district,
      districts,
    });
  }
);

router.get("/districts/:city", async (req, res) => {
  const { city } = req.params;
  let districts = [];
  const cachedDistricts = getCookie(req, CookieNames.DISTRICTS);

  try {
    if (cachedDistricts && cachedDistricts[city]) {
      districts = cachedDistricts[city];
    } else {
      const districtsJson = await DutyPharmacyService.getDistricts(city);
      districts = districtsJson.result;
      if (districts) setCookie(res, CookieNames.DISTRICTS, { ...cachedDistricts, [city]: districts });
    }
  } catch (error) {
    req.flash("error", "Districts not found");
  }

  const error = req.flash("error");
  res.status(200).render("pages/districts/index", {
    title: "Districts",
    error,
    districts,
    city,
  });
});

module.exports = router;
