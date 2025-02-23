const express = require('express');
const { pool } = require('../../db');
const auth = require('../../middleware/auth');
const validators = require('../../middleware/validators');
const rateLimiter = require('../../middleware/rateLimiter');
const { AppError } = require('../../utils/errorHandler');
const { geocodeLocation } = require('../../utils/geocoding');
const locationService = require('../../services/locationService');
const rateLimitService = require('../../services/rateLimitService');

const router = express.Router();

/**
 * @swagger
 * /api/skills:
 *   post:
 *     summary: Create a new skill/favor
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - title
 *               - description
 *             properties:
 *               category:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               effort_time:
 *                 type: integer
 *                 description: Estimated time in minutes
 *               is_offering:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Skill created successfully
 */
router.post('/',
  auth.requireAuth,
  rateLimiter.skillCreate,
  validators.skillValidation,
  validators.validate,
  async (req, res, next) => {
    try {
      const rateLimit = await rateLimitService.skillCreateLimit(req.user.id);
      const { category, title, description, effort_time, is_offering = true } = req.body;

      const result = await pool.query(
        `INSERT INTO skills 
         (user_id, category, title, description, effort_time, is_offering, search_vector)
         VALUES (
           $1, $2, $3, $4, $5, $6,
           skills_search_vector($3, $4, $2)
         )
         RETURNING *`,
        [req.user.id, category, title, description, effort_time, is_offering]
      );

      res.set({
        'X-RateLimit-Remaining': rateLimit.remaining,
        'X-RateLimit-Reset': rateLimit.reset
      });
      res.status(201).json({
        message: 'Skill created successfully',
        skill: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/skills:
 *   get:
 *     summary: Get all skills/favors with advanced filtering
 *     tags: [Skills]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_offering
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *       - in: query
 *         name: distance
 *         schema:
 *           type: number
 *           description: Distance in kilometers
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, effort_time, karma]
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of skills with pagination info
 */
router.get('/',
  rateLimiter.search,
  async (req, res, next) => {
    try {
      const {
        category,
        is_offering,
        search,
        location,
        distance = 10, // Default 10km
        sort = 'created_at',
        order = 'desc',
        page = 1,
        limit = 10
      } = req.query;

      const offset = (page - 1) * limit;
      const params = [];
      let countQuery = `
        SELECT COUNT(*) 
        FROM skills s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN profiles p ON p.user_id = s.user_id
        WHERE 1=1
      `;
      let query = `
        SELECT s.*, 
               u.username, 
               u.karma_score,
               p.location,
               p.latitude,
               p.longitude
        FROM skills s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN profiles p ON p.user_id = s.user_id
        WHERE 1=1
      `;

      // Category filter
      if (category) {
        params.push(category);
        const filterClause = ` AND s.category = $${params.length}`;
        query += filterClause;
        countQuery += filterClause;
      }

      // Offering/seeking filter
      if (is_offering !== undefined) {
        params.push(is_offering === 'true');
        const filterClause = ` AND s.is_offering = $${params.length}`;
        query += filterClause;
        countQuery += filterClause;
      }

      // Full-text search
      if (search) {
        params.push(search);
        const filterClause = ` AND s.search_vector @@ plainto_tsquery('english', $${params.length})`;
        query += filterClause;
        countQuery += filterClause;
        
        // Add relevance ranking to sort by search match quality
        if (sort === 'created_at') {
          query = query.replace('SELECT s.*', `
            SELECT s.*,
            ts_rank(s.search_vector, plainto_tsquery('english', $${params.length})) as search_rank`);
          query += `, search_rank DESC`;
        }
      }

      // Location-based filter
      if (location) {
        // Get coordinates for the location using geocoding service
        const coordinates = await geocodeLocation(location);
        if (coordinates) {
          params.push(coordinates.latitude, coordinates.longitude, distance);
          const filterClause = ` AND earth_distance(
            ll_to_earth($${params.length - 1}, $${params.length}),
            ll_to_earth(p.latitude, p.longitude)
          ) / 1000 <= $${params.length + 1}`;
          query += filterClause;
          countQuery += filterClause;
        }
      }

      // Sorting
      const validSortColumns = ['created_at', 'effort_time', 'karma_score'];
      const sortColumn = validSortColumns.includes(sort) ? sort : 'created_at';
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      if (sortColumn === 'karma_score') {
        query += ` ORDER BY u.karma_score ${sortOrder}, s.created_at DESC`;
      } else {
        query += ` ORDER BY s.${sortColumn} ${sortOrder}`;
      }

      // Pagination
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      // Execute queries
      const [skillsResult, countResult] = await Promise.all([
        pool.query(query, params),
        pool.query(countQuery, params.slice(0, -2)) // Remove limit and offset params
      ]);

      const totalItems = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalItems / limit);

      res.json({
        skills: skillsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalItems,
          totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  });

/**
 * @swagger
 * /api/skills/{id}:
 *   get:
 *     summary: Get skill by ID
 *     tags: [Skills]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Skill details
 *       404:
 *         description: Skill not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.username, p.location 
       FROM skills s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN profiles p ON p.user_id = s.user_id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Skill not found', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/skills/{id}:
 *   put:
 *     summary: Update a skill
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               effort_time:
 *                 type: integer
 *               is_offering:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Skill updated successfully
 *       404:
 *         description: Skill not found
 */
router.put('/:id',
  auth.requireAuth,
  rateLimiter.skillUpdate,
  validators.skillValidation,
  validators.validate,
  async (req, res, next) => {
    try {
      const { category, title, description, effort_time, is_offering } = req.body;

      const result = await pool.query(
        `UPDATE skills 
         SET category = COALESCE($1, category),
             title = COALESCE($2, title),
             description = COALESCE($3, description),
             effort_time = COALESCE($4, effort_time),
             is_offering = COALESCE($5, is_offering)
         WHERE id = $6 AND user_id = $7
         RETURNING *`,
        [category, title, description, effort_time, is_offering, req.params.id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Skill not found or unauthorized', 404);
      }

      res.json({
        message: 'Skill updated successfully',
        skill: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/skills/{id}:
 *   delete:
 *     summary: Delete a skill
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Skill deleted successfully
 *       404:
 *         description: Skill not found
 */
router.delete('/:id',
  auth.requireAuth,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        'DELETE FROM skills WHERE id = $1 AND user_id = $2 RETURNING id',
        [req.params.id, req.user.id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Skill not found or unauthorized', 404);
      }

      res.json({
        message: 'Skill deleted successfully'
      });
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/skills/matches:
 *   get:
 *     summary: Get matching skills/favors
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: skill_id
 *         schema:
 *           type: integer
 *         description: Find matches for a specific skill
 *       - in: query
 *         name: max_distance
 *         schema:
 *           type: number
 *         description: Maximum distance in kilometers (default 10)
 *       - in: query
 *         name: min_karma
 *         schema:
 *           type: number
 *         description: Minimum karma score (default 0)
 *     responses:
 *       200:
 *         description: List of matching skills
 */
router.get('/matches',
  auth.requireAuth,
  rateLimiter.matching,
  async (req, res, next) => {
    try {
      const { skill_id, max_distance = 10, min_karma = 0 } = req.query;
      let category;
      if (skill_id) {
        const skill = await pool.query(
          'SELECT category FROM skills WHERE id = $1 AND user_id = $2',
          [skill_id, req.user.id]
        );
        if (skill.rows.length > 0) {
          category = skill.rows[0].category;
        }
      }
      
      const nearbySkills = await locationService.findNearbySkills(
        req.user.id,
        category,
        max_distance,
        min_karma
      );

      // Group matches by category
      const matches = nearbySkills.reduce((acc, match) => {
        if (!acc[match.category]) {
          acc[match.category] = {
            category: match.category,
            matches: []
          };
        }
        acc[match.category].matches.push({
          id: match.id,
          title: match.title,
          description: match.description,
          is_offering: match.is_offering,
          user: {
            username: match.username,
            karma_score: match.karma_score,
            location: match.location
          },
          distance: Math.round(match.distance * 10) / 10, // Round to 1 decimal
          effort_time: match.effort_time
        });
        return acc;
      }, {});

      res.json({
        matches: Object.values(matches)
      });
    } catch (error) {
      next(error);
    }
  });

module.exports = router; 