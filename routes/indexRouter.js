const { Router } = require("express");
const DutyPharmacyService = require("../services/DutyPharmacyService");
const translateEnglish = require("../utils/translateEnglish");
const { getCookie, CookieName, setCookie, clearCookie, CookieNames } = require("../utils/cookieManage");

const router = Router();

async function _getPharmacies(req, res, city = "", district = "") {
  let cachedPharmacies = {};
  let pharmacyByCities = {};

  try {
    const cities = await DutyPharmacyService.getCities();

    if (!cachedPharmacies || cachedPharmacies.length !== cities.length) {
      if (city) {
        cachedPharmacies = await DutyPharmacyService.getDutyPharmaciesBy(city, district);
      } else {
        cachedPharmacies = await DutyPharmacyService.getDutyPharmacies();
      }

      pharmacyByCities = _getPharmaciesByCities(cachedPharmacies);
    }

    return { cities: cities, pharmacies: cachedPharmacies, pharmacyByCities };
  } catch (error) {
    throw error;
  }
}

function _getPharmaciesByCities(pharmacies) {
  const result = {};
  for (let index = 0; index < pharmacies.length; index++) {
    const pharmacy = pharmacies[index];
    const city = pharmacy.city;
    // const filtered = pharmacies.filter(p => p.city === pharmacies[index].city);
    if (!result[city]) result[city] = [];
    if (!result[city].includes(pharmacy)) result[city].push(pharmacy);
  }

  return result;
}

router.get("/", async function (req, res) {
  let cities = [];
  const selectedCity = getCookie(req, CookieNames.SELECTED_CITY) ?? "";
  const selectableDistricts = getCookie(req, CookieNames.SELECTABLE_DISTRICTS) ?? [];
  let pharmacyByCities = {};

  try {
    const getPharmaciesRes = await _getPharmacies(req, res);

    cities = getPharmaciesRes.cities.map(c => c.cities);
    pharmacyByCities = getPharmaciesRes.pharmacyByCities;
  } catch (error) {
    req.flash("error", "Cities not found");
  }

  const error = req.flash("error");
  const success = req.flash("success");
  res.status(200).render("index", {
    title: "Home",
    error: error,
    success: success,
    cities: cities,
    selectedCity,
    selectableDistricts,
    pharmacyByCities,
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
      // if (districts) setCookie(res, CookieNames.DISTRICTS, { ...cachedDistricts, [selectedCity]: districts });
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
    let { city } = req.params;
    decodeURIComponent(req.params);
    let dutyPharmacies = [];
    let districts = [];
    let cities = [];
    const cachedDistricts = {};

    try {
      city = city[0].toLocaleUpperCase() + city.slice(1);
      const pharmacies = await _getPharmacies(req, res, city);

      dutyPharmacies = pharmacies.pharmacies;

      if (cachedDistricts && cachedDistricts[city]) {
        districts = cachedDistricts[city];
      } else {
        districts = await DutyPharmacyService.getDistricts(city);
        // if (districts) setCookie(res, CookieNames.DISTRICTS, { ...cachedDistricts, [city]: districts });
      }

      cities = await DutyPharmacyService.getCities();
    } catch (error) {
      req.flash("error", "Duty Pharmacies not found");
    }

    const currentCity = cities.find(c => {
      const p1 = translateEnglish({ text: c.cities }).text.toLowerCase();
      const p2 = translateEnglish({ text: city }).text.toLowerCase();
      console.log(p1, p2);

      return p1 === p2;
    }).cities;

    const error = req.flash("error");
    res.status(200).render("pages/dutyPharmacies/index", {
      title: "Duty Pharmacies",
      error,
      dutyPharmacies,
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
      return res.redirect(301, newUrl);
    }
    next();
  },
  async (req, res) => {
    let { city, district = "" } = req.params;

    decodeURIComponent(req.params);
    let dutyPharmacies = [];
    let districts = [];
    let cities = [];
    let currentDistrict;
    const cachedDistricts = {};

    try {
      city = city[0].toLocaleUpperCase() + city.slice(1);
      const pharmacies = await _getPharmacies(req, res, city, district);
      dutyPharmacies = pharmacies.pharmacies;

      if (cachedDistricts && cachedDistricts[city]) {
        districts = cachedDistricts[city];
      } else {
        districts = await DutyPharmacyService.getDistricts(city);
        // if (districts) setCookie(res, CookieNames.DISTRICTS, { ...cachedDistricts, [city]: districts });
      }

      cities = await DutyPharmacyService.getCities();
    } catch (error) {
      req.flash("error", "Duty Pharmacies not found");
    }

    let currentCity;
    const p1 = translateEnglish({ text: city }).text.toLowerCase();
    for (let index = 0; index < cities.length; index++) {
      const element = cities[index].cities;
      const p2 = translateEnglish({ text: element }).text.toLowerCase();

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
      city: currentCity ?? city,
      district: currentDistrict ?? district,
      districts,
    });
  }
);

router.get("/districts/:city", async (req, res) => {
  const { city } = req.params;
  let districts = [];
  const cachedDistricts = {};

  try {
    if (cachedDistricts && cachedDistricts[city]) {
      districts = cachedDistricts[city];
    } else {
      districts = await DutyPharmacyService.getDistricts(city);
      // if (districts) setCookie(res, CookieNames.DISTRICTS, { ...cachedDistricts, [city]: districts });
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
