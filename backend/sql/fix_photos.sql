-- Fix student photo URLs to match actual files in uploads directory

-- Update photo URLs to match actual files
UPDATE students SET photo_url = '1760079788359-844734194.jpg' WHERE id = 1;
UPDATE students SET photo_url = '1761123392343-845687131.jpg' WHERE id = 2;
UPDATE students SET photo_url = '1761287874179-112060714.jpg' WHERE id = 3;
UPDATE students SET photo_url = '1761547414578-81950465.jpg' WHERE id = 4;
UPDATE students SET photo_url = '1763113473503-250763127.jpg' WHERE id = 5;
UPDATE students SET photo_url = '1763474143524-146808194.jpg' WHERE id = 6;

SELECT 'Student photo URLs updated successfully!' as message;
