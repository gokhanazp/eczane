const { Router } = require("express");
const DutyPharmacyService = require("../services/DutyPharmacyService");
const translateEnglish = require("../utils/translateEnglish");
const { getCookie, setCookie, CookieNames } = require("../utils/cookieManage");
const { cacheManage, CacheNames } = require("../utils/cacheManage");
const { dutyTTLGenerate, dutyTTLGenerateWeekly } = require("../utils/dutyTTLGenerate");

const router = Router();

const _getPharmacies = async () => {
  const cachedDailyPharmacies = await cacheManage.getCache(CacheNames.DAILY_PHARMACIES);
  const cachedPharmacies = await cacheManage.getCache(CacheNames.PHARMACIES);
  if (cachedDailyPharmacies) return cachedDailyPharmacies;

  const pharmaciesRes = await DutyPharmacyService.getDutyPharmacies();
  let dailyPharmacies = {};
  let pharmacies = [...(cachedPharmacies ?? [])];

  for (let i = 0; i < pharmaciesRes.length; i++) {
    const id = pharmaciesRes[i].id;
    const city = pharmaciesRes[i].city;
    const district = pharmaciesRes[i].district;
    if (!dailyPharmacies[city]) dailyPharmacies[city] = {};
    if (!dailyPharmacies[city][district]) dailyPharmacies[city][district] = [];
    dailyPharmacies[city][district].push(pharmaciesRes[i]);
    if (!pharmacies.find(p => p.id === id)) pharmacies.push(pharmaciesRes[i]);
  }

  await cacheManage.setCache(CacheNames.DAILY_PHARMACIES, dailyPharmacies, dutyTTLGenerate(1));
  await cacheManage.setCache(CacheNames.PHARMACIES, pharmacies, dutyTTLGenerate(7));

  return dailyPharmacies;
};

