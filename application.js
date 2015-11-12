var _ = require("lodash");
var ContainershipPlugin = require("containership.plugin");
var cli = require([__dirname, "lib", "cli"].join("/"));
var leader = require([__dirname, "lib", "leader"].join("/"));
var follower = require([__dirname, "lib", "follower"].join("/"));
var nomnom = require("nomnom");

module.exports = new ContainershipPlugin({
    type: ["core", "cli"],
    name: "cloud",

    initialize: function(core){
        if(_.has(core, "logger")){
            core.logger.register("containership-cloud");

            var config = this.get_config("core");

            if(core.options.mode == "leader")
                leader.initialize(core, config);
            else
                follower.initialize(core, config);
        }
        else{
            _.each(cli, function(configuration, command){
                nomnom.command(command).options(configuration.options).callback(configuration.init)
            });

            return {
                nomnom:  nomnom
            }
        }
    },

    reload: function(){}
});
