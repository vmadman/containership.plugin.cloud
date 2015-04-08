var ContainershipPlugin = require("containership.plugin");
var leader = require([__dirname, "lib", "leader"].join("/"));
var follower = require([__dirname, "lib", "follower"].join("/"));

module.exports = new ContainershipPlugin({
    type: "core",

    initialize: function(core){
        core.logger.register("containership-cloud");

        if(core.options.mode == "leader")
            leader.initialize(core);
        else
            follower.initialize(core);
    },

    reload: function(){}
});