router.get("/", async function (req, res) {
  let cities = [];
  const selectedCity = getCookie(req, CookieNames.SELECTED_CITY) ?? "";
  const selectableDistricts = getCookie(req, CookieNames.SELECTABLE_DISTRICTS) ?? [];
  let pharmacyByCities = {};
  let allDutyPharmaciesCount = 0;

  try {
    cities = await DutyPharmacyService.getCities();
    cities = cities.map(c => c.cities);

    const pharms = await _getPharmacies();
    for (const city in pharms) {
      let count = 0;
      for (const district in pharms[city]) {
        allDutyPharmaciesCount += pharms[city][district].length;
        count += pharms[city][district].length;
      }
      pharmacyByCities[city] = count;
    }
  } catch (error) {
    req.flash("error", "Cities not found");
  }

  const error = req.flash("error");
  const success = req.flash("success");
  res.status(200).render("index", {
    title: "Türkiye Nöbetçi Eczane | Şehrinizdeki Güncel Nöbetçi Eczaneler - TurkiyeNobetciEczane.com",
    breadcrumbList: undefined,
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
    let dutyPharmacies = {};
    let districts = [];
    let cities = [];
    let currentCity;
    let allDutyPharmaciesCount = 0;

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

      const pharmacies = await _getPharmacies();

      dutyPharmacies = pharmacies[currentCity];
      for (const district in dutyPharmacies) {
        allDutyPharmaciesCount += dutyPharmacies[district].length;
      }
    } catch (error) {
      req.flash("error", "Duty Pharmacies not found");
    }

    const error = req.flash("error");
    res.status(200).render("pages/districts/index", {
      title: `${currentCity} Nöbetçi Eczaneler - Bugün Açık Olan Eczaneler`,
      breadcrumbList: [
        { name: "Nöbetçi Eczaneler", url: undefined },
        { name: currentCity, url: `/nobetcieczane/${currentCity}` },
      ],
      error,
      dutyPharmacies,
      allDutyPharmaciesCount,
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

      dutyPharmacies = await _getPharmacies();
      dutyPharmacies = dutyPharmacies[currentCity][currentDistrict] ?? [];
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
      breadcrumbList: [
        { name: "Nöbetçi Eczaneler", url: undefined },
        { name: currentCity, url: `/nobetcieczane/${currentCity}` },
        { name: currentDistrict, url: `/nobetcieczane/${currentCity}/${currentDistrict}` },
      ],
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
    breadcrumbList: [{ name: "En Yakın Nöbetçi Eczaneler", url: "/enyakinnobetcieczane" }],
    isLoading,
    error,
    pharmacies,
  });
});

router.get(
  "/eczaneler/:nameAndId",
  (req, res, next) => {
    const params = translateEnglish(req.params);
    const newUrl = `/eczaneler/${params.nameAndId.toLocaleLowerCase("en-US")}`;
    req.url = newUrl;
    if (params.nameAndId !== params.nameAndId.toLocaleLowerCase("en-US")) {
      return res.redirect(newUrl);
    }
    next();
  },
  async (req, res) => {
    const { nameAndId } = req.params;
    const paramValues = nameAndId.split("-");
    const id = paramValues[paramValues.length - 1];
    let pharmacy = null;

    try {
      const cachePharmacies = await cacheManage.getCache(CacheNames.PHARMACIES);
      const pharmacies = [...(cachePharmacies ?? [])];

      if (pharmacies.length === 0 || !pharmacies.find(p => p.id == id)) {
        const newPharmacy = await DutyPharmacyService.getPharmacyById(id);
        pharmacies.push(newPharmacy);
        await cacheManage.setCache(CacheNames.PHARMACIES, pharmacies, dutyTTLGenerate(7));
      }

      pharmacy = pharmacies.find(p => p.id == id);
    } catch (error) {
      req.flash("error", "Pharmacy not found");
    }

    const error = req.flash("error");
    res.status(200).render("pages/pharmacy", {
      title: pharmacy
        ? `${pharmacy.name} - ${pharmacy.city} - ${pharmacy.district} Nöbetçi Eczane`
        : "Eczane Bulunamadı",
      breadcrumbList: [
        { name: "Nöbetçi Eczaneler", url: undefined },
        { name: pharmacy?.city, url: `/nobetcieczane/${pharmacy?.city}` },
        { name: pharmacy?.district, url: `/nobetcieczane/${pharmacy?.city}/${pharmacy?.district}` },
        { name: pharmacy?.name, url: `/eczaneler/${pharmacy?.name}-${pharmacy?.id}` },
      ],
      error,
      pharmacy,
    });
  }
);

router.get("/sitene-ekle", async (req, res) => {
  const error = req.flash("error");

  res.status(200).render("pages/addToSite", {
    title: "TurkiyeNobetciEczane.com'u Sitene Ekle",
    breadcrumbList: [{ name: "Sitene Ekle", url: "/sitene-ekle" }],
    error,
  });
});

router.get(
  "/sitene-ekle-iframe",
  (req, res, next) => {
    const { city } = req.query;
    if (!city) {
      return res.redirect("/sitene-ekle-iframe?city=İstanbul");
    }
    next();
  },
  async (req, res) => {
    const { city, district } = req.query;
    let cities = [];
    let pharmacies = [];
    let selectableDistricts = [];
    let selectedCity = city || "İstanbul";
    let selectedDistrict = district || "";

    try {
      cities = await DutyPharmacyService.getCities();
      cities = cities.map(c => c.cities);

      if (city) {
        selectedCity = city;
        selectableDistricts = await DutyPharmacyService.getDistricts(city);
        selectableDistricts = selectableDistricts.map(d => d.cities);
      }

      const pharms = await _getPharmacies();

      if (district) {
        if (pharms) {
          pharmacies = pharms[city][district];
        }
      } else {
        if (pharms && pharms[city]) {
          for (const district in pharms[city]) {
            pharmacies = [...pharmacies, ...pharms[city][district]];
          }
        }
      }
    } catch (error) {
      req.flash("error", "Cities not found");
    }

    const error = req.flash("error");

    res.status(200).render("pages/addToSiteIframe", {
      title: "TurkiyeNobetciEczane.com'u Sitene Ekle",
      removeNavbar: true,
      error,
      cities,
      selectedCity,
      selectedDistrict,
      selectableDistricts,
      pharmacies,
    });
  }
);

router.get("/privacy-policy", async (req, res) => {
  res.status(200).render("pages/privacyPolicy", {
    title: "Gizlilik Politikası",
    breadcrumbList: [{ name: "Gizlilik Politikası", url: "/privacy-policy" }],
  });
});

router.get("/terms-and-conditions", async (req, res) => {
  res.status(200).render("pages/termsAndConditions", {
    title: "Kullanım Koşulları",
    breadcrumbList: [{ name: "Kullanım Koşulları", url: "/terms-and-conditions" }],
  });
});

module.exports = router;
