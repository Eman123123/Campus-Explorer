const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const University = require('../Model/uni');
const router = express.Router();

router.get('/scrape', async (req, res) => {
  try {
    const response = await axios.get('https://www.nu.edu.pk/Degree-Programs', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);

    const universities = [];

    // Correct selector for NU's program table
    $('table.table tbody tr').each((i, elem) => {
      const tds = $(elem).find('td');
      
      // Ensure there are at least 3 columns (Program, Degree, Campus)
      if (tds.length >= 3) {
        const program = $(tds[0]).text().trim();
        const degree = $(tds[1]).text().trim();
        const campus = $(tds[2]).text().trim();

        if (program) {
          universities.push({
            name: `${program}`,
            departement: `(${degree})`, // Combine Program + Degree
            location: campus || 'Not specified',
          });
        }
      }
    });

    // Debugging logs
    console.log('Total programs found:', universities.length);
    console.log('Sample program:', universities[0]);

    if (universities.length > 0) {
      await University.deleteMany({}); // Clear old entries
      await University.insertMany(universities);
      res.send(`Success! Inserted ${universities.length} programs into the database.`);
    } else {
      res.send('No programs found. Check if the website structure changed.');
    }

  } catch (err) {
    console.error('Scraping Error:', err);
    res.status(500).send('Failed to scrape data. Check server logs.');
  }
});

router.get('/universities', async (req, res) => {
    try {
    const universities = await University.find().sort({ averageRating: -1 });
    res.json(universities);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;