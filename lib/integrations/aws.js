'use strict';

const AWS = require('aws-sdk');

module.exports = {

    get_authorization(options, fn) {
        const ecr = this.get_client(options);

        return ecr.getAuthorizationToken((err, results) => {
            if(err) {
                return fn(err);
            }

            const data = results.authorizationData[0];
            return fn(null, data);
        });
    },

    get_client(options) {
        let credentials = {
            accessKeyId: options.aws_access_key_id,
            secretAccessKey: options.aws_secret_access_key,
            region: options.region || 'us-east-1'
        };

        return new AWS.ECR(credentials);
    }
};
