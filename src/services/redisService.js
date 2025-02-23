const Redis = require('redis');
const config = require('../config/config');
const geohash = require('geohash');

const client = Redis.createClient({
  url: config.redis.url
});

client.on('error', (err) => console.error('Redis Client Error', err));

const redisService = {
  connect: async () => {
    if (!client.isOpen) {
      await client.connect();
    }
  },

  disconnect: async () => {
    if (client.isOpen) {
      await client.quit();
    }
  },

  // Cache user locations with geohash for faster proximity searches
  setUserLocation: async (userId, latitude, longitude) => {
    const hash = geohash.encode(latitude, longitude, 7); // 7 is precision level
    await client.hSet(`user:${userId}:location`, {
      latitude,
      longitude,
      geohash: hash
    });
    await client.geoAdd('user_locations', {
      longitude,
      latitude,
      member: userId.toString()
    });
  },

  // Get nearby users within radius
  getNearbyUsers: async (latitude, longitude, radius) => {
    return client.geoRadius('user_locations', {
      longitude,
      latitude,
      radius: radius * 1000, // Convert km to meters
      unit: 'm'
    });
  }
};

module.exports = redisService; 