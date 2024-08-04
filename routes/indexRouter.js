const { Router } = require("express");
const DutyPharmacyService = require("../services/DutyPharmacyService");
const translateEnglish = require("../utils/translateEnglish");
const { getCookie, setCookie, CookieNames } = require("../utils/cookieManage");
const { cacheManage, CacheNames } = require("../utils/cacheManage");
const { dutyTTLGenerate } = require("../utils/dutyTTLGenerate");

const router = Router();

async function _getPharmacies(city, district = "") {
  let cachedPharmacies = await cacheManage.getCache(CacheNames.PHARMACIES);

  try {
    const cities = await DutyPharmacyService.getCities();

    if (!cachedPharmacies || cachedPharmacies.length !== cities.length) {
      if (city) {
        cachedPharmacies = await DutyPharmacyService.getDutyPharmaciesBy(city, district);
      } else {
        cachedPharmacies = await DutyPharmacyService.getDutyPharmacies();
      }
    }

    return { cities: cities, pharmacies: cachedPharmacies };
  } catch (error) {
    throw error;
  }
}

/**
 * @param {string} city - for districts of city
 */
async function _getPharmaciesByCities(cityCount, city = "") {
  let pharmacyByCities = (await cacheManage.getCache(CacheNames.PHARMACY_BY_CITIES)) ?? {};
  let pharmacyByDistricts = (await cacheManage.getCache(CacheNames.PHARMACY_BY_DISTRICTS)) ?? {};
  const ttl = dutyTTLGenerate();

  if (city) {
    if (!pharmacyByDistricts || !pharmacyByDistricts[city]) {
      const countsByDistricts = await DutyPharmacyService.getDutyPharmaciesCountOnCity(city);

      for (let index = 0; index < countsByDistricts.length; index++) {
        const cityDuty = countsByDistricts[index];

        pharmacyByDistricts[city][cityDuty.cities] = cityDuty.dutyPharmacyCount;
      }
    }

    await cacheManage.setCache(CacheNames.PHARMACY_BY_DISTRICTS, pharmacyByDistricts, ttl);
  } else {
    if (!pharmacyByCities || Object.keys(pharmacyByCities).length !== cityCount) {
      const countsByCities = await DutyPharmacyService.getDutyPharmaciesCountOnCity();

      for (let index = 0; index < countsByCities.length; index++) {
        const cityDuty = countsByCities[index];

        pharmacyByCities[cityDuty.cities] = cityDuty.dutyPharmacyCount;
      }

      await cacheManage.setCache(CacheNames.PHARMACY_BY_CITIES, pharmacyByCities, ttl);
    }
  }

  return { pharmacyByCities, pharmacyByDistricts };
}

router.get("/", async function (req, res) {
  let cities = [];
  const selectedCity = getCookie(req, CookieNames.SELECTED_CITY) ?? "";
  const selectableDistricts = getCookie(req, CookieNames.SELECTABLE_DISTRICTS) ?? [];
  let pharmacyByCities = {};
  let allDutyPharmaciesCount = 0;

  try {
    cities = await DutyPharmacyService.getCities();
    cities = cities.map(c => c.cities);

    const dutyCountRes = await _getPharmaciesByCities(cities.length);

    pharmacyByCities = dutyCountRes.pharmacyByCities;
    for (const city in pharmacyByCities) {
      allDutyPharmaciesCount += pharmacyByCities[city];
    }
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

    try {
      city = city[0].toLocaleUpperCase() + city.slice(1);

      districts = await DutyPharmacyService.getDistricts(city);
      cities = await DutyPharmacyService.getCities();

      const pharmacies = await _getPharmacies(city);

      dutyPharmacies = pharmacies.pharmacies;
    } catch (error) {
      req.flash("error", "Duty Pharmacies not found");
    }

    const currentCity = cities.find(c => {
      const p1 = translateEnglish({ text: c.cities }).text.toLowerCase();
      const p2 = translateEnglish({ text: city }).text.toLowerCase();

      return p1 === p2;
    }).cities;

    const error = req.flash("error");
    res.status(200).render("pages/dutyPharmacies/index", {
      title: `${city} Nöbetçi Eczaneler - Bugün Açık Olan Eczaneler`,
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
      const pharmacies = await _getPharmacies(city, district);
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
    const titleDist = district[0].toLocaleUpperCase("tr-TR") + district.slice(1);
    res.status(200).render("pages/dutyPharmacies/index", {
      title: `${city}-${titleDist} Nöbetçi Eczaneler - Bugün Açık Olan Eczaneler`,
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
