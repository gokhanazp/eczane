require("dotenv").config();
const path = require("path");
const DutyPharmacyModel = require("../models/dutyPharmacyModel");
const translateEnglish = require("../utils/translateEnglish");
const apiOptimizer = require("../utils/apiOptimizer");

const DUTY_API_URL = process.env.DUTY_API_URL || "https://www.nosyapi.com/apiv2/service/pharmacies-on-duty";
const DUTY_API_KEY = process.env.DUTY_API_KEY || "Bearer e2rrwkbgS9GJ16zL7yOCRlkoKcIfFT12sLunWqUlPM8kCITjueH1keEj3UT7";

// Debug environment variables
console.log("🔑 API Environment Check:");
console.log("- DUTY_API_URL:", DUTY_API_URL ? "✅ Set" : "❌ Missing");
console.log("- DUTY_API_KEY:", DUTY_API_KEY ? "✅ Set" : "❌ Missing");

if (!DUTY_API_URL || !DUTY_API_KEY) {
  console.error("❌ CRITICAL: API environment variables missing!");
  console.error("- DUTY_API_URL:", DUTY_API_URL);
  console.error("- DUTY_API_KEY:", DUTY_API_KEY ? "Bearer ***" : "undefined");
}

const baseHeaders = {
  "content-type": "application/json",
  authorization: DUTY_API_KEY,
};

class DutyPharmacyService {
  async getDutyPharmacies() {
    // SÜPER UZUN CACHE - TOKEN TASARRUFU
    return await apiOptimizer.getWithCache(
      "all_duty_pharmacies",
      async () => {
        console.log("🌐 getDutyPharmacies API çağrısı yapılıyor - TOKEN KULLANIMI");
        try {
          const url = `${DUTY_API_URL}/all`;
          const response = await fetch(url, {
            method: "GET",
            headers: baseHeaders,
          });

          let resJson = await response.json();

          if (resJson.status !== "success") {
            throw new Error(`Failed to fetch duty pharmacies: ${resJson.message}`);
          }

          // start Kıbrıs remove
          resJson.data = resJson.data.filter(pharmacy => pharmacy.city && !pharmacy.city.startsWith("Kıbrıs"));

          const dutyPharmacies = resJson.data.map(pharmacy => DutyPharmacyModel.fromJson(pharmacy));

          return dutyPharmacies;
        } catch (error) {
          console.error("Fetch Error: ", error.message);
          throw new Error(`An error occurred while fetching duty pharmacies: ${error.message}`);
        }
      },
      7 // 7 gün cache - çok uzun
    );
  }

  async getDutyPharmaciesBy(city, district) {
    console.log("🚨 UYARI: getDutyPharmaciesBy kullanılıyor - TOKEN KAÇAĞI RİSKİ!");
    console.log("Bu fonksiyon yerine cache'li _getAllData kullanın!");

    // ACİL TOKEN TASARRUFU - Cache'den al
    try {
      // Cache'li API çağrıları kullan
      const cities = await this.getCities();
      const cityData = cities.find(c => {
        const p1 = translateEnglish({ text: c.cities }).text.toLowerCase();
        const p2 = translateEnglish({ text: city }).text.toLowerCase();
        return p1 === p2;
      });

      if (!cityData) {
        throw new Error(`Failed to fetch duty pharmacy: City not found`);
      }

      const citySlug = cityData.slug;

      let districtSlug;
      if (district) {
        // Cache'li districts al
        const districts = await this.getDistricts(city);
        const districtData = districts.find(d => {
          const p1 = translateEnglish({ text: d.cities }).text.toLowerCase();
          const p2 = translateEnglish({ text: district }).text.toLowerCase();
          return p1 === p2;
        });

        if (!districtData) {
          throw new Error(`Failed to fetch duty pharmacy: District not found`);
        }

        districtSlug = districtData.slug;
      }

      // SON API ÇAĞRISI - Cache'li yap
      const cacheKey = `duty_pharmacies_${citySlug}_${districtSlug || 'all'}`;
      return await apiOptimizer.getWithCache(
        cacheKey,
        async () => {
          console.log("🌐 getDutyPharmaciesBy API çağrısı yapılıyor:", { city, district });
          const url = `${DUTY_API_URL}?city=${citySlug}${districtSlug ? `&district=${districtSlug}` : ""}`;
          const response = await fetch(url, {
            method: "GET",
            headers: baseHeaders,
          });

          const resJson = await response.json();

          if (resJson.status !== "success") {
            throw new Error(`Failed to fetch duty pharmacy: ${resJson.message}`);
          }

          const dutyPharmacies = resJson.data.map(pharmacy => DutyPharmacyModel.fromJson(pharmacy));
          return dutyPharmacies;
        },
        1 // 1 gün cache
      );
    } catch (error) {
      console.error("Fetch Error: ", error.message);
      throw new Error(`An error occurred while fetching duty pharmacies: ${error.message}`);
    }
  }

