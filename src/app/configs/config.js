require('dotenv').config();

const config = {
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
    accessTokenLife: process.env.ACCESS_TOKEN_LIFE,
    refreshTokenSize: 100,
};

module.exports = config;
