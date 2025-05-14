const axios = require('axios');
const cheerio = require('cheerio');
const University = require('../Model/uni');
async function scrapeUniversities() {
  try {
    const response = await axios.get('https://www.nu.edu.pk/Degree-Programs', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);

    const universities = [];
    let currentProgramType = '';
    const campusNames = ['Chiniot-Faisalabad', 'Islamabad', 'Karachi', 'Lahore', 'Multan', 'Peshawar'];

    // Process each row in the table
    $('table tbody tr').each((i, elem) => {
      // Check for program type header row
      if ($(elem).find('td[colspan="7"].tr-color').length) {
        currentProgramType = $(elem).find('h4 strong').text().trim();
        return; 
      }

      // Process program rows
      const programName = $(elem).find('td.custom-width1 a').text().trim();
      if (!programName) return; // Skip rows without program names

      // Get available campuses
      const availableCampuses = [];
      $(elem).find('td.custom-width2').each((i, campusCell) => {
        if ($(campusCell).find('a.fa-check').length) {
          availableCampuses.push(campusNames[i]);
        }
      });

      universities.push({
        degree: programName,
        departement: currentProgramType.replace('-', ' '),
        campuses: availableCampuses,
      });
    });

    // Clear old entries and insert new ones
    await University.deleteMany({});
    
    if (universities.length > 0) {
      await University.insertMany(universities);
      console.log(`Successfully inserted ${universities.length} programs with campus information.`);
      console.log('Sample entry:', universities[0]);
    } else {
      console.log("No programs found to insert.");
    }

  } catch (err) {
    console.error("Scraping failed:", err.message);
  }
}

module.exports = scrapeUniversities