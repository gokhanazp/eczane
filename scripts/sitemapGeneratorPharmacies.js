const fs = require("fs");
const DutyPharmacyService = require("../services/dutyPharmacyService");
const path = require("path");

const sitemapGeneratorPharmacies = async () => {
  try {
    const pharmacies = await DutyPharmacyService.getDutyPharmacies();

    if (!pharmacies || pharmacies.length === 0) {
      throw new Error("Pharmacies could not be fetched!");
    }

    const date = new Date().toISOString().split("T")[0];
    let sitemap = '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>';
    sitemap += '\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    for (const pharmacy of pharmacies) {
      console.log(pharmacy);
      const nameContent = pharmacy.name.split(" ");
      const name = nameContent.join("-");
      const nameAndId = name + "-" + pharmacy.id;
      sitemap += "\n\t<url>";
      sitemap += `\n\t\t<loc>https://www.turkiyenobetcieczane.com/eczaneler/${nameAndId.toLocaleLowerCase(
        "en-US"
      )}</loc>`;
      sitemap += `\n\t\t<lastmod>${date}</lastmod>`;
      sitemap += "\n\t\t<changefreq>always</changefreq>";
      sitemap += "\n\t\t<priority>0.5</priority>";
      sitemap += "\n\t</url>";
    }
    sitemap += "\n</urlset>";

    const sitemapPath = path.resolve(__dirname, "./output/sitemap2.xml");
    if (!fs.existsSync(path.resolve(__dirname, "./output"))) {
      fs.mkdirSync(path.resolve(__dirname, "./output"));
    }
    fs.writeFileSync(sitemapPath, sitemap);
    console.log("Sitemap generated successfully!");
  } catch (error) {
    console.error(error);
  }
};

sitemapGeneratorPharmacies();
