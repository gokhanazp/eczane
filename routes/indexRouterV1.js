const { Router } = require("express");
const DutyPharmacyService = require("../services/DutyPharmacyService");
const translateEnglish = require("../utils/translateEnglish");
const { getCookie, CookieName, setCookie, clearCookie, CookieNames } = require("../utils/cookieManage");

const router = Router();

async function _getPharmacies(req, res) {
  let cachedPharmacies = getCookie(req, CookieNames.PHARMACIES) ?? {};
  let cachedDistricts = getCookie(req, CookieNames.DISTRICTS) ?? {};

  try {
    const cities = await DutyPharmacyService.getCities();

    if (!cachedPharmacies || cachedPharmacies.length !== cities.length) {
      const dutyPharmacies = await DutyPharmacyService.getDutyPharmacies();

      for (let index = 0; index < cities.length; index++) {
        const city = cities[index];
        if (cachedPharmacies[city]) continue;

        const dutyPharmaciesByCity = dutyPharmacies.filter(
          pharmacy => translateEnglish(pharmacy.city).toLowerCase() === translateEnglish(city).toLowerCase()
        );
        cachedPharmacies = setCookie(res, CookieNames.PHARMACIES, {
          ...cachedPharmacies,
          [city]: dutyPharmaciesByCity,
        });

        if (cachedDistricts && cachedDistricts[city]) continue;
        else {
          const districts = await DutyPharmacyService.getDistricts(city);
          if (districts) {
            cachedDistricts = setCookie(res, CookieNames.DISTRICTS, { ...cachedDistricts, [city]: districts });
          }
        }
      }
    }

    return { cities, pharmacies: cachedPharmacies, districts: cachedDistricts };
  } catch (error) {
    throw error;
  }
}

function _getPharmaciesByCities(pharmacies) {
  const result = {};
  for (let index = 0; index < pharmacies.length; index++) {
    const pharmacy = pharmacies[index];
    const city = translateEnglish(pharmacy.city);
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
    const { newCities = cities, pharmacies } = await _getPharmacies(req, res);

    cities = newCities;
    pharmacyByCities = _getPharmaciesByCities(pharmacies);
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
    const cachedDistricts = getCookie(req, CookieNames.DISTRICTS);
    let districts = [];
    if (cachedDistricts && cachedDistricts[selectedCity]) {
      districts = cachedDistricts[selectedCity];
    } else {
      const districts = await DutyPharmacyService.getDistricts(selectedCity);
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

    try {
      const { pharmacies } = await _getPharmacies(req, res);
      dutyPharmacies = pharmacies[city];

      if (cachedDistricts && cachedDistricts[city]) {
        districts = cachedDistricts[city];
      } else {
        districts = await DutyPharmacyService.getDistricts(city);
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

    try {
      const { pharmacies } = await _getPharmacies(req, res);
      dutyPharmacies = pharmacies[city];

      if (cachedDistricts && cachedDistricts[city]) {
        districts = cachedDistricts[city];
      } else {
        districts = await DutyPharmacyService.getDistricts(city);
        if (districts) setCookie(res, CookieNames.DISTRICTS, { ...cachedDistricts, [city]: districts });
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
      districts = await DutyPharmacyService.getDistricts(city);
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
