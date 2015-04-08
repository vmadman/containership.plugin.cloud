var _ = require("lodash");
var request = require("request");
var async = require("async");

module.exports = {

    initialize: function(core){

        core.api.server.server.on("applications.get", function(route){
            if(_.has(route.req.query, "CSC_BACKUP_ID")){
                var peers = _.indexBy(core.cluster.legiond.get_peers(), "host_name");

                _.each(route.res.stash.body, function(application, application_name){
                    var containers = _.filter(application.containers, function(container){
                        return !_.isEmpty(container.volumes);
                    });

                    _.each(containers, function(container){
                        core.loggers["containership-cloud"].log("verbose", ["Requesting volume backup for", container.id].join(" "));
                        core.cluster.legiond.send("containership-cloud.backup", {
                            path: _.first(container.volumes).host,
                            container_id: container.id,
                            backup_id: route.req.query.CSC_BACKUP_ID
                        }, peers[container.host]);
                    });
                });
            }
        });

        async.forever(function(fn){
            setTimeout(function(){
                var attributes = core.cluster.legiond.get_attributes();

                var providers = {
                    digitalocean: "do",
                    aws: "aws"
                }

                var options = {
                    url: ["http://api.containership.io", "v1", process.env.CSC_ORGANIZATION, "clusters", core.cluster_id].join("/"),
                    method: "POST",
                    timeout: 5000,
                    headers: {
                        "X-ContainerShip-Cloud-Email": process.env.CSC_EMAIL,
                        "X-ContainerShip-Cloud-Token": process.env.CSC_TOKEN
                    },
                    json: {
                        provider: providers[attributes.tags.cloud.provider],
                        ipaddress: attributes.address.public,
                        port: core.options["api-port"],
                        api_version: "v1"
                    }
                }

                if(attributes.praetor.leader){
                    core.loggers["containership-cloud"].log("debug", "Registering cluster with ContainerShip Cloud");
                    request(options, function(err, response){
                        if(err || response.statusCode != 201)
                            core.loggers["containership-cloud"].log("warn", "Unable to register cluster with ContainerShip Cloud");

                        return fn();
                    });
                }
                else
                    return fn();
            }, 15000);
        });
    }

}
