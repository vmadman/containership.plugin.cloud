var _= require("lodash");
var providers = require([__dirname, "providers", "index"].join("/"));

module.exports = {

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
            provider: {
                position: 1,
                help: "Provider on which to launch the cluster",
                metavar: "PROVIDER",
                required: true,
                choices: ["vagrant"]
            },
        },

        init: function(options){
            var provider = providers[options.provider];

            provider.validate(function(err){
                if(err)
                    throw err;

                provider.destroy(function(err){
                    if(err)
                        throw err;
                });
            });
        }
    }

}
