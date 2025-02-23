const { pool } = require('../db');
const redisService = require('./redisService');
const { AppError } = require('../utils/errorHandler');

const locationService = {
  updateUserLocation: async (userId, latitude, longitude) => {
    await pool.query(
      'UPDATE profiles SET latitude = $1, longitude = $2 WHERE user_id = $3',
      [latitude, longitude, userId]
    );
    await redisService.setUserLocation(userId, latitude, longitude);
  },

  findNearbySkills: async (userId, category, maxDistance = 10, minKarma = 0) => {
    const userLocation = await pool.query(
      'SELECT latitude, longitude FROM profiles WHERE user_id = $1',
      [userId]
    );

    if (!userLocation.rows[0]?.latitude || !userLocation.rows[0]?.longitude) {
      throw new AppError('User location not set', 400);
    }

    const { latitude, longitude } = userLocation.rows[0];

    // Get nearby users from Redis first
    const nearbyUserIds = await redisService.getNearbyUsers(
      latitude,
      longitude,
      maxDistance
    );

    if (nearbyUserIds.length === 0) {
      return [];
    }

    // Query skills from nearby users
    const result = await pool.query(
      `SELECT 
        s.*,
        u.username,
        u.karma_score,
        p.location,
        p.latitude,
        p.longitude,
        earth_distance(
          ll_to_earth($1, $2),
          ll_to_earth(p.latitude, p.longitude)
        ) / 1000 as distance
      FROM skills s
      JOIN users u ON u.id = s.user_id
      JOIN profiles p ON p.user_id = s.user_id
      WHERE 
        s.user_id = ANY($3)
        AND u.karma_score >= $4
        ${category ? 'AND s.category = $5' : ''}
      ORDER BY 
        distance ASC,
        u.karma_score DESC`,
      category 
        ? [latitude, longitude, nearbyUserIds, minKarma, category]
        : [latitude, longitude, nearbyUserIds, minKarma]
    );

    return result.rows;
  }
};

module.exports = locationService; 