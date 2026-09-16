const app = require('./app.json');

module.exports = {
  expo: {
    ...app.expo,
    extra: {
      youtubeDataApiKey: process.env.YOUTUBE_DATA_API_KEY ?? '',
    },
  },
};
