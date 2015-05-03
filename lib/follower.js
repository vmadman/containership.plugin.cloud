var _ = require("lodash");
var fs = require("fs");
var tar = require("tar");
var tarfs = require("tar-fs");
var fstream = require("fstream");
var request = require("request");

module.exports = {

    initialize: function(core, config){
        core.cluster.legiond.join("containership-cloud.backup");

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
