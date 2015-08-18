var _ = require("lodash");
var fs = require("fs");
var tar = require("tar");
var tarfs = require("tar-fs");
var fstream = require("fstream");
var request = require("request");

module.exports = {

    initialize: function(core, config){
        core.cluster.legiond.join("containership-cloud.backup");

        // enables registry authentication
        core.scheduler.follower.container.add_pre_pull_middleware("docker", "authentication", function(options, fn){
            var request_options = {
                    url: ["https://api.containership.io", "v1", config.organization, "registries"].join("/"),
                    method: "GET",
                    headers: {
                        "X-ContainerShip-Cloud-API-Key": config.api_key,
                        "X-ContainerShip-Cloud-Organization": config.organization
                    },
                    json: true
            }

            request(request_options, function(err, response){
                if(err)
                    return fn(err);
                else if(response.statusCode != 200)
                    return fn(new Error("Invalid response when fetching registries!"));

                var registries = _.groupBy(response.body, "serveraddress");

                if(options.image.split("/").length > 2)
                    var registry = options.image.split("/").slice(0, options.image.split("/").length - 2);
                else
                    var registry = "docker.io";

                options.auth = [];

                if(_.has(registries, registry)){
                    _.each(registries[registry], function(registry){
                        options.auth.push({
                            authconfig: {
                                email: registry.email,
                                username: registry.username,
                                password: registry.password,
                                serveraddress: registry.serveraddress,
                                auth: ""
                            }
                        });
                    });
                }
                else
                    options.auth.push({});

                return fn();
            });
        });

        // download snapshot from ContainerShip Cloud
        core.scheduler.follower.container.add_pre_start_middleware("docker", "containership-cloud", function(container_options, fn){
            if(_.has(container_options.env_vars, "CSC_BACKUP_ID") && !_.isEmpty(container_options.volumes)){
                var on_error = function(){
                    core.loggers["containership-cloud"].log("warn", "Error downloading container snapshot");
                }

                var options = {
                    url: ["https://api.containership.io", "v1", config.organization, "backups", container_options.env_vars.CSC_BACKUP_ID, "volumes", container_options.id].join("/"),
                    method: "GET",
                    headers: {
                        "X-ContainerShip-Cloud-API-Key": config.api_key,
                        "X-ContainerShip-Cloud-Organization": config.organization
                    }
                }

                var extract_tar = tar.Extract({path: _.first(container_options.volumes).host}).on("error", on_error).on("end", function(){
                    return fn();
                });

                request(options).pipe(extract_tar);
            }
            else
                return fn();
        });

        // upload snapshot to ContainerShip Cloud
        core.cluster.legiond.on("containership-cloud.backup", function(data){
            var options = {
                url: ["https://api.containership.io", "v1", config.organization, "backups", data.backup_id, "volumes", data.container_id].join("/"),
                method: "POST",
                headers: {
                    "X-ContainerShip-Cloud-API-Key": config.api_key,
                    "X-ContainerShip-Cloud-Organization": config.organization
                }
            }

            tarfs.pack(data.path).pipe(request(options));
        });
    }

}
