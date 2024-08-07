const { Router } = require("express");
const DutyPharmacyService = require("../services/DutyPharmacyService");
const translateEnglish = require("../utils/translateEnglish");
const { getCookie, setCookie, CookieNames } = require("../utils/cookieManage");
const { cacheManage, CacheNames } = require("../utils/cacheManage");
const { dutyTTLGenerate } = require("../utils/dutyTTLGenerate");

const router = Router();

async function _getPharmacies(city) {
  let cachedPharmacies = await cacheManage.getCache(CacheNames.PHARMACIES);

  try {
    if (!cachedPharmacies || !cachedPharmacies[city]) {
      const pharmacies = await DutyPharmacyService.getDutyPharmaciesBy(city);

      if (pharmacies) {
        if (!cachedPharmacies) cachedPharmacies = {};
        cachedPharmacies[city] = pharmacies;
      }
    } else {
      console.log("Cached Pharmacies");
    }

    cacheManage.setCache(CacheNames.PHARMACIES, cachedPharmacies, dutyTTLGenerate());

    return cachedPharmacies;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function _getPharmaciesOnlyDistrict(city, district) {
  let cachedPharmacies = await cacheManage.getCache(CacheNames.PHARMACIES);

  try {
    if (
      !cachedPharmacies ||
      !cachedPharmacies[city] ||
      !cachedPharmacies[city].find(p => {
        const p1 = translateEnglish({ text: p.district }).text.toLowerCase();
        const p2 = translateEnglish({ text: district }).text.toLowerCase();
        return p1 === p2;
      })
    ) {
      const pharmacies = await DutyPharmacyService.getDutyPharmaciesBy(city, district);

      if (pharmacies) {
        if (!cachedPharmacies) cachedPharmacies = {};
        if (!cachedPharmacies[city]) cachedPharmacies[city] = [];
        cachedPharmacies[city].push(...pharmacies);
      }
    } else {
      console.log("Cached Pharmacies");
    }

    cacheManage.setCache(CacheNames.PHARMACIES, cachedPharmacies, dutyTTLGenerate());

    const result = cachedPharmacies[city].filter(p => {
      const p1 = translateEnglish({ text: p.district }).text.trim();
      const p2 = translateEnglish({ text: district }).text.trim();
      return p1 == p2;
    });

    return result;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

/**
 * @param {string} city - for districts of city
 */
async function _getPharmaciesByCities(cityCount, city = "") {
  let pharmacyByCities = (await cacheManage.getCache(CacheNames.PHARMACY_BY_CITIES)) ?? {};
  let pharmacyByDistricts = (await cacheManage.getCache(CacheNames.PHARMACY_BY_DISTRICTS)) ?? {};

  if (city) {
    if (!pharmacyByDistricts || !pharmacyByDistricts[city]) {
      const countsByDistricts = await DutyPharmacyService.getDutyPharmaciesCountOnCity(city);

      for (let index = 0; index < countsByDistricts.length; index++) {
        const cityDuty = countsByDistricts[index];

        pharmacyByDistricts[city][cityDuty.cities] = cityDuty.dutyPharmacyCount;
      }
    } else console.log("Cached Districts");

    cacheManage.setCache(CacheNames.PHARMACY_BY_DISTRICTS, pharmacyByDistricts, dutyTTLGenerate());
  } else {
    if (!pharmacyByCities || Object.keys(pharmacyByCities).length !== cityCount) {
      const countsByCities = await DutyPharmacyService.getDutyPharmaciesCountOnCity();

      for (let index = 0; index < countsByCities.length; index++) {
        const cityDuty = countsByCities[index];

        pharmacyByCities[cityDuty.cities] = cityDuty.dutyPharmacyCount;
      }

      cacheManage.setCache(CacheNames.PHARMACY_BY_CITIES, pharmacyByCities, dutyTTLGenerate());
    } else console.log("Cached Cities");
  }

  return { pharmacyByCities, pharmacyByDistricts };
}

router.get("/", async function (req, res) {
  console.log("Index Page");
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
    title: "Türkiye Nöbetçi Eczane | Şehrinizdeki Güncel Nöbetçi Eczaneler - TurkiyeNobetciEczane.com",
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
      return res.redirect(newUrl);
    }
    next();
  },
  async (req, res) => {
    let { city } = req.params;
    decodeURIComponent(req.params);
    let dutyPharmacies = [];
    let districts = [];
    let cities = [];
    let currentCity;

    try {
      city = city[0].toLocaleUpperCase() + city.slice(1);
      cities = await DutyPharmacyService.getCities();
      currentCity = cities.find(c => {
        const p1 = translateEnglish({ text: c.cities }).text.toLowerCase();
        const p2 = translateEnglish({ text: city }).text.toLowerCase();

        return p1 === p2;
      }).cities;

      districts = await DutyPharmacyService.getDistricts(currentCity);

      const pharmacies = await _getPharmacies(currentCity);

      dutyPharmacies = pharmacies[currentCity];
    } catch (error) {
      req.flash("error", "Duty Pharmacies not found");
    }

    const error = req.flash("error");
    res.status(200).render("pages/dutyPharmacies/index", {
      title: `${currentCity} Nöbetçi Eczaneler - Bugün Açık Olan Eczaneler`,
      error,
      dutyPharmacies,
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

    try {
      city = city[0].toLocaleUpperCase() + city.slice(1);
      districts = await DutyPharmacyService.getDistricts(city);
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

      console.log("Current District", currentDistrict);

      dutyPharmacies = await _getPharmaciesOnlyDistrict(currentCity, currentDistrict);
    } catch (error) {
      req.flash("error", "Duty Pharmacies not found");
    }

    const error = req.flash("error");
    const titleDist = currentDistrict[0].toLocaleUpperCase("tr-TR") + currentDistrict.slice(1);

    res.status(200).render("pages/dutyPharmacies/index", {
      title: `${city}-${titleDist} Nöbetçi Eczaneler - Bugün Açık Olan Eczaneler`,
      error,
      dutyPharmacies,
      cities,
      city: currentCity ?? city,
      district: currentDistrict ?? district,
      districts,
    });
  }
);

module.exports = router;
