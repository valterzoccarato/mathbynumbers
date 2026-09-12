-- Schema per la classifica di Numeroids
-- Da eseguire una sola volta in phpMyAdmin (o equivalente pannello Aruba),
-- sul database che avrai creato per questo scopo.

CREATE TABLE IF NOT EXISTS highscores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    initials CHAR(3) NOT NULL,
    score INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
