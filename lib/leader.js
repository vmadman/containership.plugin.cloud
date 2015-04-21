var _ = require("lodash");
var request = require("request");
var async = require("async");
var events = require([__dirname, "events"].join("/"));

module.exports = {

    initialize: function(core){

        events.listen(core);

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
