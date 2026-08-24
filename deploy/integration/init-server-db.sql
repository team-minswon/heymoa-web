-- heymoa-server 전용 DB. ai 는 POSTGRES_DB(heymoa_ai)를 쓰고 server 는 이쪽을 쓴다.
-- 한 인스턴스에 둘을 두는 것은 통합 편의이고, 운영은 분리돼 있다.
SELECT 'CREATE DATABASE heymoa OWNER heymoa'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'heymoa')\gexec
