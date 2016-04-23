var _ = require("lodash");
var request = require("request");

var config;

var send_event = function(json){
    var options = {
        url: ["https://api.containership.io", "v2", "organizations", config.organization, "clusters", json.cluster_id, "events"].join("/"),
        method: "POST",
        timeout: 5000,
        headers: {
            "X-ContainerShip-Cloud-API-Key": config.api_key,
            "X-ContainerShip-Cloud-Organization": config.organization
        },
        json: json
    }

    request(options, function(err, response){
        if(err || response.statusCode != 201){
            core.loggers["containership-cloud"].log("warn", "Error sending event to ContainerShip Cloud");
            core.loggers["containership-cloud"].log("debug", ["Could not send:", event].join(" "));
        }
    });
}

module.exports = {

    listen: function(core, _config){

        config = _config;

        // create applications / backup applications event
        core.api.server.server.on("/:api_version/applications", function(route){
            if(route.req.method == "GET" && route.res.stash.code == 200){
                if(_.has(route.req.query, "CSC_BACKUP_ID")){
                    var peers = _.indexBy(core.cluster.legiond.get_peers(), "id");

                    if(_.has(route.req.query, "CSC_PERSIST_DATA")){
                        _.each(route.res.stash.body, function(application, application_name){
                            var containers = _.filter(application.containers, function(container){
                                return !_.isEmpty(container.volumes);
                            });

                            _.each(containers, function(container){
                                core.loggers["containership-cloud"].log("verbose", ["Requesting volume backup for", container.id].join(" "));
                                core.cluster.legiond.send({
                                    event: "containership-cloud.backup",
                                    data: {
                                        path: _.first(container.volumes).host,
                                        container_id: container.id,
                                        backup_id: route.req.query.CSC_BACKUP_ID
                                    }
                                }, peers[container.host]);
                            });
                        });
                    }
                }
            }
            else if(route.req.method == "POST" && route.res.stash.code == 201){
                send_event({
                    event: [_.keys(route.req.body).length, "applications created"].join(" "),
                    cluster_id: core.cluster_id
                });
            }
        });

        // create, update, remove application event
        core.api.server.server.on("/:api_version/applications/:application", function(route){
            if(route.req.method == "POST" && route.res.stash.code == 201){
                send_event({
                    event: ["Created application", route.req.application].join(" "),
                    cluster_id: core.cluster_id
                });
            }

            else if(route.req.method == "PUT" && route.res.stash.code == 200){
                send_event({
                    event: ["Updated application", route.req.application].join(" "),
                    cluster_id: core.cluster_id
                });
            }

            else if(route.req.method == "DELETE" && route.res.stash.code == 204){
                send_event({
                    event: ["Removed application", route.req.application].join(" "),
                    cluster_id: core.cluster_id
                });
            }
        });

        // scale application event
        core.api.server.server.on("/:api_version/applications/:application/containers", function(route){
            if(route.req.method == "POST" && route.res.stash.code == 201){
                send_event({
                    event: ["Scaled", route.req.application, "up by", route.req.query.count, "containers"].join(" "),
                    cluster_id: core.cluster_id
                });
            }

            else if(route.req.method == "DELETE" && route.res.stash.code == 204){
                send_event({
                    event: ["Scaled", route.req.application, "down by", route.req.query.count, "containers"].join(" "),
                    cluster_id: core.cluster_id
                });
            }
        });

        // remove container event
        core.api.server.server.on("/:api_version/applications/:application/containers/:container", function(route){
            if(route.req.method == "DELETE" && route.res.stash.code == 204){
                send_event({
                    event: ["Removed", route.req.application, "container", route.req.container].join(" "),
                    cluster_id: core.cluster_id
                });
            }
        });

        // new hosts event
        core.cluster.legiond.on("node_added", function(node){
            if(core.cluster.legiond.get_attributes().praetor.leader){
                send_event({
                    event: ["Added node", node.id].join(" "),
                    cluster_id: core.cluster_id
                });
            }
        });

        // handle removed nodes
        core.cluster.legiond.on("node_removed", function(node){
            if(core.cluster.legiond.get_attributes().praetor.leader){
                send_event({
                    event: ["Removed node", node.id].join(" "),
                    cluster_id: core.cluster_id
                });
            }
        });
    }
}
