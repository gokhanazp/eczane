const fs = require("fs");
const DutyPharmacyService = require("../services/dutyPharmacyService");
const path = require("path");

const sitemapGenerator = async () => {
  try {
    let districtsByCity = {};
    const cities = await DutyPharmacyService.getCities();

    for (const city of cities) {
      const districts = await DutyPharmacyService.getDistricts(city.slug);
      districtsByCity[city.slug] = districts.map(district => district.slug);
    }

    let sitemap = '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>';
    sitemap += '\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    const date = new Date().toISOString().split("T")[0];
    for (const city in districtsByCity) {
      sitemap += "\n\t<url>";
      sitemap += `\n\t\t<loc>https://www.turkiyenobetcieczane.com/nobetcieczane/${city}</loc>`;
      sitemap += `\n\t\t<lastmod>${date}</lastmod>`;
      sitemap += "\n\t\t<changefreq>always</changefreq>";
      sitemap += "\n\t\t<priority>N/A</priority>";
      sitemap += "\n\t</url>";
      for (const district of districtsByCity[city]) {
        sitemap += "\n\t<url>";
        sitemap += `\n\t\t<loc>https://www.turkiyenobetcieczane.com/nobetcieczane/${city}/${district}</loc>`;
        sitemap += `\n\t\t<lastmod>${date}</lastmod>`;
        sitemap += "\n\t\t<changefreq>always</changefreq>";
        sitemap += "\n\t\t<priority>N/A</priority>";
        sitemap += "\n\t</url>";
      }
    }
    sitemap += "\n</urlset>";

    const outputsDir = path.join(__dirname, "./outputs");
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir);
    }
    const dir = path.join(outputsDir, "sitemap.xml");
    fs.writeFileSync(dir, sitemap);
    console.log("Sitemap generated successfully!");
  } catch (error) {
    console.error(error);
  }
};

sitemapGenerator();
