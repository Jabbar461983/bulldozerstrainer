-- Fix is_home default: Set existing games to false (away games) unless explicitly marked
-- This ensures auto-create for home games only affects actual home games

-- First, update existing records that might have been created before is_home was properly handled
-- Since we can't reliably determine which were home games, set all existing to false
-- and let users explicitly mark home games
update games 
set is_home = false 
where is_home is null;

-- Change default for new games to false (safer - requires explicit marking)
alter table games 
alter column is_home set default false;
