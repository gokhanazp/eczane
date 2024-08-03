const path = require("path");
const translateEnglish = require("../utils/translateEnglish");
require("dotenv").config();

const DUTY_API_URL = process.env.DUTY_API_URL;
const DUTY_API_KEY = process.env.DUTY_API_KEY;

const baseHeaders = {
  "content-type": "application/json",
  authorization: DUTY_API_KEY,
};

class DutyPharmacyService {
  async getDutyPharmacies(city, district) {
    try {
      let convertDistrict;
      const convertCity = translateEnglish({ text: city }).text.toLowerCase();
      if (district) convertDistrict = translateEnglish({ text: district }).text.toLowerCase();
      const url =
        `${DUTY_API_URL}/health/dutyPharmacy?il=${convertCity}` + (district ? `&ilce=${convertDistrict}` : "");

      const response = await fetch(url, {
        method: "GET",
        headers: baseHeaders,
      });

      const resJson = await response.json();
      if (!resJson.success) {
        console.error("API Error: ", resJson.message);
        throw new Error(`Failed to fetch duty pharmacies: ${resJson.message}`);
      }

      return resJson;
    } catch (error) {
      console.error("Fetch Error: ", error.message);
      throw new Error(`An error occurred while fetching duty pharmacies: ${error.message}`);
    }
  }

  async getCities() {
    try {
      const cityJsonFile = path.join(__dirname, "../public/json/cities.json");
      const citiesJson = require(cityJsonFile);

      return citiesJson;
    } catch (error) {
      throw new Error("Failed to fetch cities");
    }
  }

  async getDistricts(city) {
    try {
      const response = await fetch(`${DUTY_API_URL}/health/districtList?il=${city}`, {
        method: "GET",
        headers: baseHeaders,
      });

      const resJson = await response.json();
      if (resJson.success == false) {
        throw new Error("Failed to fetch districts");
      }

      return resJson;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new DutyPharmacyService();