  async getCities() {
    // API Optimizer ile cache'li çağrı - 30 gün cache
    return await apiOptimizer.getWithCache(
      "cities_list",
      async () => {
        const url = `${DUTY_API_URL}/cities`;
        const response = await fetch(url, {
          method: "GET",
          headers: baseHeaders,
        });

        let resJson = await response.json();

        if (resJson.status !== "success") {
          throw new Error(`Failed to fetch cities: ${resJson.message}`);
        }

        // start Kıbrıs remove
        resJson.data = resJson.data.filter(city => city.cities && !city.cities.startsWith("Kıbrıs"));

        return resJson.data;
      },
      30 // 30 gün cache - şehirler çok nadir değişir
    );
  }

  async getDistricts(city) {
    const slug = translateEnglish({ text: city }).text.toLowerCase();

    // API Optimizer ile cache'li çağrı - şehir bazında 30 gün cache
    return await apiOptimizer.getWithCache(
      `districts_${slug}`,
      async () => {
        const url = `${DUTY_API_URL}/cities?city=${slug}`;
        const response = await fetch(url, {
          method: "GET",
          headers: baseHeaders,
        });

        const resJson = await response.json();

        if (resJson.status !== "success") {
          throw new Error(`Failed to fetch districts: ${resJson.message}`);
        }

        return resJson.data;
      },
      30 // 30 gün cache - ilçeler çok nadir değişir
    );
  }

  /**
   * If the city is not specified, the number of pharmacies on duty is given for the cities.
   *
   * If the city is specified, the number of pharmacies on duty is given for the districts of the city.
   * @param {string} city - City name for districts (optional)
   * @returns {Promise<Array>} - [ { "cities":"city name", "slug":"city slug", "dutyPharmacyCount": 12 } ]
   */
  async getDutyPharmaciesCountOnCity(city = "") {
    try {
      const url = `${DUTY_API_URL}/count-cities${city ? `?city=${city}` : ""}`;
      const response = await fetch(url, {
        method: "GET",
        headers: baseHeaders,
      });

      let resJson = await response.json();

      if (resJson.status !== "success") {
        throw new Error(`Failed to fetch duty pharmacies count: ${resJson.message}`);
      }

      if (!city) {
        resJson.data = resJson.data.filter(city => city.cities && !city.cities.startsWith("Kıbrıs"));
      }

      return resJson.data;
    } catch (error) {
      throw new Error(`An error occurred while fetching duty pharmacies count: ${error.message}`);
    }
  }

  async getNearestPharmacies(lat, lon) {
    try {
      const url = `${DUTY_API_URL}/locations?latitude=${lat}&longitude=${lon}`;
      const response = await fetch(url, {
        method: "GET",
        headers: baseHeaders,
      });

      let resJson = await response.json();

      if (resJson.status !== "success") {
        throw new Error(`Failed to fetch nearest pharmacies: ${resJson.message}`);
      }

      resJson.data = resJson.data.map(pharmacy => DutyPharmacyModel.fromJson(pharmacy));

      return resJson.data;
    } catch (error) {
      throw new Error(`An error occurred while fetching nearest pharmacies: ${error.message}`);
    }
  }

  async getPharmacyById(id) {
    try {
      const url = `${DUTY_API_URL}?detailsID=${id}`;
      const response = await fetch(url, {
        method: "GET",
        headers: baseHeaders,
      });

      let resJson = await response.json();

      if (resJson.status !== "success") {
        throw new Error(`Failed to fetch pharmacy: ${resJson.message}`);
      }

      if (!resJson.data || resJson.data.length === 0) {
        throw new Error(`Failed to fetch pharmacy: Pharmacy not found`);
      }

      return DutyPharmacyModel.fromJson(resJson.data[0]);
    } catch (error) {
      throw new Error(`An error occurred while fetching pharmacy: ${error.message}`);
    }
  }
}

module.exports = new DutyPharmacyService();
