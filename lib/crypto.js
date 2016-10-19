'use strict';

const crypto = require('crypto');

module.exports = {
    md5: function(message) {
        return crypto.createHash('md5').update(message).digest('hex');
    }
};
