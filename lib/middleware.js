'use strict';

const handlers = require('../handlers');

module.exports = {
    version : function(req, res, next) {
        const api_version = req.params.api_version;

        if(handlers[api_version]) {
            req.handler = handlers[api_version];
            return next();
        }
        // This should pull the latest version of handlers to use,
        // assuming that versions are added in order in the handlers/index.js file
        req.handler = handlers[Object.keys(handlers)[Object.keys(handlers).length - 1]];
        return next();
    }
};
