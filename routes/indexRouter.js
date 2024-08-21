const { Router } = require("express");
const DutyPharmacyService = require("../services/DutyPharmacyService");
const translateEnglish = require("../utils/translateEnglish");
const { getCookie, setCookie, CookieNames } = require("../utils/cookieManage");
const { cacheManage, CacheNames } = require("../utils/cacheManage");
const { dutyTTLGenerate } = require("../utils/dutyTTLGenerate");

const router = Router();

async function _getPharmacyById(id) {
  let cachedPharmacies = await cacheManage.getCache(CacheNames.PHARMACIES);

  try {
    for (const city in cachedPharmacies) {
      const pharmacy = cachedPharmacies[city].find(p => p.id === id);
      if (pharmacy) return pharmacy;
    }

    const pharmacy = await DutyPharmacyService.getPharmacyById(id);

    if (pharmacy) {
      if (!cachedPharmacies) cachedPharmacies = {};
      if (!cachedPharmacies[pharmacy.city]) cachedPharmacies[pharmacy.city] = [];
      cachedPharmacies[pharmacy.city].push(pharmacy);
    }

    cacheManage.setCache(CacheNames.PHARMACIES, cachedPharmacies, dutyTTLGenerate());

    return pharmacy;
  } catch (error) {
    // console.log(error);
    throw error;
  }
}

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
      // console.log("Cached Pharmacies");
    }

    cacheManage.setCache(CacheNames.PHARMACIES, cachedPharmacies, dutyTTLGenerate());

    return cachedPharmacies;
  } catch (error) {
    // console.log(error);
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
      // console.log("Cached Pharmacies");
    }

    cacheManage.setCache(CacheNames.PHARMACIES, cachedPharmacies, dutyTTLGenerate());

    const result = cachedPharmacies[city].filter(p => {
      const p1 = translateEnglish({ text: p.district }).text.trim();
      const p2 = translateEnglish({ text: district }).text.trim();
      return p1 == p2;
    });

    return result;
  } catch (error) {
    // console.log(error);
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
    } else {
      // console.log("Cached Districts");
    }

    cacheManage.setCache(CacheNames.PHARMACY_BY_DISTRICTS, pharmacyByDistricts, dutyTTLGenerate());
  } else {
    if (!pharmacyByCities || Object.keys(pharmacyByCities).length !== cityCount) {
      const countsByCities = await DutyPharmacyService.getDutyPharmaciesCountOnCity();

      for (let index = 0; index < countsByCities.length; index++) {
        const cityDuty = countsByCities[index];

        pharmacyByCities[cityDuty.cities] = cityDuty.dutyPharmacyCount;
      }

      cacheManage.setCache(CacheNames.PHARMACY_BY_CITIES, pharmacyByCities, dutyTTLGenerate());
    } else {
      // console.log("Cached Cities");
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

    districts = districts.map(d => d.cities);
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
      districts = districts.map(d => d.cities);

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

      dutyPharmacies = await _getPharmaciesOnlyDistrict(currentCity, currentDistrict);
      titleCity = currentCity[0].toLocaleUpperCase("tr-TR") + currentCity.slice(1);
      titleDist = currentDistrict[0].toLocaleUpperCase("tr-TR") + currentDistrict.slice(1);
    } catch (error) {
      req.flash("error", "Duty Pharmacies not found");
    }

    const error = req.flash("error");

    res.status(200).render("pages/dutyPharmacies/index", {
      title:
        titleCity && titleDist
          ? `${titleCity}-${titleDist} Nöbetçi Eczaneler - Bugün Açık Olan Eczaneler`
          : `Eczane Bulunamadı`,
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
    req.flash("error", "Duty Pharmacies not found");
  }

  const error = req.flash("error");
  res.status(200).render("pages/nearestDutyPharmacies", {
    title: "En Yakın Nöbetçi Eczaneler - Bugün Açık Olan Eczaneler",
    isLoading,
    error,
    pharmacies,
  });
});

router.get("/eczaneler/:id", async (req, res) => {
  const { id } = req.params;
  let pharmacy = null;

  try {
    pharmacy = await _getPharmacyById(id);
  } catch (error) {
    req.flash("error", "Pharmacy not found");
  }

  const error = req.flash("error");
  res.status(200).render("pages/pharmacy", {
    title: pharmacy ? `${pharmacy.name} - ${pharmacy.city} - ${pharmacy.district} Nöbetçi Eczane` : "Eczane Bulunamadı",
    error,
    pharmacy,
  });
});

module.exports = router;
