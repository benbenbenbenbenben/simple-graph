CREATE TABLE IF NOT EXISTS nodes (
    body TEXT,
    id   TEXT GENERATED ALWAYS AS (json_extract(body, '$.id')) VIRTUAL NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS id_idx ON nodes(id);

CREATE TABLE IF NOT EXISTS edges (
    properties TEXT,
    source     TEXT GENERATED ALWAYS AS (json_extract(properties, '$.source')) VIRTUAL NOT NULL UNIQUE,
    target     TEXT GENERATED ALWAYS AS (json_extract(properties, '$.target')) VIRTUAL NOT NULL UNIQUE,
    id         TEXT GENERATED ALWAYS AS (json_extract(properties, '$.id')) VIRTUAL NOT NULL UNIQUE,
    FOREIGN KEY(source) REFERENCES nodes(id),
    FOREIGN KEY(target) REFERENCES nodes(id)
);

CREATE INDEX IF NOT EXISTS source_idx ON edges(source);
CREATE INDEX IF NOT EXISTS target_idx ON edges(target);
