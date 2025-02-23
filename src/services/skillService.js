const skillService = {
  searchSkills: async (query, location, radius, page, limit) => {
    // Add query caching
    const cacheKey = `skills:${query}:${location}:${radius}:${page}:${limit}`;
    const cached = await redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Optimize query with indexes
    const result = await pool.query(`
      SELECT s.id, s.title, s.category, s.description,
        u.id as user_id, u.username, u.karma_score
      FROM skills s
      JOIN users u ON u.id = s.user_id
      WHERE 
      s.search_vector @@ plainto_tsquery($1)
      AND ST_DWithin(
        s.location,
        ST_SetSRID(ST_MakePoint($2, $3), 4326),
        $4
      )
      ORDER BY s.created_at DESC
      LIMIT $5 OFFSET $6
    `, [query, lat, lng, radius, limit, offset]);

    // Cache results
    await redisService.setex(cacheKey, 300, JSON.stringify(result.rows));

    return result.rows;
  }
}; 