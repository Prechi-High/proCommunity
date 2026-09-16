const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
config.maxWorkers = 1;
config.resetCache = true;
config.resolver.blockList = /_tmp_expo[/\\].*/;

module.exports = config;
