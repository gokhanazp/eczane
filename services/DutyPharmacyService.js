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
      const slug = translateEnglish({ text: city }).text.toLowerCase();
      const url = `${DUTY_API_URL}?city=${slug}${district ? `&district=${district}` : ""}`;
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
    } catch (error) {}
  }
}

module.exports = new DutyPharmacyService();
