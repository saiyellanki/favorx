const { pool } = require('../db');
const redisService = require('./redisService');

const KARMA_WEIGHTS = {
  RATING: 0.5,          // Base rating weight
  COMPLETION: 0.2,      // Successfully completed favors
  CONSISTENCY: 0.15,    // Consistent good ratings
  ACTIVITY: 0.15,       // Recent activity level
  INITIAL_KARMA: 3.0    // Starting karma score for new users
};

const karmaService = {
  /**
   * Calculate weighted rating score
   * Gives more weight to recent ratings and verified transactions
   */
  async calculateWeightedRating(userId) {
    const result = await pool.query(
      `SELECT 
        rating,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at))/86400 as days_ago
      FROM ratings 
      WHERE rated_id = $1 
      ORDER BY created_at DESC`,
      [userId]
    );

    if (result.rows.length === 0) {
      return KARMA_WEIGHTS.INITIAL_KARMA;
    }

    let weightedSum = 0;
    let weightSum = 0;

    result.rows.forEach(row => {
      // Decay factor: ratings lose weight over time (half-life of 90 days)
      const timeWeight = Math.exp(-row.days_ago / 90);
      
      weightedSum += row.rating * timeWeight;
      weightSum += timeWeight;
    });

    return weightedSum / weightSum;
  },

  /**
   * Calculate completion score based on successful favor exchanges
   */
  async calculateCompletionScore(userId) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_favors,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as successful_favors
      FROM ratings r
      JOIN skills s ON s.id = r.skill_id
      WHERE s.user_id = $1`,
      [userId]
    );

    const { total_favors, successful_favors } = result.rows[0];
    
    if (total_favors === 0) return KARMA_WEIGHTS.INITIAL_KARMA;
    
    return (successful_favors / total_favors) * 5; // Scale to 0-5
  },

  /**
   * Calculate consistency score based on rating variance
   */
  async calculateConsistencyScore(userId) {
    const result = await pool.query(
      `SELECT 
        AVG(rating) as avg_rating,
        STDDEV(rating) as rating_stddev
      FROM ratings
      WHERE rated_id = $1`,
      [userId]
    );

    if (!result.rows[0].avg_rating) return KARMA_WEIGHTS.INITIAL_KARMA;

    const { avg_rating, rating_stddev } = result.rows[0];
    // Higher score for lower variance
    return Math.min(5, avg_rating * (1 + (1 - (rating_stddev || 0) / 2)));
  },

  /**
   * Calculate activity score based on recent interactions
   */
  async calculateActivityScore(userId) {
    const result = await pool.query(
      `SELECT COUNT(*) 
      FROM (
        SELECT created_at 
        FROM ratings 
        WHERE rated_id = $1 
        AND created_at > NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT created_at 
        FROM skills 
        WHERE user_id = $1 
        AND created_at > NOW() - INTERVAL '30 days'
      ) recent_activity`,
      [userId]
    );

    const recentActivityCount = parseInt(result.rows[0].count);
    // Scale activity score: 10+ activities in 30 days = max score
    return Math.min(5, (recentActivityCount / 10) * 5);
  },

  /**
   * Calculate final karma score combining all factors
   */
  async calculateKarmaScore(userId) {
    const [
      weightedRating,
      completionScore,
      consistencyScore,
      activityScore
    ] = await Promise.all([
      karmaService.calculateWeightedRating(userId),
      karmaService.calculateCompletionScore(userId),
      karmaService.calculateConsistencyScore(userId),
      karmaService.calculateActivityScore(userId)
    ]);

    const karmaScore = (
      weightedRating * KARMA_WEIGHTS.RATING +
      completionScore * KARMA_WEIGHTS.COMPLETION +
      consistencyScore * KARMA_WEIGHTS.CONSISTENCY +
      activityScore * KARMA_WEIGHTS.ACTIVITY
    ).toFixed(2);

    // Cache the karma score
    await redisService.client.set(
      `karma:${userId}`,
      karmaScore,
      'EX',
      3600 // Cache for 1 hour
    );

    return parseFloat(karmaScore);
  },

  /**
   * Update user's karma score
   */
  async updateUserKarma(userId) {
    const karmaScore = await karmaService.calculateKarmaScore(userId);
    
    await pool.query(
      'UPDATE users SET karma_score = $1 WHERE id = $2',
      [karmaScore, userId]
    );

    return karmaScore;
  }
};

module.exports = karmaService; 