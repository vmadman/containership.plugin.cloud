var _ = require("lodash");
var request = require("request");
var async = require("async");
var events = require([__dirname, "events"].join("/"));

module.exports = {

    initialize: function(core, config){

        events.listen(core, config);

        async.forever(function(fn){
            setTimeout(function(){
                var attributes = core.cluster.legiond.get_attributes();

                var providers = {
                    aws: "aws",
                    digitalocean: "do",
                    joyent: "joy",
                    linode: "lnd",
                    packet: "pkt",
                    rackspace: "rsp"
                }

                if(_.has(attributes.tags, "cloud"))
                    var provider = providers[attributes.tags.cloud.provider];
                else
                    var provider = undefined;

                var options = {
                    url: ["https://api.containership.io", "v2", "organizations", config.organization, "clusters", core.cluster_id].join("/"),
                    method: "POST",
                    timeout: 5000,
                    headers: {
                        Authorization: ["Bearer", config.api_key].join(" ")
                    },
                    json: {
                        provider: provider,
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
