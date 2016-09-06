'use strict';

const _ = require('lodash');

module.exports = {

    volumes: function(core, req, res, next) {
        // make sure request has backup id and data to data to persist
        if(!_.has(req.query, 'CSC_BACKUP_ID')) {
            res.stash.code = 400;
            res.stash.body = { error : 'Please include a CSC_BACKUP_ID' };
            return core.api.server.middleware.handle_response(req, res, next);
        }

        if(!_.has(req.query, 'CSC_PERSIST_DATA')) {
            res.stash.code = 400;
            res.stash.body = { error : 'Please include a CSC_PERSIST_DATA' };
            return core.api.server.middleware.handle_response(req, res, next);
        }

        const current_node = core.cluster.legiond.get_attributes();
        const nodes = _.indexBy(core.cluster.legiond.get_peers(), 'id');
        nodes[current_node.id] = current_node;

        _.each(res.stash.body, function(application/*, application_name */) {
            let containers = _.filter(application.containers, function(container) {
                return !_.isEmpty(container.volumes);
            });

            _.each(containers, function(container) {
                if(nodes[container.host]) {
                    core.loggers['containership-cloud'].log('verbose', ['Requesting volume backup for', container.id].join(' '));
                    core.cluster.legiond.send({
                        event: 'containership-cloud.backup',
                        data: {
                            path: _.first(container.volumes).host,
                            container_id: container.id,
                            backup_id: req.query.CSC_BACKUP_ID
                        }
                    }, nodes[container.host]);
                }
            });
        });

        return next();
    }
};
