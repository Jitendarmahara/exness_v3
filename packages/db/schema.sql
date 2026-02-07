CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS ticks(
    id BIGSERIAL,
    price DECIMAL(20 , 4)NOT NULL,
    market VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    createdat TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(id , timestamp)
);
SELECT create_hypertable('ticks' , 'timestamp' , chunk_time_interval=> INTERVAL '1 day' , if_not_exists=> TRUE);

CREATE TABLE IF NOT EXISTS candles_1m(
    id BIGSERIAL,
    market VARCHAR(20) NOT NULL,
    open DECIMAL(20 , 4) NOT NULL,
    high DECIMAL (20 , 4) NOT NULL,
    low DECIMAL (20 , 4) NOT NULL,
    close DECIMAL (20 , 4) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    trade_count BIGINT DEFAULT 0,
    createdat TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (market, start_time)
);
SELECT create_hypertable('candles_1m' , 'start_time' , chunk_time_interval=> INTERVAL '1 day' , if_not_exists=> TRUE);
CREATE TABLE IF NOT EXISTS candles_5m(
    id BIGSERIAL,
    market VARCHAR(20) NOT NULL,
    open DECIMAL(20 , 4) NOT NULL,
    high DECIMAL (20 , 4) NOT NULL,
    low DECIMAL (20 , 4) NOT NULL,
    close DECIMAL (20 , 4) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    trade_count BIGINT DEFAULT 0,
    createdat TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (market, start_time)
);
SELECT create_hypertable('candles_5m' , 'start_time' , chunk_time_interval=> INTERVAL '1 day' , if_not_exists=> TRUE);
CREATE TABLE IF NOT EXISTS candles_15m(
    id BIGSERIAL,
    market VARCHAR(20) NOT NULL,
    open DECIMAL(20 , 4) NOT NULL,
    high DECIMAL (20 , 4) NOT NULL,
    low DECIMAL (20 , 4) NOT NULL,
    close DECIMAL (20 , 4) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    trade_count BIGINT DEFAULT 0,
    createdat TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (market, start_time)
);
SELECT create_hypertable('candles_15m' , 'start_time' , chunk_time_interval=> INTERVAL '1 day' , if_not_exists=> TRUE);
CREATE TABLE IF NOT EXISTS candles_1h(
    id BIGSERIAL,
    market VARCHAR(20) NOT NULL,
    open DECIMAL(20 , 4) NOT NULL,
    high DECIMAL (20 , 4) NOT NULL,
    low DECIMAL (20 , 4) NOT NULL,
    close DECIMAL (20 , 4) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    trade_count BIGINT DEFAULT 0,
    createdat TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (market, start_time)
);
SELECT create_hypertable('candles_1h' , 'start_time' , chunk_time_interval=> INTERVAL '1 day' , if_not_exists=> TRUE);
CREATE TABLE IF NOT EXISTS candles_4h(
    id BIGSERIAL,
    market VARCHAR(20) NOT NULL,
    open DECIMAL(20 , 4) NOT NULL,
    high DECIMAL (20 , 4) NOT NULL,
    low DECIMAL (20 , 4) NOT NULL,
    close DECIMAL (20 , 4) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    trade_count BIGINT DEFAULT 0,
    createdat TIMESTAMPTZ DEFAULT NOW(),
   PRIMARY KEY (market, start_time)
);
SELECT create_hypertable('candles_4h' , 'start_time' , chunk_time_interval=> INTERVAL '1 day' , if_not_exists=> TRUE);

CREATE TABLE IF NOT EXISTS candles_1d(
    id BIGSERIAL,
    market VARCHAR(20) NOT NULL,
    open DECIMAL(20 , 4) NOT NULL,
    high DECIMAL (20 , 4) NOT NULL,
    low DECIMAL (20 , 4) NOT NULL,
    close DECIMAL (20 , 4) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    trade_count BIGINT DEFAULT 0,
    createdat TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (market, start_time)
);
SELECT create_hypertable('candles_1d' , 'start_time' , chunk_time_interval=> INTERVAL '1 day' , if_not_exists=> TRUE);
CREATE TABLE IF NOT EXISTS candles_1w(
    id BIGSERIAL,
    market VARCHAR(20) NOT NULL,
    open DECIMAL(20 , 4) NOT NULL,
    high DECIMAL (20 , 4) NOT NULL,
    low DECIMAL (20 , 4) NOT NULL,
    close DECIMAL (20 , 4) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    trade_count BIGINT DEFAULT 0,
    createdat TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (market, start_time)
);
SELECT create_hypertable('candles_1w' , 'start_time' , chunk_time_interval=> INTERVAL '1 day' , if_not_exists=> TRUE);