const axios = require('axios');
const config = require('../config/config');

const geocodeLocation = async (location) => {
  try {
    const response = await axios.get(
      'https://api.opencagedata.com/geocode/v1/json',
      {
        params: {
          q: location,
          key: config.geocoding.apiKey,
          limit: 1
        }
      }
    );

    if (response.data.results.length > 0) {
      const { lat, lng } = response.data.results[0].geometry;
      return {
        latitude: lat,
        longitude: lng
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
};

module.exports = {
  geocodeLocation
}; 