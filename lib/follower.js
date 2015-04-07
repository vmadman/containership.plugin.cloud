var fs = require("fs");
var tar = require("tar");
var fstream = require("fstream");
var request = require("request");

module.exports = {

    initialize: function(core){
        core.cluster.legiond.join("containership-cloud.backup");

        // download snapshot from ContainerShip Cloud
        core.scheduler.follower.container.add_pre_start_middleware("docker", "containership-cloud", function(options, fn){
            if(_.has(options.env_vars, "CSC_BACKUP_ID") && !_.isEmpty(options.volumes)){
                var on_error = function(){
                    core.loggers["containership-cloud"].log("warn", "Error downloading container snapshot");
                }

                var options = {
                    url: ["http://api.containership.io", "v1", process.env.CSC_ORGANIZATION, "backups", options.env_vars.CSC_BACKUP_ID, "volumes", options.id].join("/"),
                    method: "GET",
                    timeout: 5000,
                    headers: {
                        "X-ContainerShip-Cloud-Email": process.env.CSC_EMAIL,
                        "X-ContainerShip-Cloud-Token": process.env.CSC_TOKEN
                    }
                }

                var extract_tar = tar.Extract({path: _.first(options.volumes).split(":")[0]}).on("error", on_error).on("end", function(){
                    return fn();
                });

                request(options).pipe(extract_tar);
            }
            else
                return fn();
        });

        // upload snapshot to ContainerShip Cloud
        core.cluster.legiond.on("containership-cloud.backup", function(data){
            var on_error = function(){
                core.loggers["containership-cloud"].log("warn", "Error creating container snapshot");
            }

            var create_tar = tar.Pack({ noProprietary: true }).on("error", on_error).on("end", function(){
                core.loggers["containership-cloud"].log("debug", "Transferring container snapshot to ContainerShip Cloud");
            });

            var options = {
                url: ["http://api.containership.io", "v1", process.env.CSC_ORGANIZATION, "backups", data.backup_id, "volumes", data.container_id].join("/"),
                method: "POST",
                timeout: 5000,
                headers: {
                    "X-ContainerShip-Cloud-Email": process.env.CSC_EMAIL,
                    "X-ContainerShip-Cloud-Token": process.env.CSC_TOKEN
                }
            }

            fstream.Reader({
                path: data.path,
                type: "Directory"
            }).on("error", on_error).pipe(create_tar).pipe(request(options));
        });
    }

}
