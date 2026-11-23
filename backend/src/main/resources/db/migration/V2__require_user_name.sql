UPDATE users
SET name = '이름 미설정'
WHERE name IS NULL;

ALTER TABLE users ALTER COLUMN name SET NOT NULL;
