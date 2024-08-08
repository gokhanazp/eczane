require("dotenv").config();
const path = require("path");
const DutyPharmacyModel = require("../models/dutyPharmacyModel");
const translateEnglish = require("../utils/translateEnglish");

const DUTY_API_URL = process.env.DUTY_API_URL;
const DUTY_API_KEY = process.env.DUTY_API_KEY;

const baseHeaders = {
  "content-type": "application/json",
  authorization: DUTY_API_KEY,
};

class DutyPharmacyService {
  async getDutyPharmacies() {
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
      resJson.data = resJson.data.filter(pharmacy => !pharmacy.city.startsWith("Kıbrıs"));

      const dutyPharmacies = resJson.data.map(pharmacy => DutyPharmacyModel.fromJson(pharmacy));

      return dutyPharmacies;
    } catch (error) {
      console.error("Fetch Error: ", error.message);
      throw new Error(`An error occurred while fetching duty pharmacies: ${error.message}`);
    }
  }

  async getDutyPharmaciesBy(city, district) {
    try {
      const citiesRes = await fetch(`${DUTY_API_URL}/cities`, {
        method: "GET",
        headers: baseHeaders,
      });

      const citiesResJson = await citiesRes.json();

      if (citiesResJson.status !== "success") {
        throw new Error(`Failed to fetch duty pharmacy: ${citiesResJson.message}`);
      }

      citiesResJson.data = citiesResJson.data.find(c => {
        const p1 = translateEnglish({ text: c.cities }).text.toLowerCase();
        const p2 = translateEnglish({ text: city }).text.toLowerCase();
        return p1 === p2;
      });

      if (!citiesResJson.data) {
        throw new Error(`Failed to fetch duty pharmacy: City not found`);
      }

      const citySlug = citiesResJson.data.slug;

      let districtSlug;
      if (district) {
        const districtsRes = await fetch(`${DUTY_API_URL}/cities?city=${citySlug}`, {
          method: "GET",
          headers: baseHeaders,
        });

        const districtsResJson = await districtsRes.json();

        if (districtsResJson.status !== "success") {
          throw new Error(`Failed to fetch duty pharmacy: ${districtsResJson.message}`);
        }

        const districtSlugData = districtsResJson.data.find(d => {
          const p1 = translateEnglish({ text: d.cities }).text.toLowerCase();
          const p2 = translateEnglish({ text: district }).text.toLowerCase();
          return p1 === p2;
        });

        if (!districtSlugData) {
          throw new Error(`Failed to fetch duty pharmacy: District not found`);
        }

        districtSlug = districtSlugData.slug;
      }

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
    } catch (error) {
      console.error("Fetch Error: ", error.message);
      throw new Error(`An error occurred while fetching duty pharmacies: ${error.message}`);
    }
  }

  async getCities() {
    try {
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
      resJson.data = resJson.data.filter(city => !city.cities.startsWith("Kıbrıs"));

      return resJson.data;
    } catch (error) {
      throw new Error("Failed to fetch cities: ", error.message);
    }
  }

  async getDistricts(city) {
    try {
      const slug = translateEnglish({ text: city }).text.toLowerCase();
      const url = `${DUTY_API_URL}/cities?city=${slug}`;
      const response = await fetch(url, {
        method: "GET",
        headers: baseHeaders,
      });

      const resJson = await response.json();

      if (resJson.status !== "success") {
        throw new Error(`Failed to fetch districts: ${resJson.message}`);
      }

      // distirict.cities = district name
      const districts = resJson.data.map(district => district.cities);

      return districts;
    } catch (error) {
      console.error("Fetch Error: ", error.message);
      throw new Error(`An error occurred while fetching districts: ${error.message}`);
    }
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
        resJson.data = resJson.data.filter(city => !city.cities.startsWith("Kıbrıs"));
      }

      return resJson.data;
    } catch (error) {
      throw new Error(`An error occurred while fetching duty pharmacies count: ${error.message}`);
    }
  }

  async getNearestPharmacies(ip) {
    try {
      const ipLocFetch = await fetch(`http://ip-api.com/json/${ip}`);
      const ipLocationRes = await ipLocFetch.json();

      if (ipLocationRes.status !== "success") {
        throw new Error(`Failed to fetch IP location: ${ipLocationRes.message}`);
      }

      const lat = ipLocationRes.lat;
      const lon = ipLocationRes.lon;

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
}

module.exports = new DutyPharmacyService();
