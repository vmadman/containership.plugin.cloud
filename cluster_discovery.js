var fs = require("fs");
var _ = require("lodash");
var async = require("async");
var request = require("request");

var config = {};

fs.readFile([process.env.HOME, ".containership", "cloud.json"].join("/"), function(err, content){
    if(err)
        process.exit(1);

    try{
        config = JSON.parse(content);
    }
    catch(e){
        process.exit(1);
    }

    fs.readFile(["", "tmp", "containership.snapshot"].join("/"), function(err, content){
        if(err)
            process.exit(1);

        try{
            config = _.merge(config, JSON.parse(content));
        }
        catch(e){
            process.exit(1);
        }

        containership_cloud.get_configuration(config, function(err, response){
            if(err)
                process.exit(1);

            process.stdout.write(cloud[response.general.provider].parse(response));
        });
    });

});

var containership_cloud = {

    get_configuration: function(config, fn){
        var options = {
            url: ["https://api.containership.io", "v1", config.organization, "clusters", config.cluster_id, "configuration"].join("/"),
            method: "GET",
            timeout: 10000,
            headers: {
                "X-ContainerShip-Cloud-API-Key": config.api_key,
                "X-ContainerShip-Cloud-Organization": config.organization
            },
            json: true
        }

        request(options, function(err, response){
            if(err)
                return fn(err);
            else if(response.statusCode != 200)
                return fn(new Error(response.body));
            else
                return fn(null, response.body);
        });
    }

}

var cloud = {

    aws: {
        parse: function(configuration){
            var ip_addresses = _.flatten([
                _.pluck(configuration.leaders.instances, "PrivateIpAddress"),
                _.pluck(configuration.followers.instances, "PrivateIpAddress")
            ]);

            return _.map(ip_addresses, function(ip_address){
                ip_address = [ip_address, "32"].join("/");
                return ip_address;
            }).join(",");
        }
    },

    do: {
        parse: function(configuration){
            var ip_addresses = _.flatten([
                _.map(configuration.leaders.instances, function(instance){
                    if(_.isNull(instance))
                        return;

                    var ip_address = null;
                    _.each(instance.networks.v4, function(network){
                        if(network.type == "private")
                            ip_address = network.ip_address;
                    });

                    ip_address = [ip_address, "32"].join("/");
                    return ip_address;
                }),
                _.map(configuration.followers.instances, function(instance){
                    if(_.isNull(instance))
                        return;

                    var ip_address = null;
                    _.each(instance.networks.v4, function(network){
                        if(network.type == "private")
                            ip_address = network.ip_address;
                    });

                    ip_address = [ip_address, "32"].join("/");
                    return ip_address;
                })
            ]);

            return _.compact(ip_addresses).join(",");
        }
    },

    joy: {
        parse: function(configuration){
            return _.flatten([
                _.map(configuration.leaders.instances, function(instance){
                    var ip_address = _.without(instance.ips, instance.primaryIp);
                    ip_address = [ip_address, "32"].join("/");
                    return ip_address;
                }),
                _.map(configuration.followers.instances, function(instance){
                    var ip_address = _.without(instance.ips, instance.primaryIp);
                    ip_address = [ip_address, "32"].join("/");
                    return ip_address;
                })
            ]).join(",");
        }
    }

}
