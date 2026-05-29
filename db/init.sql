CREATE DATABASE text2sql;

\c text2sql;

CREATE USER text2sql_readonly WITH PASSWORD 'readonly123';
GRANT CONNECT ON DATABASE text2sql TO text2sql_readonly;
GRANT USAGE ON SCHEMA public TO text2sql_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO text2sql_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO text2sql_readonly;