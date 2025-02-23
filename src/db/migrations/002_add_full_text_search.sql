-- Update existing records with search vector
UPDATE skills
SET search_vector = skills_search_vector(title, description, category); 