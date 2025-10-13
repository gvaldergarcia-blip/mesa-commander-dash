-- Add menu_image_url column to restaurants table
ALTER TABLE mesaclik.restaurants 
ADD COLUMN IF NOT EXISTS menu_image_url TEXT;