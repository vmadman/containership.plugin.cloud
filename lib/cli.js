var fs = require("fs");
var _ = require("lodash");
var async = require("async");
var providers = require([__dirname, "providers", "index"].join("/"));
var read = require("read");
var request = require("request");
var sprintf = require("sprintf-js").sprintf;

module.exports = {

    login: {
        options: {
            username: {
                help: "ContainerShip Cloud username",
                metavar: "USERNAME",
                abbr: "u",
                required: true
            },
            password: {
                help: "ContainerShip Cloud password (omit to prompt)",
                metavar: "PASSWORD",
                abbr: "p"
            },
            mfa: {
                help: "ContainerShip Cloud MFA token",
                metavar: "MFA TOKEN",
                abbr: "m"
            }
        },

        init: function(options){
            var authenticate = function(){
                var request_options = {
                    url: "https://api.containership.io/v1/account/authenticate/email",
                    method: "POST",
                    json: {
                        email: options.username,
                        password: options.password,
                        mfa: options.mfa
                    }
                }

                config.load();

                request(request_options, function(err, response){
                   if(err || response.statusCode != 201){
                        process.stderr.write("Invalid username / password!");
                        process.exit(1);
                    }

                    if(_.isUndefined(config.config.headers))
                        config.config.headers = {};

                    config.config.headers["authorization"] = ["Bearer", response.body.token].join(" ");
                    config.config.headers["x-containership-cloud-organization"] = _.first(response.body.organizations);
                    config.set(config.config);
                    console.log(["Successfully logged in as", options.username].join(" "));
                });
            }

            if(!_.has(options, "password") || _.isEmpty(options.password)){
                read({
                    prompt: "ContainerShip Cloud Password: ",
                    silent: true
                }, function(err, password){
                    if(err)
                        throw err;

                    options.password = password;
                    authenticate();
                });
            }
            else
                authenticate();
        }
    },

    logout: {
        options: {},
        init: function(options){
            config.load();
            delete config.config.headers["authorization"];
            delete config.config.headers["x-containership-cloud-organization"];
            delete config.config.headers["x-containership-cloud-cluster"];
            config.set(config.config);
            console.log("Successfully logged out!");
        }
    },

    "list-orgs": {
        options: {},
        init: function(options){
            config.load();

            var request_options = {
                url: [
                    "https://api.containership.io",
                    "v1",
                    "account"
                ].join("/"),
                method: "GET",
                json: true,
                headers: _.pick(config.config.headers, "authorization")
            }

            request(request_options, function(err, response){
                if(err || response.statusCode != 200){
                    process.stderr.write("Could not fetch organizations!");
                    process.exit(1);
                }

                var orgs = {};

                async.each(response.body.organizations || [], function(organization, fn){
                    var request_options = {
                        url: [
                            "https://api.containership.io",
                            "v1",
                            "organizations",
                            organization
                        ].join("/"),
                        method: "GET",
                        json: true,
                        headers: _.pick(config.config.headers, "authorization")
                    }
                    request(request_options, function(err, response){
                        if(err || response.statusCode != 200)
                            return fn();
                        else{
                            orgs[organization] = response.body.owner;
                            return fn();
                        }
                    });
                }, function(err){
                    console.log(sprintf("%-50s %-50s",
                        "ORGANIZATION",
                        "OWNER"
                    ));

                    _.each(orgs, function(owner, org){
                        console.log(sprintf("%-50s %-50s",
                            [org, config.config.headers["x-containership-cloud-organization"] == org ? "*" : ""].join(""),
                            owner
                        ));
                    });
                });
            });
        }
    },

    "use-org": {
        options: {
            organization: {
                position: 1,
                help: "ContainerShip organization to use",
                metavar: "ORGANIZATION",
                required: true
            }
        },
        init: function(options){
            config.load();

            var request_options = {
                url: [
                    "https://api.containership.io",
                    "v1",
                    "account"
                ].join("/"),
                method: "GET",
                json: true,
                headers: _.pick(config.config.headers, "authorization")
            }

            request(request_options, function(err, response){
                if(err || response.statusCode != 200){
                    process.stderr.write("Could not fetch organizations!");
                    process.exit(1);
                }

                if(_.contains(response.body.organizations, options.organization)){
                    config.config.headers["x-containership-cloud-organization"] = options.organization;
                    config.set(config.config);
                    console.log(["Successfully switched to", options.organization, "organization!"].join(" "));
                }
                else{
                    process.stderr.write(["You do not belong to the", options.organization, "organization!"].join(" "));
                    process.exit(1);
                }
            });
        }
    },

    "create-cluster": {
        options: {
            provider: {
                position: 1,
                help: "Provider on which to launch the cluster",
                metavar: "PROVIDER",
                required: true,
                choices: ["vagrant"]
            },

            leaders: {
                help: "Number of leaders to create",
                metavar: "LEADERS",
                default: 1
            },
            followers: {
                help: "Number of followers to create",
                metavar: "FOLLOWERS",
                default: 2
            },
            plugins: {
                help: "List of ContainerShip plugins to install",
                metavar: "PLUGINS",
                default: "navigator,service-discovery"
            }
        },

        init: function(options){
            var provider = providers[options.provider];

            provider.validate(function(err){
                if(err)
                    throw err;

                provider.create({
                    leaders: options.leaders,
                    followers: options.followers,
                    plugins: options.plugins
                }, function(err){
                    if(err)
                        throw err;
                });
            });
        }
    },

    "destroy-cluster": {
        options: {
            "cluster-id": {
                position: 1,
                help: "ID of the cluster to destroy",
                metavar: "CLUSTER_ID",
                required: true
            },
        },

        init: function(options){
            config.load();

            providers.vagrant.get_clusters(function(err, clusters){
                var request_options = {
                    url: [
                        "https://api.containership.io",
                        "v1",
                        config.config.headers["x-containership-cloud-organization"],
                        "clusters"
                    ].join("/"),
                    method: "GET",
                    json: true,
                    headers: _.pick(config.config.headers, "authorization")
                }

                request(request_options, function(err, response){
                    if(!err && response.statusCode == 200){
                        clusters.push(response.body);
                        clusters = _.flatten(clusters);
                    }

                    clusters = _.indexBy(clusters, "id");

                    if(_.has(clusters, options["cluster-id"]) && clusters[options["cluster-id"]].provider == "vag"){
                        providers.vagrant.validate(function(err){
                            if(err)
                                throw err;

                            providers.vagrant.destroy(function(err){
                                if(err)
                                    throw err;

                                console.log(["Successfully destroyed cluster:", options["cluster-id"]].join(" "));
                            });
                        });
                    }
                    else{
                        process.stderr.write("Unable to destroy cluster!");
                        process.exit(1);
                    }
                });
            });
        }
    },

    "use-cluster": {
        options: {
            "cluster-id": {
                position: 1,
                help: "ContainerShip cluster ID",
                metavar: "CLUSTER ID",
                required: true
            }
        },
        init: function(options){
            config.load();
            config.config["api-url"] = "https://api.containership.io";
            config.config.headers["x-containership-cloud-cluster"] = options["cluster-id"];
            config.set(config.config);
            console.log(["Successfully updated config to use cluster", options["cluster-id"]].join(" "));
        }
    },

    "list-clusters": {
        options: {},
        init: function(options){
            config.load();

            providers.vagrant.get_clusters(function(err, clusters){
                var request_options = {
                    url: [
                        "https://api.containership.io",
                        "v1",
                        config.config.headers["x-containership-cloud-organization"],
                        "clusters"
                    ].join("/"),
                    method: "GET",
                    json: true,
                    headers: _.pick(config.config.headers, "authorization")
                }

                request(request_options, function(err, response){
                    if(!err && response.statusCode == 200){
                        clusters.push(response.body);
                        clusters = _.flatten(clusters);
                    }

                    var providers = {
                        aws: "Amazon Web Services",
                        do: "Digital Ocean",
                        na: "Not Available",
                        vag: "Vagrant"
                    }

                    console.log(sprintf("%-35s %-40s %-25s %-15s %-10s %-10s",
                        "ID",
                        "NAME",
                        "PROVIDER",
                        "APPLICATIONS",
                        "LEADERS",
                        "FOLLOWERS"
                    ));

                    _.each(clusters, function(cluster){
                        var hosts = _.groupBy(_.values(cluster.hosts), function(host){
                            return host.mode;
                        });

                        console.log(sprintf("%-35s %-40s %-25s %-15s %-10s %-10s",
                            cluster.id,
                            cluster.name || "",
                            providers[cluster.provider] || providers.na,
                            _.keys(cluster.applications).length,
                            hosts.leader && hosts.leader.length || "0",
                            hosts.follower && hosts.follower.length || "0"
                        ));
                    });
                });
            });
        }
    },

}

var config = {
    load: function(){
        try{
            this.config = JSON.parse(fs.readFileSync([process.env["HOME"], ".containership", "cli.json"].join("/")));
        }
        catch(e){
            process.stdout.write("Could not load Containership config file. Does it exist?");
            process.exit(1);
        }
    },

    set: function(new_config){
        var self = this;
        try{
            var config = JSON.parse(fs.readFileSync([process.env["HOME"], ".containership", "cli.json"].join("/")));
        }
        catch(e){
            var config = {};
        }

        try{
            fs.writeFileSync([process.env["HOME"], ".containership", "cli.json"].join("/"), JSON.stringify(new_config));
            this.config = config;
        }
        catch(e){
            process.stdout.write("Could not write Containership config file");
            process.exit(1);
        }
    }
}
