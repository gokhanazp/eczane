const fs = require("fs");
const DutyPharmacyService = require("../services/dutyPharmacyService");
const path = require("path");

const sitemapGeneratorMainDistrictCityNear = async () => {
  try {
    let districtsByCity = {};
    const cities = await DutyPharmacyService.getCities();

    for (const city of cities) {
      const districts = await DutyPharmacyService.getDistricts(city.slug);
      districtsByCity[city.slug] = districts.map(district => district.slug);
    }

    const date = new Date().toISOString().split("T")[0];
    let sitemap = '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>';
    sitemap += '\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    sitemap += "\n\t<url>";
    sitemap += "\n\t\t<loc>https://www.turkiyenobetcieczane.com</loc>";
    sitemap += `\n\t\t<lastmod>${date}</lastmod>`;
    sitemap += "\n\t\t<changefreq>always</changefreq>";
    sitemap += "\n\t\t<priority>1.0</priority>";
    sitemap += "\n\t</url>";
    sitemap += "\n\t<url>";
    sitemap += "\n\t\t<loc>https://www.turkiyenobetcieczane.com/enyakinnobetcieczane</loc>";
    sitemap += `\n\t\t<lastmod>${date}</lastmod>`;
    sitemap += "\n\t\t<changefreq>always</changefreq>";
    sitemap += "\n\t\t<priority>0.5</priority>";
    sitemap += "\n\t</url>";
    for (const city in districtsByCity) {
      sitemap += "\n\t<url>";
      sitemap += `\n\t\t<loc>https://www.turkiyenobetcieczane.com/nobetcieczane/${city}</loc>`;
      sitemap += `\n\t\t<lastmod>${date}</lastmod>`;
      sitemap += "\n\t\t<changefreq>always</changefreq>";
      sitemap += "\n\t\t<priority>0.5</priority>";
      sitemap += "\n\t</url>";
      for (const district of districtsByCity[city]) {
        sitemap += "\n\t<url>";
        sitemap += `\n\t\t<loc>https://www.turkiyenobetcieczane.com/nobetcieczane/${city}/${district}</loc>`;
        sitemap += `\n\t\t<lastmod>${date}</lastmod>`;
        sitemap += "\n\t\t<changefreq>always</changefreq>";
        sitemap += "\n\t\t<priority>0.5</priority>";
        sitemap += "\n\t</url>";
      }
    }
    sitemap += "\n</urlset>";

    const sitemapPath = path.resolve(__dirname, "./output/sitemap1.xml");
    if (!fs.existsSync(path.resolve(__dirname, "./output"))) {
      fs.mkdirSync(path.resolve(__dirname, "./output"));
    }
    fs.writeFileSync(sitemapPath, sitemap);
    console.log("Sitemap generated successfully!");
  } catch (error) {
    console.error(error);
  }
};

sitemapGeneratorMainDistrictCityNear();
